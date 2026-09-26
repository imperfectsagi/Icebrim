import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hasLiveApi } from '@/lib/api-client';
import type { PopupOfferAdminContent, PopupOfferEmailEntry } from '@/types/cms';

const seed: PopupOfferAdminContent = { enabled: false, heading: '', subheading: '', couponId: null };
let localPopupOffer = { ...seed };

/** Admin-side read of the popup's own settings (heading/subheading/enabled/linked coupon id). See AdminPopupPage.tsx. */
export function useAdminPopupOffer() {
  return useQuery<PopupOfferAdminContent>({
    queryKey: ['admin', 'popup-offer'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/content/popup-offer') : Promise.resolve(localPopupOffer)),
  });
}

export function useUpdatePopupOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PopupOfferAdminContent) =>
      hasLiveApi
        ? api.put<PopupOfferAdminContent>('/api/admin/content/popup-offer', input)
        : Promise.resolve((localPopupOffer = input)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'popup-offer'] });
      // The public popup reads a different, resolved shape (with the
      // coupon looked up server-side) from a different endpoint -- see
      // usePopupOffer in hooks/useContent.ts -- so this can't just
      // setQueryData the mutation result the way AdminPromoBannerPage
      // does; invalidate it instead so the next read re-resolves the
      // coupon from whatever was just saved.
      qc.invalidateQueries({ queryKey: ['settings', 'popup-offer'] });
    },
  });
}

/** Admin-side read of every email the popup has captured (requirement #2: email, submission time, coupon shown). See AdminPopupEmailsPage.tsx. */
export function useAdminPopupEmails() {
  return useQuery<PopupOfferEmailEntry[]>({
    queryKey: ['admin', 'popup-offer', 'emails'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/content/popup-offer/emails') : Promise.resolve([])),
  });
}
