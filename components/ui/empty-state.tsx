export function EmptyState({
  icon = "+",
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
      <div
        aria-hidden
        className="mb-1 flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-accent-subtle text-[17px] text-accent"
      >
        {icon}
      </div>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="max-w-[320px] text-[13px] leading-[1.5] text-text-secondary">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
