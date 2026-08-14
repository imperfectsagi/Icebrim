import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hasLiveApi } from '@/lib/api-client';
import type { ContactMessage } from '@/types/cms';

const seedMessages: ContactMessage[] = [
  {
    id: 'msg_1',
    name: 'Jenny Oswald',
    email: 'jenny@example.com',
    subject: 'Bulk order enquiry',
    message: 'Hi, do you offer discounts for orders of 20+ units for a wellness retreat?',
    read: false,
    createdAt: '2026-07-30',
  },
];

let localMessages = [...seedMessages];

export function useAdminMessages() {
  return useQuery<ContactMessage[]>({
    queryKey: ['admin', 'messages'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/messages') : Promise.resolve(localMessages)),
  });
}

export function useMarkMessageRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      hasLiveApi
        ? api.patch(`/api/admin/messages/${id}`, { read })
        : Promise.resolve((localMessages = localMessages.map((m) => (m.id === id ? { ...m, read } : m)))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'messages'] }),
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      hasLiveApi
        ? api.delete(`/api/admin/messages/${id}`)
        : Promise.resolve((localMessages = localMessages.filter((m) => m.id !== id))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'messages'] }),
  });
}
