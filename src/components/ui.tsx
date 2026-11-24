import type { FormEvent, ReactNode } from 'react'
import { errorMessage } from '../api/client'
import { formatMoney, isNegative, labelize } from '../lib/format'
import type { AmountRow } from '../api/types'

export function Banner({ children }: { children: ReactNode }) {
  return <p className="banner">{children}</p>
}

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null
  return <Banner>{errorMessage(error)}</Banner>
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  action,
}: {
  eyebrow?: string
  title: string
  lede?: string
  action?: ReactNode
}) {
  return (
    <header className="page-head">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {action}
    </header>
  )
}

export function Button({
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'quiet'
}) {
  return <button {...props} className={`btn ${variant} ${props.className ?? ''}`.trim()} />
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

export function QueryState({
  isLoading,
  error,
  children,
}: {
  isLoading: boolean
  error: unknown
  children: ReactNode
}) {
  if (isLoading) return <p className="muted">Loading…</p>
  if (error) return <ErrorBanner error={error} />
  return children
}

export function Money({
  amount,
  currency,
}: {
  amount: string | number | null | undefined
  currency?: string
}) {
  const text = String(amount ?? '0')
  return <span className={isNegative(text) ? 'money neg' : 'money'}>{formatMoney(amount, currency)}</span>
}

export function Badge({ value }: { value: string }) {
  const tone =
    value === 'posted' || value === 'active' || value === 'within_limit' || value === 'shared'
      ? 'good'
      : value === 'voided' || value === 'exceeded' || value === 'archived' || value === 'private'
        ? 'warn'
        : value === 'approaching' || value === 'paused'
          ? 'gold'
          : ''
  return <span className={`badge ${tone}`}>{labelize(value)}</span>
}

export function BarList({ rows, currency }: { rows: AmountRow[]; currency: string }) {
  if (rows.length === 0) return <p className="muted">Nothing recorded in this period.</p>
  const max = Math.max(...rows.map((row) => Math.abs(Number(row.amount) || 0)), 1)
  return (
    <ul className="bars">
      {rows.map((row) => (
        <li key={row.id}>
          <div className="bar-label">
            <span>{row.name}</span>
            <Money amount={row.amount} currency={currency} />
          </div>
          <div className="bar-track">
            <span style={{ width: `${(Math.abs(Number(row.amount) || 0) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function submit(handler: (form: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    handler(new FormData(event.currentTarget))
  }
}

export function text(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim()
}
