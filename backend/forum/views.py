
import time
import jwt
import uuid
import datetime
from django.conf import settings
from django.core.cache import cache
from eth_account.messages import encode_defunct
from eth_account import Account
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Count
from .models import Community, Post, Comment, UserActivity, Notification
from .tasks import poll_genlayer_state

def serialize_community(c):
    return {
        "id": c.id,
        "admin": c.admin,
        "name": c.name,
        "description": c.description,
        "constitution": c.constitution,
        "appeal_window_seconds": c.appeal_window_seconds,
        "min_reputation_to_post": c.min_reputation_to_post,
        "starting_reputation": c.starting_reputation,
        "reputation_penalty_violation": c.reputation_penalty_violation,
        "reputation_penalty_bad_flag": c.reputation_penalty_bad_flag,
        "flag_cooldown_seconds": c.flag_cooldown_seconds,
        "created_at": c.created_at,
    }

def serialize_post(p):
    return {
        "id": p.id,
        "community_id": p.community_id,
        "community_name": p.community.name if hasattr(p, 'community') else None,
        "flag_cooldown_seconds": p.community.flag_cooldown_seconds if hasattr(p, 'community') else 0,
        "author": p.author,
        "content": p.content,
        "status": p.status,
        "flag_count": p.flag_count,
        "moderation_verdict": p.moderation_verdict,
        "appeal_used": p.appeal_used,
        "appeal_verdict": p.appeal_verdict,
        "appeal_deadline": p.appeal_deadline,
        "created_at": p.created_at,
        "flagged_at": p.flagged_at,
        "comment_count": getattr(p, 'comment_count', 0),
    }

def serialize_comment(c):
    return {
        "id": c.id,
        "community_id": c.community_id,
        "post_id": c.post_id,
        "flag_cooldown_seconds": c.community.flag_cooldown_seconds if hasattr(c, 'community') else 0,
        "author": c.author,
        "content": c.content,
        "status": c.status,
        "flag_count": c.flag_count,
        "moderation_verdict": c.moderation_verdict,
        "appeal_used": c.appeal_used,
        "appeal_verdict": c.appeal_verdict,
        "appeal_deadline": c.appeal_deadline,
        "created_at": c.created_at,
        "flagged_at": c.flagged_at,
    }

def get_pagination(request):
    try:
        limit = int(request.GET.get('limit', 20))
        offset = int(request.GET.get('offset', 0))
    except ValueError:
        limit = 20
        offset = 0
    return limit, offset

def community_list(request):
    limit, offset = get_pagination(request)
    communities = Community.objects.all().order_by("-created_at")[offset:offset+limit]
    return JsonResponse([serialize_community(c) for c in communities], safe=False)

def community_detail(request, community_id):
    c = get_object_or_404(Community, id=community_id)
    return JsonResponse(serialize_community(c))

def community_posts(request, community_id):
    limit, offset = get_pagination(request)
    posts = Post.objects.filter(community_id=community_id, status__in=[0, 2]).select_related('community').annotate(comment_count=Count('comments')).order_by("-created_at")[offset:offset+limit]
    return JsonResponse([serialize_post(p) for p in posts], safe=False)

def post_list(request):
    limit, offset = get_pagination(request)
    posts = Post.objects.filter(status__in=[0, 2]).select_related('community').annotate(comment_count=Count('comments')).order_by("-created_at")[offset:offset+limit]
    return JsonResponse([serialize_post(p) for p in posts], safe=False)

def post_detail(request, post_id):
    p = get_object_or_404(Post.objects.select_related('community').annotate(comment_count=Count('comments')), id=post_id)
    return JsonResponse(serialize_post(p))

def post_comments(request, post_id):
    comments = Comment.objects.filter(post_id=post_id, status__in=[0, 2]).order_by("created_at")
    return JsonResponse([serialize_comment(c) for c in comments], safe=False)

from .tasks import sync_entity, async_sync_entity, call_read_contract

