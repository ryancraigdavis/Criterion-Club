import { type ReactNode, useEffect, useState } from 'react'
import { Choice, Field } from './Field'
import { DEBOUNCE_MS, type Film, searchable, searchFilms } from './films'

interface Results {
  films: Film[]
  failed: boolean
}

const NOTHING: Results = { films: [], failed: false }

function useSearch(query: string): Results {
  const [results, setResults] = useState<Results>(NOTHING)
  useEffect(() => {
    if (!searchable(query)) {
      setResults(NOTHING)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchFilms(query, controller.signal)
        .then((films) => setResults({ films, failed: false }))
        .catch((error: Error) => {
          if (error.name !== 'AbortError') {
            setResults({ films: [], failed: true })
          }
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])
  return results
}

export function ChosenFilm({
  title,
  year,
  onChange,
}: {
  title: string
  year: string
  onChange: () => void
}) {
  return (
    <div className="film-chosen">
      <div className="film-chosen__text">
        <strong>{title}</strong>
        <span>{year || 'Year unknown'}</span>
      </div>
      <button type="button" className="chip" onClick={onChange}>
        Change
      </button>
    </div>
  )
}

function FilmThumb({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false)
  return url === null || broken ? (
    <span className="film-search__thumb film-search__thumb--blank" />
  ) : (
    <img
      className="film-search__thumb"
      src={url}
      alt=""
      width={32}
      height={48}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  )
}

export function FilmSearch({ onPick }: { onPick: (film: Film) => void }) {
  const [query, setQuery] = useState('')
  const { films, failed } = useSearch(query)
  return (
    <div className="film-search">
      <input
        className="field__input"
        type="search"
        value={query}
        placeholder="Search the library"
        aria-label="Search the library"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => setQuery(event.target.value)}
      />
      <span className="field__hint">
        Put a title in "quotes" to find exactly that film, like "M".
      </span>
      {failed ? (
        <span className="field__problem">
          The library isn’t answering. Add the film as “Not in the library” instead.
        </span>
      ) : null}
      {films.length === 0 ? null : (
        <ul className="film-search__results">
          {films.map((film) => (
            <li key={film.itemId}>
              <button type="button" className="film-search__row" onClick={() => onPick(film)}>
                <FilmThumb url={film.thumbUrl} />
                <span className="film-search__title">{film.title}</span>
                <span className="film-search__year">{film.year ?? ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type Source = 'library' | 'other'

const SOURCES: { value: Source; label: string }[] = [
  { value: 'library', label: 'From the library' },
  { value: 'other', label: 'Not in the library' },
]

interface FilmFieldsProps {
  itemId: string | null
  title: string
  year: string
  problems: { film?: string; year?: string }
  onPick: (film: Film) => void
  onClear: () => void
  onTyped: (patch: { title?: string; year?: string }) => void
  extra?: ReactNode
}

function TypedFilm({ title, year, problems, onTyped, extra }: FilmFieldsProps) {
  return (
    <div className="editor__row">
      <Field label="Title" problem={problems.film}>
        {(id) => (
          <input
            id={id}
            className="field__input"
            value={title}
            onChange={(e) => onTyped({ title: e.target.value })}
          />
        )}
      </Field>
      <Field label="Year" problem={problems.year}>
        {(id) => (
          <input
            id={id}
            className="field__input"
            inputMode="numeric"
            value={year}
            onChange={(e) => onTyped({ year: e.target.value })}
          />
        )}
      </Field>
      {extra}
    </div>
  )
}

function LibraryFilm({ itemId, title, year, problems, onPick, onClear }: FilmFieldsProps) {
  return (
    <>
      {itemId === null ? (
        <FilmSearch onPick={onPick} />
      ) : (
        <ChosenFilm title={title} year={year} onChange={onClear} />
      )}
      {problems.film === undefined ? null : <span className="field__problem">{problems.film}</span>}
    </>
  )
}

export function FilmFields(props: FilmFieldsProps) {
  const [source, setSource] = useState<Source>(props.itemId || !props.title ? 'library' : 'other')
  const choose = (next: Source) => {
    setSource(next)
    props.onClear()
  }
  return (
    <div className="film-fields">
      <Choice legend="Film" options={SOURCES} value={source} onChange={choose} />
      {source === 'library' ? <LibraryFilm {...props} /> : <TypedFilm {...props} />}
    </div>
  )
}
