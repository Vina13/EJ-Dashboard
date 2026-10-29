import { useEffect, useState } from "react";
import { canAccess, type EjMenu, type EjRole } from "@repo/shared";
import type { IconName } from "./icons";

// Menus from the FSD use case diagram (Gambar 3.8) and flowcharts (Gambar 3.2–3.4)
export type Route = EjMenu;

export interface MenuLink {
  route: Route;
  label: string;
  icon: IconName;
}

export interface MenuGroup {
  label: string;
  icon: IconName;
  children: MenuLink[];
}

export type MenuItem = MenuLink | MenuGroup;

export const MENU: MenuItem[] = [
  { route: "home", label: "Home", icon: "home" },
  { route: "daily-report", label: "Daily Report & Performance", icon: "chart" },
  { label: "User", icon: "users", children: [{ route: "user-management", label: "User Management", icon: "user" }] },
  { route: "merge-ej", label: "Merge EJ", icon: "merge" },
];

/** MENU without the menus `role` may not open (FSD Tabel 6.1); a group left empty is dropped. */
export function menuFor(role: EjRole): MenuItem[] {
  return MENU.flatMap((item): MenuItem[] => {
    if (!("children" in item)) return canAccess(role, item.route) ? [item] : [];
    const children = item.children.filter((c) => canAccess(role, c.route));
    return children.length > 0 ? [{ ...item, children }] : [];
  });
}

const ROUTES = new Set<string>(
  MENU.flatMap((item) => ("children" in item ? item.children.map((c) => c.route) : [item.route])),
);

export function labelOf(route: Route): string {
  for (const item of MENU) {
    if ("children" in item) {
      const child = item.children.find((c) => c.route === route);
      if (child) return child.label;
    } else if (item.route === route) {
      return item.label;
    }
  }
  return route;
}

/** null when the hash names no menu; App then shows the landing page of the logged-in role. */
function parseHash(hash: string): Route | null {
  const name = hash.replace(/^#\/?/, "");
  return ROUTES.has(name) ? (name as Route) : null;
}

/** The current page lives in the URL hash (#/user-management), so a reload stays on the same menu. */
export function useHashRoute(): [Route | null, (route: Route) => void] {
  const [route, setRoute] = useState<Route | null>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  function navigate(next: Route) {
    window.location.hash = `/${next}`;
    setRoute(next);
  }

  return [route, navigate];
}
