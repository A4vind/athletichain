"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { Icon, type IconName } from "./icons";
import { Logo, initials } from "./ui";

export type NavItem = { href: string; label: string; count?: number; icon: IconName; primary?: boolean; short?: string };

function isActive(pathname: string, href: string) {
  return pathname === href || (href.split("/").length > 2 && pathname.startsWith(`${href}/`));
}

function NavLinks({ nav, pathname, onNavigate }: { nav: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {nav.map((item) => (
        <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined} onClick={onNavigate}>
          <Icon name={item.icon} size={19} />
          <span className="label-text">{item.label}</span>
          {item.count ? <span className="count" aria-label={`${item.count} new`}>{item.count}</span> : null}
        </Link>
      ))}
    </>
  );
}

function SignOut() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="signout">
        <Icon name="logout" size={18} />
        Sign out
      </button>
    </form>
  );
}

/**
 * Desktop: fixed sidebar. Phones and small tablets: a slim top bar, a bottom
 * navigation with the role's four main destinations, and a "More" sheet for the rest.
 */
export function AppShell({ nav, user, footer, children }: {
  nav: NavItem[];
  user: { name: string; roleLabel: string };
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const primary = nav.filter((n) => n.primary).slice(0, 4);
  const notifications = nav.find((n) => n.href === "/notifications");
  const moreActive = !primary.some((p) => isActive(pathname, p.href)) && pathname !== "/notifications";
  const moreCount = nav.filter((n) => !n.primary && n.href !== "/notifications").reduce((s, n) => s + (n.count ?? 0), 0);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="shell">
      <a href="#main" className="sr-only">Skip to content</a>
      <aside className="sidebar" aria-label="Sidebar">
        <Link href="/" className="brand">
          <Logo />
          <span className="brand-name">AthletiChain</span>
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLinks nav={nav} pathname={pathname} />
        </nav>
        <div className="sidebar-foot">
          {footer}
          <div className="who">
            <div className="avatar" aria-hidden="true">{initials(user.name)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="who-name">{user.name}</div>
              <div className="who-role">{user.roleLabel}</div>
            </div>
          </div>
          <SignOut />
        </div>
      </aside>

      <header className="topbar">
        <Link href="/" className="brand" aria-label="AthletiChain home">
          <Logo size={24} />
          <span className="brand-name">AthletiChain</span>
        </Link>
        <div className="topbar-actions">
          {notifications ? (
            <Link href="/notifications" className="icon-btn" aria-label={`Notifications${notifications.count ? `, ${notifications.count} unread` : ""}`} aria-current={pathname === "/notifications" ? "page" : undefined}>
              <Icon name="bell" />
              {notifications.count ? <span className="count" aria-hidden="true">{notifications.count}</span> : null}
            </Link>
          ) : null}
          <button type="button" className="icon-btn" aria-label="Account and all pages" aria-expanded={open} onClick={() => setOpen(true)}>
            <span className="avatar" style={{ width: 30, height: 30, fontSize: 11.5 }} aria-hidden="true">{initials(user.name)}</span>
          </button>
        </div>
      </header>

      <main className="main" id="main">{children}</main>

      <nav className="bottom-nav" aria-label="Quick navigation">
        {primary.map((item) => (
          <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
            <Icon name={item.icon} size={22} />
            <span className="t">{item.short ?? item.label}</span>
            {item.count ? <span className="count" aria-label={`${item.count} new`}>{item.count}</span> : null}
          </Link>
        ))}
        <button type="button" aria-expanded={open} aria-controls="more-sheet" onClick={() => setOpen(true)} aria-current={moreActive ? "page" : undefined}>
          <Icon name="menu" size={22} />
          <span className="t">More</span>
          {moreCount ? <span className="count" aria-hidden="true">{moreCount}</span> : null}
        </button>
      </nav>

      <div className="sheet-backdrop" data-open={open} onClick={() => setOpen(false)} aria-hidden="true" />
      <div id="more-sheet" ref={sheetRef} className="sheet" data-open={open} role="dialog" aria-modal="true" aria-label="All pages" hidden={!open}>
        <div className="grip" aria-hidden="true" />
        <div className="who">
          <div className="avatar" aria-hidden="true">{initials(user.name)}</div>
          <div style={{ minWidth: 0, flexGrow: 1 }}>
            <div className="who-name">{user.name}</div>
            <div className="who-role">{user.roleLabel}</div>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => setOpen(false)} style={{ display: "inline-flex" }}>
            <Icon name="x" />
          </button>
        </div>
        <nav className="nav" aria-label="All pages">
          <NavLinks nav={nav} pathname={pathname} onNavigate={() => setOpen(false)} />
        </nav>
        <div style={{ marginTop: 8 }}>
          {footer}
          <SignOut />
        </div>
      </div>
    </div>
  );
}
