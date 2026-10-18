import { useSearchParams, Link } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { ArrowUpRight, BookOpen, ExternalLink, Search } from 'lucide-react';
import { Header, State } from '../components/WorkspaceUI';
import type { PrepCatalog, PrepResource, PrepTrack } from '../../../../packages/shared/src/prep';
import catalogData from '../../../../content/prep-hub.json';
import './prep-hub.css';

const catalog = catalogData as PrepCatalog;
const tracks: { id: PrepTrack; label: string; description: string }[] = [
  {
    id: 'dsa',
    label: 'DSA',
    description: 'Programming foundations, algorithms and interview sheets.',
  },
  {
    id: 'core-cs',
    label: 'Core CS',
    description: 'Databases, operating systems and computer networks.',
  },
  {
    id: 'system-design',
    label: 'System Design',
    description: 'Object-oriented programming, design patterns and LLD.',
  },
  {
    id: 'data-engineering',
    label: 'Data Engineering',
    description: 'SQL fundamentals, production databases and interview practice.',
  },
];
function Module({
  title,
  count,
  expanded,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(expanded);
  return (
    <details
      className="prep-module"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>{title}</span>
        <small>{count} entries</small>
      </summary>
      {open && <ul>{children}</ul>}
    </details>
  );
}
function ResourceLink({ resource }: { resource: PrepResource }) {
  return (
    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="prep-resource">
      <span>{resource.label}</span>
      <small>
        {resource.access === 'premium'
          ? 'Premium'
          : resource.access === 'account'
            ? 'Account may be needed'
            : resource.access === 'unknown'
              ? 'Access varies'
              : 'Free reading / resource'}
        {resource.verification === 'unchecked' ? ' · Link not checked' : ''}
      </small>
      <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

export default function PrepHub() {
  const [params, setParams] = useSearchParams();
  const track = tracks.find((x) => x.id === params.get('track')) ?? tracks[0];
  const search = params.get('q') ?? '';
  const courseSlug = params.get('course') ?? '';
  const practiceOnly = params.get('practice') === 'true';
  const freeOnly = params.get('free') === 'true';
  const query = search.trim().toLowerCase();
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'track') next.delete('course');
    setParams(next, { replace: key === 'q' });
  };
  const trackCourses = catalog.courses.filter((c) => c.track === track.id);
  const courses = trackCourses
    .filter((c) => !courseSlug || c.slug === courseSlug)
    .map((course) => ({
      ...course,
      modules: course.modules
        .map((module) => ({
          ...module,
          topicIds: module.topicIds.filter((id) => {
            const topic = catalog.topics[id];
            const resources = topic.resourceIds.map((r) => catalog.resources[r]);
            return (
              (!query ||
                `${course.title} ${module.title} ${topic.title}`.toLowerCase().includes(query)) &&
              (!practiceOnly ||
                resources.some((r) => r.kind === 'practice' || r.kind === 'exercise')) &&
              (!freeOnly ||
                resources.some(
                  (r) =>
                    r.access === 'free' &&
                    (!practiceOnly || r.kind === 'practice' || r.kind === 'exercise'),
                ))
            );
          }),
        }))
        .filter((m) => m.topicIds.length),
    }))
    .filter((c) => c.modules.length);
  const uniqueTopics = new Set(courses.flatMap((c) => c.modules.flatMap((m) => m.topicIds)));
  return (
    <div className="prep-hub">
      <Header
        eyebrow="ONE PLACE TO PREPARE"
        title="Prep Hub"
        description="Explore every public syllabus track, then jump straight to the reading or practice you need."
      />
      <nav className="prep-tracks" aria-label="Preparation tracks">
        {tracks.map((t) => (
          <button
            key={t.id}
            aria-current={track.id === t.id ? 'page' : undefined}
            onClick={() => update('track', t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <section className="panel prep-intro">
        <div>
          <BookOpen size={23} aria-hidden="true" />
          <h2>{track.label}</h2>
          <p>{track.description}</p>
        </div>
        <span className="badge">{trackCourses.length} learning paths</span>
        <p className="prep-scope">
          A linked syllabus index, with {Object.keys(catalog.topics).length.toLocaleString()} unique
          entries across all tracks. Topic names include source quizzes; full lessons and quizzes
          stay on their original sites. Reading links cover the topic or its module. Source videos
          and some practice may require a plan.
        </p>
        <a href={`${catalog.sourceUrl}?open=${track.id}`} target="_blank" rel="noopener noreferrer">
          Source: takeUforward Prep Hub <ArrowUpRight size={14} />
        </a>
      </section>
      <div className="filters prep-filters">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search Prep Hub"
            placeholder="Search topics, modules or paths…"
            value={search}
            onChange={(e) => update('q', e.target.value)}
          />
        </label>
        <select
          aria-label="Filter learning path"
          value={courseSlug}
          onChange={(e) => update('course', e.target.value)}
        >
          <option value="">All learning paths</option>
          {trackCourses.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.title}
            </option>
          ))}
        </select>
        <label className="prep-check">
          <input
            type="checkbox"
            checked={practiceOnly}
            onChange={(e) => update('practice', e.target.checked ? 'true' : '')}
          />
          Practice links
        </label>
        <label className="prep-check">
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={(e) => update('free', e.target.checked ? 'true' : '')}
          />
          Free resources
        </label>
      </div>
      <p className="muted prep-count" role="status">
        {courses.length} paths · {uniqueTopics.size} unique matching entries
      </p>
      <div className="prep-courses">
        {courses.map((course) => (
          <section className="panel prep-course" key={course.slug}>
            <header>
              <div>
                <span className="eyebrow">{course.modules.length} MODULES</span>
                <h2>{course.title}</h2>
              </div>
              <a href={`${course.sourceUrl}?page=sheet`} target="_blank" rel="noopener noreferrer">
                Source syllabus <ExternalLink size={14} />
              </a>
            </header>
            {course.modules.map((module) => (
              <Module
                key={`${module.id}:${query ? 'search' : 'browse'}`}
                title={module.title}
                count={module.topicIds.length}
                expanded={!!query}
              >
                {module.topicIds.map((id) => {
                  const topic = catalog.topics[id];
                  const resources = topic.resourceIds
                    .map((r) => catalog.resources[r])
                    .filter((r) => !freeOnly || r.access === 'free');
                  return (
                    <li key={id} className="prep-topic">
                      <div className="prep-topic-title">
                        <strong>{topic.title}</strong>
                        <span className="badge">
                          {topic.kind === 'quiz'
                            ? 'Source quiz'
                            : topic.kind === 'practice'
                              ? 'Practice'
                              : 'Topic'}
                        </span>
                      </div>
                      <div className="prep-links">
                        {topic.internalPath && (
                          <Link to={topic.internalPath} className="prep-local">
                            Study in DevTrack <ArrowUpRight size={14} />
                          </Link>
                        )}
                        {resources.map((r) => (
                          <ResourceLink key={r.url} resource={r} />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </Module>
            ))}
          </section>
        ))}
      </div>
      {!courses.length && (
        <State text="No topics match these filters. Try another path, search term or resource filter." />
      )}
      <p className="muted prep-footnote">
        Syllabus inspected {catalog.checkedAt}. Repeated topics are shared across sheets. External
        practice completion is not synced automatically.
      </p>
    </div>
  );
}
