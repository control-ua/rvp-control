interface Props {
  children?: React.ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
  actions?: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function PageHeader({
  children,
  pageTitle,
  pageSubtitle,
  actions,
  title,
  subtitle,
  action,
}: Props) {
  const resolvedTitle = pageTitle ?? title ?? '';
  const resolvedSubtitle = pageSubtitle ?? subtitle;
  const resolvedActions = actions ?? action;

  const header = (
    <header className="rvp-page-header sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-[#0d0f14]/90 px-4 py-4 backdrop-blur sm:px-6">
      <div className="rvp-page-header-copy">
        <h1 className="text-xl font-semibold text-white">{resolvedTitle}</h1>
        {resolvedSubtitle && <p className="mt-0.5 text-sm text-slate-400">{resolvedSubtitle}</p>}
      </div>
      {resolvedActions && <div className="rvp-page-header-actions flex items-center gap-3">{resolvedActions}</div>}
    </header>
  );

  // New dashboard-style pages can use PageHeader as a standalone header.
  if (children === undefined) return header;

  // Keep the original wrapper behaviour for all existing pages.
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#0d0f14]">
      {header}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
