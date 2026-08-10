import time
import logging
from django.core.management.base import BaseCommand
from forum.tasks import poll_genlayer_state

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Runs the GenLayer state indexer daemon'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting GenLayer Indexer Daemon...'))
        while True:
            try:
                poll_genlayer_state()
            except Exception as e:
                logger.error(f"Error in indexer loop: {e}")
            
            # Wait before polling again
            time.sleep(5)
