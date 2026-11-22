import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'
import { Badge, EmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { MembersPanel } from '@/components/space/MembersPanel'
import { NotesPanel } from '@/components/space/NotesPanel'
import { ResourcesPanel } from '@/components/space/ResourcesPanel'
import { ROLE_LABEL } from '@/lib/space'
import { useSpace } from '@/lib/use-space'
import { useSpacePresence } from '@/lib/use-space-presence'

export default function SpacePage() {
  // The space's ID comes from the URL: /spaces/<id>
  const { id: spaceId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'notes' ? 'notes' : 'resources'
  const { space, members, myRole, myUserId, isLoading } = useSpace(spaceId)
  const { here } = useSpacePresence(spaceId, {
    view: tab === 'notes' ? 'Notes library' : 'Space overview',
  })

  if (isLoading) {
    return <p className="px-6 py-10 text-sm text-muted-foreground">Loading space…</p>
  }

  // Non-members get no space record from the server, so they land here too
  if (!space) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <EmptyState
          icon={<Users />}
          title="Space not found"
          description="It may have been deleted, or you're not a member. Ask the owner for the join code."
          className="rounded-xl border border-dashed border-border"
        />
        <Link to="/home" className="mt-6 inline-block text-sm text-primary hover:underline">
          Back to your spaces
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <Link
        to="/home"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Your spaces
      </Link>

      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-primary">{space.name}</h1>
          {myRole && (
            <Badge variant={myRole === 'member' ? 'secondary' : 'default'}>{ROLE_LABEL[myRole]}</Badge>
          )}
        </div>
        {space.description && <p className="max-w-2xl text-muted-foreground">{space.description}</p>}
        {myRole && myRole !== 'member' && (
          <p className="text-sm text-muted-foreground">
            Join code:{' '}
            <span className="font-mono font-semibold tracking-widest text-foreground">
              {space.joinCode}
            </span>
          </p>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <Tabs
          value={tab}
          onValueChange={(value) => setSearchParams(value === 'notes' ? { tab: 'notes' } : {})}
        >
          <TabsList>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="notes">Notes library</TabsTrigger>
          </TabsList>
          <TabsContent value="resources" className="pt-2">
            <ResourcesPanel spaceId={spaceId} myUserId={myUserId} myRole={myRole} />
          </TabsContent>
          <TabsContent value="notes" className="pt-2">
            <NotesPanel spaceId={spaceId} myUserId={myUserId} members={members} />
          </TabsContent>
        </Tabs>

        <MembersPanel
          spaceId={spaceId}
          members={members}
          myUserId={myUserId}
          myRole={myRole}
          here={here}
        />
      </div>
    </div>
  )
}
