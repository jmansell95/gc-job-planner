import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * dispatchPortalInvite — sends a branded portal invitation email to a
 * client or subcontractor, using an EmailTemplate if one exists for the
 * key, or falling back to a default branded template. Records the dispatch
 * timestamp on the Job or Contractor record for the "Last Sent" audit column.
 *
 * Payload:
 *   { target: 'client' | 'subcontractor', jobId?, contractorId?, recipientEmail?, templateKey? }
 *
 * For client portal: requires jobId (uses Job.portal_token)
 * For subcontractor onboarding: requires contractorId (uses Contractor.onboarding_token)
 */

const DEFAULT_CLIENT_TEMPLATE = {
  subject: 'Your project portal for {{job_name}} is ready',
  body_html: `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <div style="background:linear-gradient(135deg,#1c4a12 0%,#2E5A1A 100%);padding:20px 24px;border-radius:10px 10px 0 0">
        <h2 style="color:#fff;margin:0;font-size:18px">Your project portal is ready</h2>
      </div>
      <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px">
        <p style="margin:0 0 12px">Hi {{recipient_name}},</p>
        <p style="margin:0 0 12px">You can now follow live progress on <strong>{{job_name}}</strong> — schedule, milestones, site photos and documents — anytime, no login required.</p>
        <a href="{{portal_url}}" style="display:inline-block;background:#2E5A1A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;margin:8px 0 16px">Open Project Portal</a>
        <p style="margin:0;font-size:12px;color:#64748b">If the button doesn't work, copy this link: {{portal_url}}</p>
      </div>
    </div>`,
};

const DEFAULT_SUBCONTRACTOR_TEMPLATE = {
  subject: 'Sub-contractor onboarding — {{contractor_name}}',
  body_html: `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <div style="background:linear-gradient(135deg,#1c4a12 0%,#2E5A1A 100%);padding:20px 24px;border-radius:10px 10px 0 0">
        <h2 style="color:#fff;margin:0;font-size:18px">Sub-contractor onboarding</h2>
      </div>
      <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px">
        <p style="margin:0 0 12px">Hi {{recipient_name}},</p>
        <p style="margin:0 0 12px">Please complete your sub-contractor onboarding so we can clear you for work on our sites. Use the link below to upload your insurance, accreditations and company details:</p>
        <a href="{{portal_url}}" style="display:inline-block;background:#2E5A1A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;margin:8px 0 16px">Complete Onboarding</a>
        <p style="margin:0;font-size:12px;color:#64748b">If the button doesn't work, copy this link: {{portal_url}}</p>
      </div>
    </div>`,
};

function replaceTokens(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { target, jobId, contractorId, recipientEmail, templateKey, portalBaseUrl } = await req.json();

    if (!target || (target !== 'client' && target !== 'subcontractor')) {
      return Response.json({ error: 'target must be "client" or "subcontractor"' }, { status: 400 });
    }

    let portalUrl = '';
    let recipientName = '';
    let recipientEmailResolved = recipientEmail || '';
    let templateVars: Record<string, string> = {};
    let updateTarget: { entity: string; id: string; patch: Record<string, any> } | null = null;

    if (target === 'client') {
      if (!jobId) return Response.json({ error: 'jobId is required for client portal invites' }, { status: 400 });
      const job = await base44.entities.Job.get(jobId).catch(() => null);
      if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
      if (!job.portal_token || !job.portal_enabled) {
        return Response.json({ error: 'Portal is not enabled for this job. Enable it first.' }, { status: 400 });
      }
      portalUrl = `${portalBaseUrl || ''}/client-portal/${job.portal_token}`;

      // Resolve client email
      const client = job.client_id ? await base44.entities.Client.get(job.client_id).catch(() => null) : null;
      recipientEmailResolved = recipientEmail || client?.contact_email || '';
      recipientName = client?.contact_name || '';
      templateVars = { job_name: job.name, portal_url: portalUrl, recipient_name: recipientName, client_name: client?.name || '' };

      updateTarget = {
        entity: 'Job',
        id: jobId,
        patch: { portal_invite_sent_at: new Date().toISOString(), portal_invite_sent_to: recipientEmailResolved },
      };
    } else {
      if (!contractorId) return Response.json({ error: 'contractorId is required for subcontractor invites' }, { status: 400 });
      const contractor = await base44.entities.Contractor.get(contractorId).catch(() => null);
      if (!contractor) return Response.json({ error: 'Contractor not found' }, { status: 404 });

      // Generate token if not already set
      let token = contractor.onboarding_token;
      if (!token) {
        token = 'sub-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      }
      portalUrl = `${portalBaseUrl || ''}/subcontractor-onboarding/${token}`;
      recipientEmailResolved = recipientEmail || contractor.contact_email || '';
      recipientName = contractor.contact_name || '';
      templateVars = { contractor_name: contractor.name, portal_url: portalUrl, recipient_name: recipientName };

      updateTarget = {
        entity: 'Contractor',
        id: contractorId,
        patch: {
          onboarding_token: token,
          onboarding_status: contractor.onboarding_status === 'pending' ? 'documents_requested' : contractor.onboarding_status,
          onboarding_sent_at: new Date().toISOString(),
        },
      };
    }

    if (!recipientEmailResolved) {
      return Response.json({ error: `No recipient email found. Add a contact email to the ${target === 'client' ? 'client' : 'subcontractor'} record.` }, { status: 400 });
    }

    // Look up email template
    const templateKeyToUse = templateKey || (target === 'client' ? 'portal_invite_client' : 'portal_invite_subcontractor');
    const templates = await base44.asServiceRole.entities.EmailTemplate.filter({ template_key: templateKeyToUse }).catch(() => []);
    const template = templates[0];

    const defaultTemplate = target === 'client' ? DEFAULT_CLIENT_TEMPLATE : DEFAULT_SUBCONTRACTOR_TEMPLATE;
    const subject = template?.subject || defaultTemplate.subject;
    const bodyHtml = template?.body_html || defaultTemplate.body_html;

    // Replace tokens
    const finalSubject = replaceTokens(subject, templateVars);
    const finalBody = replaceTokens(bodyHtml, templateVars);

    // Send the email
    await base44.integrations.Core.SendEmail({
      to: recipientEmailResolved,
      subject: finalSubject,
      body: finalBody,
      from_name: 'GC Mission Control',
    });

    // Update the record with the "Last Sent" timestamp
    if (updateTarget) {
      await base44.entities[updateTarget.entity].update(updateTarget.id, updateTarget.patch);
    }

    // Update the email template's last_sent stats
    if (template) {
      await base44.asServiceRole.entities.EmailTemplate.update(template.id, {
        last_sent_at: new Date().toISOString(),
        last_sent_to: recipientEmailResolved,
        send_count: (template.send_count || 0) + 1,
      }).catch(() => null);
    }

    // Log to SystemAuditLog
    await base44.functions.invoke('logSystemAudit', {
      entity_name: updateTarget?.entity || 'Portal',
      entity_id: updateTarget?.id || 'unknown',
      action: 'update',
      data: { portal_invite_sent: true, sent_to: recipientEmailResolved, target },
      source: 'manual',
      actor_name: user.full_name || 'System',
    }).catch(() => null);

    return Response.json({
      ok: true,
      sent_to: recipientEmailResolved,
      portal_url: portalUrl,
      message: `Portal invitation sent to ${recipientEmailResolved}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}