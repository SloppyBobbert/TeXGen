import { useContext, useMemo } from 'react';
import AuthContext from '../context/AuthContext';
import { createApiClient } from '../api/client';

export function useApiRequest() {
  const auth = useContext(AuthContext);
  const tokens = auth?.authTokens ?? null;
  // Standalone consumers use the same policy, without an authentication provider.
  const fallback = useMemo(() => createApiClient({ getSession: () => ({ tokens }) }), [tokens]);
  return auth?.apiRequest ?? fallback.request;
}
