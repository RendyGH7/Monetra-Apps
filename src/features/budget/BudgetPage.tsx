import React, { useState } from 'react';
import { Target, AlertTriangle, Plus, PiggyBank } from 'lucide-react';
import { useAppStore } from '../../store';
import { formatCurrency, stripEmoji } from '../../utils/format';
import { CategoryIcon } from '../../components/common/CategoryIcon';

export const BudgetPage: React.FC = () => {
  const { categories, transactions, goals, addGoal, updateGoalProgress, profile } = useAppStore();

  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [addGoalModal, setAddGoalModal] = useState(false);

  const budgetAllocations = [
    {
      categoryName: 'Makanan & Minuman',
      budgetAmount: 450000,
      note: 'Target harian Rp 15.000 untuk makan siang magang',
    },
    {
      categoryName: 'Kencan & Pacaran',
      budgetAmount: profile.dating_budget_est || 600000,
      note: '3 - 4 kali kencan per minggu (target max Rp 150.000 / minggu)',
    },
    {
      categoryName: 'Transportasi',
      budgetAmount: 200000,
      note: 'Bensin motor & operasional bolak-balik magang',
    },
    {
      categoryName: 'Tagihan & Pulsa',
      budgetAmount: 100000,
      note: 'Paket data & komunikasi',
    },
  ];

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(newGoalTarget.replace(/[^\d]/g, ''), 10);
    if (!newGoalName.trim() || !target) return;

    addGoal({
      user_id: profile.id,
      name: stripEmoji(newGoalName),
      target_amount: target,
      current_amount: 0,
      deadline: '2026-12-31',
    });

    setNewGoalName('');
    setNewGoalTarget('');
    setAddGoalModal(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-[#EEF2F6]">
            Budget & Target Finansial
          </h1>
          <p className="text-xs sm:text-sm text-[#A3AFBC] mt-0.5">
            Kelola pos anggaran bulanan dan pantau target tabungan darurat
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAddGoalModal(true)}
          className="btn-primary px-4 py-2 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-semibold flex items-center gap-1.5 self-start cursor-pointer shadow-md"
        >
          <Plus size={15} />
          <span>Tambah Target Tabungan</span>
        </button>
      </div>

      {/* Monthly Budget Allocations */}
      <div className="glass-1 p-5 rounded-2xl border-[rgba(205,225,245,0.12)] space-y-4">
        <h2 className="text-sm font-semibold text-[#EEF2F6]">
          Batas Anggaran Kategori (Gaji Magang Rp 1.500.000)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgetAllocations.map((b, idx) => {
            const cat = categories.find((c) => c.name === b.categoryName);
            const spent = transactions
              .filter((t) => t.category_id === cat?.id && t.type === 'expense')
              .reduce((sum, t) => sum + t.amount, 0);

            const pct = Math.min(100, Math.round((spent / b.budgetAmount) * 100));
            const isWarning = pct >= 80 && pct < 100;
            const isOver = pct >= 100;

            return (
              <div
                key={idx}
                className="card-lift glass-2 p-4 rounded-xl border-[rgba(205,225,245,0.1)] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                      <CategoryIcon name={b.categoryName} size={16} color={cat?.color || '#E39A5E'} />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-[#EEF2F6]">
                        {b.categoryName}
                      </p>
                      <p className="text-[10px] text-[#A3AFBC]">{b.note}</p>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold num-tabular ${
                      isOver ? 'text-[#EE5D6C]' : isWarning ? 'text-[#F2C14E]' : 'text-[#4FD3A4]'
                    }`}
                  >
                    {pct}%
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    className={`h-full rounded-full progress-fill ${
                      isOver ? 'bg-[#EE5D6C]' : isWarning ? 'bg-[#F2C14E]' : 'bg-[#E39A5E]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[#A3AFBC]">
                  <span>Terpakai: {formatCurrency(spent)}</span>
                  <span>Batas: {formatCurrency(b.budgetAmount)}</span>
                </div>

                {isOver && (
                  <div className="p-2 rounded-lg bg-[#EE5D6C]/15 border border-[#EE5D6C]/30 text-[11px] text-[#EE5D6C] flex items-center gap-1.5">
                    <AlertTriangle size={13} className="shrink-0" />
                    <span>Anggaran ini telah melebihi batas yang direncanakan.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Savings Goals */}
      <div className="glass-1 p-5 rounded-2xl border-[rgba(205,225,245,0.12)] space-y-4">
        <div className="flex items-center gap-2">
          <PiggyBank size={18} className="text-[#4FD3A4]" />
          <h2 className="text-sm font-semibold text-[#EEF2F6]">
            Target Tabungan & Dana Impian
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));

            return (
              <div
                key={g.id}
                className="card-lift glass-2 p-4 rounded-xl border-[rgba(205,225,245,0.1)] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-[#EEF2F6]">
                    {g.name}
                  </span>
                  <span className="text-xs font-bold text-[#4FD3A4] num-tabular">{pct}%</span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#E39A5E] to-[#4FD3A4] rounded-full progress-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[#A3AFBC]">
                  <span>Terkumpul: {formatCurrency(g.current_amount)}</span>
                  <span>Target: {formatCurrency(g.target_amount)}</span>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
                  <span className="text-[11px] text-[#74808E]">Tenggat: {g.deadline || '2026-12-31'}</span>
                  <button
                    type="button"
                    onClick={() => updateGoalProgress(g.id, 50000)}
                    className="chip-press px-2.5 py-1 rounded-lg bg-[#4FD3A4]/15 border border-[#4FD3A4]/30 text-xs text-[#4FD3A4] font-medium hover:bg-[#4FD3A4]/25 cursor-pointer"
                    style={{ transition: 'background 0.15s ease' }}
                  >
                    + Rp 50.000
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Goal Modal */}
      {addGoalModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setAddGoalModal(false); }}
        >
          <div className="animate-scale-in glass-3 w-full max-w-sm p-5 rounded-2xl border border-[rgba(205,225,245,0.18)] space-y-4">
            <h3 className="text-sm font-semibold text-[#EEF2F6]">Tambah Target Tabungan Baru</h3>
            <form onSubmit={handleCreateGoal} className="space-y-3">
              <div>
                <label className="text-xs text-[#A3AFBC]">Nama Target</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kado Ulang Tahun Pacar, Dana Darurat"
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  className="input-glow w-full h-10 px-3 rounded-xl glass-1 text-xs text-[#EEF2F6] border border-white/[0.08] outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-[#A3AFBC]">Nominal Target (Rp)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="500000"
                  value={newGoalTarget}
                  onChange={(e) => setNewGoalTarget(e.target.value.replace(/[^\d]/g, ''))}
                  className="input-glow w-full h-10 px-3 rounded-xl glass-1 text-xs text-[#EEF2F6] border border-white/[0.08] outline-none mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddGoalModal(false)}
                  className="btn-ghost px-3 py-1.5 rounded-lg border border-[rgba(205,225,245,0.2)] text-xs text-[#EEF2F6] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-semibold cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
