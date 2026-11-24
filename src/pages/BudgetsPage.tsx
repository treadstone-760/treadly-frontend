import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { Budget, Category, List } from '../api/types'
import { RequireWorkspace, useWorkspace } from '../auth/WorkspaceProvider'
import { DeleteConfirm } from '../components/DeleteConfirm'
import { CategoryField } from '../components/picks'
import { Badge, Button, Empty, ErrorBanner, Field, Modal, Money, PageHeader, QueryState, submit, text } from '../components/ui'
import { canWrite, monthStart } from '../lib/format'

export function BudgetsPage() {
  return (
    <RequireWorkspace>
      {(workspace) => <BudgetsView id={workspace.id} currency={workspace.base_currency} />}
    </RequireWorkspace>
  )
}

function BudgetsView({ id, currency }: { id: string; currency: string }) {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const writable = canWrite(workspace?.role)
  const [open, setOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const budgets = useQuery({
    queryKey: ['budgets', id],
    queryFn: async () => (await api.get<List<Budget>>(`/workspaces/${id}/budgets`)).data.data,
  })
  const categories = useQuery({
    queryKey: ['categories', id],
    queryFn: async () => (await api.get<List<Category>>(`/workspaces/${id}/categories`)).data.data,
    enabled: open,
  })
  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await api.post(`/workspaces/${id}/budgets`, body)
    },
    onSuccess: async () => {
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['budgets', id] })
    },
  })
  const remove = useMutation({
    mutationFn: async (budgetId: string) => {
      await api.delete(`/budgets/${budgetId}`)
    },
    onSuccess: async () => {
      setPendingDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['budgets', id] })
      await queryClient.invalidateQueries({ queryKey: ['budget'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard', id] })
    },
  })

  return (
    <>
      <PageHeader
        eyebrow="Budgets"
        title="A ceiling for spending"
        lede={`Budgets are kept in ${currency}. Spent totals count posted expenses inside the budget dates.`}
        action={
          writable ? (
            <Button type="button" onClick={() => setOpen(true)}>
              New budget
            </Button>
          ) : null
        }
      />
      <ErrorBanner error={create.error} />
      <QueryState isLoading={budgets.isLoading} error={budgets.error}>
        {budgets.data && budgets.data.length === 0 ? (
          <Empty title="No budgets" body="Set a monthly limit, or split it across expense categories." />
        ) : (
          <div className="card-list">
            {budgets.data?.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                writable={writable}
                onDelete={() => setPendingDelete(budget.id)}
              />
            ))}
          </div>
        )}
      </QueryState>
      {open ? (
        <Modal title="New budget" onClose={() => setOpen(false)}>
          <form
            className="stack"
            onSubmit={submit((form) => {
              const categoryId = text(form, 'category_id')
              const categoryAmount = text(form, 'category_amount')
              create.mutate({
                name: text(form, 'name'),
                period: text(form, 'period'),
                start_date: text(form, 'start_date'),
                end_date: text(form, 'end_date') || undefined,
                amount: text(form, 'amount'),
                currency,
                alert_threshold: text(form, 'alert_threshold') || '80',
                categories:
                  categoryId && categoryAmount
                    ? [{ category_id: categoryId, amount: categoryAmount }]
                    : undefined,
              })
            })}
          >
            <Field label="Name">
              <input name="name" required />
            </Field>
            <Field label="Period">
              <select name="period" defaultValue="monthly">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Starts">
              <input name="start_date" type="date" required defaultValue={monthStart()} />
            </Field>
            <Field label="Ends" hint="Required for a custom period. Otherwise the period fills it in.">
              <input name="end_date" type="date" />
            </Field>
            <Field label={`Limit (${currency})`}>
              <input name="amount" inputMode="decimal" required placeholder="0.00" />
            </Field>
            <Field label="Alert at percent">
              <input name="alert_threshold" inputMode="numeric" defaultValue="80" />
            </Field>
            {categories.data ? (
              <CategoryField
                categories={categories.data}
                name="category_id"
                type="expense"
                label="Optional category split"
                required={false}
              />
            ) : null}
            <Field label="Amount for that category" hint="Leave blank to track the whole budget only.">
              <input name="category_amount" inputMode="decimal" />
            </Field>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Save budget'}
            </Button>
          </form>
        </Modal>
      ) : null}
      {pendingDelete ? (
        <DeleteConfirm
          path={`/budgets/${pendingDelete}/deletion-preview`}
          pending={remove.isPending}
          error={remove.error}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => remove.mutate(pendingDelete)}
        />
      ) : null}
    </>
  )
}

function BudgetCard({ budget, writable, onDelete }: { budget: Budget; writable: boolean; onDelete: () => void }) {
  const detail = useQuery({
    queryKey: ['budget', budget.id],
    queryFn: async () => (await api.get<{ data: Budget }>(`/budgets/${budget.id}`)).data.data,
  })
  const performance = detail.data?.performance
  return (
    <article className="card">
      <header className="split">
        <h2>{budget.name}</h2>
        <Badge value={performance?.status ?? budget.status} />
      </header>
      <p className="muted">
        {budget.start_date} to {budget.end_date} · {budget.period}
      </p>
      <p>
        Limit <Money amount={budget.amount} currency={budget.currency} />
        {performance ? (
          <>
            {' '}
            · spent <Money amount={performance.spent} currency={performance.currency} /> · left{' '}
            <Money amount={performance.remaining} currency={performance.currency} />
          </>
        ) : null}
      </p>
      {performance ? (
        <div className="bar-track">
          <span
            style={{ width: `${Math.min(100, Number(performance.utilization) || 0)}%` }}
            className={performance.status === 'exceeded' ? 'hot' : undefined}
          />
        </div>
      ) : null}
      {writable ? (
        <div className="row-actions">
          <Button type="button" variant="quiet" onClick={onDelete}>
            Delete
          </Button>
        </div>
      ) : null}
    </article>
  )
}
