'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PenSquare, Loader2 } from 'lucide-react'
import { useTransaction } from '@/hooks/useTransaction'

const FORUM_ADDRESS = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}`

interface CreatePostDialogProps {
  communityId: number;
}

export function CreatePostDialog({ communityId }: CreatePostDialogProps) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')

  const { execute, isLocked } = useTransaction()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!content) return

    await execute(
      FORUM_ADDRESS,
      'create_post',
      [communityId, content],
      {
        syncRequests: [
          { entityType: "community", entityId: communityId }
        ],
        confirmingMessage: 'Please sign the transaction...',
        submittedMessage: 'Validating with GenVM...',
        confirmedMessage: 'Post published successfully!',
        onConfirmed: () => {
          setOpen(false)
          setContent('')
          window.location.reload()
        }
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/40 font-semibold h-11 px-6" />
        }
      >
        <PenSquare className="w-5 h-5 mr-2" />
        Create Post
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            New Post
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Share your thoughts. GenVM will verify this post against the hub&apos;s constitution.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <label htmlFor="content" className="text-sm font-medium text-foreground">
              Content
            </label>
            <Textarea
              id="content"
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isLocked}
              className="min-h-[150px] bg-surface/50 border-border/50 focus-visible:ring-primary resize-none"
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
              'Publish Post'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
