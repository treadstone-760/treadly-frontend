import type { Account, Category } from '../api/types'
import { labelize } from '../lib/format'
import { Field } from './ui'

export function AccountField({
  accounts,
  name,
  label,
  required = false,
}: {
  accounts: Account[]
  name: string
  label: string
  required?: boolean
}) {
  return (
    <Field label={label}>
      <select name={name} required={required} defaultValue="">
        <option value="">{required ? 'Choose an account' : 'No linked account'}</option>
        {accounts
          .filter((account) => account.status === 'active')
          .map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {labelize(account.type)} · {account.currency}
            </option>
          ))}
      </select>
    </Field>
  )
}

export function CategoryField({
  categories,
  name,
  type,
  label,
  required = true,
}: {
  categories: Category[]
  name: string
  type: 'income' | 'expense'
  label?: string
  required?: boolean
}) {
  const rows = categories.filter((category) => category.type === type && !category.archived_at)
  return (
    <Field label={label ?? (type === 'income' ? 'Income category' : 'Expense category')}>
      <select name={name} required={required} defaultValue="">
        <option value="">{required ? 'Choose a category' : 'Whole budget'}</option>
        {rows.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </Field>
  )
}
