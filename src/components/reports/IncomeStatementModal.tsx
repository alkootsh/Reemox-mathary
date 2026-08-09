import React from 'react';
import { Printer, Download, X, FileText, CheckCircle2, Building2 } from 'lucide-react';

export interface IncomeStatementProps {
  isOpen: boolean;
  onClose: () => void;
  businessName?: string;
  dateRangeLabel: string;
  financials: {
    grossSales: number;
    discounts: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    expensesList: { name: string; value: number }[];
    totalExpenses: number;
    operatingProfit: number;
    taxes: number;
    netProfit: number;
    netMargin: number;
  };
}

export default function IncomeStatementModal({
  isOpen,
  onClose,
  businessName,
  dateRangeLabel,
  financials
}: IncomeStatementProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const storeName = businessName || localStorage.getItem('businessName') || 'المنشأة التجارية';

  return (
    <div className="fixed inset-0 bg-black/85 z-[9999] flex items-center justify-center p-3 sm:p-6 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-card w-full max-w-3xl rounded-3xl border border-border shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Toolbar (hidden in print) */}
        <div className="p-4 border-b border-border flex justify-between items-center bg-card2 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="text-gold" size={20} />
            <h3 className="font-black text-sm text-text-main">
              قائمة الدخل الشاملة المعتمدة (Income Statement / P&L)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-gold hover:bg-gold2 text-black font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-sm"
            >
              <Printer size={14} />
              <span>طباعة / حفظ PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-text-dim hover:text-text-main p-1.5 rounded-lg bg-card border border-border"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Statement Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-text-main print:p-0 print:m-0 print:text-black">
          {/* Header */}
          <div className="text-center border-b-2 border-border pb-5 space-y-1">
            <div className="text-lg font-black text-gold print:text-black">{storeName}</div>
            <h2 className="text-xl sm:text-2xl font-black">قائمة الدخل والأرباح والخسائر</h2>
            <div className="text-xs text-text-dim print:text-gray-600 font-mono">
              عن الفترة: <strong className="text-text-main print:text-black">{dateRangeLabel}</strong>
            </div>
            <div className="text-[10px] text-text-dim print:text-gray-500 font-mono">
              تاريخ استخراج التقرير: {new Date().toLocaleString('ar-EG')}
            </div>
          </div>

          {/* Statement Table */}
          <div className="space-y-4 text-xs font-sans">
            {/* 1. Revenues */}
            <div className="bg-card2/50 rounded-2xl p-4 border border-border print:bg-transparent print:border-gray-300">
              <div className="font-black text-sm text-text-main print:text-black mb-2 flex justify-between border-b border-border pb-1">
                <span>1. إيرادات النشاط التجاري (Revenues)</span>
                <span>القيمة (ج.م)</span>
              </div>
              <div className="space-y-2 pt-1">
                <div className="flex justify-between">
                  <span className="text-text-dim print:text-gray-700">إجمالي المبيعات (Gross Sales):</span>
                  <span className="font-mono font-bold">{financials.grossSales.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between text-rose-400 print:text-red-600">
                  <span>(-) الخصومات والمسموحات الممنوحة (Discounts):</span>
                  <span className="font-mono font-bold">({financials.discounts.toLocaleString('ar-EG')}) ج.م</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-400 print:text-black border-t border-border pt-1.5 text-xs">
                  <span>(=) صافي المبيعات (Net Revenue):</span>
                  <span className="font-mono font-black">{financials.netSales.toLocaleString('ar-EG')} ج.م</span>
                </div>
              </div>
            </div>

            {/* 2. COGS & Gross Profit */}
            <div className="bg-card2/50 rounded-2xl p-4 border border-border print:bg-transparent print:border-gray-300">
              <div className="font-black text-sm text-text-main print:text-black mb-2 flex justify-between border-b border-border pb-1">
                <span>2. تكلفة البضاعة المباعة (Cost of Goods Sold - COGS)</span>
              </div>
              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-amber-400 print:text-gray-800">
                  <span>(-) تكلفة شراء البضائع المباعة:</span>
                  <span className="font-mono font-bold">({financials.cogs.toLocaleString('ar-EG')}) ج.م</span>
                </div>
                <div className="flex justify-between font-black text-sm text-emerald-400 print:text-black border-t-2 border-border pt-2">
                  <span>(=) مجمل الربح التجاري (Gross Profit):</span>
                  <span className="font-mono">{financials.grossProfit.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between text-[11px] text-text-dim print:text-gray-600">
                  <span>هامش مجمل الربح (%):</span>
                  <span className="font-mono font-bold text-gold print:text-black">{financials.grossMargin}%</span>
                </div>
              </div>
            </div>

            {/* 3. Operating Expenses */}
            <div className="bg-card2/50 rounded-2xl p-4 border border-border print:bg-transparent print:border-gray-300">
              <div className="font-black text-sm text-text-main print:text-black mb-2 flex justify-between border-b border-border pb-1">
                <span>3. المصروفات التشغيلية والعمومية (Operating Expenses)</span>
              </div>
              <div className="space-y-1.5 pt-1">
                {financials.expensesList.map((exp, idx) => (
                  <div key={idx} className="flex justify-between text-text-dim print:text-gray-700">
                    <span>- {exp.name}:</span>
                    <span className="font-mono font-bold">{exp.value.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                ))}
                {financials.expensesList.length === 0 && (
                  <div className="text-text-dim text-[11px]">لا توجد مصروفات مسجلة</div>
                )}
                <div className="flex justify-between font-bold text-rose-400 print:text-red-600 border-t border-border pt-1.5">
                  <span>(=) إجمالي المصروفات التشغيلية:</span>
                  <span className="font-mono font-black">({financials.totalExpenses.toLocaleString('ar-EG')}) ج.م</span>
                </div>
              </div>
            </div>

            {/* 4. Final Net Profit Statement */}
            <div className={`rounded-2xl p-5 border-2 ${
              financials.netProfit >= 0 
                ? 'bg-emerald-950/20 border-emerald-500/50 print:bg-transparent print:border-black' 
                : 'bg-rose-950/20 border-rose-500/50 print:bg-transparent print:border-black'
            }`}>
              <div className="flex justify-between items-center text-sm font-bold text-text-dim print:text-gray-700 mb-1">
                <span>أرباح التشغيل قبل الضرائب (Operating Profit / EBITDA):</span>
                <span className="font-mono font-bold">{financials.operatingProfit.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex justify-between items-center text-xs text-text-dim print:text-gray-700 mb-3">
                <span>ضريبة القيمة المضافة المحصلة (VAT):</span>
                <span className="font-mono">{financials.taxes.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex justify-between items-center text-base sm:text-lg font-black border-t-2 border-border pt-3">
                <span className="text-text-main print:text-black">صافي الربح النهائي (Net Profit):</span>
                <span className={`font-mono text-xl sm:text-2xl ${
                  financials.netProfit >= 0 ? 'text-emerald-400 print:text-black' : 'text-rose-400 print:text-red-600'
                }`}>
                  {financials.netProfit.toLocaleString('ar-EG')} ج.م
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-text-dim print:text-gray-700 mt-2">
                <span>هامش صافي الربح (Net Margin %):</span>
                <span className="font-mono font-black text-gold print:text-black">{financials.netMargin}%</span>
              </div>
            </div>

            {/* Signatures for Official ERP Export */}
            <div className="pt-8 grid grid-cols-2 text-center text-xs text-text-dim print:text-gray-800">
              <div className="space-y-6">
                <div>المحاسب المسؤول: ______________</div>
                <div>التوقيع: ______________</div>
              </div>
              <div className="space-y-6">
                <div>اعتماد الإدارة: ______________</div>
                <div>الختم: ______________</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
