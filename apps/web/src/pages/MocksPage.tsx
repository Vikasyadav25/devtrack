import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Header, State } from '../components/WorkspaceUI';
import { Button } from '../components/ui/button';
import { Prose } from '../components/Reader';
import { useAction, Feedback } from '../components/StudyActions';
export function Mocks() {
  const q = useQuery({
      queryKey: ['mocks'],
      queryFn: () =>
        api<
          {
            id: string;
            type: string;
            started_at: string;
            duration_minutes: number;
            feedback_md: string;
            score_json: string;
          }[]
        >('/mocks'),
    }),
    action = useAction();
  const [type, setType] = useState('DSA'),
    [minutes, setMinutes] = useState(45),
    [feedback, setFeedback] = useState(''),
    [scores, setScores] = useState({ clarity: 3, correctness: 3, tradeoffs: 3 }),
    [end, setEnd] = useState<number | null>(null),
    [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!end) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [end]);
  return (
    <>
      <Header
        eyebrow="PRACTICE UNDER CONSTRAINTS"
        title="Make the interview familiar."
        description="Run a timed session, then reflect on reasoning, correctness and tradeoffs."
      />
      <div className="settings-grid">
        <section className="panel">
          <h2>Start a focused mock</h2>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              action.run('/mocks', { type, durationMinutes: minutes, feedback, scores });
            }}
          >
            <label>
              Interview type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {['DSA', 'LLD', 'HLD', 'Behavioral'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Duration (minutes)
              <input
                type="number"
                min={5}
                max={180}
                required
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEnd(Date.now() + minutes * 60000)}
            >
              Start timer
            </Button>
            {end && (
              <p className="timer" role="timer">
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
                {remaining === 0 ? ' · Time to reflect' : ''}
              </p>
            )}
            {Object.entries(scores).map(([key, value]) => (
              <label key={key}>
                {key} · self-assessment
                <select
                  value={value}
                  onChange={(e) => setScores({ ...scores, [key]: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              Review notes
              <textarea
                required
                rows={6}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What went well? What would you change? For behavioral rounds, use situation, task, action, result."
              />
            </label>
            <Button disabled={action.isPending}>Save session reflection</Button>
            <Feedback action={action} />
          </form>
        </section>
        <section className="panel">
          <h2>Past sessions</h2>
          {q.error && <p role="alert">{q.error.message}</p>}
          {q.data?.map((x) => (
            <article className="note-card" key={x.id}>
              <span className="badge">
                {x.type} · {x.duration_minutes} min
              </span>
              <p className="muted">{new Date(x.started_at).toLocaleDateString()}</p>
              <Prose>{x.feedback_md}</Prose>
            </article>
          ))}
          {!q.data?.length && <State text="Your first practice interview starts here." />}
        </section>
      </div>
    </>
  );
}
