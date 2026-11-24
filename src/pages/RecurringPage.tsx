import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { Account, Category, List, Recurring } from '../api/types'
import { RequireWorkspace, useWorkspace } from '../auth/WorkspaceProvider'
import { DeleteConfirm } from '../components/DeleteConfirm'
import { AccountField, CategoryField } from '../components/picks'
import { Badge, Button, Empty, ErrorBanner, Field, Modal, Money, PageHeader, QueryState, submit, text } from '../components/ui'
import { canWrite } from '../lib/format'

export function RecurringPage() {
  return (
    <RequireWorkspace>
      {(workspace) => <RecurringView id={workspace.id} currency={workspace.base_currency} />}
    </RequireWorkspace>
  )
}

function RecurringView({ id, currency }: { id: string; currency: string }) {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const writable = canWrite(workspace?.role)
  const [open, setOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const rows = useQuery({
    queryKey: ['recurring', id],
    queryFn: async () => (await api.get<List<Recurring>>(`/workspaces/${id}/recurring-transactions`)).data.data,
  })
  const accounts = useQuery({
    queryKey: ['accounts', id],
    queryFn: async () => (await api.get<List<Account>>(`/workspaces/${id}/accounts`)).data.data,
  })
  const categories = useQuery({
    queryKey: ['categories', id],
    queryFn: async () => (await api.get<List<Category>>(`/workspaces/${id}/categories`)).data.data,
  })
  const create = useMutation({
    mutationFn: async (body: Record<string, string | number>) => {
      await api.post(`/workspaces/${id}/recurring-transactions`, body)
    },
    onSuccess: async () => {
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['recurring', id] })
    },
  })
  const remove = useMutation({
    mutationFn: async (scheduleId: string) => {
      await api.delete(`/recurring-transactions/${scheduleId}`)
    },
    onSuccess: async () => {
      setPendingDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['recurring', id] })
    },
  })
  const toggle = useMutation({
    mutationFn: async (item: Recurring) => {
      const action = item.status === 'paused' ? 'resume' : 'pause'
      await api.post(`/recurring-transactions/${item.id}/${action}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['recurring', id] })
    },
  })

  return (
    <>
      <PageHeader
        eyebrow="Recurring"
        title="Money that repeats"
        lede="The scheduler posts each occurrence once. Pausing stops future posts without deleting history."
        action={
          writable ? (
            <Button type="button" onClick={() => setOpen(true)}>
              New schedule
            </Button>
          ) : null
        }
      />
      <ErrorBanner error={create.error ?? toggle.error} />
      <QueryState isLoading={rows.isLoading} error={rows.error}>
        {rows.data && rows.data.length === 0 ? (
          <Empty title="Nothing repeats yet" body="Add rent, salary, or a subscription. The next date is shown on each row." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Every</th>
                  <th>Next</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.data?.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.description || labelFallback(item.type)}</strong>
                      <small>
                        <Badge value={item.status} />
                      </small>
                    </td>
                    <td>
                      {item.interval_count} {item.frequency}
                    </td>
                    <td>{item.next_occurrence || '—'}</td>
                    <td>
                      <Money amount={item.amount} currency={item.currency} />
                    </td>
                    <td>
                      {writable ? (
                        <div className="row-actions">
                          <Button type="button" variant="quiet" onClick={() => toggle.mutate(item)}>
                            {item.status === 'paused' ? 'Resume' : 'Pause'}
                          </Button>
                          <Button type="button" variant="quiet" onClick={() => setPendingDelete(item.id)}>
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
      {open && accounts.data && categories.data ? (
        <Modal title="New recurring transaction" onClose={() => setOpen(false)}>
          <form
            className="stack"
            onSubmit={submit((form) => {
              create.mutate({
                type: text(form, 'type'),
                account_id: text(form, 'account_id'),
                category_id: text(form, 'category_id'),
                amount: text(form, 'amount'),
                currency: text(form, 'currency').toUpperCase(),
                description: text(form, 'description'),
                frequency: text(form, 'frequency'),
                interval_count: 1,
                start_date: dateFromDays(Number(text(form, 'next_up_days') || '0')),
                end_date: text(form, 'end_date'),
              })
            })}
          >
            <Field label="Type">
              <select
                name="type"
                value={type}
                onChange={(event) => setType(event.target.value as 'income' | 'expense')}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </Field>
            <AccountField accounts={accounts.data} name="account_id" label="Account" required />
            <CategoryField categories={categories.data} name="category_id" type={type} />
            <Field label="Amount">
              <input name="amount" inputMode="decimal" required />
            </Field>
            <Field label="Currency">
              <input name="currency" defaultValue={currency} maxLength={3} required />
            </Field>
            <Field label="Description">
              <input name="description" />
            </Field>
            <Field label="Frequency">
              <select name="frequency" defaultValue="monthly">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </Field>
            <Field label="Next up (days)" hint="Days from today until this is next due. It then repeats on the frequency above.">
              <input name="next_up_days" type="number" min={0} defaultValue={1} required />
            </Field>
            <Field label="Ends">
              <input name="end_date" type="date" />
            </Field>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Save schedule'}
            </Button>
          </form>
        </Modal>
      ) : null}
      {pendingDelete ? (
        <DeleteConfirm
          path={`/recurring-transactions/${pendingDelete}/deletion-preview`}
          pending={remove.isPending}
          error={remove.error}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => remove.mutate(pendingDelete)}
        />
      ) : null}
    </>
  )
}

function labelFallback(type: string): string {
  return type === 'income' ? 'Recurring income' : 'Recurring expense'
}

function dateFromDays(days: number): string {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + (Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0))
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
