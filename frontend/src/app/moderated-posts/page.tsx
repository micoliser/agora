'use client'

import { useAccount } from 'wagmi'
import { useState, useEffect, useCallback } from 'react'
import { useMounted } from '@/hooks/useMounted'
import { useApi } from '@/hooks/useApi'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PostCard } from '@/components/PostCard'

interface Post {
  id: number;
  community_id: number;
  community_name?: string;
  author: string;
  content: string;
  status: number;
  flag_count?: number;
  created_at: string;
  comment_count?: number;
  moderation_verdict?: string;
}

export default function ModeratedPosts() {
  const { isConnected, address } = useAccount()
  const mounted = useMounted()
  const { fetchApi } = useApi()
  
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const limit = 20

  const fetchPosts = useCallback(async (currentOffset: number) => {
    if (!address) return [];
    try {
      const res = await fetchApi(`/api/user/${address}/moderated_posts/?limit=${limit}&offset=${currentOffset}`)
      const data = await res.json()
      if (data.length < limit) {
        setHasMore(false)
      }
      return data
    } catch (err) {
      console.error(err)
      return []
    }
  }, [address, fetchApi, limit]);

  useEffect(() => {
    if (mounted && isConnected && address) {
      setIsLoading(true)
      setOffset(0)
      setHasMore(true)
      fetchPosts(0).then(data => {
        setPosts(data)
        setIsLoading(false)
      })
    } else if (mounted && !isConnected) {
        setIsLoading(false)
    }
  }, [mounted, isConnected, address, fetchPosts])

  const loadMore = async () => {
    if (isFetchingMore || !hasMore) return
    setIsFetchingMore(true)
    const newOffset = offset + limit
    const newPosts = await fetchPosts(newOffset)
    setPosts(prev => [...prev, ...newPosts])
    setOffset(newOffset)
    setIsFetchingMore(false)
  }

  if (!mounted) return null

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-8 pt-32 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
          Moderated Posts
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Please connect your wallet to view your moderated posts.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-8 pt-32">
        <div className="space-y-4 text-center mb-12">
          <Skeleton className="h-12 w-64 mx-auto bg-[#1a1533]" />
          <Skeleton className="h-6 w-96 mx-auto bg-[#1a1533]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl bg-[#1a1533]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-8 pt-32">
      <div className="space-y-4 text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 drop-shadow-sm">
          Moderated Posts
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          A history of your posts that have been removed due to community violations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {posts.length === 0 && (
          <div className="col-span-full text-center py-12 bg-[#130E26]/50 rounded-2xl border border-white/5 backdrop-blur-sm">
            <p className="text-lg text-muted-foreground">You have no moderated posts.</p>
          </div>
        )}
      </div>

      {posts.length > 0 && hasMore && (
        <div className="flex justify-center pt-8">
          <Button
            variant="outline"
            size="lg"
            onClick={loadMore}
            disabled={isFetchingMore}
            className="rounded-full px-8 border-primary/20 hover:bg-primary/10"
          >
            {isFetchingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
