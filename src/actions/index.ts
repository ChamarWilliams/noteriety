import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'

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
        
        //ID creation
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
        if (!membership.success) {
            await tools.remove('spaces', teamId)
            return membership
        }

        //Fallback Cleanup
        return { success: true, data: { spaceId: teamId, joinCode}}
    },
    joinSpace: async ({userId, params, tools }) => {
        const code = typeof params.code === 'string' ? params.code.trim().toUpperCase() : ''
        if (code.length !== 6) {
            return { success: false, error: 'Join codes are 6 characters.'}
        }

        const found = await tools.query('spaces', {where: {joinCode: code }, limit: 1})
        if (!found.success) return found
        const space = found.data.records[0]
        if (!space) {
            return { success: false, error: 'No space found with that code.'}
        }
        const teamId = space.recordId

        const existing = await tools.query('team_members', { where: { teamId, userId}, limit: 1})
        if (!existing.success) return existing
        if (existing.data.records.length > 0) {
            return {success: true, data: {spaceId: teamId, alreadyMember: true}}
        }

        const membership = await tools.create('team_members', {
            teamId,
            userId,
            status: 'active',
            role: 'member',
        })
        if (!membership.success) return membership

        return {success: true, data: {spaceId: teamId, alreadyMember: false}}
    }
}
