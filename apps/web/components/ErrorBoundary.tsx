"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-950 font-sans">
          <section className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-xl flex flex-col items-center text-center gap-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 border border-rose-100 text-rose-600 text-xl font-bold">
              ⚠️
            </span>
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900">Something went wrong</h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                An unexpected runtime error occurred. Our team has been notified.
              </p>
            </div>
            {this.state.error && (
              <pre className="w-full text-left bg-slate-50 border border-slate-100 rounded-lg p-3 text-[10px] text-slate-500 font-mono overflow-x-auto max-h-32">
                {this.state.error.message || "Unknown Error"}
              </pre>
            )}
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-750 text-xs font-bold text-white transition shadow"
              >
                Reload Page
              </button>
              <a
                href="/dashboard"
                className="flex-1 h-10 rounded-lg border border-slate-250 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition flex items-center justify-center"
              >
                Go to Dashboard
              </a>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
