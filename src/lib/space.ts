export type SpaceRole = 'owner' | 'moderator' | 'member'

export const ROLE_LABEL: Record<SpaceRole, string> = {
  owner: 'Owner',
  moderator: 'Moderator',
  member: 'Member',
}

export interface SpaceData {
  teamId: string
  name: string
  description: string
  joinCode: string
}

export interface MembershipData {
  teamId: string
  userId: string
  role: SpaceRole
}

export interface ResourceData {
  teamId: string
  title: string
  fileKey: string
  fileName: string
}

export type PinKind = 'note' | 'question'

export interface AnnotationData {
  teamId: string
  targetType: 'resource' | 'note'
  targetId: string
  page: number
  x: number
  y: number
  kind: PinKind
  text: string
  resolved: boolean | number
}

export interface NoteData {
  spaceId: string
  sharedTeamId: string
  title: string
  body: string
  fileKey?: string
  fileName?: string
  tags: string
  featured: boolean | number
}

export function isStaff(role: SpaceRole | null | undefined) {
  return role === 'owner' || role === 'moderator'
}

// Tags are stored as a JSON list; a bad value reads as no tags
export function parseTags(raw: string | undefined): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]')
    return Array.isArray(value) ? value.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

// Presence state each person shares while in a space
export interface PresenceState {
  view?: string
  page?: number
  resourceId?: string
}
