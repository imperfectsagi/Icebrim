import { useState } from 'react';
import { Mail, MailOpen, Trash2 } from 'lucide-react';
import { AdminPageHeader } from '../components/AdminUi';
import { useAdminMessages, useMarkMessageRead, useDeleteMessage } from '../hooks/useAdminMessages';
import { formatDate, cn } from '@/lib/utils';
import type { ContactMessage } from '@/types/cms';

export function AdminMessagesPage() {
  const { data: messages, isLoading } = useAdminMessages();
  const markRead = useMarkMessageRead();
  const deleteMessage = useDeleteMessage();
  const [selected, setSelected] = useState<ContactMessage | null>(null);

  return (
    <div>
      <AdminPageHeader title="Contact Messages" description="Messages submitted through your contact form." />

      {isLoading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
      ) : (messages ?? []).length === 0 ? (
        <div className="bg-white rounded-[var(--radius-card)] border border-[var(--color-line)] p-10 text-center text-sm text-[var(--color-ink-soft)]">
          No messages yet.
        </div>
      ) : (
        <div className="grid md:grid-cols-5 gap-6">
          <div className="md:col-span-2 bg-white rounded-[var(--radius-card)] border border-[var(--color-line)] divide-y divide-[var(--color-line)] overflow-hidden">
            {(messages ?? []).map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setSelected(m);
                  if (!m.read) markRead.mutate({ id: m.id, read: true });
                }}
                className={cn(
                  'w-full text-left px-4 py-3 hover:bg-[var(--color-surface)]',
                  selected?.id === m.id && 'bg-[var(--color-coral-tint)]',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {m.read ? (
                    <MailOpen size={13} className="text-[var(--color-ink-soft)]" />
                  ) : (
                    <Mail size={13} className="text-[var(--color-coral-deep)]" />
                  )}
                  <span className={cn('text-sm', !m.read && 'font-semibold')}>{m.name}</span>
                </div>
                <p className="text-xs text-[var(--color-ink-soft)] truncate">{m.subject}</p>
              </button>
            ))}
          </div>

          <div className="md:col-span-3 bg-white rounded-[var(--radius-card)] border border-[var(--color-line)] p-6">
            {selected ? (
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-semibold">{selected.subject}</h2>
                    <p className="text-sm text-[var(--color-ink-soft)]">
                      {selected.name} · {selected.email} · {formatDate(selected.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      deleteMessage.mutate(selected.id);
                      setSelected(null);
                    }}
                    aria-label="Delete message"
                    className="p-2 rounded-lg hover:bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <p className="text-sm whitespace-pre-wrap">{selected.message}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-ink-soft)]">Select a message to read it.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
