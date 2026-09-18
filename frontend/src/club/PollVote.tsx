import './club.css'
import { useId, useState } from 'react'
import { failureText } from './Field'
import { tally } from './poll'
import { usePoll } from './polls'
import type { Poll, PollOption } from './types'

function OptionThumb({ option }: { option: PollOption }) {
  return option.thumbUrl === null ? (
    <span className="film-thumb film-thumb--blank" />
  ) : (
    <img className="film-thumb" src={option.thumbUrl} alt="" loading="lazy" />
  )
}

function OptionLabel({ option }: { option: PollOption }) {
  return (
    <span className="poll__film">
      {option.title}
      {option.year === null ? null : <span className="poll__year"> {option.year}</span>}
    </span>
  )
}

function Results({ poll }: { poll: Poll }) {
  const rows = tally(poll.options)
  return (
    <>
      <ul className="poll__results">
        {rows.map((row) => (
          <li key={row.option.id} className={row.leading ? 'result result--leading' : 'result'}>
            <OptionThumb option={row.option} />
            <div className="result__body">
              <div className="result__line">
                <OptionLabel option={row.option} />
                <span className="result__count">
                  {row.votes} · {row.percent}%
                </span>
              </div>
              <span className="result__bar" style={{ width: `${row.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="club-form__hint">
        {poll.totalVotes ?? 0} vote{poll.totalVotes === 1 ? '' : 's'} · this poll is closed
      </p>
    </>
  )
}

function voteHint(poll: Poll, changed: boolean): string {
  const hints: [boolean, string][] = [
    [poll.myVote === null, 'Pick one. You can change your vote until the hosts close the poll.'],
    [changed, 'Save to switch your vote.'],
  ]
  return (
    hints.find(([when]) => when)?.[1] ?? 'Your vote is in. You can change it until the poll closes.'
  )
}

function Choices({ poll }: { poll: Poll }) {
  const name = useId()
  const vote = usePoll((state) => state.vote)
  const [chosen, setChosen] = useState<number | null>(poll.myVote)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const changed = chosen !== null && chosen !== poll.myVote

  const submit = async () => {
    setBusy(true)
    setFailure(null)
    try {
      await vote(chosen ?? 0)
    } catch (error) {
      setFailure(failureText(error, 'record your vote'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <fieldset className="poll__options">
        <legend className="visually-hidden">{poll.question}</legend>
        {poll.options.map((option) => (
          <label key={option.id} className="poll__option">
            <input
              type="radio"
              name={name}
              checked={chosen === option.id}
              onChange={() => setChosen(option.id)}
            />
            <OptionThumb option={option} />
            <OptionLabel option={option} />
            {poll.myVote === option.id ? <span className="poll__mine">Your vote</span> : null}
          </label>
        ))}
      </fieldset>
      {failure === null ? null : (
        <p className="club-form__problem" role="alert">
          {failure}
        </p>
      )}
      <p className="club-form__hint">{voteHint(poll, changed)}</p>
      <button
        type="button"
        className="button club-form__submit"
        disabled={!changed || busy}
        onClick={submit}
      >
        {poll.myVote === null ? 'Vote' : 'Change my vote'}
      </button>
    </>
  )
}

export function PollVote({ poll }: { poll: Poll }) {
  return (
    <div className="poll">
      <p className="poll__question">{poll.question}</p>
      {poll.status === 'closed' ? <Results poll={poll} /> : <Choices key={poll.id} poll={poll} />}
    </div>
  )
}
