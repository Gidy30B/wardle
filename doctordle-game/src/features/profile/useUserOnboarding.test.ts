/// <reference types="node" />

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getOnboardingDecision,
  requiresUserOnboarding,
} from './useUserOnboarding.decision.ts'

describe('useUserOnboarding decision state', () => {
  it('shows profile onboarding only after a successful profile-required response', () => {
    assert.deepEqual(
      getOnboardingDecision({
        authLoaded: true,
        signedIn: true,
        userId: 'user_123',
        queryPending: false,
        querySuccess: true,
        queryError: null,
        onboarding: { onboardingStatus: 'PROFILE_REQUIRED' },
      }),
      { loading: false, hasError: false, shouldShowOnboarding: true },
    )
  })

  it('shows organization onboarding only after a successful organization-required response', () => {
    assert.deepEqual(
      getOnboardingDecision({
        authLoaded: true,
        signedIn: true,
        userId: 'user_123',
        queryPending: false,
        querySuccess: true,
        queryError: null,
        onboarding: { onboardingStatus: 'ORGANIZATION_REQUIRED' },
      }),
      { loading: false, hasError: false, shouldShowOnboarding: true },
    )
  })

  it('does not show onboarding when the server reports completion', () => {
    assert.deepEqual(
      getOnboardingDecision({
        authLoaded: true,
        signedIn: true,
        userId: 'user_123',
        queryPending: false,
        querySuccess: true,
        queryError: null,
        onboarding: { onboardingStatus: 'COMPLETE' },
      }),
      { loading: false, hasError: false, shouldShowOnboarding: false },
    )
  })

  it('does not show profile onboarding when onboarding query fails', () => {
    assert.deepEqual(
      getOnboardingDecision({
        authLoaded: true,
        signedIn: true,
        userId: 'user_123',
        queryPending: false,
        querySuccess: false,
        queryError: new Error('Unauthorized'),
        onboarding: null,
      }),
      { loading: false, hasError: true, shouldShowOnboarding: false },
    )
  })

  it('does not infer onboarding from a missing or undefined response', () => {
    assert.deepEqual(
      getOnboardingDecision({
        authLoaded: true,
        signedIn: true,
        userId: 'user_123',
        queryPending: false,
        querySuccess: true,
        queryError: null,
        onboarding: null,
      }),
      { loading: false, hasError: true, shouldShowOnboarding: false },
    )
  })

  it('keeps loading while auth or user identity is not ready', () => {
    assert.equal(
      getOnboardingDecision({
        authLoaded: false,
        signedIn: false,
        userId: null,
        queryPending: false,
        querySuccess: false,
        queryError: null,
        onboarding: null,
      }).loading,
      true,
    )
    assert.equal(
      getOnboardingDecision({
        authLoaded: true,
        signedIn: true,
        userId: null,
        queryPending: false,
        querySuccess: false,
        queryError: null,
        onboarding: null,
      }).loading,
      true,
    )
  })
})

describe('requiresUserOnboarding', () => {
  it('allows only canonical required onboarding statuses', () => {
    assert.equal(requiresUserOnboarding('PROFILE_REQUIRED'), true)
    assert.equal(requiresUserOnboarding('ORGANIZATION_REQUIRED'), true)
    assert.equal(requiresUserOnboarding('COMPLETE'), false)
    assert.equal(requiresUserOnboarding(null), false)
    assert.equal(requiresUserOnboarding(undefined), false)
  })
})
