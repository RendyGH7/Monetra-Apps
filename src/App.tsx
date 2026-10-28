export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-xl shadow-indigo-500/10 mb-2">
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Monetra Canvas Ready
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Seluruh konten lama telah dibersihkan. Aplikasi siap dibangun ulang sesuai panduan <code className="text-indigo-300 font-mono text-xs bg-indigo-950/70 border border-indigo-800/60 px-1.5 py-0.5 rounded">prd.md</code> dan <code className="text-indigo-300 font-mono text-xs bg-indigo-950/70 border border-indigo-800/60 px-1.5 py-0.5 rounded">design.md</code>.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Vite + React + TailwindCSS Standby</span>
        </div>
      </div>
    </div>
  );
}
