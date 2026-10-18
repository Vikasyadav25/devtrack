import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, type Catalog, catalogItems, itemUrl } from '../lib/api';
import type { Note } from '../../../../packages/shared/src/schemas';
import { Header, State } from '../components/WorkspaceUI';
import { Button } from '../components/ui/button';
import { Prose } from '../components/Reader';
import { useAction, Feedback } from '../components/StudyActions';
export function Notes({ cat }: { cat: Catalog }) {
  const bookmarks = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => api<{ item_type: string; item_id: string }[]>('/bookmarks'),
  });
  const q = useQuery({ queryKey: ['notes'], queryFn: () => api<Note[]>('/notes') }),
    action = useAction();
  const [search, setSearch] = useState(''),
    [editing, setEditing] = useState<Note | null>(null),
    [title, setTitle] = useState(''),
    [body, setBody] = useState(''),
    [tags, setTags] = useState(''),
    [item, setItem] = useState('pattern:arrays-hashing');
  const options = catalogItems(cat);
  const rows = q.data?.filter((x) =>
    `${x.title} ${x.body_md} ${x.tags_json}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <Header
        eyebrow="YOUR PERSONAL KNOWLEDGE BASE"
        title="Keep the ideas that click."
        description="Capture explanations in your own words. Notes support Markdown and tags."
      />
      {!!bookmarks.data?.length && (
        <section className="panel">
          <h2>Bookmarked for later</h2>
          <div className="tag-list">
            {bookmarks.data.map((b) => (
              <Button variant="outline" asChild key={`${b.item_type}${b.item_id}`}>
                <Link to={itemUrl(b.item_type, b.item_id, cat)}>
                  {options.find((x) => x.type === b.item_type && x.id === b.item_id)?.title ??
                    b.item_id}
                </Link>
              </Button>
            ))}
          </div>
        </section>
      )}
      <div className="reader-layout">
        <section className="panel">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search notes"
              placeholder="Search notes or tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {q.error && <p role="alert">{q.error.message}</p>}
          {rows?.map((n) => (
            <article className="note-card" key={n.id}>
              <h2>{n.title}</h2>
              <span className="muted">{JSON.parse(n.tags_json).join(' · ')}</span>
              <Prose>{n.body_md}</Prose>
              <div className="tag-list">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(n);
                    setTitle(n.title);
                    setBody(n.body_md);
                    setTags(JSON.parse(n.tags_json).join(', '));
                    setItem(`${n.item_type}:${n.item_id}`);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  disabled={action.isPending}
                  onClick={() => action.run(`/notes/${n.id}`, {}, 'DELETE')}
                >
                  Delete
                </Button>
              </div>
            </article>
          ))}
          {!rows?.length && <State text="Your own explanations will live here." />}
        </section>
        <section className="panel">
          <h2>{editing ? 'Edit note' : 'Write a note'}</h2>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              const [itemType, itemId] = item.split(':');
              action.run(
                editing ? `/notes/${editing.id}` : '/notes',
                {
                  itemType,
                  itemId,
                  title,
                  body,
                  tags: tags
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean),
                },
                editing ? 'PATCH' : 'POST',
              );
            }}
          >
            <label>
              Related topic
              <select value={item} onChange={(e) => setItem(e.target.value)}>
                {options.map((x) => (
                  <option key={`${x.type}${x.id}`} value={`${x.type}:${x.id}`}>
                    {x.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Your note
              <textarea
                required
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="The way I understand it…"
              />
            </label>
            <label>
              Tags (comma separated)
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="java, concurrency"
              />
            </label>
            <Button disabled={action.isPending}>Save note</Button>
            {editing && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setTitle('');
                  setBody('');
                  setTags('');
                }}
              >
                New note
              </Button>
            )}
            <Feedback action={action} />
          </form>
        </section>
      </div>
    </>
  );
}
