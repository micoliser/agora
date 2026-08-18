'use client'

import { useAccount } from 'wagmi'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useMounted } from '@/hooks/useMounted'
import { useApi } from '@/hooks/useApi'
import { ArrowRight, MessageSquare, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
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

export default function Home() {
  const { isConnected, address } = useAccount()
  const mounted = useMounted()
  const { fetchApi } = useApi()
  
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const limit = 20

  const fetchPosts = async (currentOffset: number) => {
    try {
      const res = await fetchApi(`/api/posts/?limit=${limit}&offset=${currentOffset}`)
      const data = await res.json()
      if (data.length < limit) {
        setHasMore(false)
      }
      return data
    } catch (err) {
      console.error(err)
      return []
    }
  }

  useEffect(() => {
    setIsLoading(true)
    fetchPosts(0).then(data => {
      setPosts(data)
      setIsLoading(false)
    })
  }, [])

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

  return (
    <div className="flex flex-col min-h-screen pt-24 pb-20">
      
      {/* Hero Section (Two Column Layout) */}
      <section className="px-4 sm:px-6 lg:px-12 max-w-screen-2xl mx-auto w-full pt-12 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Column: Hero Text */}
          <div className="space-y-8 z-10">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#231A47] text-[#9375E0] text-[10px] font-bold uppercase tracking-widest rounded-full border border-[#3E2D77]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9375E0]" />
              GenLayer Studionet
            </span>
            
            <h1 className="text-5xl sm:text-6xl lg:text-[4.5rem] font-black tracking-tight text-foreground font-heading leading-[1.05]">
              Autonomous hubs governed by intelligence, not admins.
            </h1>
            
            <p className="text-lg text-muted-foreground font-medium max-w-xl leading-relaxed">
              Traditional forums rely on biased central authorities. Agora uses a GenLayer Intelligent Contract to read your hub's constitution and moderate interactions through AI consensus.
            </p>
            
            <div className="flex flex-wrap items-center gap-4 pt-4">
              {mounted && isConnected ? (
                <Button 
                  size="lg" 
                  className="rounded-md bg-primary hover:bg-primary/90 text-white font-bold h-12 px-8 text-base shadow-[0_0_20px_rgba(130,80,223,0.2)] transition-all"
                  render={<Link href="/communities/create" />}
                  nativeButton={false}
                >
                  Deploy a Hub
                </Button>
              ) : (
                <Button 
                  size="lg" 
                  className="rounded-md bg-primary hover:bg-primary/90 text-white font-bold h-12 px-8 text-base shadow-[0_0_20px_rgba(130,80,223,0.2)] transition-all"
                  render={<Link href="/communities" />}
                  nativeButton={false}
                >
                  Explore Hubs
                </Button>
              )}
              <Button 
                variant="outline" 
                size="lg" 
                className="rounded-md h-12 px-8 text-base font-semibold bg-[#130E26] border-border hover:bg-[#1C1635] text-white" 
                render={<Link href="#how-it-works" />} 
                nativeButton={false}
              >
                How it Works
              </Button>
            </div>
          </div>

          {/* Right Column: Stats Grid */}
          <div className="bg-[#130E26] border border-[#291F4A] rounded-2xl overflow-hidden shadow-2xl relative z-10">
            <div className="grid grid-cols-2 border-b border-[#291F4A]">
              <div className="p-8 border-r border-[#291F4A]">
                <div className="text-4xl font-black text-white font-heading tracking-tight mb-2">
                  ∞
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#5E548E]">
                  Active Hubs
                </div>
              </div>
              <div className="p-8">
                <div className="text-4xl font-black text-white font-heading tracking-tight mb-2">50+</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#5E548E]">
                  Contributors
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2">
              <div className="p-8 border-r border-[#291F4A]">
                <div className="text-4xl font-black text-white font-heading tracking-tight mb-2">100%</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#5E548E]">
                  On-chain Consensus
                </div>
              </div>
              <div className="p-8">
                <div className="text-4xl font-black text-white font-heading tracking-tight mb-2">24/7</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#5E548E]">
                  AI Moderation
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </section>

      {/* Comparison Section (Side-by-side) */}
      <section id="how-it-works" className="px-4 sm:px-6 lg:px-12 max-w-screen-2xl mx-auto w-full py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Traditional Box */}
          <div className="bg-[#0D091B] border border-[#291F4A] rounded-2xl p-10 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#E17272] mb-6">
                Traditional Forums
              </div>
              <h3 className="text-3xl font-bold text-white font-heading tracking-tight mb-4">
                Centralized authorities
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-10">
                A few admins hold all the power, enforcing rules subjectively, changing guidelines secretly, and banning users without due process.
              </p>
            </div>
            
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm text-[#A69CBF]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E17272]" />
                Biased, manual moderation
              </li>
              <li className="flex items-center gap-3 text-sm text-[#A69CBF]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E17272]" />
                Secret rule changes
              </li>
              <li className="flex items-center gap-3 text-sm text-[#A69CBF]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E17272]" />
                No appeal mechanism
              </li>
            </ul>
          </div>

          {/* GenLayer Box */}
          <div className="bg-[#130E26] border border-[#291F4A] rounded-2xl p-10 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#9375E0] mb-6">
                Agora on GenLayer
              </div>
              <h3 className="text-3xl font-bold text-white font-heading tracking-tight mb-4">
                Hub-defined, AI-enforced
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-10">
                The Intelligent Contract reasons across natural language constitutions. Rules are transparent, and moderation is guaranteed to follow them.
              </p>
            </div>
            
            <ul className="space-y-4 relative z-10">
              <li className="flex items-center gap-3 text-sm text-white">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                Transparent Constitution
              </li>
              <li className="flex items-center gap-3 text-sm text-white">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                Decentralized AI Consensus
              </li>
              <li className="flex items-center gap-3 text-sm text-white">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                Trustless Appeals
              </li>
            </ul>
          </div>

        </div>
      </section>

      {/* Global Post Feed */}
      <section className="px-4 sm:px-6 lg:px-12 max-w-screen-2xl mx-auto w-full py-24">
        <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-12">
          <div className="space-y-2">
            <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight">
              Global Feed
            </h2>
            <p className="text-muted-foreground">Recent discussions across all hubs.</p>
          </div>
            {mounted && isConnected && (
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-[#130E26] border-destructive/30 hover:border-destructive text-destructive"
                render={<Link href="/moderated-posts" />}
                nativeButton={false}
              >
                My Moderated Posts
              </Button>
            )}
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-48 w-full rounded-xl bg-[#1C1635]" />
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.filter(post => {
              if (post.status === 3) return false;
              if (post.status === 1 && (!mounted || address?.toLowerCase() !== post.author.toLowerCase())) return false;
              return true;
            }).map((post, index, visiblePosts) => {
              if (visiblePosts.length === index + 1) {
                return (
                  <div ref={lastPostElementRef} key={post.id}>
                    <PostCard post={post} />
                  </div>
                )
              } else {
                return (
                  <div key={post.id}>
                    <PostCard post={post} />
                  </div>
                )
              }
            })}
          </div>
        ) : (
          <div className="text-center py-24 bg-[#130E26] rounded-2xl border border-[#291F4A]">
            <MessageSquare className="w-12 h-12 text-[#291F4A] mx-auto mb-6" />
            <h3 className="text-2xl font-bold font-heading text-white mb-2">No posts yet</h3>
            <p className="text-muted-foreground mb-6">Create the first post in a hub.</p>
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
