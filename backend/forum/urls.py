from django.urls import path
from . import views

urlpatterns = [
    path('communities/', views.community_list, name='community_list'),
    path('communities/<int:community_id>/', views.community_detail, name='community_detail'),
    path('communities/<int:community_id>/posts/', views.community_posts, name='community_posts'),
    path('posts/', views.post_list, name='post_list'),
    path('user/<str:address>/moderated_posts/', views.user_moderated_posts, name='user_moderated_posts'),
    path('communities/<int:community_id>/reputation/<str:address>/', views.user_reputation, name='user_reputation'),
    path('posts/<int:post_id>/', views.post_detail, name='post_detail'),
    path('posts/<int:post_id>/comments/', views.post_comments, name='post_comments'),
    path('indexer/sync-request/', views.sync_request, name='sync_request'),
    path('indexer/latest-community/', views.latest_community, name='latest_community'),
    path('indexer/latest-post/', views.latest_post, name='latest_post'),
    path('indexer/latest-comment/', views.latest_comment, name='latest_comment'),
    path('indexer/last-flag-time/', views.last_flag_time, name='last_flag_time'),
]
