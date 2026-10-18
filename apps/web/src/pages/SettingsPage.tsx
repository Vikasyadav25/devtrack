import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api, useDashboard } from '../lib/api';
import type { Goals } from '../../../../packages/shared/src/schemas';
import { Header, State } from '../components/WorkspaceUI';
import { Button } from '../components/ui/button';
import { useAction, Feedback } from '../components/StudyActions';
export function Settings() {
  const q = useDashboard();
  if (!q.data) return <State text={q.error?.message ?? 'Loading your preferences…'} />;
  return <SettingsForm initial={q.data.goals} />;
}

export function SettingsForm({ initial }: { initial: Goals }) {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ email: string; local: boolean; authProvider: string }>('/me'),
  });
  const [g, setG] = useState(initial),
    action = useAction(),
    backupAction = useAction(),
    [backupMessage, setBackupMessage] = useState('');
  return (
    <>
      <Header
        eyebrow="MAKE IT YOURS"
        title="Your pace. Your preferences."
        description="Set a sustainable routine and keep control of your learning data."
      />
      <div className="settings-grid">
        <section className="panel">
          <h2>Study goals</h2>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              action.run('/goals', g, 'PUT');
            }}
          >
            <label>
              Daily study budget (minutes)
              <input
                required
                type="number"
                min={15}
                max={600}
                value={g.dailyMinutes}
                onChange={(e) => setG({ ...g, dailyMinutes: Number(e.target.value) })}
              />
            </label>
            <label>
              Target track
              <select
                value={g.targetTrack}
                onChange={(e) =>
                  setG({ ...g, targetTrack: e.target.value as Goals['targetTrack'] })
                }
              >
                <option>SDE-2</option>
                <option>SDE-3</option>
              </select>
            </label>
            <label>
              IANA time zone
              <input
                required
                value={g.timezone}
                onChange={(e) => setG({ ...g, timezone: e.target.value })}
              />
            </label>
            <p className="muted">
              Review dates use this time zone. It is fixed once you have scheduled reviews.
            </p>
            <fieldset>
              <legend>Weekly rest days</legend>
              <div className="rest-days">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                  <label key={d}>
                    <input
                      type="checkbox"
                      checked={g.restDays.includes(i)}
                      onChange={(e) =>
                        setG({
                          ...g,
                          restDays: e.target.checked
                            ? [...g.restDays, i]
                            : g.restDays.filter((x) => x !== i),
                        })
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button disabled={action.isPending}>Save preferences</Button>
            <Feedback action={action} />
          </form>
        </section>
        <section className="panel">
          <h2>Your data belongs to you.</h2>
          {(me.data?.authProvider === 'google' || me.data?.authProvider === 'email') && (
            <div className="account-session">
              <p>
                Signed in as <strong>{me.data.email}</strong>
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await api('/auth/logout', {});
                    window.location.reload();
                  } catch (err) {
                    setBackupMessage((err as Error).message);
                  }
                }}
              >
                Sign out
              </Button>
              <hr />
            </div>
          )}
          <p>
            Export a versioned JSON backup of progress, attempts, notes, review history and goals.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const data = await api('/export');
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
                );
                const a = document.createElement('a');
                a.href = url;
                a.download = 'devtrack-backup.json';
                a.click();
                URL.revokeObjectURL(url);
                setBackupMessage('Backup downloaded.');
              } catch (e) {
                setBackupMessage((e as Error).message);
              }
            }}
          >
            <Download size={16} />
            Export my workspace
          </Button>
          <hr />
          <h3>Restore a backup</h3>
          <p className="muted">
            Import merges missing records and preserves existing records. The backup owner must
            match the signed-in account. Limit: 1 MB and 2,000 records.
          </p>
          <label className="file-label">
            Choose a DevTrack JSON backup
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  if (f.size > 1000000) throw new Error('Backup exceeds 1 MB.');
                  backupAction.run('/import', JSON.parse(await f.text()));
                } catch (err) {
                  setBackupMessage((err as Error).message);
                }
              }}
            />
          </label>
          <Feedback action={backupAction} />
          <p role="status">{backupMessage}</p>
        </section>
      </div>
    </>
  );
}
