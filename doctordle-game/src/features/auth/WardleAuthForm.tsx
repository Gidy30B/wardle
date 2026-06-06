import { useSignIn, useSignUp } from '@clerk/clerk-react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import Button from '../../components/ui/Button'
import { getClerkOAuthRedirects, isNativeRuntime } from './authRedirects'

type AuthMode = 'signin' | 'signup'
// Signup email verification is the only step that produces a pending verification state.
// Sign-in is one step (email + password).
// Password reset has its own separate step state below.
type PendingVerification = { email: string } | null
// null = not in reset mode; 'email' = collecting email; 'code' = entering code + new password
type ResetStep = 'email' | 'code' | null

export default function WardleAuthForm() {
  const signInState = useSignIn()
  const signUpState = useSignUp()

  // Auth mode state
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [pendingVerification, setPendingVerification] = useState<PendingVerification>(null)

  // Password reset state (independent from sign-in fields)
  const [resetStep, setResetStep] = useState<ResetStep>(null)
  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const clerkReady = signInState.isLoaded && signUpState.isLoaded
  const showGoogleOAuth = !isNativeRuntime()

  // Changes when the visible view changes — triggers wardle-learn-slide-up animation via key
  const formContentKey =
    resetStep === 'email' ? 'reset-email' :
    resetStep === 'code' ? 'reset-code' :
    pendingVerification ? 'verify' :
    mode

  const submitLabel = useMemo(() => {
    if (resetStep === 'email') return loading ? 'Sending...' : 'Send reset code'
    if (resetStep === 'code') return loading ? 'Setting password...' : 'Set new password'
    if (pendingVerification) return loading ? 'Verifying...' : 'Verify Email'
    if (loading) return mode === 'signin' ? 'Signing in...' : 'Creating account...'
    return mode === 'signin' ? 'Sign In' : 'Create Account'
  }, [loading, mode, pendingVerification, resetStep])

  const handleGoogleOAuth = async () => {
    setError('')

    if (!clerkReady) {
      setError('Authentication is still loading. Try again in a moment.')
      return
    }

    setLoading(true)

    try {
      const { redirectUrl, redirectUrlComplete } = getClerkOAuthRedirects()
      const oauthParams = {
        strategy: 'oauth_google' as const,
        redirectUrl,
        redirectUrlComplete,
      }

      if (mode === 'signup') {
        await signUpState.signUp.authenticateWithRedirect(oauthParams)
      } else {
        await signInState.signIn.authenticateWithRedirect(oauthParams)
      }
    } catch (exception) {
      setError(getClerkErrorMessage(exception))
      setLoading(false)
    }
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError('')
    setPendingVerification(null)
    setVerificationCode('')
    setPassword('')
    setConfirmPassword('')
    setResetStep(null)
    setResetEmail('')
    setResetCode('')
    setResetNewPassword('')
    setResetConfirmPassword('')
  }

  const enterResetMode = () => {
    setResetStep('email')
    setResetEmail(email.trim())
    setError('')
  }

  const exitResetMode = () => {
    setResetStep(null)
    setResetEmail('')
    setResetCode('')
    setResetNewPassword('')
    setResetConfirmPassword('')
    setError('')
  }

  const handleSubmit = async () => {
    setError('')

    if (!clerkReady) {
      setError('Authentication is still loading. Try again in a moment.')
      return
    }

    // ── Reset step 1: collect email and send code ───────────────────────────
    if (resetStep === 'email') {
      const normalizedResetEmail = resetEmail.trim()
      if (!normalizedResetEmail.includes('@')) {
        setError("That email doesn't look right.")
        return
      }
      setLoading(true)
      try {
        await startPasswordReset({
          signIn: signInState.signIn,
          email: normalizedResetEmail,
        })
        setResetStep('code')
        setError('')
      } catch (exception) {
        setError(getClerkErrorMessage(exception))
      } finally {
        setLoading(false)
      }
      return
    }

    // ── Reset step 2: submit code + new password ────────────────────────────
    if (resetStep === 'code') {
      if (!resetCode.trim()) {
        setError('Enter the reset code sent to your email.')
        return
      }
      if (!resetNewPassword) {
        setError('Enter your new password.')
        return
      }
      if (resetNewPassword !== resetConfirmPassword) {
        setError("Passwords don't match. Please try again.")
        return
      }
      setLoading(true)
      try {
        await completePasswordReset({
          signIn: signInState.signIn,
          setActive: signInState.setActive,
          code: resetCode,
          newPassword: resetNewPassword,
        })
      } catch (exception) {
        setError(getClerkErrorMessage(exception))
      } finally {
        setLoading(false)
      }
      return
    }

    // ── Signup email verification ──────────────────────────────────────────
    if (pendingVerification) {
      if (!verificationCode.trim()) {
        setError('Enter the verification code sent to your email.')
        return
      }

      setLoading(true)
      try {
        await completeSignUpVerification({
          signUp: signUpState.signUp,
          setActive: signUpState.setActive,
          verificationCode,
        })
      } catch (exception) {
        setError(getClerkErrorMessage(exception))
      } finally {
        setLoading(false)
      }
      return
    }

    // ── Normal sign-in / signup ────────────────────────────────────────────
    const normalizedEmail = email.trim()

    if (!normalizedEmail.includes('@')) {
      setError("That email doesn't look right.")
      return
    }

    if (!password) {
      setError('Enter your password.')
      return
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError("Passwords don't match. Please try again.")
      return
    }

    setLoading(true)

    try {
      if (mode === 'signin') {
        await signInWithPassword({
          signIn: signInState.signIn,
          setActive: signInState.setActive,
          email: normalizedEmail,
          password,
        })
      } else {
        const signUpResult = await signUpWithPassword({
          signUp: signUpState.signUp,
          setActive: signUpState.setActive,
          email: normalizedEmail,
          password,
        })
        if (signUpResult === 'needs_email_verification') {
          setPendingVerification({ email: normalizedEmail })
          setVerificationCode('')
        }
      }
    } catch (exception) {
      setError(getClerkErrorMessage(exception))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {!resetStep ? (
        <div className="wardle-nav-pill w-full">
          <button
            type="button"
            className={`flex-1 ${mode === 'signin' ? 'border-[var(--wardle-color-teal)] bg-[rgba(0,180,166,0.18)] text-white' : 'border-transparent text-white/48'}`}
            onClick={() => switchMode('signin')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`flex-1 ${mode === 'signup' ? 'border-[var(--wardle-color-teal)] bg-[rgba(0,180,166,0.18)] text-white' : 'border-transparent text-white/48'}`}
            onClick={() => switchMode('signup')}
          >
            Create Account
          </button>
        </div>
      ) : null}

      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        {/* View-specific content — animated on state change via key remount */}
        <div key={formContentKey} className="wardle-learn-slide-up space-y-4">
          {resetStep === 'email' ? (
            <>
              <InfoBanner icon="🔑">
                Enter your email and we'll send a one-time password reset code.
              </InfoBanner>
              <Field label="Email">
                <input
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  type="email"
                  placeholder="you@medschool.ac.ke"
                  className={inputClassName}
                  autoComplete="email"
                />
              </Field>
            </>
          ) : resetStep === 'code' ? (
            <>
              <InfoBanner icon="📧">
                Reset code sent to{' '}
                <span className="font-bold text-[var(--wardle-color-mint)]">{resetEmail}</span>.
                {' '}Check your spam folder if needed.
              </InfoBanner>
              <Field label="Reset code">
                <input
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value)}
                  inputMode="numeric"
                  placeholder="123456"
                  className={inputClassName}
                  autoComplete="one-time-code"
                />
              </Field>
              <Field label="New password">
                <PasswordInput
                  value={resetNewPassword}
                  onChange={setResetNewPassword}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm new password">
                <PasswordInput
                  value={resetConfirmPassword}
                  onChange={setResetConfirmPassword}
                  autoComplete="new-password"
                />
              </Field>
            </>
          ) : pendingVerification ? (
            <>
              <InfoBanner icon="📧">
                Verification code sent to{' '}
                <span className="font-bold text-[var(--wardle-color-mint)]">
                  {pendingVerification.email}
                </span>
                . Check your spam folder too.
              </InfoBanner>
              <Field label="Verification code">
                <input
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  inputMode="numeric"
                  placeholder="123456"
                  className={inputClassName}
                  autoComplete="one-time-code"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Email">
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="you@medschool.ac.ke"
                  className={inputClassName}
                  autoComplete="email"
                />
              </Field>
              <Field
                label="Password"
                right={
                  mode === 'signin' ? (
                    <button
                      type="button"
                      className="text-xs font-bold text-white/40 transition hover:text-[var(--wardle-color-teal)]"
                      onClick={(e) => {
                        e.stopPropagation()
                        enterResetMode()
                      }}
                    >
                      Forgot password?
                    </button>
                  ) : undefined
                }
              >
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </Field>
              {mode === 'signup' ? (
                <Field label="Confirm password">
                  <PasswordInput
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                  />
                </Field>
              ) : null}
            </>
          )}
        </div>

        {error ? (
          <div className="flex items-start gap-2.5 rounded-[14px] border border-[rgba(224,92,92,0.32)] bg-[rgba(224,92,92,0.12)] px-4 py-3 text-sm text-[#ff9a9a]">
            <span className="mt-0.5 shrink-0 text-[15px] leading-none">⚠</span>
            <span>{error}</span>
          </div>
        ) : null}

        <Button type="submit" disabled={loading || !clerkReady}>
          <span className="flex items-center justify-center gap-2">
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitLabel}
          </span>
        </Button>

        {showGoogleOAuth && !pendingVerification && !resetStep ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/36">
                OR
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={loading || !clerkReady}
              onClick={() => {
                void handleGoogleOAuth()
              }}
            >
              Continue with Google
            </Button>
          </div>
        ) : null}

        {resetStep ? (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 text-xs font-bold text-white/45 transition hover:text-white/70"
            onClick={exitResetMode}
          >
            <span>‹</span>
            <span>Back to sign in</span>
          </button>
        ) : pendingVerification ? (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 text-xs font-bold text-white/45 transition hover:text-white/70"
            onClick={() => {
              setPendingVerification(null)
              setVerificationCode('')
              setError('')
            }}
          >
            <span>‹</span>
            <span>Edit email details</span>
          </button>
        ) : null}

        {mode === 'signup' && !pendingVerification && !resetStep ? (
          <div className="rounded-[14px] border border-[rgba(244,162,97,0.24)] bg-[rgba(244,162,97,0.08)] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--wardle-color-amber)]">
              Founder members perk
            </p>
            <p className="mt-1 text-xs leading-5 text-white/50">
              Early members get extended premium access and a founders badge when premium launches.
            </p>
          </div>
        ) : null}
      </form>
    </div>
  )
}

