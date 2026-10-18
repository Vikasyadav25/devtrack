import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowUpRight, ExternalLink } from 'lucide-react';
import { api, type Catalog } from '../lib/api';
import { attemptInput } from '../../../../packages/shared/src/schemas';
import type { Problem, Lesson, DesignCase } from '../../../../packages/shared/src/content';
import { Header, State } from '../components/WorkspaceUI';
import { Button } from '../components/ui/button';
import { Code, Diagram, Prose } from '../components/Reader';
import { useAction, Feedback, Complete } from '../components/StudyActions';
import { labels } from './CatalogPages';
export function PatternPage({ cat }: { cat: Catalog }) {
  const { slug } = useParams();
  const p = cat.patterns.find((x) => x.slug === slug);
  if (!p) return <State text="Pattern not found." />;
  return (
    <>
      <Link className="back-link" to="/dsa">
        <ArrowLeft size={15} />
        All patterns
      </Link>
      <Header
        eyebrow={`${p.level.toUpperCase()} · ${p.estimatedMinutes} MIN`}
        title={p.title}
        description="Recognize the shape of the problem before reaching for a solution."
      />
      <div className="reader-layout">
        <article className="panel reader">
          <div className="callout">
            <strong>Recognition signals</strong>
            <ul>
              {p.recognitionClues.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <Prose>{p.explanationMd}</Prose>
          <h2>Java template</h2>
          <Code code={p.javaTemplate} />
          <h2>A dry run</h2>
          <ol>
            {p.dryRunSteps.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
          <div className="complexity">
            <span>Time: {p.timeComplexity}</span>
            <span>Space: {p.spaceComplexity}</span>
          </div>
          <h2>Common mistakes</h2>
          <ul>
            {p.commonMistakes.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <h2>Interview follow-ups</h2>
          <ul>
            {p.interviewFollowups.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <Complete type="pattern" id={p.id} minutes={p.estimatedMinutes} />
        </article>
        <aside className="reader-aside">
          <section className="panel">
            <h2>Practice the pattern</h2>
            <p className="muted">
              Go in order. Record your reasoning and hint use after each attempt.
            </p>
            {cat.problems
              .filter((x) => p.practiceProblemIds.includes(x.id))
              .map((x, i) => (
                <Link className="problem-link" to={`/problems/${x.slug}`} key={x.id}>
                  <span className="problem-number">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    {x.title}
                    <small className={x.difficulty.toLowerCase()}>{x.difficulty}</small>
                  </span>
                  <ArrowUpRight size={14} />
                </Link>
              ))}
          </section>
          {p.prerequisiteSlugs.length > 0 && (
            <section className="panel">
              <h3>Build on your foundations</h3>
              {p.prerequisiteSlugs.map((x) => (
                <Link className="list-row" key={x} to={`/dsa/${x}`}>
                  {cat.patterns.find((p) => p.slug === x)?.title ?? x}
                  <ArrowUpRight size={14} />
                </Link>
              ))}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

export function ProblemPage({ cat }: { cat: Catalog }) {
  const { slug } = useParams();
  const p = cat.problems.find((x) => x.slug === slug);
  if (!p) return <State text="Problem not found." />;
  return <ProblemDetail key={p.id} p={p} cat={cat} />;
}

export function ProblemDetail({ p, cat }: { p: Problem; cat: Catalog }) {
  const action = useAction(),
    attempts = useQuery({
      queryKey: ['attempts', p.id],
      queryFn: () =>
        api<
          {
            id: string;
            attempted_at: string;
            result: string;
            hint_used: number;
            minutes: number;
            notes_md: string;
          }[]
        >(`/problems/${p.id}/attempts`),
    });
  const form = useForm<z.input<typeof attemptInput>, unknown, z.output<typeof attemptInput>>({
    resolver: zodResolver(attemptInput),
    defaultValues: {
      result: 'partial',
      hintUsed: false,
      minutes: 25,
      confidence: 3,
      notes: '',
      codeUrl: '',
    },
  });
  const [reveal, setReveal] = useState(false);
  return (
    <>
      <Link className="back-link" to="/dsa">
        <ArrowLeft size={15} />
        Problem library
      </Link>
      <Header
        eyebrow={`LEETCODE ${p.id.replace('lc-', '')} · ${p.difficulty.toUpperCase()}`}
        title={p.title}
        description={p.whySelected}
        action={
          <Button asChild>
            <a href={p.externalUrl} target="_blank" rel="noopener noreferrer">
              Open problem <ExternalLink size={16} />
            </a>
          </Button>
        }
      />
      <div className="reader-layout">
        <article className="panel reader">
          <h2>Start with your own reasoning</h2>
          <p>{p.constraintsSummary}</p>
          {p.needsVerification && (
            <p className="verification-note">
              This canonical link has not passed automated verification. If unavailable, search for
              the LeetCode ID shown above.
            </p>
          )}
          <p>
            Opening the problem never records a solve. Record an attempt when you finish working.
          </p>
          <details>
            <summary>Hint 1 · a small nudge</summary>
            <p>{p.hint1}</p>
          </details>
          <details>
            <summary>Hint 2 · identify the invariant</summary>
            <p>{p.hint2}</p>
          </details>
          <button className="text-button" onClick={() => setReveal(!reveal)}>
            {reveal ? 'Hide pattern tags' : 'Reveal pattern tags after your attempt'}
          </button>
          {reveal && (
            <div className="tag-list">
              {p.patternSlugs.map((x) =>
                cat.patterns.some((y) => y.slug === x) ? (
                  <Link className="badge" to={`/dsa/${x}`} key={x}>
                    {cat.patterns.find((y) => y.slug === x)?.title}
                  </Link>
                ) : (
                  <span className="badge" key={x}>
                    Planned pattern: {x}
                  </span>
                ),
              )}
            </div>
          )}
          <h2>Record an honest attempt</h2>
          <form
            className="form-grid"
            onSubmit={form.handleSubmit((b) => action.run(`/problems/${p.id}/attempts`, b))}
          >
            <label>
              Outcome
              <select {...form.register('result')}>
                <option value="partial">Partial progress</option>
                <option value="solved">Solved</option>
                <option value="failed">Could not solve</option>
              </select>
            </label>
            <label>
              Focused minutes
              <input
                type="number"
                min="1"
                max="600"
                {...form.register('minutes', { valueAsNumber: true })}
              />
            </label>
            <label>
              Confidence
              <select {...form.register('confidence', { valueAsNumber: true })}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} / 5
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-label">
              <input type="checkbox" {...form.register('hintUsed')} />I used a hint or solution
            </label>
            <label className="full-width">
              What did you learn?
              <textarea
                rows={6}
                {...form.register('notes')}
                placeholder="The invariant, a mistake, an edge case…"
              />
            </label>
            <label className="full-width">
              Solution link (optional, HTTPS)
              <input type="url" {...form.register('codeUrl')} placeholder="https://github.com/…" />
            </label>
            {Object.entries(form.formState.errors).map(([key, error]) => (
              <p className="form-error" role="alert" key={key}>
                {key}: {error.message}
              </p>
            ))}
            <Button disabled={action.isPending} type="submit">
              Save attempt & schedule review
            </Button>
            <Feedback action={action} />
          </form>
        </article>
        <aside className="reader-aside">
          <section className="panel">
            <h2>Attempt history</h2>
            {attempts.error ? (
              <p role="alert">{attempts.error.message}</p>
            ) : attempts.data?.length ? (
              attempts.data.map((x) => (
                <div className="attempt-row" key={x.id}>
                  <strong>
                    {x.result} {x.hint_used ? '· with help' : '· independent'}
                  </strong>
                  <small>
                    {new Date(x.attempted_at).toLocaleDateString()} · {x.minutes} min
                  </small>
                  <p>{x.notes_md}</p>
                </div>
              ))
            ) : (
              <State text="Your first attempt starts the story." />
            )}
          </section>
          <section className="panel">
            <h3>Before you submit</h3>
            <ul>
              {p.edgeCases.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <h3>Recall prompts</h3>
            <ul>
              {p.revisionPrompts.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}

export function LessonPage({ cat, domain }: { cat: Catalog; domain: string }) {
  const { slug } = useParams();
  const lesson = cat.lessons.find((x) => x.slug === slug && x.domain === domain),
    study = cat.cases.find((x) => x.slug === slug && x.kind.toLowerCase() === domain);
  if (!lesson && !study) return <State text="Lesson not found." />;
  return (
    <>
      <Link className="back-link" to={`/${domain}`}>
        <ArrowLeft size={15} />
        {labels[domain]}
      </Link>
      {lesson ? (
        <LessonReader key={lesson.slug} lesson={lesson} />
      ) : (
        <CaseReader key={study!.slug} study={study!} />
      )}
    </>
  );
}

export function LessonReader({ lesson: l }: { lesson: Lesson }) {
  const [answers, setAnswers] = useState(false);
  return (
    <>
      <Header
        eyebrow={`${l.module.toUpperCase()} · ${l.readingMinutes} MIN`}
        title={l.title}
        description={l.mentalModel}
      />
      <article className="panel reader standalone">
        <h2>What you will understand</h2>
        <ul>
          {l.learningObjectives.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <Prose>{l.explanationMd}</Prose>
        {l.javaExamples.map((e, i) => (
          <section key={i}>
            <Code code={e.code} />
            <Code code={e.expectedOutput} label="Expected output" />
            <p>{e.explanation}</p>
          </section>
        ))}
        <h2>Under the surface</h2>
        <p>{l.internals}</p>
        <h2>Common traps</h2>
        <ul>
          {l.pitfalls.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <h2>Where this matters</h2>
        <p>{l.realWorldUse}</p>
        <h2>Interview answers</h2>
        {l.interviewQA.map((q) => (
          <details key={q.question}>
            <summary>{q.question}</summary>
            <strong>{q.shortAnswer}</strong>
            <p>{q.deepAnswer}</p>
            <ul>
              {q.followups.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </details>
        ))}
        <h2>Check your recall</h2>
        {l.quiz.map((q) => (
          <section key={q.question}>
            <p>
              <strong>{q.question}</strong>
            </p>
            <textarea
              aria-label={`Your answer: ${q.question}`}
              placeholder="Explain it without looking back…"
              rows={3}
            />
            {answers && <p className="callout">{q.answer}</p>}
          </section>
        ))}
        <Button variant="outline" onClick={() => setAnswers(!answers)}>
          {answers ? 'Hide' : 'Show'} sample answers
        </Button>
        <h2>Build it yourself</h2>
        <ul>
          {l.practiceTasks.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <h2>References</h2>
        <ul>
          {l.references.map((x) => (
            <li key={x}>
              <a href={x} target="_blank" rel="noreferrer">
                Official documentation <ExternalLink size={12} />
              </a>
            </li>
          ))}
        </ul>
        <Complete type="lesson" id={l.slug} minutes={l.readingMinutes} />
      </article>
    </>
  );
}

export function CaseReader({ study: s }: { study: DesignCase }) {
  return (
    <>
      <Header
        eyebrow={`${s.kind} · 45-MINUTE DESIGN PRACTICE`}
        title={s.title}
        description={s.prompt}
      />
      <article className="panel reader standalone">
        <div className="callout">
          45-minute structure: clarify 5 min → requirements & estimates 5 min → baseline 15 min →
          deep dive 15 min → tradeoffs 5 min.
        </div>
        {[
          { title: 'Clarify before designing', items: s.clarifyingQuestions },
          { title: 'Functional requirements', items: s.functionalRequirements },
          { title: 'Quality requirements', items: s.nonFunctionalRequirements },
          { title: 'Out of scope', items: s.outOfScope },
          { title: 'Core entities', items: s.entities },
          { title: 'API contracts', items: s.apiContracts },
        ].map((x) => (
          <section key={x.title}>
            <h2>{x.title}</h2>
            <ul>
              {x.items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        ))}
        <h2>Data model</h2>
        <Prose>{s.dataModel}</Prose>
        {s.capacityEstimation && (
          <>
            <h2>Capacity assumptions</h2>
            <p>{s.capacityEstimation}</p>
          </>
        )}
        <h2>Baseline design</h2>
        <Prose>{s.baselineDesign}</Prose>
        {s.mermaidDiagrams.map((x, i) => (
          <Diagram source={x} key={i} />
        ))}
        {s.javaSkeleton && (
          <>
            <h2>Java skeleton</h2>
            <Code code={s.javaSkeleton} />
          </>
        )}
        {[
          { title: 'Design tradeoffs', items: s.tradeoffs },
          { title: 'Failure modes', items: s.failureModes },
          { title: 'Scaling options', items: s.scalingOptions },
          { title: 'Concurrency concerns', items: s.concurrencyConcerns },
          { title: 'Testing strategy', items: s.testingStrategy },
          { title: 'Interviewer follow-ups', items: s.followupQuestions },
        ].map((x) => (
          <section key={x.title}>
            <h2>{x.title}</h2>
            <ul>
              {x.items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        ))}
        <h2>Evaluate your design</h2>
        <p>{s.evaluationRubric}</p>
        <Complete type="case" id={s.slug} minutes={45} />
      </article>
    </>
  );
}
