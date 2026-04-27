import { useAuth, useUser } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import SurfaceCard from '../../../components/ui/SurfaceCard'
import WardleLogo from '../../../components/brand/WardleLogo'
import { useApi } from '../../../lib/api'
import type { UserOrganizationMembership } from '../../organizations/organization.types'
import { searchOrganizationsApi } from '../../organizations/organization.api'
import type { Organization } from '../../organizations/organization.types'
import {
  getBackendProfileApi,
  updateBackendProfileApi,
} from '../../profile/profile.api'

type SettingsPageProps = {
  currentStreak: number | null
  xpTotal: number | null
  organizationName: string | null
  memberships: UserOrganizationMembership[]
}

export default function SettingsPage({
  currentStreak,
  xpTotal,
  organizationName,
  memberships,
}: SettingsPageProps) {
  const { isLoaded, isSignedIn, signOut } = useAuth()
  const { user } = useUser()
  const { request } = useApi()
  const queryClient = useQueryClient()

  const profileQuery = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => getBackendProfileApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

  const backendProfile = profileQuery.data
  const resolvedMemberships =
    backendProfile?.memberships && backendProfile.memberships.length > 0
      ? backendProfile.memberships
      : memberships
  const activeOrganization =
    backendProfile?.activeOrganization ??
    resolvedMemberships.find((membership) => membership.status === 'ACTIVE')?.organization ??
    null

  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [displayNameInput, setDisplayNameInput] = useState('')
  const [trainingLevelInput, setTrainingLevelInput] = useState('')
  const [countryInput, setCountryInput] = useState('')
  const [individualModeInput, setIndividualModeInput] = useState(true)
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)
  const [organizationQuery, setOrganizationQuery] = useState('')
  const [organizationResults, setOrganizationResults] = useState<Organization[]>([])
  const [searchingOrganizations, setSearchingOrganizations] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [saveError, setSaveError] = useState('')

  const fallbackDisplayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ??
    'Wardle clinician'

  const displayName =
    backendProfile?.displayName?.trim() || fallbackDisplayName
  const email = user?.primaryEmailAddress?.emailAddress ?? 'Signed in'

  const organizationOptions = useMemo(() => {
    const fromMemberships = resolvedMemberships.map((membership) => membership.organization)
    const merged = new Map<string, Organization>()

    for (const organization of [...fromMemberships, ...organizationResults]) {
      merged.set(organization.id, organization)
    }

    return Array.from(merged.values())
  }, [organizationResults, resolvedMemberships])

  useEffect(() => {
    if (!backendProfile) {
      return
    }

    if (isEditingProfile) {
      return
    }

    setDisplayNameInput(backendProfile.displayName?.trim() ?? fallbackDisplayName)
    setTrainingLevelInput(backendProfile.trainingLevel?.trim() ?? '')
    setCountryInput(backendProfile.country?.trim() ?? '')
    setIndividualModeInput(backendProfile.individualMode ?? !backendProfile.activeOrganization)
    setSelectedOrganizationId(backendProfile.activeOrganization?.id ?? null)
  }, [backendProfile, fallbackDisplayName, isEditingProfile])

  useEffect(() => {
    if (!isEditingProfile || individualModeInput) {
      return
    }

    const query = organizationQuery.trim()
    if (query.length < 2) {
      setOrganizationResults([])
      return
    }

    let active = true
    const timeout = window.setTimeout(() => {
      setSearchingOrganizations(true)
      searchOrganizationsApi(request, query)
        .then((results) => {
          if (!active) {
            return
          }

          setOrganizationResults(results)
        })
        .catch((error: unknown) => {
          if (!active) {
            return
          }

          setSaveError(error instanceof Error ? error.message : 'Unable to search organizations.')
        })
        .finally(() => {
          if (active) {
            setSearchingOrganizations(false)
          }
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [individualModeInput, isEditingProfile, organizationQuery, request])

  const beginEditProfile = () => {
    setSaveError('')
    setIsEditingProfile(true)
  }

  const cancelEditProfile = () => {
    if (backendProfile) {
      setDisplayNameInput(backendProfile.displayName?.trim() ?? fallbackDisplayName)
      setTrainingLevelInput(backendProfile.trainingLevel?.trim() ?? '')
      setCountryInput(backendProfile.country?.trim() ?? '')
      setIndividualModeInput(backendProfile.individualMode ?? !backendProfile.activeOrganization)
      setSelectedOrganizationId(backendProfile.activeOrganization?.id ?? null)
    }
    setOrganizationQuery('')
    setOrganizationResults([])
    setSaveError('')
    setIsEditingProfile(false)
  }

  const saveProfile = async () => {
    setSaveError('')

    if (!displayNameInput.trim()) {
      setSaveError('Display name is required.')
      return
    }

    if (!individualModeInput && !selectedOrganizationId) {
      setSaveError('Select an organization or switch to individual mode.')
      return
    }

    setSavingProfile(true)
    try {
      await updateBackendProfileApi(request, {
        displayName: displayNameInput.trim(),
        trainingLevel: trainingLevelInput.trim() || undefined,
        country: countryInput.trim() || undefined,
        individualMode: individualModeInput,
        organizationId: individualModeInput ? null : selectedOrganizationId,
      })

      await queryClient.invalidateQueries({ queryKey: ['profile', 'me'] })
      await queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] })

      setIsEditingProfile(false)
      setOrganizationQuery('')
      setOrganizationResults([])
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save profile settings.')
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <main className="flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto px-1 pb-4 pt-1 sm:px-2">
      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-[26px] border border-white/[0.06] bg-[linear-gradient(145deg,rgba(26,60,94,0.88),rgba(30,30,44,0.98)_68%)] px-5 py-6 shadow-[0_22px_54px_rgba(0,0,0,0.22)]">
          <div className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-[rgba(0,180,166,0.16)] blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.06]" />
          <div className="relative">
            <WardleLogo size="sm" subtitle="Settings" />
            <h1 className="mt-5 text-2xl font-black text-[var(--wardle-color-mint)]">
              Settings
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/68">
              Manage your profile, organization, account, and app help.
            </p>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <SurfaceCard eyebrow="Profile" title="User summary">
            {isEditingProfile ? (
              <div className="space-y-3">
                <Field label="Display name">
                  <input
                    value={displayNameInput}
                    onChange={(event) => setDisplayNameInput(event.target.value)}
                    className={inputClassName}
                    placeholder="Dr. in the making..."
                    maxLength={80}
                  />
                </Field>

                <Field label="Profile mode">
                  <div className="grid grid-cols-2 gap-2">
                    <ToggleButton
                      active={individualModeInput}
                      onClick={() => {
                        setIndividualModeInput(true)
                        setSelectedOrganizationId(null)
                      }}
                      label="Individual"
                    />
                    <ToggleButton
                      active={!individualModeInput}
                      onClick={() => setIndividualModeInput(false)}
                      label="Organization"
                    />
                  </div>
                </Field>

                {!individualModeInput ? (
                  <>
                    <Field label="Organization">
                      <select
                        className={inputClassName}
                        value={selectedOrganizationId ?? ''}
                        onChange={(event) =>
                          setSelectedOrganizationId(event.target.value || null)
                        }
                      >
                        <option value="">Select an organization</option>
                        {organizationOptions.map((organization) => (
                          <option key={organization.id} value={organization.id}>
                            {organization.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Search organizations">
                      <input
                        value={organizationQuery}
                        onChange={(event) => setOrganizationQuery(event.target.value)}
                        className={inputClassName}
                        placeholder="Search to add another organization option"
                      />
                    </Field>

                    {searchingOrganizations ? (
                      <p className="text-xs text-white/48">Searching organizations...</p>
                    ) : null}
                  </>
                ) : null}

                <Field label="Training level (optional)">
                  <input
                    value={trainingLevelInput}
                    onChange={(event) => setTrainingLevelInput(event.target.value)}
                    className={inputClassName}
                    placeholder="Intern, Resident, Student..."
                    maxLength={80}
                  />
                </Field>

                <Field label="Country (optional)">
                  <input
                    value={countryInput}
                    onChange={(event) => setCountryInput(event.target.value)}
                    className={inputClassName}
                    placeholder="Kenya"
                    maxLength={80}
                  />
                </Field>

                {saveError ? (
                  <div className="rounded-[14px] border border-[rgba(224,92,92,0.32)] bg-[rgba(224,92,92,0.12)] px-4 py-3 text-sm text-[#ff9a9a]">
                    {saveError}
                  </div>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={savingProfile}
                    onClick={() => void saveProfile()}
                    className="rounded-[14px] border border-[rgba(0,180,166,0.34)] bg-[rgba(0,180,166,0.18)] px-4 py-3 text-sm font-bold text-[var(--wardle-color-mint)] transition hover:border-[rgba(0,180,166,0.5)] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {savingProfile ? 'Saving...' : 'Save profile'}
                  </button>
                  <button
                    type="button"
                    disabled={savingProfile}
                    onClick={cancelEditProfile}
                    className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm font-bold text-white/66 transition hover:border-white/[0.16] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <InfoRow label="Name" value={displayName} />
                <InfoRow label="Email" value={email} />
                <InfoRow
                  label="Profile mode"
                  value={(backendProfile?.individualMode ?? !activeOrganization) ? 'Individual' : 'Organization'}
                />
                <InfoRow
                  label="Current streak"
                  value={currentStreak != null ? String(currentStreak) : '--'}
                />
                <InfoRow label="XP" value={xpTotal != null ? String(xpTotal) : '--'} />
                <InfoRow label="Training level" value={backendProfile?.trainingLevel?.trim() || '--'} />
                <InfoRow label="Country" value={backendProfile?.country?.trim() || '--'} />

                <button
                  type="button"
                  onClick={beginEditProfile}
                  className="w-full rounded-[14px] border border-[rgba(0,180,166,0.3)] bg-[rgba(0,180,166,0.12)] px-4 py-3 text-sm font-bold text-[var(--wardle-color-mint)] transition hover:border-[rgba(0,180,166,0.46)]"
                >
                  Edit profile
                </button>
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard eyebrow="Organization" title="Institution">
            {activeOrganization || organizationName ? (
              <div className="space-y-3">
                <InfoRow label="Active organization" value={activeOrganization?.name ?? organizationName ?? '--'} />
                <InfoRow label="Memberships" value={String(resolvedMemberships.length)} />
              </div>
            ) : (
              <p className="text-sm leading-6 text-white/64">
                You are currently playing as an individual. Organization membership is optional
                and can support future institution features.
              </p>
            )}
            <div className="mt-4 rounded-[16px] border border-white/[0.08] bg-white/[0.04] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/42">
                Rank filters
              </p>
              <p className="mt-1 text-sm text-white/58">
                Organization rank filters are not enabled yet.
              </p>
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard eyebrow="Account" title="Actions">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-[16px] border border-[rgba(224,92,92,0.24)] bg-[rgba(224,92,92,0.1)] px-4 py-3 text-sm font-bold text-[#ffabab] transition hover:border-[rgba(224,92,92,0.36)]"
            >
              Sign out
            </button>
            <button
              type="button"
              onClick={beginEditProfile}
              className="rounded-[16px] border border-[rgba(0,180,166,0.24)] bg-[rgba(0,180,166,0.1)] px-4 py-3 text-sm font-bold text-[var(--wardle-color-mint)] transition hover:border-[rgba(0,180,166,0.4)]"
            >
              Edit profile
            </button>
          </div>
        </SurfaceCard>

        <section className="grid gap-4 lg:grid-cols-2">
          <HelpCard
            eyebrow="How To Play"
            title="Round flow"
            items={[
              'Start with one revealed clinical clue.',
              'Study the case details before choosing a diagnosis.',
              'Submit from the diagnosis suggestion list, not from free text alone.',
              'Each wrong submission unlocks another clue until the case resolves.',
            ]}
          />
          <HelpCard
            eyebrow="Scoring"
            title="What improves your result"
            items={[
              'Fewer clues used means a stronger solve.',
              'Finishing earlier preserves more viability and usually yields better rewards.',
              'Correct outcomes can award XP and streak progress when the backend returns them.',
            ]}
          />
          <HelpCard
            eyebrow="Diagnosis Selection"
            title="Why submit can be blocked"
            items={[
              'Typing alone is not enough when the engine requires a selected registry match.',
              'Changing the guess after selecting a suggestion creates a stale selection.',
              'Pick a fresh suggestion again before submitting.',
            ]}
          />
          <HelpCard
            eyebrow="Rewards"
            title="Streaks and progression"
            items={[
              'Streak display uses your durable user progress.',
              'XP totals and level display when progress data is available.',
              'If the backend does not return a reward for a round, the app shows only the real data it has.',
            ]}
          />
        </section>

        <SurfaceCard eyebrow="App" title="Support">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="App" value="Wardle" />
            <InfoRow label="Support" value="Contact support for account or Clerk verification issues." />
          </div>
        </SurfaceCard>
      </div>
    </main>
  )
}

const inputClassName =
  'w-full rounded-[14px] border border-[rgba(0,180,166,0.24)] bg-[rgba(26,60,94,0.36)] px-4 py-3 text-sm font-semibold text-[var(--wardle-color-mint)] outline-none transition placeholder:text-white/30 focus:border-[rgba(0,180,166,0.62)]'

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
        {label}
      </span>
      {children}
    </label>
  )
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[14px] border px-3 py-2 text-sm font-bold transition ${
        active
          ? 'border-[rgba(0,180,166,0.44)] bg-[rgba(0,180,166,0.16)] text-[var(--wardle-color-mint)]'
          : 'border-white/[0.08] bg-white/[0.04] text-white/56 hover:border-white/[0.16]'
      }`}
    >
      {label}
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.04] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">
        {label}
      </p>
      <p className="mt-1 min-w-0 break-words text-sm font-bold text-[var(--wardle-color-mint)]">
        {value}
      </p>
    </div>
  )
}

function HelpCard({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string
  title: string
  items: string[]
}) {
  return (
    <SurfaceCard eyebrow={eyebrow} title={title}>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-3 rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm leading-6 text-white/72"
          >
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--wardle-color-teal)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </SurfaceCard>
  )
}