const inputClassName =
  'w-full rounded-[14px] border border-[rgba(0,180,166,0.24)] bg-[rgba(26,60,94,0.36)] px-4 py-3.5 text-sm font-semibold text-[var(--wardle-color-mint)] outline-none transition placeholder:text-white/30 focus:border-[rgba(0,180,166,0.62)]'

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Field({
  label,
  right,
  children,
}: {
  label: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/48">
          {label}
        </span>
        {right ?? null}
      </div>
      {children}
    </label>
  )
}

function InfoBanner({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[14px] border border-[rgba(0,180,166,0.24)] bg-[rgba(0,180,166,0.08)] px-4 py-3.5">
      <span className="mt-0.5 shrink-0 text-base leading-none">{icon}</span>
      <div className="text-sm leading-[1.6] text-white/64">{children}</div>
    </div>
  )
}

function PasswordInput({
  value,
  onChange,
  autoComplete,
}: {
  value: string
  onChange: (value: string) => void
  autoComplete: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={visible ? 'text' : 'password'}
        className={`${inputClassName} pr-11`}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 text-white/36 transition hover:text-white/70 focus:outline-none"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible
          ? <EyeOff className="size-[15px]" strokeWidth={2.5} />
          : <Eye className="size-[15px]" strokeWidth={2.5} />
        }
      </button>
    </div>
  )
}

