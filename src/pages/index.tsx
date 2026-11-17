import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { APP_NAME } from '../constants'
import { seo } from '../seo'

const features = [
  {
    title: 'Shared spaces',
    body: 'Invite your class or study group with a join code. Owners, moderators, and members each get the right access.',
  },
  {
    title: 'Live annotations',
    body: 'Pin a note or question to any spot on a page. Everyone in the space sees it instantly.',
  },
  {
    title: 'Tagged notes library',
    body: 'Share your own notes, tag them by topic, and find the most helpful ones fast.',
  },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16 sm:py-24">
          <section className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--pin)]">
                {APP_NAME}
              </p>
              <h1 className="mb-6 text-4xl font-bold tracking-tight text-primary sm:text-5xl">
                Your class&apos;s notes, questions, and slides in one live space.
              </h1>
              <p className="mb-8 max-w-xl text-lg text-muted-foreground">
                Create a space for your class or study group. Upload slides, pin notes and
                questions right on the page, and watch them appear for everyone in real time.
              </p>
              <Link
                to="/home"
                className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Sign in to get started
              </Link>
            </div>

            <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card-hover)]">
                <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Week 3 · Recursion
                </p>
                <div className="space-y-3">
                  <div className="h-3 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-5/6 rounded bg-muted" />
                  <div className="h-24 rounded-lg bg-secondary" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
              </div>
              <span className="absolute left-[30%] top-[38%] h-4 w-4 rounded-full bg-[var(--pin)] ring-4 ring-background" />
              <span className="absolute right-[18%] top-[66%] h-4 w-4 rounded-full bg-[var(--pin)] ring-4 ring-background" />
              <div className="absolute -right-4 top-[22%] max-w-[11rem] rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-[var(--shadow-card)]">
                <span className="font-semibold text-primary">Question</span>
                <span className="block text-muted-foreground">Why does the base case come first?</span>
              </div>
            </div>
          </section>

          <section className="grid gap-6 sm:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-border bg-card p-6">
                <h2 className="mb-2 font-semibold text-primary">{feature.title}</h2>
                <p className="text-sm text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </section>
        </main>
      </div>
    </>
  )
}
