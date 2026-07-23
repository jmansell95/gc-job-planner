import { base44 } from '@/api/base44Client';

/**
 * Extracts structured data from an uploaded document (delivery note, quote,
 * order slip, off-hire note, etc.) using the ExtractDataFromUploadedFile
 * integration. Returns the extracted fields or null on failure.
 */
export async function extractDocumentData(fileUrl, schema) {
  if (!fileUrl) return null;
  try {
    const res = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: schema,
    });
    if (res?.status === 'success' && res?.output) {
      return Array.isArray(res.output) ? res.output[0] : res.output;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Schema for order slips / purchase documents (purchased equipment).
 * Extracts PO number, description, unit cost, quantity and supplier.
 */
export const ORDER_SLIP_SCHEMA = {
  type: 'object',
  properties: {
    po_number: { type: 'string', description: 'Purchase order number or order reference' },
    description: { type: 'string', description: 'Item or product description / name' },
    unit_cost: { type: 'number', description: 'Unit price per item in GBP (net, excluding VAT)' },
    quantity: { type: 'number', description: 'Quantity ordered' },
    supplier_name: { type: 'string', description: 'Supplier / vendor company name' },
    reference_number: { type: 'string', description: 'Asset tag, serial number, or supplier reference' },
    total_amount: { type: 'number', description: 'Total order value in GBP including VAT if shown' },
  },
};

/**
 * Schema for quote / contract documents (confirm price for POA items).
 * Extracts the quoted unit price and reference.
 */
export const QUOTE_SCHEMA = {
  type: 'object',
  properties: {
    unit_price: { type: 'number', description: 'Quoted unit price in GBP (net, excluding VAT)' },
    total_amount: { type: 'number', description: 'Total quote value in GBP' },
    quote_reference: { type: 'string', description: 'Quote reference number' },
    description: { type: 'string', description: 'Item or product description' },
    quantity: { type: 'number', description: 'Quantity quoted' },
    supplier_name: { type: 'string', description: 'Supplier company name' },
  },
};

/**
 * Schema for off-hire / collection notes (returning hired equipment).
 * Extracts the return date and reference number.
 */
export const OFF_HIRE_SCHEMA = {
  type: 'object',
  properties: {
    return_date: { type: 'string', description: 'Date the equipment was returned, in YYYY-MM-DD format if available' },
    reference_number: { type: 'string', description: 'Off-hire reference or confirmation number' },
    supplier_name: { type: 'string', description: 'Supplier / hire company name' },
    item_description: { type: 'string', description: 'Description of the returned equipment' },
  },
};

/**
 * Try to match an extracted supplier name to a known supplier record.
 * Returns the supplier ID if a match is found, otherwise empty string.
 */
export function matchSupplierByName(name, suppliers = []) {
  if (!name || !suppliers.length) return '';
  const lower = name.toLowerCase().trim();
  const exact = suppliers.find(s => (s.name || '').toLowerCase().trim() === lower);
  if (exact) return exact.id;
  const partial = suppliers.find(s => (s.name || '').toLowerCase().includes(lower) || lower.includes((s.name || '').toLowerCase()));
  return partial ? partial.id : '';
}