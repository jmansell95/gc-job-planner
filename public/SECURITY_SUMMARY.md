# GC Mission Control — Security & System Summary

**Last updated:** August 2026  
**Document owner:** Ground Control IT  
**Classification:** Internal

---

## 1. Platform Overview

The GC Mission Control is a full-stack operations platform built on Base44 (backend-as-a-service) with a React + Tailwind CSS frontend. It manages the complete job lifecycle for Ground Control's geotechnical and groundworks operations: weekly staff allocation, job provisioning, timesheet approval, financial lifecycle management, asset tracking, compliance, and client portal access.

**Tech stack:**
- Frontend: React 18 + Vite + Tailwind CSS + shadcn/ui
- Backend: Base44 BaaS (entities, functions, automations, auth)
- Database: MongoDB (via Base44 entity SDK)
- Hosting: Base44 cloud (publishes to web + iOS/Android from same code)
- Integrations: Geotab, Holman, Asset Panda, Bob HR, SAP Concur, SafetyCulture, KeyLogBook, HMRC CIS, Met Office, Google Maps, WhatsApp, Xero/Sage, Stripe

---

## 2. Authentication & Access Control

### Authentication
- Platform-owned auth backend (tokens, sessions, email verification)
- Email/password login with OTP verification on registration
- Google OAuth single-sign-on
- Password reset flow via email token
- Hard redirects (window.location.href) after auth state changes — the auth provider must re-initialize

### Role-Based Access
- **Roles:** `super_admin`, `admin`, `management`, `user`, `field`, `read_only`
- **Permission Groups:** Granular per-module access configured via the PermissionGroup entity. Each staff member can be assigned a permission group that overrides their crew type's default access.
- **Settings Lockdown:** Admins can lock individual settings pages to specific roles via the SettingsLockdownManager.
- **Route Guards:** ProtectedRoute wraps all authenticated routes; RouteGuard checks module-level access.

### Row-Level Security (RLS)
- **Job:** Admin-only create/update/delete; all authenticated users can read
- **Timesheet:** Users can create and update their own; admins can delete any; managers approve
- **SubcontractorLog:** Creator or admin can update/delete
- **Invoice, VehicleLocationLog:** Admin-only read/create/update/delete
- **RateCardItem, BillingRule, JobBillingContract, JobBillOfQuantities:** Admin-only write operations
- **AssetReturnLog:** All users can create; admin-only update/delete
- **JobDelayLog:** All users can create; admin-only delete

---

## 3. Data Model

### Core Entities (40+)
| Entity | Purpose | Sensitive Data |
|--------|---------|---------------|
| User | Platform user accounts | Email, role |
| Staff | Crew member profiles | Email, phone, worker type |
| Job | Job/site records | Location, client, budget |
| Project | Parent project grouping | — |
| Timesheet | Daily/weekly time entries | Hours, pay rates |
| RotaAssignment | Weekly rota slots | — |
| SiteAsset | Rigs, plant, equipment | Compliance data |
| Vehicle | Fleet vehicles | Reg, VIN |
| Invoice | Client billing | Financial totals |
| SubcontractorLog | Sub-con work logs | Purchase costs, margins |
| JobBillingContract | Locked billing terms | Rate snapshots |
| RateCardItem | Master price list | Pricing |
| BillingRule | Charge calculation rules | Pricing |

### Data Storage Limits
- **Never** store large content (base64, PDFs, blobs) in entity fields — use UploadFile and store the file_url
- Entity fields have size limits; oversized fields break record operations
- File uploads go to Base44 storage; private files use UploadPrivateFile + CreateFileSignedUrl

---

## 4. Integration Security

### API Key Management
All third-party API credentials are stored in the **AppSetting** entity (not platform-level secrets), keyed by integration:
- `geotab_config` — Geotab GPS credentials
- `holman_config` — Holman fleet management
- `asset_panda_config` — Asset Panda inventory
- `bob_hr_config` — Bob HR (Hibob) time-off bridge
- `concur_config` — SAP Concur expense sync
- `safety_culture_config` — SafetyCulture (iAuditor)
- `keylogbook_config` — KeyLogBook AGS webhook
- `cis_config` — HMRC CIS verification
- `met_office_config` — Met Office weather API
- `google_maps_config` — Google Maps geocoding
- `whatsapp_config` — WhatsApp Business API
- `accounting_config` — Xero/Sage accounting
- `stripe_config` — Stripe payment gateway

