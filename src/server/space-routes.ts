import type { Hono } from 'hono'
import { appFiles, AppFileError } from 'deepspace/worker'
import type { VerifyResult } from 'deepspace/worker'
import { getMembership } from '../actions/helpers.js'
import { createActionTools } from './action-routes.js'
import type { AppContext, Env } from '../../worker.js'

type ResolveAuth = (req: Request, env: Env) => Promise<VerifyResult | null>

type FileRecord = {
  teamId?: string
  sharedTeamId?: string
  fileKey?: string
  fileName?: string
}

// Presence rooms open to anyone by name, so a space's room first checks membership
export function registerSpacePresenceGuard(app: Hono<AppContext>, resolveAuth: ResolveAuth): void {
  app.use('/ws/presence/:scopeId', async (c, next) => {
    const scopeId = c.req.param('scopeId')
    if (!scopeId.startsWith('space:')) return next()
    // WebSockets carry the token in the URL, so it is moved into a header for resolveAuth
    const token = new URL(c.req.url).searchParams.get('token')
    const authRequest = new Request(c.req.url, { headers: { Authorization: `Bearer ${token ?? ''}` } })
    const auth = token ? await resolveAuth(authRequest, c.env) : null
    if (!auth) return c.text('Unauthorized', 401)
    const tools = createActionTools(c.env, auth.userId, '')
    if (!(await getMembership(tools, scopeId.slice('space:'.length), auth.userId))) {
      return c.text('Forbidden', 403)
    }
    return next()
  })
}

// Space files sit in each uploader's private folder; this route is the only way others read them
export function registerSpaceFileRoutes(app: Hono<AppContext>, resolveAuth: ResolveAuth): void {
  app.get('/api/space-files/:kind/:id', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Unauthorized' }, 401)

    const kind = c.req.param('kind')
    if (kind !== 'resources' && kind !== 'notes') return c.json({ error: 'Not found' }, 404)
    const tools = createActionTools(c.env, auth.userId, '')
    const found = await tools.get<FileRecord>(kind, c.req.param('id'))
    if (!found.success || !found.data.record.data.fileKey) return c.json({ error: 'Not found' }, 404)
    const record = found.data.record

    // Same audience as the record itself: space members, or a private note's author
    const teamId = kind === 'resources' ? record.data.teamId : record.data.sharedTeamId
    const isAuthor = record.createdBy === auth.userId
    if (!isAuthor && !(await getMembership(tools, teamId ?? '', auth.userId))) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    try {
      const file = await appFiles(c.env, { scope: 'self', userId: record.createdBy }).download(
        record.data.fileKey!,
      )
      const isPdf = (record.data.fileName ?? '').toLowerCase().endsWith('.pdf')
      return new Response(file.body, {
        headers: {
          'Content-Type': isPdf ? 'application/pdf' : 'application/octet-stream',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch (err) {
      if (err instanceof AppFileError && err.status === 404) {
        return c.json({ error: 'Not found' }, 404)
      }
      throw err
    }
  })
}
