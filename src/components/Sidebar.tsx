import { LogOut, Search, Droplets } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PageId } from "@/lib/permissions";
import { navigationGroups } from "@/workspace/navigation";
export default function Sidebar({
  currentPage,
  onNavigate,
  onOpenSearch,
}: {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenSearch?: () => void;
}) {
  return (
    <aside className="ws-sidebar">
      <button
        className="ws-brand"
        onClick={() => onNavigate("today")}
        aria-label="RPV Control — огляд"
      >
        <span className="ws-logo">
          <Droplets size={23} />
        </span>
        <span>
          <b>
            RPV Control<span className="ws-brand-dot">.</span>
          </b>
          <small>CONTROL SYSTEM</small>
        </span>
      </button>
      <button className="ws-sidebar-search" onClick={onOpenSearch}>
        <Search size={16} />
        <span>Швидкий пошук</span>
        <kbd>⌘ K</kbd>
      </button>
      <nav aria-label="Основна навігація">
        {navigationGroups.map((group) => (
          <div className="ws-nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={currentPage === id ? "active" : ""}
                aria-current={currentPage === id ? "page" : undefined}
                onClick={() => onNavigate(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="ws-sidebar-footer">
        <span>
          <i /> Робочий простір
        </span>
        <button
          aria-label="Вийти з облікового запису"
          onClick={() => void supabase.auth.signOut()}
        >
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  );
}
