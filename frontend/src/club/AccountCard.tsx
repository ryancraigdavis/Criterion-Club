import './club.css'
import { useState } from 'react'
import { Link } from 'react-router'
import { useClubSession } from './session'

interface Props {
  dashboardLink?: boolean
}

export function AccountCard({ dashboardLink = true }: Props) {
  const session = useClubSession((state) => state.session)
  const signOut = useClubSession((state) => state.signOut)
  const [busy, setBusy] = useState(false)

  const leave = () => {
    setBusy(true)
    signOut().finally(() => setBusy(false))
  }

  return (
    <div className="account">
      <p className="account__line">
        Signed in as <strong className="account__name">{session.name}</strong>
      </p>
      <p className="account__role">{session.admin ? 'Club admin' : 'Club member'}</p>
      <div className="account__actions">
        {session.admin && dashboardLink ? (
          <Link className="button" to="/admin">
            Open the dashboard
          </Link>
        ) : null}
        <button type="button" className="button button--ghost" disabled={busy} onClick={leave}>
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}