// ─── Clerk async helpers ──────────────────────────────────────────────────────

async function startPasswordReset({
  signIn,
  email,
}: {
  signIn: NonNullable<ReturnType<typeof useSignIn>['signIn']>
  email: string
}) {
  const result = await signIn.create({
    strategy: 'reset_password_email_code',
    identifier: email.trim(),
  })
  throwIfClerkResultError(result)
}

async function completePasswordReset({
  signIn,
  setActive,
  code,
  newPassword,
}: {
  signIn: NonNullable<ReturnType<typeof useSignIn>['signIn']>
  setActive: NonNullable<ReturnType<typeof useSignIn>['setActive']>
  code: string
  newPassword: string
}) {
  const result = await signIn.attemptFirstFactor({
    strategy: 'reset_password_email_code',
    code: code.trim(),
    password: newPassword,
  })
  throwIfClerkResultError(result)
  await activateCompletedAttempt(signIn, setActive, result)
}

async function signInWithPassword({
  signIn,
  setActive,
  email,
  password,
}: {
  signIn: NonNullable<ReturnType<typeof useSignIn>['signIn']>
  setActive: NonNullable<ReturnType<typeof useSignIn>['setActive']>
  email: string
  password: string
}) {
  const result = await signIn.create({ identifier: email.trim(), password })
  throwIfClerkResultError(result)
  await activateCompletedAttempt(signIn, setActive, result)
}

