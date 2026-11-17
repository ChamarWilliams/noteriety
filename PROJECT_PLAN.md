# Study Space: DeepSpace Build Exercise Plan

## 1. The exercise

| | |
|---|---|
| **What** | Build and deploy a full-stack app on DeepSpace |
| **Deadline** | Saturday, November 21, 2026, 11:59 PM ET |
| **Submit (portal)** | Live URL, repository, short note |
| **Note must cover** | What you built, DeepSpace integrations used, main tradeoff, what the agent did (or that you coded it yourself), what you verified |
| **Ownership** | You own the submission. DeepSpace won't use it without a separate written agreement. |
| **Rules** | No confidential info from an employer, school, or client |

### Graded on
- Sensible scope for the 5-day window
- Deployed app works on its main path. Unfinished edges explained honestly.
- Technical depth through working flows. Integrations justified, including why others were skipped.
- Not a basic habit tracker or to-do app
- Understandable code, protected secrets, platform features used instead of rebuilt without a reason
- Write-up: main tradeoff, what the agent did, what you verified or changed
- Suggested bar: at least 3 DeepSpace integrations

### Not graded
- Originality or commercial value
- Project size or hours spent

### Live coding session (if selected)
- Explain and modify your own code
- Read errors, form a hypothesis, test it
- Think aloud, ask useful questions
- Direct AI tools deliberately and verify their output
- Respond constructively to review

---

## 2. Decisions made

- **Code it myself.** Practice some deliberate AI use for the live session.
- **Use DeepSpace records, not SQL.** Live sync and server-side permissions come built in, and the rubric rewards using platform features.
- **Scalable through habits, not extra systems.** Focused queries, files in storage, slow work in background jobs. Add a "Scaling" section to the write-up.
- **Build it general, present it specific.** Spaces, Owners and Members in the data model. The demo is a shared study space for a class.
- **Public repo is allowed.** Keep secrets out and pick a license.

---

## 3. The app

A collaborative **Space** where members share resources and notes, annotate them live, and organize them by tag. The lead use case is a class study hub. The same app works for study groups, book clubs, teams and research groups.

### Roles (per space, enforced on the server)
| Role | Can do |
|---|---|
| **Owner** | Everything: manage members, roles, tags, permissions. Edit or remove any content. |
| **Moderator** | Feature notes, resolve questions, manage tags (by default) |
| **Member** | Upload, share notes, annotate, tag, upvote. Edit or delete only their own content. |

### Core features (must ship)
1. Sign in (Google or GitHub), create a Space, share a join code
2. Upload resources (PDFs) to file storage
3. Live pinned annotations and questions on any page
4. Presence: who's viewing which resource or page
5. Shared notes library: file upload or text, private or shared (enforced on the server), tags, filter and browse by tag, live updates, annotatable
6. Resolve questions (Owner and Moderator)

### Add if time allows (in priority order)
1. Upvotes (one per user) and featured notes
2. Permission grid: the Owner toggles view, contribute and moderate capabilities per role, enforced by server actions
3. AI "quiz me on this page or note" (signed-in users only, rate limited)
4. Weekly email digest of new material and unanswered questions

### Cut (list as next steps in the write-up)
- Highlighting exact text in PDFs (pins on a page location instead)
- School logins (SSO) and LMS integrations like Canvas
- Payments
- Custom role names and per-tag permissions

### Permission grid (add if time allows)
| Capability | Owner | Moderator | Member |
|---|---|---|---|
| View resources and notes | locked on | on | on |
| Upload resources | locked on | on | toggle |
| Share notes | locked on | on | toggle |
| Annotate and ask questions | locked on | on | toggle |
| Edit or delete others' content | locked on | toggle | off |
| Feature notes, resolve questions | locked on | toggle | toggle |
| Manage tags | locked on | toggle | toggle |
| Invite and remove members | locked on | toggle | off |

---

