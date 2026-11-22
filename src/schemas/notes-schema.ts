/**
 *  Notes - Schema
 */

import type { CollectionSchema } from 'deepspace/schema'

export const notesSchema: CollectionSchema = {
  name: 'notes',
  columns: [
    { name: 'spaceId', storage: 'text', interpretation: 'plain', required: true},
    { name: 'sharedTeamId', storage: 'text', interpretation: 'plain', default: ''}, // Set to the space ID when shared
    { name: "title", storage: 'text', interpretation: 'plain', required: true, maxLength: 120},
    { name: 'body', storage: 'text', interpretation: 'plain', maxLength: 20000},
    { name: 'fileKey', storage: 'text', interpretation: 'plain'},
    { name: 'fileName', storage: 'text', interpretation: 'plain', maxLength: 200},
    { name: 'tags', storage: 'text', interpretation: 'plain', default: '[]', maxLength: 1000}, // JSON list of tag names
    { name: 'featured', storage: 'number', interpretation: { kind: 'boolean'}, default: 0},
  ],
  teamField: 'sharedTeamId', // Empty while private, so only the creator can read it
  permissions: {
    '*': { read: false, create: false, update: false, delete: false}, // Signed-out visitors
    viewer: { read: 'team', create: false, update: false, delete: false},
    member: { 
      read: 'team', 
      create: false, 
      update: 'own', 
      delete: 'own',
      writableFields: ['title', 'body', 'tags', 'fileKey', 'fileName'], // featured and sharing go through actions
    },
    admin: { read: true, create: true, update: true, delete: true},
  },
}