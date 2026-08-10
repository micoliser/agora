import pytest
import json
from gltest import get_contract_factory, get_validator_factory

@pytest.fixture
def test_env():
    # Deploy contract
    factory = get_contract_factory("Forum")
    contract = factory.deploy(
        args=[
            "Test DAO",
            "A test community",
            "No spam",
            86400, # appeal_window_seconds
            50, # min_reputation_to_post
            100, # starting_reputation
            50, # reputation_penalty_violation
            10, # reputation_penalty_bad_flag
            300, # flag_cooldown_seconds
        ]
    )
    return contract

def test_create_community(test_env):
    contract = test_env
    community_id = contract.create_community(
        "Another DAO",
        "Desc",
        "Rules",
        86400,
        50,
        100,
        50,
        10,
        300
    )
    assert community_id == 1
    
    com = contract.get_community(community_id)
    assert com["name"] == "Another DAO"

def test_reputation_gating_and_posting(test_env):
    contract = test_env
    post_id = contract.create_post(0, "Hello world")
    assert post_id == 0
    
    post = contract.get_post(0)
    assert post["content"] == "Hello world"
    assert post["status"] == 0 # ACTIVE

def test_flagging_flow(test_env):
    contract = test_env
    post_id = contract.create_post(0, "Spam post")
    
    # Mock validator response for violation
    val_factory = get_validator_factory()
    mock_response = json.dumps({"is_violation": True, "reason": "Spam detected"})
    val_factory.batch_create_mock_validators(count=3, mock_llm_response=mock_response)
    
    result = contract.flag_post(post_id)
    res_dict = json.loads(result)
    assert res_dict["is_violation"] is True
    
    post = contract.get_post(post_id)
    assert post["status"] == 1 # REMOVED
    assert post["moderation_verdict"] == "Spam detected"

def test_appeal_flow(test_env):
    contract = test_env
    post_id = contract.create_post(0, "Unfairly removed post")
    
    # Flag it (mock removal)
    val_factory = get_validator_factory()
    mock_response_remove = json.dumps({"is_violation": True, "reason": "Spam detected"})
    val_factory.batch_create_mock_validators(count=3, mock_llm_response=mock_response_remove)
    
    contract.flag_post(post_id)
    
    # Now appeal it (mock overturned)
    mock_response_appeal = json.dumps({"is_violation": False, "reason": "Not spam"})
    val_factory.batch_create_mock_validators(count=3, mock_llm_response=mock_response_appeal)
    
    result = contract.appeal_post(post_id)
    res_dict = json.loads(result)
    assert res_dict["overturned"] is True
    
    post = contract.get_post(post_id)
    assert post["status"] == 2 # RESTORED
