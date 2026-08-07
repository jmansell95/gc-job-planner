import { differenceInDays } from 'npm:date-fns@3.6.0';

// ============================================================
// Shared predictive maintenance logic — used by both the
// predictMaintenance endpoint (dashboard widget) and the
// checkPredictiveMaintenance alert function (scheduled emails).
// ============================================================

const SERVICE_INTERVAL_MILES = 10000;
const MOT_CYCLE_MONTHS = 12;
const HIGH_MILEAGE_THRESHOLD = 150000;
const REPAIR_LOOKBACK_DAYS = 180;

export interface PredictionResult {
  summary: {
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
    mot_due_30d: number;
    mot_expired: number;
    service_due_30d: number;
    service_overdue: number;
  };
  vehicles: any[];
  generated_at: string;
}

export async function generatePredictions(base44: any, vehicle_id?: string): Promise<PredictionResult> {
  const vehicles = vehicle_id
    ? (await base44.asServiceRole.entities.Vehicle.filter({ id: vehicle_id }, '-created_date', 1))
    : await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const allLogs = await base44.asServiceRole.entities.VehicleLocationLog.list('-timestamp', 5000);
  const motHistory = await base44.asServiceRole.entities.VehicleMOTHistory.list('-test_date', 1000);
  const bookings = await base44.asServiceRole.entities.VehicleMaintenanceBooking.list('-booking_date', 1000);

  // Group logs by vehicle
  const mileageByVehicle: Record<string, { first?: number; last?: number; firstTs?: string; lastTs?: string }> = {};
  for (const log of allLogs) {
    if (!log.vehicle_id) continue;
    const ts = new Date(log.timestamp);
    if (ts < since) continue;
    const odo = Number(log.odometer_miles || log.odometer);
    if (!odo) continue;
    const entry = mileageByVehicle[log.vehicle_id] || {};
    if (!entry.first || ts < new Date(entry.firstTs)) {
      entry.first = odo;
      entry.firstTs = log.timestamp;
    }
    if (!entry.last || ts > new Date(entry.lastTs)) {
      entry.last = odo;
      entry.lastTs = log.timestamp;
    }
    mileageByVehicle[log.vehicle_id] = entry;
  }

  // Group MOT history by vehicle
  const motByVehicle: Record<string, any[]> = {};
  for (const m of motHistory) {
    if (!m.vehicle_id) continue;
    if (!motByVehicle[m.vehicle_id]) motByVehicle[m.vehicle_id] = [];
    motByVehicle[m.vehicle_id].push(m);
  }

  // Group bookings by vehicle
  const bookingsByVehicle: Record<string, any[]> = {};
  const cutoff = new Date(Date.now() - REPAIR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  for (const b of bookings) {
    if (!b.vehicle_id) continue;
    if (!bookingsByVehicle[b.vehicle_id]) bookingsByVehicle[b.vehicle_id] = [];
    bookingsByVehicle[b.vehicle_id].push(b);
  }

  const now = new Date();
  const predictions: any[] = [];

  for (const v of vehicles) {
    const mileageEntry = mileageByVehicle[v.id];
    const currentMileage = Number(v.current_mileage) || mileageEntry?.last || 0;

    let dailyRate = 0;
    if (mileageEntry?.first != null && mileageEntry?.last != null && mileageEntry.firstTs && mileageEntry.lastTs) {
      const milesDelta = mileageEntry.last - mileageEntry.first;
      const daysSpan = Math.max(1, differenceInDays(new Date(mileageEntry.lastTs), new Date(mileageEntry.firstTs)));
      dailyRate = milesDelta / daysSpan;
    }

    const motRecords = (motByVehicle[v.id] || []).sort((a, b) => (b.test_date || '').localeCompare(a.test_date || ''));
    const lastMOT = motRecords[0];
    let motPredictedDate: string | null = null;
    let motDaysRemaining: number | null = null;
    if (v.mot_expiry) {
      const exp = new Date(v.mot_expiry + 'T00:00:00');
      motDaysRemaining = differenceInDays(exp, now);
      motPredictedDate = v.mot_expiry;
    } else if (lastMOT?.test_date) {
      const predicted = new Date(lastMOT.test_date + 'T00:00:00');
      predicted.setMonth(predicted.getMonth() + MOT_CYCLE_MONTHS);
      motPredictedDate = predicted.toISOString().slice(0, 10);
      motDaysRemaining = differenceInDays(predicted, now);
    }

    let servicePredictedDate: string | null = null;
    let serviceDaysRemaining: number | null = null;
    let serviceMilesRemaining: number | null = null;
    if (v.service_due_date) {
      const due = new Date(v.service_due_date + 'T00:00:00');
      serviceDaysRemaining = differenceInDays(due, now);
      servicePredictedDate = v.service_due_date;
    } else if (currentMileage > 0 && dailyRate > 0) {
      const milesSinceLastService = currentMileage % SERVICE_INTERVAL_MILES;
      serviceMilesRemaining = SERVICE_INTERVAL_MILES - milesSinceLastService;
      const daysToService = serviceMilesRemaining / dailyRate;
      serviceDaysRemaining = Math.round(daysToService);
      const predicted = new Date(now.getTime() + daysToService * 24 * 60 * 60 * 1000);
      servicePredictedDate = predicted.toISOString().slice(0, 10);
    }

    let riskScore = 0;
    const riskFactors: string[] = [];

    if (currentMileage > HIGH_MILEAGE_THRESHOLD) {
      riskScore += 25;
      riskFactors.push('High mileage');
    } else if (currentMileage > 100000) {
      riskScore += 12;
      riskFactors.push('Elevated mileage');
    }

    if (motDaysRemaining != null) {
      if (motDaysRemaining < 0) {
        riskScore += 30;
        riskFactors.push('MOT expired');
      } else if (motDaysRemaining <= 30) {
        riskScore += 20;
        riskFactors.push('MOT due soon');
      }
    }

    if (serviceDaysRemaining != null) {
      if (serviceDaysRemaining < 0) {
        riskScore += 25;
        riskFactors.push('Service overdue');
      } else if (serviceDaysRemaining <= 14) {
        riskScore += 15;
        riskFactors.push('Service due soon');
      }
    }

    const vehBookings = (bookingsByVehicle[v.id] || []).filter(b => {
      if (!b.booking_date) return false;
      return new Date(b.booking_date + 'T00:00:00') >= cutoff;
    });
    const repairs = vehBookings.filter(b => ['breakdown', 'repair'].includes(b.booking_type));
    if (repairs.length >= 3) {
      riskScore += 20;
      riskFactors.push(`${repairs.length} breakdowns in 6mo`);
    } else if (repairs.length >= 1) {
      riskScore += 10;
      riskFactors.push(`${repairs.length} recent breakdown`);
    }

    const failedMOTs = motRecords.filter(m => m.result === 'fail');
    if (failedMOTs.length >= 2) {
      riskScore += 10;
      riskFactors.push('Repeated MOT failures');
    }

    riskScore = Math.min(100, riskScore);
    const riskLevel = riskScore >= 60 ? 'critical' : riskScore >= 35 ? 'high' : riskScore >= 15 ? 'moderate' : 'low';

    if (!motPredictedDate && !servicePredictedDate && riskScore === 0) continue;

    predictions.push({
      vehicle_id: v.id,
      registration_number: v.registration_number,
      vehicle_name: v.name,
      make: v.make,
      model: v.model,
      current_mileage: Math.round(currentMileage),
      daily_mileage_rate: Math.round(dailyRate * 10) / 10,
      mot_predicted_date: motPredictedDate,
      mot_days_remaining: motDaysRemaining,
      service_predicted_date: servicePredictedDate,
      service_days_remaining: serviceDaysRemaining,
      service_miles_remaining: serviceMilesRemaining,
      risk_score: riskScore,
      risk_level: riskLevel,
      risk_factors: riskFactors,
      recent_repair_count: repairs.length,
      last_mot_result: lastMOT?.result || null,
      last_mot_date: lastMOT?.test_date || null,
    });
  }

  predictions.sort((a, b) => b.risk_score - a.risk_score);

  const summary = {
    total: predictions.length,
    critical: predictions.filter(p => p.risk_level === 'critical').length,
    high: predictions.filter(p => p.risk_level === 'high').length,
    moderate: predictions.filter(p => p.risk_level === 'moderate').length,
    low: predictions.filter(p => p.risk_level === 'low').length,
    mot_due_30d: predictions.filter(p => p.mot_days_remaining != null && p.mot_days_remaining >= 0 && p.mot_days_remaining <= 30).length,
    mot_expired: predictions.filter(p => p.mot_days_remaining != null && p.mot_days_remaining < 0).length,
    service_due_30d: predictions.filter(p => p.service_days_remaining != null && p.service_days_remaining >= 0 && p.service_days_remaining <= 30).length,
    service_overdue: predictions.filter(p => p.service_days_remaining != null && p.service_days_remaining < 0).length,
  };

  return { summary, vehicles: predictions, generated_at: now.toISOString() };
}