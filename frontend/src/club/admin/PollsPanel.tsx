import { useCallback, useEffect, useState } from 'react'
import { failureText } from '../Field'
import { markSuggestion } from '../members'
import { type PollAction, pollActions, type Tally, tally } from '../poll'
import { deletePoll, fetchAdminPolls, movePoll, saveBoardSchedule, usePoll } from '../polls'
import type { AdminPoll, AdminPollOption } from '../types'
import { PollEditor } from './PollEditor'

type Editing = AdminPoll | 'new' | null

const STATUS_LABELS = { draft: 'Draft', open: 'Open', closed: 'Closed' } as const

const ACTION_LABELS: Record<PollAction, string> = {
  edit: 'Edit',
  open: 'Open poll',
  close: 'Close poll',
  reopen: 'Reopen',
  delete: 'Delete',
}

function BoardSwitch() {
  const show = usePoll((state) => state.boardSchedule)
  const [busy, setBusy] = useState(false)
  const toggle = () => {
    setBusy(true)
    saveBoardSchedule(!show).finally(() => setBusy(false))
  }
  return (
    <label className="switch">
      <input type="checkbox" checked={show} disabled={busy} onChange={toggle} />
      <span>Show the upcoming dates on the club page</span>
    </label>
  )
}

function TallyRow({ row, closed }: { row: Tally<AdminPollOption>; closed: boolean }) {
  const [marked, setMarked] = useState(false)
  const suggestionId = row.option.suggestionId
  const schedulable = closed && row.leading && suggestionId !== null
  const schedule = () => {
    void markSuggestion(suggestionId ?? 0, 'scheduled').then(() => setMarked(true))
  }
  return (
    <li className={row.leading ? 'result result--leading' : 'result'}>
      <div className="result__body">
        <div className="result__line">
          <span className="poll__film">
            {row.option.title}
            {row.option.year === null ? null : (
              <span className="poll__year"> {row.option.year}</span>
            )}
          </span>
          <span className="result__count">
            {row.votes} · {row.percent}%
          </span>
        </div>
        <span className="result__bar" style={{ width: `${row.percent}%` }} />
        {row.option.voters.length === 0 ? null : (
          <span className="result__voters">{row.option.voters.join(', ')}</span>
        )}
      </div>
      {schedulable ? (
        <button type="button" className="chip" disabled={marked} onClick={schedule}>
          {marked ? 'Marked scheduled' : 'Mark suggestion scheduled'}
        </button>
      ) : null}
    </li>
  )
}

interface RowProps {
  poll: AdminPoll
  anotherOpen: boolean
  onEdit: () => void
  onChanged: () => void
}

function PollRow({ poll, anotherOpen, onEdit, onChanged }: RowProps) {
  const [failure, setFailure] = useState<string | null>(null)
  const run = (work: () => Promise<unknown>) =>
    work().then(onChanged, (error: unknown) => setFailure(failureText(error, 'update the poll')))
  const handlers: Record<PollAction, () => void> = {
    edit: onEdit,
    open: () => run(() => movePoll(poll.id, 'open')),
    close: () => run(() => movePoll(poll.id, 'closed')),
    reopen: () => run(() => movePoll(poll.id, 'open')),
    delete: () =>
      window.confirm(`Delete the poll “${poll.question}” and its votes?`)
        ? run(() => deletePoll(poll.id))
        : undefined,
  }
  return (
    <li className="poll-card">
      <header className="poll-card__head">
        <div>
          <p className="poll-card__question">{poll.question}</p>
          <p className="pitch__by">
            {poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'}
          </p>
        </div>
        <span className={`badge badge--poll-${poll.status}`}>{STATUS_LABELS[poll.status]}</span>
      </header>
      <ul className="poll__results">
        {tally(poll.options).map((row) => (
          <TallyRow key={row.option.id} row={row} closed={poll.status === 'closed'} />
        ))}
      </ul>
      {failure === null ? null : <p className="club-form__problem">{failure}</p>}
      <div className="slate__buttons">
        {pollActions(poll.status, anotherOpen).map((action) => (
          <button key={action} type="button" className="chip" onClick={handlers[action]}>
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>
    </li>
  )
}

function EditorSlot({ editing, onDone }: { editing: Editing; onDone: () => void }) {
  return editing === null ? null : (
    <PollEditor
      key={editing === 'new' ? 'new' : editing.id}
      poll={editing === 'new' ? null : editing}
      onDone={onDone}
    />
  )
}

export function PollsPanel() {
  const [polls, setPolls] = useState<AdminPoll[] | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchAdminPolls().then(setPolls, (error: unknown) =>
      setFailure(failureText(error, 'load polls')),
    )
    void usePoll.getState().refresh()
  }, [])

  useEffect(load, [load])

  const done = () => {
    setEditing(null)
    load()
  }
  const openId = polls?.find((poll) => poll.status === 'open')?.id
  const empty = polls !== null && polls.length === 0 && editing === null
  return (
    <section className="dashboard__section" aria-labelledby="polls-title">
      <header className="section-head">
        <h2 id="polls-title" className="section-head__title">
          Polls
        </h2>
        {editing === null ? (
          <button type="button" className="button" onClick={() => setEditing('new')}>
            New poll
          </button>
        ) : null}
      </header>
      <BoardSwitch />
      <EditorSlot editing={editing} onDone={done} />
      {failure === null ? null : <p className="club-form__problem">{failure}</p>}
      {empty ? (
        <p className="panel__detail">No polls yet. Make one when the club can’t decide.</p>
      ) : null}
      <ul className="poll-cards">
        {(polls ?? []).map((poll) => (
          <PollRow
            key={poll.id}
            poll={poll}
            anotherOpen={openId !== undefined && openId !== poll.id}
            onEdit={() => setEditing(poll)}
            onChanged={load}
          />
        ))}
      </ul>
    </section>
  )
}
