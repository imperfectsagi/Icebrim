import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hasLiveApi } from '@/lib/api-client';
import type { CompanySettings } from '@/types/cms';
import { companySettings as seedSettings } from '@/data/company';

let localSettings = { ...seedSettings };

export function useAdminCompanySettings() {
  return useQuery<CompanySettings>({
    queryKey: ['admin', 'company'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/content/company') : Promise.resolve(localSettings)),
  });
}

export function useUpdateCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CompanySettings) =>
      hasLiveApi
        ? api.put<CompanySettings>('/api/admin/content/company', input)
        : Promise.resolve((localSettings = { ...input })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'company'] });
      qc.invalidateQueries({ queryKey: ['content', 'company'] });
    },
  });
}
