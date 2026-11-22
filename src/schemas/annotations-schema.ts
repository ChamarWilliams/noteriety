/**
 *  Annotations - Schema
 */

import type { CollectionSchema } from 'deepspace/schema'

export const annotationsSchema: CollectionSchema = {
  name: 'annotations',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true},
    { name: 'targetType', storage: 'text', interpretation: 'plain', required: true},
    { name: 'targetId', storage: 'text', interpretation: 'plain', required: true},
    { name: 'page', storage: 'number', interpretation: 'plain', required: true},
    { name: 'x', storage: 'number', interpretation: 'plain', required: true},
    { name: 'y', storage: 'number', interpretation: 'plain', required: true},
    { name: 'kind', storage: 'text', interpretation: 'plain', required: true, default: 'note'},
    { name: 'text', storage: 'text', interpretation: 'plain', required: true, maxLength: 1000},
    { name: 'resolved', storage: 'number', interpretation: { kind: 'boolean'}, default: 0}
  ],
  teamField: 'teamId', // The 'team' rule reads the space ID from this column
  permissions: {
    '*': { read: false, create: false, update: false, delete: false}, // Signed-out visitors
    viewer: { read: 'team', create: false, update: false, delete: false},
    member: { 
      read: 'team', 
      create: false, 
      update: 'own', 
      delete: 'own',
      writableFields: ['text', 'kind', 'x', 'y'], // resolved is set by owners and moderators only
    },
    admin: { read: true, create: true, update: true, delete: true},
  },
}