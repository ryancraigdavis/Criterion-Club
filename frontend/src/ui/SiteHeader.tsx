import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router'
import { embyHomeUrl, type SiteInfo } from '../api'
import { AccountCard } from '../club/AccountCard'
import '../club/club.css'
import { SignInForm } from '../club/SignInForm'
import { useClubSession } from '../club/session'
import { useSite } from '../club/site'
import { ExternalMark } from './icons'

function useEscape(onEscape: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => (event.key === 'Escape' ? onEscape() : undefined)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onEscape])
}

function AccountPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const name = useClubSession((state) => state.session.name)
  const ref = useRef<HTMLElement>(null)
  const signedIn = name !== null
  useEscape(onClose)
  useEffect(() => {
    // Signed out, the form focuses its own username field.
    if (signedIn) {
      ref.current?.focus()
    }
  }, [signedIn])
  return (
    <section
      ref={ref}
      id={id}
      className="club-panel account-panel"
      aria-label="Account"
      tabIndex={-1}
    >
      <header className="sheet__head">
        <h2 className="sheet__title">{signedIn ? 'Your account' : 'Sign in'}</h2>
        <button type="button" className="chip" onClick={onClose}>
          Close
        </button>
      </header>
      {signedIn ? <AccountCard /> : <SignInForm autoFocus />}
    </section>
  )
}

function EmbyLink({ site }: { site: SiteInfo | null }) {
  return site === null ? null : (
    <a
      className="site-nav__link"
      href={embyHomeUrl(site)}
      target="_blank"
      rel="noopener noreferrer"
    >
      Emby <ExternalMark />
    </a>
  )
}

export function SiteHeader() {
  const site = useSite((state) => state.site)
  const session = useClubSession((state) => state.session)
  const [account, setAccount] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const close = useCallback(() => {
    setAccount(false)
    toggle.current?.focus()
  }, [])
  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="brand">
            <img src="/logo-128.webp" alt="" width={40} height={40} />
            <span className="brand__name">Criterion Club</span>
          </Link>
          <nav className="site-nav" aria-label="Main">
            <EmbyLink site={site} />
            {session.admin ? (
              <NavLink to="/admin" className="site-nav__link">
                Dashboard
              </NavLink>
            ) : null}
            <button
              ref={toggle}
              type="button"
              className="site-nav__link site-nav__account"
              aria-expanded={account}
              aria-controls={account ? panelId : undefined}
              onClick={() => setAccount((open) => !open)}
            >
              {session.name ?? 'Sign in'}
            </button>
          </nav>
        </div>
      </header>
      {account ? <AccountPanel id={panelId} onClose={close} /> : null}
    </>
  )
}
