import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

/**
 * Auto-refresh interval (ms) for shared/live screens (KPI dashboards, alerts,
 * dispatch & maintenance queues). Polling pauses while the tab is in the
 * background. Tune in one place.
 */
export const LIVE_REFETCH_MS = 20_000;

const ACCESS_KEY = 'nx-lam.accessToken';
const REFRESH_KEY = 'nx-lam.refreshToken';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Fired when the session can no longer be refreshed — the app navigates to login. */
export const onAuthExpired = new EventTarget();

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStore.refresh;
  if (!refresh) throw new Error('No refresh token');
  const { data } = await axios.post('/api/auth/refresh', { refreshToken: refresh });
  tokenStore.set(data.accessToken, data.refreshToken);
  return data.accessToken as string;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';

    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh');

    if (status === 401 && original && !original._retry && !isAuthCall && tokenStore.refresh) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise ?? refreshAccessToken();
        const newToken = await refreshPromise;
        refreshPromise = null;
        original.headers.set('Authorization', `Bearer ${newToken}`);
        return api(original);
      } catch {
        refreshPromise = null;
        tokenStore.clear();
        onAuthExpired.dispatchEvent(new Event('expired'));
      }
    }
    return Promise.reject(error);
  },
);

export function extractApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
  }
  return 'Unexpected error';
}
