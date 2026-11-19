import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  public state: State = { hasError: false, message: '' };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected application error' };
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950 p-6 text-slate-100">
          <div className="w-full max-w-md rounded-xl border border-red-500/40 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-red-400">System Recovery</h2>
            <p className="mt-2 text-sm text-slate-300 break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400"
            >
              Reload Arena
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
