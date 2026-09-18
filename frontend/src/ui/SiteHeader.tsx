import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { embyHomeUrl } from '../api'
import { AccountCard } from '../club/AccountCard'
import '../club/club.css'
import { SignInForm } from '../club/SignInForm'
import { useClubSession } from '../club/session'
import { useSite } from '../club/site'
import { ExternalMark } from './icons'

function AccountPanel({ onClose }: { onClose: () => void }) {
  const name = useClubSession((state) => state.session.name)
  return (
    <section className="club-panel account-panel" aria-label="Account">
      <header className="sheet__head">
        <h2 className="sheet__title">{name ? 'Your account' : 'Sign in'}</h2>
        <button type="button" className="chip" onClick={onClose}>
          Close
        </button>
      </header>
      {name ? <AccountCard /> : <SignInForm autoFocus />}
    </section>
  )
}

export function SiteHeader() {
  const site = useSite((state) => state.site)
  const session = useClubSession((state) => state.session)
  const [account, setAccount] = useState(false)
  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="brand">
            <img src="/logo-128.webp" alt="" width={40} height={40} />
            <span className="brand__name">Criterion Club</span>
          </Link>
          <nav className="site-nav" aria-label="Main">
            <a
              className="site-nav__link"
              href={site ? embyHomeUrl(site) : undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              Emby <ExternalMark />
            </a>
            {session.admin ? (
              <NavLink to="/admin" className="site-nav__link">
                Dashboard
              </NavLink>
            ) : null}
            <button
              type="button"
              className="site-nav__link site-nav__account"
              onClick={() => setAccount((open) => !open)}
            >
              {session.name ?? 'Sign in'}
            </button>
          </nav>
        </div>
      </header>
      {account ? <AccountPanel onClose={() => setAccount(false)} /> : null}
    </>
  )
}
