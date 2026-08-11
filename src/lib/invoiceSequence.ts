import { apiFetch } from './firestoreService';

/**
 * Generates a unique invoice sequence number per cashier per day.
 * Format: INV-[CASHIER_CODE]-[YYYYMMDD]-[0001]
 * Resets back to 0001 every single day for each cashier.
 */
export async function generateDailyCashierInvoiceNumber(
  cashierNameOrId: string = 'CSH',
  companyId: string = 'company_default'
): Promise<string> {
  // Today's date string in YYYYMMDD format
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Extract clean cashier tag (e.g. "كاشير 1" -> "CSH1", "ahmed" -> "AHME")
  let cashierCode = 'CSH';
  if (cashierNameOrId) {
    const digits = cashierNameOrId.match(/\d+/);
    if (digits) {
      cashierCode = `CSH${digits[0]}`;
    } else {
      const clean = cashierNameOrId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (clean.length > 0) {
        cashierCode = clean.slice(0, 4);
      }
    }
  }

  const counterName = `daily_csh_${cashierCode}_${dateStr}`;
  let nextSeq = 1;

  try {
    const res = await apiFetch<{ nextVal: number }>('/api/counters/next', {
      method: 'POST',
      body: JSON.stringify({ companyId, name: counterName })
    });
    if (res && res.nextVal) {
      nextSeq = res.nextVal;
    }
  } catch (err) {
    console.warn('Backend sequence counter fetch failed, using local offline sequence:', err);
    const localKey = `daily_seq_${companyId}_${cashierCode}_${dateStr}`;
    const stored = localStorage.getItem(localKey);
    const curr = stored ? parseInt(stored, 10) : 0;
    nextSeq = curr + 1;
    localStorage.setItem(localKey, String(nextSeq));
  }

  const seqPadded = String(nextSeq).padStart(4, '0');
  return `INV-${cashierCode}-${dateStr}-${seqPadded}`;
}
