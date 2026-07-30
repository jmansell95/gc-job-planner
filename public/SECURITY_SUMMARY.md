# GC Job Planner — Security & Compliance Summary

**Document Date:** July 2026
**Platform:** Base44 (Backend-as-a-Service)
**Compliance Frameworks:** ISO 27001 · GDPR · Cyber Essentials

---

## 1. Access Control (RBAC & Row-Level Security)

All data access is enforced at the database layer via Row-Level Security (RLS) policies defined per entity. No client-side code can bypass these rules.

### 1.1 Entity-Level Permissions

| Entity | Read | Create | Update | Delete |
|---|---|---|---|---|
| **Job** | All authenticated | Admin only | Admin only | Admin only |
| **SubcontractorLog** | All authenticated | All authenticated | Owner or Admin | Owner or Admin |
| **FinancialAuditLog** | Admin only | System (open create) | Admin only | Admin only |
| **AppSetting** | All authenticated | Admin only | Admin only | Admin only |
| **RateCardItem** | All authenticated | Admin only | Admin only | Admin only |
| **BillingRule** | All authenticated | Admin only | Admin only | Admin only |
| **JobBillOfQuantities** | All authenticated | Admin only | Admin only | Admin only |
| **ExpensePreset** | All authenticated | Admin only | Admin only | Admin only |

### 1.2 Permission Groups

Staff records carry a `permission_group_id` that controls granular access to every admin module and settings page. This is synced to the platform user role to maintain permission parity between the Staff Manager and system-level access.

### 1.3 Client Portal

Client portal access is token-based (`portal_token` per Job) and section-level visibility is controlled via the `portal_sections` JSON field — clients only see what is explicitly enabled.

---

## 2. Audit Trail & Data Integrity

### 2.1 Financial Audit Log