## 4. Tech stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Frontend | React + Vite |
| Routing | File-based routing (generouted, from the scaffold) |
| Styling / UI | Tailwind CSS v4 + shadcn-style UI kit (from the scaffold) |
| PDF viewing | pdf.js (via `react-pdf` or similar, chosen in section 5) |
| Backend | Hono app on Cloudflare Workers (`worker.ts`) |
| Database | DeepSpace records: collections stored in SQLite inside Durable Objects |
| Realtime | WebSockets per Durable Object room (RecordRoom, PresenceRoom) |
| Auth | Better Auth via the DeepSpace auth worker, Google and GitHub OAuth, JWTs |
| Permissions | DeepSpace RBAC on each collection + server actions for per-space roles |
| File storage | Cloudflare R2 via `useR2Files` |
| AI (add if time allows) | DeepSpace AI integration (Claude or GPT through `integration.post`) |
| Email (add if time allows) | DeepSpace email (Resend), sent from `<app>@app.space` |
| Scheduled jobs (add if time allows) | CronRoom |
| Hosting / deploy | `npx deepspace deploy` to `<name>.app.space` (Cloudflare Workers for Platforms) |
| Version control | Git + GitHub |
| Runtime | Node 22.15+ or 24.x (not 23 or 25) |

### DeepSpace integrations used
| Integration | Used for |
|---|---|
| Auth | User accounts |
| Records + permissions | Spaces, memberships, notes, annotations, votes |
| R2 file storage | PDFs and note files |
| Presence | Who's viewing |
| Server actions | Per-space role and permission checks |
| AI (add if time allows) | Practice questions |
| Cron + email (add if time allows) | Weekly digest |

### Key SDK APIs
- Client: `useQuery`, `useMutations` (`create`, `put`, `remove`, `*Confirmed`), `useAuth`, `useUser`, `useUsers`, `AuthOverlay`, `AuthGate`, `useR2Files`, `RecordProvider`, `RecordScope`, `integration.post`
- Schema: `CollectionSchema` with `columns`, `permissions`, `visibilityField`, `uniqueOn`, `ownerField`
- Worker: `verifyJwt`, server actions (`X-App-Action` header), `appFiles`

### Key CLI commands
```bash
npm create deepspace@latest <name>
npx deepspace auth login
npx deepspace dev start
npx deepspace deploy
npx deepspace logs
npx deepspace secrets set KEY=value
npx deepspace integrations list
npx deepspace test run
```

---

## 5. Data model (draft)

| Collection | Fields |
|---|---|
| `spaces` | name, description, joinCode, ownerId |
| `memberships` | spaceId, userId, role (owner/moderator/member) |
| `resources` | spaceId, title, fileKey, uploaderId |
| `notes` | spaceId, title, fileKey or body, visibility (private/shared), featured |
| `tags` | spaceId, name |
| `note_tags` | noteId, tagId (or a tags list on each note; decide in section 3) |
| `annotations` | targetType (resource/note), targetId, page, x, y, text, type (note/question), resolved |
| `votes` | noteId, userId (`uniqueOn` noteId + userId) |
| `space_permissions` | spaceId, role, capabilities (only with the permission grid) |

### Open questions (settle in section 3)
1. Can DeepSpace's `team` or `collaborator` permission levels handle per-space roles, or are server-side membership checks needed?
2. Tags: a list on each note, or a `note_tags` linking collection?
3. App name (becomes `<name>.app.space`, globally unique)

---

## 6. Build order

Each section depends on the ones before it. Finish a section's **Done when** checks before moving on.

- [ ] **1. Setup.** Node check, scaffold, CLI login, run locally, first deploy, repo, `.gitignore`, license.
  *Done when:* the empty app is live and the repo is pushed.
- [ ] **2. Authentication.** Google and GitHub sign-in, signed-out landing page, sign-out.
  *Done when:* sign-in works on the live site, and signed-out visitors see only the landing page.
- [ ] **3. Data model and permissions.** Settle the open questions, write the schemas and permission rules.
  *Done when:* schemas deploy, and a user can't edit another user's records.
