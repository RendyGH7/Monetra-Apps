import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bell,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Check,
  CheckCheck,
  X,
  Calendar,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { useAppStore } from '../../store';
import {
  generateAINotifications,
  getStoredReadNotificationIds,
  saveStoredReadNotificationIds,
} from '../../utils/aiNotifications';
import { AINotification, NotificationSeverity } from '../../types';

interface NotificationBellProps {
  className?: string;
  align?: 'right' | 'left';
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  className = '',
  align = 'right',
}) => {
  const {
    profile,
    transactions,
    categories,
    wallets,
    goals,
    memories,
    setActiveTab,
    setAssistantInitialPrompt,
  } = useAppStore();

  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(() => getStoredReadNotificationIds());
  const [activeFilter, setActiveFilter] = useState<'all' | 'warning' | 'tip'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Re-generate notifications whenever financial data or read state changes
  const notifications = useMemo(() => {
    return generateAINotifications({
      profile,
      transactions,
      categories,
      wallets,
      goals,
      memories,
      readIds,
    });
  }, [profile, transactions, categories, wallets, goals, memories, readIds]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Sync read IDs with localStorage
  const markAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const next = [...readIds, id];
      setReadIds(next);
      saveStoredReadNotificationIds(next);
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    const merged = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(merged);
    saveStoredReadNotificationIds(merged);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'warning') {
      return notifications.filter((n) => n.severity === 'warning' || n.severity === 'danger');
    }
    if (activeFilter === 'tip') {
      return notifications.filter((n) => n.severity === 'info' || n.severity === 'success');
    }
    return notifications;
  }, [notifications, activeFilter]);

  const handleActionClick = (notif: AINotification) => {
    markAsRead(notif.id);
    setIsOpen(false);

    if (notif.actionPrompt) {
      setAssistantInitialPrompt(notif.actionPrompt);
      setActiveTab('asisten');
    } else if (notif.actionTab) {
      setActiveTab(notif.actionTab);
    }
  };

  const getSeverityIcon = (sev: NotificationSeverity) => {
    switch (sev) {
      case 'danger':
        return <AlertCircle size={15} className="text-[#EE5D6C]" />;
      case 'warning':
        return <AlertTriangle size={15} className="text-[#E39A5E]" />;
      case 'success':
        return <Check size={15} className="text-[#4FD3A4]" />;
      case 'info':
      default:
        return <Sparkles size={15} className="text-[#9DB2CE]" />;
    }
  };

  const getSeverityBadgeClass = (sev: NotificationSeverity) => {
    switch (sev) {
      case 'danger':
        return 'bg-[#EE5D6C]/15 border-[#EE5D6C]/30 text-[#EE5D6C]';
      case 'warning':
        return 'bg-[#E39A5E]/15 border-[#E39A5E]/30 text-[#E39A5E]';
      case 'success':
        return 'bg-[#4FD3A4]/15 border-[#4FD3A4]/30 text-[#4FD3A4]';
      case 'info':
      default:
        return 'bg-[#9DB2CE]/15 border-[#9DB2CE]/30 text-[#9DB2CE]';
    }
  };

  const getSeverityLabel = (sev: NotificationSeverity) => {
    switch (sev) {
      case 'danger':
        return 'Penting';
      case 'warning':
        return 'Peringatan';
      case 'success':
        return 'Progres Positif';
      case 'info':
      default:
        return 'Saran AI';
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Notification Bell Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Buka Notifikasi Cerdas Monetra"
        aria-expanded={isOpen}
        className={`relative w-10 h-10 rounded-xl glass-2 border transition-all duration-200 flex items-center justify-center cursor-pointer active:scale-95 shadow-xs ${
          isOpen
            ? 'border-[#E39A5E] text-[#E39A5E] bg-[#E39A5E]/10 shadow-md shadow-[#E39A5E]/20'
            : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[#EEF2F6] hover:border-[#E39A5E]/40'
        }`}
        title={`Notifikasi AI Monetra (${unreadCount} belum dibaca)`}
      >
        <Bell size={18} strokeWidth={2.2} />

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-[10px] font-black num-tabular flex items-center justify-center shadow-md shadow-black/40 ring-2 ring-[var(--bg-base)] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Flyout Panel */}
      {isOpen && (
        <div
          ref={dropdownRef}
          role="dialog"
          aria-label="Pusat Notifikasi AI Monetra"
          className={`absolute top-12 z-50 w-[340px] sm:w-[400px] max-w-[calc(100vw-2rem)] glass-1 rounded-2xl border border-[rgba(205,225,245,0.18)] shadow-2xl shadow-black/60 p-4 animate-fade-in backdrop-blur-xl ${
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#E39A5E]/15 border border-[#E39A5E]/30 text-[#E39A5E] flex items-center justify-center shrink-0">
                <Sparkles size={14} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-[#EEF2F6] leading-tight">
                  Notifikasi Monetra AI
                </h3>
                <p className="text-[10px] text-[#A3AFBC]">
                  Evaluasi riil berbasis catatan transaksimu
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-[#A3AFBC] hover:text-[#EEF2F6] border border-white/[0.06] flex items-center gap-1 transition-all cursor-pointer"
                  title="Tandai semua sudah dibaca"
                >
                  <CheckCheck size={12} className="text-[#4FD3A4]" />
                  <span>Baca Semua</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-white/[0.08] text-[#A3AFBC] hover:text-[#EEF2F6] flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 pt-2.5 pb-2">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-[#E39A5E]/20 text-[#E39A5E] border border-[#E39A5E]/40 font-semibold'
                  : 'bg-white/[0.03] text-[#A3AFBC] hover:text-[#EEF2F6] border border-transparent'
              }`}
            >
              Semua ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('warning')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                activeFilter === 'warning'
                  ? 'bg-[#EE5D6C]/20 text-[#EE5D6C] border border-[#EE5D6C]/40 font-semibold'
                  : 'bg-white/[0.03] text-[#A3AFBC] hover:text-[#EEF2F6] border border-transparent'
              }`}
            >
              Peringatan ({notifications.filter((n) => n.severity === 'warning' || n.severity === 'danger').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('tip')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                activeFilter === 'tip'
                  ? 'bg-[#4FD3A4]/20 text-[#4FD3A4] border border-[#4FD3A4]/40 font-semibold'
                  : 'bg-white/[0.03] text-[#A3AFBC] hover:text-[#EEF2F6] border border-transparent'
              }`}
            >
              Saran & Progres ({notifications.filter((n) => n.severity === 'info' || n.severity === 'success').length})
            </button>
          </div>

          {/* Notification List */}
          <div className="space-y-2 mt-1 max-h-[380px] overflow-y-auto pr-0.5 custom-scrollbar">
            {filteredNotifications.length === 0 ? (
              <div className="py-8 text-center px-4">
                <div className="w-10 h-10 rounded-full bg-white/[0.04] text-[#A3AFBC] flex items-center justify-center mx-auto mb-2 border border-white/[0.06]">
                  <Check size={18} />
                </div>
                <p className="text-xs font-semibold text-[#EEF2F6]">Semua Terkendali</p>
                <p className="text-[11px] text-[#74808E] mt-0.5">
                  Tidak ada pemberitahuan atau peringatan pada filter ini.
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => markAsRead(item.id)}
                  className={`p-3 rounded-xl transition-all cursor-pointer border relative group ${
                    item.read
                      ? 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] opacity-80 hover:opacity-100'
                      : 'glass-2 border-[rgba(205,225,245,0.12)] hover:border-[#E39A5E]/40 shadow-xs'
                  }`}
                >
                  {/* Top Badge & Unread Dot */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1.5 ${getSeverityBadgeClass(
                        item.severity
                      )}`}
                    >
                      {getSeverityIcon(item.severity)}
                      <span>{getSeverityLabel(item.severity)}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      {!item.read && (
                        <span
                          className="w-2 h-2 rounded-full bg-[#E39A5E] shadow-xs shadow-[#E39A5E]/50"
                          title="Belum dibaca"
                        />
                      )}
                    </div>
                  </div>

                  {/* Title & Message */}
                  <h4 className="text-xs font-semibold text-[#EEF2F6] leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-[#A3AFBC] mt-1 leading-relaxed">
                    {item.message}
                  </p>

                  {/* Action Link Button */}
                  {(item.actionTab || item.actionPrompt) && (
                    <div className="mt-2.5 pt-2 border-t border-white/[0.04] flex items-center justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActionClick(item);
                        }}
                        className="text-[11px] font-medium text-[#E39A5E] hover:text-[#CF8143] flex items-center gap-1 transition-colors cursor-pointer group-hover:translate-x-0.5"
                      >
                        <span>
                          {item.actionPrompt
                            ? 'Tanya AI'
                            : item.actionTab === 'statistik'
                            ? 'Lihat Analisis'
                            : item.actionTab === 'budget'
                            ? 'Buka Budget'
                            : item.actionTab === 'transaksi'
                            ? 'Lihat Transaksi'
                            : 'Lihat Detail'}
                        </span>
                        <ArrowRight size={12} strokeWidth={2.2} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer Note */}
          <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-[#74808E]">
            <span>Monetra Intelligence Engine</span>
            <span>Aturan 50/30/20 & DSP</span>
          </div>
        </div>
      )}
    </div>
  );
};

