import { useState } from 'react'
import { Badge, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { ROLE_LABEL, type PresenceState, type SpaceRole } from '@/lib/space'
import type { SpaceMember } from '@/lib/use-space'

interface MembersPanelProps {
  spaceId: string
  members: SpaceMember[]
  myUserId: string | null
  myRole: SpaceRole | null
  here: Map<string, PresenceState>
}

export function MembersPanel({ spaceId, members, myUserId, myRole, here }: MembersPanelProps) {
  const toast = useToast()
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const canManageRoles = myRole === 'owner'
  const onlineCount = members.filter((m) => m.userId === myUserId || here.has(m.userId)).length

  async function handleRoleChange(member: SpaceMember, role: SpaceRole) {
    setPendingUserId(member.userId)
    const result = await callAction<{ role: SpaceRole }>('setMemberRole', {
      spaceId,
      targetUserId: member.userId,
      role,
    })
    setPendingUserId(null)
    if (!result.success) {
      toast.error('Could not change the role', result.error)
      return
    }
    toast.success(`${member.name} is now a ${ROLE_LABEL[role].toLowerCase()}`)
  }

  return (
    <aside className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">
        Members{' '}
        <span className="text-sm font-normal text-muted-foreground">
          ({members.length}, {onlineCount} here now)
        </span>
      </h2>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {members.map((member) => {
          const isMe = member.userId === myUserId
          const presence = isMe ? undefined : here.get(member.userId)
          const isHere = isMe || !!presence
          // The owner's role and your own role are never editable here
          const editable = canManageRoles && member.role !== 'owner' && !isMe
          return (
            <li key={member.userId} className="flex items-center gap-3 px-4 py-3">
              <span className="relative shrink-0">
                <span
                  aria-hidden="true"
                  className="flex size-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
                >
                  {member.name.charAt(0).toUpperCase()}
                </span>
                {isHere && (
                  <span
                    className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-card bg-green-500"
                    title="In this space now"
                  />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">
                  {member.name}
                  {isMe && <span className="text-muted-foreground"> (you)</span>}
                </span>
                {presence?.view && (
                  <span className="truncate text-xs text-muted-foreground">
                    {presence.view}
                    {presence.page ? `, page ${presence.page}` : ''}
                  </span>
                )}
              </span>
              {editable ? (
                <select
                  aria-label={`Role for ${member.name}`}
                  value={member.role}
                  disabled={pendingUserId === member.userId}
                  onChange={(e) => handleRoleChange(member, e.target.value as SpaceRole)}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                >
                  <option value="member">Member</option>
                  <option value="moderator">Moderator</option>
                </select>
              ) : (
                <Badge variant={member.role === 'member' ? 'secondary' : 'default'} size="sm">
                  {ROLE_LABEL[member.role]}
                </Badge>
              )}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
