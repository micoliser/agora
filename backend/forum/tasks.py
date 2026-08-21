import logging
import time
from celery import shared_task
from django.conf import settings
from .models import (
    Community,
    Post,
    Comment,
    SyncState,
    MemberReputation,
    UserActivity,
    Notification,
)

from eth_account import Account
import nh3
from genlayer_py import create_client
from genlayer_py.chains import studionet

logger = logging.getLogger(__name__)

# A dummy account is required by genlayer_py even for read-only operations
_DUMMY_ACCOUNT = Account.create()

_client_instance = None


def _get_genlayer_client():
    global _client_instance
    if _client_instance is None:
        _client_instance = create_client(chain=studionet, account=_DUMMY_ACCOUNT)
    return _client_instance


def call_read_contract(method_name, args):
    contract_address = settings.GENLAYER_CONTRACT_ADDRESS
    if not contract_address or contract_address == "0x...":
        logger.warning("GENLAYER_CONTRACT_ADDRESS is not set properly.")
        return None

    client = _get_genlayer_client()

    for _ in range(5):
        try:
            return client.read_contract(
                address=contract_address, function_name=method_name, args=args
            )
        except Exception as e:
            if "Rate limit exceeded" in str(e) or "-32029" in str(e):
                logger.warning(f"Rate limit hit in call_read_contract. Retrying...")
                time.sleep(2)
            else:
                raise
    # Try one last time and if it fails, it will bubble up
    return client.read_contract(
        address=contract_address, function_name=method_name, args=args
    )


def _sync_member_reputation(community_id: int, address: str) -> bool:
    if not address or address.startswith("0x") == False:
        return False
    rep = call_read_contract("get_reputation", [community_id, address])
    if rep is not None:
        community = Community.objects.filter(id=community_id).first()
        if community:
            MemberReputation.objects.update_or_create(
                community=community, address=address, defaults={"reputation": int(rep)}
            )
            return True
    return False


def _sync_single_community(community_id: int) -> bool:
    com_data = call_read_contract("get_community", [community_id])
    if com_data:
        Community.objects.update_or_create(
            id=community_id,
            defaults={
                "admin": com_data.get("admin", ""),
                "name": nh3.clean(com_data.get("name", "")),
                "description": nh3.clean(com_data.get("description", "")),
                "constitution": nh3.clean(com_data.get("constitution", "")),
                "appeal_window_seconds": com_data.get("appeal_window_seconds", 0),
                "min_reputation_to_post": com_data.get("min_reputation_to_post", 0),
                "starting_reputation": com_data.get("starting_reputation", 0),
                "reputation_penalty_violation": com_data.get(
                    "reputation_penalty_violation", 0
                ),
                "reputation_penalty_bad_flag": com_data.get(
                    "reputation_penalty_bad_flag", 0
                ),
                "flag_cooldown_seconds": com_data.get("flag_cooldown_seconds", 0),
                "created_at": com_data.get("created_at", 0),
            },
        )
        return True
    return False


