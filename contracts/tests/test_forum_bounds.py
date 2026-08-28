import pytest
from datetime import datetime, timezone, timedelta

def _advance_time(vm, seconds):
    current = datetime.now(timezone.utc)
    if not hasattr(vm, "_test_time"):
        vm._test_time = datetime.now(timezone.utc)
    vm._test_time += timedelta(seconds=seconds)
    vm.warp(vm._test_time.isoformat())

@pytest.fixture
def test_env(direct_vm, direct_deploy, direct_accounts):
    admin = direct_accounts[0]
    direct_vm.sender = admin
    contract = direct_deploy(
        "contracts/forum.py",
        "Test DAO",
        "A test community",
        "No spam",
        3600, # appeal_window_seconds: 1 hour
        50, # min_reputation_to_post
        100, # starting_reputation
        50, # reputation_penalty_violation
        30, # reputation_penalty_bad_flag
        10, # reputation_reward_good_flag
        300, # flag_cooldown_seconds
        86400 # min_flag_age_seconds
    )
    return contract

def test_create_community_name_length(direct_vm, direct_deploy, direct_accounts):
    admin = direct_accounts[0]
    direct_vm.sender = admin
    try:
        direct_deploy("contracts/forum.py", "N" * 101, "desc", "const", 3600, 50, 100, 50, 30, 10, 300, 86400)
        assert False
    except Exception as e:
        assert "Name too long" in str(e)

def test_create_community_const_length(direct_vm, direct_deploy, direct_accounts):
    admin = direct_accounts[0]
    direct_vm.sender = admin
    try:
        direct_deploy("contracts/forum.py", "Name", "desc", "C" * 5001, 3600, 50, 100, 50, 30, 10, 300, 86400)
        assert False
    except Exception as e:
        assert "Constitution too long" in str(e)

def test_create_community_rep_bounds(direct_vm, direct_deploy, direct_accounts):
    admin = direct_accounts[0]
    direct_vm.sender = admin
    try:
        direct_deploy("contracts/forum.py", "Name", "desc", "const", 3600, 150, 100, 50, 30, 10, 300, 86400)
        assert False
    except Exception as e:
        assert "min_reputation_to_post cannot exceed starting_reputation" in str(e)

def test_create_community_appeal_window(direct_vm, direct_deploy, direct_accounts):
    admin = direct_accounts[0]
    direct_vm.sender = admin
    try:
        direct_deploy("contracts/forum.py", "Name", "desc", "const", 3000, 50, 100, 50, 30, 10, 300, 86400)
        assert False
    except Exception as e:
        assert "Appeal window must be between 1 hour and 30 days" in str(e)

def test_post_and_comment_validation(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    direct_vm.sender = author
    _advance_time(direct_vm, 0)
    
    # Test Post content too long
    try:
        contract.create_post(0, "A" * 2001)
        assert False, "Should fail on post too long"
    except Exception as e:
        assert "Content too long" in str(e)
        
    # Test Comment content too long
    contract.create_post(0, "Valid post")
    try:
        contract.create_comment(0, "C" * 2001)
        assert False, "Should fail on comment too long"
    except Exception as e:
        assert "Content too long" in str(e)
        
    # Test interacting with non-existent IDs
    try:
        contract.flag_post(999)
        assert False, "Should fail on missing post"
    except Exception as e:
        assert "Post does not exist" in str(e)
        
    try:
        contract.appeal_comment(999, "Defense")
        assert False, "Should fail on missing comment"
    except Exception as e:
        assert "Comment does not exist" in str(e)

def test_appeal_deadline_expired(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    flagger = direct_accounts[2]
    
    _advance_time(direct_vm, 0)
    
    direct_vm.sender = author
    contract.create_post(0, "Post")
    
    direct_vm.sender = flagger
    contract.create_post(0, "Join")
    
    _advance_time(direct_vm, 90000)
    
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", "{\"is_violation\": true, \"reason\": \"Spam\"}")
    direct_vm.sender = flagger
    contract.flag_post(0)
    
    # Advance time beyond the appeal window (3600 seconds)
    _advance_time(direct_vm, 4000)
    
    try:
        direct_vm.sender = author
        contract.appeal_post(0, "Defense")
        assert False, "Should fail on deadline"
    except Exception as e:
        assert "Appeal deadline has passed" in str(e)

def test_flag_cooldown_and_duplicate(test_env, direct_vm, direct_accounts):
    contract = test_env
    author = direct_accounts[1]
    flagger = direct_accounts[2]
    
    _advance_time(direct_vm, 0)
    direct_vm.sender = author
    contract.create_post(0, "Post 1")
    contract.create_post(0, "Post 2")
    
    direct_vm.sender = flagger
    contract.create_post(0, "Join")
    
    _advance_time(direct_vm, 90000)
    
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", "{\"is_violation\": false, \"reason\": \"Ok\"}")
    direct_vm.sender = flagger
    contract.flag_post(0) # First flag
    
    # Try to flag again immediately (cooldown active)
    try:
        contract.flag_post(1)
        assert False, "Should fail on cooldown"
    except Exception as e:
        assert "Flag cooldown active" in str(e)
        
    # Advance time past cooldown (300 seconds)
    _advance_time(direct_vm, 350)
    
    # Try to flag the exact same post again
    try:
        contract.flag_post(0)
        assert False, "Should fail on duplicate flag"
    except Exception as e:
        assert "already flagged" in str(e).lower()