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
  licenseType: 'trial' | 'lifetime_pro' | 'timed_subscription' | 'master_unlocked';
  expiryDate?: string;
  isClockTampered?: boolean;
}

const TRIAL_DAYS = 14;
export const MASTER_DEVELOPER_PIN = '1880';
export const MASTER_DEVELOPER_PASSWORD = '١٨٨٠@Qwer';
export const MASTER_DEVELOPER_PASSWORD_EN = '1880@Qwer';
export const MASTER_UNIVERSAL_KEY = 'MARO-FULL-2026';
export const MASTER_DEV_KEY = 'DEV-MASTER-2026';
export const SECRET_SALT = 'MARO-SECRET-POS-SYS-2026-X99';

/**
 * Simple hashing function for license checksum calculation
 */
export function calculateLicenseHash(input: string, salt: string = SECRET_SALT): string {
  let hash = 0;
  const combined = `${input}#${salt}`;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
}

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

/**
 * Returns Machine ID bound to hardware or browser storage
 */
export function getMachineId(): string {
  // If native Electron exposes hardware UUID
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getHardwareUUID) {
    try {
      const nativeId = (window as any).electronAPI.getHardwareUUID();
      if (nativeId) {
        localStorage.setItem('machineID', nativeId);
        return nativeId;
      }
    } catch {
      // fallback to localStorage
    }
  }

  let id = localStorage.getItem('machineID');
  if (!id) {
    id = 'ID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    localStorage.setItem('machineID', id);
  }
  return id;
}

/**
 * Anti-Tamper: Checks if system clock was rolled back
 */
function checkClockTamper(): boolean {
  const now = Date.now();
  const lastRecorded = parseInt(localStorage.getItem('lastSystemTimestamp') || '0', 10);
  
  if (lastRecorded > 0 && now < lastRecorded - 60000) { // allow 1 minute tolerance
    return true; // Clock was rolled back!
  }

  localStorage.setItem('lastSystemTimestamp', now.toString());
  return false;
}

export function getTrialStatus(): TrialStatus {
  const machineId = getMachineId();
  const savedKey = localStorage.getItem('activationKey') || '';
  const isClockTampered = checkClockTamper();
  
  // Check if activated
  const isMasterKey = savedKey === MASTER_UNIVERSAL_KEY || savedKey === MASTER_DEV_KEY;
  const isSimpleMachineKey = savedKey === `KEY-${machineId}` || savedKey === `MARO-${machineId}` || savedKey === `KEY-${machineId.toUpperCase()}`;
  
  // Check cryptographic hash key (PRO-HASH-MACHINEID)
  const expectedHash = calculateLicenseHash(machineId);
  const isCryptoKey = savedKey === `PRO-${expectedHash}-${machineId}` || savedKey === `PRO-${expectedHash}-${machineId.toUpperCase()}`;
  
  // Check timed subscription key: EXP-YYYYMMDD-HASH-MACHINEID
  let isTimedValid = false;
  let timedExpiryStr = '';
  if (savedKey.startsWith('EXP-')) {
    const parts = savedKey.split('-');
    if (parts.length >= 4) {
      const expiryDateStr = parts[1]; // YYYYMMDD
      const hashPart = parts[2];
      const targetId = parts.slice(3).join('-');
      
      if (targetId.toUpperCase() === machineId.toUpperCase()) {
        const checkHash = calculateLicenseHash(`${expiryDateStr}#${machineId}`);
        if (hashPart === checkHash) {
          const year = parseInt(expiryDateStr.substring(0, 4), 10);
          const month = parseInt(expiryDateStr.substring(4, 6), 10) - 1;
          const day = parseInt(expiryDateStr.substring(6, 8), 10);
          const expiryDate = new Date(year, month, day, 23, 59, 59);
          timedExpiryStr = expiryDate.toISOString().split('T')[0];
          
          if (new Date().getTime() <= expiryDate.getTime()) {
            isTimedValid = true;
          }
        }
      }
    }
  }

  const isActivated = isMasterKey || isSimpleMachineKey || isCryptoKey || isTimedValid;

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
  const isExpired = (!isActivated && remainingMs <= 0) || isClockTampered;

  let licenseType: 'trial' | 'lifetime_pro' | 'timed_subscription' | 'master_unlocked' = 'trial';
  if (isActivated) {
    if (isMasterKey) licenseType = 'master_unlocked';
    else if (isTimedValid) licenseType = 'timed_subscription';
    else licenseType = 'lifetime_pro';
  }

  return {
    machineId,
    isActivated,
    activationDate: localStorage.getItem('activationDate') || undefined,
    trialStartDate: startStr,
    trialTotalDays: TRIAL_DAYS,
    daysRemaining: isActivated ? 9999 : daysRemaining,
    hoursRemaining: isActivated ? 99999 : hoursRemaining,
    isExpired,
    licenseType,
    expiryDate: timedExpiryStr || undefined,
    isClockTampered
  };
}

/**
 * Generates standard Lifetime Key
 */
