import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    const state = (this as any).state as State;
    const props = (this as any).props as Props;

    if (state.hasError) {
      return (
        <div className="p-8 m-4 bg-card rounded-2xl border border-danger/30 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center text-2xl">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-text-main">
            {props.fallbackTitle || 'حدث خطأ غير متوقع في هذا القسم'}
          </h2>
          <p className="text-sm text-text-dim max-w-md">
            {state.error?.message || 'تعذر تحميل البيانات أو حدث استثناء أثناء معالجة الطلب.'}
          </p>
          <button
            onClick={() => (this as any).setState({ hasError: false, error: undefined })}
            className="flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-dark text-black font-bold rounded-xl transition-all shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </button>
        </div>
      );
    }

    return props.children;
  }
}
