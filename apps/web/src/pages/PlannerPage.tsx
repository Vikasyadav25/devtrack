import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { type Catalog, itemUrl, useDashboard } from '../lib/api';
import { Header, State } from '../components/WorkspaceUI';
import { Button } from '../components/ui/button';
import { labels } from './CatalogPages';
export function Planner({ cat }: { cat: Catalog }) {
  const q = useDashboard();
  if (!q.data) return <State text={q.error?.message ?? 'Planning your next session…'} />;
  const d = q.data;
  return (
    <>
      <Header
        eyebrow="PROTECT YOUR FOCUS"
        title="Make room for progress."
        description="Due reviews come first, followed by new lessons whose prerequisites are complete."
        action={
          <Button asChild variant="outline">
            <Link to="/settings">Edit study goals</Link>
          </Button>
        }
      />
      <div className="planner-budget">
        <strong>
          {Math.max(0, d.budget - d.spent)}
          <span>minutes remaining today</span>
        </strong>
        <p>
          {d.plan.minutes} minutes planned · {d.plan.overflow} items outside today’s budget
        </p>
      </div>
      <section className="panel">
        <h2>Today’s plan</h2>
        {d.plan.items.map((x, i) => (
          <Link
            className="list-row"
            key={`${x.item_type}${x.item_id}`}
            to={itemUrl(x.item_type, x.item_id, cat)}
          >
            <span className="step-number">{i + 1}</span>
            <strong>{x.title}</strong>
            <span>{x.estimatedMinutes} min</span>
            <ArrowUpRight size={16} />
          </Link>
        ))}
        {!d.plan.items.length && (
          <State text="Nothing scheduled. Your study budget may be complete or today may be a rest day." />
        )}
      </section>
      <section className="panel">
        <h2>Choose your next session</h2>
        <p className="muted">
          Manual override: open any published lesson from the library. Its study time is recorded
          only when you mark it learned.
        </p>
        <div className="tag-list">
          {Object.entries(labels).map(([key, label]) => (
            <Button variant="outline" asChild key={key}>
              <Link to={`/${key}`}>
                {label}
                <ArrowUpRight size={14} />
              </Link>
            </Button>
          ))}
        </div>
      </section>
    </>
  );
}