async function signUpWithPassword({
  signUp,
  setActive,
  email,
  password,
}: {
  signUp: NonNullable<ReturnType<typeof useSignUp>['signUp']>
  setActive: NonNullable<ReturnType<typeof useSignUp>['setActive']>
  email: string
  password: string
}) {
  const signUpResult = await signUp.create({ emailAddress: email.trim(), password })
  throwIfClerkResultError(signUpResult)

  if (await tryActivateCompletedAttempt(signUp, setActive, signUpResult)) {
    return 'complete' as const
  }

  await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
  return 'needs_email_verification' as const
}

async function completeSignUpVerification({
  signUp,
  setActive,
  verificationCode,
}: {
  signUp: NonNullable<ReturnType<typeof useSignUp>['signUp']>
  setActive: NonNullable<ReturnType<typeof useSignUp>['setActive']>
  verificationCode: string
}) {
  const verificationResult = await signUp.attemptEmailAddressVerification({
    code: verificationCode.trim(),
  })
  throwIfClerkResultError(verificationResult)

  await activateCompletedAttempt(signUp, setActive, verificationResult)
}

async function activateCompletedAttempt(
  resource: unknown,
  setActive: (params: { session: string }) => Promise<void>,
  latestResult: unknown,
) {
  const status =
    getStringProperty(latestResult, 'status') ?? getStringProperty(resource, 'status')

  if (status === 'complete') {
    if (await tryActivateCompletedAttempt(resource, setActive, latestResult)) {
      return
    }

    throw new Error('Clerk completed verification but did not return a session.')
  }

  if (status) {
    logIncompleteClerkAttempt(latestResult, resource)
  }

  // TODO(auth-blocker): the custom Clerk sign-in UI does not yet implement
  // MFA second-factor flows. Add a dedicated second-factor step before enabling
  // accounts that return `needs_second_factor`.
  if (status === 'needs_second_factor') {
    throw new Error(
      'This account needs an additional verification step. Please use your configured Clerk sign-in method or contact support.',
    )
  }

  if (status && status !== 'complete') {
    throw new Error(getIncompleteClerkAttemptMessage(latestResult, resource))
  }

  throw new Error('Clerk did not return an active session.')
}

async function tryActivateCompletedAttempt(
  resource: unknown,
  setActive: (params: { session: string }) => Promise<void>,
  latestResult: unknown,
) {
  const status =
    getStringProperty(latestResult, 'status') ?? getStringProperty(resource, 'status')
  if (status !== 'complete') {
    return false
  }

  const sessionId =
    getStringProperty(latestResult, 'createdSessionId') ??
    getStringProperty(latestResult, 'created_session_id') ??
    getStringProperty(resource, 'createdSessionId') ??
    getStringProperty(resource, 'created_session_id')

  if (sessionId) {
    await setActive({ session: sessionId })
    return true
  }

  const finalize = getFunctionProperty(resource, 'finalize')
  if (finalize) {
    const finalizeResult = await finalize.call(resource)
    throwIfClerkResultError(finalizeResult)
    const finalizedSessionId =
      getStringProperty(finalizeResult, 'createdSessionId') ??
      getStringProperty(finalizeResult, 'created_session_id') ??
      getStringProperty(resource, 'createdSessionId') ??
      getStringProperty(resource, 'created_session_id')

    if (finalizedSessionId) {
      await setActive({ session: finalizedSessionId })
      return true
    }
  }

  return false
}

function logIncompleteClerkAttempt(latestResult: unknown, resource: unknown) {
  if (!import.meta.env.DEV) {
    return
  }

  console.warn('[auth] Clerk verification incomplete', {
    status: getStringProperty(latestResult, 'status') ?? getStringProperty(resource, 'status'),
    missingFields: getStringArrayProperty(latestResult, 'missingFields') ??
      getStringArrayProperty(latestResult, 'missing_fields') ??
      getStringArrayProperty(resource, 'missingFields') ??
      getStringArrayProperty(resource, 'missing_fields') ??
      [],
    unverifiedFields: getStringArrayProperty(latestResult, 'unverifiedFields') ??
      getStringArrayProperty(latestResult, 'unverified_fields') ??
      getStringArrayProperty(resource, 'unverifiedFields') ??
      getStringArrayProperty(resource, 'unverified_fields') ??
      [],
  })
}

