import { useState } from 'react'
import { Check, HelpCircle, Pencil, StickyNote, Trash2, Undo2 } from 'lucide-react'
import type { RecordData } from 'deepspace'
import { useMutations } from 'deepspace'
import { Badge, Button, Textarea, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import type { AnnotationData } from '@/lib/space'

interface PinCardProps {
  pin: RecordData<AnnotationData>
  index?: number
  authorName: string
  isMine: boolean
  canModerate: boolean
  highlighted?: boolean
  onSelect?: () => void
}

export function PinCard({ pin, index, authorName, isMine, canModerate, highlighted, onSelect }: PinCardProps) {
  const toast = useToast()
  const { put, ready } = useMutations<AnnotationData>('annotations')
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(pin.data.text)
  const [isBusy, setIsBusy] = useState(false)
  const isQuestion = pin.data.kind === 'question'
  const resolved = !!pin.data.resolved

  async function saveEdit() {
    const text = draft.trim()
    if (!text || text.length > 1000) return
    setIsBusy(true)
    try {
      // Authors edit their own text directly; the 'own' rule and writableFields guard it
      await put(pin.recordId, { text })
      setIsEditing(false)
    } catch {
      toast.error('Could not save the edit')
    } finally {
      setIsBusy(false)
    }
  }

  async function run(action: string, params: Record<string, unknown>, failure: string) {
    setIsBusy(true)
    const result = await callAction(action, params)
    setIsBusy(false)
    if (!result.success) toast.error(failure, result.error)
  }

  return (
    <li
      className={`flex flex-col gap-2 rounded-lg border p-3 text-sm ${highlighted ? 'border-[var(--pin)] bg-accent/40' : 'border-border bg-card'}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        {index !== undefined && (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--pin)] text-[10px] font-bold text-black">
            {index}
          </span>
        )}
        {isQuestion ? (
          <HelpCircle className="size-4 text-primary" aria-hidden="true" />
        ) : (
          <StickyNote className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{authorName}</span>
        {isQuestion && (
          <Badge variant={resolved ? 'secondary' : 'default'} size="sm">
            {resolved ? 'Resolved' : 'Open'}
          </Badge>
        )}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} rows={3} />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit} loading={isBusy} disabled={!ready}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words">{pin.data.text}</p>
      )}

      {!isEditing && (isMine || canModerate) && (
        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {isQuestion && canModerate && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => run('resolvePin', { pinId: pin.recordId, resolved: !resolved }, 'Could not update it')}
            >
              {resolved ? <Undo2 className="size-4" /> : <Check className="size-4" />}
              {resolved ? 'Reopen' : 'Resolve'}
            </Button>
          )}
          {isMine && (
            <Button size="sm" variant="ghost" onClick={() => { setDraft(pin.data.text); setIsEditing(true) }}>
              <Pencil className="size-4" />
              Edit
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={isBusy}
            onClick={() => run('removePin', { pinId: pin.recordId }, 'Could not delete it')}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      )}
    </li>
  )
}