def jwt_required(func):
    def wrapper(request, *args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        token = auth_header.split(' ')[1]
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            request.user_address = payload.get('address')
        except jwt.ExpiredSignatureError:
            return JsonResponse({'error': 'Token expired'}, status=401)
        except jwt.InvalidTokenError:
            return JsonResponse({'error': 'Invalid token'}, status=401)
        return func(request, *args, **kwargs)
    return wrapper

@csrf_exempt
def auth_nonce(request):
    if request.method == 'GET':
        address = request.GET.get('address')
        if not address:
            return JsonResponse({'error': 'Missing address'}, status=400)
        nonce = str(uuid.uuid4())
        cache.set(f"nonce_{address.lower()}", nonce, timeout=300)
        return JsonResponse({'nonce': nonce})
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def auth_verify(request):
    if request.method == 'POST':
        import json
        try:
            data = json.loads(request.body)
            address = data.get('address', '').lower()
            signature = data.get('signature', '')
            message = data.get('message', '')
            
            expected_nonce = cache.get(f"nonce_{address}")
            if not expected_nonce:
                return JsonResponse({'error': 'Nonce expired or invalid'}, status=400)
                
            if expected_nonce not in message:
                return JsonResponse({'error': 'Message does not contain the correct nonce'}, status=400)
                
            message_hash = encode_defunct(text=message)
            recovered_address = Account.recover_message(message_hash, signature=signature)
            
            if recovered_address.lower() != address:
                return JsonResponse({'error': 'Signature verification failed'}, status=401)
                
            cache.delete(f"nonce_{address}")
            
            # Issue JWT
            payload = {
                'address': address,
                'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
            }
            token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
            return JsonResponse({'token': token})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def sync_request(request):
    if request.method == "POST":
        try:
            import json
            body = request.body.decode('utf-8')
            if body:
                try:
                    data = json.loads(body)
                    entity_type = data.get("entity_type")
                    entity_id = data.get("entity_id")
                    current_state = data.get("current_state", None)
                    print("SYNC REQUEST DATA:", data)
                    if entity_type and entity_id is not None:
                        if current_state:
                            from .tasks import sync_entity
                            success = sync_entity(entity_type, entity_id, current_state)
                            return JsonResponse({"status": "synced" if success else "failed"})
                        else:
                            async_sync_entity.delay(entity_type, entity_id, current_state)
                            return JsonResponse({"status": "queued"})
                except json.JSONDecodeError:
                    pass
            return JsonResponse({"error": "Invalid request or missing entity_type/entity_id"}, status=400)
        except Exception as e:
            import traceback; traceback.print_exc(); return JsonResponse({"error": "Internal Server Error"}, status=500)
    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
def latest_community(request):
    if request.method == "POST":
        try:
            db_max = Community.objects.order_by('-id').first()
            expected_min_count = (db_max.id + 2) if db_max else 1
            
            # Retry loop up to 5 times (total 5s wait)
            for _ in range(15):
                count = call_read_contract("get_community_count", [])
                if count is not None and int(count) >= expected_min_count:
                    latest_id = int(count) - 1
                    if sync_entity("community", latest_id):
                        return JsonResponse({"community_id": latest_id})
                time.sleep(2)

            return JsonResponse({"error": "Failed to sync community - block state not updated"}, status=500)
        except Exception as e:
            import traceback; traceback.print_exc(); return JsonResponse({"error": "Internal Server Error"}, status=500)
    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
def latest_post(request):
    if request.method == "POST":
        try:
            db_max = Post.objects.order_by('-id').first()
            expected_min_count = (db_max.id + 2) if db_max else 1

            for _ in range(15):
                count = call_read_contract("get_post_count", [])
                if count is not None and int(count) >= expected_min_count:
                    latest_id = int(count) - 1
                    if sync_entity("post", latest_id):
                        return JsonResponse({"post_id": latest_id})
                time.sleep(2)

            return JsonResponse({"error": "Failed to sync post - block state not updated"}, status=500)
        except Exception as e:
            import traceback; traceback.print_exc(); return JsonResponse({"error": "Internal Server Error"}, status=500)
    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
def latest_comment(request):
    if request.method == "POST":
        try:
            db_max = Comment.objects.order_by('-id').first()
            expected_min_count = (db_max.id + 2) if db_max else 1

            for _ in range(15):
                count = call_read_contract("get_comment_count", [])
                if count is not None and int(count) >= expected_min_count:
                    latest_id = int(count) - 1
                    if sync_entity("comment", latest_id):
                        return JsonResponse({"comment_id": latest_id})
                time.sleep(2)

            return JsonResponse({"error": "Failed to sync comment - block state not updated"}, status=500)
        except Exception as e:
            import traceback; traceback.print_exc(); return JsonResponse({"error": "Internal Server Error"}, status=500)
    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
def last_flag_time(request):
    if request.method == "GET":
        from .models import MemberReputation
        address = request.GET.get("address", "")
        community_id = request.GET.get("community_id", "")
        if not address:
            return JsonResponse({"error": "address is required"}, status=400)
        try:
            if community_id and community_id != "undefined":
                profile = MemberReputation.objects.filter(address=address, community_id=community_id).first()
                timestamp = profile.last_flag_time if profile else 0
                return JsonResponse({"last_flag_time": timestamp})
            else:
                profiles = MemberReputation.objects.filter(address=address)
                data = {str(p.community_id): p.last_flag_time for p in profiles}
                return JsonResponse({"last_flag_times": data})
        except Exception as e:
            import traceback; traceback.print_exc(); return JsonResponse({"error": "Internal Server Error"}, status=500)
    return JsonResponse({"error": "Method not allowed"}, status=405)


def user_moderated_posts(request, address):
    limit, offset = get_pagination(request)
    posts = Post.objects.filter(author__iexact=address, status__in=[1, 3]).select_related('community').annotate(comment_count=Count('comments')).order_by("-created_at")[offset:offset+limit]
    return JsonResponse([serialize_post(p) for p in posts], safe=False)


def user_reputation(request, community_id, address):
    from .models import MemberReputation, Community
    try:
        rep = MemberReputation.objects.get(community_id=community_id, address__iexact=address)
        return JsonResponse({"reputation": rep.reputation})
    except MemberReputation.DoesNotExist:
        try:
            c = Community.objects.get(id=community_id)
            return JsonResponse({"reputation": c.starting_reputation})
        except Community.DoesNotExist:
            return JsonResponse({"error": "Community not found"}, status=404)

def serialize_notification(n):
    return {
        "id": n.id,
        "user_address": n.user_address,
        "notification_type": n.notification_type,
        "message": n.message,
        "link": n.link,
        "is_read": n.is_read,
        "created_at": n.created_at.timestamp() if n.created_at else 0
    }

@jwt_required
def get_notifications(request):
    address = request.user_address
    notifications = Notification.objects.filter(user_address__iexact=address).order_by("-created_at")[:50]
    return JsonResponse([serialize_notification(n) for n in notifications], safe=False)

@csrf_exempt
@jwt_required
def mark_notification_read(request, notification_id):
    if request.method == "POST":
        n = get_object_or_404(Notification, id=notification_id)
        if n.user_address.lower() != request.user_address.lower():
            return JsonResponse({"error": "Unauthorized"}, status=401)
        n.is_read = True
        n.save()
        return JsonResponse({"success": True})
    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
@jwt_required
def mark_all_notifications_read(request):
    if request.method == "POST":
        try:
            address = request.user_address
            Notification.objects.filter(user_address__iexact=address).update(is_read=True)
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
@jwt_required
def clear_notifications(request):
    if request.method == "POST":
        try:
            address = request.user_address
            Notification.objects.filter(user_address__iexact=address).delete()
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    return JsonResponse({"error": "Method not allowed"}, status=405)
