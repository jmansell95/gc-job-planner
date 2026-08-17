# GC Multi-Division Enterprise Platform — Geotechnical Hub Feature Reference

## 1. Overview Hub
**Existing:**
- Enterprise dashboard with live operational snapshots
- Mission-critical KPI tracking (jobs, revenue, compliance)
- Division switcher with color-coded branding
- Customizable widget grid (drag-and-drop dashboard)
- Carbon footprint & environmental impact tracking
- Executive snapshot widget

**New (Added):**
- **Predictive Completion Widget** — AI-driven job completion date forecasting
- **Configuration Health Monitor** — Dashboard showing setup completeness per division
- **Data Freshness Indicators** — Visual badges showing when data was last synced

---

## 2. Jobs Hub
**Existing:**
- Project → Job → Multi-Site hierarchy
- Multi-discipline tracking (drilling, groundworks, enabling, coring, trial pit)
- Job lifecycle states (planning → in_progress → decommissioning → completed)
- Job dependency manager with prerequisite warnings
- Client portal with configurable section visibility
- Decommissioning checklist with asset return tracking
- Job cost items, BOQ, and billing contracts

**New (Added):**
- **Competency-Based Job Gating** — `CompetencyGate` component blocks rota assignments for staff missing required certifications
- **Predictive Hazard Alerts** — Weather/flood risk warnings on job cards
- **Job Milestone Automation** — Auto-trigger client notifications on milestone completion

---

## 3. Scheduling Hub (Rota)
**Existing:**
- Unified drag-and-drop rota builder
- Crew assignment with rig-based dynamic crewing
- Conflict detection (double-booking warnings)
- Overtime rate management with day-of-week rules
- Rota week publishing with PDF export
- Non-job assignment types (annual leave, sick, training, yard/depot)
- Schedule acknowledgment splash screen

**New (Added):**
- **Compliance Block in Rota** — `CompetencyGate` inline warnings when assigning non-compliant staff
- **AI Crew Suggester** — `suggestCrewAllocation` backend function recommends optimal crew based on qualifications and availability
- **Template Week Copy** — Duplicate a full week's rota across weeks

---

## 4. Staff Hub (People & Training)
**Existing:**
- Digital passport with profile editing
- Compliance Wallet (3D flip-cards for card credentials)
- Training Matrix Hub with clickable cells and bulk selection
- Training course management with booking/outcome tracking
- Smart Certificate Scanning (AI-assisted OCR)
- Performance reviews and incentive scoring
- Holiday pay accrual tracking
- Timesheet delegation and approval workflows

**New (Added):**
- **Auto-Booker** — `AutoBookerModal` scans matrix for gaps and auto-suggests course bookings with bulk confirm
- **Multi-Course Assignment** — `AssignTrainingModal` rebuilt with chip-based course selection and add/remove
- **Competency Gate** — `CompetencyGate` component for compliance verification on assignments
- **Training Gap Scheduler Widget** — Dashboard widget showing upcoming expirations and gaps

---

## 5. Logistics Hub
**Existing:**
- Delivery chain builder with route optimization
- Site collection scanner with QR/barcode support
- Load planner with vehicle capacity checks
- Goods-in receipt processing
- Driver day planner with leg chain view
- Bulk delivery reconciliation
- Asset passport with movement history

**New (Added):**
- **Auto-Generated Transfer Legs** — `autoGenerateTransferLegs` backend function creates delivery legs automatically from job assignments
- **Off-Hire Reconciliation Widget** — Track hired equipment return status
- **Idle Asset Transfer Widget** — Suggest asset reassignments from idle to active jobs

---

## 6. Assets Hub (Equipment)
**Existing:**
- Asset Panda sync (inventory levels, warehouse locations)
- Rig rollup with linked equipment (lifting gear, tooling)
- Compliance status (LOLER, PUWER, PAT)
- Service history with usage-hours-based maintenance scheduling
- Asset lifecycle manager (depreciation, book value, replacement planning)
- QR code generation and bulk printing
- Scrap pile management

