import pytest
import json
from datetime import datetime, timezone, timedelta

def _mock_validators(vm, is_violation, reason):
    vm.clear_mocks()
    vm.mock_llm(
        r".*",
        json.dumps({"is_violation": is_violation, "reason": reason}) if reason is not None else json.dumps({"is_violation": is_violation})
    )

@pytest.fixture
def test_env(direct_vm, direct_deploy, direct_accounts):
    admin = direct_accounts[0]
    direct_vm.sender = admin
    contract = direct_deploy(
        "contracts/forum.py",
        "Test DAO",
        "A test community",
        "No spam",
        86400, # appeal_window_seconds
        50, # min_reputation_to_post
        100, # starting_reputation
        50, # reputation_penalty_violation
        30, # reputation_penalty_bad_flag
        10, # reputation_reward_good_flag
        300, # flag_cooldown_seconds
        86400 # min_flag_age_seconds
    )
    return contract

def _advance_time(vm, seconds):
    current = datetime.now(timezone.utc)
    if not hasattr(vm, "_test_time"):
        vm._test_time = datetime.now(timezone.utc)
    
    vm._test_time += timedelta(seconds=seconds)
    vm.warp(vm._test_time.isoformat())


def test_create_community(test_env, direct_vm, direct_accounts):
    contract = test_env
    admin = direct_accounts[0]
    direct_vm.sender = admin
    
    community_id = contract.create_community(
        "Another DAO",
        "Desc",
        "Rules",
        86400,
        50,
        100,
        50,
        30,
        10,
        300,
        86400
    )
    assert community_id == 1
    
    com = contract.get_community(community_id)
    assert com["name"] == "Another DAO"
    assert com["min_flag_age_seconds"] == 86400

