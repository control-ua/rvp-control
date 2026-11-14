import { useEffect, useRef, useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PageId } from "@/lib/permissions";
import { navigationGroups, primaryNavigation } from "@/workspace/navigation";
export default function MobileNav({
  currentPage,
  onNavigate,
}: {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenMore?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", escape);
      triggerRef.current?.focus();
    };
  }, [open]);
  const go = (page: PageId) => {
    setOpen(false);
    onNavigate(page);
  };
  return (
    <>
      {open && (
        <div className="ws-menu-backdrop lg:hidden">
          <button
            className="ws-menu-shade"
            aria-label="Закрити меню"
            onClick={() => setOpen(false)}
          />
          <section
            className="ws-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Усі розділи"
          >
            <header>
              <div>
                <b>Робочий простір</b>
                <p>RPV Control System</p>
              </div>
              <button
                ref={closeRef}
                aria-label="Закрити меню"
                onClick={() => setOpen(false)}
              >
                <X size={21} />
              </button>
            </header>
            {navigationGroups.map((group) => (
              <div className="ws-nav-group" key={group.label}>
                <p>{group.label}</p>
                <div>
                  {group.items
                    .filter(
                      (i) => !primaryNavigation.some((p) => p.id === i.id),
                    )
                    .map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        className={currentPage === id ? "active" : ""}
                        onClick={() => go(id)}
                      >
                        <Icon size={18} />
                        <span>{label}</span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
            <button
              className="ws-logout"
              onClick={() => void supabase.auth.signOut()}
            >
              <LogOut size={17} /> Вийти
            </button>
          </section>
        </div>
      )}
      <nav className="ws-mobile-nav lg:hidden" aria-label="Мобільна навігація">
        {primaryNavigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={currentPage === id ? "active" : ""}
            aria-current={currentPage === id ? "page" : undefined}
            onClick={() => go(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
        <button
          ref={triggerRef}
          className={
            open || !primaryNavigation.some((p) => p.id === currentPage)
              ? "active"
              : ""
          }
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Menu size={21} />
          <span>Ще</span>
        </button>
      </nav>
    </>
  );
}
