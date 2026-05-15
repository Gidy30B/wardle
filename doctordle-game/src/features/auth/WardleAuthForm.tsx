import { useSignIn, useSignUp } from '@clerk/clerk-react'
import { useMemo, useState, type ReactNode } from 'react'
import Button from '../../components/ui/Button'
import { savePendingAuthProfile } from './authProfileSync'

type AuthMode = 'signin' | 'signup'
type PendingEmailCode =
  | { kind: 'signin'; email: string }
  | { kind: 'signup'; email: string }
  | null

const UNIVERSITIES = [
  'University of Nairobi',
  'Moi University',
  'Kenyatta University',
  'JKUAT',
  'Aga Khan University',
  'Egerton University',
  'Maseno University',
  'Other',
]

export default function WardleAuthForm() {
  const signInState = useSignIn()
  const signUpState = useSignUp()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [displayName, setDisplayName] = useState('')
  const [university, setUniversity] = useState('')
  const [email, setEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [pendingEmailCode, setPendingEmailCode] = useState<PendingEmailCode>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const clerkReady = signInState.isLoaded && signUpState.isLoaded
  const submitLabel = useMemo(() => {
    if (loading) {
      if (pendingEmailCode) {
        return 'Verify and Continue'
      }

      return mode === 'signin' ? 'Sending code...' : 'Sending verification...'
    }

    if (pendingEmailCode) {
      return 'Verify and Continue'
    }

    return mode === 'signin' ? 'Send Sign-In Code' : 'Send Verification Code'
  }, [loading, mode, pendingEmailCode])

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError('')
    setPendingEmailCode(null)
    setVerificationCode('')
  }

  const handleSubmit = async () => {
    setError('')

    if (!clerkReady) {
      setError('Authentication is still loading. Try again in a moment.')
      return
    }

    if (pendingEmailCode) {
      if (!verificationCode.trim()) {
        setError('Enter the verification code Clerk sent to your email.')
        return
      }

      setLoading(true)
      try {
        if (pendingEmailCode.kind === 'signin') {
          await completeSignInVerification({
            signIn: signInState.signIn,
            setActive: signInState.setActive,
            verificationCode,
          })
        } else {
          await completeSignUpVerification({
            signUp: signUpState.signUp,
            setActive: signUpState.setActive,
            verificationCode,
          })
        }
      } catch (exception) {
        setError(getClerkErrorMessage(exception))
      } finally {
        setLoading(false)
      }
      return
    }

    const normalizedEmail = email.trim()

    if (mode === 'signup' && !displayName.trim()) {
      setError('Enter the display name your classmates will see.')
      return
    }

    if (mode === 'signup' && !university.trim()) {
      setError('Choose your university or medical school.')
      return
    }

    if (!normalizedEmail.includes('@')) {
      setError("That email doesn't look right.")
      return
    }

    setLoading(true)

    try {
      if (mode === 'signin') {
        const signInResult = await startSignInEmailCode({
          signIn: signInState.signIn,
          setActive: signInState.setActive,
          email: normalizedEmail,
        })
        if (signInResult === 'needs_email_verification') {
          setPendingEmailCode({ kind: 'signin', email: normalizedEmail })
          setVerificationCode('')
          setError('Check your email for the Wardle sign-in code.')
        }
      } else {
        savePendingAuthProfile({
          email: normalizedEmail,
          displayName,
          university,
        })

        const signUpResult = await startSignUpEmailCode({
          signUp: signUpState.signUp,
          setActive: signUpState.setActive,
          email: normalizedEmail,
        })
        if (signUpResult === 'needs_email_verification') {
          setPendingEmailCode({ kind: 'signup', email: normalizedEmail })
          setVerificationCode('')
          setError('Check your email for the Wardle verification code.')
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

      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        {pendingEmailCode ? (
          <div className="rounded-[14px] border border-[rgba(0,180,166,0.24)] bg-[rgba(0,180,166,0.08)] px-4 py-3 text-sm leading-6 text-white/64">
            Enter the {pendingEmailCode.kind === 'signin' ? 'sign-in' : 'verification'} code sent to{' '}
            <span className="font-bold text-[var(--wardle-color-mint)]">
              {pendingEmailCode.email}
            </span>
            .
          </div>
        ) : null}

        {mode === 'signup' && !pendingEmailCode ? (
          <>
            <Field label="Display name">
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Dr. in the making..."
                className={inputClassName}
                autoComplete="name"
              />
            </Field>
            <Field label="Medical school">
              <select
                value={university}
                onChange={(event) => setUniversity(event.target.value)}
                className={inputClassName}
              >
                <option value="">Select your school</option>
                {UNIVERSITIES.map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : null}

        {pendingEmailCode ? (
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
        ) : (
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
        )}

        {error ? (
          <div className="rounded-[14px] border border-[rgba(224,92,92,0.32)] bg-[rgba(224,92,92,0.12)] px-4 py-3 text-sm text-[#ff9a9a]">
            {error}
          </div>
        ) : null}

        <Button type="submit" disabled={loading || !clerkReady}>
          {submitLabel}
        </Button>

        {pendingEmailCode ? (
          <button
            type="button"
            className="w-full text-center text-xs font-bold text-white/45 transition hover:text-white/70"
            onClick={() => {
              setPendingEmailCode(null)
              setVerificationCode('')
              setError('')
            }}
          >
            Edit email details
          </button>
        ) : null}

        {mode === 'signup' && !pendingEmailCode ? (
          <div className="rounded-[14px] border border-[rgba(244,162,97,0.24)] bg-[rgba(244,162,97,0.08)] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--wardle-color-amber)]">
              Founding member perk
            </p>
            <p className="mt-1 text-xs leading-5 text-white/50">
              Your class details help power school-aware rankings and future learning groups.
            </p>
          </div>
        ) : null}
      </form>

      <p className="mt-5 text-center text-xs leading-5 text-white/40">
        Clerk handles authentication and session security. Wardle uses profile details for app features only.
      </p>
    </div>
  )
}

const inputClassName =
  'w-full rounded-[14px] border border-[rgba(0,180,166,0.24)] bg-[rgba(26,60,94,0.36)] px-4 py-3.5 text-sm font-semibold text-[var(--wardle-color-mint)] outline-none transition placeholder:text-white/30 focus:border-[rgba(0,180,166,0.62)]'

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-white/48">
        {label}
      </span>
      {children}
    </label>
  )
}

async function startSignInEmailCode({
  signIn,
  setActive,
  email,
}: {
  signIn: NonNullable<ReturnType<typeof useSignIn>['signIn']>
  setActive: NonNullable<ReturnType<typeof useSignIn>['setActive']>
  email: string
}) {
  const createResult = await signIn.create({
    identifier: email.trim(),
  })
  throwIfClerkResultError(createResult)

  if (await tryActivateCompletedAttempt(signIn, setActive, createResult)) {
    return 'complete'
  }

  const emailCodeFactor = getEmailCodeFirstFactor(createResult) ?? getEmailCodeFirstFactor(signIn)
  if (!emailCodeFactor?.emailAddressId) {
    throw new Error(
      'This account does not have email code sign-in enabled. Please contact support.',
    )
  }

  const prepareResult = await signIn.prepareFirstFactor({
    strategy: 'email_code',
    emailAddressId: emailCodeFactor.emailAddressId,
  })
  throwIfClerkResultError(prepareResult)

  return 'needs_email_verification'
}

async function completeSignInVerification({
  signIn,
  setActive,
  verificationCode,
}: {
  signIn: NonNullable<ReturnType<typeof useSignIn>['signIn']>
  setActive: NonNullable<ReturnType<typeof useSignIn>['setActive']>
  verificationCode: string
}) {
  const verificationResult = await signIn.attemptFirstFactor({
    strategy: 'email_code',
    code: verificationCode.trim(),
  })
  throwIfClerkResultError(verificationResult)

  await activateCompletedAttempt(signIn, setActive, verificationResult)
}

async function startSignUpEmailCode({
  signUp,
  setActive,
  email,
}: {
  signUp: NonNullable<ReturnType<typeof useSignUp>['signUp']>
  setActive: NonNullable<ReturnType<typeof useSignUp>['setActive']>
  email: string
}) {
  const signUpResult = await signUp.create({
    emailAddress: email.trim(),
  })
  throwIfClerkResultError(signUpResult)

  if (await tryActivateCompletedAttempt(signUp, setActive, signUpResult)) {
    return 'complete'
  }

  await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
  return 'needs_email_verification'
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
  if (await tryActivateCompletedAttempt(resource, setActive, latestResult)) {
    return
  }

  const status =
    getStringProperty(latestResult, 'status') ?? getStringProperty(resource, 'status')

  // TODO(auth-blocker): the custom Clerk sign-in UI does not yet implement
  // MFA second-factor flows. Add a dedicated second-factor step before enabling
  // accounts that return `needs_second_factor`.
  if (status === 'needs_second_factor') {
    throw new Error(
      'This account needs an additional verification step. Please use your configured Clerk sign-in method or contact support.',
    )
  }

  if (status && status !== 'complete') {
    throw new Error(
      'Clerk needs one more verification step before this account can start a session.',
    )
  }

  throw new Error('Clerk did not return an active session.')
}

async function tryActivateCompletedAttempt(
  resource: unknown,
  setActive: (params: { session: string }) => Promise<void>,
  latestResult: unknown,
) {
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

function throwIfClerkResultError(result: unknown) {
  const error = getObjectProperty(result, 'error')
  if (error) {
    throw error
  }
}

function getClerkErrorMessage(exception: unknown) {
  const errors = getArrayProperty(exception, 'errors')
  const firstError = errors[0]
  const longMessage = getStringProperty(firstError, 'longMessage')
  const message = getStringProperty(firstError, 'message') ?? getStringProperty(exception, 'message')

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

function getEmailCodeFirstFactor(value: unknown): { emailAddressId: string } | null {
  const factors = getArrayProperty(value, 'supportedFirstFactors')
  for (const factor of factors) {
    const emailAddressId = getStringProperty(factor, 'emailAddressId')
    if (getStringProperty(factor, 'strategy') === 'email_code' && emailAddressId) {
      return { emailAddressId }
    }
  }

  return null
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
