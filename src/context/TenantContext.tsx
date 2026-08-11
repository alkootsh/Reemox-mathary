import React, { createContext, useContext, useState, useEffect } from 'react';
import { Company, Branch, Membership, AppUser, TenantContextType } from '../types/types';
import { safeParse } from '../lib/json';

export const DEFAULT_COMPANY_ID = 'company_default';
export const DEFAULT_BRANCH_ID = 'branch_main';

interface ExtendedTenantContextType extends TenantContextType {
  setCurrentUser: (user: AppUser | null) => void;
  setCompanyId: (id: string) => void;
  setBranchId: (id: string) => void;
  setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
}

const TenantContext = createContext<ExtendedTenantContextType | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    return safeParse(localStorage.getItem('currentUser'), null);
  });

  const [companyId, setCompanyIdState] = useState<string>(() => {
    return localStorage.getItem('tenant_company_id') || currentUser?.companyId || DEFAULT_COMPANY_ID;
  });

  const [branchId, setBranchIdState] = useState<string>(() => {
    return localStorage.getItem('tenant_branch_id') || currentUser?.branchId || DEFAULT_BRANCH_ID;
  });

  const [company, setCompany] = useState<Company | null>(() => ({
    id: companyId,
    name: 'الشركة الرئيسية - ERP',
    code: 'COMP-01',
    createdAt: new Date().toISOString()
  }));

  const [branches, setBranches] = useState<Branch[]>([
    { id: DEFAULT_BRANCH_ID, companyId: DEFAULT_COMPANY_ID, name: 'الفرع الرئيسي', isMain: true }
  ]);

  const activeBranch = branches.find(b => b.id === branchId) || branches[0] || null;

  const membership: Membership = {
    id: `mem-${currentUser?.id || 'guest'}`,
    userId: currentUser?.id || 'guest',
    companyId: companyId,
    role: currentUser?.role || 'cashier',
    status: 'ACTIVE',
    defaultBranchId: branchId
  };

  const setCompanyId = (id: string) => {
    setCompanyIdState(id);
    localStorage.setItem('tenant_company_id', id);
  };

  const setBranchId = (id: string) => {
    setBranchIdState(id);
    localStorage.setItem('tenant_branch_id', id);
  };

  useEffect(() => {
    if (currentUser?.companyId) {
      setCompanyIdState(currentUser.companyId);
    }
    if (currentUser?.branchId) {
      setBranchIdState(currentUser.branchId);
    }
  }, [currentUser]);

  return (
    <TenantContext.Provider value={{
      companyId,
      branchId,
      company,
      activeBranch,
      branches,
      currentUser,
      membership,
      setCurrentUser,
      setCompanyId,
      setBranchId,
      setBranches
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
