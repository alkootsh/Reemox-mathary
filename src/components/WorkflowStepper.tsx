import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Check, 
  Clock, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  User, 
  FileText, 
  Shield, 
  MessageSquare, 
  ArrowLeft,
  ArrowRight,
  Activity
} from 'lucide-react';

export interface WorkflowStep {
  id: string;
  name: string;
  status: string;
  isInitial?: boolean;
  isFinal?: boolean;
  stepOrder: number;
}

export interface WorkflowTransition {
  id: string;
  name: string;
  fromStepId: string;
  toStepId: string;
  requiredRole?: string | null;
}

export interface WorkflowHistoryItem {
  id: string;
  fromStepName?: string;
  toStepName: string;
  notes?: string;
  createdAt: string;
  userName?: string;
}

export interface WorkflowState {
  documentId: string;
  documentType: string;
  workflow: {
    id: string;
    name: string;
    description?: string;
  };
  currentStep: WorkflowStep;
  steps: WorkflowStep[];
  availableTransitions: WorkflowTransition[];
  history: WorkflowHistoryItem[];
}

interface WorkflowStepperProps {
  workflowState: WorkflowState;
  userRole: string;
  onTransition?: (transitionId: string, notes: string) => Promise<void>;
  isLoading?: boolean;
}

export default function WorkflowStepper({
  workflowState,
  userRole,
  onTransition,
  isLoading = false
}: WorkflowStepperProps) {
  const { workflow, currentStep, steps = [], availableTransitions = [], history = [], documentId, documentType } = workflowState;
  
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showNotesField, setShowNotesField] = useState(false);

  // Sort steps by stepOrder to guarantee correct sequence display
  const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  
  // Find index of current step in sorted steps
  const currentStepIndex = sortedSteps.findIndex(s => s.id === currentStep.id);

  // Handle step transition trigger
  const handleTransitionClick = async (transitionId: string) => {
    if (!onTransition) return;
    setIsSubmitting(transitionId);
    try {
      await onTransition(transitionId, notes);
      setNotes('');
      setShowNotesField(false);
    } catch (err) {
      console.error('Transition failed:', err);
    } finally {
      setIsSubmitting(null);
    }
  };

  // Helper to translate document type to Arabic
  const translateDocType = (type: string) => {
    switch (type) {
      case 'SALES_ORDER': return 'طلب مبيعات';
      case 'SALES_INVOICE': return 'فاتورة مبيعات';
      case 'PURCHASE_ORDER': return 'طلب شراء';
      default: return type;
    }
  };

  // Check if user role matches the required role
  const canPerformTransition = (reqRole?: string | null) => {
    if (!reqRole) return true;
    if (userRole === 'ADMIN') return true;
    if (userRole === reqRole) return true;
    if (reqRole === 'MANAGER' && userRole === 'ADMIN') return true;
    return false;
  };

  // Helper to translate system status to stylized Arabic badges
  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'DRAFT':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">مسودة</span>;
      case 'PENDING_APPROVAL':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gold/15 text-gold border border-gold/20 animate-pulse">بانتظار الاعتماد</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">معتمد</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20">مرفوض</span>;
      case 'POSTED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">مرحل مالياً</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{status}</span>;
    }
  };

  return (
    <div id="workflow-stepper-panel" className="bg-card border border-border rounded-3xl p-5 sm:p-6 w-full max-w-4xl mx-auto space-y-6 shadow-xl relative overflow-hidden">
      {/* Upper Subtle Glow for High-end Premium Aesthetics */}
      <div className="absolute top-0 right-1/4 w-40 h-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent blur-sm"></div>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase font-semibold text-gold tracking-wider bg-gold/10 px-2 py-0.5 rounded-md">
              {translateDocType(documentType)}
            </span>
            <span className="text-text-dim text-xs">رقم المستند: {documentId}</span>
          </div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity size={18} className="text-gold" />
            <span>مسار إجراءات: {workflow.name}</span>
          </h3>
          {workflow.description && (
            <p className="text-text-dim text-xs mt-0.5">{workflow.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-xs text-text-dim">الحالة الحالية:</span>
          {getStatusBadge(currentStep.status)}
        </div>
      </div>

      {/* The Stepper Track (Visualizing Steps) */}
      <div className="py-4">
        {/* Horizontal Desktop View */}
        <div className="hidden md:flex items-center justify-between relative px-2">
          {/* Connecting Background Line */}
          <div className="absolute top-[22px] right-8 left-8 h-[2px] bg-slate-800 z-0"></div>
          
          {/* Active Connector Progress Line */}
          <div 
            className="absolute top-[22px] right-8 h-[2px] bg-gold/60 z-0 transition-all duration-500 origin-right"
            style={{ 
              width: sortedSteps.length > 1 
                ? `${(currentStepIndex / (sortedSteps.length - 1)) * 100}%` 
                : '0%' 
            }}
          ></div>

          {sortedSteps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isActive = idx === currentStepIndex;
            const isUpcoming = idx > currentStepIndex;

            return (
              <div key={step.id} className="flex flex-col items-center relative z-10 flex-1">
                {/* Step circle */}
                <motion.div
                  initial={false}
                  animate={{
                    scale: isActive ? 1.15 : 1,
                    backgroundColor: isActive 
                      ? '#D4AF37' 
                      : isCompleted 
                        ? 'rgba(212, 175, 55, 0.15)' 
                        : 'rgba(15, 23, 42, 0.9)',
                    borderColor: isActive 
                      ? '#D4AF37' 
                      : isCompleted 
                        ? '#D4AF37' 
                        : '#334155',
                  }}
                  className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-sm font-bold shadow-md cursor-default`}
                >
                  {isCompleted ? (
                    <Check size={18} className="text-gold" />
                  ) : isActive ? (
                    <span className="text-slate-950 font-black relative flex h-full w-full items-center justify-center">
                      {idx + 1}
                      <span className="absolute inline-flex h-full w-full rounded-full bg-gold/30 animate-ping opacity-75"></span>
                    </span>
                  ) : (
                    <span className="text-text-dim">{idx + 1}</span>
                  )}
                </motion.div>

                {/* Step Labels */}
                <div className="mt-3 text-center px-1">
                  <p className={`text-xs font-bold transition-colors ${isActive ? 'text-gold' : isCompleted ? 'text-gold/80' : 'text-text-dim'}`}>
                    {step.name}
                  </p>
                  <p className="text-[10px] text-text-dim/60 mt-0.5">
                    {step.status}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Vertical Mobile View */}
        <div className="flex md:hidden flex-col gap-6 relative pr-4">
          {/* Vertical Connecting Line */}
          <div className="absolute right-[19px] top-4 bottom-4 w-[2px] bg-slate-800 z-0"></div>

          {sortedSteps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isActive = idx === currentStepIndex;

            return (
              <div key={step.id} className="flex gap-4 items-start relative z-10">
                {/* Circle step indicator */}
                <div className="flex flex-col items-center">
                  <motion.div
                    initial={false}
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      backgroundColor: isActive 
                        ? '#D4AF37' 
                        : isCompleted 
                          ? 'rgba(212, 175, 55, 0.15)' 
                          : 'rgba(15, 23, 42, 0.9)',
                      borderColor: isActive 
                        ? '#D4AF37' 
                        : isCompleted 
                          ? '#D4AF37' 
                          : '#334155',
                    }}
                    className="w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold shadow"
                  >
                    {isCompleted ? (
                      <Check size={16} className="text-gold" />
                    ) : isActive ? (
                      <span className="text-slate-950 font-black relative flex h-full w-full items-center justify-center">
                        {idx + 1}
                        <span className="absolute inline-flex h-full w-full rounded-full bg-gold/30 animate-ping opacity-75"></span>
                      </span>
                    ) : (
                      <span className="text-text-dim">{idx + 1}</span>
                    )}
                  </motion.div>
                </div>

                {/* Label metadata */}
                <div className="flex-1 pt-1.5">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-sm font-bold ${isActive ? 'text-gold' : isCompleted ? 'text-gold/80' : 'text-text-dim'}`}>
                      {step.name}
                    </h4>
                    {isActive && (
                      <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded border border-gold/20">الحالة النشطة</span>
                    )}
                  </div>
                  <p className="text-xs text-text-dim/60 mt-0.5">{step.status}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Core Action Trigger Panel */}
      <AnimatePresence mode="wait">
        {availableTransitions.length > 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-card2 border border-border/80 rounded-2xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Clock size={16} className="text-gold" />
                  <span>الإجراءات والانتقالات المتاحة حالياً</span>
                </h4>
                <p className="text-xs text-text-dim mt-0.5">يمكنك نقل هذا المستند إلى الخطوة التالية وفقاً لصلاحياتك.</p>
              </div>

              {/* Notes Field Toggle Button */}
              <button
                onClick={() => setShowNotesField(!showNotesField)}
                className="text-xs text-gold/80 hover:text-gold flex items-center gap-1 transition-colors bg-gold/5 hover:bg-gold/10 border border-gold/20 px-2.5 py-1.5 rounded-xl font-medium"
              >
                <MessageSquare size={14} />
                <span>{showNotesField ? 'إخفاء الملاحظات' : 'إضافة ملاحظة على الانتقال'}</span>
              </button>
            </div>

            {/* Notes Textarea Section */}
            <AnimatePresence>
              {showNotesField && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-1.5"
                >
                  <label className="text-xs text-text-dim block">ملاحظات أو سبب التغيير (اختياري)</label>
                  <textarea
                    placeholder="اكتب ملاحظاتك هنا..."
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl p-3 text-xs focus:outline-none focus:border-gold resize-none text-white"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons Grid */}
            <div className="flex flex-wrap gap-2.5 pt-1">
              {availableTransitions.map((trans) => {
                const authorized = canPerformTransition(trans.requiredRole);
                const isLoaderActive = isSubmitting === trans.id;
                
                return (
                  <button
                    key={trans.id}
                    disabled={!authorized || isLoading || !!isSubmitting}
                    onClick={() => handleTransitionClick(trans.id)}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow transition-all active:scale-95 ${
                      !authorized 
                        ? 'bg-slate-800/50 text-slate-500 border border-slate-700/30 cursor-not-allowed'
                        : 'bg-gold/20 hover:bg-gold text-gold hover:text-white border border-gold/30 hover:border-gold cursor-pointer'
                    }`}
                  >
                    {isLoaderActive ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      <ArrowLeft size={14} className="scale-x-[-1]" />
                    )}
                    <span>{trans.name}</span>

                    {/* Security Required Role indicator */}
                    {trans.requiredRole && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
                        authorized 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/10'
                      }`}>
                        <Shield size={10} />
                        <span>{trans.requiredRole === 'MANAGER' ? 'مدير' : trans.requiredRole}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 text-center text-text-dim text-xs flex items-center justify-center gap-2"
          >
            <AlertCircle size={15} className="text-slate-500" />
            <span>هذا المستند حالياً في خطوة نهائية، أو لا توجد أي انتقالات متاحة لدورك الوظيفي.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History timeline Section */}
      <div className="border-t border-border/50 pt-4">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between w-full text-xs font-bold text-text-dim hover:text-white transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <FileText size={15} className="text-gold" />
            <span>سجل حركة سير العمل والقرارات الحالية ({history.length})</span>
          </span>
          {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-4"
            >
              {history.length === 0 ? (
                <div className="text-center py-6 text-text-dim/60 text-xs">لا يوجد أي عمليات مسجلة سابقة على هذا المستند بعد.</div>
              ) : (
                <div className="relative pr-4 space-y-5 py-2">
                  {/* Timeline central vertical track line */}
                  <div className="absolute right-[9px] top-2 bottom-2 w-[1px] bg-slate-800"></div>

                  {history.map((log, hidx) => (
                    <div key={log.id} className="relative flex gap-3.5 items-start">
                      {/* Timeline dot circle */}
                      <div className="w-5 h-5 rounded-full border border-gold/40 bg-slate-950 flex items-center justify-center relative z-10">
                        <div className="w-1.5 h-1.5 bg-gold rounded-full"></div>
                      </div>

                      {/* Timeline log content details */}
                      <div className="flex-1 bg-card2 border border-border/40 rounded-xl p-3 text-xs space-y-1.5">
                        <div className="flex justify-between items-center flex-wrap gap-1">
                          <span className="font-bold text-white flex items-center gap-1">
                            <User size={12} className="text-gold" />
                            <span>{log.userName || 'مستخدم النظام'}</span>
                          </span>
                          <span className="text-[10px] text-text-dim/60">
                            {new Date(log.createdAt).toLocaleString('ar-EG')}
                          </span>
                        </div>

                        <div className="text-[11px] text-text-dim flex items-center gap-1.5 flex-wrap">
                          <span>انتقل من:</span>
                          <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-semibold">{log.fromStepName || 'البداية'}</span>
                          <span>إلى:</span>
                          <span className="bg-gold/10 text-gold border border-gold/20 px-1.5 py-0.5 rounded font-semibold">{log.toStepName}</span>
                        </div>

                        {log.notes && (
                          <div className="bg-card/60 p-2 rounded-lg border border-border/30 text-[11px] text-text-dim italic flex gap-1 items-start">
                            <MessageSquare size={11} className="mt-0.5 shrink-0 text-gold/60" />
                            <span>"{log.notes}"</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
