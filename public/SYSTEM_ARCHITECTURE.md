# GC Job Planner — System Architecture

**Last updated:** August 2026  
**Version:** Phase 0-2 Roadmap

---

## 1. Entity Model (40+ entities)

### People & Teams
| Entity | Key Fields | Purpose |
|--------|-----------|---------|
| User | email, role | Platform user accounts (built-in) |
| Staff | name, email, team_id, worker_type, permission_group_id | Crew member profiles |
| Team | name, job_type | Crew types / teams |
| DrillingCrew | name, rig_id | Drilling crew groupings |
| PermissionGroup | name, permissions | Access control groups |
| Absence | staff_id, start_date, end_date, status | Leave records |
| RecurringAbsence | staff_id, pattern | Recurring days off |
| TrainingCourse | name, expiry_months | Training definitions |
| TrainingBooking | staff_id, course_id, completion_date | Training records |

### Jobs & Scheduling
| Entity | Key Fields | Purpose |
|--------|-----------|---------|
| Job | name, location, status, start_date, end_date, client_id | Job records |
| Project | name | Parent project grouping |
| JobType | key, label, colour | Job type definitions |
| RotaAssignment | staff_id, job_id, date | Weekly rota slots |
| RotaWeek | week_start, status | Rota publication state |
| StaffShift | staff_id, date, shift_type | Daily shift records |
| JobMilestone | job_id, label, due_date | Job milestones |
| JobComment | job_id, content | Job comments |
| JobDocument | job_id, file_url | Job documents |
| SitePhoto | job_id, photo_url | Site photos |

### Financial
| Entity | Key Fields | Purpose |
|--------|-----------|---------|
| RateCardItem | category, description, price, cost_price | Master price list |
| BillingRule | rule_type, charge_method | Charge calculation rules |
| JobCostItem | job_id, category, cost | Job cost items |
| JobBillingContract | job_id, version, status | Locked billing terms |
| JobBillOfQuantities | job_id, agreed_quantity, agreed_unit_price | BOQ lines |
| Invoice | invoice_number, job_id, net_total, status | Client invoices |
| SubcontractorLog | job_id, subcontractor_id, purchase_cost_net | Sub-con work logs |
| DailyCost | job_id, date, cost | Daily cost tracking |
| ExpensePreset | label, amount, gl_code | Quick-add expense buttons |
| CostPreset | label, items | Equipment cost presets |
| PresetItem | preset_id, item | Preset line items |
| FinancialAuditLog | entity_type, action, user | Tamper-evident audit |
| OvertimeSetting | threshold_hours | Weekly overtime threshold |
| OvertimeRate | day_of_week, multiplier | Day-of-week rates |

### Assets & Fleet
| Entity | Key Fields | Purpose |
|--------|-----------|---------|
| SiteAsset | name, asset_type, compliance_status, operating_hours | Rigs, plant, equipment |
| Vehicle | name, registration_number, mot_expiry | Fleet vehicles |
| VehicleMaintenanceBooking | vehicle_id, booking_type, status | Maintenance bookings |
| VehicleLocationLog | vehicle_id, lat, lng, timestamp | GPS location history |
| ServiceRecord | asset_id, service_date, service_type | Service history |
| AssetManifest | manifest_code, asset_ids | QR code manifests |
| AssetReturnLog | job_id, scanned_items | Asset return events |
| EquipmentCatalogue | name, category | Equipment catalogue |
| ComplianceItem | asset_id, type, expiry_date | Compliance records |
| ComplianceConfig | default_loler_interval_months | Global compliance config |

### Logistics
| Entity | Key Fields | Purpose |
|--------|-----------|---------|
| DeliveryLog | job_id, driver_staff_id, delivery_type, status | Deliveries/collections |
| HotelBooking | job_id, staff_id, check_in_date | Accommodation bookings |
| JobAssetAssignment | job_id, asset_id, status | Asset-to-job assignments |

### Investigation & Geotechnical
| Entity | Key Fields | Purpose |
|--------|-----------|---------|
| InvestigationLog | job_id, log_type, borehole_ref, depth | Borehole/site logs |
| InvestigationSOR | job_id, sor_ref | SOR line references |
| JobDelayLog | job_id, delay_type, impacted_days | Delay records |

