/**
 *  Team Member - Schema
 */

import type { CollectionSchema } from 'deepspace/schema'

export const teamMembersSchema: CollectionSchema = {
  name: 'team_members',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true},
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true},
    { name: 'status', storage: 'text', interpretation: 'plain', default: 'active'},
    { name: 'role', storage: 'text', interpretation: 'plain', default: 'member'}
  ],
  uniqueOn: ['teamId', 'userId'],
  teamField: 'teamId',
  permissions: {
    '*': { read: false, create: false, update: false, delete: false},
    viewer: { read: 'team', create: false, update: false, delete: false},
    member: { read: 'team', create: false, update: false, delete: false},
    admin: { read: true, create: true, update: true, delete: true},
  },
}