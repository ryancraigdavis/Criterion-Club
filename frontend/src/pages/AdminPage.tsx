import '../club/club.css'
import type { ReactNode } from 'react'
import { AccountCard } from '../club/AccountCard'
import { type DashboardView, dashboardView } from '../club/access'
import { PollsPanel } from '../club/admin/PollsPanel'
import { ScreeningsPanel } from '../club/admin/ScreeningsPanel'
import { SuggestionsPanel } from '../club/admin/SuggestionsPanel'
import { SignInForm } from '../club/SignInForm'
import { useClubSession } from '../club/session'
import { SiteHeader } from '../ui/SiteHeader'

function Gate({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <section className="club-gate">
      <h1 className="club-gate__title">{title}</h1>
      <p className="club-gate__detail">{detail}</p>
      {children}
    </section>
  )
}

function Dashboard() {
  return (
    <>
      <header className="dashboard__head">
        <div>
          <p className="dashboard__kicker">Criterion Club</p>
          <h1 className="dashboard__title">Dashboard</h1>
        </div>
        <AccountCard dashboardLink={false} />
      </header>
      <ScreeningsPanel />
      <SuggestionsPanel />
      <PollsPanel />
    </>
  )
}

const VIEWS: Record<DashboardView, () => ReactNode> = {
  checking: () => (
    <div className="status">
      <div className="reel" aria-hidden="true" />
      <p className="status__detail">Checking who’s signed in…</p>
    </div>
  ),
  'sign-in': () => (
    <Gate title="Club admins" detail="Sign in with your Emby account to run the club.">
      <SignInForm autoFocus />
    </Gate>
  ),
  'members-only': () => (
    <Gate title="Admins only" detail="This dashboard is for the people who run the club.">
      <AccountCard />
    </Gate>
  ),
  dashboard: () => <Dashboard />,
}

export function AdminPage() {
  const session = useClubSession((state) => state.session)
  const known = useClubSession((state) => state.known)
  return (
    <>
      <SiteHeader />
      <main className="club-page">{VIEWS[dashboardView(session, known)]()}</main>
    </>
  )
}
