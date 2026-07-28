import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// ============================================================
// verifyCIS — HMRC CIS subcontractor verification.
// ============================================================
// Verifies a subcontractor against HMRC's Construction Industry Scheme
// register. Returns the verification status (net 30%, gross 20%, gross 0%,
// or unknown) and stamps the Contractor record.
//
// HMRC CIS API uses OAuth2 (client credentials / application-restricted).
// Credentials are stored as secrets: HMRC_CIS_CLIENT_ID,
// HMRC_CIS_CLIENT_SECRET, HMRC_CIS_TPP_ID (third-party identifier).
// The HMRC CIS verify endpoint: POST /cis/v1.0/verify
//
// Payload: { contractor_id } — verifies a single subcontractor.
//          { action: "test" } — checks HMRC credentials are configured.

const HMRC_BASE = 'https://api-api.service.hmrc.gov.uk';

async function getHmrcToken(): Promise<string | null> {
  const clientId = secrets.get('HMRC_CIS_CLIENT_ID');
  const clientSecret = secrets.get('HMRC_CIS_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  const res = await fetch(`${HMRC_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'read:cis',
    }).toString(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') return Response.json({ ok: false, error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));

    // Test mode — check HMRC credentials are configured
    if (body.action === 'test') {
      const token = await getHmrcToken();
      if (!token) {
        return Response.json({ ok: false, message: 'HMRC CIS credentials not configured — set HMRC_CIS_CLIENT_ID and HMRC_CIS_CLIENT_SECRET secrets.' }, { status: 400 });
      }
      return Response.json({ ok: true, message: 'HMRC CIS credentials configured — ready to verify subcontractors.' });
    }

    const contractorId = body.contractor_id;
    if (!contractorId) return Response.json({ ok: false, error: 'contractor_id is required' }, { status: 400 });

    const contractor = await base44.asServiceRole.entities.Contractor.get(contractorId);
    if (!contractor) return Response.json({ ok: false, error: 'Contractor not found' }, { status: 404 });

    if (!contractor.utr) {
      return Response.json({ ok: false, error: 'Contractor has no UTR — enter the UTR before verifying.' }, { status: 400 });
    }

    const token = await getHmrcToken();
    if (!token) {
      return Response.json({ ok: false, error: 'HMRC CIS credentials not configured — set HMRC_CIS_CLIENT_ID and HMRC_CIS_CLIENT_SECRET secrets in Settings.' }, { status: 400 });
    }

    const tppId = secrets.get('HMRC_CIS_TPP_ID') || '';

    // Call HMRC CIS verify endpoint
    const verifyRes = await fetch(`${HMRC_BASE}/cis/v1.0/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(tppId ? { 'Gov-Client-Connection-Method': 'WEB_APP_VIA_TPP' } : {}),
      },
      body: JSON.stringify({
        subcontractor: {
          utr: contractor.utr,
          ...(contractor.nino ? { nino: contractor.nino } : {}),
          ...(contractor.company_reg_number ? { crn: contractor.company_reg_number } : {}),
        },
        contractor: {
          utr: tppId,
        },
      }),
    });

    if (!verifyRes.ok) {
      const detail = await verifyRes.text().catch(() => '');
      // Mark as failed
      await base44.asServiceRole.entities.Contractor.update(contractorId, {
        cis_status: 'failed',
        cis_verified_at: new Date().toISOString(),
        cis_verified_by: user?.full_name || 'system',
      });
      return Response.json({ ok: false, error: `HMRC verification failed (${verifyRes.status}): ${detail.slice(0, 200)}` }, { status: 502 });
    }

    const verifyData = await verifyRes.json().catch(() => ({}));

    // HMRC returns: verificationNumber, deductionRate (30/20/0), matchedStatus
    const verificationNumber = verifyData.verificationNumber || verifyData.verification_number || '';
    const deductionRate = Number(verifyData.deductionRate ?? verifyData.deduction_rate ?? -1);
    const matched = verifyData.matched ?? verifyData.matchedStatus ?? true;

    let cisStatus: string;
    let taxRate: number;
    if (!matched) {
      cisStatus = 'unknown';
      taxRate = 30; // default to highest deduction when unknown
    } else if (deductionRate === 0) {
      cisStatus = 'verified_gross';
      taxRate = 0;
    } else if (deductionRate === 20) {
      cisStatus = 'verified_gross';
      taxRate = 20;
    } else {
      cisStatus = 'verified_net';
      taxRate = 30;
    }

    await base44.asServiceRole.entities.Contractor.update(contractorId, {
      cis_status: cisStatus,
      cis_tax_rate: taxRate,
      cis_verification_number: verificationNumber,
      cis_verified_at: new Date().toISOString(),
      cis_verified_by: user?.full_name || 'system',
    });

    return Response.json({
      ok: true,
      contractor_id: contractorId,
      cis_status: cisStatus,
      tax_rate: taxRate,
      verification_number: verificationNumber,
      message: `CIS verified — ${cisStatus === 'verified_net' ? '30% deduction (net payer)' : cisStatus === 'verified_gross' ? `Paid gross (${taxRate === 20 ? '20% higher rate' : '0% deduction'})` : 'subcontractor not found in HMRC records'}`,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}