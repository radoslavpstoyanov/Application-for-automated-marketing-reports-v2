import { EmptyDataNotice } from "@/components/report/ReportUI";

export interface GscTrendPoint {
  date: string;
  clicks: number;
}

export interface Ga4Channel {
  channel: string;
  sessions: number;
}

export interface MetricTrendPoint {
  date: string;
  value: number;
}

export function SearchConsoleChart({ accentColor, trend }: { accentColor: string; trend: GscTrendPoint[] }) {
  if (trend.length === 0) return <EmptyDataNotice />;

  const maxClicks = Math.max(...trend.map((point) => point.clicks), 1);
  const points = trend.map((point, index) => ({
    x: 50 + (trend.length === 1 ? 200 : (index * 400) / (trend.length - 1)),
    y: 170 - (point.clicks / maxClicks) * 140,
    label: point.date.slice(5).split("-").reverse().join("."),
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `50,170 ${line} ${points[points.length - 1].x},170`;
  const labelIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]));

  return (
    <svg viewBox="0 0 500 200" style={{ width: "100%", height: "auto", overflow: "visible" }}>
      <line x1="50" y1="30" x2="450" y2="30" stroke="#f1f5f9" strokeWidth="1" />
      <line x1="50" y1="100" x2="450" y2="100" stroke="#f1f5f9" strokeWidth="1" />
      <line x1="50" y1="170" x2="450" y2="170" stroke="#cbd5e1" strokeWidth="1" />
      <polygon points={area} fill={accentColor} opacity="0.15" />
      <polyline points={line} fill="none" stroke={accentColor} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point) => (
        <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="3" fill="#fff" stroke={accentColor} strokeWidth="2" />
      ))}
      {labelIndexes.map((index) => (
        <text key={points[index].label} x={points[index].x} y="190" fontSize="10" fill="#94a3b8" textAnchor="middle">
          {points[index].label}
        </text>
      ))}
    </svg>
  );
}

export function AnalyticsChart({ accentColor, channels }: { accentColor: string; channels: Ga4Channel[] }) {
  if (channels.length === 0) return <EmptyDataNotice />;

  const maxSessions = Math.max(...channels.map((channel) => channel.sessions), 1);
  const columnWidth = 55;

  return (
    <svg viewBox="0 0 500 200" style={{ width: "100%", height: "auto", overflow: "visible" }}>
      <line x1="35" y1="170" x2="470" y2="170" stroke="#cbd5e1" strokeWidth="1" />
      {channels.slice(0, 4).map((channel, index) => {
        const x = 60 + index * 102;
        const height = (channel.sessions / maxSessions) * 125;
        return (
          <g key={channel.channel}>
            <rect x={x} y={170 - height} width={columnWidth} height={height} rx="4" fill={accentColor} />
            <text x={x + columnWidth / 2} y="188" fontSize="9" fill="#64748b" textAnchor="middle">
              {channel.channel.length > 13 ? `${channel.channel.slice(0, 12)}...` : channel.channel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function formatTrendDate(date: string) {
  if (date.length === 8 && !date.includes("-")) {
    return `${date.slice(6, 8)}.${date.slice(4, 6)}`;
  }

  return date.slice(5).split("-").reverse().join(".");
}

export function MetricTrendChart({ accentColor, points }: { accentColor: string; points: MetricTrendPoint[] }) {
  if (points.length === 0) return <EmptyDataNotice />;

  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const plotted = points.map((point, index) => ({
    x: 50 + (points.length === 1 ? 200 : (index * 400) / (points.length - 1)),
    y: 170 - (point.value / maxValue) * 140,
    label: formatTrendDate(point.date),
  }));
  const line = plotted.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `50,170 ${line} ${plotted[plotted.length - 1].x},170`;
  const labelIndexes = Array.from(new Set([0, Math.floor((plotted.length - 1) / 2), plotted.length - 1]));

  return (
    <svg viewBox="0 0 500 200" style={{ width: "100%", height: "auto", overflow: "visible" }}>
      <line x1="50" y1="30" x2="450" y2="30" stroke="#f1f5f9" strokeWidth="1" />
      <line x1="50" y1="100" x2="450" y2="100" stroke="#f1f5f9" strokeWidth="1" />
      <line x1="50" y1="170" x2="450" y2="170" stroke="#cbd5e1" strokeWidth="1" />
      <polygon points={area} fill={accentColor} opacity="0.15" />
      <polyline points={line} fill="none" stroke={accentColor} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
      {plotted.map((point) => (
        <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="3" fill="#fff" stroke={accentColor} strokeWidth="2" />
      ))}
      {labelIndexes.map((index) => (
        <text key={plotted[index].label} x={plotted[index].x} y="190" fontSize="10" fill="#94a3b8" textAnchor="middle">
          {plotted[index].label}
        </text>
      ))}
    </svg>
  );
}
