# Noteriety

**Live:** https://noteriety.app.space

Noteriety is a shared study space for a class or group. An owner creates a space and shares a 6-character join code. Inside a space, people:

- **open shared PDFs** (lecture slides, handouts) and pin notes or questions onto exact spots on a page, live for everyone,
- **see who's here** and which PDF and page each person is looking at,
- **build a notes library**: private or shared notes with tags, search, attachments, comments, "helpful" votes, and featured picks.

Roles are **Owner**, **Moderator** and **Member**. They are enforced on the server, not just hidden in the UI.

## Built on DeepSpace

| DeepSpace feature | Used for |
|---|---|
| **Auth** (Google / GitHub, JWT) | Sign-in; every action and file request is tied to a verified user |
| **RecordRoom collections + RBAC** | `spaces`, `team_members`, `resources`, `annotations`, `notes`, `votes`, with `'team'` and `'own'` read/write rules, `writableFields` and `uniqueOn` |
| **Teams** (`teamField` + `team_members`) | A space *is* a team, so the server only sends a space's records to its members |
| **Live sync** (`useQuery`) | Pins, notes, votes and role changes appear in every open browser without a refresh |
| **Server actions** | Every write that needs a role check: create/join space, change roles, add resources, pins, notes, votes, features |
| **R2 files** (`useR2Files`, `appFiles`) | PDF and note-attachment storage |
| **PresenceRoom** (`usePresenceRoom`) | Who's online and what they're viewing |

Not used: payments, AI, Yjs editing, cron/email. Those are listed under next steps.

## How access is enforced

- **Reads** are filtered by the server. A non-member's browser never receives a space's records, and a private note (`sharedTeamId: ''`) only ever goes to its author.
- **Writes** that depend on a role go through server actions (`src/actions/`). Actions run with RBAC off, so each one loads the caller's membership from the database first. The caller's role never comes from the browser.
- **Own edits** (fixing your own pin or note text) use direct mutations, limited by the `'own'` rule and `writableFields`. Sharing and featuring are not writable fields.
- **Files** are uploaded to the uploader's *private* R2 folder. Others can only get them through `GET /api/space-files/:kind/:id`, which checks membership before streaming the file.
- **Presence** rooms are open by name in the SDK. `src/server/space-routes.ts` checks membership before anyone can join a space's room.
- **Abuse limits:** pins (10/min), notes (5/min) and uploads (5/min) are rate limited per user in the actions. Text fields have length limits in the schema and in the action.

## Project layout

```
src/schemas/            collections and permission rules
src/actions/            server actions (index, resources, annotations, notes, helpers)
src/server/space-routes.ts   membership-checked file route + presence guard
src/lib/                client helpers: callAction, useSpace, presence, pdf.js setup
src/components/space/   members, resources, PDF page, pins, notes, votes
src/pages/(app)/(protected)/   home, space page, PDF viewer, note page
```

## Run it locally

```bash
npm install
npx deepspace auth login
npm run dev
```

Checks: `npm run type-check`, `npm run lint`, `npx deepspace test run` (smoke + API, including signed-out 401 checks for every space action, the file route and presence).

## SDK notes found while building

- **Joined spaces don't appear until a refresh (0.44.2).** `notifyTeamMembershipChange` reads `record.data.UserId` (capital U), but records are keyed `userId`, so the browser is never told to re-subscribe after a join. Workaround: remount the spaces list after a join.
- **Presence rooms accept anyone who knows the room name**, including signed-out sockets. Worked around with a membership guard in front of `/ws/presence/space:*`.

## Next steps

- Permission grid (owner toggles what each role may do)
- AI "quiz me on this page" with per-user limits
- Weekly email digest of new material and unanswered questions
- Leaving a space, removing members, transferring ownership
- Highlighting exact text in PDFs instead of pins on a location

## License

MIT
