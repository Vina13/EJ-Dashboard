// Inline stroke icons (Lucide-style, 24px grid) so the sidebar needs no icon package.
export type IconName = "home" | "chart" | "users" | "user" | "merge" | "parse" | "upload" | "menu";

const PATHS: Record<IconName, string[]> = {
  home: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h5v-6h4v6h5V9.5"],
  chart: ["M21 12A9 9 0 1 1 12 3", "M21 12A9 9 0 0 0 12 3v9z"],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  user: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  // A document with text lines (EJ Parsing) and an arrow into a tray (Upload)
  parse: ["M14 3H6v18h12V7z", "M14 3v4h4", "M9 12h6", "M9 16h6"],
  upload: ["M12 15V3", "M7 8l5-5 5 5", "M4 15v5h16v-5"],
  merge: ["M6 3v12", "M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M18 9a9 9 0 0 1-9 9"],
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
