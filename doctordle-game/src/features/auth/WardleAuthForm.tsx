import { useSignIn, useSignUp } from '@clerk/clerk-react'
import { Capacitor } from '@capacitor/core'
import { useMemo, useState, type ReactNode } from 'react'
import Button from '../../components/ui/Button'
import { getClerkOAuthRedirects } from './authRedirects'
import { savePendingAuthProfile } from './authProfileSync'

type AuthMode = 'signin' | 'signup'

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
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pendingEmailVerification, setPendingEmailVerification] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)

  const clerkReady = signInState.isLoaded && signUpState.isLoaded
  const submitLabel = useMemo(() => {
    if (loading) {
      if (pendingEmailVerification) {
        return 'Verify and Continue'
      }

      return mode === 'signin' ? 'Checking vitals...' : 'Creating profile...'
    }

    if (pendingEmailVerification) {
      return 'Verify and Continue'
    }

    return mode === 'signin' ? 'Sign In' : 'Join the Founding Class'
  }, [loading, mode, pendingEmailVerification])

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError('')
    setPendingEmailVerification(false)
    setVerificationCode('')
  }

  const handleSubmit = async () => {
    setError('')

    if (!clerkReady) {
      setError('Authentication is still loading. Try again in a moment.')
      return
    }

    if (pendingEmailVerification) {
      if (!verificationCode.trim()) {
        setError('Enter the verification code Clerk sent to your email.')
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

    if (mode === 'signup' && !displayName.trim()) {
      setError('Enter the display name your classmates will see.')
      return
    }

    if (mode === 'signup' && !university.trim()) {
      setError('Choose your university or medical school.')
      return
    }

    if (!email.includes('@')) {
      setError("That email doesn't look right.")
      return
    }

    if (password.length < 1) {
      setError('Enter your password.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'signin') {
        await completeSignIn({
          signIn: signInState.signIn,
          setActive: signInState.setActive,
          email,
          password,
        })
      } else {
        savePendingAuthProfile({
          email,
          displayName,
          university,
        })

        const signUpResult = await completeSignUp({
          signUp: signUpState.signUp,
          setActive: signUpState.setActive,
          email,
          password,
        })
        if (signUpResult === 'needs_email_verification') {
          setPendingEmailVerification(true)
          setVerificationCode('')
          setError('Check your email for the Clerk verification code.')
        }
      }
    } catch (exception) {
      setError(getClerkErrorMessage(exception))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleOAuth = async () => {
    setError('')

    if (!signInState.isLoaded) {
      setError('Authentication is still loading. Try again in a moment.')
      return
    }

    setOauthLoading(true)

    try {
      const isNativePlatform = Capacitor.isNativePlatform()
      const platform = Capacitor.getPlatform()
      const { redirectUrl, redirectUrlComplete } = getClerkOAuthRedirects()

      console.log('[Wardle OAuth redirect]', {
        isNativePlatform,
        platform,
        redirectUrl,
        redirectUrlComplete,
      })

      await signInState.signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl,
        redirectUrlComplete,
      })
    } catch (exception) {
      setError(getClerkErrorMessage(exception))
      setOauthLoading(false)
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
        {pendingEmailVerification ? (
          <div className="rounded-[14px] border border-[rgba(0,180,166,0.24)] bg-[rgba(0,180,166,0.08)] px-4 py-3 text-sm leading-6 text-white/64">
            We created your Clerk sign-up attempt. Enter the verification code sent to{' '}
            <span className="font-bold text-[var(--wardle-color-mint)]">{email}</span>.
          </div>
        ) : null}

        {mode === 'signup' && !pendingEmailVerification ? (
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

        {pendingEmailVerification ? (
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
          <>
            <Field label="Email">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="you@medschool.ac.ke"
                className={inputClassName}
                autoComplete={mode === 'signin' ? 'email' : 'username'}
              />
            </Field>

            <Field label="Password">
              <div className="relative">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="********"
                  className={`${inputClassName} pr-16`}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/45"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>
          </>
        )}

        {error ? (
          <div className="rounded-[14px] border border-[rgba(224,92,92,0.32)] bg-[rgba(224,92,92,0.12)] px-4 py-3 text-sm text-[#ff9a9a]">
            {error}
          </div>
        ) : null}

        <Button type="submit" disabled={loading || !clerkReady}>
          {submitLabel}
        </Button>

        {!pendingEmailVerification ? (
          <>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <span className="text-xs font-semibold text-white/38">or continue with</span>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <button
              type="button"
              disabled={oauthLoading || !signInState.isLoaded}
              onClick={() => void handleGoogleOAuth()}
              className="flex w-full items-center justify-center gap-3 rounded-[14px] border border-white/[0.1] bg-white/[0.05] px-4 py-3.5 text-sm font-bold text-[var(--wardle-color-mint)] transition hover:border-[rgba(0,180,166,0.28)] hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-white text-sm font-black text-[#4285f4]">
                G
              </span>
              {oauthLoading ? 'Opening Google...' : 'Continue with Google'}
            </button>
          </>
        ) : null}

        {pendingEmailVerification ? (
          <button
            type="button"
            className="w-full text-center text-xs font-bold text-white/45 transition hover:text-white/70"
            onClick={() => {
              setPendingEmailVerification(false)
              setVerificationCode('')
              setError('')
            }}
          >
            Edit sign-up details
          </button>
        ) : null}

        {mode === 'signup' && !pendingEmailVerification ? (
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

async function completeSignIn({
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
  const createResult = await signIn.create({
    strategy: 'password',
    identifier: email.trim(),
    password,
  })
  throwIfClerkResultError(createResult)

  if (getStringProperty(createResult, 'status') === 'needs_second_factor') {
    throw new Error(
      'This account needs an additional verification step. Please use your configured Clerk sign-in method or contact support.',
    )
  }

  await activateCompletedAttempt(signIn, setActive, createResult)
}

async function completeSignUp({
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
  const signUpResult = await signUp.create({
    emailAddress: email.trim(),
    password,
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
  // second-factor flows. Add a dedicated MFA/email-code step before enabling
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
