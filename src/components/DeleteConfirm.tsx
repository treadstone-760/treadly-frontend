import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Button, ErrorBanner, Modal } from './ui'

type Preview = { name: string; related: string[] }

export function DeleteConfirm({
  path,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  path: string
  pending: boolean
  error: unknown
  onCancel: () => void
  onConfirm: () => void
}) {
  const preview = useQuery({
    queryKey: ['deletion-preview', path],
    queryFn: async () => (await api.get<{ data: Preview }>(path)).data.data,
    staleTime: 0,
    gcTime: 0,
  })

  return (
    <Modal title="Confirm deletion" onClose={onCancel}>
      {preview.isLoading ? <p className="muted">Checking linked records…</p> : null}
      {preview.error ? <ErrorBanner error={preview.error} /> : null}
      {preview.data ? (
        <>
          <p>
            Delete <strong>{preview.data.name}</strong>? This cannot be undone.
          </p>
          {preview.data.related.length > 0 ? (
            <>
              <p>This also deletes:</p>
              <ul className="confirm-list">
                {preview.data.related.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>No other records are linked to it, so nothing else will be deleted.</p>
          )}
        </>
      ) : null}
      {error ? <ErrorBanner error={error} /> : null}
      <div className="row-actions">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm} disabled={pending || preview.data === undefined}>
          {pending ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
    </Modal>
  )
}
