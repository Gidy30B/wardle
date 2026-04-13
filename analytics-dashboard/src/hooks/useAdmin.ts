import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchAdminViewer, type AdminViewer } from '../api/admin';
import { createApiClient } from '../api/client';

type AdminStatus = 'loading' | 'signed-out' | 'unauthorized' | 'ready' | 'error';

export type AdminState = {
  status: AdminStatus;
  isAdmin: boolean;
  role: string;
  email: string;
  displayName: string;
  viewer: AdminViewer | null;
  error: string | null;
};

export function useAdmin(): AdminState {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [viewer, setViewer] = useState<AdminViewer | null>(null);
  const [status, setStatus] = useState<AdminStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      setViewer(null);
      setStatus('signed-out');
      setError(null);
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
        setStatus(profile.role === 'admin' ? 'ready' : 'unauthorized');
      } catch (fetchError) {
        if (!active) {
          return;
        }

        setViewer(null);
        setStatus('error');
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Failed to verify admin access',
        );
      }
    }

    void loadViewer();

    return () => {
      active = false;
    };
  }, [client, isLoaded, isSignedIn]);

  const email =
    user?.primaryEmailAddress?.emailAddress ?? viewer?.email ?? 'unknown@example.com';
  const displayName = user?.fullName ?? user?.username ?? email;

  return {
    status,
    isAdmin: status === 'ready',
    role: viewer?.role ?? 'user',
    email,
    displayName,
    viewer,
    error,
  };
}
