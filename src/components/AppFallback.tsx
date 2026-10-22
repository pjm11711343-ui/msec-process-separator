import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class AppFallback extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // Send error to server for debugging
    fetch('/api/log-client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        timestamp: new Date().toISOString()
      }),
    }).catch(() => {});
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl shadow-2xl p-8 text-center ring-1 ring-black/5">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-red-50">
              <AlertTriangle size={40} />
            </div>
            
            <h1 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">문제가 발생했습니다</h1>
            <p className="text-slate-500 mb-8 leading-relaxed font-medium">
              애플리케이션을 렌더링하는 중 예기치 않은 오류가 발생했습니다.
              브라우저 캐시를 삭제하거나 페이지를 새로고침 해보세요.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8 text-left overflow-auto max-h-40">
               <code className="text-[10px] font-mono text-red-500 whitespace-pre-wrap break-all">
                 {this.state.error?.toString()}
               </code>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-indigo-100 hover:shadow-indigo-200 active:scale-[0.98]"
            >
              <RefreshCw size={18} />
              새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppFallback;
