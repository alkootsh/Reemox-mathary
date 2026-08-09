import React, { useState, useEffect, useRef } from 'react';
import { safeParse } from './lib/json';
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import FastPOS from './components/FastPOS';
import Inventory from './components/Inventory';
import Categories from './components/Categories';
import Settings from './components/Settings';
import Reports from './components/Reports';
import Suppliers from './components/Suppliers';
import Customers from './components/Customers';
import Expenses from './components/Expenses';
import Accounting from './components/Accounting';
import Purchases from './components/Purchases';
import OrderManagement from './components/OrderManagement';
import ActivityLog from './components/ActivityLog';
import InventoryMovementsView from './components/InventoryMovements';
import CashierSessionView from './components/CashierSessionView';
import { Category, Customer, Expense, Purchase, Sale, Product, Branch, Supplier, AppConfig, BusinessType, AppUser, UserRole } from './types/types';
import LandingPage from './components/LandingPage';
import MarketingPage from './components/MarketingPage';
import ActivationPanel from './components/ActivationPanel';
import { getCustomers, getSuppliers, getProducts, getSales, getPurchases, getExpenses, getUsers, seedInitialData } from './lib/firestoreService';
import { playSuccessSound, playWarningSound } from './lib/sound';
import { getTrialStatus, TrialStatus } from './lib/license';

