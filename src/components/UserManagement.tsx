import React, { useState, useEffect } from 'react';
import { AppUser, UserRole } from '../types/types';
import { getUsers, saveUser, deleteUser } from '../lib/firestoreService';
import { getTreasuries, getWarehouses, Treasury, Warehouse } from '../lib/treasuryWarehouseService';
import Toast from './Toast';
import { playSuccessSound, playWarningSound } from '../lib/sound';

export default function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
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
  const [phone, setPhone] = useState('');
  const [canEditPrice, setCanEditPrice] = useState<boolean>(true);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
    setTreasuries(getTreasuries());
    setWarehouses(getWarehouses());
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      if (data.length > 0) {
        setUsers(data);
      } else {
        // Fallback default users
        const defaultUsers: AppUser[] = [
          { id: 'usr-1', name: 'المدير العام', username: 'admin', pin: '1234', role: 'admin', phone: '01000000001' },
          { id: 'usr-2', name: 'كاشير 1 (نقطة البيع)', username: 'cashier', pin: '0000', role: 'cashier', phone: '01000000002' },
          { id: 'usr-3', name: 'المحاسب المالي', username: 'accountant', pin: '1111', role: 'accountant', phone: '01000000003' }
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
        phone: phone.trim(),
        canEditPrice: role === 'admin' ? true : canEditPrice
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
    setUsername(user.username);
    setPin(user.pin);
    setRole(user.role);
    setCashierType(user.cashierType || 'retail');
    setSelectedTreasuryId(user.treasuryId || 'treasury-main');
    setSelectedWarehouseId(user.warehouseId || 'wh-main');
    setPhone(user.phone || '');
    setCanEditPrice(user.role === 'admin' ? true : (user.canEditPrice !== false));
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
  };

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">مدير عام (صلاحيات كاملة وتعديل المعاملات)</span>;
      case 'cashier':
        return <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">كاشير (يفتح على شاشة البيع فقط)</span>;
      case 'accountant':
        return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">محاسب (تقارير وصندوق ومصروفات)</span>;
      case 'inventory_manager':
        return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">أمين مخزن (مخزون وحركات وموردين)</span>;
      default:
        return <span className="bg-card2 text-text-dim px-2.5 py-0.5 rounded-full text-xs font-bold">{r}</span>;
    }
  };

  return (
    <div className="p-4 sm:p-5 pb-28 max-w-4xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">إدارة الموظفين والمستخدمين والصلاحيات 👥</h2>
          <p className="text-xs text-text-dim mt-1">إضافة، تعديل، وحذف بيانات الموظفين وكلمات المرور وتحديد شاشات الدخول</p>
        </div>
        <span className="bg-gold/20 text-gold px-3 py-1 rounded-full text-xs font-bold">
          إجمالي المستخدمين: {users.length}
        </span>
      </div>

      {/* Form: Add or Edit */}
      <form onSubmit={handleSave} className="bg-card p-6 rounded-3xl border border-border space-y-4 shadow-sm">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <h3 className="font-bold text-base text-gold">
            {editingUserId ? '✏️ تعديل بيانات المستخدم / الموظف' : '➕ إضافة موظف جديد وتحديد صلاحيته'}
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
              className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm"
              value={name || ''}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">اسم الدخول (Username): *</label>
            <input
              type="text"
              placeholder="مثال: ahmed_pos أو cashier1"
              className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm"
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
              className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm"
              value={pin || ''}
              onChange={e => setPin(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">الدور والصلاحية: *</label>
            <select
              className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm font-bold"
              value={role || 'cashier'}
              onChange={e => setRole(e.target.value as UserRole)}
            >
              <option value="cashier">كاشير (يفتح أساسي على شاشة البيع فقط)</option>
              <option value="admin">مدير النظام (كامل الصلاحيات والتعديل والحذف)</option>
              <option value="accountant">محاسب (تقارير مالية، صندوق، ومصروفات)</option>
              <option value="inventory_manager">أمين مخزن (إدارة المخزون، الحركات، الموردين)</option>
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

          {/* Treasury Selection */}
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

          {/* Warehouse Selection */}
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

          {/* POS Price Editing Permission Switch */}
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
          className="w-full bg-gold text-white p-3.5 rounded-2xl font-bold shadow-lg hover:bg-gold2 transition-colors flex items-center justify-center gap-2 mt-2"
        >
          <span>{editingUserId ? '💾 حفظ التعديلات' : '➕ حفظ وإضافة الموظف للنظام'}</span>
        </button>
      </form>

      {/* Users List */}
      <div className="space-y-3">
        <h3 className="font-bold text-lg">قائمة الموظفين المسجلين في النظام</h3>
        
        {loading ? (
          <p className="text-center py-6 text-text-dim text-sm">جاري تحميل قائمة المستخدمين...</p>
        ) : users.length === 0 ? (
          <p className="text-center py-6 text-text-dim text-sm">لا يوجد مستخدمون مسجلون حالياً</p>
        ) : (
          users.map(u => (
            <div
              key={u.id}
              className="bg-card p-4 rounded-3xl border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-3 hover:border-gold/50 transition-all shadow-sm"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-base">{u.name}</h4>
                  <span className="text-xs text-text-dim">(@{u.username})</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {getRoleBadge(u.role)}
                  <span className="text-xs text-text-dim bg-card2 px-2 py-0.5 rounded-md border border-border">
                    🔑 رمز المرور: •••• ({u.pin})
                  </span>
                  <span className="text-xs font-bold text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span>🏦</span> {u.treasuryName || 'الخزنة الرئيسية'}
                  </span>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span>🏬</span> {u.warehouseName || 'المخزن الرئيسي'}
                  </span>
                  {u.phone && (
                    <span className="text-xs text-text-dim">📱 {u.phone}</span>
                  )}
                  {u.role === 'admin' || u.canEditPrice !== false ? (
                    <span className="text-[11px] bg-green-500/15 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                      <span>✏️</span> تعديل السعر متاح
                    </span>
                  ) : (
                    <span className="text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                      <span>🔒</span> تعديل السعر مقفل
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  onClick={() => startEdit(u)}
                  className="bg-card2 border border-border hover:border-gold text-xs px-3.5 py-2 rounded-xl font-bold transition-colors"
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
                    className="bg-danger/10 text-danger border border-danger/30 hover:bg-danger hover:text-white text-xs px-3.5 py-2 rounded-xl font-bold transition-colors"
                  >
                    🗑️ حذف
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
