import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchAdminViewer, type AdminViewer } from '../api/admin';
import { createApiClient } from '../api/client';

export const USER_ROLES = {
  USER: 'user',
  EDITOR: 'editor',
  SENIOR_EDITOR: 'senior_editor',
  ADMIN: 'admin',
} as const;

export type ConsoleAccessStatus =
  | 'loading'
  | 'signed-out'
  | 'unauthorized'
  | 'ready'
  | 'error';

export type ConsoleAccessState = {
  status: ConsoleAccessStatus;
  role: string;
  isAdmin: boolean;
  canAccessEditorial: boolean;
  canPublishEditorial: boolean;
  canAccessAdminOps: boolean;
  email: string;
  displayName: string;
  viewer: AdminViewer | null;
  error: string | null;
};

export function isAdminRole(role: string | null | undefined) {
  return role === USER_ROLES.ADMIN;
}

export function canAccessEditorialRole(role: string | null | undefined) {
  return (
    role === USER_ROLES.EDITOR ||
    role === USER_ROLES.SENIOR_EDITOR ||
    isAdminRole(role)
  );
}

export function canPublishEditorialRole(role: string | null | undefined) {
  return role === USER_ROLES.SENIOR_EDITOR || isAdminRole(role);
}

export function canAccessAdminOpsRole(role: string | null | undefined) {
  return isAdminRole(role);
}

export function useConsoleAccess(): ConsoleAccessState {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [viewer, setViewer] = useState<AdminViewer | null>(null);
  const [status, setStatus] = useState<ConsoleAccessStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    let active = true;

    async function loadViewer() {
      try {
        setStatus('loading');
        setError(null);
        const profile = await fetchAdminViewer(client);
        if (!active) {
          return;
        }

        setViewer(profile);
        setStatus(canAccessEditorialRole(profile.role) ? 'ready' : 'unauthorized');
      } catch (fetchError) {
        if (!active) {
          return;
        }

        setViewer(null);
        setStatus('error');
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Failed to verify console access',
        );
      }
    }

    void loadViewer();

    return () => {
      active = false;
    };
  }, [client, isLoaded, isSignedIn]);

  const effectiveViewer = isSignedIn ? viewer : null;
  const effectiveStatus: ConsoleAccessStatus = !isLoaded
    ? 'loading'
    : !isSignedIn
      ? 'signed-out'
      : status;
  const role = effectiveViewer?.role ?? USER_ROLES.USER;
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    effectiveViewer?.email ??
    'unknown@example.com';
  const displayName = user?.fullName ?? user?.username ?? email;

  return {
    status: effectiveStatus,
    role,
    isAdmin: isAdminRole(role),
    canAccessEditorial: canAccessEditorialRole(role),
    canPublishEditorial: canPublishEditorialRole(role),
    canAccessAdminOps: canAccessAdminOpsRole(role),
    email,
    displayName,
    viewer: effectiveViewer,
    error: effectiveStatus === 'signed-out' ? null : error,
  };
}
