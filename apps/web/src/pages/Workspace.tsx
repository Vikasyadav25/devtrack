import { Link, Routes, Route } from 'react-router-dom';
import { useCatalog } from '../lib/api';
import { Header, State } from '../components/WorkspaceUI';
import { Button } from '../components/ui/button';
import { Library, Roadmap } from './CatalogPages';
import { PatternPage, ProblemPage, LessonPage } from './StudyPages';
import { Revision } from './RevisionPage';
import { Planner } from './PlannerPage';
import { Analytics } from './AnalyticsPage';
import { Notes } from './NotesPage';
import { Settings } from './SettingsPage';
import { Mocks } from './MocksPage';
import { lazy, Suspense } from 'react';
const PrepHub = lazy(() => import('./PrepHubPage'));
export default function Workspace() {
  const cat = useCatalog();
  if (cat.isPending) return <State text="Loading your learning library…" />;
  if (cat.error) return <State text={cat.error.message} />;
  return (
    <Routes>
      <Route
        path="/prep-hub"
        element={
          <Suspense fallback={<State text="Loading preparation tracks…" />}>
            <PrepHub />
          </Suspense>
        }
      />
      <Route path="/roadmap" element={<Roadmap cat={cat.data!} />} />
      <Route path="/dsa/:slug" element={<PatternPage cat={cat.data!} />} />
      <Route path="/problems/:slug" element={<ProblemPage cat={cat.data!} />} />
      {['java', 'backend', 'cs', 'lld', 'hld'].map((domain) => (
        <Route
          key={domain}
          path={`/${domain}/:slug`}
          element={<LessonPage cat={cat.data!} domain={domain} />}
        />
      ))}
      <Route path="/revision" element={<Revision cat={cat.data!} />} />
      <Route path="/planner" element={<Planner cat={cat.data!} />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/notes" element={<Notes cat={cat.data!} />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/mocks" element={<Mocks />} />
      {['dsa', 'java', 'backend', 'cs', 'lld', 'hld'].map((domain) => (
        <Route
          key={domain}
          path={`/${domain}`}
          element={<Library cat={cat.data!} domain={domain} />}
        />
      ))}
      <Route
        path="*"
        element={
          <>
            <Header
              eyebrow="404"
              title="This page isn’t in your roadmap."
              description="Return to your workspace to keep learning."
            />
            <Button asChild>
              <Link to="/">Back to overview</Link>
            </Button>
          </>
        }
      />
    </Routes>
  );
}
