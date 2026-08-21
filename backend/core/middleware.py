import time
import re
from django.core.cache import cache
from django.http import JsonResponse

class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

        # Define path regex patterns and their corresponding rate limits (requests per minute)
        # Order matters! First match wins.
        self.rate_limits = [
            (re.compile(r'^/api/auth/'), 20),
            (re.compile(r'^/api/notifications/$'), 100), # Polling endpoint
            (re.compile(r'^/api/notifications/'), 30), # Other notification endpoints (mutations)
            (re.compile(r'^/api/indexer/sync-request/'), 30),
            (re.compile(r'^/api/indexer/'), 60),
            (re.compile(r'^/api/communities/\d+/$'), 120), # Singular community
            (re.compile(r'^/api/communities/\d+/reputation/'), 120),
            (re.compile(r'^/api/posts/\d+/$'), 120), # Singular post
            (re.compile(r'^/api/posts/\d+/comments/'), 60),
            (re.compile(r'^/api/posts/'), 60), # Feeds
            (re.compile(r'^/api/communities/'), 60), # Feeds
            (re.compile(r'^/api/user/'), 60),
            (re.compile(r'^/api/'), 60), # Default fallback for /api/
        ]

    def __call__(self, request):
        if request.path.startswith('/api/'):
            limit = 60 # Default fallback if no regex matches
            
            for pattern, max_requests in self.rate_limits:
                if pattern.match(request.path):
                    limit = max_requests
                    break
                    
            ip = request.META.get('REMOTE_ADDR', '127.0.0.1')
            # Use the matched limit in the cache key to isolate limits per path prefix if needed?
            # Actually, standard rate limiting uses the same key for the endpoint or group. 
            # We will use the request path's generic matched pattern or just the raw path.
            # A common approach is limiting per IP + endpoint group.
            # To be simple and effective, let's limit per IP + path. 
            # If we limit per exact path, `/api/posts/1/` and `/api/posts/2/` are separate limits.
            # This is usually desired for a simple middleware, but a brute forcer could hit many paths.
            # To group them, we can use the pattern's regex string as part of the key.
            # Let's find the matching pattern's regex string to use as the group key.
            group_key = 'default'
            for pattern, max_requests in self.rate_limits:
                if pattern.match(request.path):
                    group_key = pattern.pattern
                    break
                    
            key = f"ratelimit_{ip}_{group_key}"
            requests = cache.get(key, 0)
            
            if requests >= limit:
                return JsonResponse({"error": f"Too many requests. Limit is {limit} per minute."}, status=429)
                
            cache.set(key, requests + 1, 60)
            
        return self.get_response(request)
