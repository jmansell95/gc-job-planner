import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// CSV bulk import — accepts a CSV string and entity type, parses it, and
// bulk-creates records. Supports Staff and Job entities. Returns a preview
// of parsed records before creating them (when preview=true), or creates
// them (when preview=false). Simple CSV format: first row = headers matching
// entity field names, subsequent rows = data.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { csv_data, entity_type, preview = false } = body;
    if (!csv_data || !entity_type) {
      return Response.json({ error: 'csv_data and entity_type are required' }, { status: 400 });
    }

    const supported = ['Staff', 'Job', 'Vehicle', 'Client', 'Supplier', 'Contractor'];
    if (!supported.includes(entity_type)) {
      return Response.json({ error: `Unsupported entity. Supported: ${supported.join(', ')}` }, { status: 400 });
    }

    // Parse CSV
    const lines = csv_data.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return Response.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 });
    }

    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]);
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const record = {};
      headers.forEach((header, j) => {
        const val = values[j];
        if (!val) return;
        // Try to parse numbers
        if (/^-?\d+\.?\d*$/.test(val)) {
          record[header] = parseFloat(val);
        } else if (val === 'true') {
          record[header] = true;
        } else if (val === 'false') {
          record[header] = false;
        } else {
          record[header] = val;
        }
      });
      records.push(record);
    }

    if (preview) {
      return Response.json({
        ok: true,
        preview: true,
        entity_type,
        record_count: records.length,
        headers,
        records: records.slice(0, 50), // preview first 50
      });
    }

    // Bulk create
    const entityApi = base44.entities[entity_type];
    const created = await entityApi.bulkCreate(records);

    return Response.json({
      ok: true,
      entity_type,
      record_count: records.length,
      created_count: Array.isArray(created) ? created.length : 1,
      created,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}