The `FinancialAuditLog` entity is an **immutable** (append-only from the system's perspective) audit trail that records:

- **Entity name & ID** — which record was changed
- **Action** — create / update / delete
- **Changed fields** — top-level field names that changed
- **Field changes** — JSON-encoded `{before, after}` for every changed value
- **Actor** — user ID and name of the person who made the change
- **Source** — `entity_automation`, `manual`, or `system`
- **Record summary** — human-readable description for quick scanning

**RLS Protection:** Only `admin` roles can read, update, or delete audit records, preventing tampering by standard users.

### 2.2 Audit Capture Mechanism

The `recordFinancialAudit` backend function is called by every financial mutation function (e.g., `calculateCharge`, `stampBillingCharge`, `activateBillingContract`) to ensure a complete paper trail for:

- `RateCardItem` changes
- `BillingRule` changes
- `JobBillingContract` activations
- `AppSetting` configuration changes
- `ExpensePreset` changes
- `InvestigationSOR` changes

### 2.3 Financial Record Locking

- `SubcontractorLog` records carry a `concur_export_id` that **locks the record** once exported to SAP Concur, preventing post-export modification.
- `JobBillingContract` BOQ lines are snapshotted at activation time — `agreed_unit_price` is locked and immune to future rate card changes.

---

## 3. Margin Guardrails & Financial Controls

### 3.1 Subcontractor Margin Protection

- `SubcontractorLog.markup_percentage` defaults to 15% and the `checkSubconMargin` function flags or blocks zero-margin billing.
- The `margin_net` and `margin_pct` fields are calculated automatically, ensuring transparency on the sell-side profit.

### 3.2 Billing Lifecycle

The billing workflow follows a strict state machine:

```
Draft → Ready (checkBillingReadiness) → Activated (activateBillingContract)
     → Charged (stampBillingCharge) → Invoiced (autoGenerateInvoice)
```

Each transition is gated by a backend function that validates data completeness before allowing progression.

---

## 4. Configuration & Secret Management

### 4.1 AppSetting Pattern

All third-party API configurations are stored in the `AppSetting` entity (not hardcoded in source code):

- SAP Concur credentials & GL code mappings
- Bob HR API configuration
- HMRC CIS configuration
- Sub-contractor default markup rules
- Email alert routing rules

**RLS:** Admin-only write access; all authenticated users can read (for non-sensitive keys like email branding).

### 4.2 No Hardcoded Secrets

No API keys, passwords, or connection strings exist in the application source code. All runtime secrets are managed by the Base44 platform's secret management system and injected at function execution time.

---

## 5. Data Protection (GDPR)

### 5.1 Data Minimisation

- Staff PII is limited to `name`, `email`, `phone`, and role/assignment data.
- Client portal tokens are opaque UUIDs — no PII embedded.
- Compliance documents (`ComplianceItem`) store file URLs only; the platform's private storage controls access.

### 5.2 File Storage

All uploaded files (signatures, compliance certificates, invoices) are stored in the platform's managed storage. Private files (`UploadPrivateFile`) require signed URLs (`CreateFileSignedUrl`) with time-limited access (default 300 seconds).

### 5.3 User Account Management

- User accounts are created via invitation only (`base44.users.inviteUser`) — no open registration for staff.
- Admins control role assignment (`admin` or `user`).
- Staff can self-serve only their own profile and schedule.

---

## 6. Automated Compliance Monitoring

### 6.1 Scheduled Automations

| Function | Schedule | Purpose |
|---|---|---|
| `checkComplianceExpiry` | Daily | Flags assets with expiring LOLER/PUWER/PAT certificates |
| `checkVehicleMaintenance` | Daily | Flags vehicles with upcoming MOT/service dates |
| `checkAllJobsAssetCompliance` | Daily | Validates all assets assigned to active jobs are compliant |
| `checkJobBudgetAlerts` | Daily | Flags jobs approaching or exceeding budget thresholds |
| `checkSubconMargin` | On-demand | Validates subcontractor markup guardrails |
| `syncBankHolidays` | Weekly | Keeps holiday calendar current for payroll accuracy |

### 6.2 Service Role Execution

All scheduled automations run using `base44.asServiceRole`, which:

- Executes with elevated privileges independent of any user session
- Eliminates session-dependency bugs
- Ensures automations continue running even if the triggering user is deactivated

---

## 7. Webhook & Integration Security

### 7.1 Inbound Webhooks

All third-party webhooks (`holmanWebhook`, `bobWebhook`, `receiveKeyLogBookData`, `receiveSafetyCultureData`) are processed as backend functions with:

- Payload validation before any database write
- Structured error responses for malformed data
- No direct entity creation from raw payloads — all data passes through processing logic

### 7.2 Outbound Integrations

- **SAP Concur:** Expense export via `syncConcurExpenses` with reconciliation via `importConcurReconciliation`
- **Bob HR:** Absence sync via `syncBobAbsences` and `bobWebhook`
- **Holman Fleet:** Vehicle data sync via `syncHolmanFleet` and `holmanWebhook`
- **HMRC CIS:** Verification via `verifyCIS` using AppSetting-stored configuration

---

## 8. Cyber Essentials Checklist

| Control | Status |
|---|---|
| Firewalls (platform-managed) | ✅ Base44 infrastructure |
| Secure configuration | ✅ RLS on all sensitive entities |
| User access control | ✅ Invite-only, role-based, permission groups |
| Malware protection | ✅ Platform-managed (no user-uploaded executables) |
| Patch management | ✅ Platform-managed (Base44 handles infrastructure patching) |

---

## 9. Summary of Controls for IT Sign-off

1. **Data is isolated by role** — non-admin users cannot create, modify, or delete financial configuration entities.
2. **Every financial change is audited** — the `FinancialAuditLog` captures who/what/when for all sensitive mutations, and is itself protected from tampering.
3. **No secrets in code** — all third-party credentials live in `AppSetting` (admin-only) or platform secrets management.
4. **Compliance is automated** — daily checks ensure no non-compliant equipment is used on active jobs.
5. **Records lock after financial export** — preventing post-reconciliation modification of subcontractor costs.
6. **Access is invite-only** — no open registration; admins control who joins and with what role.

---

*This document reflects the security architecture as implemented in the GC Job Planner application. For questions, contact the system administrator.*
