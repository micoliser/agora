import pytest
import json
from genlayer import u256
from gltest import get_contract_factory, get_validator_factory, create_accounts

accounts = create_accounts(4)
admin = accounts[0]
author = accounts[1]
flagger = accounts[2]
bad_flagger = accounts[3]

def _mock_validators(count, is_violation, reason):
    val_factory = get_validator_factory()
    mock_response = json.dumps({"is_violation": is_violation, "reason": reason})
    val_factory.batch_create_mock_validators(count=count, mock_llm_response=mock_response)

@pytest.fixture
def test_env():
    factory = get_contract_factory("Forum")
    contract = factory.deploy(
        args=[
            "Test DAO",
            "A test community",
            "No spam",
            u256(86400), # appeal_window_seconds
            u256(50), # min_reputation_to_post
            u256(100), # starting_reputation
            u256(50), # reputation_penalty_violation
            u256(30), # reputation_penalty_bad_flag
            u256(10), # reputation_reward_good_flag
            u256(300), # flag_cooldown_seconds
            u256(86400) # min_flag_age_seconds (24 hours)
        ],
        account=admin
    )
    return contract

def test_create_community(test_env):
    contract = test_env.connect(admin)
    community_id = contract.create_community(
        "Another DAO",
        "Desc",
        "Rules",
        u256(86400),
        u256(50),
        u256(100),
        u256(50),
        u256(30),
        u256(10),
        u256(300),
        u256(86400)
    )
    assert community_id == 1
    
    com = contract.get_community(community_id)
    assert com["name"] == "Another DAO"
    assert com["min_flag_age_seconds"] == 86400

def test_sybil_gate_blocks_new_account_from_flagging(test_env, gltest_vm):
    contract = test_env
    # Author makes a post, implicitly joining
    contract.connect(author).create_post(0, "Hello world")
    
    # Flagger makes a comment to implicitly join
    contract.connect(flagger).create_comment(0, "I am joining")
    
    # Immediately try to flag the post
    _mock_validators(3, True, "Spam")
    try:
        contract.connect(flagger).flag_post(0)
        assert False, "Should have failed with min flag age error"
    except Exception as e:
        assert "Account is too new to flag in this community" in str(e)
        
    # Advance time by 25 hours
    gltest_vm.timestamp += 90000
    
    # Now they should be able to flag
    contract.connect(flagger).flag_post(0)
    post = contract.get_post(0)
    assert post["status"] == 1 # REMOVED

def test_flag_post_violation_distinct_users(test_env, gltest_vm):
    contract = test_env
    contract.connect(author).create_post(0, "Spam post")
    
    contract.connect(flagger).create_post(0, "Join")
    gltest_vm.timestamp += 90000
    
    _mock_validators(3, True, "Spam detected")
    contract.connect(flagger).flag_post(0)
    
    post = contract.get_post(0)
    assert post["status"] == 1 # REMOVED
    assert post["moderation_verdict"] == "Spam detected"
    
    # Author penalty: 100 - 50 = 50
    assert contract.get_reputation(0, author) == 50
    # Flagger reward: 100 + 10 = 110
    assert contract.get_reputation(0, flagger) == 110

def test_flag_post_no_violation_distinct_users(test_env, gltest_vm):
    contract = test_env
    contract.connect(author).create_post(0, "Good post")
    contract.connect(bad_flagger).create_post(0, "Join")
    gltest_vm.timestamp += 90000
    
    _mock_validators(3, False, "Not spam")
    contract.connect(bad_flagger).flag_post(0)
    
    post = contract.get_post(0)
    assert post["status"] == 0 # ACTIVE
    
    # Author untouched
    assert contract.get_reputation(0, author) == 100
    # Flagger penalty: 100 - 30 = 70
    assert contract.get_reputation(0, bad_flagger) == 70

def test_appeal_post_overturned_distinct_users(test_env, gltest_vm):
    contract = test_env
    contract.connect(author).create_post(0, "Unfairly removed")
    contract.connect(flagger).create_post(0, "Join")
    gltest_vm.timestamp += 90000
    
    _mock_validators(3, True, "Spam")
    contract.connect(flagger).flag_post(0)
    
    _mock_validators(3, False, "Not spam")
    # Appeal with defense
    contract.connect(author).appeal_post(0, "This is not spam because I am just sharing a valid link")
    
    post = contract.get_post(0)
    assert post["status"] == 2 # RESTORED
    assert post["appeal_verdict"] == "Not spam"
    
    # Reputation should be reversed
    assert contract.get_reputation(0, author) == 100
    assert contract.get_reputation(0, flagger) == 100

def test_appeal_post_denied(test_env, gltest_vm):
    contract = test_env
    contract.connect(author).create_post(0, "Actually spam")
    contract.connect(flagger).create_post(0, "Join")
    gltest_vm.timestamp += 90000
    
    _mock_validators(3, True, "Spam")
    contract.connect(flagger).flag_post(0)
    
    _mock_validators(3, True, "Still spam")
    contract.connect(author).appeal_post(0, "Please?")
    
    post = contract.get_post(0)
    assert post["status"] == 3 # APPEAL_DENIED
    
    # Reputation stays penalized/rewarded
    assert contract.get_reputation(0, author) == 50
    assert contract.get_reputation(0, flagger) == 110

def test_cannot_flag_own_content(test_env, gltest_vm):
    contract = test_env
    contract.connect(author).create_post(0, "My post")
    gltest_vm.timestamp += 90000
    
    try:
        contract.connect(author).flag_post(0)
        assert False, "Should have prevented self flag"
    except Exception as e:
        assert "cannot flag your own content" in str(e)

