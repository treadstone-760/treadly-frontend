import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { AppNotification, Page } from '../api/types'
import { useAuth } from '../auth/AuthProvider'
import { PasswordInput } from '../components/PasswordInput'
import { Button, ErrorBanner, Field, PageHeader, QueryState, submit, text } from '../components/ui'

const events = [
  'budget.approaching',
  'budget.exceeded',
  'recurring.upcoming',
  'debt.upcoming',
  'debt.paid',
  'savings.goal_achieved',
  'workspace.invitation',
  'receipt.processed',
]

export function SettingsPage() {
  const { user, refresh } = useAuth()
  const queryClient = useQueryClient()
  const notes = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<Page<AppNotification>>('/notifications')).data,
  })
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
  const read = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/${id}/read`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  const preference = useMutation({
    mutationFn: async (event: string) => {
      await api.put('/notification-preferences', { event, channel: 'database', enabled: true })
    },
  })

  if (!user) return null

  return (
    <>
      <PageHeader eyebrow="Settings" title="Your profile" lede="These details belong to you, not to a single workspace." />
      <ErrorBanner error={profile.error ?? password.error ?? verify.error ?? read.error ?? preference.error} />
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
      <section className="card">
        <h2>Notifications</h2>
        <QueryState isLoading={notes.isLoading} error={notes.error}>
          {notes.data && notes.data.data.length === 0 ? <p className="muted">No notifications yet.</p> : null}
          <ul className="plain">
            {notes.data?.data.map((note) => (
              <li key={note.id}>
                <span>
                  <strong>{note.data.title || 'Notice'}</strong>
                  <small>{note.data.body}</small>
                </span>
                {!note.read_at ? (
                  <Button type="button" variant="quiet" onClick={() => read.mutate(note.id)}>
                    Mark read
                  </Button>
                ) : (
                  <span className="muted">Read</span>
                )}
              </li>
            ))}
          </ul>
        </QueryState>
        <h3>In-app alerts</h3>
        <div className="chips">
          {events.map((event) => (
            <Button key={event} type="button" variant="quiet" onClick={() => preference.mutate(event)}>
              Enable {event}
            </Button>
          ))}
        </div>
        {preference.isSuccess ? <p className="muted">Preference saved for in-app notices.</p> : null}
      </section>
    </>
  )
}
