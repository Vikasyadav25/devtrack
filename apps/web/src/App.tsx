import { State, Header, WeeklyChart } from './components/WorkspaceUI';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BookOpen,
  Braces,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  Code2,
  Coffee,
  Command,
  Flame,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Menu,
  Moon,
  Network,
  NotebookPen,
  RotateCcw,
  Search,
  Settings,
  Sun,
  Target,
  X,
} from 'lucide-react';
import { api, ApiError, itemUrl, useCatalog, useDashboard } from './lib/api';
import { LoginScreen } from './components/LoginScreen';
import { Button } from './components/ui/button';
const Workspace = lazy(() => import('./pages/Workspace'));
const library = [
  { to: '/prep-hub', label: 'Prep Hub', icon: BookOpen },
  { to: '/roadmap', label: 'Learning roadmap', icon: GitBranch },
  { to: '/dsa', label: 'DSA & patterns', icon: Code2 },
  { to: '/java', label: 'Core Java', icon: Coffee },
  { to: '/backend', label: 'Backend engineering', icon: Layers },
  { to: '/lld', label: 'Low-level design', icon: Braces },
  { to: '/hld', label: 'System design', icon: Network },
  { to: '/cs', label: 'CS fundamentals', icon: GraduationCap },
];
const practice = [
  { to: '/revision', label: 'Revision queue', icon: RotateCcw },
  { to: '/planner', label: 'Study planner', icon: CalendarDays },
  { to: '/mocks', label: 'Mock interviews', icon: Target },
  { to: '/notes', label: 'My notes', icon: NotebookPen },
  { to: '/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
];
export default function App() {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState('');
  const location = useLocation(),
    navigate = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem('devtrack-theme') === 'dark');
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ email: string; local: boolean }>('/me'),
    retry: false,
  });
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('devtrack-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    setOpen(false);
    document.querySelector('main')?.focus();
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  const title =
    [
      { to: '/', label: 'Overview' },
      ...library,
      ...practice,
      { to: '/settings', label: 'Settings' },
    ].find((x) => x.to === location.pathname)?.label ?? 'Learning workspace';
  if (me.error instanceof ApiError && me.error.status === 401) return <LoginScreen />;
  return (
    <div className="app">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      {open && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside id="workspace-navigation" className={`sidebar ${open ? 'is-open' : ''}`}>
        <Link className="brand" to="/">
          <span className="brand-symbol">
            <Command size={23} />
          </span>
          devtrack<span className="brand-dot">.</span>
        </Link>
        <button
          className="mobile-close"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <div className="workspace-label">
          <span className="small-avatar">P</span>
          <span>
            Personal workspace<small>Your next chapter starts here</small>
          </span>
        </div>
        <nav aria-label="Main navigation">
          <NavLink to="/" end className="nav-link">
            <LayoutDashboard size={18} />
            Overview
          </NavLink>
          <p className="nav-heading">LEARN</p>
          {library.map((n) => (
            <NavLink key={n.to} to={n.to} className="nav-link">
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
          <p className="nav-heading">PRACTICE & GROW</p>
          {practice.map((n) => (
            <NavLink key={n.to} to={n.to} className="nav-link">
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="journey-card">
            <span className="eyebrow">A LITTLE, EVERY DAY</span>
            <p>Consistency compounds.</p>
            <span>One focused session at a time.</span>
            <Link to="/planner">
              Make time to grow <ArrowUpRight size={14} />
            </Link>
          </div>
          <NavLink to="/settings" className="nav-link">
            <Settings size={18} />
            Settings
          </NavLink>
          <div className="profile">
            <span className="small-avatar">Y</span>
            <div>
              Your workspace
              <small>{me.data?.local ? 'Local development' : 'Private learning account'}</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              aria-expanded={open}
              aria-controls="workspace-navigation"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/dsa?q=${encodeURIComponent(search)}`);
            }}
          >
            <Search size={16} />
            <input
              aria-label="Search curriculum"
              placeholder="Find your next topic…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <button
            className="theme-button"
            onClick={() => setDark(!dark)}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <span className="top-avatar">Y</span>
        </header>
        <main id="main" tabIndex={-1}>
          {me.isPending ? (
            <State text="Opening your workspace…" />
          ) : me.error ? (
            <div className="auth-card">
              <span className="eyebrow">YOUR PRIVATE WORKSPACE</span>
              <h1>Welcome to DevTrack.</h1>
              <p>{me.error.message}</p>
              <p>
                For local development, run the migration and seed commands, then start both servers.
                For a deployed app, sign in at the API’s Access page first.
              </p>
              {import.meta.env.VITE_API_BASE_URL && (
                <Button asChild>
                  <a href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/me`}>Sign in to your API</a>
                </Button>
              )}
              <Button variant="outline" onClick={() => me.refetch()}>
                Retry connection
              </Button>
            </div>
          ) : (
            <Suspense fallback={<State text="Loading workspace…" />}>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/*" element={<Workspace />} />
              </Routes>
            </Suspense>
          )}
        </main>
        <footer className="app-footer">
          <span>Built for deliberate practice.</span>
          <span>Learn. Recall. Build. Repeat.</span>
        </footer>
      </div>
    </div>
  );
}

function DashboardPage() {
  const q = useDashboard(),
    cat = useCatalog();
  if (q.isPending) return <State text="Preparing your study plan…" />;
  if (q.error) return <State text={q.error.message} />;
  const d = q.data!;
  const remaining = Math.max(0, d.budget - d.spent);
  const date = new Date(`${d.today}T12:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return (
    <>
      <Header
        eyebrow={date.toUpperCase()}
        title="A little progress. A stronger you."
        description="Your next role is built one focused session at a time."
        action={
          <Button asChild>
            <Link to="/planner">
              <CalendarDays size={16} />
              Plan my day
            </Link>
          </Button>
        }
      />
      <section className="hero">
        <div>
          <span className="hero-kicker">
            <span className="pulsing-dot" />
            YOUR LEARNING JOURNEY
          </span>
          <h2>
            Don’t just prepare.
            <br />
            Build the way you think.
          </h2>
          <p>
            From your first pattern to your next system design.
            <br />A clear path. Meaningful practice. Progress that lasts.
          </p>
          <Button asChild>
            <Link
              to={
                d.plan.items[0]
                  ? itemUrl(d.plan.items[0].item_type, d.plan.items[0].item_id, cat.data)
                  : '/roadmap'
              }
            >
              Continue learning <ArrowUpRight size={17} />
            </Link>
          </Button>
          <span className="hero-caption">YOUR PACE. YOUR NEXT CHAPTER.</span>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="visual-card card-code">
            <Code2 size={22} />
            <span>Understand the why.</span>
            <i />
            <i />
            <i />
          </div>
          <div className="visual-card card-growth">
            <GitBranch size={21} />
            <span>Connect the dots.</span>
            <div className="growth-lines">
              <b />
              <b />
              <b />
              <b />
              <b />
            </div>
          </div>
          <div className="visual-chip">
            <span>✦</span> Better, every day.
          </div>
        </div>
      </section>
      <section className="stat-grid" aria-label="Study statistics">
        {[
          {
            label: 'Study streak',
            value: `${d.streak}`,
            unit: 'days',
            icon: Flame,
            note: 'Keep showing up',
            color: 'orange',
          },
          {
            label: 'Focused today',
            value: `${d.spent}`,
            unit: 'min',
            icon: CalendarDays,
            note: `${remaining} min left in your plan`,
            color: 'green',
          },
          {
            label: 'Independent solves',
            value: `${d.independentlySolved}`,
            unit: 'problems',
            icon: Code2,
            note: `${d.attempted} total attempts`,
            color: 'blue',
          },
          {
            label: 'Ready for recall',
            value: `${d.reviews.length}`,
            unit: 'items',
            icon: RotateCcw,
            note: d.reviews.length ? 'A little review goes a long way' : 'Your queue is clear',
            color: 'purple',
          },
        ].map((s) => (
          <article className="stat-card" key={s.label}>
            <div>
              <span>{s.label}</span>
              <s.icon size={18} className={`icon-${s.color}`} />
            </div>
            <strong>
              {s.value}
              <small>{s.unit}</small>
            </strong>
            <p>{s.note}</p>
          </article>
        ))}
      </section>
      <div className="dashboard-columns">
        <section className="panel today-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">MAKE IT COUNT</span>
              <h2>Your focus for today</h2>
            </div>
            <span className="badge">{d.plan.minutes} min planned</span>
          </div>
          {d.plan.items.length ? (
            d.plan.items.slice(0, 4).map((x, i) => (
              <Link
                className="focus-row"
                key={`${x.item_type}${x.item_id}`}
                to={itemUrl(x.item_type, x.item_id, cat.data)}
              >
                <span className={`focus-icon focus-${i % 3}`}>
                  {x.item_type === 'problem' ? (
                    <Code2 size={19} />
                  ) : x.item_type === 'pattern' ? (
                    <Braces size={19} />
                  ) : (
                    <BookOpen size={19} />
                  )}
                </span>
                <span className="focus-text">
                  <small>
                    {x.domain.toUpperCase()}{' '}
                    <span>
                      •{' '}
                      {x.item_type === 'problem'
                        ? 'Practice'
                        : x.item_type === 'pattern'
                          ? 'Learn a pattern'
                          : 'Read & understand'}
                    </span>
                  </small>
                  <strong>{x.title}</strong>
                </span>
                <span className="time-label">{x.estimatedMinutes} min</span>
                <ChevronRight size={16} />
              </Link>
            ))
          ) : (
            <State
              text={
                d.budget === 0
                  ? 'A planned rest day. Explore the library or return tomorrow.'
                  : 'Today’s plan is complete. Your next chapter can wait until tomorrow.'
              }
            />
          )}
          <Link className="panel-footer-link" to="/planner">
            View your full study plan <ArrowUpRight size={15} />
          </Link>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">SMALL STEPS ADD UP</span>
              <h2>Your week in focus</h2>
            </div>
            <span className="badge subtle">Last 7 days</span>
          </div>
          <WeeklyChart days={d.weekly} />
          <div className="chart-summary">
            <strong>
              {d.weekly.reduce((s, x) => s + x.minutes, 0)} <span>minutes invested</span>
            </strong>
            <Link to="/analytics">
              See insights <ArrowUpRight size={13} />
            </Link>
          </div>
        </section>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE BIGGER PICTURE</span>
          <h2>Build your engineering toolkit</h2>
        </div>
        <Link to="/roadmap">
          Explore the roadmap <ArrowUpRight size={15} />
        </Link>
      </div>
      <section className="toolkit-grid">
        {[
          {
            title: 'Patterns, not memorization.',
            desc: 'Learn to recognize the problem behind the problem.',
            to: '/dsa',
            tag: 'DSA & PROBLEM SOLVING',
            icon: Code2,
            count: `${cat.data?.patterns.length ?? 0} patterns · ${d.totalProblems} problems`,
          },
          {
            title: 'Go deeper with Java.',
            desc: 'From language foundations to production decisions.',
            to: '/java',
            tag: 'CORE JAVA & BACKEND',
            icon: Coffee,
            count: `${cat.data?.lessons.filter((x) => x.domain === 'java').length ?? 0} Java lessons`,
          },
          {
            title: 'Think in systems.',
            desc: 'Make tradeoffs. Design for the real world.',
            to: '/hld',
            tag: 'SYSTEM DESIGN',
            icon: Network,
            count: `${cat.data?.cases.length ?? 0} design case studies`,
          },
        ].map((x) => (
          <Link className="toolkit-card" key={x.to} to={x.to}>
            <div className="toolkit-top">
              <x.icon size={22} />
              <ArrowUpRight size={17} />
            </div>
            <span className="eyebrow">{x.tag}</span>
            <h3>{x.title}</h3>
            <p>{x.desc}</p>
            <span className="toolkit-count">{x.count}</span>
          </Link>
        ))}
      </section>
      <div className="quote-strip">
        <span>✦</span>
        <p>“It’s not about being ready for every question. It’s about learning how to think.”</p>
        <span>A NOTE TO YOUR FUTURE SELF</span>
      </div>
    </>
  );
}
