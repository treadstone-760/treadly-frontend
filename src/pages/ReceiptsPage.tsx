import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, idempotencyHeaders } from '../api/client'
import type { Account, Category, List, Receipt } from '../api/types'
import { RequireWorkspace, useWorkspace } from '../auth/WorkspaceProvider'
import { AccountField, CategoryField } from '../components/picks'
import { Badge, Button, Empty, ErrorBanner, Field, Modal, PageHeader, QueryState, submit, text } from '../components/ui'
import { canWrite, today } from '../lib/format'

export function ReceiptsPage() {
  return (
    <RequireWorkspace>
      {(workspace) => <ReceiptsView id={workspace.id} currency={workspace.base_currency} />}
    </RequireWorkspace>
  )
}

function ReceiptsView({ id, currency }: { id: string; currency: string }) {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const writable = canWrite(workspace?.role)
  const [active, setActive] = useState<Receipt | null>(null)
  const [viewing, setViewing] = useState<Receipt | null>(null)
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const receipts = useQuery({
    queryKey: ['receipts', id],
    queryFn: async () => (await api.get<List<Receipt>>(`/workspaces/${id}/receipts`)).data.data,
  })
  const accounts = useQuery({
    queryKey: ['accounts', id],
    queryFn: async () => (await api.get<List<Account>>(`/workspaces/${id}/accounts`)).data.data,
    enabled: active !== null,
  })
  const categories = useQuery({
    queryKey: ['categories', id],
    queryFn: async () => (await api.get<List<Category>>(`/workspaces/${id}/categories`)).data.data,
    enabled: active !== null,
  })
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData()
      body.append('file', file)
      return (await api.post<{ data: Receipt }>(`/workspaces/${id}/receipts`, body)).data.data
    },
    onSuccess: async (receipt) => {
      await queryClient.invalidateQueries({ queryKey: ['receipts', id] })
      setViewing(receipt)
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
    onSuccess: async () => {
      setActive(null)
      await queryClient.invalidateQueries({ queryKey: ['receipts', id] })
      await queryClient.invalidateQueries({ queryKey: ['transactions', id] })
    },
  })

  return (
    <>
      <PageHeader
        eyebrow="Receipts"
        title="A photo, then a transaction"
        lede="Upload a receipt and open it again from this list. Nothing is posted until you confirm the amount and category."
      />
      <ErrorBanner error={upload.error ?? confirm.error ?? receipts.error} />
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
      <QueryState isLoading={receipts.isLoading} error={receipts.error}>
        {receipts.data && receipts.data.length === 0 ? (
          <Empty title="No receipts yet" body="Upload a photo or PDF. It stays here so you can open it again." />
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
                {receipts.data?.map((receipt) => (
                  <tr key={receipt.id}>
                    <td>
                      <button type="button" className="file-link" onClick={() => setViewing(receipt)}>
                        {receipt.original_name}
                      </button>
                    </td>
                    <td>
                      <Badge value={receipt.status} />
                    </td>
                    <td>{receipt.total_amount ? `${receipt.total_amount} ${receipt.currency ?? ''}` : '—'}</td>
                    <td>
                      <div className="row-actions">
                        <Button type="button" variant="quiet" onClick={() => setViewing(receipt)}>
                          View
                        </Button>
                        {writable && receipt.status !== 'confirmed' ? (
                          <Button type="button" variant="quiet" onClick={() => setActive(receipt)}>
                            Confirm
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
      {viewing ? <ReceiptPreview receipt={viewing} onClose={() => setViewing(null)} /> : null}
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

function ReceiptPreview({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const file = useQuery({
    queryKey: ['receipt-file', receipt.id],
    queryFn: async () => {
      const response = await api.get<Blob>(`/receipts/${receipt.id}/download`, { responseType: 'blob' })
      const header = String(response.headers['content-type'] ?? '')
      const type = header && !header.includes('octet-stream') ? header.split(';')[0] : receipt.mime_type
      return { url: URL.createObjectURL(new Blob([response.data], { type })), type }
    },
  })

  useEffect(() => {
    const url = file.data?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [file.data?.url])

  const image = file.data?.type.startsWith('image/')
  const pdf = file.data?.type.includes('pdf')

  return (
    <Modal title={receipt.original_name || 'Receipt'} onClose={onClose}>
      {file.isLoading ? <p className="muted">Opening the receipt…</p> : null}
      {file.error ? <ErrorBanner error={file.error} /> : null}
      {file.data && image ? <img className="receipt-preview" src={file.data.url} alt={receipt.original_name} /> : null}
      {file.data && pdf ? <iframe className="receipt-preview" title={receipt.original_name} src={file.data.url} /> : null}
      {file.data && !image && !pdf ? <p className="muted">This file cannot be shown here.</p> : null}
    </Modal>
  )
}
