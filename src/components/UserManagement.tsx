import React, { useState, useEffect, useRef } from 'react';
import { AppUser, UserRole, Branch } from '../types/types';
import { getUsers, saveUser, deleteUser, updateUserCard, getAuditLogs, getBranches } from '../lib/firestoreService';
import { getTreasuries, getWarehouses, Treasury, Warehouse } from '../lib/treasuryWarehouseService';
import Toast from './Toast';
import { playSuccessSound, playWarningSound, playAlertSound } from '../lib/sound';
import { CreditCard, ShieldCheck, ShieldAlert, KeyRound, Search, History, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  // Form state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');
  const [cashierType, setCashierType] = useState<'retail' | 'wholesale'>('retail');
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>('treasury-main');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('wh-main');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('branch_main');
  const [phone, setPhone] = useState('');
  const [canEditPrice, setCanEditPrice] = useState<boolean>(true);

  // Employee Card Specific Fields
  const [employeeCode, setEmployeeCode] = useState('');
  const [employeeCardId, setEmployeeCardId] = useState('');
  const [cardStatus, setCardStatus] = useState<'ACTIVE' | 'DISABLED'>('ACTIVE');
  const [isScanningForInput, setIsScanningForInput] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Audit Logs Modal
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Card Fast Assignment Modal
  const [assignCardUser, setAssignCardUser] = useState<AppUser | null>(null);
  const [quickCardInput, setQuickCardInput] = useState('');
  const [isListeningQuickScan, setIsListeningQuickScan] = useState(false);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
    setTreasuries(getTreasuries());
    setWarehouses(getWarehouses());
    getBranches('company_default').then(setBranches);
  }, []);

  // Keyboard wedge listener for scanning when in scan mode
  useEffect(() => {
    if (!isScanningForInput && !isListeningQuickScan) return;

    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const diff = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === 'Enter') {
        e.preventDefault();
        const code = buffer.trim();
        if (code.length >= 2) {
          playSuccessSound();
          if (isListeningQuickScan && assignCardUser) {
            setQuickCardInput(code);
            setIsListeningQuickScan(false);
          } else {
            setEmployeeCardId(code);
            setIsScanningForInput(false);
          }
        }
        buffer = '';
        return;
      }

      if (e.key.length === 1) {
        if (diff > 150) {
          buffer = e.key;
        } else {
          buffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isScanningForInput, isListeningQuickScan, assignCardUser]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      if (data.length > 0) {
        setUsers(data);
      } else {
        const defaultUsers: AppUser[] = [
          { id: 'usr-1', name: 'المدير العام', username: 'admin', pin: '1234', role: 'admin', phone: '01000000001', employeeCode: 'EMP-001', employeeCardId: 'CARD-ADMIN-999', cardStatus: 'ACTIVE', status: 'ACTIVE' },
          { id: 'usr-2', name: 'كاشير 1 (نقطة البيع)', username: 'cashier', pin: '0000', role: 'cashier', phone: '01000000002', employeeCode: 'EMP-002', employeeCardId: 'CARD-CASHIER-101', cardStatus: 'ACTIVE', status: 'ACTIVE' },
          { id: 'usr-3', name: 'المحاسب المالي', username: 'accountant', pin: '1111', role: 'accountant', phone: '01000000003', employeeCode: 'EMP-003', employeeCardId: 'CARD-ACC-202', cardStatus: 'ACTIVE', status: 'ACTIVE' }
        ];
        setUsers(defaultUsers);
      }
    } catch (err: any) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !pin.trim()) {
      playWarningSound();
      setToast({ message: 'يرجى إدخال اسم الموظف، اسم الدخول، ورمز المرور', type: 'warning' });
      return;
    }

    try {
      const selectedTreasuryObj = treasuries.find(t => t.id === selectedTreasuryId);
      const selectedWarehouseObj = warehouses.find(w => w.id === selectedWarehouseId);

      const userData: Partial<AppUser> = {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        pin: pin.trim(),
        role,
        cashierType,
        treasuryId: selectedTreasuryId,
        treasuryName: selectedTreasuryObj?.name || 'الخزنة الرئيسية',
        warehouseId: selectedWarehouseId,
        warehouseName: selectedWarehouseObj?.name || 'المخزن الرئيسي',
        branchId: selectedBranchId,
        phone: phone.trim(),
        canEditPrice: role === 'admin' ? true : canEditPrice,
        employeeCode: employeeCode.trim() || undefined,
        employeeCardId: employeeCardId.trim() || undefined,
        cardStatus,
        status: 'ACTIVE'
      };

      if (editingUserId) {
        userData.id = editingUserId;
        await saveUser(userData);
        setUsers(users.map(u => u.id === editingUserId ? { ...u, ...userData } as AppUser : u));
        
        // Sync if editing current logged in user
        const currentSaved = localStorage.getItem('currentUser');
        if (currentSaved) {
          try {
            const parsed = JSON.parse(currentSaved);
            if (parsed.id === editingUserId) {
              localStorage.setItem('currentUser', JSON.stringify({ ...parsed, ...userData }));
              window.dispatchEvent(new Event('currentUserUpdated'));
            }
          } catch (e) {}
        }

        setToast({ message: `تم تعديل بيانات المستخدم (${name}) بنجاح`, type: 'success' });
      } else {
        const id = await saveUser(userData);
        setUsers([...users, { ...userData, id } as AppUser]);
        setToast({ message: `تمت إضافة الموظف (${name}) بنجاح`, type: 'success' });
      }

      playSuccessSound();
      resetForm();
    } catch (err: any) {
      playWarningSound();
      setToast({ message: `حدث خطأ: ${err.message}`, type: 'warning' });
    }
  };

  const startEdit = (user: AppUser) => {
    setEditingUserId(user.id);
    setName(user.name);
    setUsername(user.username || '');
    setPin(user.pin || '');
    setRole(user.role);
    setCashierType(user.cashierType || 'retail');
    setSelectedTreasuryId(user.treasuryId || 'treasury-main');
    setSelectedWarehouseId(user.warehouseId || 'wh-main');
    setSelectedBranchId(user.branchId || 'branch_main');
    setPhone(user.phone || '');
    setCanEditPrice(user.role === 'admin' ? true : (user.canEditPrice !== false));
    setEmployeeCode(user.employeeCode || '');
    setEmployeeCardId(user.employeeCardId || '');
    setCardStatus(user.cardStatus || 'ACTIVE');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleCardStatus = async (user: AppUser) => {
    const nextStatus = user.cardStatus === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    try {
      const res = await updateUserCard(user.id, {
        employeeCardId: user.employeeCardId,
        cardStatus: nextStatus
      });

      if (!res.success) {
        playWarningSound();
        setToast({ message: res.error || 'فشل تحديث حالة الكارت', type: 'warning' });
        return;
      }

      setUsers(users.map(u => u.id === user.id ? { ...u, cardStatus: nextStatus } : u));
      playSuccessSound();
      setToast({ 
        message: nextStatus === 'ACTIVE' 
          ? `✅ تم تفعيل كارت الموظف (${user.name}) بنجاح` 
          : `🚫 تم تعطيل كارت الموظف (${user.name}) وإيقاف صلاحية الدخول به`,
        type: 'success' 
      });
    } catch (err: any) {
      playWarningSound();
      setToast({ message: `خطأ: ${err.message}`, type: 'warning' });
    }
  };

  const handleSaveQuickCardAssignment = async () => {
    if (!assignCardUser) return;
    const cardId = quickCardInput.trim();
    try {
      const res = await updateUserCard(assignCardUser.id, {
        employeeCardId: cardId || null,
        cardStatus: cardId ? 'ACTIVE' : 'DISABLED'
      });

      if (!res.success) {
        playWarningSound();
        setToast({ message: res.error || 'فشل ربط الكارت', type: 'warning' });
        return;
      }

      setUsers(users.map(u => u.id === assignCardUser.id ? { 
        ...u, 
        employeeCardId: cardId || undefined,
        cardStatus: cardId ? 'ACTIVE' : 'DISABLED'
      } : u));

      playSuccessSound();
      setToast({ 
        message: cardId ? `✅ تم ربط كارت ID (${cardId}) بالموظف (${assignCardUser.name}) بنجاح` : `تم فك ارتباط الكارت بالموظف`,
        type: 'success' 
      });
      setAssignCardUser(null);
      setQuickCardInput('');
    } catch (err: any) {
      playWarningSound();
      setToast({ message: `خطأ: ${err.message}`, type: 'warning' });
    }
  };

  const handleDelete = async (id: string) => {
    const target = users.find(u => u.id === id);
    if (target?.username === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
      playWarningSound();
      setToast({ message: 'لا يمكن حذف المدير العام الرئيسي للنظام!', type: 'warning' });
      setDeleteConfirmId(null);
      return;
    }

    try {
      await deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
      playSuccessSound();
      setToast({ message: 'تم حذف الموظف/المستخدم بنجاح', type: 'success' });
    } catch (err: any) {
      playWarningSound();
      setToast({ message: `فشل الحذف: ${err.message}`, type: 'warning' });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const loadAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const logs = await getAuditLogs();
      setAuditLogs(logs);
      setShowAuditModal(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const resetForm = () => {
    setEditingUserId(null);
    setName('');
    setUsername('');
    setPin('');
    setRole('cashier');
    setCashierType('retail');
    setSelectedTreasuryId('treasury-main');
    setSelectedWarehouseId('wh-main');
    setPhone('');
    setCanEditPrice(true);
    setEmployeeCode('');
    setEmployeeCardId('');
    setCardStatus('ACTIVE');
    setIsScanningForInput(false);
  };

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">مدير عام</span>;
      case 'cashier':
        return <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">كاشير</span>;
      case 'accountant':
        return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">محاسب</span>;
      case 'inventory_manager':
        return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">أمين مخزن</span>;
      default:
        return <span className="bg-card2 text-text-dim px-2.5 py-0.5 rounded-full text-xs font-bold">{r}</span>;
    }
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = 
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.employeeCode && u.employeeCode.toLowerCase().includes(q)) ||
      (u.employeeCardId && u.employeeCardId.toLowerCase().includes(q));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesQuery && matchesRole;
  });

  return (
    <div className="p-4 sm:p-5 pb-28 max-w-4xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-black text-text-main flex items-center gap-2">
            <span>👥</span>
            <span>إدارة الموظفين وكروت ID الذكية</span>
          </h2>
          <p className="text-xs text-text-dim mt-1">
            تعيين كروت ID للموظفين، التحكم في الصلاحيات، مراقبة الدخول، وإلغاء وتفعيل الكروت في الوقت الحقيقي
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAuditLogs}
            className="bg-card2 hover:bg-card border border-border text-text-main px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <History size={15} className="text-gold" />
            <span>سجل أمان الكروت (Audit Log)</span>
          </button>
          <span className="bg-gold/20 text-gold px-3 py-1.5 rounded-2xl text-xs font-black">
            الموظفين: {users.length}
          </span>
        </div>
      </div>

      {/* Form: Add or Edit */}
      <form onSubmit={handleSave} className="bg-card p-6 rounded-3xl border border-border space-y-4 shadow-sm">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <h3 className="font-black text-base text-gold flex items-center gap-2">
            <span>{editingUserId ? '✏️ تعديل بيانات وكارت الموظف' : '➕ إضافة موظف جديد وربط كارت ID'}</span>
          </h3>
          {editingUserId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs bg-card2 border border-border px-3 py-1 rounded-full text-text-dim hover:text-white"
            >
              إلغاء التعديل
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1.5">اسم الموظف الكامل: *</label>
            <input
              type="text"
              placeholder="مثال: أحمد عبد الله (كاشير)"
              className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm font-bold"
              value={name || ''}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">كود الموظف الوظيفي (Employee Code):</label>
            <input
              type="text"
              placeholder="مثال: EMP-001 أو 102"
              className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm font-mono"
              value={employeeCode || ''}
              onChange={e => setEmployeeCode(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">اسم الدخول (Username): *</label>
            <input
              type="text"
              placeholder="مثال: ahmed_pos أو cashier1"
              className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm font-mono"
              value={username || ''}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">كلمة المرور / الرمز السري (PIN): *</label>
            <input
              type="password"
              placeholder="مثال: 1234 أو 0000"
              className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm font-mono"
              value={pin || ''}
              onChange={e => setPin(e.target.value)}
              required
            />
          </div>

          {/* Employee Card ID Input with USB Scanner Auto-Capture */}
          <div className="md:col-span-2 bg-card2 p-4 rounded-2xl border border-gold/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-black text-gold flex items-center gap-1.5">
                <CreditCard size={17} />
                <span>معرف كارت ID الخاص بالموظف (Employee Card ID):</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsScanningForInput(prev => !prev);
                  if (!isScanningForInput) {
                    setTimeout(() => scanInputRef.current?.focus(), 100);
                  }
                }}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition-all flex items-center gap-1.5 self-start sm:self-auto ${
                  isScanningForInput 
                    ? 'bg-red-500/20 text-red-400 border-red-500 animate-pulse' 
                    : 'bg-gold/20 text-gold border-gold/40 hover:bg-gold hover:text-white'
                }`}
              >
                <span>{isScanningForInput ? '🔴 جاري الاستماع لتمرير الكارت...' : '⚡ مسح الكارت الآن عبر القارئ (RFID / Barcode)'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <input
                  ref={scanInputRef}
                  type="text"
                  placeholder="مرر الكارت على القارئ أو اكتب رقم الكارت (مثال: CARD-CSH-001)"
                  className="w-full bg-card border border-border p-3 rounded-2xl text-sm font-mono tracking-wider font-bold text-gold focus:border-gold"
                  value={employeeCardId || ''}
                  onChange={e => setEmployeeCardId(e.target.value)}
                />
              </div>

              <div>
                <select
                  value={cardStatus}
                  onChange={e => setCardStatus(e.target.value as 'ACTIVE' | 'DISABLED')}
                  className={`w-full p-3 rounded-2xl text-xs font-bold border ${
                    cardStatus === 'ACTIVE' 
                      ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                      : 'bg-red-500/10 text-red-400 border-red-500/30'
                  }`}
                >
                  <option value="ACTIVE">🟢 الكارت مفعل (نشط)</option>
                  <option value="DISABLED">🔴 الكارت معطل (موقوف)</option>
                </select>
              </div>
            </div>

            {isScanningForInput && (
              <div className="bg-gold/10 border border-gold/30 p-2.5 rounded-xl text-[11px] text-gold font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gold animate-ping" />
                <span>القارئ جاهز! مرر كارت الموظف الآن على جهاز قارئ الكروت وسيتم ملء الرقم تلقائياً.</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">الدور والصلاحية: *</label>
            <select
              className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm font-bold"
              value={role || 'cashier'}
              onChange={e => setRole(e.target.value as UserRole)}
            >
              <option value="cashier">كاشير (يفتح على شاشة نقطة البيع فقط)</option>
              <option value="admin">مدير النظام (صلاحيات كاملة وإدارة الكروت)</option>
              <option value="accountant">محاسب (تقارير مالية، صندوق ومصروفات)</option>
              <option value="inventory_manager">أمين مخزن (إدارة المخزون والحركات)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold mb-1.5">نوع الكاشير/التسعير:</label>
            <select
              className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm font-bold"
              value={cashierType}
              onChange={e => setCashierType(e.target.value as 'retail' | 'wholesale')}
            >
              <option value="retail">تجزئة (البيع بسعر التجزئة الافتراضي)</option>
              <option value="wholesale">جملة (البيع بسعر الجملة الافتراضي)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-gold flex items-center gap-1">
              <span>🏦</span>
              <span>الخزنة المربوطة المخصصة:</span>
            </label>
            <select
              className="w-full bg-card2 border border-gold/40 p-3 rounded-2xl text-sm font-bold text-text-main focus:border-gold focus:outline-none"
              value={selectedTreasuryId}
              onChange={e => setSelectedTreasuryId(e.target.value)}
            >
              {treasuries.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-emerald-400 flex items-center gap-1">
              <span>🏬</span>
              <span>المخزن المربوط المخصص:</span>
            </label>
            <select
              className="w-full bg-card2 border border-emerald-500/40 p-3 rounded-2xl text-sm font-bold text-text-main focus:border-emerald-500 focus:outline-none"
              value={selectedWarehouseId}
              onChange={e => setSelectedWarehouseId(e.target.value)}
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.location ? `(${w.location})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-blue-400 flex items-center gap-1">
              <span>🏢</span>
              <span>الفرع المربوط المخصص:</span>
            </label>
            <select
              className="w-full bg-card2 border border-blue-500/40 p-3 rounded-2xl text-sm font-bold text-text-main focus:border-blue-500 focus:outline-none"
              value={selectedBranchId}
              onChange={e => setSelectedBranchId(e.target.value)}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold mb-1.5">رقم هاتف الموظف (اختياري):</label>
            <input
              type="text"
              placeholder="مثال: 01012345678"
              className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm"
              value={phone || ''}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          <div className="md:col-span-2 bg-card2 p-4 rounded-2xl border border-border/80 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <label className="text-xs font-black text-text-main flex items-center gap-1.5 cursor-pointer">
                  <span>🏷️</span>
                  <span>السماح بتعديل سعر البيع في شاشة الكاشير (POS):</span>
                </label>
                <p className="text-[11px] text-text-dim leading-relaxed">
                  {role === 'admin' 
                    ? 'المدير العام يمتلك دائماً صلاحية تعديل السعر بشكل افتراضي.' 
                    : 'حدد ما إذا كان هذا الموظف مسموحاً له بتغيير سعر الوحدة للصنف داخل سلة الفاتورة مباشرة دون طلب موافقة المشرف.'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input 
                  type="checkbox" 
                  checked={role === 'admin' ? true : canEditPrice} 
                  disabled={role === 'admin'}
                  onChange={e => setCanEditPrice(e.target.checked)} 
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold"></div>
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-gold text-white p-3.5 rounded-2xl font-black shadow-lg hover:bg-gold2 transition-colors flex items-center justify-center gap-2 mt-2"
        >
          <span>{editingUserId ? '💾 حفظ تعديلات الموظف والكارت' : '➕ حفظ وإضافة الموظف وربط الكارت'}</span>
        </button>
      </form>

      {/* Filter and Search Bar */}
      <div className="bg-card p-4 rounded-3xl border border-border flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3.5 top-3.5 text-text-dim" />
          <input
            type="text"
            placeholder="بحث باسم الموظف، كود الموظف، أو رقم الكارت ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-card2 border border-border pr-10 pl-4 py-2.5 rounded-2xl text-xs focus:border-gold focus:outline-none"
          />
        </div>

        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="bg-card2 border border-border px-4 py-2.5 rounded-2xl text-xs font-bold"
        >
          <option value="all">جميع الأدوار والوظائف</option>
          <option value="admin">المدير العام</option>
          <option value="cashier">الكاشير</option>
          <option value="accountant">المحاسب</option>
          <option value="inventory_manager">أمين المخزن</option>
        </select>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        <h3 className="font-bold text-lg">قائمة الموظفين وكروت ID المسجلة</h3>
        
        {loading ? (
          <p className="text-center py-6 text-text-dim text-sm">جاري تحميل قائمة المستخدمين...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-center py-6 text-text-dim text-sm">لا يوجد موظفون يطابقون شروط البحث</p>
        ) : (
          filteredUsers.map(u => {
            const hasCard = Boolean(u.employeeCardId);
            const isCardActive = u.cardStatus !== 'DISABLED';

            return (
              <div
                key={u.id}
                className={`bg-card p-4 rounded-3xl border transition-all shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                  hasCard && !isCardActive ? 'border-red-500/40 bg-red-950/10' : 'border-border hover:border-gold/50'
                }`}
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h4 className="font-black text-base text-text-main">{u.name}</h4>
                    {u.employeeCode && (
                      <span className="text-xs font-mono font-bold bg-card2 px-2 py-0.5 rounded-lg border border-border text-gold">
                        #{u.employeeCode}
                      </span>
                    )}
                    <span className="text-xs text-text-dim">(@{u.username})</span>
                    {getRoleBadge(u.role)}
                  </div>

                  {/* Card ID Status Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {hasCard ? (
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold border ${
                        isCardActive 
                          ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                          : 'bg-red-500/10 text-red-400 border-red-500/30'
                      }`}>
                        <CreditCard size={14} />
                        <span>كارت ID: {u.employeeCardId}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-sans">
                          ({isCardActive ? 'مفعل' : 'معطل'})
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono text-text-dim bg-card2 border border-border">
                        <CreditCard size={14} />
                        <span>لا يوجد كارت مرتبط</span>
                      </div>
                    )}

                    <span className="text-xs text-text-dim bg-card2 px-2 py-0.5 rounded-md border border-border">
                      🔑 رمز المرور: •••• ({u.pin})
                    </span>

                    <span className="text-xs font-bold text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>🏦</span> {u.treasuryName || 'الخزنة الرئيسية'}
                    </span>

                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>🏬</span> {u.warehouseName || 'المخزن الرئيسي'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
                  {/* Quick Card Assign / Change Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setAssignCardUser(u);
                      setQuickCardInput(u.employeeCardId || '');
                      setIsListeningQuickScan(false);
                    }}
                    className="bg-card2 border border-gold/40 hover:bg-gold hover:text-white text-gold text-xs px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-1"
                  >
                    <CreditCard size={14} />
                    <span>{hasCard ? 'تغيير الكارت' : 'ربط كارت'}</span>
                  </button>

                  {/* Enable / Disable Card Status Toggle */}
                  {hasCard && (
                    <button
                      type="button"
                      onClick={() => handleToggleCardStatus(u)}
                      className={`text-xs px-3 py-2 rounded-xl font-bold border transition-all flex items-center gap-1 ${
                        isCardActive 
                          ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500 hover:text-white' 
                          : 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500 hover:text-white'
                      }`}
                    >
                      {isCardActive ? (
                        <>
                          <ShieldAlert size={14} />
                          <span>تعطيل الكارت</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} />
                          <span>تفعيل الكارت</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => startEdit(u)}
                    className="bg-card2 border border-border hover:border-gold text-xs px-3 py-2 rounded-xl font-bold transition-colors"
                  >
                    ✏️ تعديل
                  </button>

                  {deleteConfirmId === u.id ? (
                    <div className="flex items-center gap-1 bg-danger/20 border border-danger p-1 rounded-xl">
                      <span className="text-xs text-danger font-bold px-1">تأكيد؟</span>
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="bg-danger text-white text-xs px-2.5 py-1 rounded-lg font-bold hover:bg-danger/80"
                      >
                        نعم، حذف
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="bg-card2 text-xs px-2 py-1 rounded-lg font-bold text-text-dim"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(u.id)}
                      className="bg-danger/10 text-danger border border-danger/30 hover:bg-danger hover:text-white text-xs px-3 py-2 rounded-xl font-bold transition-colors"
                    >
                      🗑️ حذف
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Card Assignment Modal */}
      {assignCardUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-gold/40 p-6 rounded-3xl w-full max-w-md space-y-4 shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-black text-base text-gold flex items-center gap-2">
                <CreditCard size={18} />
                <span>ربط كارت ID بالموظف ({assignCardUser.name})</span>
              </h3>
              <button
                type="button"
                onClick={() => setAssignCardUser(null)}
                className="text-text-dim hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-dim leading-relaxed">
              مرر الكارت على جهاز قارئ الكروت (USB Wedge Reader / Barcode Scanner) أو اكتب معرف الكارت يدويًا.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setIsListeningQuickScan(prev => !prev)}
                className={`w-full p-3 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  isListeningQuickScan 
                    ? 'bg-red-500/20 text-red-400 border-red-500 animate-pulse' 
                    : 'bg-gold/15 text-gold border-gold/40 hover:bg-gold hover:text-white'
                }`}
              >
                <span>{isListeningQuickScan ? '🔴 جاري الاستماع... مرر الكارت الآن على القارئ' : '⚡ بدء المسح التلقائي من القارئ'}</span>
              </button>

              <div>
                <label className="block text-xs font-bold mb-1">رقم أو كود الكارت (Card ID):</label>
                <input
                  type="text"
                  placeholder="مثال: CARD-00987 أو 62211000"
                  value={quickCardInput}
                  onChange={e => setQuickCardInput(e.target.value)}
                  className="w-full bg-card2 border border-border p-3.5 rounded-2xl font-mono text-center font-bold text-gold text-base focus:border-gold"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={handleSaveQuickCardAssignment}
                className="flex-1 bg-gold hover:bg-gold2 text-white p-3 rounded-2xl font-black text-xs transition-all shadow-md"
              >
                💾 حفظ وربط الكارت بالموظف
              </button>
              {assignCardUser.employeeCardId && (
                <button
                  type="button"
                  onClick={() => {
                    setQuickCardInput('');
                    handleSaveQuickCardAssignment();
                  }}
                  className="bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white p-3 rounded-2xl font-bold text-xs transition-all"
                >
                  فك الارتباط
                </button>
              )}
              <button
                type="button"
                onClick={() => setAssignCardUser(null)}
                className="bg-card2 text-text-dim hover:text-white p-3 rounded-2xl font-bold text-xs"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border p-6 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col space-y-4 shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <History size={20} className="text-gold" />
                <h3 className="font-black text-base text-gold">سجل أمان الكروت وتسجيل الدخول (Audit Logs)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="text-text-dim hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingLogs ? (
                <p className="text-center py-8 text-text-dim text-xs">جاري تحميل السجلات...</p>
              ) : auditLogs.length === 0 ? (
                <p className="text-center py-8 text-text-dim text-xs">لا توجد سجلات أمان مسجلة حتى الآن</p>
              ) : (
                auditLogs.map((log: any) => (
                  <div key={log.id} className="bg-card2 p-3 rounded-2xl border border-border text-xs flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          log.action === 'CARD_LOGIN' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          log.action === 'CARD_DISABLED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          log.action === 'CARD_ASSIGNED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {log.action === 'CARD_LOGIN' ? 'تسجيل دخول بكارت' :
                           log.action === 'CARD_DISABLED' ? 'تعطيل كارت' :
                           log.action === 'CARD_ENABLED' ? 'تفعيل كارت' :
                           log.action === 'CARD_ASSIGNED' ? 'ربط كارت' :
                           log.action === 'LOGOUT' ? 'تسجيل خروج' : log.action}
                        </span>
                        <span className="font-bold text-text-main">{log.details?.employeeName || log.details?.targetEmployeeName || log.userId}</span>
                      </div>
                      <p className="text-text-dim text-[11px]">
                        {log.details?.employeeCardId ? `رقم الكارت: ${log.details.employeeCardId}` : ''}
                        {log.details?.role ? ` • الصلاحية: ${log.details.role}` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] text-text-dim whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('ar-EG')}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="bg-card2 hover:bg-border text-text-main px-5 py-2 rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

