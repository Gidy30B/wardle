import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import WardleLogo from '../../components/brand/WardleLogo'
import Button from '../../components/ui/Button'
import { useApi } from '../../lib/api'
import {
  createOrganizationApi,
  joinOrganizationApi,
  searchOrganizationsApi,
} from '../organizations/organization.api'
import type {
  Organization,
  OrganizationType,
} from '../organizations/organization.types'
import type { WardleProfileCompletionPayload } from './profile.types'

type ProfileOnboardingScreenProps = {
  suggestedDisplayName: string
  onComplete: (profile: WardleProfileCompletionPayload) => void | Promise<void>
  onSkip: () => void
}

type OrganizationMode = 'individual' | 'join' | 'create'

const ORGANIZATION_TYPES: Array<{ value: OrganizationType; label: string }> = [
  { value: 'UNIVERSITY', label: 'University' },
  { value: 'HOSPITAL', label: 'Hospital' },
  { value: 'COLLEGE', label: 'College' },
  { value: 'OTHER', label: 'Other institution' },
]

export default function ProfileOnboardingScreen({
  suggestedDisplayName,
  onComplete,
  onSkip,
}: ProfileOnboardingScreenProps) {
  const { request } = useApi()
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState(suggestedDisplayName)
  const [mode, setMode] = useState<OrganizationMode>('individual')
  const [organizationQuery, setOrganizationQuery] = useState('')
  const [organizationResults, setOrganizationResults] = useState<Organization[]>([])
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null)
  const [newOrganizationName, setNewOrganizationName] = useState('')
  const [newOrganizationType, setNewOrganizationType] =
    useState<OrganizationType>('UNIVERSITY')
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canSubmit =
    displayName.trim().length > 0 &&
    (mode === 'individual' ||
      (mode === 'join' && selectedOrganization != null) ||
      (mode === 'create' && newOrganizationName.trim().length >= 2))

  const tileIndexes = useMemo(() => Array.from({ length: 25 }, (_, index) => index), [])

  useEffect(() => {
    if (mode !== 'join') {
      return
    }

    const query = organizationQuery.trim()
    if (query.length < 2) {
      setOrganizationResults([])
      setSelectedOrganization(null)
      return
    }

    let active = true
    const timeout = window.setTimeout(() => {
      setSearching(true)
      searchOrganizationsApi(request, query)
        .then((results) => {
          if (!active) {
            return
          }

          setOrganizationResults(results)
        })
        .catch((exception) => {
          if (active) {
            setError(
              exception instanceof Error
                ? exception.message
                : 'Unable to search organizations.',
            )
          }
        })
        .finally(() => {
          if (active) {
            setSearching(false)
          }
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [mode, organizationQuery, request])

  const handleSubmit = async () => {
    setError('')

    if (!displayName.trim()) {
      setError('Enter the display name your classmates will see.')
      return
    }

    if (mode === 'join' && !selectedOrganization) {
      setError('Select an organization to join, or continue as an individual.')
      return
    }

    if (mode === 'create' && newOrganizationName.trim().length < 2) {
      setError('Enter the organization name.')
      return
    }

    setSubmitting(true)

    try {
      let organization: Organization | null = null

      if (mode === 'join' && selectedOrganization) {
        const membership = await joinOrganizationApi(request, selectedOrganization.id)
        organization = membership.organization
      }

      if (mode === 'create') {
        const membership = await createOrganizationApi(request, {
          name: newOrganizationName,
          type: newOrganizationType,
        })
        organization = membership.organization
      }

      await queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] })

      await onComplete({
        displayName,
        university: organization?.name,
        organization,
      })
    } catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : 'Unable to save your profile setup.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(0,180,166,0.16),transparent_36%),linear-gradient(175deg,var(--wardle-color-navy)_0%,var(--wardle-color-charcoal)_58%)] px-4 py-[calc(env(safe-area-inset-top)+1.5rem)] text-white">
      <section className="w-full max-w-[460px] overflow-hidden rounded-[30px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(30,30,44,0.9),rgba(16,24,38,0.96))] shadow-[0_32px_90px_rgba(0,0,0,0.42)]">
        <div className="px-7 pb-2 pt-8 text-center">
          <div className="mb-5 flex justify-center">
            <div className="grid w-[68px] grid-cols-5 gap-1">
              {tileIndexes.map((index) => (
                <div
                  key={index}
                  className={`size-[11px] rounded-[2px] ${
                    index === 12
                      ? 'bg-[var(--wardle-color-teal)]'
                      : index % 7 === 0
                        ? 'bg-[rgba(0,180,166,0.28)]'
                        : 'bg-white/[0.12]'
                  }`}
                />
              ))}
            </div>
          </div>
          <WardleLogo size="lg" className="inline-block" />
          <p className="mt-2 text-sm italic text-white/48">Diagnose. Learn. Win.</p>
        </div>

        <div className="px-7 py-6">
          <div className="rounded-[24px] border border-[rgba(0,180,166,0.18)] bg-[rgba(26,60,94,0.3)] p-4">
            <p className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/85">
              Profile Setup
            </p>
            <h1 className="mt-2 text-xl font-black text-[var(--wardle-color-mint)]">
              Set up your Wardle profile
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/62">
              Add a display name, then optionally connect your institution for future class and team features.
            </p>
          </div>

          <div className="mt-5 space-y-4">
            <FieldLabel label="Display name">
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Dr. in the making..."
                className={inputClassName}
              />
            </FieldLabel>

            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-white/48">
                Organization
              </span>
              <div className="grid gap-2 sm:grid-cols-3">
                <ModeButton
                  active={mode === 'individual'}
                  label="Continue as individual"
                  onClick={() => setMode('individual')}
                />
                <ModeButton
                  active={mode === 'join'}
                  label="Join organization"
                  onClick={() => setMode('join')}
                />
                <ModeButton
                  active={mode === 'create'}
                  label="Create organization"
                  onClick={() => setMode('create')}
                />
              </div>
            </div>

            {mode === 'join' ? (
              <div className="space-y-3">
                <FieldLabel label="Search organization">
                  <input
                    value={organizationQuery}
                    onChange={(event) => {
                      setOrganizationQuery(event.target.value)
                      setSelectedOrganization(null)
                    }}
                    placeholder="University, hospital, college..."
                    className={inputClassName}
                  />
                </FieldLabel>

                <div className="max-h-48 overflow-y-auto rounded-[16px] border border-white/[0.08] bg-white/[0.04] p-2">
                  {searching ? (
                    <p className="px-3 py-2 text-sm text-white/48">Searching...</p>
                  ) : organizationQuery.trim().length < 2 ? (
                    <p className="px-3 py-2 text-sm text-white/48">
                      Type at least two characters to search.
                    </p>
                  ) : organizationResults.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-white/48">
                      No organizations found. You can create one instead.
                    </p>
                  ) : (
                    organizationResults.map((organization) => (
                      <button
                        key={organization.id}
                        type="button"
                        onClick={() => setSelectedOrganization(organization)}
                        className={`mb-2 flex w-full items-center justify-between gap-3 rounded-[12px] border px-3 py-2 text-left text-sm transition last:mb-0 ${
                          selectedOrganization?.id === organization.id
                            ? 'border-[rgba(0,180,166,0.42)] bg-[rgba(0,180,166,0.13)] text-[var(--wardle-color-mint)]'
                            : 'border-transparent bg-white/[0.03] text-white/64 hover:border-white/[0.1]'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{organization.name}</span>
                          <span className="text-xs text-white/40">
                            {formatOrganizationType(organization.type)}
                          </span>
                        </span>
                        <span className="text-xs font-bold text-[var(--wardle-color-teal)]">
                          {selectedOrganization?.id === organization.id ? 'Selected' : 'Select'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {mode === 'create' ? (
              <div className="space-y-3">
                <FieldLabel label="Organization name">
                  <input
                    value={newOrganizationName}
                    onChange={(event) => setNewOrganizationName(event.target.value)}
                    placeholder="University of Nairobi"
                    className={inputClassName}
                  />
                </FieldLabel>

                <FieldLabel label="Organization type">
                  <select
                    value={newOrganizationType}
                    onChange={(event) =>
                      setNewOrganizationType(event.target.value as OrganizationType)
                    }
                    className={inputClassName}
                  >
                    {ORGANIZATION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-[14px] border border-[rgba(224,92,92,0.32)] bg-[rgba(224,92,92,0.12)] px-4 py-3 text-sm text-[#ff9a9a]">
              {error}
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting
                ? 'Saving...'
                : mode === 'individual'
                  ? 'Continue as individual'
                  : mode === 'join'
                    ? 'Join and continue'
                    : 'Create and continue'}
            </Button>
            <Button type="button" variant="ghost" onClick={onSkip} disabled={submitting}>
              Skip for now
            </Button>
          </div>

          <div className="mt-5 rounded-[16px] border border-[rgba(244,162,97,0.24)] bg-[rgba(244,162,97,0.08)] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--wardle-color-amber)]">
              Optional institution setup
            </p>
            <p className="mt-1 text-xs leading-5 text-white/50">
              Individual play still works normally. Organization membership only powers future institution features.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

const inputClassName =
  'w-full rounded-[14px] border border-[rgba(0,180,166,0.24)] bg-[rgba(26,60,94,0.36)] px-4 py-3.5 text-sm font-semibold text-[var(--wardle-color-mint)] outline-none transition placeholder:text-white/30 focus:border-[rgba(0,180,166,0.62)]'

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[48px] rounded-[14px] border px-3 py-2 text-xs font-bold transition ${
        active
          ? 'border-[rgba(0,180,166,0.42)] bg-[rgba(0,180,166,0.14)] text-[var(--wardle-color-mint)]'
          : 'border-white/[0.08] bg-white/[0.04] text-white/48 hover:border-white/[0.14] hover:text-white/68'
      }`}
    >
      {label}
    </button>
  )
}

function FieldLabel({
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

function formatOrganizationType(type: OrganizationType) {
  const match = ORGANIZATION_TYPES.find((item) => item.value === type)
  return match?.label ?? 'Institution'
}
