import { useEffect } from 'react'
import { Link, Route, Routes } from 'react-router'
import { usePoll } from './club/polls'
import { useScreenings } from './club/screenings'
import { useClubSession } from './club/session'
import { useSite } from './club/site'
import { AdminPage } from './pages/AdminPage'
import { ClubPage } from './pages/ClubPage'
import { SiteHeader } from './ui/SiteHeader'

function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="page">
        <section className="notice">
          <h1 className="notice__title">Nothing here</h1>
          <p className="notice__detail">That page does not exist.</p>
          <Link className="button" to="/">
            Back to the club
          </Link>
        </section>
      </main>
    </>
  )
}

export function App() {
  useEffect(() => {
    void useClubSession.getState().refresh()
    void useScreenings.getState().refresh()
    void usePoll.getState().refresh()
    void useSite.getState().refresh()
  }, [])
  return (
    <Routes>
      <Route path="/" element={<ClubPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
