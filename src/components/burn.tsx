import type { Forecast } from '@/lib/billing';

export function BurnBar({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-slate-400">No budget</span>;
  const color = pct > 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Budget burn">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="w-14 text-right text-xs tabular-nums text-slate-600">{pct}%</span>
    </div>
  );
}

export function ForecastFlag({ forecast }: { forecast: Forecast | null }) {
  if (!forecast) return <span className="text-xs text-slate-400" title="Needs a budget plus start and end dates">—</span>;
  return forecast.overrun ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200" data-testid="forecast-overrun">
      ▲ On track for {forecast.projectedPct}%
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
      On pace ({forecast.projectedPct}%)
    </span>
  );
}
