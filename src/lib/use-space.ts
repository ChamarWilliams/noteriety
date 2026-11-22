import { useAuth, useQuery, useUsers } from 'deepspace'
import type { MembershipData, SpaceData, SpaceRole } from './space'

export interface SpaceMember {
  userId: string
  name: string
  imageUrl?: string
  role: SpaceRole
}

const ROLE_ORDER: Record<SpaceRole, number> = { owner: 0, moderator: 1, member: 2 }

// One space, its members with display names, and my role in it
export function useSpace(spaceId: string) {
  const { userId } = useAuth()
  const { users } = useUsers()
  // The 'team' rule returns nothing to non-members, so a missing space also means "not in it"
  const spaceQuery = useQuery<SpaceData>('spaces', { where: { teamId: spaceId }, limit: 1 })
  const membersQuery = useQuery<MembershipData>('team_members', { where: { teamId: spaceId } })

  const space = spaceQuery.records[0]?.data ?? null
  const members: SpaceMember[] = membersQuery.records
    .map((m) => {
      const user = users.find((u) => u.id === m.data.userId)
      return {
        userId: m.data.userId,
        name: user?.name || 'Unknown user',
        imageUrl: user?.imageUrl,
        role: m.data.role,
      }
    })
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name))

  return {
    space,
    members,
    myUserId: userId ?? null,
    myRole: members.find((m) => m.userId === userId)?.role ?? null,
    isLoading: spaceQuery.status === 'loading' || membersQuery.status === 'loading',
  }
}
