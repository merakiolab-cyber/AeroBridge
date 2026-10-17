import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AeroBridge ErrorBoundary] Uncaught render error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    window.location.reload();
  };

  private handleClearAndReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#121316] text-[#e4e4e7] flex items-center justify-center p-6 select-none font-sans">
          <div className="max-w-xl w-full bg-[#18191d] border border-red-500/30 rounded-2xl p-8 shadow-2xl shadow-black/80 backdrop-blur-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide">
                  AeroBridge Studio — Chyba zobrazení
                </h1>
                <p className="text-sm text-zinc-400">
                  Došlo k neočekávané chybě při inicializaci uživatelského rozhraní.
                </p>
              </div>
            </div>

            <div className="bg-[#121316] border border-white/5 rounded-xl p-4 mb-6 overflow-auto max-h-60 text-xs font-mono text-zinc-300">
              <div className="text-red-400 font-semibold mb-2">
                {this.state.error?.name}: {this.state.error?.message}
              </div>
              {this.state.error?.stack && (
                <pre className="text-zinc-500 whitespace-pre-wrap text-[11px] leading-relaxed">
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={this.handleClearAndReset}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium transition-colors flex items-center gap-2 border border-white/10 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-zinc-400" />
                Vyčistit stav & restartovat
              </button>
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Restartovat aplikaci
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
