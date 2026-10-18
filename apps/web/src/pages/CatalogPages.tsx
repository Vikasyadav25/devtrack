import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BookOpen, Clock, Search } from 'lucide-react';
import { api, type Catalog, itemUrl } from '../lib/api';
import type { Progress } from '../../../../packages/shared/src/schemas';
import type { Pattern } from '../../../../packages/shared/src/content';
import { Header, State } from '../components/WorkspaceUI';
import roadmap from '../../../../content/roadmap.json';
export const labels: Record<string, string> = {
  dsa: 'DSA & patterns',
  java: 'Core Java',
  backend: 'Backend engineering',
  cs: 'CS fundamentals',
  lld: 'Low-level design',
  hld: 'System design',
};
export function Library({ cat, domain }: { cat: Catalog; domain: string }) {
  const [params, setParams] = useSearchParams(),
    [level, setLevel] = useState('all'),
    [status, setStatus] = useState('all');
  const search = params.get('q') ?? '';
  const progress = useQuery({
    queryKey: ['progress'],
    queryFn: () => api<Progress[]>('/progress'),
  });
  const items =
    domain === 'dsa'
      ? cat.patterns.map((x) => ({
          id: x.id,
          slug: x.slug,
          title: x.title,
          level: x.level,
          description: x.coreIdea,
          time: x.estimatedMinutes,
          type: 'pattern',
          status: x.status,
        }))
      : cat.lessons
          .filter((x) => x.domain === domain)
          .map((x) => ({
            id: x.slug,
            slug: x.slug,
            title: x.title,
            level: x.level,
            description: x.mentalModel,
            time: x.readingMinutes,
            type: 'lesson',
            status: x.status,
          }))
          .concat(
            cat.cases
              .filter((x) => x.kind.toLowerCase() === domain)
              .map((x) => ({
                id: x.slug,
                slug: x.slug,
                title: x.title,
                level: x.level,
                description: x.prompt,
                time: 45,
                type: 'case',
                status: x.status,
              })),
          );
  const filtered = items.filter(
    (x) =>
      x.title.toLowerCase().includes(search.toLowerCase()) &&
      (level === 'all' || x.level === level) &&
      (status === 'all' || progress.data?.some((p) => p.item_id === x.id && p.status === status)),
  );
  const problems =
    domain === 'dsa' && search
      ? cat.problems.filter((x) => x.title.toLowerCase().includes(search.toLowerCase()))
      : [];
  return (
    <>
      <Header
        eyebrow="YOUR ENGINEERING TOOLKIT"
        title={labels[domain]}
        description="Understand the idea. Build it yourself. Recall it when it matters."
      />
      <div className="filters">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search topics"
            value={search}
            placeholder="Search topics and problems…"
            onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {})}
          />
        </label>
        <select
          aria-label="Filter by level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="all">All levels</option>
          {['beginner', 'intermediate', 'advanced'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Filter by progress"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All progress</option>
          <option value="completed">Learned</option>
          <option value="mastered">Mastered</option>
        </select>
        <span className="muted">{filtered.length} topics</span>
      </div>
      <div className="library-grid">
        {filtered.map((x) => (
          <Link to={itemUrl(x.type, x.id, cat)} key={x.id} className="lesson-card">
            <div>
              <span className={`badge ${x.level}`}>{x.level}</span>
              <ArrowUpRight size={18} />
            </div>
            <h2>{x.title}</h2>
            <p>
              {x.description.slice(0, 170)}
              {x.description.length > 170 ? '…' : ''}
            </p>
            <footer>
              <span>
                <Clock size={14} />
                {x.time} min
              </span>
              <span>
                {x.status === 'draft'
                  ? 'Draft'
                  : (progress.data?.find((p) => p.item_id === x.id)?.status ?? 'Ready to learn')}
              </span>
            </footer>
          </Link>
        ))}
      </div>
      {!filtered.length && (
        <State text="No published topics match this filter. More curriculum is planned; incomplete lessons are kept as drafts." />
      )}
      {problems.length > 0 && (
        <section className="panel">
          <h2>Matching problems</h2>
          {problems.map((p) => (
            <Link className="list-row" key={p.id} to={`/problems/${p.slug}`}>
              <span>{p.title}</span>
              <span className="badge">{p.difficulty}</span>
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </section>
      )}
    </>
  );
}

export function Roadmap({ cat }: { cat: Catalog }) {
  const q = useQuery({
    queryKey: ['roadmap'],
    queryFn: () => api<(Pattern & { unlocked: boolean })[]>('/roadmap'),
  });
  return (
    <>
      <Header
        eyebrow="A CLEAR PATH FORWARD"
        title="Your learning roadmap"
        description="Build foundations first. Revisit them often. Progress comes from understanding."
      />
      {['beginner', 'intermediate', 'advanced'].map((level, i) => (
        <section className="panel roadmap-section" key={level}>
          <h2>
            <span className="step-number">0{i + 1}</span>
            {level[0].toUpperCase() + level.slice(1)}
          </h2>
          <div className="roadmap-list">
            {cat.patterns
              .filter((p) => p.level === level)
              .map((p) => (
                <Link key={p.id} to={`/dsa/${p.slug}`} className="roadmap-row">
                  <BookOpen size={18} />
                  <strong>{p.title}</strong>
                  <span className="badge">
                    {q.data?.find((x) => x.id === p.id)?.unlocked
                      ? 'Unlocked'
                      : 'Recommended prerequisites first'}
                  </span>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
          </div>
          <details>
            <summary>Full syllabus · planned content</summary>
            <p className="muted">
              These entries describe planned coverage. The published study modules are linked above.
            </p>
            <ul className="draft-list">
              {roadmap
                .filter((x) => x.level === level)
                .map((x) => (
                  <li key={x.slug}>
                    {x.title}
                    <span className="badge">draft syllabus</span>
                  </li>
                ))}
            </ul>
          </details>
        </section>
      ))}
    </>
  );
}
