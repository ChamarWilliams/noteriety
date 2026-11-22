import { appFiles } from 'deepspace/worker'
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { cleanText, getMembership, isRateLimited, isStaff, ownsFileKey } from './helpers'

type Resource = {
  teamId: string
  title: string
  fileKey: string
  fileName: string
}

export const resourceActions: Record<string, ActionHandler<Env>> = {
  addResource: async ({ userId, params, tools }) => {
    const spaceId = typeof params.spaceId === 'string' ? params.spaceId : ''
    const title = cleanText(params.title, 120)
    const fileName = cleanText(params.fileName, 200)
    const fileKey = typeof params.fileKey === 'string' ? params.fileKey : ''
    if (!title) return { success: false, error: 'Give the resource a title up to 120 characters.' }
    if (!fileName || !fileName.toLowerCase().endsWith('.pdf')) {
      return { success: false, error: 'Only PDF files can be shared as resources.' }
    }
    // The file must already be in the caller's own folder, so nobody can claim another's file
    if (!ownsFileKey(fileKey, userId)) return { success: false, error: 'Upload the file first.' }

    // Owners and moderators share slides; members contribute through notes
    const caller = await getMembership(tools, spaceId, userId)
    if (!isStaff(caller?.data.role)) {
      return { success: false, error: 'Only owners and moderators can add resources.' }
    }
    if (await isRateLimited(tools, 'resources', userId, 5, 60_000)) {
      return { success: false, error: 'Too many uploads. Wait a minute and try again.' }
    }

    const created = await tools.create('resources', { teamId: spaceId, title, fileKey, fileName })
    if (!created.success) return created
    return { success: true, data: { resourceId: created.data.recordId } }
  },

  deleteResource: async ({ userId, params, tools, env }) => {
    const resourceId = typeof params.resourceId === 'string' ? params.resourceId : ''
    const found = await tools.get<Resource>('resources', resourceId)
    if (!found.success) return { success: false, error: 'Resource not found.' }
    const resource = found.data.record

    const caller = await getMembership(tools, resource.data.teamId, userId)
    if (!isStaff(caller?.data.role) && resource.createdBy !== userId) {
      return { success: false, error: 'Only the uploader, owner or moderators can delete this.' }
    }

    // Pins hang off the resource, so they go first; each batch removes up to 500
    let deleted = 500
    while (deleted === 500) {
      const batch = await tools.deleteWhere('annotations', { targetId: resourceId }, 500)
      if (!batch.success) return batch
      deleted = batch.data.deleted
    }
    // The file lives in the uploader's folder; a missing file is not an error
    await appFiles(env, { scope: 'self', userId: resource.createdBy })
      .delete(resource.data.fileKey)
      .catch(() => undefined)

    const removed = await tools.remove('resources', resourceId)
    if (!removed.success) return removed
    return { success: true, data: { resourceId } }
  },
}
