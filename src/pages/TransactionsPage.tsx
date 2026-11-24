import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, idempotencyHeaders } from '../api/client'
import type { Account, Category, List, Page, Transaction } from '../api/types'
import { RequireWorkspace, useWorkspace } from '../auth/WorkspaceProvider'
import { AccountField, CategoryField } from '../components/picks'
import {
  Badge,
  Button,
  Empty,
  ErrorBanner,
  Field,
  Modal,
  Money,
  PageHeader,
  QueryState,
  submit,
  text,
} from '../components/ui'
import { canWrite, compact, labelize, today } from '../lib/format'

export function TransactionsPage() {
  return (
    <RequireWorkspace>
      {(workspace) => <TransactionsView id={workspace.id} currency={workspace.base_currency} />}
    </RequireWorkspace>
  )
}

function TransactionsView({ id, currency }: { id: string; currency: string }) {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const writable = canWrite(workspace?.role)
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('expense')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ type: '', search: '', date_from: '', date_to: '' })

  const accounts = useQuery({
    queryKey: ['accounts', id],
    queryFn: async () => (await api.get<List<Account>>(`/workspaces/${id}/accounts`)).data.data,
  })
  const categories = useQuery({
    queryKey: ['categories', id],
    queryFn: async () => (await api.get<List<Category>>(`/workspaces/${id}/categories`)).data.data,
  })
  const transactions = useQuery({
    queryKey: ['transactions', id, filters, page],
    queryFn: async () =>
      (
        await api.get<Page<Transaction>>(`/workspaces/${id}/transactions`, {
          params: { ...compact(filters), page, per_page: 20 },
        })
      ).data,
  })

  const create = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      await api.post(`/workspaces/${id}/transactions`, body, { headers: idempotencyHeaders() })
    },
    onSuccess: async () => {
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['transactions', id] })
      await queryClient.invalidateQueries({ queryKey: ['accounts', id] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard', id] })
    },
  })
  const voidTx = useMutation({
    mutationFn: async (transactionId: string) => {
      await api.post(`/transactions/${transactionId}/void`, { reason: 'Voided from the web app' })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['transactions', id] })
      await queryClient.invalidateQueries({ queryKey: ['accounts', id] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard', id] })
    },
  })

  async function exportCsv() {
    const response = await api.get(`/workspaces/${id}/transactions/export`, {
      params: { ...compact(filters), format: 'csv' },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data as Blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'transactions.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const rows = transactions.data?.data ?? []

  return (
    <>
      <PageHeader
        eyebrow="Transactions"
        title="The record"
        lede="Posted entries stay in the ledger. Voiding writes a reversing entry instead of deleting the original."
        action={
          <div className="row-actions">
            <Button type="button" variant="ghost" onClick={() => void exportCsv()}>
              Export CSV
            </Button>
            {writable ? (
              <Button type="button" onClick={() => setOpen(true)}>
                Record
              </Button>
            ) : null}
          </div>
        }
      />
      <form
        className="filters"
        onSubmit={submit((form) => {
          setPage(1)
          setFilters({
            type: text(form, 'type'),
            search: text(form, 'search'),
            date_from: text(form, 'date_from'),
            date_to: text(form, 'date_to'),
          })
        })}
      >
        <Field label="Type">
          <select name="type" defaultValue={filters.type}>
            <option value="">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
        </Field>
        <Field label="Search">
          <input name="search" defaultValue={filters.search} placeholder="Description or reference" />
        </Field>
        <Field label="From">
          <input name="date_from" type="date" defaultValue={filters.date_from} />
        </Field>
        <Field label="To">
          <input name="date_to" type="date" defaultValue={filters.date_to} />
        </Field>
        <Button type="submit" variant="ghost">
          Apply
        </Button>
      </form>
      <ErrorBanner error={create.error ?? voidTx.error} />
      <QueryState isLoading={transactions.isLoading} error={transactions.error}>
        {rows.length === 0 ? (
          <Empty title="No transactions" body="Record income, an expense, or a transfer between your accounts." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Details</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.transaction_date}</td>
                    <td>
                      <strong>{transaction.description || transaction.reference}</strong>
                      <small>
                        {transaction.category?.name || 'No category'}
                        {transaction.source_account ? ` · from ${transaction.source_account.name}` : ''}
                        {transaction.destination_account ? ` · to ${transaction.destination_account.name}` : ''}
                      </small>
                    </td>
                    <td>{labelize(transaction.type)}</td>
                    <td>
                      <Money amount={transaction.amount} currency={transaction.currency} />
                    </td>
                    <td>
                      <Badge value={transaction.status} />
                    </td>
                    <td>
                      {writable && transaction.status === 'posted' && !transaction.is_reversal ? (
                        <Button type="button" variant="quiet" onClick={() => voidTx.mutate(transaction.id)}>
                          Void
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {transactions.data?.meta && transactions.data.meta.last_page > 1 ? (
          <div className="pager">
            <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <span>
              Page {transactions.data.meta.current_page} of {transactions.data.meta.last_page}
            </span>
            <Button
              type="button"
              variant="ghost"
              disabled={page >= transactions.data.meta.last_page}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </QueryState>
      {open ? (
        <Modal title="Record a transaction" onClose={() => setOpen(false)}>
          <form
            className="stack"
            onSubmit={submit((form) => {
              const kind = text(form, 'type')
              create.mutate({
                type: kind,
                amount: text(form, 'amount'),
                currency: text(form, 'currency').toUpperCase(),
                transaction_date: text(form, 'transaction_date'),
                description: text(form, 'description'),
                payment_method: text(form, 'payment_method'),
                source_account_id: text(form, 'source_account_id'),
                destination_account_id: text(form, 'destination_account_id'),
                category_id: text(form, 'category_id'),
              })
            })}
          >
            <Field label="Type">
              <select name="type" value={type} onChange={(event) => setType(event.target.value)}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </Field>
            <Field label="Amount">
              <input name="amount" inputMode="decimal" required placeholder="0.00" />
            </Field>
            <Field label="Currency">
              <input name="currency" defaultValue={currency} maxLength={3} required />
            </Field>
            <Field label="Date">
              <input name="transaction_date" type="date" required defaultValue={today()} />
            </Field>
            {type !== 'income' && accounts.data ? (
              <AccountField accounts={accounts.data} name="source_account_id" label="From account" required />
            ) : null}
            {type !== 'expense' && accounts.data ? (
              <AccountField accounts={accounts.data} name="destination_account_id" label="To account" required />
            ) : null}
            {type !== 'transfer' && categories.data ? (
              <CategoryField categories={categories.data} name="category_id" type={type === 'income' ? 'income' : 'expense'} />
            ) : null}
            <Field label="Payment method">
              <select name="payment_method" defaultValue="">
                <option value="">Unspecified</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="mobile_money">Mobile money</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Description">
              <input name="description" maxLength={1000} />
            </Field>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Posting…' : 'Post transaction'}
            </Button>
          </form>
        </Modal>
      ) : null}
    </>
  )
}
