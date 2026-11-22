import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Lock, NotebookPen, Paperclip, Plus, Star, Users } from 'lucide-react'
import { useQuery, useR2Files } from 'deepspace'
import { Badge, Button, Checkbox, EmptyState, Input, Label, Modal, SearchInput, Textarea, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { parseTags, type NoteData } from '@/lib/space'
import type { SpaceMember } from '@/lib/use-space'
import { VoteButton } from './VoteButton'

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const ATTACHMENT_TYPES = 'application/pdf,image/png,image/jpeg,text/plain'

type Sort = 'newest' | 'oldest' | 'title' | 'helpful'
type Scope = 'all' | 'shared' | 'mine'

interface NotesPanelProps {
  spaceId: string
  myUserId: string | null
  members: SpaceMember[]
}

export function NotesPanel({ spaceId, myUserId, members }: NotesPanelProps) {
  // Shared notes in this space plus my private ones; the server filters out everyone else's private notes
  const notesQuery = useQuery<NoteData>('notes', { where: { spaceId } })
  const commentsQuery = useQuery<{ targetId: string }>('annotations', {
    where: { teamId: spaceId, targetType: 'note' },
  })
  const votesQuery = useQuery<{ noteId: string; userId: string }>('votes', { where: { teamId: spaceId } })
  const [search, setSearch] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [sort, setSort] = useState<Sort>('newest')
  const [scope, setScope] = useState<Scope>('all')
  const [isCreating, setIsCreating] = useState(false)

  // App admins can read every row, so private notes are also filtered to their author here
  const notes = notesQuery.records
    .filter((n) => !!n.data.sharedTeamId || n.createdBy === myUserId)
    .map((n) => {
      const votes = votesQuery.records.filter((v) => v.data.noteId === n.recordId)
      return {
        ...n,
        tagList: parseTags(n.data.tags),
        voteCount: votes.length,
        votedByMe: votes.some((v) => v.data.userId === myUserId),
      }
    })
  const allTags = [...new Set(notes.flatMap((n) => n.tagList))].sort()

  const needle = search.trim().toLowerCase()
  const visible = notes
    .filter((n) => (scope === 'shared' ? !!n.data.sharedTeamId : scope === 'mine' ? n.createdBy === myUserId : true))
    .filter((n) => activeTags.every((t) => n.tagList.includes(t)))
    .filter((n) => !needle || `${n.data.title} ${n.data.body}`.toLowerCase().includes(needle))
    .sort((a, b) => {
      // Featured notes always stay at the top
      const featured = Number(!!b.data.featured) - Number(!!a.data.featured)
      if (featured !== 0) return featured
      if (sort === 'title') return a.data.title.localeCompare(b.data.title)
      if (sort === 'oldest') return a.createdAt.localeCompare(b.createdAt)
      if (sort === 'helpful' && a.voteCount !== b.voteCount) return b.voteCount - a.voteCount
      return b.createdAt.localeCompare(a.createdAt)
    })

  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.name ?? 'Former member'
  const toggleTag = (tag: string) =>
    setActiveTags((tags) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]))

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes"
          aria-label="Search notes"
          className="sm:max-w-xs"
        />
        <select
          aria-label="Which notes"
          value={scope}
          onChange={(e) => setScope(e.target.value as Scope)}
          className="rounded-md border border-input bg-background px-2 py-2 text-sm"
        >
          <option value="all">All I can see</option>
          <option value="shared">Shared with the space</option>
          <option value="mine">Mine</option>
        </select>
        <select
          aria-label="Sort notes"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-md border border-input bg-background px-2 py-2 text-sm"
        >
          <option value="newest">Newest first</option>
          <option value="helpful">Most helpful</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title A–Z</option>
        </select>
        <Button className="sm:ml-auto" onClick={() => setIsCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          New note
        </Button>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Filter by tag">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={activeTags.includes(tag)}
              onClick={() => toggleTag(tag)}
              className={`rounded-full border px-3 py-1 text-xs ${
                activeTags.includes(tag)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card hover:bg-secondary'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {notesQuery.status === 'loading' ? (
        <p className="text-sm text-muted-foreground">Loading notes…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<NotebookPen />}
          title={notes.length === 0 ? 'No notes yet' : 'No notes match'}
          description={
            notes.length === 0
              ? 'Write a note, keep it private or share it with the space.'
              : 'Try clearing the search or tag filters.'
          }
          className="rounded-xl border border-dashed border-border"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((note) => {
            const comments = commentsQuery.records.filter((c) => c.data.targetId === note.recordId).length
            return (
              <li key={note.recordId}>
                <Link
                  to={`/spaces/${spaceId}/notes/${note.recordId}`}
                  className={`flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-shadow hover:shadow-[var(--shadow-card-hover)] ${
                    note.data.featured ? 'border-[var(--pin)]' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-primary">
                      {!!note.data.featured && (
                        <Star className="mr-1 inline size-4 fill-[var(--pin)] text-[var(--pin)]" aria-label="Featured" />
                      )}
                      {note.data.title}
                    </h3>
                    {note.data.sharedTeamId ? (
                      <Users className="size-4 shrink-0 text-muted-foreground" aria-label="Shared" />
                    ) : (
                      <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="Private" />
                    )}
                  </div>
                  {note.data.body && (
                    <p className="line-clamp-3 text-sm whitespace-pre-wrap text-muted-foreground">{note.data.body}</p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                    {!!note.data.sharedTeamId && (
                      <VoteButton noteId={note.recordId} count={note.voteCount} voted={note.votedByMe} />
                    )}
                    <span>{note.createdBy === myUserId ? 'You' : nameOf(note.createdBy)}</span>
                    {note.data.fileName && <Paperclip className="size-3" aria-label="Has attachment" />}
                    {comments > 0 && <span>· {comments} comments</span>}
                    {note.tagList.map((tag) => (
                      <Badge key={tag} variant="secondary" size="sm">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <NewNoteModal spaceId={spaceId} open={isCreating} onClose={() => setIsCreating(false)} />
    </section>
  )
}

function NewNoteModal({ spaceId, open, onClose }: { spaceId: string; open: boolean; onClose: () => void }) {
  const toast = useToast()
  const { upload } = useR2Files()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [shared, setShared] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function reset() {
    setTitle('')
    setBody('')
    setTags('')
    setShared(true)
    setFile(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      toast.error('Attachments can be up to 10 MB')
      return
    }
    setIsSaving(true)
    let fileKey = ''
    if (file) {
      const uploaded = await upload(file, file.name)
      if (!uploaded.success || !uploaded.key) {
        setIsSaving(false)
        toast.error('Upload failed', uploaded.error)
        return
      }
      fileKey = uploaded.key
    }
    const result = await callAction('createNote', {
      spaceId,
      title,
      body,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      shared,
      fileKey,
      fileName: file?.name ?? '',
    })
    setIsSaving(false)
    if (!result.success) {
      toast.error('Could not save the note', result.error)
      return
    }
    toast.success(shared ? 'Note shared with the space' : 'Private note saved')
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Modal.Header>
          <Modal.Title>New note</Modal.Title>
        </Modal.Header>
        <Modal.Body className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="note-title">Title</Label>
            <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="note-body">Note</Label>
            <Textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={20000} rows={8} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="note-tags">Tags (comma separated)</Label>
            <Input id="note-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="midterm, chapter-3" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="note-file">Attachment (optional, up to 10 MB)</Label>
            <input
              id="note-file"
              type="file"
              accept={ATTACHMENT_TYPES}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={shared} onCheckedChange={(v) => setShared(v === true)} />
            Share with everyone in this space
          </label>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            Save note
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
