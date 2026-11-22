import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Trash2, Upload } from 'lucide-react'
import { useQuery, useR2Files } from 'deepspace'
import { Button, ConfirmModal, EmptyState, Input, Label, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { isStaff, type ResourceData, type SpaceRole } from '@/lib/space'

const MAX_PDF_BYTES = 25 * 1024 * 1024

interface ResourcesPanelProps {
  spaceId: string
  myUserId: string | null
  myRole: SpaceRole | null
}

export function ResourcesPanel({ spaceId, myUserId, myRole }: ResourcesPanelProps) {
  const toast = useToast()
  const { upload, isUploading } = useR2Files()
  const resourcesQuery = useQuery<ResourceData>('resources', { where: { teamId: spaceId } })
  const pinsQuery = useQuery<{ targetId: string; kind: string; resolved: boolean | number }>(
    'annotations',
    { where: { teamId: spaceId, targetType: 'resource' } },
  )

  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const resources = [...resourcesQuery.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const canUpload = isStaff(myRole)

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return
    if (file.type !== 'application/pdf' || file.size > MAX_PDF_BYTES) {
      toast.error('Pick a PDF up to 25 MB')
      return
    }
    setIsSaving(true)
    // The file goes to my private folder first; the action then links it to the space
    const uploaded = await upload(file, file.name)
    if (!uploaded.success || !uploaded.key) {
      setIsSaving(false)
      toast.error('Upload failed', uploaded.error)
      return
    }
    const result = await callAction('addResource', {
      spaceId,
      title: title.trim() || file.name.replace(/\.pdf$/i, ''),
      fileKey: uploaded.key,
      fileName: file.name,
    })
    setIsSaving(false)
    if (!result.success) {
      toast.error('Could not add the resource', result.error)
      return
    }
    setTitle('')
    setFile(null)
    if (fileInput.current) fileInput.current.value = ''
    toast.success('Resource added')
  }

  async function handleDelete() {
    if (!toDelete) return
    setIsDeleting(true)
    const result = await callAction('deleteResource', { resourceId: toDelete.id })
    setIsDeleting(false)
    setToDelete(null)
    if (!result.success) toast.error('Could not delete it', result.error)
    else toast.success('Resource deleted')
  }

  return (
    <section className="flex flex-col gap-4">
      {canUpload && (
        <form
          onSubmit={handleUpload}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end"
        >
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="resource-title">Title (optional)</Label>
            <Input
              id="resource-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Week 3 lecture slides"
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resource-file">PDF</Label>
            <input
              id="resource-file"
              ref={fileInput}
              type="file"
              accept="application/pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
            />
          </div>
          <Button type="submit" loading={isSaving || isUploading} disabled={!file}>
            <Upload className="size-4" aria-hidden="true" />
            Upload
          </Button>
        </form>
      )}

      {resourcesQuery.status === 'loading' ? (
        <p className="text-sm text-muted-foreground">Loading resources…</p>
      ) : resources.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No resources yet"
          description={
            canUpload
              ? 'Upload slides or a PDF above to share it with the space.'
              : 'Slides and PDFs shared by the owner or moderators will show up here.'
          }
          className="rounded-xl border border-dashed border-border"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {resources.map((resource) => {
            const pins = pinsQuery.records.filter((p) => p.data.targetId === resource.recordId)
            const openQuestions = pins.filter((p) => p.data.kind === 'question' && !p.data.resolved)
            const canDelete = canUpload || resource.createdBy === myUserId
            return (
              <li key={resource.recordId} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <Link
                  to={`/spaces/${spaceId}/resources/${resource.recordId}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <span className="block truncate font-medium">{resource.data.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {resource.data.fileName} · {pins.length} pins
                    {openQuestions.length > 0 && ` · ${openQuestions.length} open questions`}
                  </span>
                </Link>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${resource.data.title}`}
                    onClick={() => setToDelete({ id: resource.recordId, title: resource.data.title })}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmModal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        loading={isDeleting}
        title="Delete this resource?"
        description={`"${toDelete?.title}" and all its pins will be removed for everyone.`}
        confirmText="Delete"
      />
    </section>
  )
}
