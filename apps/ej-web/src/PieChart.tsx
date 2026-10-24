import { useState } from "react";

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

const number = new Intl.NumberFormat("id-ID");
const percent = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/** Point on the unit circle, measured clockwise from 12 o'clock. */
function point(fraction: number): [number, number] {
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  return [Math.cos(angle), Math.sin(angle)];
}

function slicePath(start: number, end: number): string {
  const [x1, y1] = point(start);
  const [x2, y2] = point(end);
  const largeArc = end - start > 0.5 ? 1 : 0;
  return `M0 0L${x1} ${y1}A1 1 0 ${largeArc} 1 ${x2} ${y2}Z`;
}

/** Pie with a legend that names every slice, so identity never relies on color alone. */
export function PieChart({ title, slices }: { title: string; slices: PieSlice[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const share = (value: number) => (total === 0 ? 0 : (value / total) * 100);

  let cursor = 0;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const start = cursor;
      cursor += s.value / total;
      return { ...s, start, end: cursor };
    });

  return (
    <div className="pie">
      <svg className="pie-chart" viewBox="-1.05 -1.05 2.1 2.1" role="img" aria-label={title}>
        {arcs.map((a) => {
          const props = {
            fill: a.color,
            className: hovered && hovered !== a.label ? "pie-slice dimmed" : "pie-slice",
            onMouseEnter: () => setHovered(a.label),
            onMouseLeave: () => setHovered(null),
          };
          const tooltip = <title>{`${a.label}: ${number.format(a.value)} (${percent.format(share(a.value))}%)`}</title>;
          // A lone slice is a full circle, which an arc path cannot draw
          return arcs.length === 1 ? (
            <circle key={a.label} r="1" {...props}>
              {tooltip}
            </circle>
          ) : (
            <path key={a.label} d={slicePath(a.start, a.end)} {...props}>
              {tooltip}
            </path>
          );
        })}
      </svg>
      <ul className="pie-legend">
        {slices.map((s) => (
          <li
            key={s.label}
            className={hovered === s.label ? "active" : undefined}
            onMouseEnter={() => setHovered(s.label)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="swatch" style={{ background: s.color }} aria-hidden />
            <span className="pie-legend-label">{s.label}</span>
            <span className="num">{number.format(s.value)}</span>
            <span className="num muted">{percent.format(share(s.value))}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
