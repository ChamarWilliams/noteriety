/**
 * Two-user end-to-end spec for spaces: roles, server-side permission checks, PDFs,
 * live pins, presence, private notes and votes. Needs two usable test accounts.
 */
import type { Page } from '@playwright/test'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

const usableTestAccounts = loadAllTestAccounts().length
test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}. Create them with ` +
    '`npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" --password-stdin`.',
)

interface ActionResult<T = Record<string, unknown>> {
  success: boolean
  data?: T
  error?: string
}

// A one-page PDF; pdf.js rebuilds the missing xref table on load
const TINY_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
)

// Captures the bearer token the page sends with its first call to this action
async function captureToken(page: Page, action: string, trigger: () => Promise<unknown>) {
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.url().includes(`/api/actions/${action}`)),
    trigger(),
  ])
  const token = request.headers()['authorization']
  expect(token, `token sent with ${action}`).toMatch(/^Bearer \S+/)
  return token
}

// Calls a server action directly, the way someone bypassing the UI would
async function act<T = Record<string, unknown>>(
  page: Page,
  token: string,
  name: string,
  params: Record<string, unknown>,
) {
  const res = await page.request.post(`/api/actions/${name}`, {
    headers: { Authorization: token },
    data: params,
  })
  return (await res.json()) as ActionResult<T>
}

