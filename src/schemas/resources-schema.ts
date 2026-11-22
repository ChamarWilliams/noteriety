/**
 *  Resources - Schema
 */

import type { CollectionSchema } from 'deepspace/schema'

export const resourcesSchema: CollectionSchema = {
  name: 'resources',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true},
    { name: 'title', storage: 'text', interpretation: 'plain', required: true, maxLength: 120},
    { name: 'fileKey', storage: 'text', interpretation: 'plain', required: true},
    { name: 'fileName', storage: 'text', interpretation: 'plain', required: true, maxLength: 200}
  ],
  teamField: 'teamId', // The 'team' rule reads the space ID from this column
  permissions: {
    '*': { read: false, create: false, update: false, delete: false}, // Signed-out visitors
    viewer: { read: 'team', create: false, update: false, delete: false},
    member: { read: 'team', create: false, update: 'own', delete: 'own'},
    admin: { read: true, create: true, update: true, delete: true},
  },
}