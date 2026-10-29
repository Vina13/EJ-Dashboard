import { useCallback, useEffect, useState, type ReactNode } from "react";
import { canAccess, landingMenu, type EjUser } from "@repo/shared";
import { getMe, logout } from "./api";
import { Icon, type IconName } from "./icons";
import { LoginPage } from "./LoginPage";
import { labelOf, menuFor, useHashRoute, type MenuItem, type Route } from "./menu";
import { DailyReportPage } from "./pages/DailyReportPage";
import { EjParsingPage } from "./pages/EjParsingPage";
import { HomePage } from "./pages/HomePage";
import { MergeEjPage } from "./pages/MergeEjPage";
import { UserManagementPage } from "./pages/UserManagementPage";

type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: EjUser };

export function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [route, navigate] = useHashRoute();
  // Small screens show the sidebar as a drawer
  const [menuOpen, setMenuOpen] = useState(false);
  const showLogin = useCallback(() => setAuth({ status: "anonymous" }), []);
  const role = auth.status === "authenticated" ? auth.user.role : null;
  // A missing hash, or a menu the role may not open (FSD Tabel 6.1), shows the role's landing page
  const page = role && route && canAccess(role, route) ? route : role && landingMenu(role);

  useEffect(() => {
    getMe()
      .then((body) => setAuth(body.ok ? { status: "authenticated", user: body.data } : { status: "anonymous" }))
      .catch(() => setAuth({ status: "anonymous" }));
  }, []);

  useEffect(() => {
    if (page && page !== route) navigate(page);
  }, [page, route, navigate]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      // The cookie is httpOnly, so the UI can't confirm it was cleared; show the form either way
      setAuth({ status: "anonymous" });
    }
  }

  if (auth.status === "loading") return <p className="loading">Memuat…</p>;

  if (auth.status === "anonymous") {
    return (
      <LoginPage
        onSuccess={(user) => {
          setAuth({ status: "authenticated", user });
          navigate(landingMenu(user.role));
        }}
      />
    );
  }

  const current = page ?? landingMenu(auth.user.role);

  return (
    <div className={`shell${menuOpen ? " menu-open" : ""}`}>
      <Sidebar
        menu={menuFor(auth.user.role)}
        route={current}
        onNavigate={(next) => {
          navigate(next);
          setMenuOpen(false);
        }}
      />
      <div className="backdrop" aria-hidden onClick={() => setMenuOpen(false)} />
      <div className="content">
        <header className="topbar">
          <button
            className="menu-toggle"
            aria-label="Buka menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name="menu" />
          </button>
          <h1>{labelOf(current)}</h1>
          <div className="topbar-user">
            <span className="avatar" aria-hidden>
              {auth.user.name.charAt(0).toUpperCase()}
            </span>
            <span className="topbar-name">
              {auth.user.name} <span className="badge">{auth.user.role}</span>
            </span>
            <button onClick={handleLogout}>Keluar</button>
          </div>
        </header>
        <main className="page">
          <Page route={current} user={auth.user} onUnauthorized={showLogin} />
        </main>
      </div>
    </div>
  );
}

function Page({ route, user, onUnauthorized }: { route: Route; user: EjUser; onUnauthorized: () => void }) {
  switch (route) {
    case "home":
      return <HomePage onUnauthorized={onUnauthorized} />;
    case "daily-report":
      return <DailyReportPage onUnauthorized={onUnauthorized} />;
    case "user-management":
      return <UserManagementPage currentUser={user} onUnauthorized={onUnauthorized} />;
    case "merge-ej":
      return <MergeEjPage onUnauthorized={onUnauthorized} />;
    case "ej-parsing":
      return <EjParsingPage onUnauthorized={onUnauthorized} />;
  }
}

function Sidebar({
  menu,
  route,
  onNavigate,
}: {
  menu: MenuItem[];
  route: Route;
  onNavigate: (route: Route) => void;
}) {
  // Groups start open when one of their submenus is the current page
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <nav className="sidebar" aria-label="Menu utama">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          EJ
        </span>
        EJ Dashboard
      </div>
      <ul>
        {menu.map((item) => {
          if (!("children" in item)) {
            return (
              <li key={item.route}>
                <MenuButton active={route === item.route} onClick={() => onNavigate(item.route)}>
                  <MenuLabel icon={item.icon} label={item.label} />
                </MenuButton>
              </li>
            );
          }
          const isOpen = open[item.label] ?? item.children.some((c) => c.route === route);
          return (
            <li key={item.label}>
              <button
                className="menu-item group"
                aria-expanded={isOpen}
                onClick={() => setOpen({ ...open, [item.label]: !isOpen })}
              >
                <MenuLabel icon={item.icon} label={item.label} />
                <span className="chevron" aria-hidden>
                  {isOpen ? "▾" : "▸"}
                </span>
              </button>
              {isOpen && (
                <ul className="submenu">
                  {item.children.map((child) => (
                    <li key={child.route}>
                      <MenuButton active={route === child.route} onClick={() => onNavigate(child.route)}>
                        <MenuLabel icon={child.icon} label={child.label} />
                      </MenuButton>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MenuLabel({ icon, label }: { icon: IconName; label: string }) {
  return (
    <span className="menu-label">
      <Icon name={icon} />
      {label}
    </span>
  );
}

function MenuButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className={`menu-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined} onClick={onClick}>
      {children}
    </button>
  );
}
