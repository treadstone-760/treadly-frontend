import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, idempotencyHeaders } from '../api/client'
import type { Account, Category, Debt, List } from '../api/types'
import { RequireWorkspace, useWorkspace } from '../auth/WorkspaceProvider'
import { AccountField, CategoryField } from '../components/picks'
import { Badge, Button, Empty, ErrorBanner, Field, Modal, Money, PageHeader, QueryState, submit, text } from '../components/ui'
import { canWrite, labelize, today } from '../lib/format'

export function DebtsPage() {
  return (
    <RequireWorkspace>
      {(workspace) => <DebtsView id={workspace.id} currency={workspace.base_currency} />}
    </RequireWorkspace>
  )
}

function DebtsView({ id, currency }: { id: string; currency: string }) {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const writable = canWrite(workspace?.role)
  const [creating, setCreating] = useState(false)
  const [direction, setDirection] = useState('borrowed')
  const [openId, setOpenId] = useState<string | null>(null)
  const [panel, setPanel] = useState<'activity' | 'spend' | 'repay'>('activity')
  const debts = useQuery({
    queryKey: ['debts', id],
    queryFn: async () => (await api.get<List<Debt>>(`/workspaces/${id}/debts`)).data.data,
  })
  const accounts = useQuery({
    queryKey: ['accounts', id],
    queryFn: async () => (await api.get<List<Account>>(`/workspaces/${id}/accounts`)).data.data,
  })
  const categories = useQuery({
    queryKey: ['categories', id],
    queryFn: async () => (await api.get<List<Category>>(`/workspaces/${id}/categories`)).data.data,
  })
  const detail = useQuery({
    queryKey: ['debt', openId],
    enabled: Boolean(openId),
    queryFn: async () => (await api.get<{ data: Debt }>(`/debts/${openId}`)).data.data,
  })
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['debts', id] })
    await queryClient.invalidateQueries({ queryKey: ['debt', openId] })
    await queryClient.invalidateQueries({ queryKey: ['accounts', id] })
    await queryClient.invalidateQueries({ queryKey: ['transactions', id] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard', id] })
  }
  const create = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      await api.post(`/workspaces/${id}/debts`, body, { headers: idempotencyHeaders() })
    },
    onSuccess: async () => {
      setCreating(false)
      await refresh()
    },
  })
  const repay = useMutation({
    mutationFn: async (body: { debtId: string; payload: Record<string, string> }) => {
      await api.post(`/debts/${body.debtId}/repayments`, body.payload, { headers: idempotencyHeaders() })
    },
    onSuccess: async () => {
      setPanel('activity')
      await refresh()
    },
  })
  const spend = useMutation({
    mutationFn: async (body: { debtId: string; payload: Record<string, string> }) => {
      await api.post(`/debts/${body.debtId}/uses`, body.payload, { headers: idempotencyHeaders() })
    },
    onSuccess: async () => {
      setPanel('activity')
      await refresh()
    },
  })
  const loan = detail.data

  return (
    <>
      <PageHeader
        eyebrow="Debts"
        title="Loans and what they paid for"
        lede="The loan lands in one account. Each project payment leaves an account you choose and is kept on the loan. Each instalment leaves the account that services it."
        action={
          writable ? (
            <Button
              type="button"
              onClick={() => {
                setDirection('borrowed')
                setCreating(true)
              }}
            >
              Record loan
            </Button>
          ) : null
        }
      />
      <ErrorBanner error={create.error} />
      <QueryState isLoading={debts.isLoading} error={debts.error}>
        {debts.data && debts.data.length === 0 ? (
          <Empty
            title="No loans yet"
            body="Record a loan into the account that receives the money. Then track project payments and repayments from the accounts that actually move."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Loan</th>
                  <th>Received in</th>
                  <th>Used on the project</th>
                  <th>Still owed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {debts.data?.map((debt) => (
                  <tr key={debt.id}>
                    <td>
                      <strong>{debt.counterparty_name}</strong>
                      <small>
                        {labelize(debt.direction)}
                        {debt.notes ? ` · ${debt.notes}` : ''}
                      </small>
                    </td>
                    <td>{debt.account?.name || '—'}</td>
                    <td>
                      {debt.direction === 'borrowed' ? (
                        <>
                          <Money amount={debt.used} currency={debt.currency} />
                          <small>
                            <Money amount={debt.unspent} currency={debt.currency} /> still to spend
                          </small>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <Money amount={debt.outstanding} currency={debt.currency} />
                      <small>
                        of <Money amount={debt.principal} currency={debt.currency} />
                      </small>
                    </td>
                    <td>
                      {debt.status === 'active' ? (
                        <Button
                          type="button"
                          variant="quiet"
                          onClick={() => {
                            setOpenId(debt.id)
                            setPanel('activity')
                          }}
                        >
                          Track
                        </Button>
                      ) : (
                        <Badge value={debt.status} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
      {creating && accounts.data ? (
        <Modal title="New loan" onClose={() => setCreating(false)}>
          <form
            className="stack"
            onSubmit={submit((form) => {
              create.mutate({
                direction: text(form, 'direction'),
                counterparty_name: text(form, 'counterparty_name'),
                principal: text(form, 'principal'),
                currency: text(form, 'currency').toUpperCase(),
                account_id: text(form, 'account_id'),
                start_date: text(form, 'start_date'),
                due_date: text(form, 'due_date'),
                notes: text(form, 'notes'),
              })
            })}
          >
            <Field label="Direction">
              <select name="direction" value={direction} onChange={(event) => setDirection(event.target.value)}>
                <option value="borrowed">I borrowed this</option>
                <option value="lent">I lent this</option>
              </select>
            </Field>
            <Field label="Lender or borrower">
              <input name="counterparty_name" required placeholder="Bank or person" />
            </Field>
            <Field label="Amount">
              <input name="principal" inputMode="decimal" required />
            </Field>
            <Field label="Currency">
              <input name="currency" defaultValue={currency} maxLength={3} required />
            </Field>
            <AccountField
              accounts={accounts.data}
              name="account_id"
              label={direction === 'borrowed' ? 'Account that receives the loan' : 'Account the money leaves'}
              required
            />
            <Field label="Project" hint="Name the build or purpose this loan is for.">
              <input name="notes" placeholder="Shop build" />
            </Field>
            <Field label="Start">
              <input name="start_date" type="date" required defaultValue={today()} />
            </Field>
            <Field label="Due">
              <input name="due_date" type="date" />
            </Field>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Save loan'}
            </Button>
          </form>
        </Modal>
      ) : null}
      {openId && loan && accounts.data ? (
        <Modal
          title={loan.counterparty_name}
          onClose={() => {
            setOpenId(null)
            setPanel('activity')
          }}
        >
          {panel === 'activity' ? (
            <div className="stack">
              <p>
                {loan.direction === 'borrowed' ? 'Received' : 'Paid out'}{' '}
                <Money amount={loan.principal} currency={loan.currency} />
                {loan.account ? ` in ${loan.account.name}` : ''}.
                {loan.notes ? ` ${loan.notes}.` : ''}
              </p>
              {loan.direction === 'borrowed' ? (
                <p className="muted">
                  Spent on the project <Money amount={loan.used} currency={loan.currency} />. Still available to spend{' '}
                  <Money amount={loan.unspent} currency={loan.currency} />. Still to repay{' '}
                  <Money amount={loan.outstanding} currency={loan.currency} />.
                </p>
              ) : (
                <p className="muted">
                  Still to collect <Money amount={loan.outstanding} currency={loan.currency} />.
                </p>
              )}
              <ErrorBanner error={detail.error ?? spend.error ?? repay.error} />
              {loan.direction === 'borrowed' ? (
                <>
                  <h3>Project payments</h3>
                  {(loan.uses ?? []).length === 0 ? (
                    <p className="muted">No project payments yet.</p>
                  ) : (
                    <ul className="plain">
                      {(loan.uses ?? []).map((use) => (
                        <li key={use.id}>
                          <span>
                            <strong>{use.description || 'Project payment'}</strong>
                            <small>
                              {use.category?.name || 'Expense'}
                              {use.account ? ` · from ${use.account.name}` : ''} · {use.used_at}
                            </small>
                          </span>
                          <Money amount={use.amount} currency={loan.currency} />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}
              <h3>Repayments</h3>
              {(loan.repayments ?? []).length === 0 ? (
                <p className="muted">No repayments yet.</p>
              ) : (
                <ul className="plain">
                  {(loan.repayments ?? []).map((repayment) => (
                    <li key={repayment.id}>
                      <span>
                        <strong>{repayment.notes || 'Repayment'}</strong>
                        <small>
                          {repayment.account ? `from ${repayment.account.name}` : 'Account not recorded'} · {repayment.paid_at}
                        </small>
                      </span>
                      <Money amount={repayment.amount} currency={loan.currency} />
                    </li>
                  ))}
                </ul>
              )}
              {writable && loan.status === 'active' ? (
                <div className="row-actions">
                  {loan.direction === 'borrowed' ? (
                    <Button type="button" variant="ghost" onClick={() => setPanel('spend')}>
                      Spend on project
                    </Button>
                  ) : null}
                  <Button type="button" onClick={() => setPanel('repay')}>
                    Repay
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {panel === 'spend' ? (
            <form
              className="stack"
              onSubmit={submit((form) => {
                spend.mutate({
                  debtId: loan.id,
                  payload: {
                    amount: text(form, 'amount'),
                    account_id: text(form, 'account_id'),
                    category_id: text(form, 'category_id'),
                    used_at: text(form, 'used_at'),
                    description: text(form, 'description'),
                  },
                })
              })}
            >
              <p className="muted">
                Still available to spend <Money amount={loan.unspent} currency={loan.currency} />.
              </p>
              <Field label="What it paid for">
                <input name="description" required maxLength={1000} placeholder="Blocks and cement" />
              </Field>
              <Field label="Amount">
                <input name="amount" inputMode="decimal" required />
              </Field>
              <AccountField accounts={accounts.data} name="account_id" label="Pay the project from" required />
              {categories.data ? <CategoryField categories={categories.data} name="category_id" type="expense" /> : <p className="muted">Loading categories…</p>}
              <Field label="Date">
                <input name="used_at" type="date" required defaultValue={today()} />
              </Field>
              <div className="row-actions">
                <Button type="button" variant="ghost" onClick={() => setPanel('activity')}>
                  Back
                </Button>
                <Button type="submit" disabled={spend.isPending}>
                  {spend.isPending ? 'Posting…' : 'Record project payment'}
                </Button>
              </div>
            </form>
          ) : null}
          {panel === 'repay' ? (
            <form
              className="stack"
              onSubmit={submit((form) => {
                repay.mutate({
                  debtId: loan.id,
                  payload: {
                    amount: text(form, 'amount'),
                    account_id: text(form, 'account_id'),
                    paid_at: text(form, 'paid_at'),
                    notes: text(form, 'notes'),
                  },
                })
              })}
            >
              <p className="muted">
                Still to repay <Money amount={loan.outstanding} currency={loan.currency} />.
              </p>
              <Field label="Amount">
                <input name="amount" inputMode="decimal" required />
              </Field>
              <AccountField
                accounts={accounts.data}
                name="account_id"
                label={loan.direction === 'borrowed' ? 'Pay the loan from' : 'Account that receives the repayment'}
                required
              />
              <Field label="Paid on">
                <input name="paid_at" type="date" required defaultValue={today()} />
              </Field>
              <Field label="Note">
                <input name="notes" placeholder="First instalment" />
              </Field>
              <div className="row-actions">
                <Button type="button" variant="ghost" onClick={() => setPanel('activity')}>
                  Back
                </Button>
                <Button type="submit" disabled={repay.isPending}>
                  {repay.isPending ? 'Posting…' : 'Post repayment'}
                </Button>
              </div>
            </form>
          ) : null}
        </Modal>
      ) : null}
    </>
  )
}
