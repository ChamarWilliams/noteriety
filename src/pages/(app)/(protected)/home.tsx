import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Plus, Users } from 'lucide-react'
import { Badge, Button, EmptyState, Input, Label, Textarea, useToast } from '@/components/ui'
import { getAuthToken, useAuth, useQuery } from 'deepspace'

type SpaceRole = 'owner' | 'moderator' | 'member'

// One card in the list: a space plus my role in it
interface SpaceRow {
  id: string
  name: string
  description: string
  joinCode: string
  role: SpaceRole
}

const ROLE_LABEL: Record<SpaceRole, string> = {
  owner: 'Owner',
  moderator: 'Moderator',
  member: 'Member',
}

// Calls a server action with my sign-in token so the server knows who I am
async function callAction<T>(name: string, params: Record<string, unknown>) {
  try {
    const token = await getAuthToken()
    const res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
    return (await res.json()) as { success: boolean; data?: T; error?: string }
  } catch {
    // Network failure: answer in the same shape as a server error
    return { success: false, error: 'Could not reach the server. Check your connection.' }
  }
}

export default function HomePage() {
  const toast = useToast()

  // Create-form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createdCode, setCreatedCode] = useState<string | null>(null)

  // Join-form state
  const [joinCode, setJoinCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  // Bumping this rebuilds SpacesList, which re-subscribes and fetches newly joined spaces
  const [listVersion, setListVersion] = useState(0)

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    // Stops the browser from reloading the page on submit
    event.preventDefault()
    setIsCreating(true)
    const result = await callAction<{ spaceId: string; joinCode: string }>('createSpace', {
      name,
      description,
    })
    setIsCreating(false)
    if (!result.success || !result.data) {
      toast.error('Could not create the space', result.error)
      return
    }
    setCreatedCode(result.data.joinCode)
    setName('')
    setDescription('')
    toast.success('Space created')
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsJoining(true)
    const result = await callAction<{ spaceId: string; alreadyMember: boolean }>('joinSpace', {
      code: joinCode,
    })
    setIsJoining(false)
    if (!result.success || !result.data) {
      toast.error('Could not join', result.error)
      return
    }
    // SDK 0.44.2 never re-subscribes on joins, so the list is rebuilt by hand
    if (!result.data.alreadyMember) setListVersion((v) => v + 1)
    setJoinCode('')
    toast.success(result.data.alreadyMember ? "You're already in that space" : 'Joined the space')
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Your spaces</h1>
        <p className="mt-2 text-muted-foreground">
          Create a space for your class or group, or join one with a code.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-2">
            <Plus className="size-5 text-[var(--pin)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Create a space</h2>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="space-name">Name</Label>
            <Input
              id="space-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CS 101, Fall"
              maxLength={80}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="space-description">Description (optional)</Label>
            <Textarea
              id="space-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Lecture slides and study notes for the class"
              maxLength={500}
              rows={3}
            />
          </div>
          <Button type="submit" loading={isCreating} className="self-start">
            Create space
          </Button>
          {createdCode && (
            <div className="rounded-lg border border-border bg-accent px-4 py-3 text-sm text-accent-foreground">
              Space created. Share this join code:{' '}
              <span className="font-mono text-base font-semibold tracking-widest">{createdCode}</span>
            </div>
          )}
        </form>

        <form
          onSubmit={handleJoin}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-[var(--pin)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Join with a code</h2>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="join-code">Join code</Label>
            <Input
              id="join-code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="K7QM2X"
              maxLength={6}
              autoComplete="off"
              className="font-mono tracking-widest uppercase"
              required
            />
          </div>
          <Button type="submit" variant="outline" loading={isJoining} className="self-start">
            Join space
          </Button>
        </form>
      </section>

      {/* A new key makes React build a fresh SpacesList */}
      <SpacesList key={listVersion} />
    </div>
  )
}

// Live list of my spaces; its queries update by themselves as records change
function SpacesList() {
  const { userId } = useAuth()

  // The 'team' rule means this only returns spaces I belong to
  const spaceQuery = useQuery<{ name: string; description: string; joinCode: string }>('spaces')
  // My memberships hold my role in each space
  const membersQuery = useQuery<{ teamId: string; userId: string; role: SpaceRole }>(
    'team_members',
    { where: { userId: userId ?? '' } },
  )

  const isLoading = spaceQuery.status === 'loading' || membersQuery.status === 'loading'

  // Pairs each membership with its space; skips spaces that haven't arrived yet
  const spaces: SpaceRow[] = membersQuery.records.flatMap((member) => {
    const space = spaceQuery.records.find((s) => s.recordId === member.data.teamId)
    if (!space) return []
    return [
      {
        id: space.recordId,
        name: space.data.name,
        description: space.data.description ?? '',
        joinCode: space.data.joinCode,
        role: member.data.role,
      },
    ]
  })

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Spaces you're in</h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your spaces…</p>
      ) : spaces.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No spaces yet"
          description="Create one above, or ask a classmate for their join code."
          className="rounded-xl border border-dashed border-border"
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <li key={space.id}>
              <Link
                to={`/spaces/${space.id}`}
                className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-[var(--shadow-card-hover)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-primary">{space.name}</h3>
                  <Badge variant={space.role === 'member' ? 'secondary' : 'default'} size="sm">
                    {ROLE_LABEL[space.role]}
                  </Badge>
                </div>
                {space.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{space.description}</p>
                )}
                {/* Owners and moderators invite people, so they see the code */}
                {space.role !== 'member' && (
                  <p className="text-xs text-muted-foreground">
                    Join code:{' '}
                    <span className="font-mono font-semibold tracking-widest">{space.joinCode}</span>
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
