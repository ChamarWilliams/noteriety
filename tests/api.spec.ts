import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    // /home is a dynamic page (under src/pages/(app)/), so mounting it boots
    // the providers and auto-connects the records WebSocket. The static
    // landing at '/' deliberately does neither — see smoke.spec.ts.
    await page.goto('/home')
    // Wait for the app to connect its WebSocket (it auto-connects on mount)
    await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
    // If the app loaded and connected, the WS endpoint works
  })

  test('space actions refuse signed-out callers', async ({ request }) => {
    for (const name of ['addResource', 'addPin', 'createNote', 'setMemberRole', 'deleteNote', 'toggleVote', 'setFeatured']) {
      const res = await request.post(`/api/actions/${name}`, { data: {} })
      expect(res.status(), name).toBe(401)
    }
  })

  test('space files refuse signed-out callers', async ({ request }) => {
    expect((await request.get('/api/space-files/resources/any-id')).status()).toBe(401)
    expect((await request.get('/api/space-files/notes/any-id')).status()).toBe(401)
  })

  test('space presence rooms refuse signed-out callers', async ({ request }) => {
    const res = await request.get('/ws/presence/space:any-id', { headers: { Upgrade: 'websocket' } })
    expect(res.status()).toBe(401)
  })
})
