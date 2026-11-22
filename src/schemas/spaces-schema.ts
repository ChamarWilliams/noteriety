/**
 *  Spaces - Schema
 */

import type { CollectionSchema } from 'deepspace/schema'

export const spacesSchema: CollectionSchema = {
  name: 'spaces',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true},
    { name: 'name', storage: 'text', interpretation: 'plain', required: true, maxLength: 80},
    { name: 'description', storage: 'text', interpretation: 'plain', maxLength: 500},
    { name: 'joinCode', storage: 'text', interpretation: 'plain', required: true}
  ],
  uniqueOn: ['joinCode'], // Two spaces can never share a join code
  teamField: 'teamId', // The 'team' rule reads the space ID from this column
  permissions: {
    '*': { read: false, create: false, update: false, delete: false}, // Signed-out visitors
    viewer: { read: 'team', create: false, update: false, delete: false},
    member: { read: 'team', create: false, update: false, delete: false},
    admin: { read: true, create: true, update: true, delete: true},
  },
}