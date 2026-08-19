from django.test import TestCase, Client
from django.urls import reverse
from unittest.mock import patch, MagicMock
from django.core.management import call_command
from .models import Community, Post, Comment, SyncState, Notification

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
        self.notification = Notification.objects.create(
            user_address="0x456",
            message="Your post got a new comment",
            link="/community/1/post/1"
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

    def test_community_detail_404(self):
        response = self.client.get(reverse('community_detail', args=[999]))
        self.assertEqual(response.status_code, 404)

    def test_community_posts(self):
        response = self.client.get(reverse('community_posts', args=[1]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["content"], "Hello world")

    def test_post_detail(self):
        response = self.client.get(reverse('post_detail', args=[1]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["content"], "Hello world")

    def test_post_detail_404(self):
        response = self.client.get(reverse('post_detail', args=[999]))
        self.assertEqual(response.status_code, 404)

    def test_post_comments(self):
        response = self.client.get(reverse('post_comments', args=[1]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["content"], "Nice post")

    def test_notifications_list(self):
        response = self.client.get(reverse('get_notifications') + "?address=0x456")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["message"], "Your post got a new comment")

    def test_notifications_list_missing_address(self):
        response = self.client.get(reverse('get_notifications'))
        self.assertEqual(response.status_code, 400)

    def test_notification_mark_read(self):
        # Initial is false
        self.assertFalse(Notification.objects.get(id=self.notification.id).is_read)
        response = self.client.post(reverse('mark_notification_read', args=[self.notification.id]))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Notification.objects.get(id=self.notification.id).is_read)

    def test_notification_mark_read_404(self):
        response = self.client.post(reverse('mark_notification_read', args=[999]))
        self.assertEqual(response.status_code, 404)

    def test_notification_mark_all_read(self):
        Notification.objects.create(user_address="0x456", message="Second notif", link="/")
        response = self.client.post(reverse('mark_all_notifications_read'), {"address": "0x456"}, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Notification.objects.filter(user_address="0x456", is_read=False).exists())

    def test_notification_clear(self):
        response = self.client.post(reverse('clear_notifications'), {"address": "0x456"}, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Notification.objects.filter(user_address="0x456").exists())

class IndexerTasksTests(TestCase):
    @patch('forum.tasks._get_genlayer_client')
    def test_call_read_contract_success(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.read_contract.return_value = "test_data"
        mock_get_client.return_value = mock_client

        with patch('django.conf.settings.GENLAYER_CONTRACT_ADDRESS', '0xabc'):
            from forum.tasks import call_read_contract
            result = call_read_contract("get_community", [1])
            self.assertEqual(result, "test_data")
            mock_client.read_contract.assert_called_with(
                address='0xabc',
                function_name='get_community',
                args=[1]
            )

    @patch('forum.tasks.call_read_contract')
    def test_poll_genlayer_state_creates_community(self, mock_call):
        # Mock responses: 1 community exists
        def mock_read(method_name, args=None):
            if method_name == "get_community_count":
                return 1
            elif method_name == "get_post_count":
                return 0
            elif method_name == "get_comment_count":
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
        
        from forum.tasks import poll_genlayer_state
        poll_genlayer_state()
        
        # State should now have 1 community
        self.assertEqual(Community.objects.count(), 1)
        comm = Community.objects.first()
        self.assertEqual(comm.name, "Sync Comm")
        
        sync_state = SyncState.objects.first()
        self.assertEqual(sync_state.last_community_id_synced, 0)
