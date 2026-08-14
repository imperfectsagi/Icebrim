import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { AdminPageHeader, AdminCard } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { api, hasLiveApi } from '@/lib/api-client';

interface Category {
  id: string;
  name: string;
  slug: string;
}

let localCategories: Category[] = [
  { id: 'cat_1', name: 'Cooling Caps', slug: 'cooling-caps' },
];

function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['admin', 'categories'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/categories') : Promise.resolve(localCategories)),
  });
}

function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => {
      const slug = name.toLowerCase().replace(/\s+/g, '-');
      if (hasLiveApi) return api.post<Category>('/api/admin/categories', { name, slug });
      const created = { id: `cat_${crypto.randomUUID()}`, name, slug };
      localCategories = [...localCategories, created];
      return Promise.resolve(created);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'categories'] }),
  });
}

function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      hasLiveApi
        ? api.delete(`/api/admin/categories/${id}`)
        : Promise.resolve((localCategories = localCategories.filter((c) => c.id !== id))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'categories'] }),
  });
}

export function AdminCategoriesPage() {
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const [newName, setNewName] = useState('');

  return (
    <div>
      <AdminPageHeader title="Categories" description="Organize your products into categories." />

      <AdminCard className="max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) {
              createCategory.mutate(newName.trim());
              setNewName('');
            }
          }}
          className="flex gap-2 mb-6"
        >
          <input
            className="form-input"
            placeholder="New category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="submit" size="sm">
            <Plus size={15} /> Add
          </Button>
          <style>{`.form-input {
            flex: 1;
            border-radius: 0.75rem;
            border: 1px solid var(--color-line);
            padding: 0.6rem 0.85rem;
            font-size: 0.9rem;
          }`}</style>
        </form>

        {isLoading ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {(categories ?? []).map((cat) => (
              <li key={cat.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm">{cat.name}</span>
                <button
                  onClick={() => deleteCategory.mutate(cat.id)}
                  aria-label={`Delete ${cat.name}`}
                  className="p-1.5 rounded-lg hover:bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
