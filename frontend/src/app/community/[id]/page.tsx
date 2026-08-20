'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { useMounted } from '@/hooks/useMounted'
import { useApi } from '@/hooks/useApi'
import { Shield, MessageSquare, ArrowLeft, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CreatePostDialog } from '@/components/CreatePostDialog'
import { PostCard } from '@/components/PostCard'

interface Community {
  id: number;
  name: string;
  description: string;
  constitution: string;
  min_reputation_to_post: number;
}

interface Post {
  id: number;
  community_id: number;
  flag_cooldown_seconds?: number;
  community_name?: string;
  author: string;
  content: string;
  status: number;
  created_at: string;
  comment_count?: number;
  moderation_verdict?: string;
}

export default function CommunityPage() {
  const { id } = useParams()
  const router = useRouter()
  const { isConnected, address } = useAccount()
  const mounted = useMounted()
  const { fetchApi } = useApi()
  
  const [community, setCommunity] = useState<Community | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [reputation, setReputation] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const limit = 20

  const fetchPosts = useCallback(async (currentOffset: number) => {
    try {
      const res = await fetchApi(`/api/communities/${id}/posts/?limit=${limit}&offset=${currentOffset}`)
      const data = await res.json()
      if (data.length < limit) {
        setHasMore(false)
      }
      return data
    } catch (err) {
      console.error(err)
      return []
    }
  }, [fetchApi, limit, id])

  useEffect(() => {
    if (!id) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true)
    Promise.all([
      fetchApi(`/api/communities/${id}/`).then(res => res.json()),
      fetchPosts(0)
    ])
    .then(([commData, postsData]) => {
      setCommunity(commData)
      setPosts(postsData)
      setIsLoading(false)
    })
    .catch(console.error)
  }, [id])

  useEffect(() => {
    if (id && address && mounted) {
      fetchApi(`/api/communities/${id}/reputation/${address}/`)
        .then(res => res.json())
        .then(data => {
          if (data.reputation !== undefined) {
            setReputation(data.reputation);
          }
        })
        .catch(console.error)
    }
  }, [id, address, mounted, fetchApi])

  const observerRef = useRef<IntersectionObserver | null>(null)
  const lastPostElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoading || isFetchingMore) return
    if (observerRef.current) observerRef.current.disconnect()
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setIsFetchingMore(true)
        const nextOffset = offset + limit
        fetchPosts(nextOffset).then(newData => {
          setPosts(prev => [...prev, ...newData])
          setOffset(nextOffset)
          setIsFetchingMore(false)
        })
      }
    })
    
    if (node) observerRef.current.observe(node)
  }, [isLoading, isFetchingMore, hasMore, offset])

  if (isLoading) {
    return (
      <div className="max-w-screen-2xl mx-auto py-12 px-4 sm:px-6 lg:px-12 w-full space-y-8 pt-32">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!community) return <div className="text-center py-32">Hub not found.</div>

  return (
    <div className="max-w-screen-2xl mx-auto py-12 px-4 sm:px-6 lg:px-12 w-full space-y-12 pt-32">
      
      {/* Navigation */}
      <div>
        <button 
          onClick={() => router.back()} 
          className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
      </div>

      {/* Community Header */}
      <section className="relative p-8 md:p-12 rounded-3xl overflow-hidden border border-border/40 bg-surface/30 backdrop-blur-sm shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="font-mono">#{community.id}</Badge>
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
                <Shield className="w-3 h-3 mr-1" /> AI Moderated
              </Badge>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
              {community.name}
            </h1>
            
            <p className="text-lg text-muted-foreground leading-relaxed">
              {community.description}
            </p>

            <div className="bg-surface/50 p-4 rounded-xl border border-border/40 mt-4">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Constitution
              </h3>
              <p className="text-sm text-muted-foreground font-mono">{community.constitution}</p>
            </div>
          </div>
          
          <div className="shrink-0 flex flex-col items-end gap-2">
            {mounted && isConnected ? (
              <>
                <div className="text-right mb-2 bg-[#130E26]/80 p-3 rounded-xl border border-primary/20 backdrop-blur-sm shadow-[0_0_15px_rgba(130,80,223,0.1)]">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Your Reputation</div>
                  <div className={`text-2xl font-black ${reputation !== null && reputation < community.min_reputation_to_post ? 'text-red-400' : 'text-primary'}`}>
                    {reputation !== null ? reputation : '...'}
                    <span className="text-sm font-medium text-muted-foreground ml-1">/ min {community.min_reputation_to_post}</span>
                  </div>
                </div>
                
                {reputation !== null && reputation < community.min_reputation_to_post ? (
                  <div className="flex flex-col items-end">
                    <CreatePostDialog communityId={community.id} disabled={true} />
                    <p className="text-xs text-red-400 mt-2 font-medium max-w-[200px] text-right leading-tight">
                      Your reputation is too low to post in this hub.
                    </p>
                  </div>
                ) : (
                  <CreatePostDialog communityId={community.id} disabled={false} />
                )}
              </>
            ) : (
              <div className="flex flex-col items-end gap-2">
                <div className="text-right mb-2 bg-[#130E26]/80 p-3 rounded-xl border border-primary/20 backdrop-blur-sm shadow-[0_0_15px_rgba(130,80,223,0.1)]">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Min Reputation</div>
                  <div className="text-2xl font-black text-primary">
                    {community.min_reputation_to_post}
                  </div>
                </div>
                <Button disabled className="rounded-full">Connect Wallet to Post</Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Posts Feed */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-8 border-b border-border/40 pb-4">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Discussions</h2>
        </div>

        {posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.filter(post => {
              if (post.status === 3) return false;
              if (post.status === 1 && (!mounted || address?.toLowerCase() !== post.author.toLowerCase())) return false;
              return true;
            }).map((post, index, visiblePosts) => {
              if (visiblePosts.length === index + 1) {
                return (
                  <div ref={lastPostElementRef} key={post.id}>
                    <PostCard post={post} showCommunityBadge={false} />
                  </div>
                )
              } else {
                return (
                  <div key={post.id}>
                    <PostCard post={post} showCommunityBadge={false} />
                  </div>
                )
              }
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-surface/20 rounded-2xl border border-dashed border-border/60">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-foreground mb-2">No posts yet</h3>
            <p className="text-muted-foreground text-sm">Be the first to share your thoughts in this hub.</p>
          </div>
        )}

        {isFetchingMore && (
          <div className="flex justify-center mt-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </section>
    </div>
  )
}
