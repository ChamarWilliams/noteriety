import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { annotationActions } from './annotations'
import { getMembership } from './helpers'
import { noteActions } from './notes'
import { resourceActions } from './resources'

//String containing all characters, where A = 0 and B = 1
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function makeJoinCode(): string {
    //Create 6 empty shells each holding a number from 0 to 255
    const bytes = crypto.getRandomValues(new Uint8Array(6))
    // Shrinks each number to fit the list length then use the remainder as the look up key ie. CODE_CHARS[8] = 'J'
    return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

export const actions: Record<string, ActionHandler<Env>> = {
    createSpace: async ({ userId, params, tools }) => {
        //Retrieving the cleaned name input
        const name = typeof params.name === 'string' ? params.name.trim() : ''
         //Retrieving the cleaned description input
        const description = typeof params.description === 'string' ? params.description.trim() : ''

        //Input Validation
        if (!name || name.length > 80) {
            return { success: false, error: 'Give the space a name up to 80 characters.'}
        }
        if (description.length > 500) {
            return { success: false, error: 'Keep your description under 500 characters.'}
        }
        
        //ID creation: the space's record ID and its teamId are the same value
        const teamId = crypto.randomUUID()
        const joinCode = makeJoinCode()

        //Space Creation
        const space = await tools.create('spaces', {teamId, name, description, joinCode }, teamId)
        if (!space.success) return space

        //Giving caller ownership
        const membership = await tools.create('team_members', {
            teamId,
            userId,
            status: 'active',
            role: 'owner',
        })
        // No owner means no space: undo the space if the membership failed
        if (!membership.success) {
            await tools.remove('spaces', teamId)
            return membership
        }

        // Success: send back the new space's ID and join code
        return { success: true, data: { spaceId: teamId, joinCode}}
    },
    joinSpace: async ({ userId, params, tools }) => {
        //Retrieving the cleaned code input
        const code = typeof params.code === 'string' ? params.code.trim().toUpperCase() : ''
        //Input Validation
        if (code.length !== 6) {
            return { success: false, error: 'Join codes are 6 characters.'}
        }
        //Query for a space with the matching code
        const found = await tools.query('spaces', {where: {joinCode: code }, limit: 1})
        if (!found.success) return found
        const space = found.data.records[0]
        // No match means the code is wrong or the space was deleted
        if (!space) {
            return { success: false, error: 'No space found with that code.'}
        }
        const teamId = space.recordId

        //Query for existing team members
        const existing = await tools.query('team_members', { where: { teamId, userId}, limit: 1})
        if (!existing.success) return existing
        // Joining twice is a friendly no-op, not an error
        if (existing.data.records.length > 0) {
            return {success: true, data: {spaceId: teamId, alreadyMember: true}}
        }

        //Giving caller membership
        const membership = await tools.create('team_members', {
            teamId,
            userId,
            status: 'active',
            role: 'member',
        })
        if (!membership.success) return membership

        // Success: tell the page which space was joined
        return {success: true, data: {spaceId: teamId, alreadyMember: false}}
    },
    setMemberRole: async ({ userId, params, tools }) => {
        const spaceId = typeof params.spaceId === 'string' ? params.spaceId : ''
        const targetUserId = typeof params.targetUserId === 'string' ? params.targetUserId : ''
        const role = params.role
        //Input validation
        if (!spaceId || !targetUserId) {
            return { success: false, error: 'Missing space or member.' }
        }
        // Owner is never assignable here, so ownership can't be handed away
        if (role !== 'moderator' && role !== 'member') {
            return { success: false, error: 'Role must be moderator or member.' }
        }

        // The caller's role comes from the database, never from the browser
        const caller = await getMembership(tools, spaceId, userId)
        if (caller?.data.role !== 'owner') {
            return { success: false, error: 'Only the owner can change roles.' }
        }
        // The owner stays owner, so a space always has one
        if (targetUserId === userId) {
            return { success: false, error: 'You cannot change your own role.' }
        }

       //Only people already in this space can have their role changed
       const target = await getMembership(tools, spaceId, targetUserId)
       if (!target) {
        return { success: false, error: 'That person is not in this space.' }
       }

       const updated = await tools.update('team_members', target.recordId, { role })
       if (!updated.success) return updated

       // Success: tell the page whose role changed and to what
       return {success: true, data: { targetUserId, role }}
    },
    ...resourceActions,
    ...annotationActions,
    ...noteActions,
}
