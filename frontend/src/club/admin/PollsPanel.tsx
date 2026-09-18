import { useCallback, useEffect, useState } from 'react'
import { useFailure } from '../failure'
import { markSuggestion } from '../members'
import { type PollAction, pollActions, type Tally, tally, waitingOnOpenPoll } from '../poll'
import { deletePoll, fetchAdminPolls, movePoll, usePoll } from '../polls'
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

function TallyRow({ row, closed }: { row: Tally<AdminPollOption>; closed: boolean }) {
  const [marked, setMarked] = useState(false)
  const [failure, run] = useFailure()
  const suggestionId = row.option.suggestionId
  const schedulable = closed && row.leading && suggestionId !== null
  const schedule = () => {
    void run(() => markSuggestion(suggestionId ?? 0, 'scheduled'), 'mark the suggestion').then(
      setMarked,
    )
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
        {failure === null ? null : <span className="field__problem">{failure}</span>}
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
  const [failure, run] = useFailure()
  const change = (work: () => Promise<unknown>) =>
    void run(work, 'update the poll').then((ok) => (ok ? onChanged() : undefined))
  const handlers: Record<PollAction, () => void> = {
    edit: onEdit,
    open: () => change(() => movePoll(poll.id, 'open')),
    close: () => change(() => movePoll(poll.id, 'closed')),
    reopen: () => change(() => movePoll(poll.id, 'open')),
    delete: () =>
      window.confirm(`Delete the poll “${poll.question}” and its votes?`)
        ? change(() => deletePoll(poll.id))
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
      {waitingOnOpenPoll(poll.status, anotherOpen) ? (
        <p className="club-form__hint">Close the open poll before opening this one.</p>
      ) : null}
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
  const [failure, run] = useFailure()

  const load = useCallback(() => {
    void run(() => fetchAdminPolls().then(setPolls), 'load the polls')
    void usePoll.getState().refresh()
  }, [run])

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
