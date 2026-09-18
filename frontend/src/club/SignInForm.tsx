import './club.css'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { signInFailure, signInProblem } from './access'
import { useClubSession } from './session'

interface Props {
  autoFocus?: boolean
}

export function SignInForm({ autoFocus = false }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const signIn = useClubSession((state) => state.signIn)

  useEffect(() => {
    if (autoFocus) {
      field.current?.focus()
    }
  }, [autoFocus])

  const attempt = async () => {
    setBusy(true)
    try {
      await signIn(username.trim(), password)
    } catch (error) {
      setProblem(signInFailure(error))
      setBusy(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const invalid = signInProblem(username)
    setProblem(invalid)
    if (!invalid && !busy) {
      void attempt()
    }
  }

  return (
    <form className="club-form" onSubmit={submit} noValidate>
      <label className="field">
        <span className="field__label">Emby username</span>
        <input
          ref={field}
          className="field__input"
          name="username"
          value={username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">Password</span>
        <input
          className="field__input"
          type="password"
          name="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {problem === null ? null : (
        <p className="club-form__problem" role="alert">
          {problem}
        </p>
      )}
      <button type="submit" className="button club-form__submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="club-form__hint">Use the same name and password you use for Emby.</p>
    </form>
  )
}
