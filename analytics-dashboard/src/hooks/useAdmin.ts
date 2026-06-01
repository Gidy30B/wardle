import { type AdminViewer } from '../api/admin';
import { useConsoleAccess } from './useConsoleAccess';

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
  const access = useConsoleAccess();
  const status: AdminStatus =
    access.status === 'ready' && !access.isAdmin
      ? 'unauthorized'
      : access.status;

  return {
    status,
    isAdmin: status === 'ready',
    role: access.role,
    email: access.email,
    displayName: access.displayName,
    viewer: access.viewer,
    error: access.error,
  };
}
