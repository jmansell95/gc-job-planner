import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Mail, Save, Send, Loader2, Truck, UserCheck, Clock, Palette, RotateCcw, Eye, Sparkles, Type, Calendar, UserPlus, CalendarX, AlertTriangle, Briefcase, ClipboardCheck, Wrench, GraduationCap, Bell, ShieldCheck, Coffee, ListChecks, Flag } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const ALERT_META = {
  vehicle_maintenance: {
    title: 'Vehicle Maintenance Alert',
    desc: 'Emails admins about upcoming or overdue vehicle MOT and service dates.',
    schedule: 'Runs automatically every Monday at 7:00 AM',
    icon: Truck,
    showThreshold: true,
    showRecipients: true,
    tokens: ['{alert_count}', '{alert_list}'],
  },
  assignment_notification: {
    title: 'Job Assignment Notification',
    desc: 'Emails a staff member when they are assigned to a job on the rota.',
    schedule: 'Runs automatically when a rota assignment is created',
    icon: UserCheck,
    showThreshold: false,
    showRecipients: false,
    tokens: ['{staff_name}', '{job_name}', '{location}', '{date}', '{job_type}', '{notes}'],
  },
  staff_schedule: {
    title: 'Weekly Staff Schedule',
    desc: 'Emails each staff member their personal schedule when you submit the weekly rota.',
    schedule: 'Sent when you submit the rota from the Rota Builder',
    icon: Calendar,
    showThreshold: false,
    showRecipients: false,
    tokens: ['{staff_name}', '{week_start}', '{assignment_count}'],
  },
  staff_invitation: {
    title: 'App Invitation',
    desc: 'Branded invitation email sent to a staff member when you give them app access.',
    schedule: 'Sent when you invite a staff member from Staff Management',
    icon: UserPlus,
    showThreshold: false,
    showRecipients: false,
    tokens: ['{staff_name}', '{email}'],
  },
  absence_request: {
    title: 'Absence Request',
    desc: 'Emails managers/admins when a staff member requests time off.',
    schedule: 'Runs automatically when an absence request is submitted',
    icon: CalendarX,
    showThreshold: false,
    showRecipients: false,
    tokens: ['{staff_name}', '{start_date}', '{end_date}', '{reason}', '{notes}'],
  },
  job_status_change: {
    title: 'Job Status Change',
    desc: 'Emails admins when a job is put on hold, cancelled, completed or reactivated.',
    schedule: 'Runs automatically when a job status changes',
    icon: AlertTriangle,
    showThreshold: false,
    showRecipients: false,
    tokens: ['{job_name}', '{location}', '{old_status}', '{new_status}'],
  },
  new_job: {
    title: 'New Job Alert',
    desc: 'Emails admins when a new job is created in the planner.',
    schedule: 'Runs automatically when a new job is added',
    icon: Briefcase,
    showThreshold: false,
    showRecipients: false,
    tokens: ['{job_name}', '{location}', '{job_type}', '{start_date}', '{end_date}', '{job_reference}'],
  },
  timesheet_submitted: {
    title: 'Timesheet Submission',
    desc: 'Emails managers/admins when a staff member submits a timesheet for approval.',
    schedule: 'Runs automatically when a timesheet is submitted',
    icon: ClipboardCheck,
    showThreshold: false,
    showRecipients: false,
    tokens: ['{staff_name}', '{job_name}', '{date}', '{hours}', '{task_description}', '{notes}'],
  },
  maintenance_booking: {
    title: 'Maintenance Booking',
    desc: 'Emails a staff member when they are assigned to a vehicle maintenance booking.',
    schedule: 'Sent when you assign staff to a maintenance booking',
    icon: Wrench,
    showThreshold: false,
    showRecipients: false,
    tokens: ['{staff_name}', '{vehicle_name}', '{booking_type}', '{booking_date}', '{booking_time}', '{supplier_name}', '{supplier_phone}', '{location}', '{notes}'],
  },
  training_booking: {
    title: 'Training Booking',
    desc: 'Emails a staff member when they are booked onto a training course.',
    schedule: 'Sent when you book staff onto a training course',
    icon: GraduationCap,
    showThreshold: false,
    showRecipients: false,
    tokens: ['{staff_name}', '{course_title}', '{start_date}', '{end_date}', '{start_time}', '{end_time}', '{venue}', '{address}', '{provider}', '{provider_phone}', '{description}'],
  },
  daily_reminder: {
    title: 'Daily Schedule Reminder',
    desc: 'Emails each staff member their assignments first thing in the morning.',
    schedule: 'Runs automatically every weekday at 5:00 AM',
    icon: Bell,
    showThreshold: false,
    showRecipients: false,
    tokens: ['{staff_name}', '{today_date}', '{assignment_list}'],
  },
  compliance_expiry: {
    title: 'Compliance Expiry Alert',
    desc: 'Emails admins about expired or soon-to-expire compliance items (staff, vehicles, equipment).',
    schedule: 'Runs automatically every day at 8:00 AM',
    icon: ShieldCheck,
    showThreshold: true,
    showRecipients: true,
    tokens: ['{alert_count}', '{alert_list}'],
  },
  daily_standup: {
    title: 'Daily Stand-up Digest',
    desc: 'Emails admins a morning digest of crew on site, rig maintenance alerts, critical safety actions and vehicle alerts.',
    schedule: 'Runs automatically every weekday at 7:00 AM',
    icon: Coffee,
    showThreshold: false,
    showRecipients: true,
    tokens: ['{date}', '{crew_on_site}', '{active_jobs}', '{rig_alert_count}', '{rig_alerts}', '{safety_action_count}', '{safety_actions}', '{vehicle_alert_count}', '{vehicle_alerts}'],
  },
  timesheet_summary: {
    title: 'Daily Timesheet Summary',
    desc: 'Emails managers/admins a summary of who has submitted, is in progress, or has not started their timesheet today.',
    schedule: 'Runs automatically every weekday at 5:00 PM',
    icon: ListChecks,
    showThreshold: false,
    showRecipients: false,
    tokens: ['{date}', '{submitted_count}', '{in_progress_count}', '{not_started_count}', '{submitted_list}', '{in_progress_list}', '{not_started_list}'],
  },
  milestone_push: {
    title: 'Milestone Completion',
    desc: 'Emails the project manager when an investigation log is approved and published to the client portal.',
    schedule: 'Runs automatically when a manager approves a borehole or pit completion log',
    icon: Flag,
    showThreshold: false,
    showRecipients: false,
    tokens: ['{milestone}', '{job_name}', '{job_reference}', '{location}', '{reviewed_by}', '{borehole_ref}'],
  },
};

