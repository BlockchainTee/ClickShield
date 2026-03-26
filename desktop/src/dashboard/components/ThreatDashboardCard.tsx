import type { ReactNode } from "react";

interface ThreatDashboardCardProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}

function joinClasses(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function ThreatDashboardCard({
  title,
  subtitle,
  actions,
  className,
  children,
}: ThreatDashboardCardProps) {
  return (
    <section
      className={joinClasses(
        "rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight text-slate-100">{title}</h3>
          {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
