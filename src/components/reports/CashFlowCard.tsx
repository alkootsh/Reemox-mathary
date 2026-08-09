import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Scale, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';

export interface CashFlowData {
  // Inflows
  cashSales: number;
  cardAndWalletSales: number;
  customerDebtCollected: number;
  totalInflows: number;
  
  // Outflows
  cashPurchases: number;
  supplierDebtPaid: number;
  operatingExpenses: number;
  totalOutflows: number;
  
  // Net
  netOperatingCashFlow: number;
  
  // Working Capital
  cashOnHandEstimate: number;
  totalReceivables: number;
  totalPayables: number;
  workingCapital: number;
}

interface Props {
  data: CashFlowData;
}

export default function CashFlowCard({ data }: Props) {
  const isPositive = data.netOperatingCashFlow >= 0;

  return (
    <div className="space-y-6">
      <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-400">
                <Wallet size={20} />
              </span>
              <h3 className="text-base font-black text-text-main">
                قائمة التدفقات النقدية والسيولة التشغيلية (Operating Cash Flow Statement)
              </h3>
            </div>
            <p className="text-xs text-text-dim mt-1">
              تتبع حركة النقدية الفعلية الداخلة والخارجة من الخزينة لضمان استقرار السيولة وسداد الالتزامات في مواعيدها.
            </p>
          </div>

          <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 font-bold text-xs ${
            isPositive
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <span>{isPositive ? '✅ فائض سيولة نقدية' : '⚠️ عجز في السيولة النقدية'}</span>
          </div>
        </div>

        {/* Inflows vs Outflows Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5">
          {/* Total Inflows */}
          <div className="bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/30">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400 mb-1">
              <span className="flex items-center gap-1.5">
                <ArrowDownLeft size={16} />
                <span>إجمالي التدفقات النقدية الداخلة (+)</span>
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {data.totalInflows.toLocaleString('ar-EG')} <span className="text-xs font-normal">ج.م</span>
            </div>
            <div className="space-y-1.5 mt-3 pt-3 border-t border-emerald-500/20 text-xs text-text-dim">
              <div className="flex justify-between">
                <span>المبيعات النقدية المباشرة:</span>
                <span className="font-bold text-text-main">{data.cashSales.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex justify-between">
                <span>مدفوعات الكروت والمحافظ:</span>
                <span className="font-bold text-text-main">{data.cardAndWalletSales.toLocaleString('ar-EG')} ج.م</span>
              </div>
            </div>
          </div>

          {/* Total Outflows */}
          <div className="bg-rose-950/20 p-4 rounded-2xl border border-rose-500/30">
            <div className="flex items-center justify-between text-xs font-bold text-rose-400 mb-1">
              <span className="flex items-center gap-1.5">
                <ArrowUpRight size={16} />
                <span>إجمالي التدفقات النقدية الخارجة (-)</span>
              </span>
            </div>
            <div className="text-2xl font-black text-rose-400 mt-1">
              {data.totalOutflows.toLocaleString('ar-EG')} <span className="text-xs font-normal">ج.م</span>
            </div>
            <div className="space-y-1.5 mt-3 pt-3 border-t border-rose-500/20 text-xs text-text-dim">
              <div className="flex justify-between">
                <span>المشتريات النقدية المسددة:</span>
                <span className="font-bold text-text-main">{data.cashPurchases.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex justify-between">
                <span>المصروفات التشغيلية:</span>
                <span className="font-bold text-text-main">{data.operatingExpenses.toLocaleString('ar-EG')} ج.م</span>
              </div>
            </div>
          </div>

          {/* Net Cash Flow */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
            isPositive ? 'bg-card2 border-emerald-500/40' : 'bg-card2 border-rose-500/40'
          }`}>
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-text-dim mb-1">
                <span>صافي التدفق النقدي التشغيلي</span>
                <Scale size={16} className={isPositive ? 'text-emerald-400' : 'text-rose-400'} />
              </div>
              <div className={`text-2xl font-black mt-1 ${
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {data.netOperatingCashFlow.toLocaleString('ar-EG')} <span className="text-xs font-normal text-text-dim">ج.م</span>
              </div>
            </div>
            <p className="text-[11px] text-text-dim mt-2 pt-2 border-t border-border">
              {isPositive 
                ? 'النشاط التشغيلي يولد سيولة نقدية موجبة كافية لتغطية التكاليف.' 
                : 'يوجد استنزاف نقدي يستدعي تسريع التحصيل أو ترشيد المشتريات.'}
            </p>
          </div>
        </div>

        {/* Working Capital Breakdown */}
        <div className="bg-card2 p-4 rounded-2xl border border-border mt-4">
          <h4 className="text-xs font-bold text-text-main mb-3 flex items-center gap-2">
            <span>⚖️</span>
            <span>مؤشر رأس المال العامل والالتزامات الائتمانية (Working Capital Matrix)</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-card p-3 rounded-xl border border-border">
              <div className="text-text-dim text-[11px]">مستحقات لنا طرف العملاء (مدينون)</div>
              <div className="text-base font-bold text-danger mt-1">
                {data.totalReceivables.toLocaleString('ar-EG')} ج.م
              </div>
            </div>
            <div className="bg-card p-3 rounded-xl border border-border">
              <div className="text-text-dim text-[11px]">مستحقات علينا للموردين (دائنون)</div>
              <div className="text-base font-bold text-amber-400 mt-1">
                {data.totalPayables.toLocaleString('ar-EG')} ج.م
              </div>
            </div>
            <div className="bg-card p-3 rounded-xl border border-border">
              <div className="text-text-dim text-[11px]">صافي الفارق الائتماني (لنا / علينا)</div>
              <div className={`text-base font-bold mt-1 ${
                data.totalReceivables >= data.totalPayables ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {(data.totalReceivables - data.totalPayables).toLocaleString('ar-EG')} ج.م
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
