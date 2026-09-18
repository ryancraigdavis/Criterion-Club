import { type ReactNode, useId } from 'react'

interface FieldProps {
  label: string
  problem?: string
  hint?: string
  children: (id: string) => ReactNode
}

export function Field({ label, problem, hint, children }: FieldProps) {
  const id = useId()
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint === undefined ? null : <span className="field__hint">{hint}</span>}
      {problem === undefined ? null : <span className="field__problem">{problem}</span>}
    </div>
  )
}

interface ChoiceProps<T extends string> {
  legend: string
  options: readonly { value: T; label: string }[]
  value: T | null
  problem?: string
  onChange: (value: T) => void
}

export function Choice<T extends string>({
  legend,
  options,
  value,
  problem,
  onChange,
}: ChoiceProps<T>) {
  return (
    <fieldset className="segmented choice">
      <legend className="field__label">{legend}</legend>
      <div className="options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="chip"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {problem === undefined ? null : <span className="field__problem">{problem}</span>}
    </fieldset>
  )
}

export function failureText(error: unknown, action: string): string {
  return error instanceof Error ? `Couldn’t ${action}: ${error.message}` : `Couldn’t ${action}.`
}
