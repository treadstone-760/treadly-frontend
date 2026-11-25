import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { Invitation, List, Member } from '../api/types'
import { useAuth } from '../auth/AuthProvider'
import { useWorkspace } from '../auth/WorkspaceProvider'
import { Badge, Button, ErrorBanner, Field, Modal, PageHeader, QueryState, submit, text } from '../components/ui'
import { canManage, labelize } from '../lib/format'

export function WorkspacePage() {
  const { user } = useAuth()
  const { workspaces, workspace, loading, switchTo, refresh } = useWorkspace()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const members = useQuery({
    queryKey: ['members', workspace?.id],
    enabled: Boolean(workspace),
    queryFn: async () => (await api.get<List<Member>>(`/workspaces/${workspace?.id}/members`)).data.data,
  })
  const invitations = useQuery({
    queryKey: ['invitations', workspace?.id],
    enabled: Boolean(workspace) && canManage(workspace?.role),
    queryFn: async () => (await api.get<List<Invitation>>(`/workspaces/${workspace?.id}/invitations`)).data.data,
  })
  const incoming = useQuery({
    queryKey: ['incoming-invitations'],
    queryFn: async () => (await api.get<List<Invitation>>('/invitations')).data.data,
  })
  const create = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      const response = await api.post<{ data: { id: string } }>('/workspaces', body)
      return response.data.data.id
    },
    onSuccess: async (id) => {
      setCreating(false)
      await refresh()
      await switchTo(id)
    },
  })
  const invite = useMutation({
    mutationFn: async (body: { email: string; role: string }) => {
      await api.post(`/workspaces/${workspace?.id}/invitations`, body)
    },
    onSuccess: async () => {
      setInviting(false)
      await queryClient.invalidateQueries({ queryKey: ['invitations', workspace?.id] })
    },
  })
  const respond = useMutation({
    mutationFn: async (body: { id: string; action: 'accept' | 'reject' }) => {
      await api.post(`/invitations/${body.id}/${body.action}`)
    },
    onSuccess: async () => {
      await incoming.refetch()
      await refresh()
    },
  })
  const changeMember = useMutation({
    mutationFn: async (body: { id: string; role: string }) => {
      await api.put(`/workspaces/${workspace?.id}/members/${body.id}`, { role: body.role })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['members', workspace?.id] })
    },
  })
  const changeInvite = useMutation({
    mutationFn: async (body: { id: string; role: string }) => {
      await api.put(`/workspaces/${workspace?.id}/invitations/${body.id}`, { role: body.role })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invitations', workspace?.id] })
    },
  })

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title={workspace?.name ?? 'Your books'}
        lede="Each workspace has its own accounts, members, and ledger. Your role decides what you can change."
        action={
          <Button type="button" onClick={() => setCreating(true)}>
            New workspace
          </Button>
        }
      />
      <ErrorBanner error={create.error ?? invite.error ?? respond.error ?? changeMember.error ?? changeInvite.error} />
      <section className="card">
        <h2>Switch</h2>
        {loading ? <p className="muted">Loading…</p> : null}
        <ul className="plain">
          {workspaces.map((item) => (
            <li key={item.id}>
              <span>
                <strong>{item.name}</strong>
                <small>
                  {labelize(item.type)} · {item.base_currency} · {labelize(item.role)}
                </small>
              </span>
              {item.id !== workspace?.id ? (
                <Button type="button" variant="quiet" onClick={() => void switchTo(item.id)}>
                  Open
                </Button>
              ) : (
                <Badge value="current" />
              )}
            </li>
          ))}
        </ul>
      </section>
      {incoming.data && incoming.data.some((invitation) => invitation.status === 'pending') ? (
        <section className="card">
          <h2>Invitations for {user?.email}</h2>
          <ul className="plain">
            {incoming.data.filter((invitation) => invitation.status === 'pending').map((invitation) => (
              <li key={invitation.id}>
                <span>
                  {invitation.workspace_name} · {labelize(invitation.role)}
                </span>
                <span className="row-actions">
                  <Button type="button" onClick={() => respond.mutate({ id: invitation.id, action: 'accept' })}>
                    Accept
                  </Button>
                  <Button type="button" variant="quiet" onClick={() => respond.mutate({ id: invitation.id, action: 'reject' })}>
                    Decline
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {workspace ? (
        <section className="card">
          <header className="split">
            <h2>Members</h2>
            {canManage(workspace.role) ? (
              <Button type="button" variant="ghost" onClick={() => setInviting(true)}>
                Invite
              </Button>
            ) : null}
          </header>
          <QueryState isLoading={members.isLoading} error={members.error}>
            <ul className="plain">
              {members.data?.map((member) => (
                <li key={member.id}>
                  <span>
                    <strong>{member.user.name}</strong>
                    <small>{member.user.email}</small>
                  </span>
                  {canManage(workspace.role) && member.role !== 'owner' && member.user.id !== user?.id ? (
                    <RoleSelect
                      value={member.role}
                      label={`Role for ${member.user.name ?? member.user.email ?? 'member'}`}
                      disabled={changeMember.isPending && changeMember.variables?.id === member.id}
                      onChange={(role) => changeMember.mutate({ id: member.id, role })}
                    />
                  ) : (
                    <Badge value={member.role} />
                  )}
                </li>
              ))}
            </ul>
          </QueryState>
          {canManage(workspace.role) ? (
            <QueryState isLoading={invitations.isLoading} error={invitations.error}>
              {invitations.data && invitations.data.some((invitation) => invitation.status === 'pending') ? (
                <>
                  <h3>Pending invitations</h3>
                  <ul className="plain">
                    {invitations.data
                      .filter((invitation) => invitation.status === 'pending')
                      .map((invitation) => (
                        <li key={invitation.id}>
                          <span>
                            {invitation.email}
                            <small>Pending</small>
                          </span>
                          <RoleSelect
                            value={invitation.role}
                            label={`Role for ${invitation.email}`}
                            disabled={changeInvite.isPending && changeInvite.variables?.id === invitation.id}
                            onChange={(role) => changeInvite.mutate({ id: invitation.id, role })}
                          />
                        </li>
                      ))}
                  </ul>
                </>
              ) : null}
            </QueryState>
          ) : null}
        </section>
      ) : null}
      {creating ? (
        <Modal title="New workspace" onClose={() => setCreating(false)}>
          <form
            className="stack"
            onSubmit={submit((form) => {
              create.mutate({
                name: text(form, 'name'),
                type: text(form, 'type'),
                base_currency: text(form, 'base_currency').toUpperCase(),
                description: text(form, 'description'),
              })
            })}
          >
            <Field label="Name">
              <input name="name" required />
            </Field>
            <Field label="Type">
              <select name="type" defaultValue="personal">
                <option value="personal">Personal</option>
                <option value="family">Family</option>
                <option value="business">Business</option>
              </select>
            </Field>
            <Field label="Base currency">
              <input name="base_currency" defaultValue="GHS" maxLength={3} required />
            </Field>
            <Field label="Description">
              <textarea name="description" rows={2} />
            </Field>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create workspace'}
            </Button>
          </form>
        </Modal>
      ) : null}
      {inviting ? (
        <Modal title="Invite a member" onClose={() => setInviting(false)}>
          <form
            className="stack"
            onSubmit={submit((form) => {
              invite.mutate({ email: text(form, 'email'), role: text(form, 'role') })
            })}
          >
            <Field label="Email">
              <input name="email" type="email" required />
            </Field>
            <Field label="Role">
              <select name="role" defaultValue="editor">
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </Field>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </form>
        </Modal>
      ) : null}
    </>
  )
}

function RoleSelect({
  value,
  label,
  disabled,
  onChange,
}: {
  value: string
  label: string
  disabled?: boolean
  onChange: (role: string) => void
}) {
  return (
    <select className="role-select" aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="admin">Admin</option>
      <option value="editor">Editor</option>
      <option value="viewer">Viewer</option>
    </select>
  )
}
