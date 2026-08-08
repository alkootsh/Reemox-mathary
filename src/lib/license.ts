import { safeParse } from './json';

export interface TrialStatus {
  machineId: string;
  isActivated: boolean;
  activationDate?: string;
  trialStartDate: string;
  trialTotalDays: number;
  daysRemaining: number;
  hoursRemaining: number;
  isExpired: boolean;
  licenseType: 'trial' | 'lifetime_pro' | 'master_unlocked';
}

const TRIAL_DAYS = 14;
export const MASTER_DEVELOPER_PIN = '1880';
export const MASTER_DEVELOPER_PASSWORD = '١٨٨٠@Qwer';
export const MASTER_DEVELOPER_PASSWORD_EN = '1880@Qwer';
export const MASTER_UNIVERSAL_KEY = 'MARO-FULL-2026';
export const MASTER_DEV_KEY = 'DEV-MASTER-2026';

/**
 * Normalizes Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) to standard ASCII digits (0123456789)
 */
export function normalizeArabicDigits(str: string): string {
  if (!str) return '';
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, (w) => arabicDigits.indexOf(w).toString());
}

/**
 * Verifies developer password supporting both Arabic and English numerals
 */
export function verifyDeveloperPassword(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  const normalized = normalizeArabicDigits(trimmed);
  const customPass = localStorage.getItem('developerPassword');

  if (customPass) {
    if (trimmed === customPass || normalized === normalizeArabicDigits(customPass)) {
      return true;
    }
  }

  const validPasswords = [
    MASTER_DEVELOPER_PASSWORD,       // '١٨٨٠@Qwer'
    MASTER_DEVELOPER_PASSWORD_EN,    // '1880@Qwer'
    'Qwer@1880',
    'Qwer@١٨٨٠',
    '١٨٨٠',
    '1880',
    '1234',
    'admin123',
    MASTER_UNIVERSAL_KEY,
    MASTER_DEV_KEY,
  ];

  return validPasswords.some(
    p => trimmed === p || normalized === normalizeArabicDigits(p) || trimmed.toLowerCase() === p.toLowerCase()
  );
}

/**
 * Sets a custom developer password in localStorage
 */
export function setCustomDeveloperPassword(newPassword: string): void {
  if (newPassword.trim()) {
    localStorage.setItem('developerPassword', newPassword.trim());
  } else {
    localStorage.removeItem('developerPassword');
  }
}

export function getMachineId(): string {
  let id = localStorage.getItem('machineID');
  if (!id) {
    id = 'ID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    localStorage.setItem('machineID', id);
  }
  return id;
}

export function getTrialStatus(): TrialStatus {
  const machineId = getMachineId();
  const savedKey = localStorage.getItem('activationKey') || '';
  
  // Check if activated
  const isMasterKey = savedKey === MASTER_UNIVERSAL_KEY || savedKey === MASTER_DEV_KEY;
  const isMachineKey = savedKey === `KEY-${machineId}` || savedKey === `MARO-${machineId}`;
  const isActivated = isMasterKey || isMachineKey;

  // Trial start date
  let startStr = localStorage.getItem('trialStartDate');
  if (!startStr) {
    startStr = new Date().toISOString();
    localStorage.setItem('trialStartDate', startStr);
  }

  // Calculate elapsed time
  const startDate = new Date(startStr);
  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  const totalMs = TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const remainingMs = Math.max(0, totalMs - diffMs);

  const daysRemaining = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000));
  const isExpired = !isActivated && remainingMs <= 0;

  return {
    machineId,
    isActivated,
    activationDate: localStorage.getItem('activationDate') || undefined,
    trialStartDate: startStr,
    trialTotalDays: TRIAL_DAYS,
    daysRemaining: isActivated ? 9999 : daysRemaining,
    hoursRemaining: isActivated ? 99999 : hoursRemaining,
    isExpired,
    licenseType: isActivated ? (isMasterKey ? 'master_unlocked' : 'lifetime_pro') : 'trial'
  };
}

export function generateActivationKey(targetMachineId: string): string {
  const cleanId = targetMachineId.trim().toUpperCase();
  return `KEY-${cleanId}`;
}

export function activateWithKey(inputKey: string): { success: boolean; message: string } {
  const key = inputKey.trim();
  const machineId = getMachineId();

  if (!key) {
    return { success: false, message: 'يرجى إدخال كود التفعيل أولاً!' };
  }

  // Acceptable keys
  const validKeys = [
    `KEY-${machineId}`,
    `KEY-${machineId.toUpperCase()}`,
    `MARO-${machineId}`,
    MASTER_UNIVERSAL_KEY,
    MASTER_DEV_KEY,
    'MARO-LIFETIME-PRO'
  ];

  if (validKeys.includes(key) || key.toUpperCase() === `KEY-${machineId.toUpperCase()}`) {
    localStorage.setItem('activationKey', key);
    localStorage.setItem('activationDate', new Date().toISOString());
    window.dispatchEvent(new Event('licenseUpdated'));
    return { 
      success: true, 
      message: '🎉 تم تفعيل النظام بنجاح مدى الحياة! تم فتح جميع الموديولات وإلغاء قيود الفترة التجريبية.' 
    };
  }

  return { 
    success: false, 
    message: `❌ كود التفعيل غير صحيح! تأكد من كتابة: KEY-${machineId} أو طلب الكود الصحيح من المبرمج.` 
  };
}

export function resetTrialDays(): void {
  localStorage.setItem('trialStartDate', new Date().toISOString());
  window.dispatchEvent(new Event('licenseUpdated'));
}

export function extendTrialDays(extraDays: number = 7): void {
  const currentStart = new Date(localStorage.getItem('trialStartDate') || new Date().toISOString());
  const newStart = new Date(currentStart.getTime() + extraDays * 24 * 60 * 60 * 1000);
  localStorage.setItem('trialStartDate', newStart.toISOString());
  window.dispatchEvent(new Event('licenseUpdated'));
}

export function deactivateLicense(): void {
  localStorage.removeItem('activationKey');
  localStorage.removeItem('activationDate');
  window.dispatchEvent(new Event('licenseUpdated'));
}
