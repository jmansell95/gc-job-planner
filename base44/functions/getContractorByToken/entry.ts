import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const token = body.onboarding_token;
    if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const contractors = await base44.asServiceRole.entities.Contractor.filter({ onboarding_token: token });
    if (contractors.length === 0) return Response.json({ error: 'Contractor not found' }, { status: 404 });

    const c = contractors[0];

    // ---- GET: return public-safe contractor fields for the onboarding form ----
    if (!body.action || body.action === 'get') {
      return Response.json({
        contractor: {
          name: c.name || '',
          contractor_type: c.contractor_type || 'subcontractor',
          contact_name: c.contact_name || '',
          contact_email: c.contact_email || '',
          contact_phone: c.contact_phone || '',
          onboarding_status: c.onboarding_status || 'pending',
          services_offered: c.services_offered || [],
          company_reg_number: c.company_reg_number || '',
          vat_number: c.vat_number || '',
          hse_registration: c.hse_registration || '',
          accreditations: c.accreditations || [],
          insurance_provider: c.insurance_provider || '',
          insurance_policy_number: c.insurance_policy_number || '',
          insurance_expiry: c.insurance_expiry || '',
          public_liability_limit: c.public_liability_limit || null,
          employers_liability_limit: c.employers_liability_limit || null,
          professional_indemnity_limit: c.professional_indemnity_limit || null,
          utr: c.utr || '',
          nino: c.nino || '',
          cis_status: c.cis_status || 'pending',
          cis_verified_at: c.cis_verified_at || '',
          rejection_reason: c.rejection_reason || '',
          approved_at: c.approved_at || '',
          onboarding_completed_at: c.onboarding_completed_at || '',
        }
      });
    }

    // ---- SUBMIT: update contractor details from the onboarding form ----
    if (body.action === 'submit') {
      const patch: Record<string, unknown> = {
        contact_name: body.contact_name || c.contact_name,
        contact_email: body.contact_email || c.contact_email,
        contact_phone: body.contact_phone || c.contact_phone,
        services_offered: body.services_offered || c.services_offered || [],
        company_reg_number: body.company_reg_number || '',
        vat_number: body.vat_number || '',
        hse_registration: body.hse_registration || '',
        accreditations: body.accreditations || [],
        insurance_provider: body.insurance_provider || '',
        insurance_policy_number: body.insurance_policy_number || '',
        insurance_expiry: body.insurance_expiry || '',
        public_liability_limit: body.public_liability_limit ? Number(body.public_liability_limit) : null,
        employers_liability_limit: body.employers_liability_limit ? Number(body.employers_liability_limit) : null,
        professional_indemnity_limit: body.professional_indemnity_limit ? Number(body.professional_indemnity_limit) : null,
        utr: body.utr || '',
        nino: body.nino || '',
        onboarding_completed_at: new Date().toISOString(),
      };

      // Move to under_review if currently in documents_requested or pending
      if (c.onboarding_status === 'pending' || c.onboarding_status === 'documents_requested') {
        patch.onboarding_status = 'under_review';
      }

      const updated = await base44.asServiceRole.entities.Contractor.update(c.id, patch);

      // Auto-trigger CIS verification if UTR was provided and not yet verified
      let cisResult = null;
      if (body.utr && c.cis_status === 'pending') {
        try {
          cisResult = await base44.functions.invoke('verifyCIS', { contractor_id: c.id });
        } catch (_) { /* CIS verification is best-effort — don't block onboarding */ }
      }

      // Log to SystemAuditLog
      try {
        await base44.functions.invoke('logSystemAudit', {
          entity_name: 'Contractor',
          entity_id: c.id,
          action: 'update',
          data: { onboarding_status: patch.onboarding_status, utr: body.utr ? 'provided' : 'not provided' },
          source: 'manual',
          actor_name: 'subcontractor_onboarding_portal',
        });
      } catch (_) { /* audit logging is best-effort */ }

      return Response.json({
        ok: true,
        onboarding_status: updated.onboarding_status || patch.onboarding_status,
        cis_verification: cisResult?.data || null,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});