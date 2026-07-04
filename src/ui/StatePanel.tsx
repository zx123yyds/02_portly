export function StatePanel({ icon, title, detail, tone }: {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  tone?: 'error';
}) {
  return (
    <div className={`empty-state ${tone === 'error' ? 'is-error' : ''}`}>
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {detail ? <div className="empty-detail">{detail}</div> : null}
    </div>
  );
}
