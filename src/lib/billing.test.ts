import { describe, it, expect } from 'vitest';
import {
  invoiceTotal,
  budgetBurn,
  forecastOverrun,
  elapsedRatio,
  applyTax,
  invoiceLines,
  revenueSummary,
  projectHealth,
  nextInvoiceStatus,
  nextProjectStatus,
} from './billing';

describe('invoiceTotal', () => {
  it('sums billable hours × rate and applies tax', () => {
    const entries = [{ hours: 2, billable: true }, { hours: 3, billable: true }, { hours: 4, billable: false }];
    expect(invoiceTotal(entries, 50, 16)).toBe(290); // 5h × 50 = 250, +16% = 290
  });
  it('returns 0 for no billable hours', () => {
    expect(invoiceTotal([{ hours: 4, billable: false }], 50, 0)).toBe(0);
  });
  it('rounds to cents without floating-point drift', () => {
    expect(invoiceTotal([{ hours: 0.1, billable: true }, { hours: 0.2, billable: true }], 33.33, 0)).toBe(10);
    expect(invoiceTotal([{ hours: 1.25, billable: true }], 99.99, 7.5)).toBe(134.36);
  });
});

describe('applyTax', () => {
  it('adds the tax percentage and rounds to cents', () => {
    expect(applyTax(100, 16)).toBe(116);
    expect(applyTax(10.005, 0)).toBe(10.01);
  });
});

describe('invoiceLines', () => {
  it('groups billable entries by project with each project rate', () => {
    const lines = invoiceLines([
      { hours: 2, billable: true, projectId: 'a', projectName: 'Site', rate: 50 },
      { hours: 1.5, billable: true, projectId: 'b', projectName: 'App', rate: 80 },
      { hours: 3, billable: true, projectId: 'a', projectName: 'Site', rate: 50 },
      { hours: 9, billable: false, projectId: 'a', projectName: 'Site', rate: 50 },
    ]);
    expect(lines).toEqual([
      { projectId: 'a', projectName: 'Site', hours: 5, rate: 50, amount: 250 },
      { projectId: 'b', projectName: 'App', hours: 1.5, rate: 80, amount: 120 },
    ]);
  });
});

describe('budgetBurn', () => {
  it('returns percent of budget used', () => expect(budgetBurn(30, 40)).toBe(75));
  it('handles missing budget', () => expect(budgetBurn(10, null)).toBeNull());
  it('can exceed 100%', () => expect(budgetBurn(50, 40)).toBe(125));
  it('rounds to one decimal', () => expect(budgetBurn(1, 3)).toBe(33.3));
});

describe('forecastOverrun', () => {
  it('flags a project burning faster than its timeline', () => {
    // 50% of the time elapsed, 80% of hours used → projected 160%
    expect(forecastOverrun({ hoursUsed: 32, budgetHours: 40, elapsedRatio: 0.5 })).toEqual({ projectedPct: 160, overrun: true });
  });
  it('does not flag a project on pace', () => {
    expect(forecastOverrun({ hoursUsed: 10, budgetHours: 40, elapsedRatio: 0.5 })).toEqual({ projectedPct: 50, overrun: false });
  });
  it('returns null when there is no budget or no time has elapsed', () => {
    expect(forecastOverrun({ hoursUsed: 10, budgetHours: null, elapsedRatio: 0.5 })).toBeNull();
    expect(forecastOverrun({ hoursUsed: 10, budgetHours: 40, elapsedRatio: 0 })).toBeNull();
  });
  it('uses actual burn once the timeline has ended', () => {
    expect(forecastOverrun({ hoursUsed: 44, budgetHours: 40, elapsedRatio: 1 })).toEqual({ projectedPct: 110, overrun: true });
  });
});

describe('elapsedRatio', () => {
  it('returns the share of the timeline that has passed', () => {
    expect(elapsedRatio('2026-01-01', '2026-01-11', '2026-01-06')).toBe(0.5);
  });
  it('clamps before the start and after the end', () => {
    expect(elapsedRatio('2026-01-01', '2026-01-11', '2025-12-01')).toBe(0);
    expect(elapsedRatio('2026-01-01', '2026-01-11', '2026-03-01')).toBe(1);
  });
  it('returns null without both dates or with an empty range', () => {
    expect(elapsedRatio(null, '2026-01-11', '2026-01-06')).toBeNull();
    expect(elapsedRatio('2026-01-11', '2026-01-11', '2026-01-06')).toBeNull();
  });
});

describe('projectHealth', () => {
  const project = { budget_hours: 40, start_date: '2026-01-01', end_date: '2026-01-11' };

  it('sums all logged hours and forecasts against the timeline', () => {
    const health = projectHealth(project, [{ hours: 20 }, { hours: 12 }], '2026-01-06');
    expect(health).toEqual({ hoursUsed: 32, burnPct: 80, forecast: { projectedPct: 160, overrun: true } });
  });

  it('has no forecast without dates or budget', () => {
    expect(projectHealth({ ...project, end_date: null }, [{ hours: 4 }], '2026-01-06').forecast).toBeNull();
    expect(projectHealth({ ...project, budget_hours: null }, [{ hours: 4 }], '2026-01-06')).toEqual({
      hoursUsed: 4,
      burnPct: null,
      forecast: null,
    });
  });
});

describe('revenueSummary', () => {
  it('splits billed revenue by status and prices unbilled hours', () => {
    const summary = revenueSummary(
      [
        { status: 'draft', total: 100 },
        { status: 'sent', total: 200 },
        { status: 'paid', total: 300 },
      ],
      [
        { hours: 2, rate: 50 },
        { hours: 1.5, rate: 80 },
      ],
    );
    expect(summary).toEqual({ billed: 600, paid: 300, outstanding: 300, unbilled: 220 });
  });
});

describe('status transitions', () => {
  it('moves invoices draft → sent → paid and stops', () => {
    expect(nextInvoiceStatus('draft')).toBe('sent');
    expect(nextInvoiceStatus('sent')).toBe('paid');
    expect(nextInvoiceStatus('paid')).toBeNull();
  });
  it('moves projects proposal → active → completed and stops', () => {
    expect(nextProjectStatus('proposal')).toBe('active');
    expect(nextProjectStatus('active')).toBe('completed');
    expect(nextProjectStatus('completed')).toBeNull();
  });
});
