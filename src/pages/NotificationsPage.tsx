import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { AppNotification, Page } from '../api/types'
import { Button, ErrorBanner, PageHeader, QueryState } from '../components/ui'
import { labelize } from '../lib/format'

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

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const notes = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<Page<AppNotification>>('/notifications')).data,
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

  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="What arrived"
        lede="Reminders and workspace notices land here. Opening this menu clears the count until something new arrives."
      />
      <ErrorBanner error={notes.error ?? read.error ?? preference.error} />
      <section className="card">
        <QueryState isLoading={notes.isLoading} error={notes.error}>
          {notes.data && notes.data.data.length === 0 ? <p className="muted">No notifications yet.</p> : null}
          <ul className="plain">
            {notes.data?.data.map((note) => (
              <li key={note.id}>
                <span>
                  <strong>{note.data?.title || 'Notice'}</strong>
                  <small>{note.data?.body}</small>
                  <small>{when(note.created_at)}</small>
                </span>
                {!note.read_at ? (
                  <Button type="button" variant="quiet" onClick={() => read.mutate(note.id)} disabled={read.isPending}>
                    Mark read
                  </Button>
                ) : (
                  <span className="muted">Read</span>
                )}
              </li>
            ))}
          </ul>
        </QueryState>
      </section>
      <section className="card stack">
        <h2>In-app alerts</h2>
        <p className="muted">Turn an alert on for this account. New notices still follow these choices.</p>
        <div className="chips">
          {events.map((event) => (
            <Button key={event} type="button" variant="quiet" onClick={() => preference.mutate(event)}>
              Enable {labelize(event)}
            </Button>
          ))}
        </div>
        {preference.isSuccess ? <p className="muted">Preference saved for in-app notices.</p> : null}
      </section>
    </>
  )
}

function when(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
