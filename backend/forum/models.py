from django.db import models

class Community(models.Model):
    id = models.IntegerField(primary_key=True) # GenVM ID
    admin = models.CharField(max_length=42)
    name = models.CharField(max_length=255)
    description = models.TextField()
    constitution = models.TextField()
    appeal_window_seconds = models.IntegerField()
    min_reputation_to_post = models.IntegerField()
    starting_reputation = models.IntegerField()
    reputation_penalty_violation = models.IntegerField()
    reputation_penalty_bad_flag = models.IntegerField()
    flag_cooldown_seconds = models.IntegerField()
    created_at = models.IntegerField()

class Post(models.Model):
    id = models.IntegerField(primary_key=True) # GenVM ID
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name="posts")
    author = models.CharField(max_length=42)
    content = models.TextField()
    status = models.IntegerField(default=0) # 0=ACTIVE, 1=REMOVED, 2=RESTORED, 3=APPEAL_DENIED
    flag_count = models.IntegerField(default=0)
    moderation_verdict = models.TextField(blank=True, null=True)
    appeal_used = models.BooleanField(default=False)
    appeal_verdict = models.TextField(blank=True, null=True)
    appeal_deadline = models.IntegerField(default=0)
    created_at = models.IntegerField()
    flagged_at = models.IntegerField(default=0)

class Comment(models.Model):
    id = models.IntegerField(primary_key=True)
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name="comments")
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    author = models.CharField(max_length=42)
    content = models.TextField()
    status = models.IntegerField(default=0)
    flag_count = models.IntegerField(default=0)
    moderation_verdict = models.TextField(blank=True, null=True)
    appeal_used = models.BooleanField(default=False)
    appeal_verdict = models.TextField(blank=True, null=True)
    appeal_deadline = models.IntegerField(default=0)
    created_at = models.IntegerField()
    flagged_at = models.IntegerField(default=0)

class MemberReputation(models.Model):
    community = models.ForeignKey(Community, on_delete=models.CASCADE)
    address = models.CharField(max_length=42)
    reputation = models.IntegerField(default=0)

    class Meta:
        unique_together = ('community', 'address')

class SyncState(models.Model):
    """Tracks the last polled index for communities, posts, comments"""
    last_community_id_synced = models.IntegerField(default=-1)
    last_post_id_synced = models.IntegerField(default=-1)
    last_comment_id_synced = models.IntegerField(default=-1)
