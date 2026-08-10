import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('core')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

@app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    # Poll every 5 seconds
    sender.add_periodic_task(5.0, sync_with_genlayer.s(), name='sync every 5s')

@app.task
def sync_with_genlayer():
    from forum.tasks import poll_genlayer_state
    poll_genlayer_state()