### Configuration
| Entity | Key Fields | Purpose |
|--------|-----------|---------|
| AppSetting | key, value | All integration configs |
| BusinessConfig | key | Core business rules |
| ComplianceConfig | key | Compliance intervals |
| ConfigList | key, options | Dropdown configurations |
| DashboardLayout | user_id, layout | Custom dashboard layouts |
| EmailAlertSetting | alert_type, enabled | Email alert toggles |
| BankHoliday | date, name | UK bank holidays |
| AutomationControl | key, enabled | Automation toggles |
| SafetyCultureConfig | key | SafetyCulture settings |
| KeyLogBookConfig | key | KeyLogBook settings |
| AssetPandaConfig | key | Asset Panda settings |
| HelpTopic | title, category, content | Help guide articles |
| Client | name, contact_email | Client contacts |
| Contractor | name, type | Sub-contractor records |
| Supplier | name | Equipment suppliers |
| Signature | staff_id, job_id, signature_url | Digital signatures |
| SafetyReport | job_id, type, content | Safety reports |
| BriefingSignature | staff_id, job_id, signed_at | Briefing sign-offs |

---

## 2. Backend Functions (80+)

### Scheduled Automations
| Function | Schedule | Purpose |
|----------|----------|---------|
| autoBookMaintenance | Daily 06:30 | Auto-book vehicle MOT/service |
| recalculateUsageMaintenance | Daily 07:00 | Recalculate rig/plant usage hours |
| checkVehicleMaintenance | Daily 07:30 | Check vehicle maintenance status |
| checkAssetCompliance | Daily 08:00 | Check asset compliance expiry |
| checkComplianceExpiry | Daily 08:30 | Check staff compliance expiry |
| checkJobBudgetAlerts | Daily 09:00 | Job budget/margin alerts |
| checkOverdueInvoices | Daily 09:30 | Flip sent invoices to overdue |
| checkRetentionStatus | Daily 10:00 | Check retention release eligibility |
| checkMilestoneTriggers | Daily 10:30 | Check billing milestone triggers |
| checkBOQVariations | Daily 11:00 | Check BOQ scope variations |
| checkBillingReadiness | Daily 11:30 | Check billing readiness gate |
| checkSubconMargin | Daily 12:00 | Check subcontractor margin guardrails |
| checkAllJobsAssetCompliance | Daily 12:30 | Check all jobs' asset compliance |
| syncBankHolidays | Monthly | Sync UK bank holidays |
| retryAssetReturnSync | Every 30 min | Retry failed Asset Panda pushes |
| sendDailyReminders | Daily 07:00 | Send daily schedule reminders |
| sendDailyStandup | Daily 07:30 | Send daily standup summary |
| sendDailyTimesheetSummary | Daily 18:00 | Send timesheet summary to managers |

### Entity Automations
| Function | Trigger | Purpose |
|----------|---------|---------|
| greenPathApproveTimesheet | Timesheet create | Auto-approve green-path timesheets |
| notifyNewJob | Job create | Notify staff of new job |
| notifyJobStatusChange | Job update | Notify on status change |
| notifyTimesheetSubmitted | Timesheet create | Notify manager of submission |
| notifyMaintenanceBooking | Booking create | Notify garage/admin |
| notifyTrainingBooking | Booking create | Notify staff of training |
| notifyAbsenceRequest | Absence create | Notify manager of leave request |
| sendAssignmentNotification | RotaAssignment create | Notify staff of assignment |
| recordFinancialAudit | Financial entity update | Record audit trail |

### Webhook Handlers
| Function | Integration | Purpose |
|----------|-------------|---------|
| geotabWebhook | Geotab | Receive vehicle location pushes |
| holmanWebhook | Holman | Receive fleet data updates |
| bobWebhook | Bob HR | Receive time-off events |
| receiveKeyLogBookData | KeyLogBook | Receive AGS/borehole data |
| receiveSafetyCultureData | SafetyCulture | Receive safety audit data |

### Sync Functions
| Function | Purpose |
|----------|---------|
| syncGeotabFleet | Pull live vehicle locations |
| syncGeotabTimesheets | Auto-generate timesheets from GPS |
| syncHolmanFleet | Pull MOT/service/mileage data |
| syncAssetPanda | Pull asset inventory levels |
| syncAssetCompliance | Sync compliance from GC Compliance Manager |
| syncBobAbsences | Bidirectional time-off sync |
| syncConcurExpenses | Push expenses to SAP Concur |
| syncBankHolidays | Sync UK bank holidays |

### Financial Functions
| Function | Purpose |
|----------|---------|
| calculateJobFinancials | Full job financial breakdown |
| calculateCharge | Calculate billing charge for a record |
| stampBillingCharge | Stamp charge on timesheet/delivery/log |
| autoGenerateInvoice | Generate invoice from job data |
| autoMatchVendorInvoice | Reconcile supplier PDF against logs |
| activateBillingContract | Lock billing contract rates |
| releaseRetention | Release retention to client |
| exportPayroll | Export timesheets to payroll CSV |
| generateMonthlyStatements | Generate client monthly statements |
| generateJobReport | Generate PDF job report |
| generateRotaPDF | Generate weekly rota PDF |
| generateJobAGSExport | Export AGS file from job data |

