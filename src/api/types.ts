export type User = {
  id: string
  name: string
  email: string
  phone: string | null
  avatar_url: string | null
  timezone: string
  locale: string
  currency: string
  email_verified_at: string | null
  current_workspace_id: string | null
}

export type AuthPayload = {
  data: User
  token: string | null
}

export type Workspace = {
  id: string
  name: string
  slug: string
  type: 'personal' | 'family' | 'business'
  base_currency: string
  description: string | null
  role: 'owner' | 'admin' | 'editor' | 'viewer' | null
  created_at: string
}

export type Member = {
  id: string
  role: string
  joined_at: string | null
  user: { id: string | null; name: string | null; email: string | null }
}

export type Invitation = {
  id: string
  email: string
  role: string
  status: string
  expires_at: string | null
  workspace_id: string | null
  workspace_name: string | null
}

export type Account = {
  id: string
  name: string
  type: string
  currency: string
  opening_balance: string
  current_balance: string
  account_number_masked: string | null
  institution_name: string | null
  description: string | null
  visibility: string
  status: string
  workspace_id: string
}

export type Category = {
  id: string
  name: string
  type: 'income' | 'expense'
  icon: string | null
  color: string | null
  parent_id: string | null
  is_default: boolean
  is_system: boolean
  archived_at: string | null
}

export type Transaction = {
  id: string
  reference: string
  type: string
  status: string
  amount: string
  currency: string
  exchange_rate: string
  base_amount: string
  description: string | null
  transaction_date: string
  payment_method: string | null
  is_reversal: boolean
  category: { id: string; name: string } | null
  source_account: { id: string; name: string } | null
  destination_account: { id: string; name: string } | null
  workspace_id: string
  voided_at: string | null
}

export type BudgetPerformance = {
  currency: string
  limit: string
  spent: string
  remaining: string
  utilization: string
  alert_threshold: string
  status: string
  categories: {
    category_id: string | null
    category: string | null
    limit: string
    spent: string
    remaining: string
    utilization: string
  }[]
}

export type Budget = {
  id: string
  name: string
  period: string
  start_date: string
  end_date: string | null
  amount: string
  currency: string
  alert_threshold: string
  status: string
  performance?: BudgetPerformance | null
}

export type SavingsGoal = {
  id: string
  name: string
  target_amount: string
  saved: string
  currency: string
  target_date: string | null
  status: string
  account_id: string | null
  account: { id: string; name: string } | null
}

export type DebtMovement = {
  id: string
  amount: string
  account: { id: string; name: string } | null
}

export type DebtUse = DebtMovement & {
  used_at: string
  description: string | null
  category: { id: string; name: string } | null
}

export type DebtRepayment = DebtMovement & {
  paid_at: string
  notes: string | null
}

export type Debt = {
  id: string
  direction: 'borrowed' | 'lent'
  counterparty_name: string
  counterparty_contact: string | null
  principal: string
  outstanding: string
  used: string
  unspent: string
  interest_rate: string | null
  currency: string
  start_date: string
  due_date: string | null
  status: string
  notes: string | null
  account_id: string | null
  account: { id: string; name: string } | null
  uses?: DebtUse[]
  repayments?: DebtRepayment[]
}

export type Recurring = {
  id: string
  type: string
  amount: string
  currency: string
  description: string | null
  payment_method: string | null
  frequency: string
  interval_count: number
  start_date: string
  end_date: string | null
  next_occurrence: string | null
  remind_days_before: number | null
  status: string
  account_id: string | null
  category_id: string | null
}

export type InvestmentValuation = {
  quantity: string
  average_cost: string
  total_cost: string
  realized_gain: string
  dividends_received: string
  latest_price: string | null
  priced_at: string | null
  market_value: string | null
  unrealized_gain: string | null
  price_source: string | null
  valuation_note: string
}

export type Investment = {
  id: string
  name: string
  symbol: string | null
  asset_type: string
  currency: string
  status: string
  notes: string | null
  valuation: InvestmentValuation
}

export type Receipt = {
  id: string
  status: string
  original_name: string
  mime_type: string
  size: number
  merchant_name: string | null
  receipt_date: string | null
  total_amount: string | null
  currency: string | null
  tax_amount: string | null
  failure_reason: string | null
  transaction_id: string | null
  confirmed_at: string | null
}

export type AiMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export type AiConversation = {
  id: string
  title: string
  messages?: AiMessage[] | { data: AiMessage[] }
  created_at: string
}

export type Dashboard = {
  period: { key: string; start: string; end: string }
  currency: string
  income: string
  expenses: string
  net_cash_flow: string
  spending_by_category: AmountRow[]
  spending_by_account: AmountRow[]
  accounts: {
    id: string
    name: string
    type: string
    currency: string
    current_balance: string
  }[]
  budgets: { id: string; name: string; performance: BudgetPerformance }[]
  savings: { id: string; name: string; target_amount: string; saved: string; status: string }[]
  debts: { active_count: number; outstanding: string }
  investments: {
    asset_count: number
    cost_basis: string
    realized_gain: string
    note: string
  }
}

export type AmountRow = { id: string; name: string; amount: string }

export type MonthRow = {
  month: string
  income: string
  expenses: string
  net_cash_flow: string
}

export type AppNotification = {
  id: string
  read_at: string | null
  created_at: string
  data: { event?: string; title?: string; body?: string }
}

export type Page<T> = {
  data: T[]
  meta?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export type List<T> = { data: T[] }