**New (Added):**
- **Predictive Maintenance** — `predictMaintenance` and `checkPredictiveMaintenance` backend functions forecast service needs
- **Asset Health Index** — Combined score from usage, safety events, and maintenance history
- **Fleet Utilization Heatmap** — Visual grid showing asset deployment over time

---

## 7. Fleet Hub (Vehicles)
**Existing:**
- DVLA sync (MOT, tax, spec lookup)
- Geotab telemetry (GPS, odometer, safety events)
- Holman fleet sync
- Driver risk scoring (harsh braking, speeding, cornering)
- Maintenance booking with provider directory
- Vehicle MOT history timeline
- Mileage reconciliation
- Idle vehicle detection

**New (Added):**
- **Live Driver Tracking** — `current_operator` fields show who's driving each vehicle in real-time
- **Trip Timeline Enhanced** — Detailed trip history with Geotab GPS data
- **Travel Reconciliation Report** — Compare planned vs actual travel times

---

## 8. Investigation Hub (Geotechnical)
**Existing:**
- AGS/KeyLogBook file import with auto-borehole creation
- Borehole drill-down with strata/SPT/sample data
- Investigation log manager with manager review workflow
- Driller log forms (borehole progress, sample collection, installation)
- Groundworker and enabling crew log forms
- Site log review with bulk approve
- OpenGround export
- Standpipe readings and monitoring wells
- CBR and vane strength testing
- Service encounter tracking

**New (Added):**
- **Auto-Billing from Remarks** — `autoCreateBillingFromRemarks` parses driller diary entries and creates charge items
- **KeyLogBook Webhook** — Real-time ingestion of driller remarks via webhook
- **Borehole Completion Modal** — Structured borehole finalization with grouting/sealing records
- **Geotechnical Heatmap Widget** — Dashboard visualization of borehole density by region

---

## 9. Compliance Hub
**Existing:**
- Centralized RAMS management
- LOLER/PUWER/PAT test history
- Compliance expiry forecasting
- SafetyCulture (iAuditor) integration
- Toolbox talk manager
- Incident reporter with RIDDOR stats
- Compliance calendar
- Skills matrix and training gap analysis
- Asset compliance report

**New (Added):**
- **Compliance Expiry Auto-Check** — `checkComplianceExpiry` scheduled function flags expiring items
- **Site Readiness Gate** — Pre-job compliance verification before site mobilization
- **SafetyCulture Auto-Sync** — `syncSafetyCulture` pulls audit data automatically

---

## 10. Billing Hub
**Existing:**
- Master Price List (MPL) with internal cost rates
- Supplier rate card upload and ingestion
- Automated job costing via BillingRule matching
- Invoice generation with line-item assembly
- Aged debtors dashboard
- Monthly statements
- POA (Price on Application) worklist with price locking
- Margin guard with subcontractor markup rules
- BOQ manager with variation checking
- Financial audit log

**New (Added):**
- **Auto-Invoice Generation** — `autoGenerateInvoice` creates invoices from approved timesheets and cost items
- **Invoice Discrepancy Checker** — `checkInvoiceDiscrepancies` flags billing anomalies
- **Overdue Chase Automation** — `chaseOverdueInvoices` sends escalating reminders
- **Billing Readiness Gate** — `checkBillingReadiness` shows what's missing before invoicing
- **Retention Release Tracking** — `checkRetentionStatus` and `releaseRetention` manage retained sums

---

## 11. Settings Hub
**Existing:**
- Enterprise Access Manager with permission groups
- Division Wizard with granular hub/tab selection
- Division Access Manifest for per-division UI lockdown
- Integration Hub (M365, Geotab, Holman, Asset Panda, SafetyCulture, Bob HR, Concur, CIS, Met Office, OpenGround)
- System audit log with tamper-evident hash chain
- Backup/Restore manager (division snapshots)
- Email template manager
- Geofence configuration
- Overtime rate rules
- Business config manager

**New (Added):**
- **Division Snapshot System** — Pre-flight backups before structural changes
- **Readiness Manager** — Per-division setup completeness tracking
- **Settings Lockdown** — Admin-only lockdown for sensitive financial settings
- **Custom Domain & Login Branding** — Per-division branding for login screens
