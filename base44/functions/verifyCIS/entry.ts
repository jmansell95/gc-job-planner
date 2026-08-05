import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// verifyCIS — HMRC CIS subcontractor verification.
// ============================================================
// Verifies a subcontractor against HMRC's Construction Industry Scheme
// register. Returns the verification status (net 30%, gross 20%, gross 0%,
// or unknown) and stamps the Contractor record.
//
// HMRC CIS API uses OAuth2 (client credentials / application-restricted).
// Credentials are stored in AppSetting keyed 'cis_config' (same pattern as
// Concur / Bob HR): { client_id, client_secret, tpp_id }.
// The HMRC CIS verify endpoint: POST /cis/v1.0/verify
//
// Payload: { contractor_id } — verifies a single subcontractor.
//          { action: "test" } — checks HMRC credentials are configured.

const HMRC_BASE = 'https://api-api.service.hmrc.gov.uk';

async function getCisConfig(base44: any) {
  const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'cis_config' });
  return { cfg: settings[0]?.value || {}, settingsId: settings[0]?.id };
}

async function getHmrcToken(clientId: string, clientSecret: string): Promise<string | null> {
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
      const { cfg } = await getCisConfig(base44);
      const token = await getHmrcToken(cfg.client_id, cfg.client_secret);
      if (!token) {
        return Response.json({ ok: false, message: 'HMRC CIS credentials not configured — enter your client ID, client secret and company UTR (TPP ID) in Settings → CIS Verification.' }, { status: 400 });
      }
      return Response.json({ ok: true, message: 'HMRC CIS credentials configured — ready to verify subcontractors.' });
    }

    // Bulk verify-all mode — re-verify every subcontractor with a UTR.
    // Used by the "Verify All" button and the monthly scheduled automation.
    // Processes sequentially with a small delay to respect HMRC rate limits.
    if (body.action === 'verify_all') {
      const { cfg } = await getCisConfig(base44);
      const token = await getHmrcToken(cfg.client_id, cfg.client_secret);
      if (!token) {
        return Response.json({ ok: false, error: 'HMRC CIS credentials not configured — enter them in Settings → CIS Verification.' }, { status: 400 });
      }
      const allContractors = await base44.asServiceRole.entities.Contractor.list('-created_date', 500);
      const toVerify = allContractors.filter((c: any) => c.utr && c.contractor_type !== 'agency');
      let verified = 0, failed = 0, skipped = 0;
      const errors: any[] = [];
      for (const c of toVerify) {
        try {
          const verifyRes = await fetch(`${HMRC_BASE}/cis/v1.0/verify`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(cfg.tpp_id ? { 'Gov-Client-Connection-Method': 'WEB_APP_VIA_TPP' } : {}),
            },
            body: JSON.stringify({
              subcontractor: {
                utr: c.utr,
                ...(c.nino ? { nino: c.nino } : {}),
                ...(c.company_reg_number ? { crn: c.company_reg_number } : {}),
              },
              contractor: { utr: cfg.tpp_id || '' },
            }),
          });
          if (!verifyRes.ok) {
            failed++;
            errors.push({ name: c.name, status: verifyRes.status });
            await base44.asServiceRole.entities.Contractor.update(c.id, {
              cis_status: 'failed',
              cis_verified_at: new Date().toISOString(),
              cis_verified_by: user?.full_name || 'system',
            });
            continue;
          }
          const verifyData = await verifyRes.json().catch(() => ({}));
          const verificationNumber = verifyData.verificationNumber || verifyData.verification_number || '';
          const deductionRate = Number(verifyData.deductionRate ?? verifyData.deduction_rate ?? -1);
          const matched = verifyData.matched ?? verifyData.matchedStatus ?? true;
          let cisStatus: string, taxRate: number;
          if (!matched) { cisStatus = 'unknown'; taxRate = 30; }
          else if (deductionRate === 0) { cisStatus = 'verified_gross'; taxRate = 0; }
          else if (deductionRate === 20) { cisStatus = 'verified_gross'; taxRate = 20; }
          else { cisStatus = 'verified_net'; taxRate = 30; }
          await base44.asServiceRole.entities.Contractor.update(c.id, {
            cis_status: cisStatus, cis_tax_rate: taxRate,
            cis_verification_number: verificationNumber,
            cis_verified_at: new Date().toISOString(),
            cis_verified_by: user?.full_name || 'system',
          });
          verified++;
          // Small delay to respect HMRC rate limits
          await new Promise(r => setTimeout(r, 200));
        } catch (e: any) {
          failed++; errors.push({ name: c.name, error: e.message || String(e) });
        }
      }
      skipped = allContractors.length - toVerify.length;
      return Response.json({
        ok: true, action: 'verify_all',
        total: toVerify.length, verified, failed, skipped,
        message: `Bulk verification complete — ${verified} verified, ${failed} failed, ${skipped} skipped (no UTR).`,
        errors: errors.slice(0, 20),
      });
    }

    const contractorId = body.contractor_id;
    if (!contractorId) return Response.json({ ok: false, error: 'contractor_id is required' }, { status: 400 });

    const contractor = await base44.asServiceRole.entities.Contractor.get(contractorId);
    if (!contractor) return Response.json({ ok: false, error: 'Contractor not found' }, { status: 404 });

    if (!contractor.utr) {
      return Response.json({ ok: false, error: 'Contractor has no UTR — enter the UTR before verifying.' }, { status: 400 });
    }

    const { cfg } = await getCisConfig(base44);
    const token = await getHmrcToken(cfg.client_id, cfg.client_secret);
    if (!token) {
      return Response.json({ ok: false, error: 'HMRC CIS credentials not configured — enter them in Settings → CIS Verification.' }, { status: 400 });
    }

    const tppId = cfg.tpp_id || '';

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