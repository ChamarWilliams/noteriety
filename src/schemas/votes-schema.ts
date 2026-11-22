/**
 *  Votes - Schema
 */

import type { CollectionSchema } from 'deepspace/schema'

export const votesSchema: CollectionSchema = {
  name: 'votes',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'noteId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true },
  ],
  teamField: 'teamId', // The 'team' rule reads the space ID from this column
  uniqueOn: ['noteId', 'userId'], // The database refuses a second vote on the same note
  permissions: {
    '*': { read: false, create: false, update: false, delete: false }, // Signed-out visitors
    viewer: { read: 'team', create: false, update: false, delete: false },
    member: { read: 'team', create: false, update: false, delete: false }, // Votes go through toggleVote
    admin: { read: true, create: true, update: true, delete: true },
  },
}
