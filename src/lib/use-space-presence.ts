import { useEffect } from 'react'
import { usePresenceRoom } from 'deepspace'
import type { PresenceState } from './space'

// Joins the space's presence room and shares what I'm looking at
export function useSpacePresence(spaceId: string, state: PresenceState) {
  const { peers, connected, updateState } = usePresenceRoom(`space:${spaceId}`)
  const { view, page, resourceId } = state

  // A reconnect rejoins with empty state, so it is re-sent whenever the socket connects
  useEffect(() => {
    if (connected) {
      updateState({ view: view ?? null, page: page ?? null, resourceId: resourceId ?? null })
    }
  }, [connected, view, page, resourceId, updateState])

  // One entry per person, even with the space open in two tabs
  const byUser = new Map<string, PresenceState>()
  for (const peer of peers) byUser.set(peer.userId, peer.state as PresenceState)
  return { here: byUser, connected }
}
