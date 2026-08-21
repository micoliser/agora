'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, MessageSquare, ShieldAlert, CheckCircle2, AlertTriangle, PenSquare, Flag, Loader2 } from 'lucide-react'
import { useFlagCooldown } from '@/hooks/useFlagCooldown'
import { CommentModal } from './CommentModal'
import { useAccount } from 'wagmi'
import { useMounted } from '@/hooks/useMounted'
import { useTransaction } from '@/hooks/useTransaction'
import { useApi } from '@/hooks/useApi'
import { toast } from 'sonner'

const FORUM_ADDRESS = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}`

interface Post {
  flag_count?: number;
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
  appeal_used?: boolean;
  appeal_deadline?: number;
}

interface PostCardProps {
  post: Post;
  showCommunityBadge?: boolean;
}

export function PostCard({ post, showCommunityBadge = true }: PostCardProps) {
  const [commentModalOpen, setCommentModalOpen] = useState(false)
  const [localCommentCount, setLocalCommentCount] = useState(post.comment_count || 0)
  
  const { address, isConnected } = useAccount()
  const mounted = useMounted()
  const { execute, isLocked } = useTransaction()
  const { fetchApi } = useApi()

  const { isCooldownActive, cooldownTimeRemaining, triggerCooldown } = useFlagCooldown(address, post.community_id, post.flag_cooldown_seconds)
  
  // React to Hydration
  const [currentTime, setCurrentTime] = useState(() => Date.now() / 1000)
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now() / 1000), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTimeRemaining = (deadline: number) => {
    const diff = deadline - currentTime;
    if (diff <= 0) return "Expired";
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = Math.floor(diff % 60);
    return `Appeal ends in: ${h}h ${m}m ${s}s`;
  };

  // Handle masking based on status
  const isRemoved = post?.status === 1;
  const isRestored = post?.status === 2;
  const isAppealDenied = post?.status === 3;
  const isHidden = isRemoved || isAppealDenied;

  const isAuthor = mounted && address?.toLowerCase() === post.author.toLowerCase();

  // VISIBILITY LOGIC
  if (isHidden && !isAuthor) return null;

  const handleCommentClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (mounted && isConnected) {
      setCommentModalOpen(true);
    } else {
      alert("Please connect your wallet to comment.");
    }
  }

  const handleFlagClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!mounted || !isConnected) return toast.error("Please connect your wallet to flag.");
    
    await execute(
      FORUM_ADDRESS,
      'flag_post',
      [BigInt(post.id)],
      {
        confirmingMessage: 'Submitting flag request...',
        submittedMessage: 'GenVM is evaluating the post...',
        confirmedMessage: 'Moderation complete!',
        syncRequests: [{ entityType: 'post', entityId: String(post?.id), currentState: { flag_count: post?.flag_count, status: post?.status } }, { entityType: 'user_activity', entityId: address as string }],
        onConfirmed: async () => {
          if (typeof triggerCooldown !== 'undefined') triggerCooldown();
          try {
            const response = await fetchApi(`/api/posts/${post?.id}/`);
            const data = await response.json();
            if (data.status === 1) toast.success("Flag successful! The content has been removed. The author can appeal the flag.");
            else toast.error("Bad flag. The content does not violate the constitution. You have lost reputation points.");
          } catch(e) { console.error(e); }
          await new Promise(resolve => setTimeout(resolve, 2000));
          window.location.reload();
        }
      }
    )
  }

  const handleAppealClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!mounted || !isConnected) return;

    await execute(
      FORUM_ADDRESS,
      'appeal_post',
      [BigInt(post.id)],
      {
        confirmingMessage: 'Submitting appeal...',
        submittedMessage: 'GenVM is reviewing your appeal...',
        confirmedMessage: 'Appeal process complete!',
        syncRequests: [{ entityType: 'post', entityId: String(post?.id), currentState: { flag_count: post?.flag_count, status: post?.status } }, { entityType: 'user_activity', entityId: address as string }],
        onConfirmed: async () => {
          if (typeof triggerCooldown !== 'undefined') triggerCooldown();
          try {
            const response = await fetchApi(`/api/posts/${post?.id}/`);
            const data = await response.json();
            if (data.status === 2) toast.success("Appeal successful! The content has been restored.");
            else if (data.status === 3) toast.error("Appeal denied. The content remains removed and you have lost reputation points.");
          } catch(e) { console.error(e); }
          await new Promise(resolve => setTimeout(resolve, 2000));
          window.location.reload();
        }
      }
    )
  }

  return (
    <>
      <Link href={`/post/${post?.id}`} className="block h-full">
        <Card className="group h-full flex flex-col bg-[#130E26] border border-[#291F4A] hover:border-primary/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-primary/5 cursor-pointer relative overflow-hidden rounded-2xl">
          
          {isHidden && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center">
              <ShieldAlert className="w-12 h-12 text-destructive mb-4 opacity-80" />
              <h3 className="font-bold text-lg text-foreground mb-2">
                Post Removed
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-3 mb-6">
                {post.moderation_verdict || "This post violates the hub's constitution."}
              </p>
              
                {isAppealDenied && isAuthor && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 px-4 py-1 text-sm z-20 font-bold uppercase tracking-wider">
                    Appeal Denied
                  </Badge>
                )}
                
                {isRemoved && isAuthor && !post.appeal_used && post.appeal_deadline && currentTime >= post.appeal_deadline && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 px-4 py-1 text-sm z-20 font-bold uppercase tracking-wider">
                    Appeal Window Expired
                  </Badge>
                )}

                {isRemoved && isAuthor && !post.appeal_used && (!post.appeal_deadline || currentTime < post.appeal_deadline) && (
                  <div className="flex flex-col items-center gap-2 z-20 w-full max-w-xs mx-auto">
                    <Button 
                      variant="outline" 
                      className="w-full bg-primary/10 border-primary text-primary hover:bg-primary hover:text-white transition-colors h-11 text-base font-semibold shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                      onClick={handleAppealClick} 
                      disabled={isLocked}
                    >
                      {isLocked ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <AlertTriangle className="w-5 h-5 mr-2" />}
                      Appeal Decision
                    </Button>
                    <span className="text-sm font-medium transition-colors text-white/90">
                      {post.appeal_deadline ? formatTimeRemaining(post.appeal_deadline) : ''}
                    </span>
                  </div>
                )}

                {isRemoved && isAuthor && post.appeal_used && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-4 py-1 text-sm z-20 font-bold uppercase tracking-wider">
                    Appeal Pending Review
                  </Badge>
                )}
            </div>
          )}

          <CardHeader className="pb-3 flex-none">
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {post.author.slice(2, 4).toUpperCase()}
                </div>
                <div className="text-sm font-mono text-muted-foreground">
                  {post.author.slice(0, 6)}...{post.author.slice(-4)}
                </div>
                {isRestored && (
                  <Badge variant="outline" className="border-green-500/30 text-green-500 bg-green-500/10 text-[10px] px-1.5 py-0">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Restored
                  </Badge>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(Number(post.created_at) * 1000).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
                {showCommunityBadge && post.community_name && (
                  <Badge className="bg-transparent hover:bg-transparent text-primary text-xs font-bold drop-shadow-sm max-w-[150px] truncate px-0">
                    {post.community_name}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="flex-grow">
            <p className="text-foreground leading-relaxed whitespace-pre-wrap break-words line-clamp-4 overflow-hidden">
              {post.content}
            </p>
          </CardContent>

          <CardFooter className="pt-4 border-t border-[#291F4A] flex-none flex flex-wrap justify-between items-center gap-4 bg-black/10">
            <div className="flex flex-wrap items-center gap-2 z-20">
              {!isHidden && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-primary"
                  onClick={handleCommentClick}
                >
                  <PenSquare className="w-4 h-4 mr-2" />
                  Reply
                </Button>
              )}
              
              {!isAuthor && post?.status === 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-destructive disabled:opacity-100 disabled:cursor-not-allowed"
                  onClick={handleFlagClick}
                  disabled={isLocked || isCooldownActive}
                >
                  {isLocked ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin opacity-50" />
                  ) : (
                    <Flag className={`w-4 h-4 mr-2 ${isCooldownActive ? 'opacity-50' : ''}`} />
                  )}
                  <span className={isCooldownActive ? 'text-primary' : ''}>
                    {isCooldownActive ? cooldownTimeRemaining : 'Flag'}
                  </span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium z-20">
              {localCommentCount}
              <MessageSquare className="w-4 h-4" />
            </div>
          </CardFooter>
        </Card>
      </Link>

      <CommentModal 
        open={commentModalOpen} 
        onOpenChange={setCommentModalOpen}
        postId={post.id}
        postAuthor={post.author}
        postContent={post.content}
        onCommentAdded={() => setLocalCommentCount(prev => prev + 1)}
      />
    </>
  )
}
