import { useQuery } from '@tanstack/react-query';
import type { PublicSettingsResponse } from '@starter/shared';
import { api } from '@/lib/api';

export const PUBLIC_SETTINGS_QUERY_KEY = ['settings', 'public'] as const;

export function usePublicSettings() {
  return useQuery({
    queryKey: PUBLIC_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const response = await api.get<PublicSettingsResponse>('/settings/public');
      return response.data;
    },
  });
}
