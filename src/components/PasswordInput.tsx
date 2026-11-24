import { useState, type InputHTMLAttributes } from 'react'

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)

  return (
    <span className="password-field">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="eye"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        <EyeIcon off={visible} />
      </button>
    </span>
  )
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M2.2 12S5.6 6.2 12 6.2 21.8 12 21.8 12 18.4 17.8 12 17.8 2.2 12 2.2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      {off ? <path d="M4 4.5 20 19.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /> : null}
    </svg>
  )
}
