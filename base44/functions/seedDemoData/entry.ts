import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// DEMO DATA SEEDER — populates a full, realistic dataset to
// showcase the Ground Control system to managers.
// All records are tagged is_demo_data: true where the field
// exists so sync functions can skip them.
// ============================================================

// --- Date helpers ---
const TODAY = new Date('2026-07-25T08:00:00Z');
const ISO = (d) => d.toISOString();
const DATE = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MONDAY_OF = (d) => { const x = new Date(d); const day = x.getDay(); const diff = day === 0 ? -6 : 1 - day; x.setDate(x.getDate() + diff); return x; };

const thisMonday = MONDAY_OF(TODAY);
const lastMonday = addDays(thisMonday, -7);
const twoWeeksAgo = addDays(thisMonday, -14);
const threeWeeksAgo = addDays(thisMonday, -21);
const fourWeeksAgo = addDays(thisMonday, -28);
const nextMonday = addDays(thisMonday, 7);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const e = base44.asServiceRole.entities;
    const progress = [];
    const log = (msg) => progress.push(msg);

    // ============================================================
    // 1. CLIENTS
    // ============================================================
    log('Creating clients...');
    const clients = await e.Client.bulkCreate([
      { name: 'Arup Geotechnics', contact_name: 'Sarah Chen', contact_email: 's.chen@arup.com', contact_phone: '020 7655 1234', is_demo_data: true },
      { name: 'Mott MacDonald', contact_name: 'James Whitfield', contact_email: 'j.whitfield@mottmac.com', contact_phone: '020 8777 4400', is_demo_data: true },
      { name: 'WSP Group', contact_name: 'Priya Patel', contact_email: 'priya.patel@wsp.com', contact_phone: '020 7314 5000', is_demo_data: true },
      { name: 'Stantec UK', contact_name: 'Mark Davies', contact_email: 'm.davies@stantec.com', contact_phone: '0117 920 8400', is_demo_data: true },
    ]);
    const [arup, mottMac, wsp, stantec] = clients;

    // ============================================================
    // 2. SUPPLIERS
    // ============================================================
    log('Creating suppliers...');
    const suppliers = await e.Supplier.bulkCreate([
      { name: 'PlantHire Solutions Ltd', contact_name: 'Terry Green', contact_email: 'terry@plantiresolutions.co.uk', contact_phone: '0121 555 7890', notes: 'Excavators, dumpers, welfare units. 24h notice.', is_demo_data: true },
      { name: 'GeoCore Equipment', contact_name: 'Anna Kowalski', contact_email: 'anna@geocore.co.uk', contact_phone: '0161 444 2200', notes: 'Casing, core barrels, drill bits. Next-day delivery.', is_demo_data: true },
      { name: 'Bentonite Supplies Co', contact_name: 'Rob Mitchell', contact_email: 'rob@bentonitesupplies.com', contact_phone: '0145 333 1100', notes: 'Bentonite powder, polymer mud, foaming agents.', is_demo_data: true },
    ]);
    const [plantHire, geoCore, bentoniteSupp] = suppliers;

    // ============================================================
    // 3. CONTRACTORS
    // ============================================================
    log('Creating contractors...');
    const contractors = await e.Contractor.bulkCreate([
      { name: 'DrillRight Subcontractors Ltd', contact_name: 'Steve Hanworth', contact_email: 'steve@drillright.co.uk', contact_phone: '07700 900100', onboarding_status: 'approved', services_offered: ['drilling', 'coring'], accreditations: ['chas', 'constructionline'], insurance_provider: 'AXA Insurance', insurance_policy_number: 'PL/2026/88471', insurance_expiry: DATE(addDays(TODAY, 180)), public_liability_limit: 5000000, employers_liability_limit: 10000000, approved_by_name: 'Admin', approved_at: ISO(addDays(TODAY, -120)), default_daily_rate: 450, is_demo_data: true },
      { name: 'GroundWorks Partners Ltd', contact_name: 'Lisa Carter', contact_email: 'lisa@gwpartners.co.uk', contact_phone: '07700 900200', onboarding_status: 'approved', services_offered: ['groundworks', 'trial_pit', 'enabling'], accreditations: ['smas', 'safecontractor'], insurance_provider: 'Allianz', insurance_policy_number: 'PL/2026/55219', insurance_expiry: DATE(addDays(TODAY, 45)), public_liability_limit: 5000000, employers_liability_limit: 10000000, approved_by_name: 'Admin', approved_at: ISO(addDays(TODAY, -90)), default_daily_rate: 380, is_demo_data: true },
      { name: 'Coring Specialists UK', contact_name: 'Dave Robinson', contact_email: 'dave@coringuk.com', contact_phone: '07700 900300', onboarding_status: 'under_review', services_offered: ['coring'], accreditations: ['iso9001'], insurance_provider: 'Aviva', insurance_policy_number: 'PL/2026/77103', insurance_expiry: DATE(addDays(TODAY, -10)), public_liability_limit: 2000000, employers_liability_limit: 5000000, is_demo_data: true },
    ]);
    const [drillRight, groundWorks, coringSpec] = contractors;

    // ============================================================
    // 4. TEAMS
    // ============================================================
    log('Creating teams...');
    const teams = await e.Team.bulkCreate([
      { name: 'CP Drilling Crew A', category: 'field_ops', job_type: 'cp_drilling', default_landing_page: '/staff-schedule', revenue_stream_type: 'drilling_meterage', compatible_asset_types: ['rig', 'lifting'], required_qualifications: ['cscs_card', 'npors_card'], is_demo_data: true },
      { name: 'CP Drilling Crew B', category: 'field_ops', job_type: 'cp_drilling', default_landing_page: '/staff-schedule', revenue_stream_type: 'drilling_meterage', compatible_asset_types: ['rig', 'lifting'], required_qualifications: ['cscs_card', 'npors_card'], is_demo_data: true },
      { name: 'Rotary Drilling Crew', category: 'field_ops', job_type: 'rotary_drilling', default_landing_page: '/staff-schedule', revenue_stream_type: 'drilling_meterage', compatible_asset_types: ['rig', 'lifting'], required_qualifications: ['cscs_card', 'cpcs_card', 'npors_card'], is_demo_data: true },
      { name: 'Groundworks Crew', category: 'field_ops', job_type: 'groundworks', default_landing_page: '/staff-schedule', revenue_stream_type: 'groundworks_unit', compatible_asset_types: ['machinery', 'lifting'], required_qualifications: ['cscs_card', 'cpcs_card'], is_demo_data: true },
      { name: 'Enabling Works Team', category: 'field_ops', job_type: 'enabling_works', default_landing_page: '/staff-schedule', revenue_stream_type: 'day_rate', compatible_asset_types: ['machinery', 'trailer'], required_qualifications: ['cscs_card'], is_demo_data: true },
      { name: 'Depot & Management', category: 'management', default_landing_page: '/admin', revenue_stream_type: 'none', is_demo_data: true },
    ]);
    const [cpCrewA, cpCrewB, rotaryCrew, gwCrew, enablingTeam, managementTeam] = teams;

    // ============================================================
    // 5. VEHICLES
    // ============================================================
    log('Creating vehicles...');
    const vehicles = await e.Vehicle.bulkCreate([
      { name: 'Ford Transit Tipper', registration_number: 'GC64 FWD', team_id: cpCrewA.id, mot_expiry: DATE(addDays(TODAY, 120)), service_due_date: DATE(addDays(TODAY, 30)), max_weight_kg: 3500, max_volume_m3: 8, is_demo_data: true },
      { name: 'Isuzu D-Max Pickup', registration_number: 'GC66 XJT', team_id: cpCrewB.id, mot_expiry: DATE(addDays(TODAY, 200)), service_due_date: DATE(addDays(TODAY, 60)), max_weight_kg: 3500, max_volume_m3: 5, is_demo_data: true },
      { name: 'MAN 7.5t Lorry', registration_number: 'GC65 HGV', team_id: rotaryCrew.id, mot_expiry: DATE(addDays(TODAY, 80)), service_due_date: DATE(addDays(TODAY, 10)), max_weight_kg: 7500, max_volume_m3: 25, is_demo_data: true },
      { name: 'Ford Transit Van', registration_number: 'GC67 LKW', team_id: gwCrew.id, mot_expiry: DATE(addDays(TODAY, 300)), service_due_date: DATE(addDays(TODAY, 90)), max_weight_kg: 3500, max_volume_m3: 6, is_demo_data: true },
      { name: 'Mercedes Sprinter', registration_number: 'GV24 MNC', team_id: enablingTeam.id, mot_expiry: DATE(addDays(TODAY, 15)), service_due_date: DATE(addDays(TODAY, 45)), max_weight_kg: 3500, max_volume_m3: 7, is_demo_data: true },
    ]);
    const [tipper, pickup, lorry, transit, sprinter] = vehicles;

    // ============================================================
    // 6. STAFF
    // ============================================================
    log('Creating staff...');
    const staffData = [
      { name: 'Mike Thornton', email: 'mike.thornton@groundcontrol.demo', phone: '07700 700100', worker_type: 'direct_employee', team_id: cpCrewA.id, default_vehicle_id: tipper.id, system_role: 'admin', is_active: true, is_demo_data: true },
      { name: 'Dave Hughes', email: 'dave.hughes@groundcontrol.demo', phone: '07700 700101', worker_type: 'direct_employee', team_id: cpCrewA.id, default_vehicle_id: tipper.id, is_active: true, is_demo_data: true },
      { name: 'Tom Bridges', email: 'tom.bridges@groundcontrol.demo', phone: '07700 700102', worker_type: 'direct_employee', team_id: cpCrewB.id, default_vehicle_id: pickup.id, is_active: true, is_demo_data: true },
      { name: 'Lee Harding', email: 'lee.harding@groundcontrol.demo', phone: '07700 700103', worker_type: 'direct_employee', team_id: cpCrewB.id, default_vehicle_id: pickup.id, is_active: true, is_demo_data: true },
      { name: 'Chris Norman', email: 'chris.norman@groundcontrol.demo', phone: '07700 700104', worker_type: 'direct_employee', team_id: rotaryCrew.id, default_vehicle_id: lorry.id, is_active: true, is_demo_data: true },
      { name: 'Paul Atkins', email: 'paul.atkins@groundcontrol.demo', phone: '07700 700105', worker_type: 'direct_employee', team_id: rotaryCrew.id, default_vehicle_id: lorry.id, is_active: true, is_demo_data: true },
      { name: 'Gary Webb', email: 'gary.webb@groundcontrol.demo', phone: '07700 700106', worker_type: 'direct_employee', team_id: gwCrew.id, default_vehicle_id: transit.id, is_active: true, is_demo_data: true },
      { name: 'Steve Walsh', email: 'steve.walsh@groundcontrol.demo', phone: '07700 700107', worker_type: 'direct_employee', team_id: gwCrew.id, default_vehicle_id: transit.id, is_active: true, is_demo_data: true },
      { name: 'Neil Foster', email: 'neil.foster@groundcontrol.demo', phone: '07700 700108', worker_type: 'direct_employee', team_id: enablingTeam.id, default_vehicle_id: sprinter.id, is_active: true, is_demo_data: true },
      { name: 'Jason Pike', email: 'jason.pike@groundcontrol.demo', phone: '07700 700109', worker_type: 'subcontractor', team_id: cpCrewA.id, is_active: true, is_demo_data: true },
      { name: 'Alan Cross', email: 'alan.cross@groundcontrol.demo', phone: '07700 700110', worker_type: 'subcontractor', team_id: rotaryCrew.id, is_active: true, is_demo_data: true },
      { name: 'Sarah Mitchell', email: 'sarah.mitchell@groundcontrol.demo', phone: '07700 700111', worker_type: 'direct_employee', team_id: managementTeam.id, system_role: 'manager', is_active: true, is_demo_data: true },
    ];
    const staff = await e.Staff.bulkCreate(staffData);
    const [mike, daveH, tomB, leeH, chrisN, paulA, garyW, steveW, neilF, jasonP, alanC, sarahM] = staff;

    // ============================================================
    // 7. SITE ASSETS (tagged is_demo_data: true so syncs skip them)
    // ============================================================
    log('Creating site assets...');
    const assets = await e.SiteAsset.bulkCreate([
      // Rigs
      { name: 'Dando 200 Cable Percussion Rig', asset_type: 'rig', is_rig: true, rig_type: 'cp', serial_number: 'D200-0042', equipment_type: 'Cable Percussion Rig', compliance_category: 'Plant', compliance_status: 'compliant', compliance_expiry_date: DATE(addDays(TODAY, 120)), compliance_last_checked: ISO(addDays(TODAY, -10)), last_service_date: DATE(addDays(TODAY, -45)), next_service_date: DATE(addDays(TODAY, 120)), maintenance_status: 'ok', service_notes: 'LOLER inspection passed. Tested by Lifting Solutions Ltd.', responsible_person: 'Mike Thornton', tooling_notes: '200mm casing, SPT hammer, shell, cutting shoes. Water injection pump.', stock_level: 'in_stock', sync_status: 'synced', last_sync_timestamp: ISO(addDays(TODAY, -5)), is_active: true, is_demo_data: true },
      { name: 'Dando 150 Cutdown Rig', asset_type: 'rig', is_rig: true, rig_type: 'cp', serial_number: 'D150-0118', equipment_type: 'Cutdown Cable Percussion Rig', compliance_category: 'Plant', compliance_status: 'expiring', compliance_expiry_date: DATE(addDays(TODAY, 18)), compliance_last_checked: ISO(addDays(TODAY, -10)), last_service_date: DATE(addDays(TODAY, -160)), next_service_date: DATE(addDays(TODAY, 18)), maintenance_status: 'due_soon', service_notes: 'LOLER 6-monthly due. Minor wear on winch cable noted.', responsible_person: 'Tom Bridges', tooling_notes: '150mm casing, SPT hammer, hand pump. Compact for tight access.', stock_level: 'in_stock', sync_status: 'synced', last_sync_timestamp: ISO(addDays(TODAY, -5)), is_active: true, is_demo_data: true },
      { name: 'Comacchio MC450 Rotary Rig', asset_type: 'rig', is_rig: true, rig_type: 'rotary', serial_number: 'CMC450-007', equipment_type: 'Rotary Drilling Rig', compliance_category: 'Plant', compliance_status: 'compliant', compliance_expiry_date: DATE(addDays(TODAY, 200)), compliance_last_checked: ISO(addDays(TODAY, -8)), last_service_date: DATE(addDays(TODAY, -30)), next_service_date: DATE(addDays(TODAY, 200)), maintenance_status: 'ok', service_notes: 'Full service completed. Hydraulic oil changed. Tested by PlantCert UK.', responsible_person: 'Chris Norman', toolning_notes: 'T76 core barrel, wireline system, double-tube core barrel, PCD bits.', stock_level: 'in_stock', sync_status: 'synced', last_sync_timestamp: ISO(addDays(TODAY, -3)), is_active: true, is_demo_data: true },
      { name: 'Dando 250 Cable Percussion Rig', asset_type: 'rig', is_rig: true, rig_type: 'cp', serial_number: 'D250-0033', equipment_type: 'Cable Percussion Rig', compliance_category: 'Plant', compliance_status: 'expired', compliance_expiry_date: DATE(addDays(TODAY, -5)), compliance_last_checked: ISO(addDays(TODAY, -15)), last_service_date: DATE(addDays(TODAY, -200)), next_service_date: DATE(addDays(TODAY, -5)), maintenance_status: 'overdue', service_notes: 'LOLER expired. Winch cable replacement required before next use.', repair_notes: 'Decommissioned pending LOLER retest.', responsible_person: 'Lee Harding', tooling_notes: '250mm casing, heavy SPT hammer, water swivel.', stock_level: 'needs_service', sync_status: 'synced', last_sync_timestamp: ISO(addDays(TODAY, -5)), is_active: false, is_demo_data: true },
      // Lifting gear
      { name: '1-Tonne Lifting Sling (5m)', asset_type: 'lifting', equipment_type: 'Web Sling', compliance_category: 'Lifting Gear', compliance_status: 'compliant', compliance_expiry_date: DATE(addDays(TODAY, 90)), compliance_last_checked: ISO(addDays(TODAY, -12)), last_service_date: DATE(addDays(TODAY, -12)), next_service_date: DATE(addDays(TODAY, 180)), maintenance_status: 'ok', responsible_person: 'Mike Thornton', stock_level: 'in_stock', sync_status: 'synced', is_active: true, is_demo_data: true },
      { name: '2-Tonne Bow Shackle', asset_type: 'lifting', equipment_type: 'Bow Shackle', compliance_category: 'Lifting Gear', compliance_status: 'compliant', compliance_expiry_date: DATE(addDays(TODAY, 300)), compliance_last_checked: ISO(addDays(TODAY, -12)), maintenance_status: 'ok', responsible_person: 'Mike Thornton', stock_level: 'in_stock', sync_status: 'synced', is_active: true, is_demo_data: true },
      { name: '3-Tonne Chain Sling (2m)', asset_type: 'lifting', equipment_type: 'Chain Sling', compliance_category: 'Lifting Gear', compliance_status: 'expiring', compliance_expiry_date: DATE(addDays(TODAY, 22)), compliance_last_checked: ISO(addDays(TODAY, -12)), maintenance_status: 'due_soon', responsible_person: 'Tom Bridges', stock_level: 'in_stock', sync_status: 'synced', is_active: true, is_demo_data: true },
      { name: 'Tipping Hook 5-Tonne', asset_type: 'lifting', equipment_type: 'Tipping Hook', compliance_category: 'Lifting Gear', compliance_status: 'expired', compliance_expiry_date: DATE(addDays(TODAY, -20)), compliance_last_checked: ISO(addDays(TODAY, -20)), maintenance_status: 'overdue', service_notes: 'LOLER 6-month expired. Requires inspection before use.', responsible_person: 'Lee Harding', stock_level: 'needs_service', sync_status: 'synced', is_active: false, is_demo_data: true },
      // Machinery
      { name: 'JCB 3CX Excavator', asset_type: 'machinery', equipment_type: 'Backhoe Excavator', compliance_category: 'Plant', compliance_status: 'compliant', compliance_last_checked: ISO(addDays(TODAY, -20)), last_service_date: DATE(addDays(TODAY, -60)), next_service_date: DATE(addDays(TODAY, 100)), maintenance_status: 'ok', service_notes: 'PUWER inspection passed. 2-year service interval.', responsible_person: 'Gary Webb', stock_level: 'in_stock', sync_status: 'synced', is_active: true, is_demo_data: true },
      { name: 'Bentonite Grout Mixer', asset_type: 'machinery', equipment_type: 'Colloidal Mixer', compliance_category: 'Plant', compliance_status: 'compliant', compliance_last_checked: ISO(addDays(TODAY, -20)), last_service_date: DATE(addDays(TODAY, -90)), next_service_date: DATE(addDays(TODAY, 250)), maintenance_status: 'ok', responsible_person: 'Chris Norman', stock_level: 'in_stock', sync_status: 'synced', is_active: true, is_demo_data: true },
      { name: 'Honda Water Pump 3"', asset_type: 'machinery', equipment_type: 'Water Pump', compliance_category: 'Plant', compliance_status: 'unknown', compliance_last_checked: ISO(addDays(TODAY, -30)), maintenance_status: 'unknown', responsible_person: 'Neil Foster', stock_level: 'in_stock', sync_status: 'pending', is_active: true, is_demo_data: true },
      // Trailers
      { name: 'Equipment Trailer 3.5t', asset_type: 'trailer', serial_number: 'TRL-007', equipment_type: 'Plant Trailer', compliance_category: 'Vehicle', compliance_status: 'compliant', compliance_last_checked: ISO(addDays(TODAY, -15)), maintenance_status: 'ok', responsible_person: 'Neil Foster', stock_level: 'in_stock', sync_status: 'synced', is_active: true, is_demo_data: true },
      { name: 'Welfare Unit Trailer', asset_type: 'trailer', serial_number: 'WU-003', equipment_type: 'Welfare Unit', compliance_category: 'Vehicle', compliance_status: 'expiring', compliance_expiry_date: DATE(addDays(TODAY, 25)), compliance_last_checked: ISO(addDays(TODAY, -15)), maintenance_status: 'due_soon', responsible_person: 'Neil Foster', stock_level: 'in_stock', sync_status: 'synced', is_active: true, is_demo_data: true },
    ]);
    const [dando200, dando150, comacchio, dando250, sling1T, bowShackle, chainSling, tippingHook, excavator, groutMixer, waterPump, eqTrailer, welfareTrailer] = assets;

    // Link lifting gear to rigs
    await e.SiteAsset.update(dando200.id, { linked_equipment_ids: [sling1T.id, bowShackle.id] });
    await e.SiteAsset.update(dando150.id, { linked_equipment_ids: [chainSling.id] });
    await e.SiteAsset.update(comacchio.id, { linked_equipment_ids: [sling1T.id, bowShackle.id, tippingHook.id] });

    // ============================================================
    // 8. PROJECTS
    // ============================================================
    log('Creating projects...');
    const projects = await e.Project.bulkCreate([
      { name: 'Thameslink Phase 2 Ground Investigation', reference: 'PRJ-2026-014', client_id: arup.id, status: 'active', notes: 'Multi-site investigation for Thameslink railway extension. 8 boreholes across 3 locations.', is_demo_data: true },
      { name: 'Mersey Gateway Foundation Study', reference: 'PRJ-2026-021', client_id: mottMac.id, status: 'active', notes: 'Rotary coring for bridge foundation design. 15 CPTs and 6 rotary holes.', is_demo_data: true },
      { name: 'Leeds Flood Alleviation Scheme', reference: 'PRJ-2026-028', client_id: wsp.id, status: 'active', notes: 'Trial pits and window sampling along proposed flood defence route.', is_demo_data: true },
    ]);
    const [thameslink, merseyGateway, leedsFlood] = projects;

    // ============================================================
    // 9. JOBS
    // ============================================================
    log('Creating jobs...');
    const jobs = await e.Job.bulkCreate([
      // Active CP drilling
      { name: 'BH-01 to BH-04 Battersea Power Station', project_id: thameslink.id, job_reference: 'ARUP-BAT-01', location: 'Battersea Power Station, London SW11', job_type: 'cp_drilling', status: 'in_progress', start_date: DATE(twoWeeksAgo), end_date: DATE(nextMonday), client_id: arup.id, project_manager: 'Sarah Chen', site_contact_name: 'John Bates', site_contact_phone: '07700 111222', notes: '4 No. cable percussion boreholes to 15m. SPTs at 1.5m intervals. Install standpipes in 2 boreholes.', revenue_method: 'meterage_rate', meterage_rate: 65, meterage_target: 60, budget_amount: 18500, vat_rate: 20, is_demo_data: true },
      // Active rotary
      { name: 'CPT-01 to CPT-06 Mersey Gateway', project_id: merseyGateway.id, job_reference: 'MM-MER-02', location: 'Mersey Gateway Bridge, Widnes', job_type: 'rotary_drilling', status: 'in_progress', start_date: DATE(threeWeeksAgo), end_date: DATE(addDays(thisMonday, 4)), client_id: mottMac.id, project_manager: 'James Whitfield', site_contact_name: 'Phil Adams', site_contact_phone: '07700 222333', notes: '6 No. rotary cored boreholes to 25m. U100 sampling in superficial deposits. Install piezometers.', revenue_method: 'meterage_rate', meterage_rate: 120, meterage_target: 150, meterage: 95, budget_amount: 42000, vat_rate: 20, is_demo_data: true },
      // Active groundworks
      { name: 'TP-01 to TP-12 Leeds Flood Defence', project_id: leedsFlood.id, job_reference: 'WSP-LEE-03', location: 'Leeds City Centre - River Aire', job_type: 'groundworks', status: 'in_progress', start_date: DATE(addDays(TODAY, -5)), end_date: DATE(addDays(TODAY, 10)), client_id: wsp.id, project_manager: 'Priya Patel', site_contact_name: 'Rob Eastwood', site_contact_phone: '07700 333444', notes: '12 No. trial pits to 2.5m depth. Window sampling in adjacent locations. CBR tests at formation.', revenue_method: 'unit_rate', unit_price: 350, budget_amount: 12500, vat_rate: 20, is_demo_data: true },
      // Completed CP drilling
      { name: 'BH-15 Kings Cross Station', project_id: thameslink.id, job_reference: 'ARUP-KX-01', location: 'Kings Cross Station, London N1', job_type: 'cp_drilling', status: 'completed', start_date: DATE(fourWeeksAgo), end_date: DATE(threeWeeksAgo), client_id: arup.id, project_manager: 'Sarah Chen', site_contact_name: 'James Hill', site_contact_phone: '07700 111333', notes: '2 No. cable percussion boreholes to 12m. Completed ahead of schedule. Standpipe installed.', revenue_method: 'meterage_rate', meterage_rate: 65, meterage: 24, budget_amount: 6500, actual_cost: 4200, vat_rate: 20, is_demo_data: true },
      // Completed rotary
      { name: 'BH-01 Canary Wharf Crossrail', project_id: merseyGateway.id, job_reference: 'MM-CAN-01', location: 'Canary Wharf, London E14', job_type: 'rotary_drilling', status: 'completed', start_date: DATE(addDays(TODAY, -35)), end_date: DATE(addDays(TODAY, -18)), client_id: mottMac.id, project_manager: 'James Whitfield', site_contact_name: 'Nick Crane', site_contact_phone: '07700 222444', notes: '3 No. rotary cored boreholes to 30m. Chalk and Thanet Sand. Full core recovery achieved.', revenue_method: 'meterage_rate', meterage_rate: 120, meterage: 90, budget_amount: 28000, actual_cost: 19500, vat_rate: 20, is_demo_data: true },
      // Planning
      { name: 'EV Charger Installation Gatwick', project_id: null, job_reference: 'STAN-GAT-01', location: 'Gatwick Airport, South Terminal', job_type: 'groundworks', status: 'planning', start_date: DATE(addDays(thisMonday, 14)), end_date: DATE(addDays(thisMonday, 28)), client_id: stantec.id, project_manager: 'Mark Davies', site_contact_name: 'Airport Ops', site_contact_phone: '01293 503040', notes: '15 No. EV charger foundations. Trenching, ducting, concrete bases.', revenue_method: 'unit_rate', unit_price: 850, budget_amount: 14500, vat_rate: 20, is_demo_data: true },
      // Decommissioning
      { name: 'BH-08 Decommissioning Heathrow', project_id: null, job_reference: 'ARUP-HTR-01', location: 'Heathrow Airport T5', job_type: 'cp_drilling', status: 'decommissioning', start_date: DATE(addDays(TODAY, -12)), end_date: DATE(addDays(TODAY, -2)), client_id: arup.id, project_manager: 'Sarah Chen', notes: 'Borehole decommissioning. Grout backfill to surface. Bentonite seal.', revenue_method: 'flat_fee', client_charge: 3500, client_charge_description: 'Decommissioning Fee', budget_amount: 2800, vat_rate: 20, is_demo_data: true },
    ]);
    const [battersea, mersey, leeds, kingsX, canary, gatwick, heathrow] = jobs;

    // ============================================================
    // 10. BILLING RULES
    // ============================================================
    log('Creating billing rules...');
    await e.BillingRule.bulkCreate([
      { rule_type: 'delivery', name: 'Site Delivery', charge_method: 'flat_plus_mileage', flat_fee: 75, per_mile_rate: 2.5, is_chargeable: true, is_active: true, category: 'deliveries', sort_order: 1, is_demo_data: true },
      { rule_type: 'delivery', name: 'Equipment Collection', charge_method: 'flat_plus_mileage', flat_fee: 50, per_mile_rate: 2.5, is_chargeable: true, is_active: true, category: 'deliveries', sort_order: 2, is_demo_data: true },
      { rule_type: 'task', name: 'Setting up the rig', charge_method: 'flat_fee', flat_fee: 0, is_chargeable: false, is_active: true, category: 'drilling', sort_order: 3, is_demo_data: true },
      { rule_type: 'task', name: 'Putting up heras fencing', charge_method: 'flat_fee', flat_fee: 125, is_chargeable: true, is_active: true, category: 'site_setup', sort_order: 4, is_demo_data: true },
      { rule_type: 'consumable', name: 'Bentonite (25kg bag)', charge_method: 'per_unit', per_unit_rate: 12.50, unit_label: 'bag', is_chargeable: true, is_active: true, category: 'materials', sort_order: 5, is_demo_data: true },
      { rule_type: 'consumable', name: 'Cable Ties (bag)', charge_method: 'per_unit', per_unit_rate: 8.00, unit_label: 'bag', is_chargeable: true, is_active: true, category: 'materials', sort_order: 6, is_demo_data: true },
      { rule_type: 'site_visit', name: 'Ad-hoc Site Visit', charge_method: 'flat_fee', flat_fee: 150, is_chargeable: true, is_active: true, category: 'visits', sort_order: 7, is_demo_data: true },
    ]);

    // ============================================================
    // 11. ROTA ASSIGNMENTS (active jobs)
    // ============================================================
    log('Creating rota assignments...');
    const rotaData = [
      // Battersea - CP Crew A (Mike + Dave)
      { job_id: battersea.id, staff_id: mike.id, assigned_date: DATE(thisMonday), week_start: DATE(thisMonday), vehicle_id: tipper.id, status: 'started', shift_status: 'confirmed', is_demo_data: true },
      { job_id: battersea.id, staff_id: daveH.id, assigned_date: DATE(thisMonday), week_start: DATE(thisMonday), vehicle_id: tipper.id, status: 'started', shift_status: 'confirmed', is_demo_data: true },
      // Mersey - Rotary Crew (Chris + Paul)
      { job_id: mersey.id, staff_id: chrisN.id, assigned_date: DATE(thisMonday), week_start: DATE(thisMonday), vehicle_id: lorry.id, status: 'started', shift_status: 'confirmed', is_demo_data: true },
      { job_id: mersey.id, staff_id: paulA.id, assigned_date: DATE(thisMonday), week_start: DATE(thisMonday), vehicle_id: lorry.id, status: 'started', shift_status: 'confirmed', is_demo_data: true },
      // Leeds - Groundworks (Gary + Steve)
      { job_id: leeds.id, staff_id: garyW.id, assigned_date: DATE(thisMonday), week_start: DATE(thisMonday), vehicle_id: transit.id, status: 'started', shift_status: 'confirmed', is_demo_data: true },
      { job_id: leeds.id, staff_id: steveW.id, assigned_date: DATE(thisMonday), week_start: DATE(thisMonday), vehicle_id: transit.id, status: 'started', shift_status: 'confirmed', is_demo_data: true },
      // Last week assignments
      { job_id: battersea.id, staff_id: mike.id, assigned_date: DATE(lastMonday), week_start: DATE(lastMonday), vehicle_id: tipper.id, status: 'completed', shift_status: 'confirmed', is_demo_data: true },
      { job_id: battersea.id, staff_id: daveH.id, assigned_date: DATE(lastMonday), week_start: DATE(lastMonday), vehicle_id: tipper.id, status: 'completed', shift_status: 'confirmed', is_demo_data: true },
      { job_id: mersey.id, staff_id: chrisN.id, assigned_date: DATE(lastMonday), week_start: DATE(lastMonday), vehicle_id: lorry.id, status: 'completed', shift_status: 'confirmed', is_demo_data: true },
      { job_id: mersey.id, staff_id: paulA.id, assigned_date: DATE(lastMonday), week_start: DATE(lastMonday), vehicle_id: lorry.id, status: 'completed', shift_status: 'confirmed', is_demo_data: true },
      // Kings Cross completed (last week)
      { job_id: kingsX.id, staff_id: tomB.id, assigned_date: DATE(lastMonday), week_start: DATE(lastMonday), vehicle_id: pickup.id, status: 'completed', shift_status: 'confirmed', is_demo_data: true },
      { job_id: kingsX.id, staff_id: leeH.id, assigned_date: DATE(lastMonday), week_start: DATE(lastMonday), vehicle_id: pickup.id, status: 'completed', shift_status: 'confirmed', is_demo_data: true },
      // Canary Wharf completed (3 weeks ago)
      { job_id: canary.id, staff_id: chrisN.id, assigned_date: DATE(twoWeeksAgo), week_start: DATE(twoWeeksAgo), vehicle_id: lorry.id, status: 'completed', shift_status: 'confirmed', is_demo_data: true },
      { job_id: canary.id, staff_id: alanC.id, assigned_date: DATE(twoWeeksAgo), week_start: DATE(twoWeeksAgo), vehicle_id: lorry.id, status: 'completed', shift_status: 'confirmed', is_demo_data: true },
      // Heathrow decommissioning
      { job_id: heathrow.id, staff_id: neilF.id, assigned_date: DATE(threeWeeksAgo), week_start: DATE(threeWeeksAgo), vehicle_id: sprinter.id, status: 'completed', shift_status: 'confirmed', is_demo_data: true },
    ];
    await e.RotaAssignment.bulkCreate(rotaData);

    // ============================================================
    // 12. JOB ASSET ASSIGNMENTS
    // ============================================================
    log('Creating job asset assignments...');
    await e.JobAssetAssignment.bulkCreate([
      { job_id: battersea.id, job_name: 'BH-01 Battersea', asset_id: dando200.id, asset_name: 'Dando 200', asset_type: 'rig', rig_type: 'cp', role: 'primary_rig', compliance_status: 'compliant', status: 'on_site', assigned_date: DATE(twoWeeksAgo), arrived_on_site_date: DATE(twoWeeksAgo), is_demo_data: true },
      { job_id: battersea.id, job_name: 'BH-01 Battersea', asset_id: sling1T.id, asset_name: '1T Lifting Sling', asset_type: 'lifting', role: 'lifting', compliance_status: 'compliant', status: 'on_site', assigned_date: DATE(twoWeeksAgo), is_demo_data: true },
      { job_id: battersea.id, job_name: 'BH-01 Battersea', asset_id: bowShackle.id, asset_name: '2T Bow Shackle', asset_type: 'lifting', role: 'lifting', compliance_status: 'compliant', status: 'on_site', assigned_date: DATE(twoWeeksAgo), is_demo_data: true },
      { job_id: mersey.id, job_name: 'CPT-01 Mersey', asset_id: comacchio.id, asset_name: 'Comacchio MC450', asset_type: 'rig', rig_type: 'rotary', role: 'primary_rig', compliance_status: 'compliant', status: 'on_site', assigned_date: DATE(threeWeeksAgo), arrived_on_site_date: DATE(threeWeeksAgo), is_demo_data: true },
      { job_id: mersey.id, job_name: 'CPT-01 Mersey', asset_id: groutMixer.id, asset_name: 'Bentonite Grout Mixer', asset_type: 'machinery', role: 'machinery', compliance_status: 'compliant', status: 'on_site', assigned_date: DATE(threeWeeksAgo), is_demo_data: true },
      { job_id: leeds.id, job_name: 'TP-01 Leeds', asset_id: excavator.id, asset_name: 'JCB 3CX Excavator', asset_type: 'machinery', role: 'machinery', compliance_status: 'compliant', status: 'on_site', assigned_date: DATE(addDays(TODAY, -5)), is_demo_data: true },
      { job_id: leeds.id, job_name: 'TP-01 Leeds', asset_id: eqTrailer.id, asset_name: 'Equipment Trailer', asset_type: 'trailer', role: 'trailer', compliance_status: 'compliant', status: 'on_site', assigned_date: DATE(addDays(TODAY, -5)), is_demo_data: true },
      { job_id: kingsX.id, job_name: 'BH-15 Kings Cross', asset_id: dando150.id, asset_name: 'Dando 150 Cutdown', asset_type: 'rig', rig_type: 'cp', role: 'primary_rig', compliance_status: 'expiring', status: 'returned', assigned_date: DATE(fourWeeksAgo), arrived_on_site_date: DATE(fourWeeksAgo), returned_date: DATE(threeWeeksAgo), is_demo_data: true },
      { job_id: canary.id, job_name: 'BH-01 Canary Wharf', asset_id: comacchio.id, asset_name: 'Comacchio MC450', asset_type: 'rig', rig_type: 'rotary', role: 'primary_rig', compliance_status: 'compliant', status: 'returned', assigned_date: DATE(addDays(TODAY, -35)), returned_date: DATE(addDays(TODAY, -18)), is_demo_data: true },
    ]);

    // ============================================================
    // 13. JOB COST ITEMS
    // ============================================================
    log('Creating job cost items...');
    await e.JobCostItem.bulkCreate([
      // Battersea
      { job_id: battersea.id, category: 'internal_equipment', description: 'Dando 200 Cable Percussion Rig', site_asset_id: dando200.id, unit_cost: 0, quantity: 10, unit_label: 'day', start_date: DATE(twoWeeksAgo), end_date: DATE(nextMonday), current_location: 'site', is_demo_data: true },
      { job_id: battersea.id, category: 'labour', staff_id: mike.id, description: 'CP Driller (Lead)', unit_cost: 320, quantity: 10, unit_label: 'day', men: 1, start_date: DATE(twoWeeksAgo), end_date: DATE(nextMonday), is_demo_data: true },
      { job_id: battersea.id, category: 'labour', staff_id: daveH.id, description: 'CP Driller (Second Man)', unit_cost: 220, quantity: 10, unit_label: 'day', men: 1, start_date: DATE(twoWeeksAgo), end_date: DATE(nextMonday), is_demo_data: true },
      { job_id: battersea.id, category: 'purchased_equipment', supplier_id: bentoniteSupp.id, description: 'Bentonite Powder 25kg', unit_cost: 12.50, quantity: 20, unit_label: 'bag', po_number: 'PO-2026-0042', start_date: DATE(twoWeeksAgo), current_location: 'site', is_demo_data: true },
      { job_id: battersea.id, category: 'hired_equipment', supplier_id: plantHire.id, description: 'Welfare Unit Hire', unit_cost: 45, quantity: 10, unit_label: 'day', start_date: DATE(twoWeeksAgo), end_date: DATE(nextMonday), hire_status: 'active', current_location: 'site', is_demo_data: true },
      // Mersey
      { job_id: mersey.id, category: 'internal_equipment', description: 'Comacchio MC450 Rotary Rig', site_asset_id: comacchio.id, unit_cost: 0, quantity: 15, unit_label: 'day', start_date: DATE(threeWeeksAgo), end_date: DATE(addDays(thisMonday, 4)), current_location: 'site', is_demo_data: true },
      { job_id: mersey.id, category: 'labour', staff_id: chrisN.id, description: 'Rotary Driller (Lead)', unit_cost: 380, quantity: 15, unit_label: 'day', men: 1, start_date: DATE(threeWeeksAgo), end_date: DATE(addDays(thisMonday, 4)), is_demo_data: true },
      { job_id: mersey.id, category: 'labour', staff_id: paulA.id, description: 'Rotary Driller (Second Man)', unit_cost: 240, quantity: 15, unit_label: 'day', men: 1, start_date: DATE(threeWeeksAgo), end_date: DATE(addDays(thisMonday, 4)), is_demo_data: true },
      { job_id: mersey.id, category: 'purchased_equipment', supplier_id: geoCore.id, description: 'T76 Core Barrel & Bits', unit_cost: 850, quantity: 2, unit_label: 'each', po_number: 'PO-2026-0048', start_date: DATE(threeWeeksAgo), current_location: 'site', is_demo_data: true },
      { job_id: mersey.id, category: 'purchased_equipment', supplier_id: bentoniteSupp.id, description: 'Bentonite Powder 25kg', unit_cost: 12.50, quantity: 40, unit_label: 'bag', po_number: 'PO-2026-0049', start_date: DATE(threeWeeksAgo), current_location: 'site', is_demo_data: true },
      // Leeds
      { job_id: leeds.id, category: 'internal_equipment', description: 'JCB 3CX Excavator', site_asset_id: excavator.id, unit_cost: 0, quantity: 5, unit_label: 'day', start_date: DATE(addDays(TODAY, -5)), end_date: DATE(addDays(TODAY, 10)), current_location: 'site', is_demo_data: true },
      { job_id: leeds.id, category: 'labour', staff_id: garyW.id, description: 'Groundworker (Lead)', unit_cost: 280, quantity: 5, unit_label: 'day', men: 1, start_date: DATE(addDays(TODAY, -5)), end_date: DATE(addDays(TODAY, 10)), is_demo_data: true },
      { job_id: leeds.id, category: 'labour', staff_id: steveW.id, description: 'Groundworker (Second Man)', unit_cost: 200, quantity: 5, unit_label: 'day', men: 1, start_date: DATE(addDays(TODAY, -5)), end_date: DATE(addDays(TODAY, 10)), is_demo_data: true },
      // Kings Cross (completed)
      { job_id: kingsX.id, category: 'internal_equipment', description: 'Dando 150 Cutdown Rig', site_asset_id: dando150.id, unit_cost: 0, quantity: 5, unit_label: 'day', start_date: DATE(fourWeeksAgo), end_date: DATE(threeWeeksAgo), current_location: 'returned', return_destination: 'depot', is_demo_data: true },
      { job_id: kingsX.id, category: 'labour', staff_id: tomB.id, description: 'CP Driller (Lead)', unit_cost: 320, quantity: 5, unit_label: 'day', men: 1, start_date: DATE(fourWeeksAgo), end_date: DATE(threeWeeksAgo), is_demo_data: true },
      { job_id: kingsX.id, category: 'labour', staff_id: leeH.id, description: 'CP Driller (Second Man)', unit_cost: 220, quantity: 5, unit_label: 'day', men: 1, start_date: DATE(fourWeeksAgo), end_date: DATE(threeWeeksAgo), is_demo_data: true },
      // Canary Wharf (completed)
      { job_id: canary.id, category: 'internal_equipment', description: 'Comacchio MC450 Rotary Rig', site_asset_id: comacchio.id, unit_cost: 0, quantity: 12, unit_label: 'day', start_date: DATE(addDays(TODAY, -35)), end_date: DATE(addDays(TODAY, -18)), current_location: 'returned', return_destination: 'depot', is_demo_data: true },
      { job_id: canary.id, category: 'labour', staff_id: chrisN.id, description: 'Rotary Driller (Lead)', unit_cost: 380, quantity: 12, unit_label: 'day', men: 1, is_demo_data: true },
      { job_id: canary.id, category: 'labour', staff_id: alanC.id, description: 'Rotary Driller (Subcontractor)', unit_cost: 350, quantity: 12, unit_label: 'day', men: 1, is_demo_data: true },
      { job_id: canary.id, category: 'purchased_equipment', supplier_id: geoCore.id, description: 'PCD Core Bits', unit_cost: 320, quantity: 5, unit_label: 'each', po_number: 'PO-2026-0031', current_location: 'returned', is_demo_data: true },
      // Heathrow
      { job_id: heathrow.id, category: 'labour', staff_id: neilF.id, description: 'Enabling Works Operative', unit_cost: 250, quantity: 4, unit_label: 'day', men: 1, is_demo_data: true },
      { job_id: heathrow.id, category: 'purchased_equipment', supplier_id: bentoniteSupp.id, description: 'Bentonite Pellets (for sealing)', unit_cost: 18, quantity: 15, unit_label: 'bag', po_number: 'PO-2026-0038', is_demo_data: true },
    ]);

    // ============================================================
    // 14. TIMESHEETS (4 weeks of history)
    // ============================================================
    log('Creating timesheets...');
    const timesheetEntries = [];
    const staffJobMap = [
      { staff_id: mike.id, job_id: battersea.id },
      { staff_id: daveH.id, job_id: battersea.id },
      { staff_id: chrisN.id, job_id: mersey.id },
      { staff_id: paulA.id, job_id: mersey.id },
      { staff_id: tomB.id, job_id: kingsX.id },
      { staff_id: leeH.id, job_id: kingsX.id },
      { staff_id: garyW.id, job_id: leeds.id },
      { staff_id: steveW.id, job_id: leeds.id },
      { staff_id: chrisN.id, job_id: canary.id },
      { staff_id: neilF.id, job_id: heathrow.id },
    ];

    // Generate weekly summary timesheets for the past 4 weeks
    for (const { staff_id, job_id } of staffJobMap) {
      for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
        const ws = addDays(thisMonday, -weekOffset * 7);
        // Skip future-dated entries for jobs not active in that week
        const job = jobs.find(j => j.id === job_id);
        if (job) {
          const jobStart = new Date(job.start_date);
          const jobEnd = new Date(job.end_date);
          const weekEnd = addDays(ws, 4);
          if (weekEnd < jobStart || ws > jobEnd) continue;
        }
        const minutesOnSite = 540; // 9 hours
        const travelMinutes = 60;
        const isApproved = weekOffset >= 1;
        const status = isApproved ? 'approved' : 'submitted';
        const meterage = job_id === battersea.id || job_id === mersey.id || job_id === canary.id || job_id === kingsX.id ? Math.round(2 + Math.random() * 8) : null;
        timesheetEntries.push({
          staff_id,
          job_id,
          date: DATE(ws),
          week_start: DATE(ws),
          task_description: 'Daily site work',
          total_hours: Math.round((minutesOnSite + travelMinutes) / 60 * 10) / 10,
          on_site_minutes: minutesOnSite,
          travel_to_minutes: 30,
          travel_from_minutes: 30,
          meterage,
          status,
          approved_by_name: isApproved ? 'Sarah Mitchell' : '',
          is_summary: true,
          is_weekly_summary: false,
          is_demo_data: true,
        });
      }
    }
    // Batch create in chunks of 100
    for (let i = 0; i < timesheetEntries.length; i += 100) {
      await e.Timesheet.bulkCreate(timesheetEntries.slice(i, i + 100));
    }

    // ============================================================
    // 15. INVESTIGATION LOGS
    // ============================================================
    log('Creating investigation logs...');
    await e.InvestigationLog.bulkCreate([
      { job_id: battersea.id, staff_id: mike.id, staff_name: 'Mike Thornton', date: DATE(addDays(TODAY, -3)), log_type: 'borehole_progress', borehole_ref: 'BH-01', depth_from: 0, depth_to: 5, strata_descriptor: 'made_ground', strata_description_detail: 'Made ground — sandy gravel with brick fragments', duration_minutes: 180, meterage: 5, units_completed: 5, units_label: 'metres', description: 'Drilling through made ground. Good progress.', manager_review_status: 'approved', manager_reviewed_by: 'Sarah Mitchell', chargeable: true, is_demo_data: true },
      { job_id: battersea.id, staff_id: mike.id, staff_name: 'Mike Thornton', date: DATE(addDays(TODAY, -3)), log_type: 'sample_collection', borehole_ref: 'BH-01', depth_from: 1.5, depth_to: 3.0, sample_id: 'S-01', sample_type: 'disturbed', description: 'Disturbed sample from 1.5-3.0m', manager_review_status: 'approved', manager_reviewed_by: 'Sarah Mitchell', chargeable: true, is_demo_data: true },
      { job_id: battersea.id, staff_id: mike.id, staff_name: 'Mike Thornton', date: DATE(addDays(TODAY, -2)), log_type: 'borehole_progress', borehole_ref: 'BH-01', depth_from: 5, depth_to: 10, strata_descriptor: 'clay_stiff', strata_description_detail: 'Stiff grey slightly sandy CLAY', duration_minutes: 300, meterage: 5, spt_blows: [8, 12, 15], spt_n_value: 27, description: 'SPT at 7.5m. Stiff clay. Good recovery.', manager_review_status: 'pending', chargeable: true, is_demo_data: true },
      { job_id: battersea.id, staff_id: daveH.id, staff_name: 'Dave Hughes', date: DATE(addDays(TODAY, -1)), log_type: 'borehole_progress', borehole_ref: 'BH-02', depth_from: 0, depth_to: 3, strata_descriptor: 'topsoil', strata_description_detail: 'Topsoil — dark brown sandy silt', duration_minutes: 120, meterage: 3, description: 'Started BH-02. Topsoil to 0.5m then made ground.', manager_review_status: 'pending', chargeable: true, is_demo_data: true },
      { job_id: battersea.id, staff_id: mike.id, staff_name: 'Mike Thornton', date: DATE(addDays(TODAY, -1)), log_type: 'standpipe_reading', borehole_ref: 'BH-01', standpipe_ref: 'SP-01', standpipe_reading_m: 2.5, description: 'Standpipe installed in BH-01. Initial groundwater strike at 2.5mBGL.', manager_review_status: 'pending', chargeable: true, is_demo_data: true },
      // Mersey
      { job_id: mersey.id, staff_id: chrisN.id, staff_name: 'Chris Norman', date: DATE(addDays(TODAY, -2)), log_type: 'borehole_progress', borehole_ref: 'CPT-01', depth_from: 10, depth_to: 15, strata_descriptor: 'sandstone', strata_description_detail: 'Weak yellow fine-grained SANDSTONE', duration_minutes: 240, meterage: 5, coring_recovery: 95, coring_rqd: 82, core_run_number: 'C3', description: 'Rotary coring CPT-01. Good recovery in sandstone. Rock at 12m.', manager_review_status: 'approved', manager_reviewed_by: 'Sarah Mitchell', chargeable: true, is_demo_data: true },
      { job_id: mersey.id, staff_id: chrisN.id, staff_name: 'Chris Norman', date: DATE(addDays(TODAY, -1)), log_type: 'core_inspection', borehole_ref: 'CPT-01', core_box_number: 'CB-03', depth_from: 15, depth_to: 20, coring_recovery: 88, coring_rqd: 75, description: 'Core inspection CPT-01 run 3. Moderate fracture spacing.', manager_review_status: 'pending', chargeable: true, is_demo_data: true },
      { job_id: mersey.id, staff_id: paulA.id, staff_name: 'Paul Atkins', date: DATE(addDays(TODAY, -3)), log_type: 'borehole_progress', borehole_ref: 'CPT-02', depth_from: 0, depth_to: 8, strata_descriptor: 'clay_firm', strata_description_detail: 'Firm brown sandy clay with gravel', duration_minutes: 360, meterage: 8, description: 'CPT-02 rotary coring through glacial till.', manager_review_status: 'approved', manager_reviewed_by: 'Sarah Mitchell', chargeable: true, is_demo_data: true },
      // Leeds
      { job_id: leeds.id, staff_id: garyW.id, staff_name: 'Gary Webb', date: DATE(addDays(TODAY, -2)), log_type: 'pit_excavation', borehole_ref: 'TP-01', depth_from: 0, depth_to: 2.5, dimensions: '1.2m x 0.8m x 2.5m deep', strata_descriptor: 'clay_firm', strata_description_detail: 'Firm brown sandy clay', duration_minutes: 90, units_completed: 1, units_label: 'pits', pit_stability_rating: 'stable', description: 'Trial pit TP-01 excavated to 2.5m. No services encountered. Stable sidewalls.', manager_review_status: 'approved', manager_reviewed_by: 'Sarah Mitchell', chargeable: true, is_demo_data: true },
      { job_id: leeds.id, staff_id: garyW.id, staff_name: 'Gary Webb', date: DATE(addDays(TODAY, -1)), log_type: 'pit_excavation', borehole_ref: 'TP-02', depth_from: 0, depth_to: 2.0, dimensions: '1.2m x 0.8m x 2.0m deep', strata_descriptor: 'sand_medium_dense', strata_description_detail: 'Medium dense brown sand with gravel', duration_minutes: 75, units_completed: 1, units_label: 'pits', pit_stability_rating: 'minor_slumping', service_encounter_type: 'water', service_encounter_gps: '53.7984,-1.5438', service_check_by_type: 'internal_staff', service_check_by_name: 'Gary Webb', description: 'TP-02 — water service found at 0.8m. GPS logged. Minor sidewall slumping in sand.', manager_review_status: 'queried', manager_review_note: 'Check service diversion record with client.', manager_reviewed_by: 'Sarah Mitchell', chargeable: true, is_demo_data: true },
      // Kings Cross (completed)
      { job_id: kingsX.id, staff_id: tomB.id, staff_name: 'Tom Bridges', date: DATE(threeWeeksAgo), log_type: 'borehole_progress', borehole_ref: 'BH-15', depth_from: 0, depth_to: 12, strata_descriptor: 'clay_stiff', strata_description_detail: 'Stiff grey London Clay', duration_minutes: 480, meterage: 12, description: 'BH-15 completed to 12m. London Clay throughout.', manager_review_status: 'approved', manager_reviewed_by: 'Sarah Mitchell', chargeable: true, is_demo_data: true },
      // Canary Wharf (completed)
      { job_id: canary.id, staff_id: chrisN.id, staff_name: 'Chris Norman', date: DATE(addDays(TODAY, -20)), log_type: 'borehole_progress', borehole_ref: 'BH-01', depth_from: 20, depth_to: 30, strata_descriptor: 'chalk', strata_description_detail: 'Weak white CHALK with flint bands', duration_minutes: 360, meterage: 10, coring_recovery: 92, coring_rqd: 85, core_run_number: 'C4', description: 'BH-01 final core run. Chalk with flints. Good recovery.', manager_review_status: 'approved', manager_reviewed_by: 'Sarah Mitchell', chargeable: true, is_demo_data: true },
      { job_id: canary.id, staff_id: chrisN.id, staff_name: 'Chris Norman', date: DATE(addDays(TODAY, -19)), log_type: 'borehole_decommissioning', borehole_ref: 'BH-01', seal_depth: 30, backfill_material: 'Bentonite cement grout', grout_volume: 150, grout_mix_ratio: '1:1 cement:bentonite', mixer_type: 'machine_mixer', description: 'BH-01 backfilled with bentonite-cement grout to surface. Environmental seal complete.', manager_review_status: 'approved', manager_reviewed_by: 'Sarah Mitchell', chargeable: true, is_demo_data: true },
      // Heathrow
      { job_id: heathrow.id, staff_id: neilF.id, staff_name: 'Neil Foster', date: DATE(addDays(TODAY, -8)), log_type: 'grouting_works', borehole_ref: 'BH-08', seal_depth: 15, grout_volume: 200, grout_mix_ratio: '1:1 cement:bentonite', mixer_type: 'machine_mixer', description: 'BH-08 grouted to 15m. Bentonite-cement seal for decommissioning.', manager_review_status: 'approved', manager_reviewed_by: 'Sarah Mitchell', chargeable: true, is_demo_data: true },
    ]);

    // ============================================================
    // 16. SAFETY REPORTS
    // ============================================================
    log('Creating safety reports...');
    await e.SafetyReport.bulkCreate([
      { safetyculture_audit_id: 'SC-DEMO-001', audit_template_name: 'Daily Plant Inspection', audit_title: 'Dando 200 - Daily Inspection', auditor_name: 'Mike Thornton', job_id: battersea.id, job_name: 'BH-01 Battersea', site_name: 'Battersea Power Station', conducted_at: ISO(addDays(TODAY, -3)), completed_at: ISO(addDays(TODAY, -3)), overall_score: 18, max_score: 20, score_percentage: 90, pass_fail: 'pass', items_passed: 18, items_failed: 2, action_items: [{ description: 'Replace damaged handrail on rig platform', priority: 'medium', assignee: 'Mike Thornton', due_date: DATE(addDays(TODAY, 7)) }], status: 'actioned', is_demo_data: true },
      { safetyculture_audit_id: 'SC-DEMO-002', audit_template_name: 'Site Risk Assessment', audit_title: 'Mersey Gateway - Site RAMS', auditor_name: 'Chris Norman', job_id: mersey.id, job_name: 'CPT-01 Mersey', site_name: 'Mersey Gateway Bridge', conducted_at: ISO(addDays(TODAY, -5)), completed_at: ISO(addDays(TODAY, -5)), overall_score: 22, max_score: 25, score_percentage: 88, pass_fail: 'pass', items_passed: 22, items_failed: 3, action_items: [{ description: 'Install additional edge protection near borehole location', priority: 'high', assignee: 'Chris Norman', due_date: DATE(addDays(TODAY, 3)) }, { description: 'Update traffic management plan', priority: 'medium', assignee: 'Paul Atkins', due_date: DATE(addDays(TODAY, 7)) }], status: 'open', is_demo_data: true },
      { safetyculture_audit_id: 'SC-DEMO-003', audit_template_name: 'Permit to Dig', audit_title: 'Leeds TP-02 - Permit to Dig', auditor_name: 'Gary Webb', job_id: leeds.id, job_name: 'TP-01 Leeds', site_name: 'Leeds City Centre', conducted_at: ISO(addDays(TODAY, -1)), completed_at: ISO(addDays(TODAY, -1)), overall_score: 14, max_score: 15, score_percentage: 93, pass_fail: 'pass', items_passed: 14, items_failed: 1, action_items: [{ description: 'Re-verify service positions with CAT scan before continuing', priority: 'critical', assignee: 'Gary Webb', due_date: DATE(addDays(TODAY, 1)) }], status: 'open', is_demo_data: true },
    ]);

    // ============================================================
    // 17. INVOICES
    // ============================================================
    log('Creating invoices...');
    await e.Invoice.bulkCreate([
      { invoice_number: 'INV-2026-0001', job_id: kingsX.id, job_name: 'BH-15 Kings Cross', job_reference: 'ARUP-KX-01', client_id: arup.id, client_name: 'Arup Geotechnics', status: 'paid', issue_date: DATE(threeWeeksAgo), due_date: DATE(addDays(threeWeeksAgo, 30)), line_items: [{ description: 'Cable percussion drilling - 24m @ £65/m', quantity: 24, unit_label: 'm', unit_cost: 65, line_total: 1560, category: 'drilling' }, { description: 'CP Driller (Lead) - 5 days', quantity: 5, unit_label: 'day', unit_cost: 320, line_total: 1600, category: 'labour' }, { description: 'CP Driller (Second Man) - 5 days', quantity: 5, unit_label: 'day', unit_cost: 220, line_total: 1100, category: 'labour' }, { description: 'Bentonite - 10 bags', quantity: 10, unit_label: 'bag', unit_cost: 12.50, line_total: 125, category: 'materials' }], net_total: 4385, vat_rate: 20, vat_total: 877, gross_total: 5262, revenue_method: 'meterage_rate', raised_by_name: 'Admin', sent_at: ISO(threeWeeksAgo), paid_at: ISO(addDays(threeWeeksAgo, 14)), is_demo_data: true },
      { invoice_number: 'INV-2026-0002', job_id: canary.id, job_name: 'BH-01 Canary Wharf', job_reference: 'MM-CAN-01', client_id: mottMac.id, client_name: 'Mott MacDonald', status: 'sent', issue_date: DATE(addDays(TODAY, -10)), due_date: DATE(addDays(TODAY, 20)), line_items: [{ description: 'Rotary coring - 90m @ £120/m', quantity: 90, unit_label: 'm', unit_cost: 120, line_total: 10800, category: 'drilling' }, { description: 'Rotary Driller (Lead) - 12 days', quantity: 12, unit_label: 'day', unit_cost: 380, line_total: 4560, category: 'labour' }, { description: 'Rotary Driller (Subcontractor) - 12 days', quantity: 12, unit_label: 'day', unit_cost: 350, line_total: 4200, category: 'labour' }, { description: 'PCD Core Bits - 5 each', quantity: 5, unit_label: 'each', unit_cost: 320, line_total: 1600, category: 'materials' }], net_total: 21160, vat_rate: 20, vat_total: 4232, gross_total: 25392, revenue_method: 'meterage_rate', raised_by_name: 'Admin', sent_at: ISO(addDays(TODAY, -10)), is_demo_data: true },
      { invoice_number: 'INV-2026-0003', job_id: heathrow.id, job_name: 'BH-08 Decommissioning', job_reference: 'ARUP-HTR-01', client_id: arup.id, client_name: 'Arup Geotechnics', status: 'draft', issue_date: DATE(addDays(TODAY, -2)), due_date: DATE(addDays(TODAY, 28)), line_items: [{ description: 'Borehole decommissioning - flat fee', quantity: 1, unit_label: 'sum', unit_cost: 3500, line_total: 3500, category: 'decommissioning' }], net_total: 3500, vat_rate: 20, vat_total: 700, gross_total: 4200, revenue_method: 'flat_fee', raised_by_name: 'Admin', is_demo_data: true },
    ]);

    // ============================================================
    // 18. JOB MILESTONES
    // ============================================================
    log('Creating milestones...');
    await e.JobMilestone.bulkCreate([
      { job_id: battersea.id, name: 'BH-01 Complete', target_date: DATE(addDays(TODAY, -1)), completed: true, completed_date: DATE(addDays(TODAY, -1)), sort_order: 1, is_demo_data: true },
      { job_id: battersea.id, name: 'BH-02 Complete', target_date: DATE(addDays(TODAY, 2)), sort_order: 2, is_demo_data: true },
      { job_id: battersea.id, name: 'BH-03 Complete', target_date: DATE(addDays(TODAY, 5)), sort_order: 3, is_demo_data: true },
      { job_id: battersea.id, name: 'BH-04 Complete', target_date: DATE(addDays(TODAY, 8)), sort_order: 4, is_demo_data: true },
      { job_id: mersey.id, name: 'CPT-01 to CPT-03 Complete', target_date: DATE(addDays(TODAY, -2)), completed: true, completed_date: DATE(addDays(TODAY, -2)), sort_order: 1, is_demo_data: true },
      { job_id: mersey.id, name: 'CPT-04 to CPT-06 Complete', target_date: DATE(addDays(thisMonday, 4)), sort_order: 2, is_demo_data: true },
      { job_id: leeds.id, name: 'TP-01 to TP-06 Complete', target_date: DATE(addDays(TODAY, 3)), sort_order: 1, is_demo_data: true },
      { job_id: leeds.id, name: 'TP-07 to TP-12 Complete', target_date: DATE(addDays(TODAY, 9)), sort_order: 2, is_demo_data: true },
      { job_id: kingsX.id, name: 'BH-15 Complete', target_date: DATE(threeWeeksAgo), completed: true, completed_date: DATE(threeWeeksAgo), sort_order: 1, is_demo_data: true },
      { job_id: canary.id, name: 'All BH Complete', target_date: DATE(addDays(TODAY, -18)), completed: true, completed_date: DATE(addDays(TODAY, -18)), sort_order: 1, is_demo_data: true },
    ]);

    // ============================================================
    // 19. JOB COMMENTS
    // ============================================================
    log('Creating job comments...');
    await e.JobComment.bulkCreate([
      { job_id: battersea.id, author_name: 'Sarah Chen', message: 'Client requested additional SPTs at 1.5m intervals in BH-01. Confirmed scope change.', is_client: false, is_demo_data: true },
      { job_id: battersea.id, author_name: 'Mike Thornton', message: 'Groundwater strike at 2.5m in BH-01. Standpipe installed. Will monitor next visit.', is_client: false, is_demo_data: true },
      { job_id: mersey.id, author_name: 'James Whitfield', message: 'Excellent core recovery in the chalk. Please photograph core boxes before dispatch to lab.', is_client: false, is_demo_data: true },
      { job_id: leeds.id, author_name: 'Priya Patel', message: 'Water service found in TP-02 at 0.8m. GPS logged. Please halt excavation and await service diversion.', is_client: false, is_demo_data: true },
      { job_id: kingsX.id, author_name: 'Sarah Chen', message: 'Great work — completed ahead of schedule. Final invoice approved.', is_client: false, is_demo_data: true },
    ]);

    // ============================================================
    // 20. HOTEL BOOKINGS
    // ============================================================
    log('Creating hotel bookings...');
    await e.HotelBooking.bulkCreate([
      { job_id: mersey.id, job_name: 'CPT-01 Mersey', assigned_staff_ids: [chrisN.id, paulA.id], assigned_staff_names: ['Chris Norman', 'Paul Atkins'], hotel_name: 'Premier Inn Widnes', address: 'Widnes WA8 6RT', check_in_date: DATE(thisMonday), check_out_date: DATE(addDays(thisMonday, 4)), booking_reference: 'PI-884722', po_number: 'PO-2026-0050', room_type: 'Twin', room_count: 2, cost_per_night: 65, contact_phone: '0151 555 0100', notes: 'Breakfast included. Parking on site.', is_demo_data: true },
      { job_id: leeds.id, job_name: 'TP-01 Leeds', assigned_staff_ids: [garyW.id, steveW.id], assigned_staff_names: ['Gary Webb', 'Steve Walsh'], hotel_name: 'Travelodge Leeds Central', address: 'Leeds LS1 4BR', check_in_date: DATE(addDays(TODAY, -5)), check_out_date: DATE(addDays(TODAY, 10)), booking_reference: 'TL-552193', room_type: 'Double', room_count: 2, cost_per_night: 55, contact_phone: '0871 555 0200', is_demo_data: true },
    ]);

    // ============================================================
    // 21. DELIVERY LOGS
    // ============================================================
    log('Creating delivery logs...');
    await e.DeliveryLog.bulkCreate([
      { job_id: battersea.id, job_name: 'BH-01 Battersea', driver_staff_id: neilF.id, driver_staff_name: 'Neil Foster', delivery_type: 'site_delivery', status: 'completed', items: 'Dando 200 Rig, casing, SPT hammer, welfare unit', pickup_address: 'Ground Control Depot, Manchester', delivery_address: 'Battersea Power Station, London SW11', contact_name: 'Mike Thornton', contact_phone: '07700 700100', scheduled_date: DATE(twoWeeksAgo), started_at: ISO(addDays(twoWeeksAgo, 0.3)), completed_at: ISO(addDays(twoWeeksAgo, 0.6)), signed_by_name: 'Mike Thornton', miles: 420, chargeable: true, billing_status: 'auto', vehicle_id: lorry.id, weight_kg: 2800, is_demo_data: true },
      { job_id: mersey.id, job_name: 'CPT-01 Mersey', driver_staff_id: neilF.id, driver_staff_name: 'Neil Foster', delivery_type: 'site_delivery', status: 'completed', items: 'Comacchio MC450, core barrels, grout mixer', pickup_address: 'Ground Control Depot, Manchester', delivery_address: 'Mersey Gateway Bridge, Widnes', contact_name: 'Chris Norman', contact_phone: '07700 700104', scheduled_date: DATE(threeWeeksAgo), completed_at: ISO(addDays(threeWeeksAgo, 0.5)), signed_by_name: 'Chris Norman', miles: 35, chargeable: true, billing_status: 'auto', vehicle_id: lorry.id, weight_kg: 3200, is_demo_data: true },
      { job_id: leeds.id, job_name: 'TP-01 Leeds', driver_staff_id: neilF.id, driver_staff_name: 'Neil Foster', delivery_type: 'site_delivery', status: 'completed', items: 'JCB 3CX Excavator, equipment trailer', pickup_address: 'Ground Control Depot, Manchester', delivery_address: 'Leeds City Centre', contact_name: 'Gary Webb', contact_phone: '07700 700106', scheduled_date: DATE(addDays(TODAY, -5)), completed_at: ISO(addDays(TODAY, -4.5)), signed_by_name: 'Gary Webb', miles: 85, chargeable: true, billing_status: 'auto', vehicle_id: lorry.id, weight_kg: 4500, is_demo_data: true },
      { job_id: kingsX.id, job_name: 'BH-15 Kings Cross', driver_staff_id: neilF.id, driver_staff_name: 'Neil Foster', delivery_type: 'site_delivery', status: 'completed', items: 'Dando 150 Cutdown Rig', scheduled_date: DATE(fourWeeksAgo), completed_at: ISO(addDays(fourWeeksAgo, 0.4)), signed_by_name: 'Tom Bridges', miles: 380, chargeable: true, billing_status: 'auto', is_demo_data: true },
    ]);

    // ============================================================
    // 22. JOB DELAY LOGS
    // ============================================================
    log('Creating delay logs...');
    await e.JobDelayLog.bulkCreate([
      { job_id: mersey.id, job_name: 'CPT-01 Mersey', staff_id: chrisN.id, staff_name: 'Chris Norman', reported_at: ISO(addDays(TODAY, -4)), delay_type: 'ground_conditions', impacted_days: 1, impacted_hours: 0, description: 'Boulder obstruction at 12m in CPT-01. Required casing advance and slower drilling. Estimated 1 day impact.', manager_review_status: 'approved', manager_reviewed_by: 'Sarah Mitchell', manager_reviewed_at: ISO(addDays(TODAY, -3)), manager_note: 'Approved. Rota adjusted.', rota_adjusted: true, is_demo_data: true },
      { job_id: leeds.id, job_name: 'TP-01 Leeds', staff_id: garyW.id, staff_name: 'Gary Webb', reported_at: ISO(addDays(TODAY, -1)), delay_type: 'utility_clash', impacted_days: 0, impacted_hours: 4, description: 'Water service found in TP-02. Excavation halted pending service diversion. ~4 hours lost.', manager_review_status: 'pending', is_demo_data: true },
    ]);

    // NOTE: Rate card items (RateCardItem) and the Drilling SOR
    // (InvestigationSOR) are NEVER seeded or wiped by demo data / reset —
    // they hold precious uploaded pricing data. See base44/shared/demoData.ts
    // (PRESERVED_ENTITIES).

    log('Demo data complete!');
    return Response.json({
      success: true,
      message: 'Demo data has been seeded successfully.',
      progress,
      counts: {
        clients: 4,
        suppliers: 3,
        contractors: 3,
        teams: 6,
        vehicles: 5,
        staff: 12,
        site_assets: 13,
        projects: 3,
        jobs: 7,
        billing_rules: 7,
        rota_assignments: rotaData.length,
        job_asset_assignments: 9,
        job_cost_items: 22,
        timesheets: timesheetEntries.length,
        investigation_logs: 15,
        safety_reports: 3,
        invoices: 3,
        milestones: 10,
        comments: 5,
        hotel_bookings: 2,
        delivery_logs: 4,
        delay_logs: 2,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});