import { useState } from 'react';

export default function App() {
  const [copied, setCopied] = useState(false);

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col justify-between p-6 sm:p-12">
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm tracking-tight">
            M
          </div>
          <span className="font-semibold text-base tracking-tight text-white">
            Monetra
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Antislop Aktif</span>
        </div>
      </header>

      <main className="max-w-xl w-full mx-auto my-12 text-center space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Kanvas Siap Membangun
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Struktur kode telah dibersihkan dari komentar dan pola template AI.
            Sistem siap mengimplementasikan fitur lengkap sesuai berkas panduan.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-left space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">
            Langkah Selanjutnya
          </p>
          <div className="space-y-2 text-sm text-slate-200">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="font-mono text-xs text-indigo-300">prd.md</span>
              <button
                type="button"
                onClick={() => copyPath('prd.md')}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
              >
                {copied ? 'Tersalin' : 'Salin Nama'}
              </button>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="font-mono text-xs text-indigo-300">design.md</span>
              <button
                type="button"
                onClick={() => copyPath('design.md')}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
              >
                {copied ? 'Tersalin' : 'Salin Nama'}
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-4xl w-full mx-auto pt-6 border-t border-slate-800 text-center text-xs text-slate-300">
        <span>React 19 + TypeScript + Tailwind CSS + Supabase</span>
      </footer>
    </div>
  );
}
