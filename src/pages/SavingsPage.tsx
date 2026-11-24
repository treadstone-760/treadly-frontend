import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, idempotencyHeaders } from '../api/client'
import type { Account, List, SavingsGoal } from '../api/types'
import { RequireWorkspace, useWorkspace } from '../auth/WorkspaceProvider'
import { AccountField } from '../components/picks'
import { Badge, Button, Empty, ErrorBanner, Field, Modal, Money, PageHeader, QueryState, submit, text } from '../components/ui'
import { canWrite, today } from '../lib/format'

export function SavingsPage() {
  return (
    <RequireWorkspace>
      {(workspace) => <SavingsView id={workspace.id} currency={workspace.base_currency} />}
    </RequireWorkspace>
  )
}

function SavingsView({ id, currency }: { id: string; currency: string }) {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const writable = canWrite(workspace?.role)
  const [creating, setCreating] = useState(false)
  const [active, setActive] = useState<SavingsGoal | null>(null)
  const [mode, setMode] = useState<'contribute' | 'withdraw'>('contribute')
  const goals = useQuery({
    queryKey: ['savings', id],
    queryFn: async () => (await api.get<List<SavingsGoal>>(`/workspaces/${id}/savings-goals`)).data.data,
  })
  const accounts = useQuery({
    queryKey: ['accounts', id],
    queryFn: async () => (await api.get<List<Account>>(`/workspaces/${id}/accounts`)).data.data,
  })
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['savings', id] })
    await queryClient.invalidateQueries({ queryKey: ['accounts', id] })
    await queryClient.invalidateQueries({ queryKey: ['transactions', id] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard', id] })
  }
  const create = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      await api.post(`/workspaces/${id}/savings-goals`, body)
    },
    onSuccess: async () => {
      setCreating(false)
      await invalidate()
    },
  })
  const move = useMutation({
    mutationFn: async (body: { goal: SavingsGoal; payload: Record<string, string>; kind: 'contribute' | 'withdraw' }) => {
      const path = body.kind === 'contribute' ? 'contributions' : 'withdrawals'
      await api.post(`/savings-goals/${body.goal.id}/${path}`, body.payload, { headers: idempotencyHeaders() })
    },
    onSuccess: async () => {
      setActive(null)
      await invalidate()
    },
  })

  return (
    <>
      <PageHeader
        eyebrow="Savings"
        title="Goals with a target"
        lede="A contribution takes money out of the account you choose. A withdrawal puts that money back into the account you choose."
        action={
          writable ? (
            <Button type="button" onClick={() => setCreating(true)}>
              New goal
            </Button>
          ) : null
        }
      />
      <ErrorBanner error={create.error ?? move.error} />
      <QueryState isLoading={goals.isLoading} error={goals.error}>
        {goals.data && goals.data.length === 0 ? (
          <Empty title="No savings goals" body="Link a goal to an account, then contribute from that account or another one." />
        ) : (
          <div className="card-list">
            {goals.data?.map((goal) => {
              const ratio = Math.min(100, (Number(goal.saved) / Number(goal.target_amount || 1)) * 100)
              return (
                <article key={goal.id} className="card">
                  <header className="split">
                    <h2>{goal.name}</h2>
                    <Badge value={goal.status} />
                  </header>
                  <p>
                    <Money amount={goal.saved} currency={goal.currency} /> of{' '}
                    <Money amount={goal.target_amount} currency={goal.currency} />
                  </p>
                  <div className="bar-track">
                    <span style={{ width: `${Number.isFinite(ratio) ? ratio : 0}%` }} />
                  </div>
                  <p className="muted">
                    {goal.account ? goal.account.name : 'No account'}
                    {goal.target_date ? ` · target ${goal.target_date}` : ''}
                  </p>
                  {writable && goal.account_id && goal.status === 'active' ? (
                    <div className="row-actions">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setMode('contribute')
                          setActive(goal)
                        }}
                      >
                        Contribute
                      </Button>
                      <Button
                        type="button"
                        variant="quiet"
                        onClick={() => {
                          setMode('withdraw')
                          setActive(goal)
                        }}
                      >
                        Withdraw
                      </Button>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </QueryState>
      {creating && accounts.data ? (
        <Modal title="New savings goal" onClose={() => setCreating(false)}>
          <form
            className="stack"
            onSubmit={submit((form) => {
              create.mutate({
                name: text(form, 'name'),
                target_amount: text(form, 'target_amount'),
                currency: text(form, 'currency').toUpperCase(),
                target_date: text(form, 'target_date'),
                account_id: text(form, 'account_id'),
              })
            })}
          >
            <Field label="Name">
              <input name="name" required />
            </Field>
            <Field label="Target amount">
              <input name="target_amount" inputMode="decimal" required />
            </Field>
            <Field label="Currency">
              <input name="currency" defaultValue={currency} maxLength={3} required />
            </Field>
            <Field label="Target date">
              <input name="target_date" type="date" />
            </Field>
            <AccountField accounts={accounts.data} name="account_id" label="Goal account" required />
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Save goal'}
            </Button>
          </form>
        </Modal>
      ) : null}
      {active && accounts.data ? (
        <Modal title={mode === 'contribute' ? `Add to ${active.name}` : `Withdraw from ${active.name}`} onClose={() => setActive(null)}>
          <form
            className="stack"
            onSubmit={submit((form) => {
              move.mutate({
                goal: active,
                kind: mode,
                payload: {
                  amount: text(form, 'amount'),
                  ...(mode === 'contribute'
                    ? { source_account_id: text(form, 'account_id') }
                    : { destination_account_id: text(form, 'account_id') }),
                  contributed_at: text(form, 'contributed_at'),
                  notes: text(form, 'notes'),
                },
              })
            })}
          >
            <Field label="Amount">
              <input name="amount" inputMode="decimal" required />
            </Field>
            <p className="muted">
              {mode === 'contribute'
                ? 'This amount leaves the account and is kept on the goal.'
                : 'This amount leaves the goal and is added to the account.'}
            </p>
            <AccountField
              accounts={accounts.data}
              name="account_id"
              label={mode === 'contribute' ? 'From account' : 'To account'}
              required
            />
            <Field label="Date">
              <input name="contributed_at" type="date" defaultValue={today()} />
            </Field>
            <Field label="Note">
              <input name="notes" />
            </Field>
            <Button type="submit" disabled={move.isPending}>
              {move.isPending ? 'Posting…' : 'Post'}
            </Button>
          </form>
        </Modal>
      ) : null}
    </>
  )
}