export function generateActivationKey(targetMachineId: string): string {
  const cleanId = targetMachineId.trim().toUpperCase();
  return `KEY-${cleanId}`;
}

/**
 * Generates Cryptographically Signed Lifetime Pro Key
 */
export function generateSignedProKey(targetMachineId: string): string {
  const cleanId = targetMachineId.trim().toUpperCase();
  const hash = calculateLicenseHash(cleanId);
  return `PRO-${hash}-${cleanId}`;
}

/**
 * Generates Timed Subscription Key (e.g. 30 days, 365 days)
 */
export function generateTimedSubscriptionKey(targetMachineId: string, days: number): { key: string; expiryDate: string } {
  const cleanId = targetMachineId.trim().toUpperCase();
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  
  const yyyy = expiry.getFullYear().toString();
  const mm = (expiry.getMonth() + 1).toString().padStart(2, '0');
  const dd = expiry.getDate().toString().padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  
  const hash = calculateLicenseHash(`${dateStr}#${cleanId}`);
  const key = `EXP-${dateStr}-${hash}-${cleanId}`;
  
  return {
    key,
    expiryDate: expiry.toISOString().split('T')[0]
  };
}

export function activateWithKey(inputKey: string): { success: boolean; message: string } {
  const key = inputKey.trim();
  const machineId = getMachineId();

  if (!key) {
    return { success: false, message: 'يرجى إدخال كود التفعيل أولاً!' };
  }

  // Acceptable keys
  const expectedHash = calculateLicenseHash(machineId);
  const validDirectKeys = [
    `KEY-${machineId}`,
    `KEY-${machineId.toUpperCase()}`,
    `MARO-${machineId}`,
    `PRO-${expectedHash}-${machineId}`,
    `PRO-${expectedHash}-${machineId.toUpperCase()}`,
    MASTER_UNIVERSAL_KEY,
    MASTER_DEV_KEY,
    'MARO-LIFETIME-PRO'
  ];

  if (validDirectKeys.some(k => k.toLowerCase() === key.toLowerCase())) {
    localStorage.setItem('activationKey', key.toUpperCase());
    localStorage.setItem('activationDate', new Date().toISOString());
    window.dispatchEvent(new Event('licenseUpdated'));
    return { 
      success: true, 
      message: '🎉 تم تفعيل النظام بنجاح مدى الحياة! تم فتح جميع الموديولات وإلغاء قيود الفترة التجريبية.' 
    };
  }

  // Check if it's a valid timed key
  if (key.toUpperCase().startsWith('EXP-')) {
    const parts = key.toUpperCase().split('-');
    if (parts.length >= 4) {
      const expiryDateStr = parts[1]; // YYYYMMDD
      const hashPart = parts[2];
      const targetId = parts.slice(3).join('-');
      
      if (targetId.toUpperCase() === machineId.toUpperCase()) {
        const checkHash = calculateLicenseHash(`${expiryDateStr}#${machineId}`);
        if (hashPart === checkHash) {
          const year = parseInt(expiryDateStr.substring(0, 4), 10);
          const month = parseInt(expiryDateStr.substring(4, 6), 10) - 1;
          const day = parseInt(expiryDateStr.substring(6, 8), 10);
          const expiryDate = new Date(year, month, day, 23, 59, 59);
          
          if (new Date().getTime() <= expiryDate.getTime()) {
            localStorage.setItem('activationKey', key.toUpperCase());
            localStorage.setItem('activationDate', new Date().toISOString());
            window.dispatchEvent(new Event('licenseUpdated'));
            return {
              success: true,
              message: `🎉 تم تفعيل الاشتراك بنجاح حتى تاريخ: ${expiryDate.toLocaleDateString('ar-EG')}!`
            };
          } else {
            return {
              success: false,
              message: '❌ انتهت صلاحية كود الاشتراك هذا. يرجى طلب كود جديد من المبرمج.'
            };
          }
        }
      }
    }
  }

  return { 
    success: false, 
    message: `❌ كود التفعيل غير صحيح لهذا الجهاز! تأكد من كود التفعيل المخصص لمعرف جهازك: (${machineId}).` 
  };
}

export function resetTrialDays(): void {
  localStorage.setItem('trialStartDate', new Date().toISOString());
  localStorage.setItem('lastSystemTimestamp', Date.now().toString());
  window.dispatchEvent(new Event('licenseUpdated'));
}

export function extendTrialDays(extraDays: number = 7): void {
  const currentStart = new Date(localStorage.getItem('trialStartDate') || new Date().toISOString());
  const newStart = new Date(currentStart.getTime() + extraDays * 24 * 60 * 60 * 1000);
  localStorage.setItem('trialStartDate', newStart.toISOString());
  localStorage.setItem('lastSystemTimestamp', Date.now().toString());
  window.dispatchEvent(new Event('licenseUpdated'));
}

export function deactivateLicense(): void {
  localStorage.removeItem('activationKey');
  localStorage.removeItem('activationDate');
  window.dispatchEvent(new Event('licenseUpdated'));
}

