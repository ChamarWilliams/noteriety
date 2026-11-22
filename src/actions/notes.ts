import { appFiles } from 'deepspace/worker'
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  cleanTags,
  cleanText,
  getMembership,
  isRateLimited,
  isStaff,
  ownsFileKey,
} from './helpers'

type Note = {
  spaceId: string
  sharedTeamId: string
  fileKey?: string
}

export const noteActions: Record<string, ActionHandler<Env>> = {
  createNote: async ({ userId, params, tools }) => {
    const spaceId = typeof params.spaceId === 'string' ? params.spaceId : ''
    const title = cleanText(params.title, 120)
    const body = typeof params.body === 'string' ? params.body.trim() : ''
    const tags = cleanTags(params.tags)
    const fileKey = typeof params.fileKey === 'string' ? params.fileKey : ''
    const fileName = typeof params.fileName === 'string' ? params.fileName.trim() : ''
    if (!title) return { success: false, error: 'Give the note a title up to 120 characters.' }
    if (body.length > 20000) return { success: false, error: 'Keep the note under 20,000 characters.' }
    if (!tags) return { success: false, error: 'Use up to 10 tags of letters, numbers and dashes.' }
    if (!body && !fileKey) return { success: false, error: 'Write something or attach a file.' }
    if (fileKey && (!ownsFileKey(fileKey, userId) || !fileName || fileName.length > 200)) {
      return { success: false, error: 'Upload the file first.' }
    }

    const caller = await getMembership(tools, spaceId, userId)
    if (!caller) return { success: false, error: 'You are not in this space.' }
    if (await isRateLimited(tools, 'notes', userId, 5, 60_000)) {
      return { success: false, error: 'Too many notes. Wait a minute and try again.' }
    }

    const created = await tools.create('notes', {
      spaceId,
      // Empty keeps the note private: the 'team' read rule then matches only its author
      sharedTeamId: params.shared === true ? spaceId : '',
      title,
      body,
      tags: JSON.stringify(tags),
      fileKey,
      fileName,
      featured: 0,
    })
    if (!created.success) return created
    return { success: true, data: { noteId: created.data.recordId } }
  },

  setNoteShared: async ({ userId, params, tools }) => {
    const noteId = typeof params.noteId === 'string' ? params.noteId : ''
    const found = await tools.get<Note>('notes', noteId)
    if (!found.success) return { success: false, error: 'Note not found.' }
    const note = found.data.record
    if (note.createdBy !== userId) return { success: false, error: 'Only the author can share it.' }

    const shared = params.shared === true
    if (shared && !(await getMembership(tools, note.data.spaceId, userId))) {
      return { success: false, error: 'You are no longer in this space.' }
    }
    const sharedTeamId = shared ? note.data.spaceId : ''
    const updated = await tools.update('notes', noteId, { sharedTeamId, ...(shared ? {} : { featured: 0 }) })
    if (!updated.success) return updated

    // Comments follow the note's audience, so unsharing hides them too
    const comments = await tools.query('annotations', { where: { targetId: noteId }, limit: 500 })
    if (comments.success) {
      for (const comment of comments.data.records) {
        await tools.update('annotations', comment.recordId, { teamId: sharedTeamId })
      }
    }
    return { success: true, data: { noteId, shared } }
  },

  // Authors delete their own notes; moderators can remove shared ones
  deleteNote: async ({ userId, params, tools, env }) => {
    const noteId = typeof params.noteId === 'string' ? params.noteId : ''
    const found = await tools.get<Note>('notes', noteId)
    if (!found.success) return { success: false, error: 'Note not found.' }
    const note = found.data.record

    const caller = await getMembership(tools, note.data.sharedTeamId, userId)
    if (note.createdBy !== userId && !isStaff(caller?.data.role)) {
      return { success: false, error: 'You can only delete your own notes.' }
    }

    for (const [collection, where] of [
      ['annotations', { targetId: noteId }],
      ['votes', { noteId }],
    ] as const) {
      let deleted = 500
      while (deleted === 500) {
        const batch = await tools.deleteWhere(collection, where, 500)
        if (!batch.success) return batch
        deleted = batch.data.deleted
      }
    }
    if (note.data.fileKey) {
      await appFiles(env, { scope: 'self', userId: note.createdBy })
        .delete(note.data.fileKey)
        .catch(() => undefined)
    }
    const removed = await tools.remove('notes', noteId)
    if (!removed.success) return removed
    return { success: true, data: { noteId } }
  },

  // Adds my vote, or takes it back if I already voted; only shared notes take votes
  toggleVote: async ({ userId, params, tools }) => {
    const noteId = typeof params.noteId === 'string' ? params.noteId : ''
    const found = await tools.get<Note>('notes', noteId)
    if (!found.success || !found.data.record.data.sharedTeamId) {
      return { success: false, error: 'Note not found.' }
    }
    const teamId = found.data.record.data.sharedTeamId
    if (!(await getMembership(tools, teamId, userId))) {
      return { success: false, error: 'You are not in this space.' }
    }

    const existing = await tools.query('votes', { where: { noteId, userId }, limit: 1 })
    if (!existing.success) return existing
    const vote = existing.data.records[0]
    if (vote) {
      const removed = await tools.remove('votes', vote.recordId)
      if (!removed.success) return removed
      return { success: true, data: { noteId, voted: false } }
    }
    // uniqueOn backs this up: a double-click race still stores one vote
    const created = await tools.create('votes', { teamId, noteId, userId })
    if (!created.success) return created
    return { success: true, data: { noteId, voted: true } }
  },

  setFeatured: async ({ userId, params, tools }) => {
    const noteId = typeof params.noteId === 'string' ? params.noteId : ''
    const found = await tools.get<Note>('notes', noteId)
    if (!found.success || !found.data.record.data.sharedTeamId) {
      return { success: false, error: 'Only shared notes can be featured.' }
    }
    const caller = await getMembership(tools, found.data.record.data.sharedTeamId, userId)
    if (!isStaff(caller?.data.role)) {
      return { success: false, error: 'Only owners and moderators can feature notes.' }
    }
    const featured = params.featured === false ? 0 : 1
    const updated = await tools.update('notes', noteId, { featured })
    if (!updated.success) return updated
    return { success: true, data: { noteId, featured: featured === 1 } }
  },
}
