"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useTransaction } from "@/hooks/useTransaction";
import { useMounted } from "@/hooks/useMounted";
import { useApi } from "@/hooks/useApi";
import { ArrowLeft, Clock, MessageCircle, Loader2, ShieldAlert, AlertTriangle, Flag, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useFlagCooldown } from "@/hooks/useFlagCooldown";

const FORUM_ADDRESS = process.env
  .NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}`;

interface Post {
  id: number;
  community_id: number;
  author: string;
  content: string;
  status: number;
  created_at: string;
  moderation_verdict?: string;
  appeal_used?: boolean;
  appeal_deadline: number;
}

interface Community {
  id: number;
  name: string;
}

interface Comment {
  id: number;
  post_id: number;
  author: string;
  content: string;
  status: number;
  created_at: string;
  moderation_verdict?: string;
  appeal_used?: boolean;
  appeal_deadline: number;
}

export default function PostPage() {
  const { id } = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const mounted = useMounted();
  const { fetchApi } = useApi();

  const [post, setPost] = useState<Post | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [commentContent, setCommentContent] = useState("");

  const { execute, isLocked } = useTransaction();
  const { isCooldownActive, cooldownTimeRemaining, triggerCooldown } = useFlagCooldown(address, post?.community_id);
  
  const formatTimeRemaining = (deadline: number) => {
    const diff = deadline - currentTime;
    if (diff <= 0) return "Expired";
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = Math.floor(diff % 60);
    return `Appeal ends in: ${h}h ${m}m ${s}s`;
  };
  const [currentTime, setCurrentTime] = useState(Date.now() / 1000);
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now() / 1000), 1000);
    return () => clearInterval(timer);
  }, []);

  const refreshData = () => {
    if (!id) return;
    Promise.all([
      fetchApi(`/api/posts/${id}/`).then((res) => res.json()),
      fetchApi(`/api/posts/${id}/comments/`).then((res) => res.json()),
    ])
      .then(([postData, commentsData]) => {
        setPost(postData);
        setComments(commentsData);
        return fetchApi(`/api/communities/${postData.community_id}/`)
          .then((res) => res.json())
          .then((communityData) => {
            setCommunity(communityData);
            setIsLoading(false);
          });
      })
      .catch(console.error);
  };

  useEffect(() => {
    refreshData();
  }, [id]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent || !id) return;

    await execute(
      FORUM_ADDRESS,
      "create_comment",
      [BigInt(id as string), commentContent],
      {
        confirmingMessage: "Please confirm comment creation in your wallet...",
        submittedMessage: "Comment submitted, waiting for confirmation...",
        confirmedMessage: "Comment created successfully!",
        onConfirmed: async () => {
          try {
            await fetchApi("/api/indexer/latest-comment/", { method: "POST" });
          } catch (e) {}
          setCommentContent("");
          await new Promise(resolve => setTimeout(resolve, 2000));
          refreshData();
        },
      },
    );
  };

  const handleFlagPost = async () => {
    if (!id || !mounted || !isConnected) return;
    await execute(
      FORUM_ADDRESS,
      "flag_post",
      [BigInt(id as string)],
      {
        confirmingMessage: "Submitting flag request...",
        submittedMessage: "GenVM is evaluating the post...",
        confirmedMessage: "Moderation complete!",
        syncRequests: [{ entityType: 'post', entityId: post.id, currentState: { flag_count: post.flag_count, status: post.status } }, { entityType: 'user_activity', entityId: address as string }],
        onConfirmed: async () => {
          if (typeof triggerCooldown !== 'undefined') if (typeof triggerCooldown !== 'undefined') triggerCooldown();
          try {
            const response = await fetchApi(`/api/posts/${post.id}/`);
            const data = await response.json();
            if (data.status === 1) toast.success("Flag successful! The content has been removed. The author can appeal the flag.");
            else toast.error("Bad flag. The content does not violate the constitution. You have lost reputation points.");
          } catch(e) { console.error(e); }
          await new Promise(resolve => setTimeout(resolve, 2000));
          refreshData();
        }
      }
    )
  };

  const handleAppealPost = async () => {
    if (!id || !mounted || !isConnected) return;
    await execute(
      FORUM_ADDRESS,
      "appeal_post",
      [BigInt(id as string)],
      {
        confirmingMessage: "Submitting appeal...",
        submittedMessage: "GenVM is reviewing your appeal...",
        confirmedMessage: "Appeal process complete!",
        syncRequests: [{ entityType: 'post', entityId: post.id, currentState: { flag_count: post.flag_count, status: post.status } }, { entityType: 'user_activity', entityId: address as string }],
          onConfirmed: async () => {
            if (typeof triggerCooldown !== 'undefined') if (typeof triggerCooldown !== 'undefined') triggerCooldown();
            try {
              const response = await fetchApi(`/api/posts/${post.id}/`);
              const data = await response.json();
              if (data.status === 2) toast.success("Appeal successful! The content has been restored.");
              else if (data.status === 3) toast.error("Appeal denied. The content remains removed and you have lost reputation points.");
            } catch(e) { console.error(e); }
            await new Promise(resolve => setTimeout(resolve, 2000));
            refreshData();
          }
      }
    )
  };

  const handleFlagComment = async (commentId: number) => {
    if (!mounted || !isConnected) return;
    await execute(
      FORUM_ADDRESS,
      "flag_comment",
      [BigInt(commentId)],
      {
        confirmingMessage: "Submitting flag request...",
        submittedMessage: "GenVM is evaluating the comment...",
        confirmedMessage: "Moderation complete!",
        syncRequests: [{ entityType: 'comment', entityId: commentId, currentState: (() => {
          const c = comments.find(c => c.id === commentId);
          return c ? { flag_count: c.flag_count, status: c.status } : undefined;
        })() }, { entityType: 'user_activity', entityId: address as string }],
        onConfirmed: async () => {
          if (typeof triggerCooldown !== 'undefined') if (typeof triggerCooldown !== 'undefined') triggerCooldown();
          try {
            const response = await fetchApi(`/api/posts/${post.id}/comments/`);
            const data = await response.json();
            const target = data.find((c: any) => c.id === commentId);
            if (target && target.status === 1) toast.success("Flag successful! The content has been removed. The author can appeal the flag.");
            else toast.error("Bad flag. The content does not violate the constitution. You have lost reputation points.");
          } catch(e) { console.error(e); }
          await new Promise(resolve => setTimeout(resolve, 2000));
          refreshData();
        }
      }
    )
  };

  const handleAppealComment = async (commentId: number) => {
    if (!mounted || !isConnected) return;
    await execute(
      FORUM_ADDRESS,
      "appeal_comment",
      [BigInt(commentId)],
      {
        confirmingMessage: "Submitting appeal...",
        submittedMessage: "GenVM is reviewing your appeal...",
        confirmedMessage: "Appeal process complete!",
        syncRequests: [{ entityType: 'comment', entityId: commentId, currentState: (() => {
          const c = comments.find(c => c.id === commentId);
          return c ? { flag_count: c.flag_count, status: c.status } : undefined;
        })() }, { entityType: 'user_activity', entityId: address as string }],
          onConfirmed: async () => {
            if (typeof triggerCooldown !== 'undefined') if (typeof triggerCooldown !== 'undefined') triggerCooldown();
            try {
              const response = await fetchApi(`/api/posts/${post.id}/comments/`);
              const data = await response.json();
              const target = data.find((c: any) => c.id === commentId);
              if (target && target.status === 2) toast.success("Appeal successful! The content has been restored.");
              else if (target && target.status === 3) toast.error("Appeal denied. The content remains removed and you have lost reputation points.");
            } catch(e) { console.error(e); }
            await new Promise(resolve => setTimeout(resolve, 2000));
            refreshData();
          }
      }
    )
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-8 pt-32">
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!post) return <div className="text-center py-20">Post not found.</div>;

  const postIsRemoved = post.status === 1;
  const postIsRestored = post.status === 2;
  const postIsAppealDenied = post.status === 3;
  const postIsAuthor = mounted && address?.toLowerCase() === post.author.toLowerCase();
  const postIsHidden = postIsRemoved || postIsAppealDenied;

  if (postIsAppealDenied) return <div className="text-center py-20">Post not found.</div>;
  if (postIsRemoved && !postIsAuthor) return <div className="text-center py-20">Post not found.</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 pt-24">
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

      {/* Original Post */}
      <Card className="bg-[#130E26] border border-[#291F4A] shadow-lg overflow-hidden rounded-2xl relative z-10">
        {postIsHidden && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center">
            <ShieldAlert className="w-12 h-12 text-destructive mb-4 opacity-80" />
            <h3 className="font-bold text-lg text-foreground mb-2">Post Removed</h3>
            <p className="text-sm text-muted-foreground line-clamp-3 mb-6">
              {post.moderation_verdict || "This post violates the hub's constitution."}
            </p>
            
            {!post.appeal_used && (
              <div className="flex flex-col items-center gap-2 z-30 w-full max-w-sm mx-auto mt-2">
                <Button 
                  variant="outline" 
                  className="w-full bg-primary/10 border-primary text-primary hover:bg-primary hover:text-white transition-colors h-12 text-lg font-bold shadow-[0_0_20px_rgba(var(--primary),0.4)]"
                  onClick={handleAppealPost} 
                  disabled={isLocked || (post.appeal_deadline ? currentTime >= post.appeal_deadline : false)}
                >
                  {isLocked ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <AlertTriangle className="w-5 h-5 mr-2" />}
                  Appeal Decision
                </Button>
                <span className={`text-sm font-medium transition-colors ${
                  post.appeal_deadline && currentTime >= post.appeal_deadline 
                    ? 'text-red-500 bg-red-500/10 px-4 py-1.5 rounded-full' 
                    : 'text-white/90'
                }`}>
                  {post.appeal_deadline ? (currentTime < post.appeal_deadline ? formatTimeRemaining(post.appeal_deadline) : 'Expired') : ''}
                </span>
              </div>
            )}
            {post.appeal_used && (
              <Badge variant="outline" className="text-muted-foreground z-30">
                Appeal already requested
              </Badge>
            )}
          </div>
        )}

        <CardHeader className="pt-6 px-6 relative z-10">
          <div className="flex items-center justify-between mb-4">
            {community ? (
              <Link href={`/community/${community.id}`}>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold uppercase tracking-wider hover:bg-primary/30 transition-colors">
                  {community.name}
                </span>
              </Link>
            ) : (
              <div className="h-6 w-24 bg-[#1C1635] animate-pulse rounded-full" />
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
              {post.author.slice(2, 4).toUpperCase()}
            </div>
            <div>
              <div className="font-mono text-foreground font-medium flex items-center gap-2">
                {post.author.slice(0, 6)}...{post.author.slice(-4)}
                {postIsRestored && (
                  <Badge variant="outline" className="border-green-500/30 text-green-500 bg-green-500/10 text-[10px] px-1.5 py-0">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Restored
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <Clock className="w-3.5 h-3.5" />
                {new Date(Number(post.created_at) * 1000).toLocaleString()}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-3 relative z-10">
          <p className="text-lg text-foreground leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
        </CardContent>
        {(!postIsAuthor && post.status === 0) && (
          <CardFooter className="px-6 py-3 border-t border-[#291F4A] bg-black/10 flex justify-end">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground hover:text-destructive disabled:opacity-100 disabled:cursor-not-allowed"
              onClick={handleFlagPost}
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
          </CardFooter>
        )}
      </Card>

      {/* Comments Section */}
      <section className="space-y-8 relative">
        <div className="flex items-center gap-3 border-b border-[#291F4A] pb-4">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h3 className="text-2xl font-bold text-foreground">Comments</h3>
          <span className="bg-surface border border-border/40 px-3 py-1 rounded-full text-sm font-medium ml-auto">
            {comments.filter(c => c.status !== 3 && !(c.status === 1 && currentTime >= c.appeal_deadline) && !(c.status === 1 && c.author.toLowerCase() !== address?.toLowerCase())).length}
          </span>
        </div>

        {/* Comment Form */}
        {mounted && isConnected ? (
          <form
            onSubmit={handleCommentSubmit}
            className="bg-transparent border border-[#291F4A] p-3 rounded-2xl relative shadow-inner"
          >
            <Textarea
              placeholder="Post a reply..."
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              className="min-h-[100px] bg-transparent border-none focus-visible:ring-0 resize-none text-foreground p-2 mb-12 placeholder:text-muted-foreground/70"
              disabled={isLocked}
            />
            <div className="absolute bottom-4 right-4">
              <Button
                type="submit"
                className="rounded-full shadow-lg h-9 px-5 font-semibold bg-primary hover:bg-primary/90 text-white"
                disabled={isLocked || !commentContent}
              >
                {isLocked ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Reply"
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="bg-transparent border border-[#291F4A] p-6 rounded-2xl text-center">
            <p className="text-muted-foreground mb-4">
              Connect your wallet to join the conversation.
            </p>
            <Button
              disabled
              className="rounded-full bg-[#1C1635] text-muted-foreground border-none"
            >
              Connect Wallet
            </Button>
          </div>
        )}

        {/* Comments List */}
        <div className="relative pl-10 space-y-4">
          {comments.filter(c => c.status !== 3 && !(c.status === 1 && currentTime >= c.appeal_deadline) && !(c.status === 1 && c.author.toLowerCase() !== address?.toLowerCase())).length > 0 && (
            <div className="absolute left-4 top-[24px] bottom-8 w-[2px] bg-gradient-to-b from-[#291F4A] to-transparent z-0" />
          )}

          {comments.filter(comment => {
            if (comment.status === 3) return false;
            if (comment.status === 1 && currentTime >= comment.appeal_deadline) return false;
            if (comment.status === 1 && (!mounted || address?.toLowerCase() !== comment.author.toLowerCase())) return false;
            return true;
          }).map((comment) => {
            const isRemoved = comment.status === 1;
            const isRestored = comment.status === 2;
            const isAppealDenied = comment.status === 3;
            const isHidden = isRemoved || isAppealDenied;
            const isAuthor = mounted && address?.toLowerCase() === comment.author.toLowerCase();

            if (isAppealDenied) { router.push('/'); return null; }
            if (isRemoved && !isAuthor) return null;

            return (
              <div key={comment.id} className="relative z-10 flex gap-4">
                <div className="absolute -left-6 top-6 w-6 h-[2px] bg-[#291F4A] z-20" />
                <div className="absolute -left-[26px] top-[22px] w-[6px] h-[6px] rounded-full bg-[#291F4A] z-30" />

                <Card className="flex-1 bg-transparent border border-[#291F4A]/50 rounded-xl shadow-none hover:border-[#3D2E70] transition-all relative overflow-hidden [--card-spacing:0px]">
                  
                  {isHidden && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4 text-center">
                      <ShieldAlert className="w-8 h-8 text-destructive mb-2 opacity-80" />
                      <h4 className="font-bold text-sm text-foreground mb-1">Comment Removed</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {comment.moderation_verdict}
                      </p>
                      
                      {!comment.appeal_used && (
                        <div className="flex flex-col items-center gap-2 z-30 w-full max-w-[200px] mx-auto mt-2">
                          <Button 
                            variant="outline" size="sm"
                            className="w-full bg-primary/10 border-primary text-primary hover:bg-primary hover:text-white transition-colors h-9 text-sm font-semibold shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                            onClick={() => handleAppealComment(comment.id)} 
                            disabled={isLocked || currentTime >= comment.appeal_deadline}
                          >
                            {isLocked ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                            Appeal Decision
                          </Button>
                          <span className={`text-[11px] font-medium transition-colors ${
                            currentTime >= comment.appeal_deadline 
                              ? 'text-red-500 bg-red-500/10 px-3 py-1 rounded-full' 
                              : 'text-white/90'
                          }`}>
                            {currentTime < comment.appeal_deadline ? formatTimeRemaining(comment.appeal_deadline) : 'Expired'}
                          </span>
                        </div>
                      )}
                      {comment.appeal_used && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground z-30">
                          Appealing
                        </Badge>
                      )}
                    </div>
                  )}

                  <CardHeader className="pt-1.5 px-2.5 pb-0 border-b border-[#291F4A]/20">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-[#1C1635] flex items-center justify-center text-primary font-bold text-[10px]">
                          {comment.author.slice(2, 4).toUpperCase()}
                        </div>
                        <div className="text-sm font-mono text-muted-foreground font-medium flex items-center gap-2">
                          {comment.author.slice(0, 6)}...{comment.author.slice(-4)}
                          {isRestored && (
                            <Badge variant="outline" className="border-green-500/30 text-green-500 bg-green-500/10 text-[10px] px-1 py-0 h-4">
                              Restored
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-transparent">
                        <Clock className="w-3 h-3 text-primary/70" />
                        {new Date(
                          Number(comment.created_at) * 1000,
                        ).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-2.5 pb-2 pt-1">
                    <p className="text-foreground/90 leading-snug whitespace-pre-wrap text-[13px]">
                      {comment.content}
                    </p>
                  </CardContent>
                  
                  {(!isAuthor && comment.status === 0) && (
                    <div className="flex justify-end px-2 pb-1 text-xs bg-black/10">
                      <button
                        className="text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors disabled:cursor-not-allowed disabled:opacity-100"
                        onClick={() => handleFlagComment(comment.id)}
                        disabled={isLocked || isCooldownActive}
                      >
                        {isLocked ? (
                          <Loader2 className="w-3 h-3 animate-spin opacity-50" />
                        ) : (
                          <Flag className={`w-3 h-3 ${isCooldownActive ? 'opacity-50' : ''}`} />
                        )}
                        <span className={isCooldownActive ? 'text-primary' : ''}>
                          {isCooldownActive ? cooldownTimeRemaining : 'Flag'}
                        </span>
                      </button>
                    </div>
                  )}
                </Card>
              </div>
            );
          })}
          {comments.filter(c => c.status !== 3 && !(c.status === 1 && currentTime >= c.appeal_deadline) && !(c.status === 1 && c.author.toLowerCase() !== address?.toLowerCase())).length === 0 && (
            <div className="text-center py-10 bg-transparent border border-[#291F4A] border-dashed rounded-2xl">
              <p className="text-muted-foreground">
                No comments yet. Be the first to reply!
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
