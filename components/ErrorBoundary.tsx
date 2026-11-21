'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMsg = error.message || 'حدث خطأ غير متوقع في التطبيق.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        displayMsg = parsed.error.includes('Missing or insufficient permissions')
          ? 'تعذر الوصول للبيانات بسبب صلاحيات الأمان — يرجى تسجيل الدخول بحساب موثق.'
          : parsed.error;
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, message: displayMsg };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#0A0D12] text-slate-100 flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full bg-[#10141D] border border-rose-500/40 rounded-xl p-6 text-center space-y-4 shadow-2xl">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" aria-hidden="true" />
            <h1 className="text-base font-bold text-white">تعذر إتمام العملية</h1>
            <p className="text-xs text-slate-300 leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-md transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
