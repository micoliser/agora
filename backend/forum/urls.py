from django.urls import path
from . import views

urlpatterns = [
    path('communities/', views.community_list, name='community_list'),
    path('communities/<int:community_id>/', views.community_detail, name='community_detail'),
    path('communities/<int:community_id>/posts/', views.community_posts, name='community_posts'),
    path('posts/<int:post_id>/', views.post_detail, name='post_detail'),
    path('posts/<int:post_id>/comments/', views.post_comments, name='post_comments'),
    path('indexer/sync-request/', views.sync_request, name='sync_request'),
]
