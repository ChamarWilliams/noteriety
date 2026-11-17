/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { teamMembersSchema } from './schemas/team-members-schema'
import { spacesSchema } from './schemas/spaces-schema'
import { resourcesSchema } from './schemas/resources-schema'
import { notesSchema } from './schemas/notes-schema'
import { tagsSchema } from './schemas/tags-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  teamMembersSchema,
  spacesSchema,
  resourcesSchema,
  notesSchema,
  tagsSchema,
]
