import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { Category, List } from '../api/types'
import { RequireWorkspace, useWorkspace } from '../auth/WorkspaceProvider'
import { DeleteConfirm } from '../components/DeleteConfirm'
import { Badge, Button, ErrorBanner, Field, Modal, PageHeader, QueryState, submit, text } from '../components/ui'
import { canWrite } from '../lib/format'

export function CategoriesPage() {
  return (
    <RequireWorkspace>
      {(workspace) => <CategoriesView id={workspace.id} />}
    </RequireWorkspace>
  )
}

function CategoriesView({ id }: { id: string }) {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const writable = canWrite(workspace?.role)
  const [open, setOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const categories = useQuery({
    queryKey: ['categories', id],
    queryFn: async () => (await api.get<List<Category>>(`/workspaces/${id}/categories`)).data.data,
  })
  const create = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      await api.post(`/workspaces/${id}/categories`, body)
    },
    onSuccess: async () => {
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['categories', id] })
    },
  })
  const remove = useMutation({
    mutationFn: async (categoryId: string) => {
      await api.delete(`/categories/${categoryId}`)
    },
    onSuccess: async () => {
      setPendingDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['categories', id] })
      await queryClient.invalidateQueries({ queryKey: ['transactions', id] })
      await queryClient.invalidateQueries({ queryKey: ['budgets', id] })
      await queryClient.invalidateQueries({ queryKey: ['recurring', id] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard', id] })
    },
  })
  const income = categories.data?.filter((category) => category.type === 'income') ?? []
  const expense = categories.data?.filter((category) => category.type === 'expense') ?? []

  return (
    <>
      <PageHeader
        eyebrow="Categories"
        title="How money is labelled"
        lede="Default income and expense categories come with the workspace. Deleting a category also deletes the records that use it."
        action={
          writable ? (
            <Button type="button" onClick={() => setOpen(true)}>
              Add category
            </Button>
          ) : null
        }
      />
      <ErrorBanner error={create.error} />
      <QueryState isLoading={categories.isLoading} error={categories.error}>
        <div className="grid-2">
          <CategoryColumn title="Income" rows={income} writable={writable} onDelete={setPendingDelete} />
          <CategoryColumn title="Expenses" rows={expense} writable={writable} onDelete={setPendingDelete} />
        </div>
      </QueryState>
      {open ? (
        <Modal title="New category" onClose={() => setOpen(false)}>
          <form
            className="stack"
            onSubmit={submit((form) => {
              create.mutate({
                name: text(form, 'name'),
                type: text(form, 'type'),
                color: text(form, 'color'),
              })
            })}
          >
            <Field label="Name">
              <input name="name" required maxLength={80} />
            </Field>
            <Field label="Type">
              <select name="type" defaultValue="expense">
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </Field>
            <Field label="Colour">
              <input name="color" type="color" defaultValue="#1b5e45" />
            </Field>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Save category'}
            </Button>
          </form>
        </Modal>
      ) : null}
      {pendingDelete ? (
        <DeleteConfirm
          path={`/categories/${pendingDelete}/deletion-preview`}
          pending={remove.isPending}
          error={remove.error}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => remove.mutate(pendingDelete)}
        />
      ) : null}
    </>
  )
}

function CategoryColumn({
  title,
  rows,
  writable,
  onDelete,
}: {
  title: string
  rows: Category[]
  writable: boolean
  onDelete: (id: string) => void
}) {
  return (
    <article className="card">
      <h2>{title}</h2>
      <ul className="plain">
        {rows.map((category) => (
          <li key={category.id}>
            <span>
              <i className="swatch" style={{ background: category.color || '#1b5e45' }} />
              {category.name}
              {category.is_default ? <Badge value="default" /> : null}
            </span>
            {writable ? (
              <Button type="button" variant="quiet" onClick={() => onDelete(category.id)}>
                Delete
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </article>
  )
}
