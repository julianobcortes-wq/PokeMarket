"use client";

import { ColorType, createChart, LineSeries } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

const RANGES = ["7d", "30d", "3m", "6m", "1y", "3y", "5y", "max"] as const;
const LOCKED = new Set(["6m", "1y", "3y", "5y", "max"]);

type Point = { at: string; priceMinor: number };

export function PricePanel({
  printingId,
  condition,
  gradeKey,
  currency,
  initialPoints,
  paywall,
  paywallCta,
  empty,
  note,
}: {
  printingId: string;
  condition: string;
  gradeKey: string;
  currency: string | null;
  initialPoints: Point[];
  paywall: string;
  paywallCta: string;
  empty: string;
  note: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState(initialPoints);
  const [active, setActive] = useState("3m");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current || points.length === 0) return;
    const chart = createChart(ref.current, {
      height: 300,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#6b645c",
        fontFamily: "IBM Plex Mono, ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: "rgba(120,110,100,0.16)" },
        horzLines: { color: "rgba(120,110,100,0.16)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    const series = chart.addSeries(LineSeries, { color: "#a83a2a", lineWidth: 2 });
    series.setData(
      points.map((point) => ({
        time: point.at,
        value: currency === "JPY" ? point.priceMinor : point.priceMinor / 100,
      })),
    );
    chart.timeScale().fitContent();
    const box = ref.current;
    const observer = new ResizeObserver(() => chart.applyOptions({ width: box.clientWidth }));
    observer.observe(box);
    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [points, currency]);

  async function select(range: string) {
    const response = await fetch(
      `/api/v1/products/${encodeURIComponent(printingId)}/price-history?range=${range}&condition=${condition}&gradeKey=${encodeURIComponent(gradeKey)}&market=BR`,
    );
    const body = await response.json();
    if (response.status === 403) {
      setMessage(paywall);
      return;
    }
    setMessage(null);
    setActive(range);
    setPoints(body.points ?? []);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {RANGES.map((range) => (
          <button
            key={range}
            type="button"
            onClick={() => select(range)}
            className={`border px-2 py-1 font-mono text-xs ${active === range ? "border-ink bg-ink text-paper" : "border-line"}`}
          >
            {range === "3m" ? "3m" : range}
            {LOCKED.has(range) ? " · Pro" : ""}
          </button>
        ))}
      </div>
      {message ? (
        <div className="mt-4 border border-stamp bg-panel p-4">
          <p>{message}</p>
          <a href="/planos?origem=grafico" className="mt-3 inline-flex bg-stamp px-3 py-2 text-sm text-white">
            {paywallCta}
          </a>
        </div>
      ) : null}
      {points.length === 0 ? <p className="mt-4 text-muted">{empty}</p> : <div ref={ref} className="mt-4 h-[300px] w-full" />}
      <p className="mt-2 font-mono text-[11px] text-muted">{note}</p>
    </div>
  );
}
