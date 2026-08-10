from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from .models import Community, Post, Comment
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
    }

def serialize_comment(c):
    return {
        "id": c.id,
        "community_id": c.community_id,
        "post_id": c.post_id,
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

def community_list(request):
    communities = Community.objects.all().order_by("-created_at")
    return JsonResponse([serialize_community(c) for c in communities], safe=False)

def community_detail(request, community_id):
    c = get_object_or_404(Community, id=community_id)
    return JsonResponse(serialize_community(c))

def community_posts(request, community_id):
    posts = Post.objects.filter(community_id=community_id).order_by("-created_at")
    return JsonResponse([serialize_post(p) for p in posts], safe=False)

def post_detail(request, post_id):
    p = get_object_or_404(Post, id=post_id)
    return JsonResponse(serialize_post(p))

def post_comments(request, post_id):
    comments = Comment.objects.filter(post_id=post_id).order_by("created_at")
    return JsonResponse([serialize_comment(c) for c in comments], safe=False)

@csrf_exempt
def sync_request(request):
    if request.method == "POST":
        try:
            poll_genlayer_state()
            return JsonResponse({"status": "synced"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Method not allowed"}, status=405)