def test_strict_verdict_rejects_non_boolean(test_env, gltest_vm):
    contract = test_env
    contract.connect(author).create_post(0, "Spam post")
    contract.connect(flagger).create_post(0, "Join")
    gltest_vm.timestamp += 90000
    
    # Return string "true" instead of boolean true
    val_factory = get_validator_factory()
    mock_response = json.dumps({"is_violation": "true", "reason": "Spam"})
    val_factory.batch_create_mock_validators(count=3, mock_llm_response=mock_response)
    
    try:
        contract.connect(flagger).flag_post(0)
        assert False, "Should reject non-boolean"
    except Exception as e:
        assert "must be a boolean" in str(e)

def test_reputation_clamping_and_reversal(test_env, gltest_vm):
    contract = test_env
    contract.connect(author).create_post(0, "Bad")
    contract.connect(flagger).create_post(0, "Join")
    gltest_vm.timestamp += 90000
    
    # We need multiple penalties to drive author to 0
    _mock_validators(3, True, "Spam")
    contract.connect(flagger).flag_post(0) # author rep = 50
    
    gltest_vm.timestamp += 400 # Pass flag cooldown
    contract.connect(author).create_post(0, "Bad 2")
    _mock_validators(3, True, "Spam")
    contract.connect(flagger).flag_post(2) # author rep = 0 (deducted 50)
    
    assert contract.get_reputation(0, author) == 0
    
    # Let's appeal the second post and ensure only 50 is restored.
    _mock_validators(3, False, "Not spam")
    contract.connect(author).appeal_post(2, "Defense")
    
    assert contract.get_reputation(0, author) == 50

def test_strict_verdict_rejects_missing_reason(test_env, gltest_vm):
    contract = test_env
    contract.connect(author).create_post(0, "Spam post")
    contract.connect(flagger).create_post(0, "Join")
    gltest_vm.timestamp += 90000
    
    # Missing reason
    val_factory = get_validator_factory()
    mock_response = json.dumps({"is_violation": True})
    val_factory.batch_create_mock_validators(count=3, mock_llm_response=mock_response)
    
    try:
        contract.connect(flagger).flag_post(0)
        assert False, "Should reject missing reason"
    except Exception as e:
        assert "'reason' must be a non-empty string" in str(e)

def test_strict_verdict_rejects_non_string_reason(test_env, gltest_vm):
    contract = test_env
    contract.connect(author).create_post(0, "Spam post")
    contract.connect(flagger).create_post(0, "Join")
    gltest_vm.timestamp += 90000
    
    # Non-string reason
    val_factory = get_validator_factory()
    mock_response = json.dumps({"is_violation": True, "reason": 123})
    val_factory.batch_create_mock_validators(count=3, mock_llm_response=mock_response)
    
    try:
        contract.connect(flagger).flag_post(0)
        assert False, "Should reject non-string reason"
    except Exception as e:
        assert "'reason' must be a non-empty string" in str(e)

def test_strict_verdict_rejects_empty_string_reason(test_env, gltest_vm):
    contract = test_env
    contract.connect(author).create_post(0, "Spam post")
    contract.connect(flagger).create_post(0, "Join")
    gltest_vm.timestamp += 90000
    
    # Empty string reason
    val_factory = get_validator_factory()
    mock_response = json.dumps({"is_violation": True, "reason": "   "})
    val_factory.batch_create_mock_validators(count=3, mock_llm_response=mock_response)
    
    try:
        contract.connect(flagger).flag_post(0)
        assert False, "Should reject empty string reason"
    except Exception as e:
        assert "'reason' must be a non-empty string" in str(e)

def test_flag_comment_violation(test_env, gltest_vm):
    contract = test_env
    contract.connect(author).create_post(0, "Good post")
    contract.connect(author).create_comment(0, "Spam comment")
    
    contract.connect(flagger).create_post(0, "Join")
    gltest_vm.timestamp += 90000
    
    _mock_validators(3, True, "Spam comment detected")
    contract.connect(flagger).flag_comment(0)
    
    comment = contract.get_comment(0)
    assert comment["status"] == 1 # REMOVED
    assert comment["moderation_verdict"] == "Spam comment detected"
    
    # Author penalty
    assert contract.get_reputation(0, author) == 50
    # Flagger reward
    assert contract.get_reputation(0, flagger) == 110

def test_appeal_comment_overturned(test_env, gltest_vm):
    contract = test_env
    contract.connect(author).create_post(0, "Good post")
    contract.connect(author).create_comment(0, "Unfairly removed comment")
    
    contract.connect(flagger).create_post(0, "Join")
    gltest_vm.timestamp += 90000
    
    _mock_validators(3, True, "Spam")
    contract.connect(flagger).flag_comment(0)
    
    _mock_validators(3, False, "Not spam")
    contract.connect(author).appeal_comment(0, "This is not spam")
    
    comment = contract.get_comment(0)
    assert comment["status"] == 2 # RESTORED
    assert comment["appeal_verdict"] == "Not spam"
    
    # Reputation should be reversed
    assert contract.get_reputation(0, author) == 100
    assert contract.get_reputation(0, flagger) == 100

def test_appeal_comment_denied(test_env, gltest_vm):
    contract = test_env
    contract.connect(author).create_post(0, "Good post")
    contract.connect(author).create_comment(0, "Spam comment")
    
    contract.connect(flagger).create_post(0, "Join")
    gltest_vm.timestamp += 90000
    
    _mock_validators(3, True, "Spam")
    contract.connect(flagger).flag_comment(0)
    
    _mock_validators(3, True, "Still spam")
    contract.connect(author).appeal_comment(0, "Please?")
    
    comment = contract.get_comment(0)
    assert comment["status"] == 3 # APPEAL_DENIED
    
    assert contract.get_reputation(0, author) == 50
    assert contract.get_reputation(0, flagger) == 110