- [ ] **4. Spaces and membership.** Create, join code, join, list, server-side role checks, Owner role management.
  *Done when:* two accounts share a space with different roles, and a Member can't do Owner actions even by calling the API.
- [ ] **5. Resources.** PDF upload to R2, list, PDF viewer.
  *Done when:* one account's upload opens for another member, and non-members can't reach it.
- [ ] **6. Live annotations.** Pin a note or question, live sync, edit or delete your own, resolve questions.
  *Done when:* two browsers see pins live, and the permission rules hold.
- [ ] **7. Presence.** Who's in the space and on which page.
  *Done when:* a second browser appears live and disappears when it leaves.
- [ ] **8. Shared notes library.** Upload or write, private or shared, tags, filter, sort, annotate.
  *Done when:* private notes never reach other members (checked on the server), and filters update live.

**Sections 1 to 8 are the core app. Verify everything on the live site before continuing.**

- [ ] **9. Upvotes and featured notes.** One vote per user via `uniqueOn`, sort by helpful, feature.
  *Done when:* double-voting is blocked on the server, and featured notes stay at the top.
- [ ] **10. Permission grid.** Owner toggles capabilities, server actions enforce them.
  *Done when:* turning a capability off blocks it immediately, even through the API.
- [ ] **11. AI practice questions.** Signed-in users only, rate limited.
  *Done when:* it works on a real PDF page, and abuse is blocked.
- [ ] **12. Weekly email digest.** Cron job emails each space's members.
  *Done when:* a manual run sends a correct email.
- [ ] **13. Polish and testing.** Empty, loading and error states, phone layout, seeded demo space, multi-account test.
  *Done when:* a reviewer understands the app without instructions.
- [ ] **14. Submission.** README, write-up, final secret check, submit.
  *Done when:* submitted before Saturday 11:59 PM ET.

---

## 7. Scalability habits
- Query only what's needed: filter and limit, no full-collection loads
- Files in R2. Records store only the file key.
- Slow work (AI, email) in background or cron jobs
- Rate-limit paid integration calls per user
- Name schema fields carefully (only additive migrations run automatically)
- One room per Space so each sync channel stays small

## 8. Security checklist
- [ ] No secrets in code or git history. Use `npx deepspace secrets set`.
- [ ] Every collection has explicit permission rules
- [ ] Private notes hidden on the server, not just in the UI
- [ ] Role checks on the server for every privileged action
- [ ] Paid calls (AI, email) gated behind sign-in and rate limited
- [ ] Non-members can't read a space's records or files

## 9. Gotchas
- `deploy` refuses uncommitted changes. Commit first.
- Schema changes need a redeploy. Renames and drops are manual.
- `<AuthGate>` only hides UI. Real protection is in permissions and server checks.
- Writes are fire-and-forget by default. Use `*Confirmed` to catch rejections.
- Local R2 uploads fail (401) until after the first deploy.
- Server actions bypass RBAC, so they must do their own checks.
- Use `useUsers()`, not `useQuery('users')`, to avoid exposing full user rows.
- Email can only be sent from `<app>@app.space`.
- App names are globally unique. A renamed name stays reserved for 30 days.

---

## 10. Write-up outline
1. **What I built:** one paragraph plus the live link
2. **DeepSpace integrations:** each with why. Also which ones I skipped and why (payments, LiveKit, etc.).
3. **Main tradeoff:** fixed roles vs. a custom permission grid, and built-in RBAC vs. server actions
4. **What the agent did:** or "coded by me," plus any AI used for docs or debugging
5. **What I verified:** multi-account tests, permission bypass attempts, live-site checks
6. **Unfinished / next steps:** cut features and what I'd do next
7. **Scaling:** what changes at 10k users

## 11. Dev log
Record decisions, problems, fixes and what you tested as you go. It becomes the write-up.

| Date | Section | What happened / decided | Verified how |
|---|---|---|---|
| | | | |
