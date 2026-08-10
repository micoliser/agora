import logging
import time
from django.conf import settings
from .models import Community, Post, Comment, SyncState, MemberReputation

from eth_account import Account
from genlayer_py import create_client
from genlayer_py.chains import studionet

logger = logging.getLogger(__name__)

# A dummy account is required by genlayer_py even for read-only operations
_DUMMY_ACCOUNT = Account.create()

def _get_genlayer_client():
    return create_client(chain=studionet, account=_DUMMY_ACCOUNT)

def call_read_contract(method_name, args):
    contract_address = settings.GENLAYER_CONTRACT_ADDRESS
    if not contract_address or contract_address == "0x...":
        logger.warning("GENLAYER_CONTRACT_ADDRESS is not set properly.")
        return None

    client = _get_genlayer_client()
    
    # We implement retry logic specifically for network errors, 502s, and rate limits
    retries = 5
    for attempt in range(retries):
        try:
            return client.read_contract(
                address=contract_address,
                function_name=method_name,
                args=args
            )
        except Exception as e:
            error_str = str(e)
            logger.warning(f"RPC Error calling {method_name} ({error_str}). Retrying {attempt + 1}/{retries}...")
            time.sleep(2 ** attempt)
                
    logger.error(f"Failed to call {method_name} after {retries} retries.")
    return None

def poll_genlayer_state():
    try:
        state, _ = SyncState.objects.get_or_create(id=1)
        
        # 1. Sync Communities
        count = call_read_contract("get_community_count", [])
        if count is None:
            return
            
        for i in range(state.last_community_id_synced + 1, int(count)):
            com_data = call_read_contract("get_community", [i])
            if com_data:
                Community.objects.update_or_create(
                    id=i,
                    defaults={
                        "admin": com_data.get("admin", ""),
                        "name": com_data.get("name", ""),
                        "description": com_data.get("description", ""),
                        "constitution": com_data.get("constitution", ""),
                        "appeal_window_seconds": com_data.get("appeal_window_seconds", 0),
                        "min_reputation_to_post": com_data.get("min_reputation_to_post", 0),
                        "starting_reputation": com_data.get("starting_reputation", 0),
                        "reputation_penalty_violation": com_data.get("reputation_penalty_violation", 0),
                        "reputation_penalty_bad_flag": com_data.get("reputation_penalty_bad_flag", 0),
                        "flag_cooldown_seconds": com_data.get("flag_cooldown_seconds", 0),
                        "created_at": com_data.get("created_at", 0),
                    }
                )
                state.last_community_id_synced = i
                state.save()
                
        # 2. Sync Posts
        post_count = call_read_contract("get_post_count", [])
        if post_count is not None:
            for i in range(state.last_post_id_synced + 1, int(post_count)):
                p_data = call_read_contract("get_post", [i])
                if p_data:
                    community = Community.objects.filter(id=p_data.get("community_id")).first()
                    if community:
                        Post.objects.update_or_create(
                            id=i,
                            defaults={
                                "community": community,
                                "author": p_data.get("author", ""),
                                "content": p_data.get("content", ""),
                                "status": p_data.get("status", 0),
                                "flag_count": p_data.get("flag_count", 0),
                                "moderation_verdict": str(p_data.get("moderation_verdict", "")),
                                "appeal_used": p_data.get("appeal_used", False),
                                "appeal_verdict": str(p_data.get("appeal_verdict", "")),
                                "appeal_deadline": p_data.get("appeal_deadline", 0),
                                "created_at": p_data.get("created_at", 0),
                                "flagged_at": p_data.get("flagged_at", 0),
                            }
                        )
                state.last_post_id_synced = i
                state.save()
            
        # 3. Sync Comments
        comment_count = call_read_contract("get_comment_count", [])
        if comment_count is not None:
            for i in range(state.last_comment_id_synced + 1, int(comment_count)):
                c_data = call_read_contract("get_comment", [i])
                if c_data:
                    community = Community.objects.filter(id=c_data.get("community_id")).first()
                    post = Post.objects.filter(id=c_data.get("post_id")).first()
                    if community and post:
                        Comment.objects.update_or_create(
                            id=i,
                            defaults={
                                "community": community,
                                "post": post,
                                "author": c_data.get("author", ""),
                                "content": c_data.get("content", ""),
                                "status": c_data.get("status", 0),
                                "flag_count": c_data.get("flag_count", 0),
                                "moderation_verdict": str(c_data.get("moderation_verdict", "")),
                                "appeal_used": c_data.get("appeal_used", False),
                                "appeal_verdict": str(c_data.get("appeal_verdict", "")),
                                "appeal_deadline": c_data.get("appeal_deadline", 0),
                                "created_at": c_data.get("created_at", 0),
                                "flagged_at": c_data.get("flagged_at", 0),
                            }
                        )
                state.last_comment_id_synced = i
                state.save()
            
        # Optional: Add small sleep between polls if this is running in an infinite loop
        # time.sleep(2)
        
    except Exception as e:
        logger.error(f"Sync error: {e}")
        time.sleep(10)
