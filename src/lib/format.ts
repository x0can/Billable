const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatMoney(value: number | string | null | undefined): string {
  return money.format(Number(value ?? 0));
}

export function formatHours(value: number | string | null | undefined): string {
  return `${Number(value ?? 0).toFixed(2)}h`;
}