function getIncompleteClerkAttemptMessage(latestResult: unknown, resource: unknown) {
  const missingFields =
    getStringArrayProperty(latestResult, 'missingFields') ??
    getStringArrayProperty(latestResult, 'missing_fields') ??
    getStringArrayProperty(resource, 'missingFields') ??
    getStringArrayProperty(resource, 'missing_fields') ??
    []
  const unverifiedFields =
    getStringArrayProperty(latestResult, 'unverifiedFields') ??
    getStringArrayProperty(latestResult, 'unverified_fields') ??
    getStringArrayProperty(resource, 'unverifiedFields') ??
    getStringArrayProperty(resource, 'unverified_fields') ??
    []

  if (missingFields.some(isPasswordField)) {
    return 'This account still needs a password. Disable required passwords in Clerk or add a password field to Wardle signup.'
  }

  if (missingFields.some(isNameField)) {
    return 'This account still needs a required name field. Relax Clerk name requirements or submit the required name fields during signup.'
  }

  if (missingFields.some(isPhoneField)) {
    return 'This account still needs a phone number. Disable required phone signup in Clerk or add phone verification to Wardle signup.'
  }

  if (unverifiedFields.some(isEmailField)) {
    return 'This email address is not verified yet. Check the code and try again.'
  }

  return 'Clerk requires another signup field before this account can start a session. Check the Clerk signup requirements for this application.'
}

function isPasswordField(field: string) {
  return field.toLowerCase().includes('password')
}

function isNameField(field: string) {
  const normalized = field.toLowerCase()
  return normalized.includes('name') || normalized.includes('username')
}

function isPhoneField(field: string) {
  return field.toLowerCase().includes('phone')
}

function isEmailField(field: string) {
  return field.toLowerCase().includes('email')
}

function throwIfClerkResultError(result: unknown) {
  const error = getObjectProperty(result, 'error')
  if (error) {
    throw error
  }
}

function getClerkErrorMessage(exception: unknown) {
  const errors = getArrayProperty(exception, 'errors')
  const firstError = errors[0]
  const code = getStringProperty(firstError, 'code')
  const longMessage = getStringProperty(firstError, 'longMessage')
  const message = getStringProperty(firstError, 'message') ?? getStringProperty(exception, 'message')

  switch (code) {
    // Sign-in
    case 'form_password_incorrect':
      return 'Incorrect password. Please try again.'
    case 'form_identifier_not_found':
      return 'No account found with that email address.'
    case 'form_identifier_exists':
      return 'An account with this email already exists. Try signing in instead.'
    case 'strategy_for_user_invalid':
      return 'This account uses a different sign-in method. Try signing in with Google or contact support.'
    case 'not_allowed_access':
      return longMessage ?? 'Access denied. Please contact support.'

    // Password strength (sign-up and reset)
    case 'form_password_pwned':
    case 'form_password_length_too_short':
    case 'form_password_validation_failed':
    case 'form_password_strength_insufficient':
      return longMessage ?? 'Password is too weak. Use at least 8 characters with a mix of letters and numbers.'

    // Password reset codes
    case 'form_code_incorrect':
      return 'Incorrect reset code. Please check your email and try again.'
    case 'form_code_expired':
    case 'verification_expired':
      return 'That reset code has expired. Go back and request a new one.'
    case 'verification_failed':
      return 'Invalid reset code. Please check your email and try again.'
    case 'too_many_requests':
    case 'too_many_attempts':
      return 'Too many attempts. Please wait a moment before trying again.'
  }

  return longMessage ?? message ?? 'Authentication failed. Please try again.'
}

function getObjectProperty(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const property = (value as Record<string, unknown>)[key]
  return property && typeof property === 'object' ? property as Record<string, unknown> : null
}

function getArrayProperty(value: unknown, key: string): unknown[] {
  if (!value || typeof value !== 'object') {
    return []
  }

  const property = (value as Record<string, unknown>)[key]
  return Array.isArray(property) ? property : []
}

function getStringArrayProperty(value: unknown, key: string): string[] | null {
  const property = getArrayProperty(value, key)
  const strings = property.filter((item): item is string => typeof item === 'string')

  return strings.length > 0 ? strings : null
}

function getStringProperty(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const property = (value as Record<string, unknown>)[key]
  return typeof property === 'string' && property.length > 0 ? property : null
}

function getFunctionProperty(value: unknown, key: string) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const property = (value as Record<string, unknown>)[key]
  return typeof property === 'function' ? property : null
}
