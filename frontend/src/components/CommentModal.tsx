'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { useTransaction } from '@/hooks/useTransaction'
import { useApi } from '@/hooks/useApi'

const FORUM_ADDRESS = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}`

interface CommentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: number;
  postAuthor: string;
  postContent: string;
  onCommentAdded?: () => void;
}

export function CommentModal({ open, onOpenChange, postId, postAuthor, postContent, onCommentAdded }: CommentModalProps) {
  const [content, setContent] = useState('')
  const { execute, isLocked } = useTransaction()
  const { fetchApi } = useApi()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!content) return

    await execute(
      FORUM_ADDRESS,
      'create_comment',
      [BigInt(postId), content],
      {
        confirmingMessage: 'Please sign the transaction...',
        submittedMessage: 'Validating comment with GenVM...',
        confirmedMessage: 'Comment added successfully!',
        onConfirmed: async () => {
          try {
            await fetchApi("/api/indexer/latest-comment/", { method: "POST" })
          } catch (e) {
            console.error("Failed to sync latest comment", e)
          }
          onOpenChange(false)
          setContent('')
          await new Promise(resolve => setTimeout(resolve, 2000));
          if (onCommentAdded) {
            onCommentAdded();
          }
        }
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Reply to Post
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            GenVM will verify this comment against the hub&apos;s constitution.
          </DialogDescription>
        </DialogHeader>

        {/* Original Post Context */}
        <div className="mt-4 p-4 rounded-xl bg-surface/30 border border-border/40 text-sm">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">
              {postAuthor.slice(0, 6)}...{postAuthor.slice(-4)}
            </span>
          </div>
          <p className="text-foreground line-clamp-3 italic opacity-80 border-l-2 border-primary/30 pl-3">
            &quot;{postContent}&quot;
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Textarea
              id="content"
              placeholder="Write your reply..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isLocked}
              className="min-h-[120px] bg-surface/50 border-border/50 focus-visible:ring-primary resize-none"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-11 font-semibold rounded-full" 
            disabled={isLocked || !content}
          >
            {isLocked ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Validating with GenVM...
              </>
            ) : (
              'Post Reply'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
