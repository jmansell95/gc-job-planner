# GC Mission Control — Whole-App Missing Features Plan

*Generated 2026-08-23. Prioritised by impact. Each item notes the gap, the proposed fix, and the effort estimate (S/M/L).*

---

## Priority 1 — Critical Gaps (break existing flows or block daily use)

### 1.1 Field Operations

| # | Gap | Fix | Effort |
|---|-----|-----|--------|
| 1 | **submitDailyTimesheet missing constants** — `REQUIRED_WORK_MINS` and `TRAVEL_DEDUCTIBLE` were undefined, causing every end-of-shift submission to throw a ReferenceError caught silently as a generic "Could not complete shift" error. | **FIXED** — now loads from BusinessConfig with defaults (540 min / 90 min). | S (done) |
| 2 | **isDriller check used legacy job_type strings** — StaffDashboard hardcoded `['cp_drilling','rotary_drilling']` instead of the `JobType.is_drilling` flag, so the Shift Wizard's drilling-specific steps never showed for jobs created from the new JobType templates. | **FIXED** — now uses `useJobTypes()` + `JobType.is_drilling` with `drilling_method` fallback. | S (done) |
| 3 | **No offline PWA support** — field crews lose all access when on site with no signal. The offline queue exists for deliveries/briefings but the schedule, job details, and log forms don't queue. | Add a service worker + IndexedDB cache for the staff schedule, job details, and investigation log forms. Queue submissions and sync when online. | L |
| 4 | **No push notifications** — crews miss assignment changes, weather alerts, and schedule publications because there's no native push. | Wire `SendPushNotification` for: new assignment, schedule published, weather stop-work, compliance expiry. Requires native mobile build. | M |
| 5 | **Geofence auto-arrival not surfaced** — GeofenceEvent records are created by the Geotab webhook but never auto-mark the RotaAssignment as `arrived_on_site_at`, so the Shift Wizard still requires manual arrival confirmation. | Add a scheduled automation that matches recent GeofenceEvent arrivals to today's RotaAssignment and auto-stamps `arrived_on_site_at`. | M |
| 6 | **Digital briefing signatures not verifiable** — briefing signatures are stored as a boolean flag, not a captured signature image, so they can't be audited for legal compliance. | Capture a signature pad image (Signature entity already exists) and store the URL on the RotaAssignment. | S |

### 1.2 Billing & Equipment

| # | Gap | Fix | Effort |
|---|-----|-----|--------|
| 7 | **Daily total only summed 'day' unit types** — the EquipmentManager header showed £0/day for week-rated and hour-rated items, understating the daily running cost. | **FIXED** — now sums day, week (÷5), and hour (×8) unit types. | S (done) |
| 8 | **Rate card auto-fill works for hired but not for owned/labour** — HiredEquipmentFields auto-fills from the rate card, but OwnedEquipmentFields and LabourFields don't have the same "pick from rate card" dropdown. | Add the same rate-card picker to OwnedEquipmentFields and LabourFields. | S |
| 9 | **No automated dunning** — overdue invoices are flagged but no automated email/SMS chase sequence runs. `chaseOverdueInvoices` exists but isn't wired to a schedule. | Create a scheduled automation (weekly) that invokes `chaseOverdueInvoices` and sends escalating reminders (7/14/30 days overdue). | S |
| 10 | **No client credit limits** — jobs can run indefinitely over budget with no hard stop or credit hold. | Add a `credit_limit` field to Client; block new job creation or AFP submission when the client's outstanding balance exceeds the limit. | M |
| 11 | **CIS verification not wired to subcontractor onboarding** — `verifyCIS` exists but isn't called automatically when a subcontractor is created or when a SubcontractorLog is saved. | Add an entity automation on Contractor create/update that invokes `verifyCIS` and stores the result. | S |
| 12 | **No PO three-way matching UI** — PurchaseOrder entity exists with draft/send/receive/close statuses, but there's no UI to match the PO against the received DeliveryLog and the supplier invoice. | Build a PO matching view that shows PO → delivery receipts → supplier invoice side-by-side with match/exception flags. | M |
| 13 | **No VAT returns export** — VAT is tracked per job but there's no quarterly VAT return summary for HMRC. | Add a VAT return report that aggregates output VAT (invoices) and input VAT (supplier costs) per quarter, exportable to CSV. | S |

### 1.3 Asset Panda Integration

| # | Gap | Fix | Effort |
|---|-----|-----|--------|
| 14 | **No real-time stock alerts** — Asset Panda sync runs on a schedule but low-stock/out-of-stock alerts aren't pushed to the yard manager in real time. | Wire the AssetPandaWebhook to trigger `checkInventoryAlerts` on every stock change, and send an email/push to the yard manager. | S |
| 15 | **No auto-reorder** — when stock drops below a threshold, there's no automatic purchase order creation. | Add a `reorder_threshold` field to SiteAsset; when `quantity_available` drops below it, auto-create a PurchaseOrder draft. | M |
| 16 | **No utilization reporting** — rig/plant operating hours are tracked but there's no utilization report showing % time in use vs idle. | Add a utilization report (weekly/monthly) that calculates operating_hours / total_hours per asset. | S |

---

## Priority 2 — Important Gaps (improve efficiency and reduce manual work)

### 2.1 Compliance

