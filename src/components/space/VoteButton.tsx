import { useState } from 'react'
import { ThumbsUp } from 'lucide-react'
import { useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'

interface VoteButtonProps {
  noteId: string
  count: number
  voted: boolean
}

export function VoteButton({ noteId, count, voted }: VoteButtonProps) {
  const toast = useToast()
  const [isBusy, setIsBusy] = useState(false)

  async function toggle(event: React.MouseEvent) {
    // Cards are links, so the click must not also open the note
    event.preventDefault()
    event.stopPropagation()
    setIsBusy(true)
    const result = await callAction('toggleVote', { noteId })
    setIsBusy(false)
    if (!result.success) toast.error('Could not vote', result.error)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isBusy}
      aria-pressed={voted}
      aria-label={voted ? 'Remove my helpful vote' : 'Mark as helpful'}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${
        voted ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-secondary'
      }`}
    >
      <ThumbsUp className="size-3.5" aria-hidden="true" />
      {count}
    </button>
  )
}
