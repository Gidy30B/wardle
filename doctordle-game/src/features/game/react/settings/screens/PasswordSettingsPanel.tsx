import { useUser } from '@clerk/clerk-react'
import { Eye, EyeOff } from 'lucide-react'
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
  const panelIcon = hasPassword ? '🔑' : '🔓'
  const panelSubtitle = hasPassword
    ? 'Update your Wardle sign-in password'
    : 'Enable email + password sign-in on all your devices'

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
        <div className="wardle-learn-slide-up" style={{ padding: '28px 20px' }}>
          <div
            style={{
              background: 'rgba(0,180,166,0.08)',
              border: '1px solid rgba(0,180,166,0.22)',
              borderRadius: 20,
              padding: '32px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 14, lineHeight: 1 }}>🔐</div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--wardle-color-mint)',
                marginBottom: 8,
                lineHeight: 1.4,
              }}
            >
              {successMessage}
            </div>
            <div style={{ fontSize: 12, color: 'var(--wardle-color-gray)', lineHeight: 1.65 }}>
              Your other sessions were signed out for security.
              You'll stay signed in here.
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

      {/* Panel sub-header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '20px 20px 0',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            background: 'rgba(26,60,94,0.55)',
            border: '1px solid rgba(0,180,166,0.14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {panelIcon}
        </div>
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: 'var(--wardle-color-mint)',
              lineHeight: 1.3,
            }}
          >
            {panelTitle}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--wardle-color-gray)',
              marginTop: 3,
              lineHeight: 1.4,
            }}
          >
            {panelSubtitle}
          </div>
        </div>
      </div>

      <div className="wardle-learn-slide-up" style={{ padding: '20px' }}>
        {/* Legacy account notice */}
        {!hasPassword && (
          <div
            style={{
              background: 'rgba(244,162,97,0.07)',
              border: '1px solid rgba(244,162,97,0.22)',
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>🔓</span>
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'var(--wardle-color-amber)',
                  textTransform: 'uppercase',
                  letterSpacing: 1.3,
                  marginBottom: 5,
                }}
              >
                Passwordless account
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                Your account was created without a password. Add one to enable email + password login on all devices, including the mobile app.
              </div>
            </div>
          </div>
        )}

        {/* Field card */}
        <div
          style={{
            background: 'rgba(26,60,94,0.18)',
            border: '1px solid rgba(0,180,166,0.10)',
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {hasPassword && (
            <>
              <PasswordField
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
              />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
            </>
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
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: 'rgba(224,92,92,0.10)',
              border: '1px solid rgba(224,92,92,0.28)',
              borderRadius: 14,
              padding: '12px 14px',
              fontSize: 13,
              color: '#ff9a9a',
              lineHeight: 1.5,
            }}
          >
            <span style={{ flexShrink: 0, fontSize: 14, marginTop: 1, lineHeight: 1 }}>⚠</span>
            <span>{error}</span>
          </div>
        ) : null}

        <div style={{ marginTop: 16 }}>
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

        {/* Forgot access note */}
        <div
          style={{
            marginTop: 16,
            padding: '11px 14px',
            background: 'rgba(26,60,94,0.18)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 12,
            fontSize: 11,
            color: 'rgba(138,155,176,0.60)',
            lineHeight: 1.6,
            textAlign: 'center',
          }}
        >
          Signed out and forgot access?{' '}
          <span style={{ color: 'var(--wardle-color-teal)', fontWeight: 600 }}>
            Use password reset from the sign-in screen.
          </span>
        </div>
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
  const [visible, setVisible] = useState(false)
  const [focused, setFocused] = useState(false)

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
      <div style={{ position: 'relative' }}>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'rgba(26,60,94,0.36)',
            border: `1px solid ${focused ? 'rgba(0,180,166,0.62)' : 'rgba(0,180,166,0.24)'}`,
            borderRadius: 14,
            padding: '13px 44px 13px 16px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--wardle-color-mint)',
            outline: 'none',
            fontFamily: 'inherit',
            WebkitAppearance: 'none',
            transition: 'border-color 0.15s ease',
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(138,155,176,0.45)',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(138,155,176,0.85)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(138,155,176,0.45)' }}
        >
          {visible
            ? <EyeOff size={15} strokeWidth={2.5} />
            : <Eye size={15} strokeWidth={2.5} />
          }
        </button>
      </div>
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
