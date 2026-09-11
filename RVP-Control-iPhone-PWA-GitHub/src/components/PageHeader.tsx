interface Props {
  children: React.ReactNode;
  pageTitle: string;
  pageSubtitle?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ children, pageTitle, pageSubtitle, actions }: Props) {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0d0f14]">
      <header className="sticky top-0 z-10 bg-[#0d0f14]/90 backdrop-blur border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">{pageTitle}</h1>
          {pageSubtitle && <p className="text-sm text-slate-400 mt-0.5">{pageSubtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
