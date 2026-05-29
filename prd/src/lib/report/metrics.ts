export interface MetricChange {
  absolute: number;
  percent: number | null;
}

const integerFormatter = new Intl.NumberFormat("bg-BG");
const currencyFormatter = new Intl.NumberFormat("bg-BG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNumber(value: number) {
  return integerFormatter.format(value);
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatPosition(value: number) {
  return value.toFixed(1);
}

export function formatCurrency(value: number) {
  return `${currencyFormatter.format(value)} лв.`;
}

export function formatRatio(value: number) {
  return `${value.toFixed(2)}x`;
}

export function formatMetricChange(change: MetricChange) {
  if (change.percent === null) {
    return `${change.absolute >= 0 ? "+" : ""}${formatNumber(change.absolute)}`;
  }

  return `${change.percent >= 0 ? "+" : ""}${(change.percent * 100).toFixed(1)}%`;
}

export function calculateCtr(clicks: number, impressions: number) {
  return impressions > 0 ? clicks / impressions : 0;
}

export function calculateCpa(spend: number, conversions: number) {
  return conversions > 0 ? spend / conversions : 0;
}

export function calculateRoas(value: number, spend: number) {
  return spend > 0 ? value / spend : 0;
}

export function calculateMetricChange(current: number, previous?: number): MetricChange | undefined {
  if (previous === undefined) return undefined;

  return {
    absolute: current - previous,
    percent: previous === 0 ? null : (current - previous) / previous,
  };
}
