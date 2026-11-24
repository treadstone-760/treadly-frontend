import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { Empty } from '../components/ui'
import { api } from '../api/client'
import type { List, User, Workspace } from '../api/types'
import { useAuth } from '../auth/AuthProvider'

type WorkspaceContextValue = {
  workspaces: Workspace[]
  workspace: Workspace | null
  loading: boolean
  switchTo: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, refresh: refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const list = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => (await api.get<List<Workspace>>('/workspaces')).data.data,
  })

  const workspace = useMemo(() => {
    const rows = list.data ?? []
    const preferred = selectedId ?? user?.current_workspace_id
    return rows.find((item) => item.id === preferred) ?? rows[0] ?? null
  }, [list.data, selectedId, user?.current_workspace_id])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces: list.data ?? [],
      workspace,
      loading: list.isLoading,
      async switchTo(id: string) {
        const response = await api.post<{ data: User }>(`/workspaces/${id}/switch`)
        queryClient.setQueryData(['me', localStorage.getItem('treadly_token')], response.data.data)
        setSelectedId(id)
        await refreshUser()
        await queryClient.invalidateQueries()
      },
      async refresh() {
        await list.refetch()
      },
    }),
    [list, queryClient, refreshUser, workspace],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return value
}

export function RequireWorkspace({ children }: { children: (workspace: Workspace) => ReactNode }) {
  const { workspace, loading } = useWorkspace()
  if (loading) return <p className="muted">Loading workspace…</p>
  if (!workspace) {
    return <Empty title="No workspace yet" body="Open Workspace and create a personal, family, or business book." />
  }
  return children(workspace)
}
