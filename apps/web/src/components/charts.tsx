"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { TrustLevel } from "@/server/services/dashboards";

type Point = { date: string; value: number; trust: TrustLevel; event?: string | null };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

const C = {
  grid: "#1e2b42",
  axis: "#34465f",
  label: "#94a3b8",
  text: "#f8fafc",
  accent: "#ff8a3d",
  planned: "#1e2d48",
  goal: "#22c55e",
  bg: "#111b2e",
};

/** Draws at the container's real pixel width so labels stay readable on phones. */
function useWidth(fallback = 560) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * Trend line for one metric. For lower-is-better metrics the axis is flipped so
 * improvement always points up. Verified results are filled dots; self-reported
 * and pending ones are hollow.
 */
export function TrendChart({ points, unit, decimals, lowerIsBetter, goal, title }: {
  points: Point[]; unit: string; decimals: number; lowerIsBetter: boolean; goal?: number; title: string;
}) {
  const [ref, W] = useWidth();
  if (points.length < 2) return <p className="muted" style={{ fontSize: 14 }}>Two or more results are needed to draw a trend.</p>;
  const narrow = W < 460;
  const H = narrow ? 210 : 240, L = 46, R = 16, T = 24, B = 30;
  const values = points.map((p) => p.value).concat(goal !== undefined ? [goal] : []);
  let lo = Math.min(...values), hi = Math.max(...values);
  const pad = (hi - lo) * 0.12 || 1;
  lo -= pad; hi += pad;
  const x = (i: number) => L + (i / (points.length - 1)) * (W - L - R);
  // Better values sit higher on the chart either way.
  const y = (v: number) => (lowerIsBetter ? T + ((v - lo) / (hi - lo)) * (H - T - B) : H - B - ((v - lo) / (hi - lo)) * (H - T - B));
  const ticks = Array.from({ length: 4 }, (_, i) => lo + pad + ((hi - lo - 2 * pad) * i) / 3);
  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.value - first.value;
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  const summary = `${title}: from ${first.value.toFixed(decimals)} ${unit} on ${short(first.date)} to ${last.value.toFixed(decimals)} ${unit} on ${short(last.date)}, ${improved ? "an improvement" : "no improvement"}.`;
  const maxLabels = Math.max(2, Math.floor((W - L - R) / 64));
  const every = Math.ceil(points.length / maxLabels);
  const lastX = x(points.length - 1);

  return (
    <figure style={{ margin: 0 }}>
      <div ref={ref} style={{ width: "100%" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} style={{ display: "block", maxWidth: "100%" }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={C.grid} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11.5" fill={C.label}>{t.toFixed(decimals)}</text>
            </g>
          ))}
          {goal !== undefined ? (
            <g>
              <line x1={L} x2={W - R} y1={y(goal)} y2={y(goal)} stroke={C.goal} strokeDasharray="4 4" />
              <text x={L + 6} y={y(goal) - 6} fontSize="11.5" fill={C.goal}>Goal {goal.toFixed(decimals)} {unit}</text>
            </g>
          ) : null}
          <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => {
            const solid = p.trust === "COACH_VERIFIED" || p.trust === "ANCHORED";
            return (
              <g key={p.date + i}>
                <circle cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 5.5 : 4} fill={solid ? C.accent : C.bg} stroke={C.accent} strokeWidth="2">
                  <title>{`${short(p.date)}: ${p.value.toFixed(decimals)} ${unit} — ${p.trust.replace("_", " ").toLowerCase()}`}</title>
                </circle>
                {(i % every === 0 && (i === 0 || x(i) < lastX - 56)) || i === points.length - 1 ? (
                  <text x={x(i)} y={H - 8} textAnchor={i === points.length - 1 ? "end" : i === 0 ? "start" : "middle"} fontSize="11.5" fill={C.label}>{short(p.date)}</text>
                ) : null}
              </g>
            );
          })}
          <text x={Math.min(lastX, W - R)} y={y(last.value) - 12} textAnchor="end" fontSize="13" fontWeight="650" fill={C.text}>
            {last.value.toFixed(decimals)} {unit}
          </text>
        </svg>
      </div>
      <figcaption className="chart-note" style={{ marginTop: 6 }}>
        {lowerIsBetter ? "Lower is better, so the axis is flipped and improvement points up. " : ""}
        Filled dots are coach verified; hollow dots are self-reported or awaiting review.
      </figcaption>
    </figure>
  );
}

/** Sessions attended per week against sessions planned. */
export function WeeklyBars({ weeks, label }: { weeks: { week: string; value: number; max: number }[]; label: string }) {
  const [ref, W] = useWidth();
  if (!weeks.length) return <p className="muted" style={{ fontSize: 14 }}>No sessions in the last 12 weeks.</p>;
  const H = 168, L = 4, R = 4, T = 10, B = 26;
  const top = Math.max(...weeks.map((w) => w.max), 1);
  const bw = (W - L - R) / weeks.length;
  const gap = Math.min(8, bw * 0.28);
  const every = Math.ceil(weeks.length / Math.max(2, Math.floor(W / 70)));
  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ display: "block", maxWidth: "100%" }}>
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={C.axis} />
        {weeks.map((w, i) => {
          const h = ((H - T - B) * w.value) / top;
          const hp = ((H - T - B) * w.max) / top;
          return (
            <g key={w.week}>
              <rect x={L + i * bw + gap / 2} y={H - B - hp} width={bw - gap} height={hp} rx="4" fill={C.planned} />
              <rect x={L + i * bw + gap / 2} y={H - B - h} width={bw - gap} height={h} rx="4" fill={C.accent}>
                <title>{`Week of ${short(w.week)}: ${w.value} of ${w.max}`}</title>
              </rect>
              {i % every === 0 ? (
                <text x={L + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="11.5" fill={C.label}>{short(w.week)}</text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