const ACCENT_PRESETS = [
  { name: 'Emerald', value: '#0e7a4f' },
  { name: 'Blue', value: '#1d4ed8' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Rose', value: '#be123c' },
  { name: 'Slate', value: '#475569' },
];

const DEFAULT_STYLE = { accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' };

const SUBJECT_PLACEHOLDERS = {
  vehicle_maintenance: 'Vehicle Maintenance Alert',
  assignment_notification: 'New Job Assignment',
  staff_schedule: "John's Weekly Schedule",
  staff_invitation: "You're Invited to GC Job Planner",
  absence_request: 'Absence Request: John Smith',
  job_status_change: 'Job Status Updated: Sample Job',
  new_job: 'New Job Created: Sample Job',
  timesheet_submitted: 'Timesheet Submitted by John Smith',
  maintenance_booking: 'MOT Booking — Van 01',
  training_booking: 'Training Booking — Forklift Training',
  daily_reminder: 'Your Schedule for Today',
  compliance_expiry: 'Compliance Expiry Alert',
  daily_standup: '☀️ Daily Stand-up — 10 Jul 2026',
  timesheet_summary: 'Daily timesheet summary — 2026-07-10',
  milestone_push: 'Milestone completed: BH01 on Sample Job',
};

const TEMPLATE_PLACEHOLDERS = {
  vehicle_maintenance: 'Vehicle Maintenance Report\n\n{alert_list}\n\nPlease schedule maintenance as soon as possible.\n\nGC Job Planner',
  assignment_notification: 'Hello {staff_name},\n\nYou have been assigned to a new job:\n\nJob: {job_name}\nLocation: {location}\nDate: {date}\nJob Type: {job_type}\n{notes}\n\nPlease check your schedule for full details.\n\nGC Job Planner',
  staff_schedule: 'Hi {staff_name}, here is your schedule for the week of {week_start}. You have {assignment_count} assignment(s).',
  staff_invitation: 'Hi {staff_name},\n\nYou have been invited to join the GC Job Planner app. Use the login link sent to {email} to set up your account and start viewing your schedule and logging timesheets.\n\nGC Job Planner',
  absence_request: 'An absence request has been submitted:\n\nStaff: {staff_name}\nFrom: {start_date}\nTo: {end_date}\nReason: {reason}\n{notes}\n\nReview and respond in the planner.\n\nGC Job Planner',
  job_status_change: 'A job status has changed:\n\nJob: {job_name}\nLocation: {location}\nStatus: {old_status} -> {new_status}\n\nView the job in the planner.\n\nGC Job Planner',
  new_job: 'A new job has been created:\n\nJob: {job_name}\nLocation: {location}\nType: {job_type}\nStart: {start_date}\nEnd: {end_date}\nReference: {job_reference}\n\nReview the job in the planner.\n\nGC Job Planner',
  timesheet_submitted: 'A timesheet has been submitted for approval:\n\nStaff: {staff_name}\nJob: {job_name}\nDate: {date}\nHours: {hours}\nTask: {task_description}\nNotes: {notes}\n\nReview and approve it in the planner.\n\nGC Job Planner',
  maintenance_booking: 'Hello {staff_name},\n\nA vehicle {booking_type} booking has been scheduled for you:\n\nVehicle: {vehicle_name}\nBooking Type: {booking_type}\nDate: {booking_date}\nTime: {booking_time}\nSupplier: {supplier_name}\nSupplier Phone: {supplier_phone}\nLocation: {location}\n\nNotes: {notes}\n\nPlease ensure the vehicle is taken to the appointment on time.\n\nGC Job Planner',
  training_booking: 'Hello {staff_name},\n\nYou have been booked onto a training course:\n\nCourse: {course_title}\nDate: {start_date}\nTime: {start_time} - {end_time}\nVenue: {venue}\nAddress: {address}\nProvider: {provider}\nProvider Phone: {provider_phone}\n\nDetails: {description}\n\nPlease arrive on time and bring any required PPE or identification.\n\nGC Job Planner',
  daily_reminder: 'Hello {staff_name},\n\nHere is your schedule for today ({today_date}):\n\n{assignment_list}\n\nHave a safe shift.\n\nGC Job Planner',
  compliance_expiry: 'Compliance Expiry Report\n\n{alert_list}\n\nReview and renew these items as soon as possible.\n\nGC Job Planner',
  daily_standup: '=== DAILY STAND-UP DIGEST ===\nDate: {date}\n\nCREW ON SITE TODAY: {crew_on_site} staff across {active_jobs} active job(s)\n\nRIG MAINTENANCE ALERTS: {rig_alert_count}\n{rig_alerts}\n\nCRITICAL/HIGH SAFETY ACTIONS: {safety_action_count}\n{safety_actions}\n\nVEHICLE ALERTS: {vehicle_alert_count}\n{vehicle_alerts}\n\nGenerated by GC Job Planner',
  timesheet_summary: 'Daily timesheet summary for {date}:\n\nSUBMITTED ({submitted_count}):\n{submitted_list}\n\nIN PROGRESS ({in_progress_count}):\n{in_progress_list}\n\nNOT STARTED ({not_started_count}):\n{not_started_list}\n\nReview and approve pending timesheets in the Timesheets page.\n\nGC Job Planner',
  milestone_push: '{milestone}\n\nJob: {job_name} ({job_reference})\nLocation: {location}\nReviewed by: {reviewed_by}\n\nThis milestone has been published to the client portal automatically.',
};

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildStyledHtml(bodyText, cfg) {
  const accent = cfg.accent_color || '#0e7a4f';
  const bannerTitle = cfg.banner_title || 'GC Job Planner';
  const showBanner = cfg.show_banner !== false;
  const footer = cfg.footer_text || 'GC Job Planner';
  const safe = escapeHtml(bodyText).replace(/\n/g, '<br>');
  const banner = showBanner
    ? '<tr><td style="background:' + accent + ';padding:18px 24px"><h1 style="margin:0;color:#ffffff;font-size:18px;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px">' + escapeHtml(bannerTitle) + '</h1></td></tr>'
    : '';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">' +
    '<table align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 6px 24px rgba(15,42,31,0.08)">' +
    banner +
    '<tr><td style="padding:24px;color:#1e293b;font-size:14px;line-height:1.6">' + safe + '</td></tr>' +
    '<tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;text-align:center">' + escapeHtml(footer) + '</td></tr>' +
    '</table></body></html>';
}

function renderSampleBody(key, cfg) {
  if (key === 'vehicle_maintenance') {
    const sampleList = 'Vehicle Maintenance Report\n\n2 vehicle(s) require maintenance attention:\n\nVan 01 (AB12 CDE):\n  - MOT: Due soon (due 2026-07-15)\n  - Service: OVERDUE (due 2026-06-30)\n';
    if (cfg.template) return cfg.template.replace(/\{alert_count\}/g, '2').replace(/\{alert_list\}/g, sampleList);
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + sampleList + 'Please schedule maintenance as soon as possible.\n\nGC Job Planner';
  }
  if (key === 'compliance_expiry') {
    const sampleList = 'John Smith — CSCS Card (staff):\n  EXPIRED (expiry: 2026-06)\nVan 01 — Vehicle MOT (vehicle):\n  Expiring soon (expiry: 2026-07-25)\n';
    if (cfg.template) return cfg.template.replace(/\{alert_count\}/g, '2').replace(/\{alert_list\}/g, sampleList);
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + 'Compliance Expiry Report\n\n2 item(s) require attention:\n\n' + sampleList + '\nReview and renew these items as soon as possible.\n\nGC Job Planner';
  }
  if (key === 'daily_standup') {
    const rigLines = '   • Rig 1 — overdue (next: 2026-07-25)\n   • Rig 2 — due_soon (next: 2026-08-10)';
    const safetyLines = '   • [CRITICAL] Secure loose heras fencing (due 2026-07-30)';
    const vehicleLines = '   • Van 01 — MOT 2026-07-20, service 2026-08-15';
    if (cfg.template) return cfg.template
      .replace(/\{date\}/g, 'Wednesday 10 July 2026')
      .replace(/\{crew_on_site\}/g, '8')
      .replace(/\{active_jobs\}/g, '3')
      .replace(/\{rig_alert_count\}/g, '2')
      .replace(/\{rig_alerts\}/g, rigLines)
      .replace(/\{safety_action_count\}/g, '1')
      .replace(/\{safety_actions\}/g, safetyLines)
      .replace(/\{vehicle_alert_count\}/g, '1')
      .replace(/\{vehicle_alerts\}/g, vehicleLines);
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + '=== DAILY STAND-UP DIGEST ===\nDate: Wednesday 10 July 2026\n\nCREW ON SITE TODAY: 8 staff across 3 active job(s)\n\nRIG MAINTENANCE ALERTS: 2\n' + rigLines + '\n\nCRITICAL/HIGH SAFETY ACTIONS: 1\n' + safetyLines + '\n\nVEHICLE ALERTS: 1\n' + vehicleLines + '\n\nGenerated by GC Job Planner';
  }
  if (key === 'timesheet_summary') {
    const submittedList = '   • John Smith — Sample Job (submitted 16:30)';
    const inProgressList = '   • Jane Doe — Second Job (arrived 08:15)';
    const notStartedList = '   • Bob Lee — Third Job';
    if (cfg.template) return cfg.template
      .replace(/\{date\}/g, '2026-07-10')
      .replace(/\{submitted_count\}/g, '1')
      .replace(/\{in_progress_count\}/g, '1')
      .replace(/\{not_started_count\}/g, '1')
      .replace(/\{submitted_list\}/g, submittedList)
      .replace(/\{in_progress_list\}/g, inProgressList)
      .replace(/\{not_started_list\}/g, notStartedList);
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + 'Daily timesheet summary for 2026-07-10:\n\nSUBMITTED (1):\n' + submittedList + '\n\nIN PROGRESS (1):\n' + inProgressList + '\n\nNOT STARTED (1):\n' + notStartedList + '\n\nReview and approve pending timesheets in the Timesheets page.\n\nGC Job Planner';
  }
  if (key === 'milestone_push') {
    if (cfg.template) return cfg.template
      .replace(/\{milestone\}/g, '✅ BH01 completed (5.0m–12.5m) on 2026-07-10. Sample borehole completed to target depth.')
      .replace(/\{job_name\}/g, 'Sample Job')
      .replace(/\{job_reference\}/g, 'JOB-001')
      .replace(/\{location\}/g, 'Sample Site, London')
      .replace(/\{reviewed_by\}/g, 'John Smith')
      .replace(/\{borehole_ref\}/g, 'BH01');
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + '✅ BH01 completed (5.0m–12.5m) on 2026-07-10. Sample borehole completed to target depth.\n\nJob: Sample Job (JOB-001)\nLocation: Sample Site, London\nReviewed by: John Smith\n\nThis milestone has been published to the client portal automatically.';
  }
  if (key === 'staff_schedule') {
    if (cfg.template) {
      return cfg.template
        .replace(/\{staff_name\}/g, 'John Smith')
        .replace(/\{week_start\}/g, 'Mon 6 Jul – Sun 12 Jul 2026')
        .replace(/\{assignment_count\}/g, '5');
    }
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + 'Hi John Smith, here is your schedule for the week of Mon 6 Jul – Sun 12 Jul 2026. You have 5 assignment(s).';
  }
  if (key === 'staff_invitation') {
    if (cfg.template) {
      return cfg.template.replace(/\{staff_name\}/g, 'John Smith').replace(/\{email\}/g, 'john@example.com');
    }
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + 'Hi John Smith,\n\nYou have been invited to join the GC Job Planner app. Use the login link sent to your email (john@example.com) to set up your account and start viewing your schedule and logging timesheets.\n\nGC Job Planner';
  }
  if (key === 'absence_request') {
    if (cfg.template) return cfg.template.replace(/\{staff_name\}/g, 'John Smith').replace(/\{start_date\}/g, '2026-07-15').replace(/\{end_date\}/g, '2026-07-18').replace(/\{reason\}/g, 'Holiday').replace(/\{notes\}/g, 'Family holiday');
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + 'An absence request has been submitted:\n\nStaff: John Smith\nFrom: 2026-07-15\nTo: 2026-07-18\nReason: Holiday\nNotes: Family holiday\n\nReview and respond in the planner.\n\nGC Job Planner';
  }
  if (key === 'job_status_change') {
    if (cfg.template) return cfg.template.replace(/\{job_name\}/g, 'Sample Job').replace(/\{location\}/g, 'Sample Site, London').replace(/\{old_status\}/g, 'In Progress').replace(/\{new_status\}/g, 'On Hold');
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + 'A job status has changed:\n\nJob: Sample Job\nLocation: Sample Site, London\nStatus: In Progress -> On Hold\n\nView the job in the planner.\n\nGC Job Planner';
  }
  if (key === 'new_job') {
    if (cfg.template) return cfg.template.replace(/\{job_name\}/g, 'Sample Job').replace(/\{location\}/g, 'Sample Site, London').replace(/\{job_type\}/g, 'groundworks').replace(/\{start_date\}/g, '2026-07-15').replace(/\{end_date\}/g, '2026-07-30').replace(/\{job_reference\}/g, 'JOB-001');
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + 'A new job has been created:\n\nJob: Sample Job\nLocation: Sample Site, London\nType: groundworks\nStart: 2026-07-15\nEnd: 2026-07-30\nReference: JOB-001\n\nReview the job in the planner.\n\nGC Job Planner';
  }
  if (key === 'timesheet_submitted') {
    if (cfg.template) return cfg.template.replace(/\{staff_name\}/g, 'John Smith').replace(/\{job_name\}/g, 'Sample Job').replace(/\{date\}/g, '2026-07-10').replace(/\{hours\}/g, '8h').replace(/\{task_description\}/g, 'Setting up the rig').replace(/\{notes\}/g, 'All went well');
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + 'A timesheet has been submitted for approval:\n\nStaff: John Smith\nJob: Sample Job\nDate: 2026-07-10\nHours: 8h\nTask: Setting up the rig\nNotes: All went well\n\nReview and approve it in the planner.\n\nGC Job Planner';
  }
  if (key === 'maintenance_booking') {
    if (cfg.template) return cfg.template.replace(/\{staff_name\}/g, 'John Smith').replace(/\{vehicle_name\}/g, 'Van 01 (AB12 CDE)').replace(/\{booking_type\}/g, 'MOT').replace(/\{booking_date\}/g, 'Monday, 15 July 2026').replace(/\{booking_time\}/g, '09:00').replace(/\{supplier_name\}/g, 'Holeman').replace(/\{supplier_phone\}/g, '01234 567890').replace(/\{location\}/g, 'Holeman Garage, Bristol').replace(/\{notes\}/g, 'Please arrive 15 mins early');
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + 'Hello John Smith,\n\nA vehicle MOT booking has been scheduled for you:\n\nVehicle: Van 01 (AB12 CDE)\nBooking Type: MOT\nDate: Monday, 15 July 2026\nTime: 09:00\nSupplier: Holeman\nSupplier Phone: 01234 567890\nLocation: Holeman Garage, Bristol\n\nNotes: Please arrive 15 mins early\n\nPlease ensure the vehicle is taken to the appointment on time.\n\nGC Job Planner';
  }
  if (key === 'training_booking') {
    if (cfg.template) return cfg.template.replace(/\{staff_name\}/g, 'John Smith').replace(/\{course_title\}/g, 'Forklift Training').replace(/\{start_date\}/g, 'Monday, 15 July 2026').replace(/\{end_date\}/g, '').replace(/\{start_time\}/g, '08:00').replace(/\{end_time\}/g, '16:00').replace(/\{venue\}/g, 'Training Centre Bristol').replace(/\{address\}/g, '123 Industrial Way, Bristol').replace(/\{provider\}/g, 'NPORS Training Ltd').replace(/\{provider_phone\}/g, '01234 567890').replace(/\{description\}/g, '3-day forklift operator certification course');
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + 'Hello John Smith,\n\nYou have been booked onto a training course:\n\nCourse: Forklift Training\nDate: Monday, 15 July 2026\nTime: 08:00 - 16:00\nVenue: Training Centre Bristol\nAddress: 123 Industrial Way, Bristol\nProvider: NPORS Training Ltd\nProvider Phone: 01234 567890\n\nDetails: 3-day forklift operator certification course\n\nPlease arrive on time and bring any required PPE or identification.\n\nGC Job Planner';
  }
  if (key === 'daily_reminder') {
    const sampleList = '   - Sample Job - Sample Site, London - 07:00-17:00 - AB12 CDE\n   - Second Job - Another Site, Bath - 07:00-17:00';
    if (cfg.template) return cfg.template.replace(/\{staff_name\}/g, 'John Smith').replace(/\{today_date\}/g, '2026-07-10').replace(/\{assignment_list\}/g, sampleList);
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + 'Hello John Smith,\n\nHere is your schedule for today (2026-07-10):\n\n' + sampleList + '\n\nHave a safe shift.\n\nGC Job Planner';
  }
  const tok = { staff_name: 'John Smith', job_name: 'Sample Job', location: 'Sample Site, London', date: 'Monday, 6 July 2026', job_type: 'groundworks', notes: 'Notes: Sample note' };
  if (cfg.template) {
    return cfg.template
      .replace(/\{staff_name\}/g, tok.staff_name).replace(/\{job_name\}/g, tok.job_name)
      .replace(/\{location\}/g, tok.location).replace(/\{date\}/g, tok.date)
      .replace(/\{job_type\}/g, tok.job_type).replace(/\{notes\}/g, tok.notes);
  }
  const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
  return intro + 'Hello John Smith,\n\nYou have been assigned to a new job:\n\nJob: Sample Job\nLocation: Sample Site, London\nDate: Monday, 6 July 2026\nJob Type: groundworks\nNotes: Sample note\n\nPlease check your schedule for full details.\n\nGC Job Planner';
}

export default function EmailAlertsSettings() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [testing, setTesting] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const textareaRefs = useRef({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('manageEmailAlerts', { action: 'get' });
      const list = res.data?.settings || [];
      const d = {};
      list.forEach((s) => { d[s.alert_key] = { ...s }; });
      setDrafts(d);
      setOpenKey(Object.keys(ALERT_META)[0]);
    } catch (e) {
      toast({ title: 'Error loading alerts', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (key, field, value) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const insertToken = (key, token) => {
    const ta = textareaRefs.current[key];
    if (!ta) {
      updateDraft(key, 'template', (drafts[key]?.template || '') + token);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const cur = drafts[key]?.template || '';
    const next = cur.slice(0, start) + token + cur.slice(end);
    updateDraft(key, 'template', next);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + token.length; });
  };

  const handleSave = async (key) => {
    setSaving(key);
    try {
      await base44.functions.invoke('manageEmailAlerts', { action: 'save', ...drafts[key] });
      toast({ title: 'Alert saved', description: 'Changes apply to the next automated run.' });
      await load();
    } catch (e) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (key) => {
    setTesting(key);
    try {
      const res = await base44.functions.invoke('manageEmailAlerts', { action: 'test', alert_key: key });
      const count = res.data?.recipients?.length || 0;
      toast({ title: 'Test email sent', description: `Sent to ${count} recipient${count === 1 ? '' : 's'}.` });
    } catch (e) {
      toast({ title: 'Error sending test', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(null);
    }
  };

  const handleReset = (key) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], subject: '', template: '', intro_message: '', ...DEFAULT_STYLE } }));
    toast({ title: 'Template reset', description: 'Click Save to apply the defaults.' });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSectionHeader icon={Mail} title="Automated Email Alerts" description="Control recipients, timing, wording, colours and banner for each automated email" />

      {/* Alert selector tabs */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(ALERT_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const isActive = openKey === key;
          const isEnabled = drafts[key]?.enabled !== false;
          return (
            <button key={key} type="button" onClick={() => setOpenKey(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition cursor-pointer touch-manipulation select-none ${
                isActive ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
              }`}>
              <Icon className="w-4 h-4" />
              {meta.title}
              <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-400' : 'bg-slate-400'}`} />
            </button>
          );
        })}
      </div>

      {openKey && (() => {
        const key = openKey;
        const meta = ALERT_META[key];
        const draft = drafts[key] || { alert_key: key, enabled: true, ...DEFAULT_STYLE };
        const Icon = meta.icon;
        const isEnabled = draft.enabled !== false;
        const previewHtml = buildStyledHtml(renderSampleBody(key, draft), draft);
        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2.5 rounded-lg flex-shrink-0" style={{ background: (draft.accent_color || '#0e7a4f') + '22' }}>
                    <Icon className="w-5 h-5" style={{ color: draft.accent_color || '#0e7a4f' }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{meta.title}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{meta.desc}</p>
                  </div>
                </div>
                <button type="button" onClick={() => updateDraft(key, 'enabled', !isEnabled)}
                  className="relative inline-flex items-center cursor-pointer flex-shrink-0" aria-label="Toggle alert">
                  <input type="checkbox" checked={isEnabled} readOnly className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5" />{meta.schedule}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-0">
              {/* Settings column */}
              <div className="p-5 space-y-4 lg:border-r border-slate-100">
                {meta.showRecipients && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Recipient emails</label>
                    <input type="text" value={draft.recipient_emails || ''} onChange={(e) => updateDraft(key, 'recipient_emails', e.target.value)}
                      placeholder="Leave blank to email all admins"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                    <p className="text-xs text-slate-400 mt-1">Comma-separated. Leave blank to notify all admin users.</p>
                  </div>
                )}

                {meta.showThreshold && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Days before due to warn</label>
                    <input type="number" min="1" max="365" value={draft.days_before_warning ?? 30}
                      onChange={(e) => updateDraft(key, 'days_before_warning', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                    <p className="text-xs text-slate-400 mt-1">Alerts when MOT or service is due within this many days (or overdue).</p>
                  </div>
                )}

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email subject <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input type="text" value={draft.subject || ''} onChange={(e) => updateDraft(key, 'subject', e.target.value)}
                    placeholder={SUBJECT_PLACEHOLDERS[key] || 'Alert'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                  {key === 'assignment_notification' && <p className="text-xs text-slate-400 mt-1">Use {'{job_name}'} to insert the job name.</p>}
                  {key === 'staff_schedule' && <p className="text-xs text-slate-400 mt-1">Use {'{staff_name}'} or {'{week_start}'} in the subject.</p>}
                  {key === 'staff_invitation' && <p className="text-xs text-slate-400 mt-1">Use {'{staff_name}'} or {'{email}'} in the subject.</p>}
                </div>

                {/* Template editor */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-slate-700">Email body template <span className="text-slate-400 font-normal">(optional)</span></label>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {meta.tokens.map((t) => (
                      <button key={t} type="button" onClick={() => insertToken(key, t)}
                        className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-mono border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer">
                        {t}
                      </button>
                    ))}
                  </div>
                  <textarea ref={(el) => (textareaRefs.current[key] = el)}
                    value={draft.template || ''} onChange={(e) => updateDraft(key, 'template', e.target.value)} rows="7"
                    placeholder={TEMPLATE_PLACEHOLDERS[key] || ''}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 font-mono" />
                  <p className="text-xs text-slate-400 mt-1">Click a token to insert it. Leave blank to use the default template.</p>
                </div>

                {/* Intro */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Intro message <span className="text-slate-400 font-normal">(optional)</span></label>
                  <textarea value={draft.intro_message || ''} onChange={(e) => updateDraft(key, 'intro_message', e.target.value)} rows="2"
                    placeholder="Custom message shown at the top of the email (used when no full template is set)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                </div>

                {/* Style controls */}
                <div className="pt-3 border-t border-slate-100 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Palette className="w-4 h-4 text-emerald-600" /> Email appearance
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Sparkles className="w-4 h-4 text-slate-400" /> Show banner
                    </div>
                    <button type="button" onClick={() => updateDraft(key, 'show_banner', draft.show_banner !== false ? false : true)}
                      className="relative inline-flex items-center cursor-pointer flex-shrink-0" aria-label="Toggle banner">
                      <input type="checkbox" checked={draft.show_banner !== false} readOnly className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Banner title</label>
                    <input type="text" value={draft.banner_title || ''} onChange={(e) => updateDraft(key, 'banner_title', e.target.value)}
                      placeholder="GC Job Planner"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Accent colour</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {ACCENT_PRESETS.map((p) => (
                        <button key={p.value} type="button" onClick={() => updateDraft(key, 'accent_color', p.value)}
                          className={`w-8 h-8 rounded-full ring-2 transition cursor-pointer ${draft.accent_color === p.value ? 'ring-slate-900' : 'ring-transparent hover:ring-slate-300'}`}
                          style={{ background: p.value }} aria-label={p.name} title={p.name} />
                      ))}
                      <input type="color" value={draft.accent_color || '#0e7a4f'} onChange={(e) => updateDraft(key, 'accent_color', e.target.value)}
                        className="w-8 h-8 rounded-full border border-slate-200 cursor-pointer p-0 bg-transparent" aria-label="Custom colour" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <span className="inline-flex items-center gap-1"><Type className="w-3.5 h-3.5 text-slate-400" /> Footer text</span>
                    </label>
                    <input type="text" value={draft.footer_text || ''} onChange={(e) => updateDraft(key, 'footer_text', e.target.value)}
                      placeholder="GC Job Planner"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button onClick={() => handleSave(key)} disabled={saving === key}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition text-sm font-medium">
                    {saving === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                  </button>
                  <button onClick={() => handleTest(key)} disabled={testing === key || !isEnabled}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition text-sm font-medium">
                    {testing === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send test email
                  </button>
                  <button onClick={() => handleReset(key)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-500 rounded-lg hover:bg-slate-50 transition text-sm font-medium">
                    <RotateCcw className="w-4 h-4" /> Reset template
                  </button>
                </div>
              </div>

              {/* Preview column */}
              <div className="bg-slate-50 p-5">
                <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-600">
                  <Eye className="w-4 h-4 text-emerald-600" /> Live preview
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                  <iframe title="Email preview" srcDoc={previewHtml} className="w-full h-[520px] border-0 bg-white" />
                </div>
                <p className="text-xs text-slate-400 mt-2">Preview uses sample data. The accent colour and banner update instantly.</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}