// Entities preserved during a full reset (system config, sync settings, user accounts, catalogs).
// Everything NOT in this list is wiped by resetDatabase.
export const PRESERVED_ENTITIES = [
  'User',
  'AssetPandaConfig',
  'SafetyCultureConfig',
  'KeyLogBookConfig',
  'BusinessConfig',
  'AppSetting',
  'ConfigList',
  'DashboardLayout',
  'PermissionGroup',
  'OvertimeRate',
  'OvertimeSetting',
  'EmailAlertSetting',
  'AutomationControl',
  'TrainingCourse',
  'HelpTopic',
  'JobType',
];

// Entities wiped during a full reset — ordered so dependencies are deleted first
// (children before parents) to avoid referential issues.
export const WIPE_ENTITIES = [
  'JobComment',
  'JobMilestone',
  'JobDelayLog',
  'DeliveryLog',
  'HotelBooking',
  'SitePhoto',
  'JobDocument',
  'JobAssetAssignment',
  'JobCostItem',
  'InvestigationLog',
  'SafetyReport',
  'Signature',
  'BriefingSignature',
  'Timesheet',
  'RotaAssignment',
  'RotaWeek',
  'StaffShift',
  'Absence',
  'RecurringAbsence',
  'Invoice',
  'CostPreset',
  'PresetItem',
  'EquipmentCatalogue',
  'RateCardItem',
  'InvestigationSOR',
  'BillingRule',
  'Job',
  'Project',
  'SiteAsset',
  'Vehicle',
  'Staff',
  'Team',
  'Supplier',
  'Contractor',
  'Client',
];

// Entities that should NOT receive demo data (sync-owned / external systems).
// Demo data is never seeded into these, and sync functions skip is_demo_data records.
export const SYNC_PROTECTED_ENTITIES = [
  'AssetPandaConfig',
  'SafetyCultureConfig',
  'KeyLogBookConfig',
];