| # | Gap | Fix | Effort |
|---|-----|-----|--------|
| 17 | **No expiry notifications** — compliance items (LOLER, PUWER, PAT, training certs) expire silently. `checkComplianceExpiry` runs but only emails admins, not the individual staff member or their manager. | Send targeted notifications to the staff member (30/7 days before) and their manager (on expiry). Add a dashboard widget countdown. | S |
| 18 | **No training auto-enrollment** — when a compliance item expires, there's no automatic training booking to renew it. | When a cert expires, auto-create a TrainingBooking in the nearest available course and notify the staff member. | M |
| 19 | **No RAMS workflow** — Risk Assessments & Method Statements are stored as JobDocuments but there's no approval workflow (draft → review → approved → issued to crew). | Add a `rams_status` field to JobDocument and an approval flow with manager sign-off before the job can go active. | M |

### 2.2 Scheduling

| # | Gap | Fix | Effort |
|---|-----|-----|--------|
| 20 | **AI crew allocation not surfaced** — `suggestCrewAllocation` exists but isn't shown in the rota builder as a suggestion. | Add a "Suggest Crew" button in the UnifiedRotaBuilder that calls the function and pre-fills the best-fit crew for each job. | S |
| 21 | **No conflict detection** — staff can be double-booked across jobs on the same day without a warning. | Add a validation check in the rota builder that flags any staff member assigned to 2+ jobs on the same date. | S |
| 22 | **No WTD (Working Time Directive) compliance check** — the system tracks hours but doesn't flag when a staff member exceeds 48h/week or 11h daily rest. | Add a WTD check to the rota builder and timesheet approval flow. | M |
| 23 | **No weather-based delay suggestions** — when `checkSiteWeatherAlerts` flags stop-work, it doesn't suggest rescheduling the affected rota assignments. | When a weather stop is detected, auto-create a JobDelayLog and suggest moving the RotaAssignment to the next available day. | M |

### 2.3 Reporting

| # | Gap | Fix | Effort |
|---|-----|-----|--------|
| 24 | **No saved report templates** — custom reports can be built but can't be saved for reuse. | Add a "Save as template" button to the CustomReportBuilder that stores the filter/column config as a named template. | S |
| 25 | **No scheduled report delivery** — reports can be generated manually but can't be scheduled for weekly/monthly email delivery. | Add a scheduled automation that runs a saved report template and emails it to a recipient list. | S |

### 2.4 Client Portal

| # | Gap | Fix | Effort |
|---|-----|-----|--------|
| 26 | **No Stripe payment integration** — `createStripeCheckout` and `stripeWebhook` exist but the client portal doesn't show a "Pay Invoice" button. | Add a payment button to the client portal invoice view that calls `createStripeCheckout`. Requires Stripe setup. | M |
| 27 | **No document approval workflow** — clients can view documents but can't approve/reject them. `approvePortalDocument` exists but there's no UI. | Add approve/reject buttons to the portal document viewer that call the function and notify the project manager. | S |

### 2.5 Integrations

| # | Gap | Fix | Effort |
|---|-----|-----|--------|
| 28 | **Xero/Sage sync not wired** — `syncAccounting` and `accountingWebhook` exist but the settings page has no credentials field and no "Sync Now" button. | Complete the AccountingSyncSettings page with credential fields, test connection, and manual sync. | M |
| 29 | **Concur sync not wired** — `syncConcurExpenses` exists but the settings page doesn't have a working sync trigger. | Add a "Sync Now" button and scheduled automation to ConcurSyncSettings. | S |
| 30 | **Bob HR not two-way** — `syncBobAbsences` pulls absences from Bob HR, but `pushAbsenceToBob` (pushing app-created absences back to Bob) isn't wired to the AbsenceManager. | Call `pushAbsenceToBob` when an absence is created/updated in the AbsenceManager. | S |

---

## Priority 3 — Polish & Enhancements (nice-to-have, not blocking)

| # | Gap | Fix | Effort |
|---|-----|-----|--------|
| 31 | **Mobile/tablet nav missing key hubs** — the mobile bottom nav doesn't include Assets, Billing, or Compliance hubs that exist in the desktop sidebar. | Add the missing hubs to the mobile nav with appropriate icons. | S |
| 32 | **Two-phase reverse geocoding not rendering** — the reverse geocode util returns data but the UI doesn't display the resolved address. | Wire the reverse geocode result to the job detail and GeofenceEvent feed. | S |
| 33 | **Safety event date/time formatting** — Geotab safety events show raw ISO timestamps instead of formatted UK date/time. | Apply `toLocaleString('en-GB')` to safety event timestamps in the UI. | S |
| 34 | **Financial attribution in rig profitability** — `getRigProfitability` sometimes attributes costs to the wrong rig when a job has multiple rigs. | Add rig_id to JobCostItem and filter profitability by rig_id instead of job_id. | M |
| 35 | **Weather sync for sites with valid locations** — some jobs with valid lat/lng still fail weather sync. | **FIXED** — switched to WeatherAPI.com with API key (no shared-IP throttling). | S (done) |
| 36 | **Mitti (formerly SafetyCulture) rename** — all UI text, entity, and functions needed renaming after the product rebranded. | **FIXED** — entity renamed to MittiConfig, functions renamed to syncMitti/receiveMittiData, all UI text updated. | M (done) |

---

## Summary

| Priority | Count | Effort |
|----------|-------|--------|
| P1 — Critical | 16 | 3 done, 13 remaining (5S, 5M, 1L) |
| P2 — Important | 14 | 0 done, 14 remaining (7S, 5M, 2L) |
| P3 — Polish | 6 | 2 done, 4 remaining (3S, 1M) |
| **Total** | **36** | **5 done, 31 remaining** |

### Recommended next steps (top 5 by impact):
1. **Offline PWA** (#3) — unblocks field crews with no signal
2. **Automated dunning** (#9) — improves cash flow immediately
3. **CIS verification wiring** (#11) — compliance requirement
4. **Expiry notifications** (#17) — prevents lapsed certifications
5. **AI crew allocation surfacing** (#20) — saves managers hours per week