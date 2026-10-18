import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { type Catalog, itemUrl, useDashboard } from '../lib/api';
import { Header, State } from '../components/WorkspaceUI';
import { Button } from '../components/ui/button';
import { useAction, Feedback } from '../components/StudyActions';
import { labels } from './CatalogPages';
export function Revision({ cat }: { cat: Catalog }) {
  const q = useDashboard(),
    action = useAction();
  const [domain, setDomain] = useState('all'),
    [difficulty, setDifficulty] = useState('all'),
    [confidence, setConfidence] = useState('all'),
    [time, setTime] = useState(60);
  if (!q.data) return <State text={q.error?.message ?? 'Loading your revision queue…'} />;
  const d = q.data;
  const rows = d.reviews.filter(
    (r) =>
      (domain === 'all' || r.domain === domain) &&
      (difficulty === 'all' ||
        cat.problems.find((p) => p.id === r.item_id)?.difficulty === difficulty) &&
      (confidence === 'all' ||
        d.progress.find((p) => p.item_id === r.item_id)?.confidence === Number(confidence)) &&
      r.estimatedMinutes <= time,
  );
  return (
    <>
      <Header
        eyebrow="RETRIEVAL BUILDS MASTERY"
        title="A little recall goes a long way."
        description="Try to recover the reasoning before opening the lesson. Overdue work stays here until reviewed."
      />
      <div className="filters">
        <select
          aria-label="Revision domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        >
          <option value="all">All domains</option>
          {Object.keys(labels).map((x) => (
            <option key={x} value={x}>
              {labels[x]}
            </option>
          ))}
        </select>
        <select
          aria-label="Revision difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="all">All difficulties</option>
          {['Easy', 'Medium', 'Hard'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Revision confidence"
          value={confidence}
          onChange={(e) => setConfidence(e.target.value)}
        >
          <option value="all">All confidence</option>
          {[1, 2, 3, 4, 5].map((x) => (
            <option key={x} value={x}>
              Confidence {x}
            </option>
          ))}
        </select>
        <select
          aria-label="Maximum review time"
          value={time}
          onChange={(e) => setTime(Number(e.target.value))}
        >
          <option value={15}>Up to 15 min</option>
          <option value={30}>Up to 30 min</option>
          <option value={60}>Up to 60 min</option>
        </select>
      </div>
      <Feedback action={action} />
      {rows.map((r) => (
        <section className="panel revision-card" key={`${r.item_type}${r.item_id}`}>
          <div>
            <span className={`badge ${r.due_at < d.today ? 'overdue' : ''}`}>
              {r.due_at < d.today ? 'Overdue' : 'Due today'} · {r.due_at}
            </span>
            <h2>
              <Link to={itemUrl(r.item_type, r.item_id, cat)}>{r.title}</Link>
            </h2>
            <p className="muted">
              {r.estimatedMinutes} min · {r.lapse_count} lapses · last interval {r.interval_days}{' '}
              days
            </p>
          </div>
          <div className="rating-buttons">
            {['Again', 'Hard', 'Good', 'Easy'].map((rating) => (
              <Button
                variant={rating === 'Good' ? 'default' : 'outline'}
                key={rating}
                disabled={action.isPending}
                onClick={() =>
                  action.run(`/revision/${r.item_type}/${r.item_id}/review`, {
                    rating,
                    eventId: crypto.randomUUID(),
                  })
                }
              >
                {rating}
              </Button>
            ))}
          </div>
        </section>
      ))}
      {!rows.length && (
        <State text="Your queue is clear for this filter. Learn something new, or take a well-earned break." />
      )}
      {d.recommendations.length > 0 && (
        <section className="panel">
          <h2>Rebuild a foundation</h2>
          {d.recommendations.map((r) => (
            <div key={r.item.item_id}>
              <h3>{r.item.title}</h3>
              {r.prerequisites.map((x) => (
                <Link className="list-row" key={x} to={`/dsa/${x}`}>
                  Review prerequisite: {x}
                </Link>
              ))}
              {r.practice.map((x) => (
                <Link className="list-row" key={x.id} to={`/problems/${x.slug}`}>
                  {x.title}
                  <ArrowUpRight size={14} />
                </Link>
              ))}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
