'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useMounted } from '@/hooks/useMounted'
import { ArrowLeft, Clock, MessageCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'

const FORUM_ADDRESS = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}`

interface Post {
  id: number;
  community_id: number;
  author: string;
  content: string;
  created_at: string;
}

interface Comment {
  id: number;
  post_id: number;
  author: string;
  content: string;
  created_at: string;
}

export default function PostPage() {
  const { id } = useParams()
  const { isConnected } = useAccount()
  const mounted = useMounted()
  
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [commentContent, setCommentContent] = useState('')
  
  const { data: hash, writeContract, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (!id) return

    Promise.all([
      fetch(`http://localhost:8000/api/posts/${id}/`).then(res => res.json()),
      fetch(`http://localhost:8000/api/posts/${id}/comments/`).then(res => res.json())
    ])
    .then(([postData, commentsData]) => {
      setPost(postData)
      setComments(commentsData)
      setIsLoading(false)
    })
    .catch(console.error)
  }, [id, isSuccess]) // Refresh when a new comment is successfully posted

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentContent || !id) return

    writeContract({
      address: FORUM_ADDRESS,
      abi: [
        {
          "name": "create_comment",
          "type": "function",
          "inputs": [
            { "name": "post_id", "type": "uint256" },
            { "name": "content", "type": "string" }
          ],
          "outputs": [{ "name": "", "type": "uint256" }]
        }
      ],
      functionName: 'create_comment',
      args: [Number(id), commentContent],
    })
  }

  // Clear input on success
  useEffect(() => {
    if (isSuccess) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCommentContent('')
    }
  }, [isSuccess])

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (!post) return <div className="text-center py-20">Post not found.</div>

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-12">
      {/* Navigation */}
      <div>
        <Button 
          variant="ghost" 
          className="text-muted-foreground hover:text-primary pl-0"
          render={<Link href={`/community/${post.community_id}`} />}
          nativeButton={false}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Community
        </Button>
      </div>

      {/* Original Post */}
      <Card className="bg-surface/30 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden rounded-3xl">
        <div className="h-2 w-full bg-gradient-to-r from-primary to-primary/40" />
        <CardHeader className="pt-8 px-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
              {post.author.slice(2, 4).toUpperCase()}
            </div>
            <div>
              <div className="font-mono text-foreground font-medium">
                {post.author.slice(0, 6)}...{post.author.slice(-4)}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <Clock className="w-3.5 h-3.5" />
                {new Date(post.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8 pt-4">
          <p className="text-lg text-foreground leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
        </CardContent>
      </Card>

      {/* Comments Section */}
      <section className="space-y-8">
        <div className="flex items-center gap-3 border-b border-border/40 pb-4">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h3 className="text-2xl font-bold text-foreground">Comments</h3>
          <span className="bg-surface border border-border/40 px-3 py-1 rounded-full text-sm font-medium ml-auto">
            {comments.length}
          </span>
        </div>

        {/* Comment Form */}
        {mounted && isConnected ? (
          <form onSubmit={handleCommentSubmit} className="bg-surface/20 border border-border/40 p-6 rounded-2xl space-y-4">
            <Textarea
              placeholder="Add to the discussion..."
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              className="min-h-[100px] bg-background/50 border-border/50 focus-visible:ring-primary resize-none"
              disabled={isPending || isConfirming}
            />
            <div className="flex justify-end">
              <Button 
                type="submit" 
                className="rounded-full shadow-lg h-10 px-6 font-semibold"
                disabled={isPending || isConfirming || !commentContent}
              >
                {isPending || isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Reply'
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="bg-surface/20 border border-border/40 p-6 rounded-2xl text-center">
            <p className="text-muted-foreground mb-4">Connect your wallet to join the conversation.</p>
            <Button disabled className="rounded-full">Connect Wallet</Button>
          </div>
        )}

        {/* Comments List */}
        <div className="space-y-4">
          {comments.map((comment) => (
            <Card key={comment.id} className="bg-surface/10 border-border/30 rounded-2xl shadow-none">
              <CardHeader className="py-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-xs">
                      {comment.author.slice(2, 4).toUpperCase()}
                    </div>
                    <div className="text-sm font-mono text-muted-foreground">
                      {comment.author.slice(0, 6)}...{comment.author.slice(-4)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(comment.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {comment.content}
                </p>
              </CardContent>
            </Card>
          ))}
          {comments.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No comments yet. Be the first to reply!</p>
          )}
        </div>
      </section>
    </div>
  )
}