def _sync_single_post(post_id: int, current_state=None) -> bool:
    import time

    for i in range(15):
        p_data = call_read_contract("get_post", [post_id])
        if p_data:
            if current_state:
                if p_data.get("flag_count", 0) == current_state.get(
                    "flag_count", 0
                ) and p_data.get("status", 0) == current_state.get("status", 0):
                    time.sleep(2)
                    continue
            community = Community.objects.filter(id=p_data.get("community_id")).first()
            if community:
                old_post = Post.objects.filter(id=post_id).first()
                new_status = p_data.get("status", 0)
                new_appeal_used = p_data.get("appeal_used", False)
                author = p_data.get("author", "")
                successful_flagger = p_data.get("successful_flagger", "")
                link = f"/post/{post_id}"

                # Check state changes for notifications
                if old_post:
                    # Content Removed
                    if old_post.status == 0 and new_status == 1:
                        Notification.objects.get_or_create(
                            user_address=author,
                            notification_type="CONTENT_REMOVED",
                            link=link,
                            defaults={"message": "Your post was flagged and removed."},
                        )
                        if successful_flagger:
                            Notification.objects.get_or_create(
                                user_address=successful_flagger,
                                notification_type="FLAG_ACCEPTED",
                                link=f"/community/{community.id}",
                                defaults={
                                    "message": "Your flag was accepted! You gained reputation."
                                },
                            )

                    # Appeal Granted
                    if old_post.status == 1 and new_status == 2:
                        Notification.objects.get_or_create(
                            user_address=author,
                            notification_type="APPEAL_GRANTED",
                            link=link,
                            defaults={
                                "message": "Your appeal was granted! Your post is restored."
                            },
                        )
                        if old_post.successful_flagger or successful_flagger:
                            flagger_to_notify = (
                                old_post.successful_flagger or successful_flagger
                            )
                            Notification.objects.get_or_create(
                                user_address=flagger_to_notify,
                                notification_type="REP_REWARD_REVERSED",
                                link=link,
                                defaults={
                                    "message": "A post you flagged was appealed and restored. Your reputation reward was reversed."
                                },
                            )

                    # Appeal Denied
                    if not old_post.appeal_used and new_appeal_used and new_status == 3:
                        Notification.objects.get_or_create(
                            user_address=author,
                            notification_type="APPEAL_DENIED",
                            link=link,
                            defaults={
                                "message": "Your appeal was denied. The post remains banned."
                            },
                        )

                Post.objects.update_or_create(
                    id=post_id,
                    defaults={
                        "community": community,
                        "author": author,
                        "content": nh3.clean(p_data.get("content", "")),
                        "status": new_status,
                        "flag_count": p_data.get("flag_count", 0),
                        "moderation_verdict": str(p_data.get("moderation_verdict", "")),
                        "appeal_used": new_appeal_used,
                        "appeal_verdict": str(p_data.get("appeal_verdict", "")),
                        "appeal_deadline": p_data.get("appeal_deadline", 0),
                        "created_at": p_data.get("created_at", 0),
                        "flagged_at": p_data.get("flagged_at", 0),
                        "successful_flagger": successful_flagger,
                    },
                )
            _sync_member_reputation(community.id, p_data.get("author", ""))
            return True
        time.sleep(2)
    return False


def _sync_single_comment(comment_id: int, current_state=None) -> bool:
    import time

    for _ in range(15):
        c_data = call_read_contract("get_comment", [comment_id])
        if c_data:
            if current_state:
                if c_data.get("flag_count", 0) == current_state.get(
                    "flag_count", 0
                ) and c_data.get("status", 0) == current_state.get("status", 0):
                    time.sleep(2)
                    continue
            community = Community.objects.filter(id=c_data.get("community_id")).first()
        post = Post.objects.filter(id=c_data.get("post_id")).first()
        if community and post:
            old_comment = Comment.objects.filter(id=comment_id).first()
            new_status = c_data.get("status", 0)
            new_appeal_used = c_data.get("appeal_used", False)
            author = c_data.get("author", "")
            successful_flagger = c_data.get("successful_flagger", "")
            link = f"/post/{post.id}"

            if not old_comment:
                # New Reply Notification
                if author != post.author:
                    Notification.objects.get_or_create(
                        user_address=post.author,
                        notification_type="REPLY",
                        link=link,
                        defaults={"message": "Someone replied to your post."},
                    )
            else:
                # Content Removed
                if old_comment.status == 0 and new_status == 1:
                    Notification.objects.get_or_create(
                        user_address=author,
                        notification_type="CONTENT_REMOVED",
                        link=link,
                        defaults={"message": "Your comment was flagged and removed."},
                    )
                    if successful_flagger:
                        Notification.objects.get_or_create(
                            user_address=successful_flagger,
                            notification_type="FLAG_ACCEPTED",
                            link=f"/community/{community.id}",
                            defaults={
                                "message": "Your flag was accepted! You gained reputation."
                            },
                        )

                # Appeal Granted
                if old_comment.status == 1 and new_status == 2:
                    Notification.objects.get_or_create(
                        user_address=author,
                        notification_type="APPEAL_GRANTED",
                        link=link,
                        defaults={
                            "message": "Your appeal was granted! Your comment is restored."
                        },
                    )
                    if old_comment.successful_flagger or successful_flagger:
                        flagger_to_notify = (
                            old_comment.successful_flagger or successful_flagger
                        )
                        Notification.objects.get_or_create(
                            user_address=flagger_to_notify,
                            notification_type="REP_REWARD_REVERSED",
                            link=link,
                            defaults={
                                "message": "A comment you flagged was appealed and restored. Your reputation reward was reversed."
                            },
                        )

                # Appeal Denied
                if not old_comment.appeal_used and new_appeal_used and new_status == 3:
                    Notification.objects.get_or_create(
                        user_address=author,
                        notification_type="APPEAL_DENIED",
                        link=link,
                        defaults={
                            "message": "Your appeal was denied. The comment remains banned."
                        },
                    )

            Comment.objects.update_or_create(
                id=comment_id,
                defaults={
                    "community": community,
                    "post": post,
                    "author": author,
                    "content": nh3.clean(c_data.get("content", "")),
                    "status": new_status,
                    "flag_count": c_data.get("flag_count", 0),
                    "moderation_verdict": str(c_data.get("moderation_verdict", "")),
                    "appeal_used": new_appeal_used,
                    "appeal_verdict": str(c_data.get("appeal_verdict", "")),
                    "appeal_deadline": c_data.get("appeal_deadline", 0),
                    "created_at": c_data.get("created_at", 0),
                    "flagged_at": c_data.get("flagged_at", 0),
                    "successful_flagger": successful_flagger,
                },
            )
            _sync_member_reputation(community.id, c_data.get("author", ""))
            return True
        time.sleep(2)
    return False