test('two members share a space with server-enforced roles', async ({ users }) => {
  test.setTimeout(180_000)
  const [a, b] = await users(2)
  const tag = `__test-${Date.now()}__`

  // A creates a space through the UI
  await a.page.goto('/home')
  await a.page.locator('#space-name').fill(`${tag} Space`)
  const createResponse = a.page.waitForResponse((r) => r.url().includes('/api/actions/createSpace'))
  const tokenA = await captureToken(a.page, 'createSpace', () =>
    a.page.getByRole('button', { name: 'Create space' }).click(),
  )
  const created = (await (await createResponse).json()) as ActionResult<{ spaceId: string; joinCode: string }>
  expect(created.success, created.error).toBe(true)
  const { spaceId, joinCode } = created.data!

  // A uploads a PDF before B joins
  await a.page.goto(`/spaces/${spaceId}`)
  await a.page.locator('#resource-title').fill(`${tag} Slides`)
  await a.page.locator('#resource-file').setInputFiles({
    name: 'slides.pdf',
    mimeType: 'application/pdf',
    buffer: TINY_PDF,
  })
  const addResponse = a.page.waitForResponse((r) => r.url().includes('/api/actions/addResource'))
  await a.page.getByRole('button', { name: 'Upload' }).click()
  const added = (await (await addResponse).json()) as ActionResult<{ resourceId: string }>
  expect(added.success, added.error).toBe(true)
  const resourceId = added.data!.resourceId

  // B is not a member yet: no space page, no file, no pins
  await b.page.goto('/home')
  await b.page.locator('#join-code').fill('ZZZZZZ')
  const tokenB = await captureToken(b.page, 'joinSpace', () =>
    b.page.getByRole('button', { name: 'Join space' }).click(),
  )
  await b.page.goto(`/spaces/${spaceId}`)
  await expect(b.page.getByText('Space not found')).toBeVisible({ timeout: 15_000 })
  const fileBeforeJoin = await b.page.request.get(`/api/space-files/resources/${resourceId}`, {
    headers: { Authorization: tokenB },
  })
  expect(fileBeforeJoin.status()).toBe(403)
  const pinBeforeJoin = await act(b.page, tokenB, 'addPin', {
    targetType: 'resource', targetId: resourceId, page: 1, x: 0.5, y: 0.5, kind: 'note', text: 'hi',
  })
  expect(pinBeforeJoin.success).toBe(false)

  // B joins with the real code
  const joined = await act<{ alreadyMember: boolean }>(b.page, tokenB, 'joinSpace', { code: joinCode })
  expect(joined.success, joined.error).toBe(true)
  expect((await b.page.request.get(`/api/space-files/resources/${resourceId}`, {
    headers: { Authorization: tokenB },
  })).status()).toBe(200)

  // Members can't do owner or moderator actions, even by calling the API
  const selfPromote = await act(b.page, tokenB, 'setMemberRole', {
    spaceId, targetUserId: 'anyone', role: 'moderator',
  })
  expect(selfPromote.error).toMatch(/Only the owner/)
  const memberUpload = await act(b.page, tokenB, 'addResource', {
    spaceId, title: 'x', fileKey: 'x', fileName: 'x.pdf',
  })
  expect(memberUpload.success).toBe(false)

  // Both on the space page: presence shows two people, B sees no upload form
  await Promise.all([a.page.goto(`/spaces/${spaceId}`), b.page.goto(`/spaces/${spaceId}`)])
  await expect(a.page.getByText(/2 here now/)).toBeVisible({ timeout: 20_000 })
  await expect(b.page.getByText(`${tag} Slides`)).toBeVisible({ timeout: 15_000 })
  await expect(b.page.locator('#resource-file')).toHaveCount(0)

  // A promotes B in the UI and B's page updates live
  await a.page.locator('select[aria-label^="Role for"]').selectOption('moderator')
  await expect(b.page.locator('header').getByText('Moderator')).toBeVisible({ timeout: 15_000 })
  await a.page.locator('select[aria-label^="Role for"]').selectOption('member')
  await expect(b.page.locator('header').getByText('Member')).toBeVisible({ timeout: 15_000 })

  // B pins a question; A sees it appear live on the PDF
  await Promise.all([
    a.page.goto(`/spaces/${spaceId}/resources/${resourceId}`),
    b.page.goto(`/spaces/${spaceId}/resources/${resourceId}`),
  ])
  await expect(a.page.locator('canvas')).toBeVisible({ timeout: 20_000 })
  const pin = await act<{ pinId: string }>(b.page, tokenB, 'addPin', {
    targetType: 'resource', targetId: resourceId, page: 1, x: 0.4, y: 0.3, kind: 'question',
    text: `${tag} What does this mean?`,
  })
  expect(pin.success, pin.error).toBe(true)
  await expect(a.page.getByRole('button', { name: 'Pin 1' })).toBeVisible({ timeout: 15_000 })
  await expect(a.page.getByText(`${tag} What does this mean?`)).toBeVisible()

  // Only owners and moderators resolve questions
  const memberResolve = await act(b.page, tokenB, 'resolvePin', { pinId: pin.data!.pinId })
  expect(memberResolve.error).toMatch(/Only owners and moderators/)
  const ownerResolve = await act(a.page, tokenA, 'resolvePin', { pinId: pin.data!.pinId })
  expect(ownerResolve.success, ownerResolve.error).toBe(true)
  await expect(b.page.getByText('Resolved')).toBeVisible({ timeout: 15_000 })

  // B's private note never reaches A until B shares it
  const note = await act<{ noteId: string }>(b.page, tokenB, 'createNote', {
    spaceId, title: `${tag} Private note`, body: 'secret', tags: ['midterm'], shared: false,
  })
  expect(note.success, note.error).toBe(true)
  const noteId = note.data!.noteId
  await a.page.goto(`/spaces/${spaceId}?tab=notes`)
  await expect(a.page.getByText('No notes yet')).toBeVisible({ timeout: 15_000 })
  expect((await a.page.request.get(`/api/space-files/notes/${noteId}`, {
    headers: { Authorization: tokenA },
  })).status()).not.toBe(200)
  const voteOnPrivate = await act(a.page, tokenA, 'toggleVote', { noteId })
  expect(voteOnPrivate.success).toBe(false)

  const shared = await act(b.page, tokenB, 'setNoteShared', { noteId, shared: true })
  expect(shared.success, shared.error).toBe(true)
  await expect(a.page.getByText(`${tag} Private note`)).toBeVisible({ timeout: 15_000 })

  // One vote per person; voting again takes it back
  expect((await act<{ voted: boolean }>(a.page, tokenA, 'toggleVote', { noteId })).data?.voted).toBe(true)
  expect((await act<{ voted: boolean }>(b.page, tokenB, 'toggleVote', { noteId })).data?.voted).toBe(true)
  await expect(a.page.getByRole('button', { name: 'Remove my helpful vote' })).toHaveText('2', {
    timeout: 15_000,
  })
  expect((await act<{ voted: boolean }>(a.page, tokenA, 'toggleVote', { noteId })).data?.voted).toBe(false)
  await expect(a.page.getByRole('button', { name: 'Mark as helpful' })).toHaveText('1', {
    timeout: 15_000,
  })

  // Members can't feature; the owner can
  expect((await act(b.page, tokenB, 'setFeatured', { noteId })).success).toBe(false)
  expect((await act(a.page, tokenA, 'setFeatured', { noteId })).success).toBe(true)
  await expect(a.page.getByLabel('Featured')).toBeVisible({ timeout: 15_000 })

  // Cleanup: the note, then the resource and its pins
  expect((await act(b.page, tokenB, 'deleteNote', { noteId })).success).toBe(true)
  expect((await act(a.page, tokenA, 'deleteResource', { resourceId })).success).toBe(true)
})
