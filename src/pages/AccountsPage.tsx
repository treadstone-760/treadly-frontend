import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, idempotencyHeaders } from '../api/client'
import type { Account, List } from '../api/types'
import { RequireWorkspace, useWorkspace } from '../auth/WorkspaceProvider'
import { DeleteConfirm } from '../components/DeleteConfirm'
import { Badge, Button, Empty, ErrorBanner, Field, Modal, Money, PageHeader, QueryState, submit, text } from '../components/ui'
import { canWrite, labelize } from '../lib/format'

export function AccountsPage() {
  return (
    <RequireWorkspace>
      {(workspace) => <AccountsView id={workspace.id} currency={workspace.base_currency} />}
    </RequireWorkspace>
  )
}

function AccountsView({ id, currency }: { id: string; currency: string }) {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const writable = canWrite(workspace?.role)
  const accounts = useQuery({
    queryKey: ['accounts', id],
    queryFn: async () => (await api.get<List<Account>>(`/workspaces/${id}/accounts`)).data.data,
  })
  const create = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      await api.post(`/workspaces/${id}/accounts`, body, { headers: idempotencyHeaders() })
    },
    onSuccess: async () => {
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['accounts', id] })
      await queryClient.invalidateQueries({ queryKey: ['transactions', id] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard', id] })
    },
  })
  const remove = useMutation({
    mutationFn: async (accountId: string) => {
      await api.delete(`/accounts/${accountId}`)
    },
    onSuccess: async () => {
      setPendingDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['accounts', id] })
      await queryClient.invalidateQueries({ queryKey: ['transactions', id] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard', id] })
      await queryClient.invalidateQueries({ queryKey: ['savings', id] })
      await queryClient.invalidateQueries({ queryKey: ['debts', id] })
      await queryClient.invalidateQueries({ queryKey: ['recurring', id] })
      await queryClient.invalidateQueries({ queryKey: ['investments', id] })
    },
  })

  return (
    <>
      <PageHeader
        eyebrow="Accounts"
        title="Where the money sits"
        lede="Balances are calculated from the ledger. Private accounts stay hidden from other members."
        action={
          writable ? (
            <Button type="button" onClick={() => setOpen(true)}>
              Add account
            </Button>
          ) : null
        }
      />
      <ErrorBanner error={create.error} />
      <QueryState isLoading={accounts.isLoading} error={accounts.error}>
        {accounts.data && accounts.data.length === 0 ? (
          <Empty title="No accounts yet" body="Add cash, a bank, mobile money, or a savings pot to start recording." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Balance</th>
                  <th>Visibility</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {accounts.data?.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <strong>{account.name}</strong>
                      <small>
                        {account.institution_name || '—'}
                        {account.account_number_masked ? ` · ${account.account_number_masked}` : ''}
                      </small>
                    </td>
                    <td>{labelize(account.type)}</td>
                    <td>
                      <Money amount={account.current_balance} currency={account.currency} />
                    </td>
                    <td>
                      <Badge value={account.visibility} />
                    </td>
                    <td>
                      <Badge value={account.status} />
                    </td>
                    <td>
                      {writable ? (
                        <Button type="button" variant="quiet" onClick={() => setPendingDelete(account.id)}>
                          Delete
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
      {open ? (
        <Modal title="New account" onClose={() => setOpen(false)}>
          <form
            className="stack"
            onSubmit={submit((form) => {
              create.mutate({
                name: text(form, 'name'),
                type: text(form, 'type'),
                currency: text(form, 'currency').toUpperCase(),
                opening_balance: text(form, 'opening_balance') || '0',
                institution_name: text(form, 'institution_name'),
                account_number: text(form, 'account_number'),
                visibility: text(form, 'visibility'),
                description: text(form, 'description'),
              })
            })}
          >
            <Field label="Name">
              <input name="name" required maxLength={120} />
            </Field>
            <Field label="Type">
              <select name="type" defaultValue="cash">
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="mobile_money">Mobile money</option>
                <option value="savings">Savings</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Currency">
              <input name="currency" defaultValue={currency} maxLength={3} required />
            </Field>
            <Field label="Opening balance" hint="A positive amount is recorded as income. Use a minus sign if the account starts overdrawn.">
              <input name="opening_balance" inputMode="decimal" placeholder="0.00" />
            </Field>
            <Field label="Institution">
              <input name="institution_name" />
            </Field>
            <Field label="Account number">
              <input name="account_number" />
            </Field>
            <Field label="Visibility">
              <select name="visibility" defaultValue="shared">
                <option value="shared">Shared with workspace members</option>
                <option value="private">Private to me</option>
              </select>
            </Field>
            <Field label="Description">
              <textarea name="description" rows={2} />
            </Field>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Save account'}
            </Button>
          </form>
        </Modal>
      ) : null}
      {pendingDelete ? (
        <DeleteConfirm
          path={`/accounts/${pendingDelete}/deletion-preview`}
          pending={remove.isPending}
          error={remove.error}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => remove.mutate(pendingDelete)}
        />
      ) : null}
    </>
  )
}
