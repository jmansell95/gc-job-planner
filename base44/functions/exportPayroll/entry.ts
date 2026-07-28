import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// exportPayroll — exports approved weekly-summary timesheets to a
// payroll provider (CSV / Xero / Sage 50 format).
// ============================================================
// Generates a payroll file from approved weekly summary timesheets
// (status='approved', is_weekly_summary=true, payroll_export_id not set),
// marks them as exported (locks from re-export), and returns the file
// as a downloadable blob.
//
// Config is stored in AppSetting keyed 'payroll_config':
//   { provider: 'csv'|'xero'|'sage', pay_element_standard, pay_element_overtime,
//     lock_after_export: true }
//
// Payload: { action: "generate" } — returns the file blob.
//          { action: "preview" } — returns JSON of the rows without exporting.

const REASON_TO_PAY_ELEMENT: Record<string, string> = {};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') return Response.json({ ok: false, error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'generate';

    // Load payroll config
    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'payroll_config' });
    const cfg = settings[0]?.value || {};
    const provider = cfg.provider || 'csv';
    const standardElement = cfg.pay_element_standard || 'Basic Salary';
    const overtimeElement = cfg.pay_element_overtime || 'Overtime';
    const lockAfterExport = cfg.lock_after_export !== false;

    // Load approved weekly summary timesheets not yet exported
    let timesheets: any[] = [];
    try {
      timesheets = await base44.asServiceRole.entities.Timesheet.filter(
        { status: 'approved', is_weekly_summary: true },
        '-week_start',
        500,
      );
    } catch (_) {}
    // Filter out already-exported (payroll_export_id set) client-side since
    // not all filter backends support the negative — or we keep it simple
    const pending = timesheets.filter((t: any) => !t.payroll_export_id);

    if (pending.length === 0) {
      return Response.json({ ok: false, message: 'No approved weekly timesheets pending export.' }, { status: 200 });
    }

    // Load staff for name/email
    const allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500);
    const staffMap: Record<string, any> = {};
    for (const s of allStaff) staffMap[s.id] = s;

    // Build payroll rows
    const rows: any[] = [];
    for (const t of pending) {
      const staff = staffMap[t.staff_id];
      if (!staff) continue;
      const stdHours = Math.round((Number(t.weekly_standard_minutes) || 0) / 60 * 100) / 100;
      const otHours = Math.round((Number(t.weekly_overtime_minutes) || 0) / 60 * 100) / 100;
      rows.push({
        employee_ref: staff.email || staff.name || t.staff_id,
        employee_name: staff.name || '',
        week_start: t.week_start,
        standard_hours: stdHours,
        overtime_hours: otHours,
        standard_pay_element: standardElement,
        overtime_pay_element: overtimeElement,
        meterage: t.weekly_meterage || 0,
        approved_by: t.approved_by_name || '',
      });
    }

    if (action === 'preview') {
      return Response.json({ ok: true, count: rows.length, rows });
    }

    // Generate CSV (works for all three providers — Xero & Sage import CSV)
    const csvLines: string[] = [];
    const header = provider === 'xero'
      ? ['EmployeeName', 'PayrollCalendar', 'PayRunType', 'EarningsType', 'Hours', 'DatePaid']
      : provider === 'sage'
      ? ['EmployeeRef', 'EmployeeName', 'PayElement', 'Hours', 'WeekStart']
      : ['EmployeeRef', 'EmployeeName', 'WeekStart', 'StandardHours', 'StandardPayElement', 'OvertimeHours', 'OvertimePayElement', 'Meterage', 'ApprovedBy'];
    csvLines.push(header.map(h => `"${h}"`).join(','));

    for (const r of rows) {
      if (provider === 'xero') {
        if (r.standard_hours > 0) csvLines.push(`"${r.employee_name}","Weekly","OvertimeEarnings","${r.standard_pay_element}","${r.standard_hours}","${r.week_start}"`);
        if (r.overtime_hours > 0) csvLines.push(`"${r.employee_name}","Weekly","OvertimeEarnings","${r.overtime_pay_element}","${r.overtime_hours}","${r.week_start}"`);
      } else if (provider === 'sage') {
        if (r.standard_hours > 0) csvLines.push(`"${r.employee_ref}","${r.employee_name}","${r.standard_pay_element}","${r.standard_hours}","${r.week_start}"`);
        if (r.overtime_hours > 0) csvLines.push(`"${r.employee_ref}","${r.employee_name}","${r.overtime_pay_element}","${r.overtime_hours}","${r.week_start}"`);
      } else {
        csvLines.push(`"${r.employee_ref}","${r.employee_name}","${r.week_start}","${r.standard_hours}","${r.standard_pay_element}","${r.overtime_hours}","${r.overtime_pay_element}","${r.meterage}","${r.approved_by}"`);
      }
    }

    const csv = csvLines.join('\n');
    const batchId = `PAYROLL-${Date.now()}`;
    const now = new Date().toISOString();

    // Lock exported records
    if (lockAfterExport) {
      for (const t of pending) {
        try {
          await base44.asServiceRole.entities.Timesheet.update(t.id, {
            payroll_export_id: batchId,
            payroll_exported_at: now,
          });
        } catch (_) {}
      }
    }

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payroll-export-${batchId}.csv"`,
      },
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}