import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, idempotencyHeaders } from '../api/client'
import type { Account, Category, List, Receipt } from '../api/types'
import { RequireWorkspace, useWorkspace } from '../auth/WorkspaceProvider'
import { AccountField, CategoryField } from '../components/picks'
import { Badge, Button, Empty, ErrorBanner, Field, Modal, PageHeader, submit, text } from '../components/ui'
import { canWrite, today } from '../lib/format'

const storageKey = (workspaceId: string) => `treadly_receipts_${workspaceId}`

function remembered(workspaceId: string): Receipt[] {
  const raw = sessionStorage.getItem(storageKey(workspaceId))
  if (!raw) return []
  try {
    return JSON.parse(raw) as Receipt[]
  } catch {
    return []
  }
}

export function ReceiptsPage() {
  return (
    <RequireWorkspace>
      {(workspace) => <ReceiptsView id={workspace.id} currency={workspace.base_currency} />}
    </RequireWorkspace>
  )
}

function ReceiptsView({ id, currency }: { id: string; currency: string }) {
  const { workspace } = useWorkspace()
  const writable = canWrite(workspace?.role)
  const [items, setItems] = useState<Receipt[]>(() => remembered(id))
  const [active, setActive] = useState<Receipt | null>(null)
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const accounts = useQuery({
    queryKey: ['accounts', id],
    queryFn: async () => (await api.get<List<Account>>(`/workspaces/${id}/accounts`)).data.data,
  })
  const categories = useQuery({
    queryKey: ['categories', id],
    queryFn: async () => (await api.get<List<Category>>(`/workspaces/${id}/categories`)).data.data,
  })

  function remember(next: Receipt[]) {
    setItems(next)
    sessionStorage.setItem(storageKey(id), JSON.stringify(next))
  }

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData()
      body.append('file', file)
      return (await api.post<{ data: Receipt }>(`/workspaces/${id}/receipts`, body)).data.data
    },
    onSuccess: (receipt) => {
      remember([receipt, ...items.filter((item) => item.id !== receipt.id)])
      setActive(receipt)
    },
  })
  const confirm = useMutation({
    mutationFn: async (body: { receipt: Receipt; payload: Record<string, string> }) => {
      return (
        await api.post<{ data: Receipt }>(`/receipts/${body.receipt.id}/confirm`, body.payload, {
          headers: idempotencyHeaders(),
        })
      ).data.data
    },
    onSuccess: (receipt) => {
      remember(items.map((item) => (item.id === receipt.id ? receipt : item)))
      setActive(null)
    },
  })

  return (
    <>
      <PageHeader
        eyebrow="Receipts"
        title="A photo, then a transaction"
        lede="Upload a receipt, then confirm the amount and category yourself. Nothing is posted until you confirm it."
      />
      <ErrorBanner error={upload.error ?? confirm.error} />
      {writable ? (
        <form
          className="card upload"
          onSubmit={submit((form) => {
            const file = form.get('file')
            if (file instanceof File && file.size > 0) upload.mutate(file)
          })}
        >
          <Field label="Receipt image or PDF">
            <input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
          </Field>
          <Button type="submit" disabled={upload.isPending}>
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </form>
      ) : null}
      {items.length === 0 ? (
        <Empty title="No receipts in this session" body="Uploads from this browser session are listed here so you can confirm them." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Status</th>
                <th>Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((receipt) => (
                <tr key={receipt.id}>
                  <td>{receipt.original_name}</td>
                  <td>
                    <Badge value={receipt.status} />
                  </td>
                  <td>{receipt.total_amount ? `${receipt.total_amount} ${receipt.currency ?? ''}` : '—'}</td>
                  <td>
                    {writable && receipt.status !== 'confirmed' ? (
                      <Button type="button" variant="quiet" onClick={() => setActive(receipt)}>
                        Confirm
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {active && accounts.data && categories.data ? (
        <Modal title="Confirm receipt" onClose={() => setActive(null)}>
          <form
            className="stack"
            onSubmit={submit((form) => {
              const kind = text(form, 'type')
              confirm.mutate({
                receipt: active,
                payload: {
                  type: kind,
                  category_id: text(form, 'category_id'),
                  source_account_id: kind === 'expense' ? text(form, 'account_id') : '',
                  destination_account_id: kind === 'income' ? text(form, 'account_id') : '',
                  total_amount: text(form, 'total_amount'),
                  currency: text(form, 'currency').toUpperCase(),
                  receipt_date: text(form, 'receipt_date'),
                  merchant_name: text(form, 'merchant_name'),
                },
              })
            })}
          >
            <Field label="Type">
              <select
                name="type"
                value={kind}
                onChange={(event) => setKind(event.target.value as 'expense' | 'income')}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </Field>
            <AccountField accounts={accounts.data} name="account_id" label="Account" required />
            <CategoryField categories={categories.data} name="category_id" type={kind} />
            <Field label="Total">
              <input name="total_amount" inputMode="decimal" required defaultValue={active.total_amount ?? ''} />
            </Field>
            <Field label="Currency">
              <input name="currency" defaultValue={active.currency || currency} maxLength={3} required />
            </Field>
            <Field label="Date">
              <input name="receipt_date" type="date" required defaultValue={active.receipt_date || today()} />
            </Field>
            <Field label="Merchant">
              <input name="merchant_name" defaultValue={active.merchant_name ?? ''} />
            </Field>
            <Button type="submit" disabled={confirm.isPending}>
              {confirm.isPending ? 'Posting…' : 'Confirm and post'}
            </Button>
          </form>
        </Modal>
      ) : null}
    </>
  )
}
