import { useDashboard } from '../lib/api';
import { useCatalog } from '../lib/api';
import { Header, State, WeeklyChart } from '../components/WorkspaceUI';
import { labels } from './CatalogPages';
export function Analytics() {
  const q = useDashboard(),
    cat = useCatalog();
  if (!q.data) return <State text={q.error?.message ?? 'Loading study insights…'} />;
  const d = q.data;
  return (
    <>
      <Header
        eyebrow="NOTICE WHAT’S WORKING"
        title="Progress, with perspective."
        description="Learning completion and retrieval mastery are separate signals. Every honest attempt counts."
      />
      <div className="stat-grid">
        {[
          { label: 'Total attempts', value: d.attempted },
          { label: 'Problems solved independently', value: d.independentlySolved },
          { label: 'Mastered items', value: d.mastered },
          { label: 'Items needing confidence', value: d.weak.length },
        ].map((x) => (
          <section className="stat-card" key={x.label}>
            <p>{x.label}</p>
            <strong>{x.value}</strong>
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>Focused minutes · last 7 days</h2>
        <WeeklyChart days={d.weekly} />
      </section>
      <section className="panel">
        <h2>Learning & recall coverage</h2>
        {Object.entries(labels).map(([key, label]) => {
          const rows = d.progress.filter((p) =>
            key === 'dsa'
              ? p.item_type === 'pattern' || p.item_type === 'problem'
              : p.item_type === 'lesson'
                ? cat.data?.lessons.some((x) => x.slug === p.item_id && x.domain === key)
                : p.item_type === 'case' &&
                  cat.data?.cases.some((x) => x.slug === p.item_id && x.kind.toLowerCase() === key),
          );
          return (
            <div className="list-row" key={key}>
              <strong>{label}</strong>
              <span>
                {`${rows.length} started · ${rows.filter((x) => x.status === 'completed').length} learned · ${rows.filter((x) => x.status === 'mastered').length} mastered`}
              </span>
            </div>
          );
        })}
        <p className="muted">
          Independent solves count distinct problems. A repeated attempt never inflates problem
          coverage.
        </p>
      </section>
    </>
  );
}
