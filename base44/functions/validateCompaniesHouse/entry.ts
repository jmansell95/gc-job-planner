import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// validateCompaniesHouse — validates a contractor's company
// registration number against the Companies House API.
// ============================================================
// Payload: { contractor_id?: string, company_number?: string }
//
// Uses the free Companies House Public Data API (requires an API
// key stored in AppSetting keyed 'companies_house_config': { api_key }).
// If no API key is configured, falls back to format validation only.
//
// Returns: { valid, company_name, company_status, registered_address, ... }
// Stamps the Contractor record with validation results.

function isValidCompanyNumberFormat(num: string): boolean {
  if (!num) return false;
  const cleaned = num.replace(/\s/g, '').toUpperCase();
  // UK company numbers are 8 chars, alphanumeric (mostly digits, some prefixes)
  return /^[A-Z0-9]{8}$/.test(cleaned) || /^[A-Z]{2}\d{6}$/.test(cleaned);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // Resolve the company number — from payload or from the contractor record
    let companyNumber = body.company_number;
    let contractor: any = null;

    if (body.contractor_id) {
      const contractors = await base44.asServiceRole.entities.Contractor.filter({ id: body.contractor_id });
      contractor = contractors[0];
      if (!contractor) return Response.json({ ok: false, error: 'Contractor not found.' });
      if (!companyNumber) companyNumber = contractor.company_reg_number;
    }

    if (!companyNumber) {
      return Response.json({ ok: false, error: 'No company registration number provided.' });
    }

    const cleaned = companyNumber.replace(/\s/g, '').toUpperCase();

    // Load Companies House API key from AppSetting
    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'companies_house_config' });
    const cfg = settings[0]?.value || {};
    const apiKey = cfg.api_key;

    // If no API key, do format validation only
    if (!apiKey) {
      const formatValid = isValidCompanyNumberFormat(cleaned);
      const result = {
        ok: true,
        company_number: cleaned,
        format_valid: formatValid,
        api_verified: false,
        message: formatValid
          ? 'Company number format is valid. Add a Companies House API key in Settings to verify against the live register.'
          : 'Company number format is invalid. UK company numbers are 8 characters.',
      };
      return Response.json(result);
    }

    // Query the Companies House API
    const apiUrl = `https://api.company-information.service.gov.uk/company/${cleaned}`;
    const apiRes = await fetch(apiUrl, {
      headers: {
        'Authorization': 'Basic ' + btoa(apiKey + ':'),
        'Accept': 'application/json',
      },
    }).catch(() => null);

    if (!apiRes) {
      return Response.json({ ok: false, error: 'Companies House API request failed.' });
    }

    if (apiRes.status === 404) {
      // Company not found
      if (contractor) {
        await base44.asServiceRole.entities.Contractor.update(contractor.id, {
          cis_status: contractor.cis_status === 'pending' ? 'failed' : contractor.cis_status,
        });
      }
      return Response.json({
        ok: true,
        company_number: cleaned,
        format_valid: isValidCompanyNumberFormat(cleaned),
        api_verified: true,
        valid: false,
        message: `Company ${cleaned} not found on Companies House register.`,
      });
    }

    if (!apiRes.ok) {
      return Response.json({
        ok: false,
        error: `Companies House API returned ${apiRes.status}.`,
      });
    }

    const companyData = await apiRes.json().catch(() => null);
    if (!companyData) {
      return Response.json({ ok: false, error: 'Failed to parse Companies House response.' });
    }

    const result = {
      ok: true,
      company_number: cleaned,
      format_valid: true,
      api_verified: true,
      valid: true,
      company_name: companyData.company_name,
      company_status: companyData.company_status, // 'active', 'dissolved', 'liquidation', etc.
      company_type: companyData.type, // 'ltd', 'plc', 'llp', etc.
      incorporated_on: companyData.date_of_creation,
      registered_office_address: companyData.registered_office_address
        ? [
            companyData.registered_office_address.address_line_1,
            companyData.registered_office_address.address_line_2,
            companyData.registered_office_address.locality,
            companyData.registered_office_address.postal_code,
          ].filter(Boolean).join(', ')
        : null,
      sic_codes: companyData.sic_codes || [],
      message: `Verified: ${companyData.company_name} (${companyData.company_status})`,
    };

    // Stamp the contractor record if provided
    if (contractor) {
      // If the registered name differs from the contractor name, note it
      const nameMatch = contractor.name &&
        companyData.company_name &&
        contractor.name.toLowerCase().includes(companyData.company_name.toLowerCase().slice(0, 10));

      await base44.asServiceRole.entities.Contractor.update(contractor.id, {
        // Don't override the name, but we could add a validation note
        notes: (contractor.notes || '') +
          (contractor.notes ? '\n' : '') +
          `[Companies House] Verified ${new Date().toISOString().slice(0, 10)}: ${companyData.company_name} — ${companyData.company_status}. SIC: ${(companyData.sic_codes || []).join(', ')}.`,
      });
      (result as any).name_match = nameMatch;
    }

    return Response.json(result);
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}