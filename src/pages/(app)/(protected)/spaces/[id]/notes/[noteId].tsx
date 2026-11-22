import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Lock, NotebookPen, Pencil, Star, Trash2, Users } from 'lucide-react'
import { useMutations, useQuery } from 'deepspace'
import { Badge, Button, ConfirmModal, EmptyState, Input, Label, Textarea, useToast } from '@/components/ui'
import { PinCard } from '@/components/space/PinCard'
import { VoteButton } from '@/components/space/VoteButton'
import { callAction, fetchSpaceFile } from '@/lib/actions'
import { isStaff, parseTags, type AnnotationData, type NoteData, type PinKind } from '@/lib/space'
import { useSpace } from '@/lib/use-space'
import { useSpacePresence } from '@/lib/use-space-presence'

export default function NotePage() {
  const { id: spaceId = '', noteId = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { members, myRole, myUserId, isLoading } = useSpace(spaceId)
  const notesQuery = useQuery<NoteData>('notes', { where: { spaceId } })
  const commentsQuery = useQuery<AnnotationData>('annotations', { where: { targetId: noteId } })
  const votesQuery = useQuery<{ noteId: string; userId: string }>('votes', { where: { noteId } })
  const { put, ready } = useMutations<NoteData>('notes')
  const note = notesQuery.records.find(
    (n) => n.recordId === noteId && (!!n.data.sharedTeamId || n.createdBy === myUserId),
  )
  useSpacePresence(spaceId, { view: note ? `Note: ${note.data.title}` : 'Notes library' })

  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [comment, setComment] = useState('')
  const [commentKind, setCommentKind] = useState<PinKind>('note')
  const [isBusy, setIsBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading || notesQuery.status === 'loading') {
    return <p className="px-6 py-10 text-sm text-muted-foreground">Loading…</p>
  }

  // Someone else's private note never reaches this browser, so it reads as missing
  if (!note) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <EmptyState
          icon={<NotebookPen />}
          title="Note not found"
          description="It may have been deleted, made private, or you're not in this space."
          className="rounded-xl border border-dashed border-border"
        />
        <Link to={`/spaces/${spaceId}?tab=notes`} className="mt-6 inline-block text-sm text-primary hover:underline">
          Back to the notes
        </Link>
      </div>
    )
  }

  const isMine = note.createdBy === myUserId
  const isShared = !!note.data.sharedTeamId
  const canModerate = isStaff(myRole) && isShared
  const tagList = parseTags(note.data.tags)
  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.name ?? 'Former member'
  const comments = [...commentsQuery.records].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  function startEdit() {
    if (!note) return
    setTitle(note.data.title)
    setBody(note.data.body)
    setTags(tagList.join(', '))
    setIsEditing(true)
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanTags = [
      ...new Set(tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)),
    ].slice(0, 10)
    setIsBusy(true)
    try {
      // Authors edit directly; the 'own' rule and writableFields keep sharing and featured out of reach
      await put(noteId, { title: title.trim(), body: body.trim(), tags: JSON.stringify(cleanTags) })
      setIsEditing(false)
    } catch {
      toast.error('Could not save the note')
    } finally {
      setIsBusy(false)
    }
  }

  async function toggleShared() {
    setIsBusy(true)
    const result = await callAction('setNoteShared', { noteId, shared: !isShared })
    setIsBusy(false)
    if (!result.success) toast.error('Could not change sharing', result.error)
    else toast.success(isShared ? 'Note is now private' : 'Note shared with the space')
  }

  async function toggleFeatured() {
    setIsBusy(true)
    const result = await callAction('setFeatured', { noteId, featured: !note?.data.featured })
    setIsBusy(false)
    if (!result.success) toast.error('Could not update it', result.error)
  }

  async function handleDelete() {
    setIsBusy(true)
    const result = await callAction('deleteNote', { noteId })
    setIsBusy(false)
    setConfirmDelete(false)
    if (!result.success) {
      toast.error('Could not delete the note', result.error)
      return
    }
    toast.success('Note deleted')
    navigate(`/spaces/${spaceId}?tab=notes`)
  }

  async function openAttachment() {
    try {
      const blob = await fetchSpaceFile('notes', noteId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = note?.data.fileName || 'attachment'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (err) {
      toast.error('Could not open the attachment', (err as Error).message)
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsBusy(true)
    const result = await callAction('addPin', {
      targetType: 'note',
      targetId: noteId,
      kind: commentKind,
      text: comment,
    })
    setIsBusy(false)
    if (!result.success) {
      toast.error('Could not post the comment', result.error)
      return
    }
    setComment('')
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <Link
        to={`/spaces/${spaceId}?tab=notes`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to the notes
      </Link>

      {isEditing ? (
        <form onSubmit={saveEdit} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-body">Note</Label>
            <Textarea id="edit-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={20000} rows={10} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-tags">Tags (comma separated)</Label>
            <Input id="edit-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={isBusy} disabled={!ready}>
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <article className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-primary">{note.data.title}</h1>
              <Badge variant="secondary" size="sm">
                {isShared ? <Users className="size-3" /> : <Lock className="size-3" />}
                {isShared ? 'Shared' : 'Private'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              By {isMine ? 'you' : nameOf(note.createdBy)} · {new Date(note.createdAt).toLocaleDateString()}
            </p>
            {tagList.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tagList.map((tag) => (
                  <Badge key={tag} variant="secondary" size="sm">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </header>
          {note.data.body && <p className="whitespace-pre-wrap break-words">{note.data.body}</p>}
          {note.data.fileName && (
            <Button variant="outline" size="sm" className="self-start" onClick={openAttachment}>
              <Download className="size-4" aria-hidden="true" />
              {note.data.fileName}
            </Button>
          )}
          {isShared && (
            <div className="flex items-center gap-2">
              <VoteButton
                noteId={noteId}
                count={votesQuery.records.length}
                voted={votesQuery.records.some((v) => v.data.userId === myUserId)}
              />
              <span className="text-xs text-muted-foreground">found this helpful</span>
            </div>
          )}
          {(isMine || canModerate) && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {canModerate && (
                <Button variant="outline" size="sm" onClick={toggleFeatured} loading={isBusy}>
                  <Star className="size-4" aria-hidden="true" />
                  {note.data.featured ? 'Unfeature' : 'Feature'}
                </Button>
              )}
              {isMine && (
                <>
                  <Button variant="outline" size="sm" onClick={startEdit}>
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={toggleShared} loading={isBusy}>
                    {isShared ? <Lock className="size-4" /> : <Users className="size-4" />}
                    {isShared ? 'Make private' : 'Share with the space'}
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </Button>
            </div>
          )}
        </article>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Comments and questions ({comments.length})</h2>
        {comments.length > 0 && (
          <ul className="flex flex-col gap-2">
            {comments.map((c) => (
              <PinCard
                key={c.recordId}
                pin={c}
                authorName={nameOf(c.createdBy)}
                isMine={c.createdBy === myUserId}
                canModerate={canModerate}
              />
            ))}
          </ul>
        )}
        <form onSubmit={addComment} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <Textarea
            aria-label="Comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={isShared ? 'Add a comment or question' : 'Only you can see comments on a private note'}
            required
          />
          <div className="flex items-center gap-2">
            <select
              aria-label="Comment type"
              value={commentKind}
              onChange={(e) => setCommentKind(e.target.value as PinKind)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="note">Comment</option>
              <option value="question">Question</option>
            </select>
            <Button type="submit" size="sm" loading={isBusy}>
              Post
            </Button>
          </div>
        </form>
      </section>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={isBusy}
        title="Delete this note?"
        description="The note, its attachment and its comments are removed for everyone."
        confirmText="Delete"
      />
    </div>
  )
}
