import { useUser } from '@clerk/clerk-react'
import { useState } from 'react'
import Button from '../../../../../components/ui/Button'
import { SettingsBackHeader } from '../components/SettingsBackHeader'
import { SettingsShell } from '../components/SettingsShell'

type PanelView = 'form' | 'success'

export function PasswordSettingsPanel({ onBack }: { onBack: () => void }) {
  const { user, isLoaded } = useUser()

  // Capture user.passwordEnabled at mount/render time.
  // After updatePassword() resolves, Clerk reactively sets passwordEnabled → true,
  // so we store the pre-submit intent in successMessage before the state updates.
  const hasPassword = user?.passwordEnabled ?? false

  const [view, setView] = useState<PanelView>('form')
  const [successMessage, setSuccessMessage] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const panelTitle = hasPassword ? 'Change password' : 'Add password'

  const handleSubmit = async () => {
    setError('')

    if (hasPassword && !currentPassword.trim()) {
      setError('Enter your current password.')
      return
    }
    if (!newPassword) {
      setError('Enter a new password.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match. Please try again.")
      return
    }
    if (!user) {
      setError('User session not found. Please reload and try again.')
      return
    }

    // Capture intent before the async call so the success message is correct
    // even after Clerk updates passwordEnabled → true.
    const intent = hasPassword ? 'changed' : 'added'

    setLoading(true)
    try {
      await user.updatePassword({
        ...(hasPassword ? { currentPassword: currentPassword.trim() } : {}),
        newPassword,
        signOutOfOtherSessions: true,
      })
      setSuccessMessage(
        intent === 'added'
          ? 'Password added. You can now sign in with email and password.'
          : 'Password changed.',
      )
      setView('success')
    } catch (exception) {
      setError(getClerkPasswordErrorMessage(exception))
    } finally {
      setLoading(false)
    }
  }

  if (!isLoaded) {
    return (
      <SettingsShell>
        <SettingsBackHeader onBack={onBack} title="Account & Privacy" />
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--wardle-color-gray)', fontSize: 13 }}>
          Loading…
        </div>
      </SettingsShell>
    )
  }

  if (view === 'success') {
    return (
      <SettingsShell>
        <SettingsBackHeader onBack={onBack} title="Account & Privacy" />
        <div style={{ padding: '28px 20px' }}>
          <div
            style={{
              background: 'rgba(0,180,166,0.10)',
              border: '1px solid rgba(0,180,166,0.28)',
              borderRadius: 16,
              padding: '24px 20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--wardle-color-mint)',
                marginBottom: 8,
                lineHeight: 1.4,
              }}
            >
              {successMessage}
            </div>
            <div style={{ fontSize: 12, color: 'var(--wardle-color-gray)', lineHeight: 1.55 }}>
              Your other sessions have been signed out for security.
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <Button onClick={onBack}>Back to Account</Button>
          </div>
        </div>
      </SettingsShell>
    )
  }

  return (
    <SettingsShell>
      <SettingsBackHeader onBack={onBack} title="Account & Privacy" />
      <div style={{ padding: '20px' }}>
        {!hasPassword && (
          <div
            style={{
              background: 'rgba(244,162,97,0.08)',
              border: '1px solid rgba(244,162,97,0.24)',
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--wardle-color-amber)',
                textTransform: 'uppercase',
                letterSpacing: 1.2,
                marginBottom: 5,
              }}
            >
              Legacy account
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>
              Your account was created with passwordless sign-in. Add a password to
              enable email + password login on all devices, including the mobile app.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {hasPassword && (
            <PasswordField
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
          )}
          <PasswordField
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
        </div>

        {error ? (
          <div
            style={{
              marginTop: 16,
              background: 'rgba(224,92,92,0.12)',
              border: '1px solid rgba(224,92,92,0.32)',
              borderRadius: 14,
              padding: '12px 16px',
              fontSize: 13,
              color: '#ff9a9a',
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ marginTop: 20 }}>
          <Button
            type="button"
            disabled={loading || !user}
            onClick={() => void handleSubmit()}
          >
            {loading
              ? hasPassword
                ? 'Changing password…'
                : 'Adding password…'
              : panelTitle}
          </Button>
        </div>

        <p
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontSize: 11,
            color: 'rgba(138,155,176,0.50)',
            lineHeight: 1.55,
          }}
        >
          Signed out and forgot access?{' '}
          Use password reset from the sign-in screen.
        </p>
      </div>
    </SettingsShell>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--wardle-color-gray)',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginBottom: 7,
        }}
      >
        {label}
      </div>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: 'rgba(26,60,94,0.36)',
          border: '1px solid rgba(0,180,166,0.24)',
          borderRadius: 14,
          padding: '13px 16px',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--wardle-color-mint)',
          outline: 'none',
          fontFamily: 'inherit',
          WebkitAppearance: 'none',
        }}
        onFocus={(event) => {
          event.currentTarget.style.borderColor = 'rgba(0,180,166,0.62)'
        }}
        onBlur={(event) => {
          event.currentTarget.style.borderColor = 'rgba(0,180,166,0.24)'
        }}
      />
    </div>
  )
}

function getClerkPasswordErrorMessage(exception: unknown): string {
  const errors = getArrayProperty(exception, 'errors')
  const firstError = errors[0]
  const code = getStringProperty(firstError, 'code')
  const longMessage = getStringProperty(firstError, 'longMessage')
  const message =
    getStringProperty(firstError, 'message') ?? getStringProperty(exception, 'message')

  switch (code) {
    case 'form_password_incorrect':
      return 'Incorrect current password. Please try again.'
    case 'form_password_pwned':
    case 'form_password_length_too_short':
    case 'form_password_validation_failed':
    case 'form_password_strength_insufficient':
      return (
        longMessage ??
        'Password is too weak. Use at least 8 characters with a mix of letters and numbers.'
      )
  }

  return longMessage ?? message ?? 'Failed to update password. Please try again.'
}

function getArrayProperty(value: unknown, key: string): unknown[] {
  if (!value || typeof value !== 'object') return []
  const property = (value as Record<string, unknown>)[key]
  return Array.isArray(property) ? property : []
}

function getStringProperty(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null
  const property = (value as Record<string, unknown>)[key]
  return typeof property === 'string' && property.length > 0 ? property : null
}
