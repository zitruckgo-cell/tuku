import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

interface RouterState {
  path: string;
  params: Record<string, string>;
}

interface RouterContextValue extends RouterState {
  navigate: (path: string, params?: Record<string, string>) => void;
}

const RouterContext = createContext<RouterContextValue>({
  path: '/',
  params: {},
  navigate: () => {},
});

function parseHash(): RouterState {
  const hash = window.location.hash.slice(1) || '/';
  const [path, queryStr] = hash.split('?');
  const params: Record<string, string> = {};
  if (queryStr) {
    queryStr.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    });
  }
  return { path: path || '/', params };
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [routerState, setRouterState] = useState<RouterState>(parseHash);

  useEffect(() => {
    const handler = () => setRouterState(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((path: string, params: Record<string, string> = {}) => {
    const query = Object.keys(params).length
      ? '?' + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
      : '';
    window.location.hash = path + query;
  }, []);

  const value = useMemo<RouterContextValue>(() => ({
    ...routerState, navigate,
  }), [routerState, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  return useContext(RouterContext);
}
