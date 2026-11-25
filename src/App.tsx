import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { Shell } from './components/Shell'
import { AccountsPage } from './pages/AccountsPage'
import { AssistantPage } from './pages/AssistantPage'
import { ForgotPage, LoginPage, RegisterPage, ResetPage } from './pages/AuthPages'
import { BudgetsPage } from './pages/BudgetsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { DashboardPage } from './pages/DashboardPage'
import { DebtsPage } from './pages/DebtsPage'
import { InvestmentsPage } from './pages/InvestmentsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ReceiptsPage } from './pages/ReceiptsPage'
import { RecurringPage } from './pages/RecurringPage'
import { SavingsPage } from './pages/SavingsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { WorkspacePage } from './pages/WorkspacePage'

function Boot() {
  return <p className="boot">Opening TREADLY…</p>
}

function Guard({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return <Boot />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function Guest({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return <Boot />
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Guest>
            <LoginPage />
          </Guest>
        }
      />
      <Route
        path="/register"
        element={
          <Guest>
            <RegisterPage />
          </Guest>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <Guest>
            <ForgotPage />
          </Guest>
        }
      />
      <Route path="/reset-password" element={<ResetPage />} />
      <Route
        element={
          <Guard>
            <Shell />
          </Guard>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="savings" element={<SavingsPage />} />
        <Route path="debts" element={<DebtsPage />} />
        <Route path="recurring" element={<RecurringPage />} />
        <Route path="investments" element={<InvestmentsPage />} />
        <Route path="receipts" element={<ReceiptsPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="workspace" element={<WorkspacePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
