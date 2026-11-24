import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, idempotencyHeaders } from '../api/client'
import type { Account, Investment, List } from '../api/types'
import { RequireWorkspace, useWorkspace } from '../auth/WorkspaceProvider'
import { AccountField } from '../components/picks'
import { Button, Empty, ErrorBanner, Field, Modal, Money, PageHeader, QueryState, submit, text } from '../components/ui'
import { canWrite, compact, isNegative, today } from '../lib/format'

const assetTypes = ['stock', 'bond', 'treasury_bill', 'mutual_fund', 'fixed_deposit', 'cryptocurrency', 'other'] as const

export function InvestmentsPage() {
  return (
    <RequireWorkspace>
      {(workspace) => <InvestmentsView id={workspace.id} currency={workspace.base_currency} />}
    </RequireWorkspace>
  )
}

function InvestmentsView({ id, currency }: { id: string; currency: string }) {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const writable = canWrite(workspace?.role)
  const [creating, setCreating] = useState(false)
  const [trading, setTrading] = useState<Investment | null>(null)
  const [pricing, setPricing] = useState<Investment | null>(null)
  const [tradeType, setTradeType] = useState('buy')
  const assets = useQuery({
    queryKey: ['investments', id],
    queryFn: async () => (await api.get<List<Investment>>(`/workspaces/${id}/investments`)).data.data,
  })
  const accounts = useQuery({
    queryKey: ['accounts', id],
    queryFn: async () => (await api.get<List<Account>>(`/workspaces/${id}/accounts`)).data.data,
  })
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['investments', id] })
    await queryClient.invalidateQueries({ queryKey: ['accounts', id] })
  }
  const create = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      await api.post(`/workspaces/${id}/investments`, body)
    },
    onSuccess: async () => {
      setCreating(false)
      await refresh()
    },
  })
  const trade = useMutation({
    mutationFn: async (body: { asset: Investment; payload: Record<string, string> }) => {
      await api.post(`/investments/${body.asset.id}/trades`, body.payload, { headers: idempotencyHeaders() })
    },
    onSuccess: async () => {
      setTrading(null)
      await refresh()
    },
  })
  const price = useMutation({
    mutationFn: async (body: { asset: Investment; payload: Record<string, string> }) => {
      await api.post(`/investments/${body.asset.id}/prices`, body.payload)
    },
    onSuccess: async () => {
      setPricing(null)
      await refresh()
    },
  })
  const cashTrade = tradeType === 'buy' || tradeType === 'sell'

  return (
    <>
      <PageHeader
        eyebrow="Investments"
        title="Holdings beside cash"
        lede="Buys and sells update the holding. Market value uses the latest price you store, not a live quote."
        action={
          writable ? (
            <Button type="button" onClick={() => setCreating(true)}>
              Add holding
            </Button>
          ) : null
        }
      />
      <ErrorBanner error={create.error ?? trade.error ?? price.error} />
      <QueryState isLoading={assets.isLoading} error={assets.error}>
        {assets.data && assets.data.length === 0 ? (
          <Empty title="No investments" body="Add a stock, fund, treasury bill, or other holding, then record a buy." />
        ) : (
          <div className="card-list">
            {assets.data?.map((asset) => (
              <article key={asset.id} className="card">
                <header className="split">
                  <h2>
                    {asset.name}
                    {asset.symbol ? <small> {asset.symbol}</small> : null}
                  </h2>
                  <span className="muted">{asset.asset_type.replaceAll('_', ' ')}</span>
                </header>
                <p>
                  Quantity {asset.valuation.quantity} · cost{' '}
                  <Money amount={asset.valuation.total_cost} currency={asset.currency} />
                </p>
                <p>
                  Market value{' '}
                  {asset.valuation.market_value ? (
                    <Money amount={asset.valuation.market_value} currency={asset.currency} />
                  ) : (
                    'not priced'
                  )}
                  {asset.valuation.unrealized_gain ? (
                    <span className={isNegative(asset.valuation.unrealized_gain) ? 'neg' : 'pos'}>
                      {' '}
                      · unrealized {asset.valuation.unrealized_gain}
                    </span>
                  ) : null}
                </p>
                <p className="muted">{asset.valuation.valuation_note}</p>
                {writable ? (
                  <div className="row-actions">
                    <Button type="button" variant="ghost" onClick={() => setTrading(asset)}>
                      Trade
                    </Button>
                    <Button type="button" variant="quiet" onClick={() => setPricing(asset)}>
                      Set price
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </QueryState>
      {creating ? (
        <Modal title="New holding" onClose={() => setCreating(false)}>
          <form
            className="stack"
            onSubmit={submit((form) => {
              create.mutate({
                name: text(form, 'name'),
                symbol: text(form, 'symbol'),
                asset_type: text(form, 'asset_type'),
                currency: text(form, 'currency').toUpperCase(),
                notes: text(form, 'notes'),
              })
            })}
          >
            <Field label="Name">
              <input name="name" required />
            </Field>
            <Field label="Symbol">
              <input name="symbol" />
            </Field>
            <Field label="Type">
              <select name="asset_type" defaultValue="stock">
                {assetTypes.map((item) => (
                  <option key={item} value={item}>
                    {item.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Currency">
              <input name="currency" defaultValue={currency} maxLength={3} required />
            </Field>
            <Field label="Notes">
              <textarea name="notes" rows={2} />
            </Field>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Save holding'}
            </Button>
          </form>
        </Modal>
      ) : null}
      {trading && accounts.data ? (
        <Modal title={`Trade ${trading.name}`} onClose={() => setTrading(null)}>
          <form
            className="stack"
            onSubmit={submit((form) => {
              const kind = text(form, 'type')
              trade.mutate({
                asset: trading,
                payload: compact({
                  type: kind,
                  traded_at: text(form, 'traded_at'),
                  account_id: text(form, 'account_id'),
                  quantity: text(form, 'quantity'),
                  price: text(form, 'price'),
                  amount: text(form, 'amount'),
                  fees: text(form, 'fees'),
                  notes: text(form, 'notes'),
                }) as Record<string, string>,
              })
            })}
          >
            <Field label="Type">
              <select name="type" value={tradeType} onChange={(event) => setTradeType(event.target.value)}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="dividend">Dividend</option>
                <option value="interest">Interest</option>
                <option value="fee">Fee</option>
              </select>
            </Field>
            <Field label="Date">
              <input name="traded_at" type="date" required defaultValue={today()} />
            </Field>
            <AccountField accounts={accounts.data} name="account_id" label="Cash account" required />
            {cashTrade ? (
              <>
                <Field label="Quantity">
                  <input name="quantity" inputMode="decimal" required />
                </Field>
                <Field label="Price">
                  <input name="price" inputMode="decimal" required />
                </Field>
                <Field label="Fees">
                  <input name="fees" inputMode="decimal" placeholder="0" />
                </Field>
              </>
            ) : (
              <Field label="Amount">
                <input name="amount" inputMode="decimal" required />
              </Field>
            )}
            <Field label="Notes">
              <input name="notes" />
            </Field>
            <Button type="submit" disabled={trade.isPending}>
              {trade.isPending ? 'Posting…' : 'Post trade'}
            </Button>
          </form>
        </Modal>
      ) : null}
      {pricing ? (
        <Modal title={`Price ${pricing.name}`} onClose={() => setPricing(null)}>
          <form
            className="stack"
            onSubmit={submit((form) => {
              price.mutate({
                asset: pricing,
                payload: {
                  price: text(form, 'price'),
                  currency: text(form, 'currency').toUpperCase(),
                  priced_at: text(form, 'priced_at'),
                  source: 'manual',
                },
              })
            })}
          >
            <p className="muted">This stores a manual price. It is not a live market quote.</p>
            <Field label="Price">
              <input name="price" inputMode="decimal" required />
            </Field>
            <Field label="Currency">
              <input name="currency" defaultValue={pricing.currency} maxLength={3} />
            </Field>
            <Field label="Priced on">
              <input name="priced_at" type="date" required defaultValue={today()} />
            </Field>
            <Button type="submit" disabled={price.isPending}>
              {price.isPending ? 'Saving…' : 'Save price'}
            </Button>
          </form>
        </Modal>
      ) : null}
    </>
  )
}
