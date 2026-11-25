import { useMutation } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { PasswordInput } from '../components/PasswordInput'
import { Button, ErrorBanner, Field, PageHeader, submit, text } from '../components/ui'

export function SettingsPage() {
  const { user, refresh } = useAuth()
  const profile = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      await api.put('/auth/profile', body)
    },
    onSuccess: async () => {
      await refresh()
    },
  })
  const password = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      await api.put('/auth/password', body)
    },
  })
  const verify = useMutation({
    mutationFn: async () => {
      await api.post('/auth/email/verification-notification')
    },
  })

  if (!user) return null

  return (
    <>
      <PageHeader eyebrow="Settings" title="Your profile" lede="These details belong to you, not to a single workspace." />
      <ErrorBanner error={profile.error ?? password.error ?? verify.error} />
      <div className="grid-2">
        <form
          className="card stack"
          onSubmit={submit((form) => {
            profile.mutate({
              name: text(form, 'name'),
              phone: text(form, 'phone'),
              timezone: text(form, 'timezone'),
              currency: text(form, 'currency').toUpperCase(),
            })
          })}
        >
          <h2>Profile</h2>
          <Field label="Name">
            <input name="name" defaultValue={user.name} required />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={user.phone ?? ''} />
          </Field>
          <Field label="Timezone">
            <input name="timezone" defaultValue={user.timezone || 'Africa/Accra'} required />
          </Field>
          <Field label="Currency">
            <input name="currency" defaultValue={user.currency || 'GHS'} maxLength={3} required />
          </Field>
          <Button type="submit" disabled={profile.isPending}>
            {profile.isPending ? 'Saving…' : profile.isSuccess ? 'Saved' : 'Save profile'}
          </Button>
        </form>
        <form
          className="card stack"
          onSubmit={submit((form) => {
            password.mutate({
              current_password: text(form, 'current_password'),
              password: text(form, 'password'),
              password_confirmation: text(form, 'password_confirmation'),
            })
          })}
        >
          <h2>Password</h2>
          <Field label="Current password">
            <PasswordInput name="current_password" autoComplete="current-password" required />
          </Field>
          <Field label="New password">
            <PasswordInput name="password" autoComplete="new-password" minLength={8} required />
          </Field>
          <Field label="Confirm new password">
            <PasswordInput name="password_confirmation" autoComplete="new-password" minLength={8} required />
          </Field>
          <Button type="submit" disabled={password.isPending}>
            {password.isPending ? 'Updating…' : password.isSuccess ? 'Password updated' : 'Change password'}
          </Button>
          {!user.email_verified_at ? (
            <Button type="button" variant="ghost" onClick={() => verify.mutate()}>
              {verify.isSuccess ? 'Verification email sent' : 'Send verification email'}
            </Button>
          ) : (
            <p className="muted">Email verified.</p>
          )}
        </form>
      </div>
    </>
  )
}
