/**
 *  Tags - Schema
 */

import type { CollectionSchema } from 'deepspace/schema'

export const tagsSchema: CollectionSchema = {
  name: 'tags',
  columns: [
    {name: 'teamId', storage: 'text', interpretation: 'plain', required: true},
    {name: 'name', storage: 'text', interpretation: 'plain', required: true, maxLength: 40},

  ],
  teamField: 'teamId',
  uniqueOn: ['teamId', 'name'],
  permissions: {
    '*': { read: false, create: false, update: false, delete: false},
    viewer: { read: 'team', create: false, update: false, delete: false},
    member: { read: 'team', create: false, update: false, delete: false,},
    admin: { read: true, create: true, update: true, delete: true},
  },
}