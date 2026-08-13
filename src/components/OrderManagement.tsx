import { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Clock, 
  CheckCircle, 
  Coins, 
  Download, 
  Home, 
  Activity, 
  Settings, 
  Plus, 
  RefreshCw, 
  FileText, 
  AlertTriangle,
  Play,
  Layers,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { apiFetch, DEFAULT_COMPANY_ID } from '../lib/firestoreService';
import WorkflowStepper, { WorkflowState } from './WorkflowStepper';
import Toast from './Toast';

const staticOrders = [
  { id: 'ORD-2024-1048', name: 'أحمد محمود سعيد', phone: '0101234567', date: '29 مايو 2026', items: 3, status: 'مكتمل', amount: '1,250' },
  { id: 'ORD-2024-1047', name: 'سارة عبد الله', phone: '0121234567', date: '29 مايو 2026', items: 1, status: 'شحن', amount: '780' },
];

export default function OrderManagement({ onNavigateHome }: { onNavigateHome?: () => void }) {
  const [activeTab, setActiveTab] = useState<'orders' | 'workflow'>('workflow');
  const [filter, setFilter] = useState('all');
  
  // Workflow states
  const [documentType, setDocumentType] = useState<'SALES_ORDER' | 'PURCHASE_ORDER' | 'SALES_INVOICE'>('SALES_ORDER');
  const [documents, setDocuments] = useState<{ id: string; name: string; date: string; amount: string }[]>([
    { id: 'SO-2026-001', name: 'شركة النور للتجارة (طلب مبيعات)', date: 'اليوم', amount: '12,500' },
    { id: 'SO-2026-002', name: 'مؤسسة التقنية المتقدمة', date: 'أمس', amount: '6,400' },
    { id: 'PO-2026-005', name: 'المورد الرئيسي للأغذية (طلب شراء)', date: 'قبل ساعة', amount: '18,900' },
    { id: 'INV-2026-012', name: 'العميل المميز (فاتورة تجريبية)', date: 'اليوم', amount: '3,200' },
  ]);
  const [selectedDocId, setSelectedDocId] = useState<string>('SO-2026-001');
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  // User session mock role (ADMIN to configure/delete, user can switch to test RBAC!)
  const [testUserRole, setTestUserRole] = useState<'ADMIN' | 'MANAGER' | 'CASHIER'>('ADMIN');

  // Load active workflow state for selected document
  const fetchCurrentWorkflowState = async (docId: string, type: string) => {
    setIsLoadingState(true);
    try {
      const res = await apiFetch<any>(`/api/workflows/document/${type}/${docId}`);
      if (res && res.success) {
        // We also need all steps in order to feed our Stepper visual tracks
        const detailsRes = await apiFetch<any>(`/api/workflows/${res.data.workflow.id}`);
        if (detailsRes && detailsRes.success) {
          setWorkflowState({
            ...res.data,
            steps: detailsRes.data.steps
          });
        } else {
          setWorkflowState(res.data);
        }
      } else {
        setWorkflowState(null);
      }
    } catch (err) {
      console.error('Failed to load workflow state:', err);
      setWorkflowState(null);
    } finally {
      setIsLoadingState(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'workflow' && selectedDocId) {
      fetchCurrentWorkflowState(selectedDocId, documentType);
    }
  }, [selectedDocId, documentType, activeTab]);

  // Handler to switch doc type and auto-assign typical document ID
  const handleDocTypeChange = (type: 'SALES_ORDER' | 'PURCHASE_ORDER' | 'SALES_INVOICE') => {
    setDocumentType(type);
    let defaultId = 'SO-2026-001';
    if (type === 'PURCHASE_ORDER') {
      defaultId = 'PO-2026-005';
    } else if (type === 'SALES_INVOICE') {
      defaultId = 'INV-2026-012';
    }
    setSelectedDocId(defaultId);
  };

  // Helper to auto-create standard workflow template if not present
  const handleAutoInitialize = async () => {
    setIsInitializing(true);
    try {
      const name = documentType === 'SALES_ORDER' ? 'سير عمل أوامر المبيعات' : 
                   documentType === 'PURCHASE_ORDER' ? 'سير عمل المشتريات المعزز' : 
                   'دورة اعتماد الفواتير';
      
      const res = await apiFetch<any>('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          documentType,
          description: `مسار الاعتماد المالي والتنظيمي الموحد لـ ${name}`,
          steps: [
            { name: 'مسودة المستند', status: 'DRAFT', isInitial: true, stepOrder: 1 },
            { name: 'بانتظار موافقة الإدارة', status: 'PENDING_APPROVAL', stepOrder: 2 },
            { name: 'تم الاعتماد النهائي', status: 'APPROVED', isFinal: true, stepOrder: 3 },
            { name: 'مرفوض وغير معتمد', status: 'REJECTED', isFinal: true, stepOrder: 4 }
          ],
          transitions: [
            { name: 'تقديم طلب مراجعة مالي', fromStepName: 'مسودة المستند', toStepName: 'بانتظار موافقة الإدارة' },
            { name: 'موافقة واعتماد المستند', fromStepName: 'بانتظار موافقة الإدارة', toStepName: 'تم الاعتماد النهائي', requiredRole: 'MANAGER' },
            { name: 'رفض لعدم مطابقة المعايير', fromStepName: 'بانتظار موافقة الإدارة', toStepName: 'مرفوض وغير معتمد', requiredRole: 'MANAGER' }
          ]
        })
      });

      if (res && res.success) {
        setToast({ message: 'تمت تهيئة مسار سير العمل وتكوين خطوات التتبع بنجاح!', type: 'success' });
        fetchCurrentWorkflowState(selectedDocId, documentType);
      } else {
        setToast({ message: 'عذراً، فشل تهيئة مسار العمل المسبق.', type: 'warning' });
      }
    } catch (err: any) {
      setToast({ message: `خطأ أثناء التهيئة: ${err.message}`, type: 'warning' });
    } finally {
      setIsInitializing(false);
    }
  };

  // Execute transition action on active document state
  const handleExecuteTransition = async (transitionId: string, transitionNotes: string) => {
    try {
      const res = await apiFetch<any>(`/api/workflows/document/${documentType}/${selectedDocId}/transition`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': testUserRole
        },
        body: JSON.stringify({
          transitionId,
          notes: transitionNotes
        })
      });

      if (res && res.success) {
        setToast({ message: 'تم نقل المستند وتحديث حالة سير العمل بنجاح!', type: 'success' });
        // Refresh workflow state
        await fetchCurrentWorkflowState(selectedDocId, documentType);
      } else {
        setToast({ message: res?.error || 'عذراً، فشل تنفيذ إجراء الانتقال.', type: 'warning' });
      }
    } catch (err: any) {
      setToast({ message: `خطأ أثناء تنفيذ الانتقال: ${err?.message || err}`, type: 'warning' });
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(staticOrders);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
    XLSX.writeFile(workbook, "orders.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const tableColumn = ["رقم الطلب", "العميل", "التاريخ", "الحالة", "المبلغ"];
    const tableRows = staticOrders.map(o => [o.id, o.name, o.date, o.status, o.amount]);
    (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
    });
    doc.save("orders.pdf");
  };

  return (
    <div className="p-4 sm:p-5 text-right space-y-6 pb-28" dir="rtl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Page Header */}
      <div className='flex justify-between items-center flex-wrap gap-2'>
        <div className="flex items-center gap-3">
          <div className="bg-gold/15 p-2.5 rounded-2xl text-gold border border-gold/20">
            <Layers size={22} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">لوحة العمليات والطلبات</h2>
            <p className="text-xs text-text-dim mt-0.5">إدارة الطلبات الفورية، الفواتير، ومتابعة مسارات الاعتمادات والربط المالي</p>
          </div>
        </div>

        <div className='flex items-center gap-2 flex-wrap'>
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="bg-gold/20 hover:bg-gold text-gold hover:text-white border border-gold/30 px-3.5 py-2 rounded-2xl font-bold text-xs flex items-center gap-1.5 shadow transition-all active:scale-95"
            >
              <Home size={15} />
              <span>العودة للرئيسية</span>
            </button>
          )}
          {activeTab === 'orders' && (
            <>
              <button onClick={exportToExcel} className='bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl flex items-center gap-1 text-xs font-bold shadow transition-all cursor-pointer'><Download size={14}/> Excel</button>
              <button onClick={exportToPDF} className='bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl flex items-center gap-1 text-xs font-bold shadow transition-all cursor-pointer'><Download size={14}/> PDF</button>
            </>
          )}
        </div>
      </div>

      {/* Screen Navigation Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('workflow')}
          className={`px-5 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'workflow' 
              ? 'border-gold text-gold bg-gold/5' 
              : 'border-transparent text-text-dim hover:text-white'
          }`}
        >
          <Activity size={16} />
          <span>تتبع مسار سير العمل الديناميكي (Phase 5)</span>
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-5 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'orders' 
              ? 'border-gold text-gold bg-gold/5' 
              : 'border-transparent text-text-dim hover:text-white'
          }`}
        >
          <ShoppingBag size={16} />
          <span>أوامر المبيعات (نظام التقييم والفلترة)</span>
        </button>
      </div>

      {activeTab === 'orders' ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'إجمالي الطلبات', value: '248', icon: ShoppingBag, color: 'text-purple-600' },
              { label: 'قيد المعالجة', value: '38', icon: Clock, color: 'text-teal-600' },
              { label: 'مكتملة', value: '189', icon: CheckCircle, color: 'text-green-600' },
              { label: 'الإيرادات (ج.م)', value: '84,290', icon: Coins, color: 'text-amber-600' },
            ].map((stat, i) => (
              <div key={i} className="bg-card p-4 rounded-3xl border border-border flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-secondary/20 ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-text-dim">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters Bar */}
          <div className="bg-card p-4 rounded-3xl border border-border flex gap-2 overflow-x-auto">
            {['الكل', 'جديد', 'معالجة', 'مكتمل'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === f ? 'bg-gold text-slate-950 font-black' : 'bg-card2 text-text-dim hover:text-white'}`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Table Data list */}
          <div className="bg-card rounded-3xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm min-w-[500px]">
                <thead className="bg-secondary/10">
                  <tr>
                    <th className="p-4">رقم الطلب</th>
                    <th className="p-4">العميل</th>
                    <th className="p-4">التاريخ</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {staticOrders.map(o => (
                    <tr key={o.id} className="border-t border-border hover:bg-secondary/5">
                      <td className="p-4 font-bold">{o.id}</td>
                      <td className="p-4">{o.name}</td>
                      <td className="p-4">{o.date}</td>
                      <td className="p-4"><span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-bold">{o.status}</span></td>
                      <td className="p-4 font-bold text-gold font-mono">{o.amount} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Dynamic Workflow Engine Simulation and Audit Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Sidebar Document selection */}
          <div className="bg-card border border-border rounded-3xl p-5 space-y-5 shadow-lg lg:col-span-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-border/60 pb-3 mb-1">
              <Settings size={16} className="text-gold" />
              <span>لوحة التحكم والتجربة الفورية</span>
            </h3>

            {/* Test Role Simulator */}
            <div className="space-y-2">
              <label className="text-xs text-text-dim block font-semibold">محاكاة صلاحية المستخدم الحالية (RBAC):</label>
              <div className="grid grid-cols-3 gap-1 bg-card2 p-1.5 rounded-xl border border-border">
                {(['ADMIN', 'MANAGER', 'CASHIER'] as const).map(role => (
                  <button
                    key={role}
                    onClick={() => setTestUserRole(role)}
                    className={`py-1.5 text-[10px] rounded-lg font-bold transition-all ${
                      testUserRole === role 
                        ? 'bg-gold text-slate-950 shadow' 
                        : 'text-text-dim hover:text-white'
                    }`}
                  >
                    {role === 'ADMIN' ? 'مسؤول (Admin)' : role === 'MANAGER' ? 'مدير (Manager)' : 'صندوق (Cashier)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Document type selection */}
            <div className="space-y-2">
              <label className="text-xs text-text-dim block font-semibold">نوع المستند المراد تتبعه:</label>
              <div className="grid grid-cols-3 gap-1 bg-card2 p-1.5 rounded-xl border border-border">
                {[
                  { key: 'SALES_ORDER', label: 'طلب مبيعات' },
                  { key: 'PURCHASE_ORDER', label: 'طلب شراء' },
                  { key: 'SALES_INVOICE', label: 'فاتورة مبيعات' }
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => handleDocTypeChange(item.key as any)}
                    className={`py-1.5 text-[10px] rounded-lg font-bold transition-all ${
                      documentType === item.key 
                        ? 'bg-gold/15 text-gold border border-gold/30 shadow' 
                        : 'text-text-dim hover:text-white border border-transparent'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated Live DB Documents */}
            <div className="space-y-2">
              <label className="text-xs text-text-dim block font-semibold">قائمة المستندات النشطة لقاعدة البيانات:</label>
              <div className="space-y-2">
                {documents
                  .filter(d => {
                    if (documentType === 'SALES_ORDER') return d.id.startsWith('SO-');
                    if (documentType === 'PURCHASE_ORDER') return d.id.startsWith('PO-');
                    return d.id.startsWith('INV-');
                  })
                  .map(doc => {
                    const isActive = selectedDocId === doc.id;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        className={`w-full p-3 rounded-2xl text-right flex items-center justify-between border transition-all ${
                          isActive 
                            ? 'bg-gold/5 border-gold text-gold font-bold shadow' 
                            : 'bg-card2 border-border text-text-dim hover:bg-slate-900'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{doc.name}</div>
                          <div className="text-[10px] text-text-dim/60 mt-0.5">{doc.date} - {doc.id}</div>
                        </div>
                        <div className="text-xs font-mono font-bold text-gold">{doc.amount} ج.م</div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Quick Add demo document */}
            <button
              onClick={() => {
                const prefix = documentType === 'SALES_ORDER' ? 'SO' : documentType === 'PURCHASE_ORDER' ? 'PO' : 'INV';
                const id = `${prefix}-${Date.now().toString().slice(-4)}`;
                const newDoc = {
                  id,
                  name: `مستند تجريبي مضاف حديثاً (${translateDocType(documentType)})`,
                  date: 'الآن',
                  amount: '4,500'
                };
                setDocuments([newDoc, ...documents]);
                setSelectedDocId(id);
              }}
              className="w-full py-2.5 rounded-xl border border-dashed border-gold/30 hover:border-gold text-gold bg-gold/5 hover:bg-gold/10 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus size={14} />
              <span>مستند محاكاة جديد</span>
            </button>
          </div>

          {/* Core Stepper display block */}
          <div className="lg:col-span-2 space-y-6">
            {isLoadingState ? (
              <div className="bg-card border border-border rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-3">
                <span className="w-10 h-10 border-4 border-gold/20 border-t-gold rounded-full animate-spin"></span>
                <span className="text-sm text-text-dim font-medium">جاري تحميل مسار وحالة سير العمل...</span>
              </div>
            ) : workflowState ? (
              <div className="space-y-4">
                {/* Stepper display */}
                <WorkflowStepper
                  workflowState={workflowState}
                  userRole={testUserRole}
                  onTransition={handleExecuteTransition}
                />

                {/* Automation Alert for Financial Journal Posting */}
                {workflowState.currentStep.isFinal && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl flex items-start gap-3">
                    <Sparkles size={20} className="shrink-0 animate-pulse text-gold" />
                    <div>
                      <h4 className="text-sm font-bold text-white">تم الربط المالي والترحيل بنجاح!</h4>
                      <p className="text-xs text-text-dim mt-0.5">
                        بما أن المستند وصل إلى الحالة النهائية المعتمدة ({workflowState.currentStep.name})، تم تلقائياً إنشاء قيد مزدوج في دفتر اليومية المالي للشركة بالقيم المسجلة لضمان تماسك البيانات.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* If workflow is not defined in active database - show beautifully styled empty state */
              <div className="bg-card border border-border rounded-3xl p-8 sm:p-12 text-center space-y-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-1/4 w-40 h-1 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent blur-sm"></div>
                <div className="w-14 h-14 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <AlertTriangle size={28} />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-lg font-bold text-white">لم يتم تهيئة سير العمل لهذا النموذج بعد</h4>
                  <p className="text-xs text-text-dim max-w-md mx-auto">
                    لا تتوفر أي مسارات موافقة معرفة لنموذج <span className="text-gold font-bold">{translateDocType(documentType)}</span> في قاعدة البيانات الحالية للمستأجر. يمكنك تفعيل مسار قياسي فوراً لتجربة سير العمل.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    disabled={isInitializing}
                    onClick={handleAutoInitialize}
                    className="bg-gold/20 hover:bg-gold text-gold hover:text-white border border-gold/30 px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 mx-auto cursor-pointer"
                  >
                    {isInitializing ? (
                      <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></span>
                    ) : (
                      <Play size={14} />
                    )}
                    <span>تهيئة سير العمل التلقائي الآن (Drizzle + Cloud SQL)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper translation
function translateDocType(type: string) {
  switch (type) {
    case 'SALES_ORDER': return 'طلب مبيعات';
    case 'SALES_INVOICE': return 'فاتورة مبيعات';
    case 'PURCHASE_ORDER': return 'طلب شراء';
    default: return type;
  }
}
