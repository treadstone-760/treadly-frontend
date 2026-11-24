import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { PasswordInput } from '../components/PasswordInput'
import { Banner, Button, Field, submit, text } from '../components/ui'

function AuthLayout({
  title,
  lede,
  children,
}: {
  title: string
  lede: string
  children: ReactNode
}) {
  return (
    <main className="auth">
      <section className="auth-story">
        <p className="eyebrow">TREADLY</p>
        <h1>Money, written down properly.</h1>
        <p>
          Income, expenses, transfers, debts, and savings stay on a balanced ledger. Amounts are recorded in
          cedis first, and every book belongs to a workspace you control.
        </p>
      </section>
      <section className="auth-card">
        <h2>{title}</h2>
        <p className="lede">{lede}</p>
        {children}
      </section>
    </main>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)

  return (
    <AuthLayout title="Sign in" lede="Use the email and password for your TREADLY account.">
      <form
        onSubmit={submit(async (form) => {
          setPending(true)
          setError(null)
          try {
            await login(text(form, 'email'), text(form, 'password'))
          } catch (caught) {
            setError(caught)
          } finally {
            setPending(false)
          }
        })}
      >
        {error ? <Banner>{errorMessage(error)}</Banner> : null}
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <PasswordInput name="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="auth-links">
        <Link to="/forgot-password">Forgot password</Link>
        <Link to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)

  return (
    <AuthLayout title="Open a book" lede="A personal workspace is created with your account.">
      <form
        onSubmit={submit(async (form) => {
          setPending(true)
          setError(null)
          try {
            const workspaceName = text(form, 'workspace_name')
            await register({
              name: text(form, 'name'),
              email: text(form, 'email'),
              password: text(form, 'password'),
              password_confirmation: text(form, 'password_confirmation'),
              currency: text(form, 'currency') || 'GHS',
              ...(workspaceName ? { workspace_name: workspaceName } : {}),
            })
          } catch (caught) {
            setError(caught)
          } finally {
            setPending(false)
          }
        })}
      >
        {error ? <Banner>{errorMessage(error)}</Banner> : null}
        <Field label="Name">
          <input name="name" required maxLength={120} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <PasswordInput name="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Confirm password">
          <PasswordInput name="password_confirmation" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Workspace name" hint="Leave blank to use your name.">
          <input name="workspace_name" maxLength={120} />
        </Field>
        <Field label="Currency">
          <input name="currency" defaultValue="GHS" maxLength={3} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create account'}
        </Button>
      </form>
      <p className="auth-links">
        <Link to="/login">Already have an account</Link>
      </p>
    </AuthLayout>
  )
}

export function ForgotPage() {
  const [error, setError] = useState<unknown>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <AuthLayout title="Reset password" lede="If the email is registered, a reset link is sent.">
      <form
        onSubmit={submit(async (form) => {
          setPending(true)
          setError(null)
          try {
            const response = await api.post<{ message: string }>('/auth/forgot-password', {
              email: text(form, 'email'),
            })
            setMessage(response.data.message)
          } catch (caught) {
            setError(caught)
          } finally {
            setPending(false)
          }
        })}
      >
        {error ? <Banner>{errorMessage(error)}</Banner> : null}
        {message ? <p className="notice">{message}</p> : null}
        <Field label="Email">
          <input name="email" type="email" required />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <p className="auth-links">
        <Link to="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  )
}

export function ResetPage() {
  const [params] = useSearchParams()
  const [error, setError] = useState<unknown>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <AuthLayout title="Choose a new password" lede="This uses the token from your reset email.">
      <form
        onSubmit={submit(async (form) => {
          setPending(true)
          setError(null)
          try {
            const response = await api.post<{ message: string }>('/auth/reset-password', {
              email: text(form, 'email'),
              token: text(form, 'token'),
              password: text(form, 'password'),
              password_confirmation: text(form, 'password_confirmation'),
            })
            setMessage(response.data.message)
          } catch (caught) {
            setError(caught)
          } finally {
            setPending(false)
          }
        })}
      >
        {error ? <Banner>{errorMessage(error)}</Banner> : null}
        {message ? <p className="notice">{message}</p> : null}
        <Field label="Email">
          <input name="email" type="email" defaultValue={params.get('email') ?? ''} required />
        </Field>
        <Field label="Token">
          <input name="token" defaultValue={params.get('token') ?? ''} required />
        </Field>
        <Field label="New password">
          <PasswordInput name="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Confirm password">
          <PasswordInput name="password_confirmation" autoComplete="new-password" minLength={8} required />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Update password'}
        </Button>
      </form>
      <p className="auth-links">
        <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  )
}