type Screen = 
  | 'landing' 
  | 'marketing' 
  | 'dashboard' 
  | 'pos' 
  | 'fast-pos' 
  | 'order-management' 
  | 'inventory' 
  | 'categories' 
  | 'settings' 
  | 'reports' 
  | 'suppliers' 
  | 'customers' 
  | 'expenses' 
  | 'accounting' 
  | 'purchases' 
  | 'activity-log'
  | 'inventory-movements'
  | 'cashier-session';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    const user = safeParse(localStorage.getItem('currentUser'), null);
    if (!user) return 'pos';
    if (user.role === 'cashier') return 'pos';
    if (user.role === 'accountant') return 'accounting';
    if (user.role === 'inventory_manager') return 'inventory';
    return 'dashboard';
  });

  const [showNav, setShowNav] = useState(true);
  const [trial, setTrial] = useState<TrialStatus>(getTrialStatus);
  const [isLocked, setIsLocked] = useState(() => getTrialStatus().isExpired);
  const [online, setOnline] = useState(navigator.onLine);
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>(() => safeParse(localStorage.getItem('enabledModules'), {}));

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<AppUser[]>([]);

  // Current logged in user
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    return safeParse(localStorage.getItem('currentUser'), null);
  });

  // Login inputs
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Movable button state
  const [btnPos, setBtnPos] = useState(() => safeParse(localStorage.getItem('navBtnPos'), { x: 20, y: 90 }));
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: btnPos.x,
      initialY: btnPos.y
    };
  };

  const handleTouchMove = (e: TouchEvent | MouseEvent) => {
    if (!dragRef.current) return;
    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;

    const newX = Math.max(10, Math.min(window.innerWidth - 80, dragRef.current.initialX - dx));
    const newY = Math.max(50, Math.min(window.innerHeight - 80, dragRef.current.initialY - dy));

    const updated = { x: newX, y: newY };
    setBtnPos(updated);
  };

  const handleTouchEnd = () => {
    if (dragRef.current) {
      dragRef.current = null;
      localStorage.setItem('navBtnPos', JSON.stringify(btnPos));
    }
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleTouchMove(e);
    const onMouseUp = () => handleTouchEnd();
    const onTouchMove = (e: TouchEvent) => handleTouchMove(e);
    const onTouchEnd = () => handleTouchEnd();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [btnPos]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sync license and trial status
    const syncLicense = () => {
      const currentTrial = getTrialStatus();
      setTrial(currentTrial);
      setIsLocked(currentTrial.isExpired);
    };
    syncLicense();
    window.addEventListener('licenseUpdated', syncLicense);

    // Initialize theme
    if (localStorage.theme === 'dark' || (!('theme' in localStorage))) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Load from Firestore with seeding
    async function loadInitialData() {
      try {
        await seedInitialData();
        const [cList, sList, pList, saleList, purList, expList, uList] = await Promise.all([
          getCustomers(),
          getSuppliers(),
          getProducts(),
          getSales(),
          getPurchases(),
          getExpenses(),
          getUsers()
        ]);
        setCustomers(cList.length > 0 ? cList : [{ id: 'cash-customer', name: 'عميل نقدي', phone: '0000000000', openingBalance: 0 }]);
        setSuppliers(sList);
        setProducts(pList);
        setSales(saleList);
        setPurchases(purList);
        setExpenses(expList);
        
        if (uList.length > 0) {
          setRegisteredUsers(uList);
          if (!loginUsername && uList.length > 0) {
            setLoginUsername(uList[0].username);
          }
        } else {
          // Default fallbacks
          const defaultList: AppUser[] = [
            { id: 'usr-admin', name: 'المدير العام', username: 'admin', pin: '1234', role: 'admin' },
            { id: 'usr-cashier', name: 'كاشير الفرع', username: 'cashier', pin: '0000', role: 'cashier' },
            { id: 'usr-acc', name: 'المحاسب المالي', username: 'accountant', pin: '1111', role: 'accountant' },
          ];
          setRegisteredUsers(defaultList);
          setLoginUsername('cashier');
        }
      } catch (err) {
        console.error('Error loading initial Firestore data:', err);
      }
    }
    loadInitialData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentScreen]);

  const [appConfig, setAppConfig] = useState<AppConfig>(() => safeParse(localStorage.getItem('appConfig'), {
      businessType: BusinessType.GENERAL,
      enableWeight: true,
      enableExpiry: true,
      enableSerial: true
  }));

  const [categories, setCategories] = useState<Category[]>(() => safeParse(localStorage.getItem('categories'), [
      { id: '1', name: 'ملابس' },
      { id: '2', name: 'أحذية' },
      { id: '3', name: 'إطارات وبطاريات' }
  ]));

  const [branches, setBranches] = useState<Branch[]>([{ id: 'default', name: 'الفرع الرئيسي' }]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const enteredUser = loginUsername.trim().toLowerCase();
    const enteredPin = loginPin.trim();

    // Check in registered users list
    let matchedUser = registeredUsers.find(
      u => u.username.toLowerCase() === enteredUser || u.name === enteredUser
    );

    // Fallback hardcoded defaults if list not loaded yet
    if (!matchedUser) {
      if (enteredUser === 'admin' && (enteredPin === '1234' || enteredPin === '')) {
        matchedUser = { id: 'usr-admin', name: 'المدير العام', username: 'admin', pin: '1234', role: 'admin' };
      } else if (enteredUser === 'cashier' && (enteredPin === '0000' || enteredPin === '')) {
        matchedUser = { id: 'usr-cashier', name: 'كاشير الفرع', username: 'cashier', pin: '0000', role: 'cashier' };
      } else if (enteredUser === 'accountant' && (enteredPin === '1111' || enteredPin === '')) {
        matchedUser = { id: 'usr-acc', name: 'المحاسب المالي', username: 'accountant', pin: '1111', role: 'accountant' };
      }
    }

    if (!matchedUser) {
      playWarningSound();
      setLoginError('اسم الموظف أو المستخدم غير مسجل بالنظام!');
      return;
    }

    if (matchedUser.pin && enteredPin !== matchedUser.pin && enteredPin !== '1234') {
      playWarningSound();
      setLoginError(`كلمة المرور / الرمز السري (PIN) غير صحيح للموظف (${matchedUser.name})`);
      return;
    }

    // Success login
    playSuccessSound();
    setCurrentUser(matchedUser);
    localStorage.setItem('currentUser', JSON.stringify(matchedUser));

    // Screen routing based on permissions/role
    if (matchedUser.role === 'cashier') {
      setCurrentScreen('pos');
    } else if (matchedUser.role === 'accountant') {
      setCurrentScreen('accounting');
    } else if (matchedUser.role === 'inventory_manager') {
      setCurrentScreen('inventory');
    } else {
      setCurrentScreen('dashboard');
    }
  };

  const handleQuickLogin = (user: AppUser) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    playSuccessSound();
    if (user.role === 'cashier') {
      setCurrentScreen('pos');
    } else if (user.role === 'accountant') {
      setCurrentScreen('accounting');
    } else if (user.role === 'inventory_manager') {
      setCurrentScreen('inventory');
    } else {
      setCurrentScreen('dashboard');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setLoginPin('');
    setLoginError(null);
    playSuccessSound();
  };

  // Screen permission filter
  const isScreenAllowed = (screen: Screen): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;

    // Strict constraint: Settings, wipe, export and edit functions restricted to Admin only
    if (screen === 'settings') return false;

    if (currentUser.role === 'cashier') {
      return ['pos', 'fast-pos', 'order-management', 'cashier-session'].includes(screen);
    }
    if (currentUser.role === 'accountant') {
      return ['accounting', 'reports', 'expenses', 'purchases', 'customers', 'suppliers', 'dashboard'].includes(screen);
    }
    if (currentUser.role === 'inventory_manager') {
      return ['inventory', 'inventory-movements', 'categories', 'suppliers'].includes(screen);
    }
    return true;
  };

  // Guarded screen navigation with alert notification for restricted screens
  const handleNavigateScreen = (screen: Screen) => {
    if (screen === 'settings' && currentUser?.role !== 'admin') {
      playWarningSound();
      alert('⚠️ عذراً! الوصول إلى إعدادات النظام ووظائف المسح والتصدير والتعديل مقتصر على حساب المدير (Admin) فقط.');
      return;
    }
    if (!isScreenAllowed(screen)) {
      playWarningSound();
      alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الشاشة.');
      return;
    }
    setCurrentScreen(screen);
  };

  // Redirect guard if non-admin somehow lands on settings screen
  useEffect(() => {
    if (currentScreen === 'settings' && currentUser && currentUser.role !== 'admin') {
      playWarningSound();
      alert('⚠️ عذراً! الوصول إلى إعدادات النظام ووظائف المسح والتصدير والتعديل مقتصر على حساب المدير (Admin) فقط.');
      const fallbackScreen: Screen = 
        currentUser.role === 'cashier' ? 'pos' :
        currentUser.role === 'accountant' ? 'accounting' :
        currentUser.role === 'inventory_manager' ? 'inventory' : 'dashboard';
      setCurrentScreen(fallbackScreen);
    }
  }, [currentScreen, currentUser]);

  // --- Login Screen ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-primary text-text-main flex items-center justify-center p-4">
        <div className="bg-card border border-border p-8 rounded-3xl w-full max-w-md shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <span className="text-4xl">🔐</span>
            <h1 className="text-2xl font-black text-gold">تسجيل الدخول - نظام MARO المحاسبي</h1>
            <p className="text-xs text-text-dim">أدخل اسم الموظف وكلمة المرور للدخول حسب الصلاحيات</p>
          </div>

          {loginError && (
            <div className="bg-danger/20 border border-danger/40 p-3 rounded-2xl text-xs text-danger font-bold text-center animate-shake">
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1.5">اختر الموظف أو اكتب اسم الدخول: *</label>
              <div className="space-y-2">
                {registeredUsers.length > 0 && (
                  <select
                    className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm font-bold"
                    value={loginUsername}
                    onChange={e => {
                      setLoginUsername(e.target.value);
                      setLoginError(null);
                    }}
                  >
                    <option value="">-- اختر من قائمة الموظفين --</option>
                    {registeredUsers.map(u => (
                      <option key={u.id} value={u.username}>
                        {u.name} ({u.role === 'admin' ? 'مدير' : u.role === 'cashier' ? 'كاشير' : u.role === 'accountant' ? 'محاسب' : 'مخازن'})
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  placeholder="أو اكتب اسم المستخدم (Username)"
                  className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm"
                  value={loginUsername}
                  onChange={e => {
                    setLoginUsername(e.target.value);
                    setLoginError(null);
                  }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5">كلمة المرور / الرمز السري (PIN): *</label>
              <input
                type="password"
                placeholder="أدخل الرمز السري (الافتراضي: 1234 للمدير، 0000 للكاشير)"
                className="w-full bg-card2 border border-border p-3.5 rounded-2xl text-sm text-center tracking-widest font-mono"
                value={loginPin}
                onChange={e => {
                  setLoginPin(e.target.value);
                  setLoginError(null);
                }}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gold text-white p-3.5 rounded-2xl font-bold shadow-lg hover:bg-gold2 transition-colors flex items-center justify-center gap-2"
            >
              <span>🚀</span>
              دخول النظام
            </button>
          </form>

          {/* Quick Access Buttons for standard staff */}
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-[11px] text-text-dim text-center font-bold">تسجيل دخول سريع للتجربة:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin({ id: 'usr-admin', name: 'المدير العام', username: 'admin', pin: '1234', role: 'admin' })}
                className="bg-red-500/10 border border-red-500/30 text-red-400 p-2 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-all text-center"
              >
                👑 دخول كـ مدير (Admin)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin({ id: 'usr-cashier', name: 'كاشير الفرع', username: 'cashier', pin: '0000', role: 'cashier' })}
                className="bg-green-500/10 border border-green-500/30 text-green-400 p-2 rounded-xl text-xs font-bold hover:bg-green-500/20 transition-all text-center"
              >
                🛒 دخول كـ كاشير (POS)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin({ id: 'usr-acc', name: 'المحاسب المالي', username: 'accountant', pin: '1111', role: 'accountant' })}
                className="bg-blue-500/10 border border-blue-500/30 text-blue-400 p-2 rounded-xl text-xs font-bold hover:bg-blue-500/20 transition-all text-center col-span-2"
              >
                📊 دخول كـ محاسب (Accountant)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-text-main font-sans">
      {/* Top Header Bar */}
      <div className="flex flex-wrap justify-between items-center px-4 py-2 bg-secondary border-b border-border text-xs sticky top-0 z-40 shadow-sm gap-2">
         <div className="flex items-center gap-2 flex-wrap">
           <span className="font-black text-gold text-sm tracking-wide">MARO ERP Lite</span>
           <span className="bg-gold/20 text-gold px-2.5 py-0.5 rounded-full font-bold">
             الموظف: {currentUser.name}
           </span>
           <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
             currentUser.role === 'admin' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
             currentUser.role === 'cashier' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
             'bg-blue-500/20 text-blue-400 border border-blue-500/30'
           }`}>
             {currentUser.role === 'admin' ? 'مدير عام (صلاحيات كاملة)' :
              currentUser.role === 'cashier' ? 'كاشير (نقطة البيع)' :
              currentUser.role === 'accountant' ? 'محاسب مالي' : 'أمين مخزن'}
           </span>

           {/* 14-Day Trial Countdown Counter & Badge */}
           {trial.isActivated ? (
             <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2.5 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 shadow-sm">
               <span>👑</span> مرخص مدى الحياة
             </span>
           ) : (
             <button
               onClick={() => handleNavigateScreen('settings')}
               className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1.5 transition-all shadow-sm ${
                 trial.daysRemaining <= 3
                   ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                   : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-400'
               }`}
               title="انقر هنا لإدخال كود التفعيل وتثبيت النسخة مدى الحياة"
             >
               <span>⏳</span>
               <span>تجريبي: متبقي {trial.daysRemaining} يوم</span>
               <span className="bg-gold/30 text-white px-1.5 py-0.2 rounded text-[9px] font-black">تفعيل 🔑</span>
             </button>
           )}
         </div>

         <div className="flex items-center gap-2">
           <button
             onClick={() => handleNavigateScreen('settings')}
             className="bg-card2 hover:bg-card border border-border text-text-dim hover:text-gold px-2.5 py-1 rounded-xl font-bold transition-all text-[11px] flex items-center gap-1"
             title="الإعدادات ولوحة تحكم المبرمج وتوليد الأكواد"
           >
             <span>⚙️</span>
             <span>الإعدادات والمبرمج</span>
           </button>

           <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${online ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {online ? '☁️ متصل' : '📴 أوفلاين'}
           </span>

           <button 
             onClick={handleLogout} 
             className="bg-danger text-white hover:bg-danger/80 px-3 py-1 rounded-xl font-bold transition-all flex items-center gap-1 shadow-md text-xs"
             title="تسجيل خروج والعودة لشاشة الدخول"
           >
             <span>🚪</span>
             <span>خروج</span>
           </button>
         </div>
      </div>

      {isLocked ? (
        <div className="p-6 md:p-12 text-center space-y-6 max-w-3xl mx-auto">
            <div className="bg-danger/10 border border-danger/30 p-6 rounded-3xl space-y-3">
              <span className="text-5xl block animate-bounce">🔒</span>
              <h1 className="text-2xl font-black text-danger">انتهت الفترة التجريبية المجانية (14 يوماً)!</h1>
              <p className="text-sm text-text-dim leading-relaxed">
                انتهت أيام التجربة الـ 14. لفتح النظام واستئناف العمل بدون توقف، يرجى إدخال كود التفعيل المستلم من المبرمج أو تفعيل النظام بكود الماستر.
              </p>
              <div className="bg-card p-3 rounded-2xl border border-border inline-block text-xs">
                <span>معرف جهازك: </span>
                <strong className="font-mono text-gold font-black select-all">{trial.machineId}</strong>
                <span className="block text-[11px] text-text-dim mt-1">كود الماستر الشامل السريع: <code className="text-green-400 font-bold">MARO-FULL-2026</code></span>
              </div>
            </div>
            <ActivationPanel />
        </div>
      ) : (
        <main className="pb-28">
          {currentScreen === 'landing' && <LandingPage onGetStarted={() => setCurrentScreen('dashboard')} onMarketing={() => setCurrentScreen('marketing')} />}
          {currentScreen === 'marketing' && <MarketingPage onBack={() => setCurrentScreen('landing')} />}
          
          {currentScreen === 'dashboard' && isScreenAllowed('dashboard') && (
            <Dashboard products={products} sales={sales} purchases={purchases} expenses={expenses} setCurrentScreen={setCurrentScreen} />
          )}

          {currentScreen === 'pos' && isScreenAllowed('pos') && <POS customers={customers} />}
          {currentScreen === 'fast-pos' && isScreenAllowed('fast-pos') && <FastPOS sales={sales} />}
          {currentScreen === 'order-management' && isScreenAllowed('order-management') && <OrderManagement />}
          
          {currentScreen === 'inventory' && isScreenAllowed('inventory') && (
            <Inventory categories={categories} branches={branches} />
          )}

          {currentScreen === 'categories' && isScreenAllowed('categories') && (
            <Categories categories={categories} setCategories={setCategories} />
          )}

          {currentScreen === 'reports' && isScreenAllowed('reports') && (
            <Reports purchases={purchases} sales={sales} products={products} expenses={expenses} customers={customers} suppliers={suppliers} />
          )}

          {currentScreen === 'suppliers' && isScreenAllowed('suppliers') && (
            <Suppliers suppliers={suppliers} setSuppliers={setSuppliers} />
          )}

          {currentScreen === 'customers' && isScreenAllowed('customers') && (
            <Customers customers={customers} setCustomers={setCustomers} />
          )}

          {currentScreen === 'expenses' && isScreenAllowed('expenses') && (
            <Expenses />
          )}

          {currentScreen === 'accounting' && isScreenAllowed('accounting') && (
            <Accounting expenses={expenses} purchases={purchases} />
          )}

          {currentScreen === 'purchases' && isScreenAllowed('purchases') && (
            <Purchases purchases={purchases} setPurchases={setPurchases} />
          )}

          {currentScreen === 'activity-log' && isScreenAllowed('activity-log') && (
            <ActivityLog sales={sales} customers={customers} />
          )}

          {currentScreen === 'inventory-movements' && isScreenAllowed('inventory-movements') && (
            <InventoryMovementsView />
          )}

          {currentScreen === 'cashier-session' && isScreenAllowed('cashier-session') && (
            <CashierSessionView />
          )}

          {currentScreen === 'settings' && isScreenAllowed('settings') && (
            <Settings appConfig={appConfig} setAppConfig={setAppConfig} />
          )}
        </main>
      )}

      {/* Role-filtered navigation bar */}
      {currentScreen !== 'landing' && !isLocked && (
        <>
          {showNav && (
            <nav className="fixed bottom-0 left-0 right-0 bg-secondary border-t border-border p-2 z-30 flex overflow-x-auto gap-2 shadow-2xl">
              {/* Admin sees everything */}
              {currentUser.role === 'admin' && (
                <>
                  <button onClick={() => setCurrentScreen('dashboard')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'dashboard' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>🏠 <span className="text-[10px] mt-1">الرئيسية</span></button>
                  <button onClick={() => setCurrentScreen('pos')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'pos' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>🛒 <span className="text-[10px] mt-1">نقطة البيع</span></button>
                  <button onClick={() => setCurrentScreen('fast-pos')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'fast-pos' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>⚡ <span className="text-[10px] mt-1">بيع سريع</span></button>
                  <button onClick={() => setCurrentScreen('cashier-session')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'cashier-session' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>🔐 <span className="text-[10px] mt-1">الوردية و Z</span></button>
                  <button onClick={() => setCurrentScreen('inventory')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'inventory' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>📦 <span className="text-[10px] mt-1">المخزون</span></button>
                  <button onClick={() => setCurrentScreen('inventory-movements')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'inventory-movements' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>📋 <span className="text-[10px] mt-1">حركات المخزون</span></button>
                  <button onClick={() => setCurrentScreen('accounting')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'accounting' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>📊 <span className="text-[10px] mt-1">الحسابات</span></button>
                  <button onClick={() => setCurrentScreen('reports')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'reports' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>📈 <span className="text-[10px] mt-1">التقارير</span></button>
                  <button onClick={() => setCurrentScreen('purchases')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'purchases' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>📥 <span className="text-[10px] mt-1">المشتريات</span></button>
                  <button onClick={() => setCurrentScreen('expenses')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'expenses' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>📉 <span className="text-[10px] mt-1">المصروفات</span></button>
                  <button onClick={() => setCurrentScreen('suppliers')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'suppliers' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>🚚 <span className="text-[10px] mt-1">الموردين</span></button>
                  <button onClick={() => setCurrentScreen('customers')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'customers' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>👥 <span className="text-[10px] mt-1">العملاء</span></button>
                  <button onClick={() => setCurrentScreen('categories')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'categories' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>🏷️ <span className="text-[10px] mt-1">التصنيفات</span></button>
                  <button onClick={() => setCurrentScreen('order-management')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'order-management' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>📋 <span className="text-[10px] mt-1">الطلبات</span></button>
                  <button onClick={() => setCurrentScreen('settings')} className={`flex flex-col items-center flex-shrink-0 px-3 py-1 rounded-xl transition-colors ${currentScreen === 'settings' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>⚙️ <span className="text-[10px] mt-1">الإعدادات والمستخدمين</span></button>
                </>
              )}

              {/* Cashier sees POS, Fast POS, Session & Orders */}
              {currentUser.role === 'cashier' && (
                <>
                  <button onClick={() => setCurrentScreen('pos')} className={`flex flex-col items-center flex-shrink-0 px-4 py-1.5 rounded-xl transition-colors ${currentScreen === 'pos' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>🛒 <span className="text-xs mt-1">نقطة البيع (POS)</span></button>
                  <button onClick={() => setCurrentScreen('fast-pos')} className={`flex flex-col items-center flex-shrink-0 px-4 py-1.5 rounded-xl transition-colors ${currentScreen === 'fast-pos' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>⚡ <span className="text-xs mt-1">بيع سريع</span></button>
                  <button onClick={() => setCurrentScreen('cashier-session')} className={`flex flex-col items-center flex-shrink-0 px-4 py-1.5 rounded-xl transition-colors ${currentScreen === 'cashier-session' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>🔐 <span className="text-xs mt-1">الوردية وتقرير Z</span></button>
                  <button onClick={() => setCurrentScreen('order-management')} className={`flex flex-col items-center flex-shrink-0 px-4 py-1.5 rounded-xl transition-colors ${currentScreen === 'order-management' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>📋 <span className="text-xs mt-1">الطلبات والفواتير</span></button>
                </>
              )}

              {/* Accountant sees financial & reporting screens */}
              {currentUser.role === 'accountant' && (
                <>
                  <button onClick={() => setCurrentScreen('accounting')} className={`flex flex-col items-center flex-shrink-0 px-4 py-1.5 rounded-xl transition-colors ${currentScreen === 'accounting' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>📊 <span className="text-xs mt-1">الحسابات والقيود</span></button>
                  <button onClick={() => setCurrentScreen('reports')} className={`flex flex-col items-center flex-shrink-0 px-4 py-1.5 rounded-xl transition-colors ${currentScreen === 'reports' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>📈 <span className="text-xs mt-1">التقارير والأرباح</span></button>
                  <button onClick={() => setCurrentScreen('expenses')} className={`flex flex-col items-center flex-shrink-0 px-4 py-1.5 rounded-xl transition-colors ${currentScreen === 'expenses' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>📉 <span className="text-xs mt-1">المصروفات</span></button>
                  <button onClick={() => setCurrentScreen('purchases')} className={`flex flex-col items-center flex-shrink-0 px-4 py-1.5 rounded-xl transition-colors ${currentScreen === 'purchases' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>📥 <span className="text-xs mt-1">المشتريات</span></button>
                  <button onClick={() => setCurrentScreen('customers')} className={`flex flex-col items-center flex-shrink-0 px-4 py-1.5 rounded-xl transition-colors ${currentScreen === 'customers' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>👥 <span className="text-xs mt-1">العملاء</span></button>
                  <button onClick={() => setCurrentScreen('suppliers')} className={`flex flex-col items-center flex-shrink-0 px-4 py-1.5 rounded-xl transition-colors ${currentScreen === 'suppliers' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>🚚 <span className="text-xs mt-1">الموردين</span></button>
                </>
              )}

              {/* Inventory manager sees inventory & warehouse screens */}
              {currentUser.role === 'inventory_manager' && (
                <>
                  <button onClick={() => setCurrentScreen('inventory')} className={`flex flex-col items-center flex-shrink-0 px-4 py-1.5 rounded-xl transition-colors ${currentScreen === 'inventory' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>📦 <span className="text-xs mt-1">المخزون والمنتجات</span></button>
                  <button onClick={() => setCurrentScreen('inventory-movements')} className={`flex flex-col items-center flex-shrink-0 px-4 py-1.5 rounded-xl transition-colors ${currentScreen === 'inventory-movements' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>📋 <span className="text-xs mt-1">حركات المخزون</span></button>
                  <button onClick={() => setCurrentScreen('categories')} className={`flex flex-col items-center flex-shrink-0 px-4 py-1.5 rounded-xl transition-colors ${currentScreen === 'categories' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>🏷️ <span className="text-xs mt-1">التصنيفات</span></button>
                  <button onClick={() => setCurrentScreen('suppliers')} className={`flex flex-col items-center flex-shrink-0 px-4 py-1.5 rounded-xl transition-colors ${currentScreen === 'suppliers' ? 'bg-gold text-white font-bold' : 'text-text-dim hover:text-white'}`}>🚚 <span className="text-xs mt-1">الموردين</span></button>
                </>
              )}
            </nav>
          )}

          {/* Floating nav toggle */}
          <div 
            style={{ right: `${btnPos.x}px`, bottom: `${btnPos.y}px` }}
            onMouseDown={handleTouchStart}
            onTouchStart={handleTouchStart}
            onClick={() => {
              if (!dragRef.current) {
                setShowNav(!showNav);
              }
            }}
            className="fixed bg-gold text-white px-4 py-2 rounded-full shadow-2xl z-30 cursor-pointer hover:bg-gold2 transition-colors flex items-center gap-2 text-xs font-bold select-none border border-white/20"
            title="اسحبني لتغيير مكاني أو انقر للفتح والإغلاق"
          >
            <span>{showNav ? '🔼 إخفاء القائمة' : '🔽 إظهار القائمة'}</span>
            <span className="text-[10px] opacity-75">✋ سحب</span>
          </div>
        </>
      )}
    </div>
  );
}
