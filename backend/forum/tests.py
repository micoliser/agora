from django.test import TestCase, Client
from django.urls import reverse
from unittest.mock import patch, MagicMock
from django.core.management import call_command
from .models import Community, Post, Comment, SyncState
from .tasks import call_read_contract, poll_genlayer_state

class ForumAPITests(TestCase):
    def setUp(self):
        self.client = Client()
        self.community = Community.objects.create(
            id=1,
            admin="0x123",
            name="Test Comm",
            description="Desc",
            constitution="Const",
            appeal_window_seconds=86400,
            min_reputation_to_post=0,
            starting_reputation=100,
            reputation_penalty_violation=10,
            reputation_penalty_bad_flag=5,
            flag_cooldown_seconds=3600,
            created_at=1234567890
        )
        self.post = Post.objects.create(
            id=1,
            community=self.community,
            author="0x456",
            content="Hello world",
            status=0,
            flag_count=0,
            created_at=1234567890
        )
        self.comment = Comment.objects.create(
            id=1,
            community=self.community,
            post=self.post,
            author="0x789",
            content="Nice post",
            status=0,
            flag_count=0,
            created_at=1234567890
        )

    def test_community_list(self):
        response = self.client.get(reverse('community_list'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["name"], "Test Comm")

    def test_community_detail(self):
        response = self.client.get(reverse('community_detail', args=[1]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "Test Comm")

    def test_community_posts(self):
        response = self.client.get(reverse('community_posts', args=[1]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["content"], "Hello world")

    def test_post_detail(self):
        response = self.client.get(reverse('post_detail', args=[1]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["content"], "Hello world")

    def test_post_comments(self):
        response = self.client.get(reverse('post_comments', args=[1]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["content"], "Nice post")

class IndexerTasksTests(TestCase):
    @patch('forum.tasks.requests.post')
    def test_call_read_contract_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"result": "test_data"}
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        with patch('django.conf.settings.GENLAYER_CONTRACT_ADDRESS', '0xabc'):
            result = call_read_contract("get_community", [1])
            self.assertEqual(result, "test_data")
            # Verify correct JSON-RPC structure was sent
            call_args = mock_post.call_args[1]['json']
            self.assertEqual(call_args['method'], 'sim_readContract')
            self.assertEqual(call_args['params'][1], 'get_community')

    @patch('forum.tasks.call_read_contract')
    def test_poll_genlayer_state_creates_community(self, mock_call):
        # Mock responses: 1 community exists
        def mock_read(method_name, args):
            if method_name == "community_count":
                return 1
            elif method_name == "post_count":
                return 0
            elif method_name == "comment_count":
                return 0
            elif method_name == "get_community":
                return {
                    "admin": "0xabc",
                    "name": "Sync Comm",
                    "description": "Desc",
                    "constitution": "Const",
                    "appeal_window_seconds": 86400,
                    "min_reputation_to_post": 0,
                    "starting_reputation": 100,
                    "reputation_penalty_violation": 10,
                    "reputation_penalty_bad_flag": 5,
                    "flag_cooldown_seconds": 3600,
                    "created_at": 1234567890
                }
            return None
            
        mock_call.side_effect = mock_read
        
        # State should be empty initially
        self.assertEqual(Community.objects.count(), 0)
        
        poll_genlayer_state()
        
        # State should now have 1 community
        self.assertEqual(Community.objects.count(), 1)
        comm = Community.objects.first()
        self.assertEqual(comm.name, "Sync Comm")
        
        sync_state = SyncState.objects.first()
        self.assertEqual(sync_state.last_community_id_synced, 0)

class IndexerCommandTests(TestCase):
    @patch('forum.management.commands.indexer.poll_genlayer_state')
    @patch('forum.management.commands.indexer.time.sleep', side_effect=InterruptedError) # break infinite loop
    def test_indexer_command(self, mock_sleep, mock_poll):
        try:
            call_command('indexer')
        except InterruptedError:
            pass # Expected
        
        # Verify it called poll_genlayer_state at least once
        mock_poll.assert_called()
