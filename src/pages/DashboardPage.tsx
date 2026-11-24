import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { Dashboard, MonthRow } from '../api/types'
import { RequireWorkspace } from '../auth/WorkspaceProvider'
import { BarList, Money, PageHeader, QueryState } from '../components/ui'
import { labelize } from '../lib/format'

const periods = [
  ['this_month', 'This month'],
  ['today', 'Today'],
  ['this_week', 'This week'],
  ['last_month', 'Last month'],
  ['this_year', 'This year'],
] as const

export function DashboardPage() {
  return (
    <RequireWorkspace>
      {(workspace) => <DashboardView id={workspace.id} />}
    </RequireWorkspace>
  )
}

function DashboardView({ id }: { id: string }) {
  const [period, setPeriod] = useState<(typeof periods)[number][0]>('this_month')
  const dashboard = useQuery({
    queryKey: ['dashboard', id, period],
    queryFn: async () =>
      (await api.get<{ data: Dashboard }>(`/workspaces/${id}/reports/dashboard`, { params: { period } })).data.data,
  })
  const monthly = useQuery({
    queryKey: ['monthly', id, period],
    queryFn: async () =>
      (
        await api.get<{ data: { currency: string; months: MonthRow[] } }>(`/workspaces/${id}/reports/monthly`, {
          params: { period },
        })
      ).data.data,
  })
  const data = dashboard.data

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="How the book is moving"
        lede="Figures come from posted income and expenses. Transfers, voids, and reversals stay off this statement."
        action={
          <label className="field compact">
            <span>Period</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value as (typeof periods)[number][0])}>
              {periods.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <QueryState isLoading={dashboard.isLoading} error={dashboard.error}>
        {data ? (
          <>
            <p className="muted">
              {data.period.start} to {data.period.end} · {data.currency}
            </p>
            <section className="stats">
              <article>
                <span>Income</span>
                <Money amount={data.income} currency={data.currency} />
              </article>
              <article>
                <span>Expenses</span>
                <Money amount={data.expenses} currency={data.currency} />
              </article>
              <article>
                <span>Net cash flow</span>
                <Money amount={data.net_cash_flow} currency={data.currency} />
              </article>
            </section>
            <section className="grid-2">
              <article className="card">
                <h2>Spending by category</h2>
                <BarList rows={data.spending_by_category} currency={data.currency} />
              </article>
              <article className="card">
                <h2>Cash by account</h2>
                {data.accounts.length === 0 ? (
                  <p className="muted">No visible accounts yet.</p>
                ) : (
                  <ul className="plain">
                    {data.accounts.map((account) => (
                      <li key={account.id}>
                        <span>
                          {account.name}
                          <small>{labelize(account.type)}</small>
                        </span>
                        <Money amount={account.current_balance} currency={account.currency} />
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </section>
            <section className="grid-3">
              <article className="card">
                <h2>Budgets</h2>
                {data.budgets.length === 0 ? (
                  <p className="muted">No active budgets.</p>
                ) : (
                  data.budgets.map((budget) => (
                    <div key={budget.id} className="stack-row">
                      <strong>{budget.name}</strong>
                      <span>{budget.performance.utilization}% used</span>
                      <div className="bar-track">
                        <span
                          style={{ width: `${Math.min(100, Number(budget.performance.utilization) || 0)}%` }}
                          className={budget.performance.status === 'exceeded' ? 'hot' : undefined}
                        />
                      </div>
                    </div>
                  ))
                )}
              </article>
              <article className="card">
                <h2>Savings and debts</h2>
                <p>
                  {data.savings.length} savings goal{data.savings.length === 1 ? '' : 's'}
                </p>
                <p>
                  {data.debts.active_count} active debt{data.debts.active_count === 1 ? '' : 's'} · outstanding{' '}
                  <Money amount={data.debts.outstanding} currency={data.currency} />
                </p>
              </article>
              <article className="card">
                <h2>Investments</h2>
                <p>{data.investments.asset_count} active holdings</p>
                <p>
                  Cost basis <Money amount={data.investments.cost_basis} currency={data.currency} />
                </p>
                <p className="muted">{data.investments.note}</p>
              </article>
            </section>
            <article className="card">
              <h2>Month by month</h2>
              <QueryState isLoading={monthly.isLoading} error={monthly.error}>
                {monthly.data && monthly.data.months.length > 0 ? (
                  <div className="month-chart">
                    {monthly.data.months.map((month) => {
                      const income = Number(month.income) || 0
                      const expenses = Number(month.expenses) || 0
                      const peak = Math.max(
                        ...monthly.data.months.map((row) => Math.max(Number(row.income) || 0, Number(row.expenses) || 0)),
                        1,
                      )
                      return (
                        <div key={month.month} className="month-col">
                          <div className="month-bars">
                            <span className="in" style={{ height: `${(income / peak) * 100}%` }} title="Income" />
                            <span className="out" style={{ height: `${(expenses / peak) * 100}%` }} title="Expenses" />
                          </div>
                          <small>{month.month.slice(5)}</small>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="muted">No income or expenses in this period.</p>
                )}
              </QueryState>
            </article>
          </>
        ) : null}
      </QueryState>
    </>
  )
}