### Operational Functions
| Function | Purpose |
|----------|---------|
| importAGS | Process AGS/KeyLogBook files |
| approveKeyLogBookLogs | Approve parsed KeyLogBook logs |
| submitDailyTimesheet | Merge daily timesheet entries |
| mergeWeeklyTimesheet | Merge weekly timesheet |
| publishRotaWeek | Publish weekly rota |
| acknowledgeSchedule | Staff schedule acknowledgement |
| processAssetReturn | Process asset return + Asset Panda sync |
| validateRigTooling | Validate rig tooling assignments |
| autoBookMaintenance | Auto-book vehicle maintenance |
| recalculateUsageMaintenance | Recalculate usage-based maintenance |
| updateAssetComplianceOnMaintenance | Update compliance after maintenance |

---

## 3. Frontend Architecture

### Pages
| Route | Component | Access |
|-------|-----------|--------|
| / | Home | Authenticated |
| /admin | AdminDashboard | Admin/Management |
| /staff-schedule | StaffDashboard | All staff |
| /staff-profile | StaffProfile | All staff |
| /deliveries | DeliveryDashboard | Delivery-enabled staff |
| /admin/logistics | AdminDeliveryHub | Admin/Management |
| /rig-hub | RigHub | Admin/Management |
| /vehicles | Vehicles | Admin/Management |
| /pat-testing | PATTestingConsole | Admin |
| /subcontractor | SubcontractorDashboard | Subcontractors |
| /help | HelpGuide | Public |
| /presentation-pack | PresentationPack | Authenticated |
| /client-portal/:token | ClientPortal | Public (token) |

### Key Components
- **AppLayout** — shared sidebar + mobile header wrapper
- **AdminNav** — desktop sidebar + mobile drawer navigation
- **SettingsPage** — tabbed settings hub with 40+ sections
- **JobDetailTabs** — multi-tab job detail view
- **DashboardWidgets** — modular dashboard widget grid
- **StaffAssistantChat** — in-app AI assistant
- **SchedulingAssistantChat** — AI scheduling helper
- **DrillingIntelligenceChat** — AI drilling intelligence

### Design System
- **Colors:** Ground Control brand — dark green (#2E5A1A) primary, leaf-green (#8DC63F) accent
- **Typography:** Inter font family (heading, body, display)
- **Components:** shadcn/ui + custom Tailwind components
- **Cards:** `insight-card` class with layered shadows and hover lift
- **Gradients:** `mesh-bg`, `hero-gradient`, `command-gradient` for branded surfaces
- **Stat tiles:** 10 gradient presets for dashboard metrics
- **Responsive:** Mobile-first with safe-area-inset padding

---

## 4. Maintenance Model (Phase 1)

### Date-Based (Vehicles, Trailers, Lifting Gear, PAT)
- `next_service_date` drives `maintenance_status`
- `autoBookMaintenance` creates bookings 14 days before due
- Status: ok (>30 days) → due_soon (≤30 days) → overdue (past due)

### Hours-Based (Rigs, Machinery)
- `operating_hours` accumulated from InvestigationLog drilling durations
- `hours_since_last_service` = operating_hours - hours_at_last_service
- `service_interval_hours` per asset (default 250h rigs, 500h machinery)
- `recalculateUsageMaintenance` runs daily:
  - Sums drilling minutes since last service
  - Updates operating_hours and hours_since_last_service
  - Flags due_soon at 80% of interval, overdue at 100%+
  - Auto-creates maintenance booking when threshold crossed
- Service logging resets hours_at_last_service to current operating_hours

---

## 5. Integration Map

```
                    ┌─────────────────┐
                    │  GC Job Planner │
                    │   (Base44)      │
                    └────┬───────┬────┘
                         │       │
    ┌────────────────────┼───────┼────────────────────┐
    │                    │       │                    │
  Fleet              Finance   People            Operations
    │                    │       │                    │
  Geotab (GPS)      SAP Concur  Bob HR          Met Office
  Holman (Fleet)    Xero/Sage   (Time-off)      Google Maps
  Asset Panda       Stripe      WhatsApp       KeyLogBook
  (Inventory)       HMRC CIS                   SafetyCulture
```

All integration credentials stored in AppSetting entity. Webhook receivers validate shared secrets. Sync functions use `base44.asServiceRole` for scheduled runs (no user session dependency).
