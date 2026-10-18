import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from './ui/button';
function Bookmark({ type, id }: { type: string; id: string }) {
  const q = useQuery({
      queryKey: ['bookmarks'],
      queryFn: () => api<{ item_type: string; item_id: string }[]>('/bookmarks'),
    }),
    action = useAction();
  const marked = q.data?.some((x) => x.item_type === type && x.item_id === id);
  return (
    <>
      <Button
        variant="outline"
        disabled={q.isPending || action.isPending}
        onClick={() => action.run(`/bookmarks/${type}/${id}`, {}, marked ? 'DELETE' : 'PUT')}
      >
        {marked ? 'Remove bookmark' : 'Bookmark topic'}
      </Button>
      {action.error && <p role="alert">{action.error.message}</p>}
    </>
  );
}
export function useAction() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ path, body, method }: { path: string; body?: unknown; method?: string }) =>
      api(path, body, method),
    onSuccess: () =>
      client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'catalog' }),
  });
  return {
    ...mutation,
    run: (path: string, body?: unknown, method?: string) => mutation.mutate({ path, body, method }),
  };
}

export function Feedback({ action }: { action: ReturnType<typeof useAction> }) {
  return action.error ? (
    <p className="form-error" role="alert">
      {action.error.message}
    </p>
  ) : action.isSuccess ? (
    <p className="form-success" role="status">
      <Check size={15} />
      Saved to your workspace.
    </p>
  ) : null;
}

export function Complete({
  type,
  id,
  minutes = 20,
}: {
  type: string;
  id: string;
  minutes?: number;
}) {
  const action = useAction();
  const [confidence, setConfidence] = useState(3);
  return (
    <section className="completion-panel">
      <div>
        <span className="eyebrow">MAKE IT STICK</span>
        <h2>Ready to recall this tomorrow?</h2>
        <p>Learning completion schedules a review. Mastery requires successful recall later.</p>
      </div>
      <label>
        Confidence
        <select value={confidence} onChange={(e) => setConfidence(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((x) => (
            <option key={x} value={x}>
              {x} / 5
            </option>
          ))}
        </select>
      </label>
      <Button
        disabled={action.isPending || action.isSuccess}
        onClick={() =>
          action.run(`/progress/${type}/${id}`, { status: 'completed', confidence, minutes }, 'PUT')
        }
      >
        <Check size={16} />
        Mark learned · {minutes} min
      </Button>
      <Bookmark type={type} id={id} />
      <Feedback action={action} />
    </section>
  );
}
