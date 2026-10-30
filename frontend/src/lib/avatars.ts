import { useQuery } from '@tanstack/react-query'
import { api, getToken } from './api'

/** Who has a profile photo (user id -> version): one shared request for every avatar on screen. */
export function useAvatarVersions() {
  return useQuery({
    queryKey: ['avatars'],
    queryFn: () => api.get<Record<string, number>>('/api/users/avatars'),
    staleTime: 5 * 60_000,
    enabled: !!getToken(),
  })
}
