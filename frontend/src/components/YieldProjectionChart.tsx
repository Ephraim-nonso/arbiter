"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useMemo } from "react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

function projectMonthlySeries({
  initial,
  aprPct,
  months,
}: {
  initial: number;
  aprPct: number;
  months: number;
}) {
  const r = aprPct / 100 / 12; // monthly rate
  const values: number[] = [];
  let v = initial;
  for (let i = 0; i <= months; i++) {
    values.push(v);
    v = v * (1 + r);
  }
  return values;
}

export function YieldProjectionChart({
  initialUsdc,
  agentAprPct,
  rewardsAprPct,
  months = 12,
}: {
  initialUsdc: number;
  agentAprPct: number;
  rewardsAprPct: number;
  months?: number;
}) {
  const labels = useMemo(() => {
    const base = ["Now", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan"];
    // Ensure we have months+1 labels (including "Now")
    return base.slice(0, Math.min(base.length, months + 1));
  }, [months]);

  const agent = useMemo(
    () => projectMonthlySeries({ initial: initialUsdc, aprPct: agentAprPct, months }),
    [initialUsdc, agentAprPct, months]
  );

  const total = useMemo(
    () =>
      projectMonthlySeries({
        initial: initialUsdc,
        aprPct: agentAprPct + rewardsAprPct,
        months,
      }),
    [initialUsdc, agentAprPct, rewardsAprPct, months]
  );

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Total APR Projection",
          data: total.slice(0, labels.length),
          borderColor: "rgba(163, 230, 53, 1)", // lime-400-ish
          backgroundColor: "rgba(163, 230, 53, 0.18)",
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.35,
          fill: true,
        },
        {
          label: "Agent APR Projection",
          data: agent.slice(0, labels.length),
          borderColor: "rgba(99, 102, 241, 1)", // indigo-500-ish
          backgroundColor: "rgba(99, 102, 241, 0.10)",
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.35,
          fill: true,
        },
      ],
    }),
    [labels, total, agent]
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: "rgba(120,120,120,1)",
            font: { size: 11, weight: 600 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = Number(ctx.parsed.y ?? 0);
              return `${ctx.dataset.label}: ${v.toFixed(2)} USDC`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "rgba(140,140,140,1)", font: { size: 10 } },
        },
        y: {
          grid: { color: "rgba(0,0,0,0.08)" },
          ticks: {
            color: "rgba(140,140,140,1)",
            font: { size: 10 },
            callback: (v) => `${v} USDC`,
          },
        },
      },
    }),
    []
  );

  return (
    <div className="h-44 w-full">
      <Line data={data} options={options} />
    </div>
  );
}


