export function State({ text }: { text: string }) {
  return (
    <div className="empty-state" role="status">
      {text}
    </div>
  );
}
export function Header({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function WeeklyChart({ days }: { days: { day: string; minutes: number }[] }) {
  const max = Math.max(60, ...days.map((x) => x.minutes));
  return (
    <div className="chart" aria-label="Study minutes over the last seven days">
      {days.map((d, i) => (
        <div className="chart-column" key={d.day}>
          <span>{d.minutes || ''}</span>
          <div
            className={`chart-bar ${i === 6 ? 'current' : ''}`}
            style={{ height: `${Math.max(3, (d.minutes / max) * 110)}px` }}
            title={`${d.day}: ${d.minutes} minutes`}
          />
          <small>
            {new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en', {
              weekday: 'short',
              timeZone: 'UTC',
            })}
          </small>
        </div>
      ))}
    </div>
  );
}
