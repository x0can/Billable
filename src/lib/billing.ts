// Pure business rules for Billable. No I/O here — everything is unit-tested in billing.test.ts.

export type InvoiceStatus = 'draft' | 'sent' | 'paid';
export type ProjectStatus = 'proposal' | 'active' | 'completed';

export interface BillableEntry {
  hours: number;
  billable: boolean;
}

/** Rounds to cents. toPrecision first absorbs float noise such as 10.005 * 100 = 1000.4999999999999. */
export function roundMoney(value: number): number {
  return Math.round(Number((value * 100).toPrecision(12))) / 100;
}

function roundTo1(value: number): number {
  return Math.round(Number((value * 10).toPrecision(12))) / 10;
}

export function applyTax(subtotal: number, taxPct: number): number {
  return roundMoney(subtotal * (1 + taxPct / 100));
}

/** Billable hours × rate, plus tax. Non-billable entries are ignored. */
export function invoiceTotal(entries: BillableEntry[], rate: number, taxPct: number): number {
  const hours = entries.filter((e) => e.billable).reduce((sum, e) => sum + Number(e.hours), 0);
  return applyTax(hours * rate, taxPct);
}

export interface InvoiceLineInput extends BillableEntry {
  projectId: string;
  projectName: string;
  rate: number;
}

export interface InvoiceLine {
  projectId: string;
  projectName: string;
  hours: number;
  rate: number;
  amount: number;
}

/** One invoice line per project, since projects can have different hourly rates. */
export function invoiceLines(entries: InvoiceLineInput[]): InvoiceLine[] {
  const byProject = new Map<string, InvoiceLine>();
  for (const e of entries) {
    if (!e.billable) continue;
    const line = byProject.get(e.projectId) ?? {
      projectId: e.projectId,
      projectName: e.projectName,
      hours: 0,
      rate: Number(e.rate),
      amount: 0,
    };
    line.hours = roundMoney(line.hours + Number(e.hours));
    line.amount = roundMoney(line.hours * line.rate);
    byProject.set(e.projectId, line);
  }
  return [...byProject.values()];
}

/** Percent of budgeted hours used, or null when the project has no budget. */
export function budgetBurn(hoursUsed: number, budgetHours: number | null): number | null {
  if (budgetHours == null || budgetHours <= 0) return null;
  return roundTo1((hoursUsed / budgetHours) * 100);
}

/** Share of a project's timeline that has passed (0–1), or null without a usable date range. */
export function elapsedRatio(
  startDate: string | null,
  endDate: string | null,
  today: string = new Date().toISOString().slice(0, 10),
): number | null {
  if (!startDate || !endDate) return null;
  const start = Date.parse(startDate);
  const span = Date.parse(endDate) - start;
  if (!(span > 0)) return null;
  return Math.min(1, Math.max(0, (Date.parse(today) - start) / span));
}

export interface Forecast {
  projectedPct: number;
  overrun: boolean;
}

/**
 * Projects final budget use by assuming the current burn rate holds for the rest of the timeline.
 * 80% of hours used at 50% of the timeline projects to 160% — an overrun.
 */
export function forecastOverrun(input: {
  hoursUsed: number;
  budgetHours: number | null;
  elapsedRatio: number | null;
}): Forecast | null {
  const burn = budgetBurn(input.hoursUsed, input.budgetHours);
  if (burn == null || input.elapsedRatio == null || input.elapsedRatio <= 0) return null;
  const projectedPct = roundTo1((input.hoursUsed / input.budgetHours!) * 100 / input.elapsedRatio);
  return { projectedPct, overrun: projectedPct > 100 };
}

export interface ProjectHealth {
  hoursUsed: number;
  burnPct: number | null;
  forecast: Forecast | null;
}

/** Budget burn and overrun forecast for one project, counting every logged hour (billable or not). */
export function projectHealth(
  project: { budget_hours: number | null; start_date: string | null; end_date: string | null },
  entries: { hours: number }[],
  today?: string,
): ProjectHealth {
  const hoursUsed = roundMoney(entries.reduce((sum, e) => sum + Number(e.hours), 0));
  const budgetHours = project.budget_hours == null ? null : Number(project.budget_hours);
  return {
    hoursUsed,
    burnPct: budgetBurn(hoursUsed, budgetHours),
    forecast: forecastOverrun({
      hoursUsed,
      budgetHours,
      elapsedRatio: elapsedRatio(project.start_date, project.end_date, today),
    }),
  };
}

export interface RevenueSummary {
  billed: number;
  paid: number;
  outstanding: number;
  unbilled: number;
}

/** Billed = every invoice total; unbilled = billable hours not yet on an invoice, priced at project rate (pre-tax). */
export function revenueSummary(
  invoices: { status: InvoiceStatus; total: number }[],
  unbilledEntries: { hours: number; rate: number }[],
): RevenueSummary {
  const sum = (xs: number[]) => roundMoney(xs.reduce((a, b) => a + b, 0));
  const billed = sum(invoices.map((i) => Number(i.total)));
  const paid = sum(invoices.filter((i) => i.status === 'paid').map((i) => Number(i.total)));
  return {
    billed,
    paid,
    outstanding: roundMoney(billed - paid),
    unbilled: sum(unbilledEntries.map((e) => Number(e.hours) * Number(e.rate))),
  };
}

const INVOICE_FLOW: InvoiceStatus[] = ['draft', 'sent', 'paid'];
const PROJECT_FLOW: ProjectStatus[] = ['proposal', 'active', 'completed'];

export function nextInvoiceStatus(status: InvoiceStatus): InvoiceStatus | null {
  return INVOICE_FLOW[INVOICE_FLOW.indexOf(status) + 1] ?? null;
}

export function nextProjectStatus(status: ProjectStatus): ProjectStatus | null {
  return PROJECT_FLOW[PROJECT_FLOW.indexOf(status) + 1] ?? null;
}
