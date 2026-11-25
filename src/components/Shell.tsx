import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { AppNotification, Page } from '../api/types'
import { useAuth } from '../auth/AuthProvider'
import { WorkspaceProvider, useWorkspace } from '../auth/WorkspaceProvider'
import { labelize } from '../lib/format'

const links = [
  ['/', 'Overview'],
  ['/accounts', 'Accounts'],
  ['/transactions', 'Transactions'],
  ['/categories', 'Categories'],
  ['/budgets', 'Budgets'],
  ['/savings', 'Savings'],
  ['/debts', 'Debts'],
  ['/recurring', 'Recurring'],
  // ['/investments', 'Investments'],
  ['/receipts', 'Receipts'],
  // ['/assistant', 'Assistant'],
  ['/workspace', 'Workspace'],
  ['/notifications', 'Notifications'],
  ['/settings', 'Settings'],
] as const

function seenKey(userId: string): string {
  return `treadly_seen_notices_${userId}`
}

function readSeen(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(userId))
    const ids = raw ? (JSON.parse(raw) as unknown) : []
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

function storeSeen(userId: string, ids: Set<string>) {
  localStorage.setItem(seenKey(userId), JSON.stringify([...ids].slice(-200)))
}

function playChime() {
  const Context = window.AudioContext
  if (!Context) return
  const ctx = playChime.context ?? new Context()
  playChime.context = ctx
  void ctx.resume().then(() => {
    const start = ctx.currentTime
    ;[523.25, 659.25].forEach((frequency, index) => {
      const tone = ctx.createOscillator()
      const level = ctx.createGain()
      const at = start + index * 0.14
      tone.type = 'sine'
      tone.frequency.value = frequency
      level.gain.setValueAtTime(0.0001, at)
      level.gain.exponentialRampToValueAtTime(0.12, at + 0.02)
      level.gain.exponentialRampToValueAtTime(0.0001, at + 0.35)
      tone.connect(level).connect(ctx.destination)
      tone.start(at)
      tone.stop(at + 0.36)
    })
  })
}

playChime.context = undefined as AudioContext | undefined

function Frame() {
  const { user, logout } = useAuth()
  const { workspaces, workspace, loading, switchTo } = useWorkspace()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [toasts, setToasts] = useState<AppNotification[]>([])
  const [acknowledged, setAcknowledged] = useState<Set<string>>(() => (user ? readSeen(user.id) : new Set()))
  const seen = useRef<Set<string> | null>(null)
  const notes = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<Page<AppNotification>>('/notifications')).data,
    refetchInterval: 5_000,
  })
  const onMenu = location.pathname === '/notifications'
  const received = notes.data?.data.filter((item) => !acknowledged.has(item.id)).length ?? 0
  const badge = onMenu ? 0 : received

  useEffect(() => {
    const unlock = () => {
      playChime.context ??= new AudioContext()
      void playChime.context.resume()
    }
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => {
    if (!user) return
    setAcknowledged(readSeen(user.id))
  }, [user?.id])

  useEffect(() => {
    if (!onMenu || !user || !notes.data) return
    const ids = notes.data.data.map((item) => item.id)
    setAcknowledged((current) => {
      const next = new Set(current)
      let changed = false
      ids.forEach((id) => {
        if (next.has(id)) return
        next.add(id)
        changed = true
      })
      if (!changed) return current
      storeSeen(user.id, next)
      return next
    })
  }, [onMenu, notes.data, user])

  useEffect(() => {
    const items = notes.data?.data
    if (!items) return
    if (seen.current === null) {
      seen.current = new Set(items.map((item) => item.id))
      return
    }
    const arrived = items.filter((item) => !item.read_at && !seen.current?.has(item.id))
    if (arrived.length === 0) return
    arrived.forEach((item) => seen.current?.add(item.id))
    setToasts((current) => [...arrived.reverse(), ...current].slice(0, 4))
    playChime()
  }, [notes.data])

  useEffect(() => {
    if (toasts.length === 0) return
    const timer = window.setTimeout(() => {
      setToasts((current) => current.slice(0, -1))
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [toasts])

  return (
    <div className={open ? 'shell nav-open' : 'shell'}>
      <aside className="side">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <div>
            <strong>TREADLY</strong>
            <small>Ledger for everyday money</small>
          </div>
        </div>
        <nav>
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {label}
              {to === '/notifications' && badge > 0 ? <em>{badge}</em> : null}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <p>{user?.name}</p>
          <button type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button type="button" className="menu" onClick={() => setOpen((value) => !value)} aria-label="Menu">
            Menu
          </button>
          {loading ? (
            <span className="muted">Loading workspaces…</span>
          ) : (
            <label className="workspace-switch">
              <span>Workspace</span>
              <select
                value={workspace?.id ?? ''}
                onChange={(event) => void switchTo(event.target.value)}
              >
                {workspaces.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {labelize(item.type)} · {item.base_currency}
                  </option>
                ))}
              </select>
            </label>
          )}
          {workspace ? <span className="role-pill">{labelize(workspace.role)}</span> : null}
        </header>
        <div className="content">
          {!user?.email_verified_at ? (
            <p className="notice">
              Your email is not verified yet. You can keep working. A verification link can be sent from Settings.
            </p>
          ) : null}
          <Outlet />
        </div>
      </div>
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <article key={toast.id} className="toast">
            <div>
              <strong>{toast.data?.title || 'Notice'}</strong>
              <p>{toast.data?.body}</p>
            </div>
            <button type="button" aria-label="Dismiss notice" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
              Close
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}

export function Shell() {
  return (
    <WorkspaceProvider>
      <Frame />
    </WorkspaceProvider>
  )
}
