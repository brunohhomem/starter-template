import { useQuery } from '@tanstack/react-query';
import type { AuthResponse } from '@starter/shared';
import { api } from '@/lib/api';

export const ME_QUERY_KEY = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      const response = await api.get<AuthResponse>('/auth/me');
      return response.data;
    },
  });
}
