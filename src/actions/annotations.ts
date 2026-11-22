import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { cleanText, getMembership, isRateLimited, isStaff } from './helpers'

type Pin = {
  teamId: string
  targetType: string
  targetId: string
  kind: string
}

// The pin's teamId copies its target's audience, so the 'team' read rule matches the target
async function resolveTarget(tools: ActionTools, userId: string, type: unknown, id: unknown) {
  if (typeof id !== 'string' || !id) return null
  if (type === 'resource') {
    const found = await tools.get<{ teamId: string }>('resources', id)
    if (!found.success) return null
    const member = await getMembership(tools, found.data.record.data.teamId, userId)
    return member ? { teamId: found.data.record.data.teamId } : null
  }
  if (type === 'note') {
    const found = await tools.get<{ sharedTeamId: string }>('notes', id)
    if (!found.success) return null
    const note = found.data.record
    // A private note takes comments from its author only
    if (note.createdBy === userId) return { teamId: note.data.sharedTeamId ?? '' }
    const member = await getMembership(tools, note.data.sharedTeamId, userId)
    return member ? { teamId: note.data.sharedTeamId } : null
  }
  return null
}

function inUnitRange(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

export const annotationActions: Record<string, ActionHandler<Env>> = {
  addPin: async ({ userId, params, tools }) => {
    const text = cleanText(params.text, 1000)
    const kind = params.kind === 'question' ? 'question' : 'note'
    const targetType = params.targetType
    if (!text) return { success: false, error: 'Write something up to 1000 characters.' }

    // Notes have no pages, so their comments sit at page 0, position 0,0
    const isResource = targetType === 'resource'
    const page = isResource ? params.page : 0
    const x = isResource ? params.x : 0
    const y = isResource ? params.y : 0
    if (typeof page !== 'number' || !Number.isInteger(page) || page < 0 || page > 5000) {
      return { success: false, error: 'Invalid page.' }
    }
    if (!inUnitRange(x) || !inUnitRange(y)) return { success: false, error: 'Invalid position.' }

    const target = await resolveTarget(tools, userId, targetType, params.targetId)
    if (!target) return { success: false, error: 'You cannot comment on that.' }
    if (await isRateLimited(tools, 'annotations', userId, 10, 60_000)) {
      return { success: false, error: 'Slow down: at most 10 pins a minute.' }
    }

    const created = await tools.create('annotations', {
      teamId: target.teamId,
      targetType,
      targetId: params.targetId,
      page,
      x,
      y,
      kind,
      text,
      resolved: 0,
    })
    if (!created.success) return created
    return { success: true, data: { pinId: created.data.recordId } }
  },

  resolvePin: async ({ userId, params, tools }) => {
    const pinId = typeof params.pinId === 'string' ? params.pinId : ''
    const found = await tools.get<Pin>('annotations', pinId)
    if (!found.success) return { success: false, error: 'Pin not found.' }
    const pin = found.data.record
    if (pin.data.kind !== 'question') return { success: false, error: 'Only questions resolve.' }

    const caller = await getMembership(tools, pin.data.teamId, userId)
    if (!isStaff(caller?.data.role)) {
      return { success: false, error: 'Only owners and moderators can resolve questions.' }
    }
    const resolved = params.resolved === false ? 0 : 1
    const updated = await tools.update('annotations', pinId, { resolved })
    if (!updated.success) return updated
    return { success: true, data: { pinId, resolved: resolved === 1 } }
  },

  // Authors delete their own pins directly; this lets moderators remove anyone's
  removePin: async ({ userId, params, tools }) => {
    const pinId = typeof params.pinId === 'string' ? params.pinId : ''
    const found = await tools.get<Pin>('annotations', pinId)
    if (!found.success) return { success: false, error: 'Pin not found.' }
    const pin = found.data.record

    const caller = await getMembership(tools, pin.data.teamId, userId)
    if (pin.createdBy !== userId && !isStaff(caller?.data.role)) {
      return { success: false, error: 'You can only delete your own pins.' }
    }
    const removed = await tools.remove('annotations', pinId)
    if (!removed.success) return removed
    return { success: true, data: { pinId } }
  },
}
