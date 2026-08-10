'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useMounted } from '@/hooks/useMounted'
import { Shield, MessageSquare, ArrowLeft, Clock } from 'lucide-react'
import Link from 'next/link'
import { 
  Card, 
  CardHeader, 
  CardContent 
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CreatePostDialog } from '@/components/CreatePostDialog'

interface Community {
  id: number;
  name: string;
  description: string;
  constitution: string;
}

interface Post {
  id: number;
  community_id: number;
  author: string;
  content: string;
  created_at: string;
}

export default function CommunityPage() {
  const { id } = useParams()
  const { isConnected } = useAccount()
  const mounted = useMounted()
  
  const [community, setCommunity] = useState<Community | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    Promise.all([
      fetch(`http://localhost:8000/api/communities/${id}/`).then(res => res.json()),
      fetch(`http://localhost:8000/api/communities/${id}/posts/`).then(res => res.json())
    ])
    .then(([commData, postsData]) => {
      setCommunity(commData)
      setPosts(postsData)
      setIsLoading(false)
    })
    .catch(console.error)
  }, [id])

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!community) return <div className="text-center py-20">Hub not found.</div>

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-12">
      
      {/* Navigation */}
      <div>
        <Button 
          variant="ghost" 
          className="text-muted-foreground hover:text-primary pl-0"
          render={<Link href="/communities" />}
          nativeButton={false}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Hubs
        </Button>
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
          
          <div className="shrink-0">
            {mounted && isConnected ? (
              <CreatePostDialog communityId={community.id} />
            ) : (
              <Button disabled className="rounded-full">Connect Wallet to Post</Button>
            )}
          </div>
        </div>
      </section>

      {/* Posts Feed */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-8 border-b border-border/40 pb-4">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Discussions</h2>
          <Badge variant="secondary" className="ml-auto">{posts.length} Posts</Badge>
        </div>

        {posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <Link key={post.id} href={`/post/${post.id}`}>
                <Card className="group bg-surface/30 backdrop-blur-sm border-border/40 hover:border-primary/40 hover:bg-surface/50 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer mb-4">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                          {post.author.slice(2, 4).toUpperCase()}
                        </div>
                        <div className="text-sm font-mono text-muted-foreground">
                          {post.author.slice(0, 6)}...{post.author.slice(-4)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(post.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap line-clamp-3">
                      {post.content}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-surface/20 rounded-2xl border border-dashed border-border/60">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-foreground mb-2">No posts yet</h3>
            <p className="text-muted-foreground text-sm">Be the first to share your thoughts in this hub.</p>
          </div>
        )}
      </section>
    </div>
  )
}