def _sync_user_activity(address: str) -> bool:
    time.sleep(3) # Wait for GenVM state to propagate to read nodes
    success = False
    for community in Community.objects.all():
        timestamp = call_read_contract("get_last_flag_time", [community.id, address])
        if timestamp is not None:
            MemberReputation.objects.update_or_create(
                community=community,
                address=address,
                defaults={"last_flag_time": int(timestamp)},
            )
            success = True
        _sync_member_reputation(community.id, address)
    return success


def sync_entity(entity_type: str, entity_id, current_state=None) -> bool:
    if entity_type == "community":
        return _sync_single_community(int(entity_id))
    elif entity_type in ("post", "community_posts"):
        return _sync_single_post(int(entity_id), current_state)
    elif entity_type in ("comment", "post_comments"):
        return _sync_single_comment(int(entity_id), current_state)
    elif entity_type == "user_activity":
        return _sync_user_activity(str(entity_id))
    else:
        logger.warning(f"Unknown entity_type for targeted sync: {entity_type}")
        return False


def poll_genlayer_state(entity_type=None):
    from django.db.models import Q

    try:
        state, _ = SyncState.objects.get_or_create(id=1)

        # 1. Sync Communities
        if entity_type is None or entity_type == "community":
            count = call_read_contract("get_community_count", [])
            if count is not None:
                success_up_to = state.last_community_id_synced
                for i in range(state.last_community_id_synced + 1, int(count)):
                    try:
                        if _sync_single_community(i):
                            if i == success_up_to + 1:
                                success_up_to = i
                        else:
                            logger.warning(f"Failed to fetch community {i}")
                    except Exception as e:
                        logger.warning(f"Error fetching community {i}: {e}")
                if success_up_to > state.last_community_id_synced:
                    state.last_community_id_synced = success_up_to
                    state.save()

        # 2. Sync Posts
        if entity_type is None or entity_type == "community_posts":
            post_count = call_read_contract("get_post_count", [])
            if post_count is not None:
                # Sync new posts only to prevent hitting rate limits
                success_up_to = state.last_post_id_synced
                for i in range(state.last_post_id_synced + 1, int(post_count)):
                    try:
                        _sync_single_post(i)
                    except Exception as e:
                        logger.warning(f"Error syncing post {i}: {e}")

                # Update watermark for new posts
                new_max = int(post_count) - 1
                if new_max > state.last_post_id_synced:
                    state.last_post_id_synced = new_max
                    state.save()

        # 3. Sync Comments
        if entity_type is None or entity_type == "post_comments":
            comment_count = call_read_contract("get_comment_count", [])
            if comment_count is not None:
                # Sync new comments only to prevent hitting rate limits
                success_up_to = state.last_comment_id_synced
                for i in range(state.last_comment_id_synced + 1, int(comment_count)):
                    try:
                        _sync_single_comment(i)
                    except Exception as e:
                        logger.warning(f"Error syncing comment {i}: {e}")

                # Update watermark for new comments
                new_max = int(comment_count) - 1
                if new_max > state.last_comment_id_synced:
                    state.last_comment_id_synced = new_max
                    state.save()

        return True

    except Exception as e:
        logger.error(f"Sync error: {e}")
        time.sleep(10)
        return False


@shared_task(bind=True, max_retries=3)
def async_sync_entity(
    self, entity_type: str, entity_id: int, current_state: dict = None
):
    # lock to prevent race conditions
    lock_id = f"sync_{entity_type}_{entity_id}"
    from django.core.cache import cache

    if cache.add(lock_id, "locked", 60):
        try:
            return sync_entity(entity_type, entity_id, current_state)
        finally:
            cache.delete(lock_id)
    else:
        # Task is already running, retry later
        raise self.retry(countdown=5)
