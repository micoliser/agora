from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse
from django.conf import settings

def health_check(request):
    return HttpResponse("OK", status=200)

urlpatterns = [
    path('', health_check),
    path('api/', include('forum.urls')),
]

if settings.DEBUG:
    urlpatterns.insert(0, path('admin/', admin.site.urls))
