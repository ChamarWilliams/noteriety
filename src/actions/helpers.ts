import type { ActionTools } from 'deepspace/worker'

export type SpaceRole = 'owner' | 'moderator' | 'member'

// Returns this user's membership row in a space, or null if they're not in it
export async function getMembership(tools: ActionTools, teamId: string, userId: string) {
  if (!teamId) return null
  const result = await tools.query<{ role: SpaceRole }>('team_members', {
    where: { teamId, userId },
    limit: 1,
  })
  if (!result.success) return null
  return result.data.records[0] ?? null
}

export function isStaff(role: SpaceRole | undefined) {
  return role === 'owner' || role === 'moderator'
}

// True when the caller already made `max` records in this collection within `windowMs`
export async function isRateLimited(
  tools: ActionTools,
  collection: string,
  userId: string,
  max: number,
  windowMs: number,
) {
  const recent = await tools.query(collection, {
    where: { createdBy: userId },
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: max,
  })
  if (!recent.success) return true
  const oldest = recent.data.records[max - 1]
  return !!oldest && Date.now() - Date.parse(oldest.createdAt) < windowMs
}

// Uploads land in the uploader's private folder, so a key must sit under their own user ID
export function ownsFileKey(fileKey: string, userId: string) {
  return fileKey.includes(`/users/${userId}/`) && !fileKey.includes('..')
}

export function cleanText(value: unknown, max: number) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > 0 && text.length <= max ? text : null
}

// Lowercase, deduplicated tags; null when any tag is invalid
export function cleanTags(value: unknown): string[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 10) return null
  const tags = new Set<string>()
  for (const raw of value) {
    if (typeof raw !== 'string') return null
    const tag = raw.trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9 -]{0,29}$/.test(tag)) return null
    tags.add(tag)
  }
  return [...tags]
}