def test_sybil_gate_blocks_new_account_from_flagging(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    flagger = direct_accounts[2]
    
    _advance_time(direct_vm, 0) # init
    
    # Author makes a post, implicitly joining
    direct_vm.sender = author
    contract.create_post(0, "Hello world")
    
    # Flagger makes a comment to implicitly join
    direct_vm.sender = flagger
    contract.create_comment(0, "I am joining")
    
    # Immediately try to flag the post
    _mock_validators(direct_vm, True, "Spam")
    try:
        direct_vm.sender = flagger
        contract.flag_post(0)
        assert False, "Should have failed with min flag age error"
    except Exception as e:
        assert "Account is too new to flag in this community" in str(e)
        
    # Advance time by 25 hours
    _advance_time(direct_vm, 90000)
    
    # Now they should be able to flag
    direct_vm.sender = flagger
    contract.flag_post(0)
    post = contract.get_post(0)
    assert post["status"] == 1 # REMOVED

def test_flag_post_violation_distinct_users(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    flagger = direct_accounts[2]
    
    _advance_time(direct_vm, 0)
    
    direct_vm.sender = author
    contract.create_post(0, "Spam post")
    
    direct_vm.sender = flagger
    contract.create_post(0, "Join")
    
    _advance_time(direct_vm, 90000)
    
    _mock_validators(direct_vm, True, "Spam detected")
    direct_vm.sender = flagger
    contract.flag_post(0)
    
    post = contract.get_post(0)
    assert post["status"] == 1 # REMOVED
    assert post["moderation_verdict"] == "Spam detected"
    
    # Author penalty: 100 - 50 = 50
    assert contract.get_reputation(0, "0x" + author.hex()) == 50
    # Flagger reward: 100 + 10 = 110
    assert contract.get_reputation(0, "0x" + flagger.hex()) == 110

def test_flag_post_no_violation_distinct_users(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    bad_flagger = direct_accounts[3]
    
    _advance_time(direct_vm, 0)
    
    direct_vm.sender = author
    contract.create_post(0, "Good post")
    
    direct_vm.sender = bad_flagger
    contract.create_post(0, "Join")
    
    _advance_time(direct_vm, 90000)
    
    _mock_validators(direct_vm, False, "Not spam")
    direct_vm.sender = bad_flagger
    contract.flag_post(0)
    
    post = contract.get_post(0)
    assert post["status"] == 0 # ACTIVE
    
    # Author untouched
    assert contract.get_reputation(0, "0x" + author.hex()) == 100
    # Flagger penalty: 100 - 30 = 70
    assert contract.get_reputation(0, "0x" + bad_flagger.hex()) == 70

def test_appeal_post_overturned_distinct_users(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    flagger = direct_accounts[2]
    
    _advance_time(direct_vm, 0)
    
    direct_vm.sender = author
    contract.create_post(0, "Unfairly removed")
    
    direct_vm.sender = flagger
    contract.create_post(0, "Join")
    
    _advance_time(direct_vm, 90000)
    
    _mock_validators(direct_vm, True, "Spam")
    direct_vm.sender = flagger
    contract.flag_post(0)
    
    _mock_validators(direct_vm, False, "Not spam")
    # Appeal with defense
    direct_vm.sender = author
    contract.appeal_post(0, "This is not spam because I am just sharing a valid link")
    
    post = contract.get_post(0)
    assert post["status"] == 2 # RESTORED
    assert post["appeal_verdict"] == "Not spam"
    
    # Reputation should be reversed
    assert contract.get_reputation(0, "0x" + author.hex()) == 100
    assert contract.get_reputation(0, "0x" + flagger.hex()) == 100

def test_appeal_post_denied(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    flagger = direct_accounts[2]
    
    _advance_time(direct_vm, 0)
    
    direct_vm.sender = author
    contract.create_post(0, "Actually spam")
    
    direct_vm.sender = flagger
    contract.create_post(0, "Join")
    
    _advance_time(direct_vm, 90000)
    
    _mock_validators(direct_vm, True, "Spam")
    direct_vm.sender = flagger
    contract.flag_post(0)
    
    _mock_validators(direct_vm, True, "Still spam")
    direct_vm.sender = author
    contract.appeal_post(0, "Please?")
    
    post = contract.get_post(0)
    assert post["status"] == 3 # APPEAL_DENIED
    
    # Reputation stays penalized/rewarded
    assert contract.get_reputation(0, "0x" + author.hex()) == 50
    assert contract.get_reputation(0, "0x" + flagger.hex()) == 110

def test_cannot_flag_own_content(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    
    _advance_time(direct_vm, 0)
    
    direct_vm.sender = author
    contract.create_post(0, "My post")
    _advance_time(direct_vm, 90000)
    
    try:
        direct_vm.sender = author
        contract.flag_post(0)
        assert False, "Should have prevented self flag"
    except Exception as e:
        assert "cannot flag your own content" in str(e)

def test_strict_verdict_rejects_non_boolean(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    flagger = direct_accounts[2]
    
    _advance_time(direct_vm, 0)
    
    direct_vm.sender = author
    contract.create_post(0, "Spam post")
    
    direct_vm.sender = flagger
    contract.create_post(0, "Join")
    
    _advance_time(direct_vm, 90000)
    
    # Return string "true" instead of boolean true
    direct_vm.mock_llm(
        r".*",
        json.dumps({"is_violation": "true", "reason": "Spam"})
    )
    
    try:
        direct_vm.sender = flagger
        contract.flag_post(0)
        assert False, "Should reject non-boolean"
    except Exception as e:
        assert "must be a boolean" in str(e)

def test_reputation_clamping_and_reversal(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    flagger = direct_accounts[2]
    
    _advance_time(direct_vm, 0)
    
    direct_vm.sender = author
    contract.create_post(0, "Bad")
    
    direct_vm.sender = flagger
    contract.create_post(0, "Join")
    
    _advance_time(direct_vm, 90000)
    
    # We need multiple penalties to drive author to 0
    _mock_validators(direct_vm, True, "Spam")
    direct_vm.sender = flagger
    contract.flag_post(0) # author rep = 50
    
    _advance_time(direct_vm, 400) # Pass flag cooldown
    
    direct_vm.sender = author
    contract.create_post(0, "Bad 2")
    
    _mock_validators(direct_vm, True, "Spam")
    direct_vm.sender = flagger
    contract.flag_post(2) # author rep = 0 (deducted 50)
    
    assert contract.get_reputation(0, "0x" + author.hex()) == 0
    
    # Let's appeal the second post and ensure only 50 is restored.
    _mock_validators(direct_vm, False, "Not spam")
    direct_vm.sender = author
    contract.appeal_post(2, "Defense")
    
    assert contract.get_reputation(0, "0x" + author.hex()) == 50

def test_strict_verdict_rejects_missing_reason(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    flagger = direct_accounts[2]
    
    _advance_time(direct_vm, 0)
    
    direct_vm.sender = author
    contract.create_post(0, "Spam post")
    
    direct_vm.sender = flagger
    contract.create_post(0, "Join")
    
    _advance_time(direct_vm, 90000)
    
    direct_vm.mock_llm(
        r".*",
        json.dumps({"is_violation": True})
    )
    
    try:
        direct_vm.sender = flagger
        contract.flag_post(0)
        assert False, "Should reject missing reason"
    except Exception as e:
        assert "'reason' must be a non-empty string" in str(e)

def test_strict_verdict_rejects_non_string_reason(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    flagger = direct_accounts[2]
    
    _advance_time(direct_vm, 0)
    
    direct_vm.sender = author
    contract.create_post(0, "Spam post")
    
    direct_vm.sender = flagger
    contract.create_post(0, "Join")
    
    _advance_time(direct_vm, 90000)
    
    direct_vm.mock_llm(
        r".*",
        json.dumps({"is_violation": True, "reason": 123})
    )
    
    try:
        direct_vm.sender = flagger
        contract.flag_post(0)
        assert False, "Should reject non-string reason"
    except Exception as e:
        assert "'reason' must be a non-empty string" in str(e)

def test_strict_verdict_rejects_empty_string_reason(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    flagger = direct_accounts[2]
    
    _advance_time(direct_vm, 0)
    
    direct_vm.sender = author
    contract.create_post(0, "Spam post")
    
    direct_vm.sender = flagger
    contract.create_post(0, "Join")
    
    _advance_time(direct_vm, 90000)
    
    direct_vm.mock_llm(
        r".*",
        json.dumps({"is_violation": True, "reason": "   "})
    )
    
    try:
        direct_vm.sender = flagger
        contract.flag_post(0)
        assert False, "Should reject empty string reason"
    except Exception as e:
        assert "'reason' must be a non-empty string" in str(e)

def test_flag_comment_violation(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    flagger = direct_accounts[2]
    
    _advance_time(direct_vm, 0)
    
    direct_vm.sender = author
    contract.create_post(0, "Good post")
    contract.create_comment(0, "Spam comment")
    
    direct_vm.sender = flagger
    contract.create_post(0, "Join")
    
    _advance_time(direct_vm, 90000)
    
    _mock_validators(direct_vm, True, "Spam comment detected")
    direct_vm.sender = flagger
    contract.flag_comment(0)
    
    comment = contract.get_comment(0)
    assert comment["status"] == 1 # REMOVED
    assert comment["moderation_verdict"] == "Spam comment detected"
    
    # Author penalty
    assert contract.get_reputation(0, "0x" + author.hex()) == 50
    # Flagger reward
    assert contract.get_reputation(0, "0x" + flagger.hex()) == 110

def test_appeal_comment_overturned(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    flagger = direct_accounts[2]
    
    _advance_time(direct_vm, 0)
    
    direct_vm.sender = author
    contract.create_post(0, "Good post")
    contract.create_comment(0, "Unfairly removed comment")
    
    direct_vm.sender = flagger
    contract.create_post(0, "Join")
    
    _advance_time(direct_vm, 90000)
    
    _mock_validators(direct_vm, True, "Spam")
    direct_vm.sender = flagger
    contract.flag_comment(0)
    
    _mock_validators(direct_vm, False, "Not spam")
    direct_vm.sender = author
    contract.appeal_comment(0, "This is not spam")
    
    comment = contract.get_comment(0)
    assert comment["status"] == 2 # RESTORED
    assert comment["appeal_verdict"] == "Not spam"
    
    # Reputation should be reversed
    assert contract.get_reputation(0, "0x" + author.hex()) == 100
    assert contract.get_reputation(0, "0x" + flagger.hex()) == 100

def test_appeal_comment_denied(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    flagger = direct_accounts[2]
    
    _advance_time(direct_vm, 0)
    
    direct_vm.sender = author
    contract.create_post(0, "Good post")
    contract.create_comment(0, "Spam comment")
    
    direct_vm.sender = flagger
    contract.create_post(0, "Join")
    
    _advance_time(direct_vm, 90000)
    
    _mock_validators(direct_vm, True, "Spam")
    direct_vm.sender = flagger
    contract.flag_comment(0)
    
    _mock_validators(direct_vm, True, "Still spam")
    direct_vm.sender = author
    contract.appeal_comment(0, "Please?")
    
    comment = contract.get_comment(0)
    assert comment["status"] == 3 # APPEAL_DENIED
    
    assert contract.get_reputation(0, "0x" + author.hex()) == 50
    assert contract.get_reputation(0, "0x" + flagger.hex()) == 110
