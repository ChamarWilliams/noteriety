/**
 *  Team Member - Schema
 */

import type { CollectionSchema } from 'deepspace/schema'

export const teamMembersSchema: CollectionSchema = {
  name: 'team_members',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true},
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true},
    { name: 'status', storage: 'text', interpretation: 'plain', default: 'active'}, // 'active' (or empty) counts as a member
    { name: 'role', storage: 'text', interpretation: 'plain', default: 'member'} // owner, moderator or member
  ],
  uniqueOn: ['teamId', 'userId'], // One membership per person per space
  teamField: 'teamId', // The 'team' rule reads the space ID from this column
  permissions: {
    '*': { read: false, create: false, update: false, delete: false}, // Signed-out visitors
    viewer: { read: 'team', create: false, update: false, delete: false},
    member: { read: 'team', create: false, update: false, delete: false},
    admin: { read: true, create: true, update: true, delete: true},
  },
}