### Webhook Security
Each integration that receives webhooks uses a shared secret for authentication:
- Secrets are auto-generated (32-char alphanumeric) or manually set
- Secrets are sent as query params or custom headers depending on the provider
- Webhook endpoints validate the secret before processing

### OAuth Connectors
- No OAuth app connectors are currently authorized
- Supported connectors available via the Base44 platform (Google Calendar, Slack, Notion, Salesforce, etc.)
- BYO shared connectors can be registered by workspace admins for services without platform OAuth apps

---

## 5. Financial Controls

### Audit Trail
- **FinancialAuditLog** entity records every change to locked rate cards, SORs, billing rules, presets, and contracts
- Tamper-evident: records are append-only with timestamps and user attribution
- Accessible via Settings → Financial Audit Log (admin-only)

### Billing Lock
- BillingContract activation locks rate snapshots — future rate card changes don't affect active contracts
- Invoices are locked once exported to payroll or accounting
- Subcontractor logs are locked once synced to SAP Concur

### Margin Guardrails
- Subcontractor markup defaults to 15%; system flags or blocks zero-margin billing
- Job budget alerts trigger when active jobs breach budget, margin, or profit thresholds
- Predictive margin analysis based on daily burn rates

---

## 6. Compliance & Safety

### Asset Compliance
- LOLER (lifting equipment): 6-month default inspection interval
- PUWER (work equipment): 12-month default inspection interval
- PAT (portable appliances): 12-month default (3 months for 110V construction tools)
- Compliance status auto-calculated: compliant → expiring (30 days) → expired
- Non-compliant assets are auto-deactivated and cannot be added to jobs

### Usage-Based Maintenance (Phase 1)
- Rigs and plant equipment use **engine operating hours** instead of calendar dates
- `recalculateUsageMaintenance` function sums drilling-duration minutes from InvestigationLogs
- Each asset has a configurable `service_interval_hours` (default 250h for rigs, 500h for machinery)
- When `hours_since_last_service` exceeds the interval, the asset is flagged and a maintenance booking is auto-created

### Safety
- SafetyCulture (iAuditor) integration syncs site safety audits
- Job hazard maps show known site risks
- Briefing sign-off required before starting work on site
- Safety reports can be submitted from the field

---

## 7. Data Privacy

### Personal Data
- Staff names, emails, and phone numbers are stored in the Staff entity
- User emails are stored in the built-in User entity (platform-managed)
- No special category data (health, biometrics, etc.) is processed

### Data Retention
- Timesheets are retained indefinitely (payroll compliance)
- VehicleLocationLog (GPS data) is admin-only read access
- Demo data is flagged and skipped by all sync functions

### Client Portal
- Portal access is token-based (portal_token on Job entity)
- Portal sections are configurable per job (portal_sections object)
- No authentication required — token in URL provides access
- Portal can be disabled per job (portal_enabled flag)

---

## 8. Known Issues & Limitations

1. **Asset linking via JobAssetAssignment/JobCostItem migration** — pending
2. **Five crew members** on the rota are missing personal day rates, causing crew labour costs to show as £0
3. **Rate card description matching** is fragile — discrepancies in calculated financial figures may occur
4. **HMRC CIS credentials** cannot be hardcoded as platform secrets — managed via AppSetting entity instead

---

## 9. Backup & Recovery

- Database is managed by Base44 platform (automated backups)
- Demo Data Manager can reset the database to a clean slate
- No manual backup/restore is required — platform handles this

---

## 10. Incident Response

For platform-level issues (auth, database, hosting), contact Base44 support.  
For application-level issues (business logic, integrations), check the Audit Trail and Automation Center logs in the admin dashboard.
