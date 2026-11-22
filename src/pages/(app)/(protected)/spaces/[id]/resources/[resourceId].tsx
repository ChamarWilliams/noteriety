import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, HelpCircle, StickyNote } from 'lucide-react'
import { useQuery } from 'deepspace'
import { Button, EmptyState, Textarea, useToast } from '@/components/ui'
import { PdfPage } from '@/components/space/PdfPage'
import { PinCard } from '@/components/space/PinCard'
import { callAction, fetchSpaceFile } from '@/lib/actions'
import { openPdf, type PdfDocument } from '@/lib/pdf'
import { isStaff, type AnnotationData, type PinKind, type ResourceData } from '@/lib/space'
import { useSpace } from '@/lib/use-space'
import { useSpacePresence } from '@/lib/use-space-presence'

type Filter = 'all' | 'questions' | 'open'

export default function ResourceViewerPage() {
  const { id: spaceId = '', resourceId = '' } = useParams()
  const toast = useToast()
  const { members, myRole, myUserId, isLoading } = useSpace(spaceId)
  const resourcesQuery = useQuery<ResourceData>('resources', { where: { teamId: spaceId } })
  const pinsQuery = useQuery<AnnotationData>('annotations', { where: { targetId: resourceId } })
  const resource = resourcesQuery.records.find((r) => r.recordId === resourceId)

  const [pdf, setPdf] = useState<PdfDocument | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [mode, setMode] = useState<PinKind | null>(null)
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null)
  const [draftText, setDraftText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [selectedPin, setSelectedPin] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const { here } = useSpacePresence(spaceId, { view: resource?.data.title, page, resourceId })
  const viewers = members.filter((m) => here.get(m.userId)?.resourceId === resourceId)

  // The PDF loads once the resource record confirms I can see it
  const hasResource = !!resource
  useEffect(() => {
    if (!hasResource) return
    let cancelled = false
    let doc: PdfDocument | null = null
    fetchSpaceFile('resources', resourceId)
      .then(openPdf)
      .then((opened) => {
        doc = opened
        if (cancelled) void opened.destroy()
        else setPdf(opened)
      })
      .catch((err: Error) => !cancelled && setLoadError(err.message))
    return () => {
      cancelled = true
      void doc?.destroy()
    }
  }, [hasResource, resourceId])

  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.name ?? 'Former member'
  const canModerate = isStaff(myRole)
  const allPins = [...pinsQuery.records].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const pagePins = allPins.filter((p) => p.data.page === page)
  const listedPins = pagePins.filter((p) =>
    filter === 'all'
      ? true
      : filter === 'questions'
        ? p.data.kind === 'question'
        : p.data.kind === 'question' && !p.data.resolved,
  )
  const pinNumber = new Map(pagePins.map((p, i) => [p.recordId, i + 1]))

  function goToPage(next: number) {
    if (!pdf) return
    setPage(Math.min(Math.max(next, 1), pdf.numPages))
    setDraft(null)
    setSelectedPin(null)
  }

  async function handleAddPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || !mode) return
    setIsSaving(true)
    const result = await callAction('addPin', {
      targetType: 'resource',
      targetId: resourceId,
      page,
      x: draft.x,
      y: draft.y,
      kind: mode,
      text: draftText,
    })
    setIsSaving(false)
    if (!result.success) {
      toast.error('Could not add the pin', result.error)
      return
    }
    setDraft(null)
    setDraftText('')
    setMode(null)
  }

  if (isLoading || resourcesQuery.status === 'loading') {
    return <p className="px-6 py-10 text-sm text-muted-foreground">Loading…</p>
  }

  if (!resource) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <EmptyState
          icon={<FileText />}
          title="Resource not found"
          description="It may have been deleted, or you're not in this space."
          className="rounded-xl border border-dashed border-border"
        />
        <Link to={`/spaces/${spaceId}`} className="mt-6 inline-block text-sm text-primary hover:underline">
          Back to the space
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/spaces/${spaceId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the space
        </Link>
        {viewers.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Also here:{' '}
            {viewers.map((v) => `${v.name} (p. ${here.get(v.userId)?.page ?? '?'})`).join(', ')}
          </p>
        )}
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-primary">{resource.data.title}</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => goToPage(page - 1)} disabled={!pdf || page <= 1}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Prev
            </Button>
            <span className="text-sm tabular-nums">
              Page {page} of {pdf?.numPages ?? '…'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={!pdf || page >= pdf.numPages}
            >
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
            <span className="mx-2 h-5 w-px bg-border" />
            <Button
              size="sm"
              variant={mode === 'note' ? 'default' : 'outline'}
              onClick={() => { setMode(mode === 'note' ? null : 'note'); setDraft(null) }}
            >
              <StickyNote className="size-4" aria-hidden="true" />
              Pin a note
            </Button>
            <Button
              size="sm"
              variant={mode === 'question' ? 'default' : 'outline'}
              onClick={() => { setMode(mode === 'question' ? null : 'question'); setDraft(null) }}
            >
              <HelpCircle className="size-4" aria-hidden="true" />
              Ask a question
            </Button>
          </div>
          {mode && !draft && (
            <p className="text-sm text-muted-foreground">Click a spot on the page to place it.</p>
          )}

          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : !pdf ? (
            <p className="text-sm text-muted-foreground">Loading the PDF…</p>
          ) : (
            <PdfPage pdf={pdf} pageNumber={page} onPageClick={mode ? (x, y) => setDraft({ x, y }) : undefined}>
              {pagePins.map((pin) => (
                <button
                  key={pin.recordId}
                  type="button"
                  aria-label={`Pin ${pinNumber.get(pin.recordId)}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedPin(pin.recordId) }}
                  className={`absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold shadow ${
                    pin.data.kind === 'question' && !pin.data.resolved
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-[var(--pin)] text-black'
                  } ${selectedPin === pin.recordId ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                  style={{ left: `${pin.data.x * 100}%`, top: `${pin.data.y * 100}%` }}
                >
                  {pinNumber.get(pin.recordId)}
                </button>
              ))}
              {draft && (
                <span
                  className="absolute size-6 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-dashed border-primary bg-primary/20"
                  style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}
                />
              )}
            </PdfPage>
          )}
        </section>

        <aside className="flex flex-col gap-3">
          {draft && mode && (
            <form onSubmit={handleAddPin} className="flex flex-col gap-2 rounded-lg border border-primary bg-card p-3">
              <p className="text-sm font-medium">{mode === 'question' ? 'New question' : 'New note'}</p>
              <Textarea
                autoFocus
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder={mode === 'question' ? 'What is unclear here?' : 'Add a note for the class'}
                required
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={isSaving}>
                  Post
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Pins on page {page}</h2>
            <select
              aria-label="Filter pins"
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              <option value="all">All</option>
              <option value="questions">Questions</option>
              <option value="open">Open questions</option>
            </select>
          </div>
          {listedPins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {listedPins.map((pin) => (
                <PinCard
                  key={pin.recordId}
                  pin={pin}
                  index={pinNumber.get(pin.recordId)}
                  authorName={nameOf(pin.createdBy)}
                  isMine={pin.createdBy === myUserId}
                  canModerate={canModerate}
                  highlighted={selectedPin === pin.recordId}
                  onSelect={() => setSelectedPin(pin.recordId)}
                />
              ))}
            </ul>
          )}
          {allPins.length > pagePins.length && (
            <p className="text-xs text-muted-foreground">
              Other pages:{' '}
              {[...new Set(allPins.filter((p) => p.data.page !== page).map((p) => p.data.page))]
                .sort((a, b) => a - b)
                .map((p) => (
                  <button key={p} type="button" className="mr-2 text-primary hover:underline" onClick={() => goToPage(p)}>
                    p. {p}
                  </button>
                ))}
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
