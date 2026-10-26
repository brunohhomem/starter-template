import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { queryClient } from './query-client';

type RetryConfig = InternalAxiosRequestConfig & {
  alreadyRetried?: boolean;
};

const SKIP_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/password/forgot',
  '/auth/password/reset',
  '/auth/email/confirm',
  '/auth/invitations/accept',
];

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

let refreshInFlight: Promise<void> | null = null;

function shouldSkipRefresh(url: string | undefined): boolean {
  if (!url) return false;
  return SKIP_REFRESH.some((path) => url.includes(path));
}

function sendToLogin(): void {
  queryClient.clear();
  if (window.location.pathname === '/login') return;
  const loginUrl = new URL('/login', window.location.origin);
  window.location.assign(loginUrl.href);
}

async function refreshSession(): Promise<void> {
  await api.post('/auth/refresh');
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    const status = error.response?.status;

    if (status !== 401 || !config || config.alreadyRetried || shouldSkipRefresh(config.url)) {
      throw error;
    }

    config.alreadyRetried = true;

    if (!refreshInFlight) {
      refreshInFlight = refreshSession()
        .catch((refreshError: unknown) => {
          sendToLogin();
          throw refreshError;
        })
        .finally(() => {
          refreshInFlight = null;
        });
    }

    await refreshInFlight;
    return api(config);
  },
);
