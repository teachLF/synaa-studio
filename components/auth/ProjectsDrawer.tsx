'use client';

import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  CloudUpload,
  FolderOpen,
  Loader2,
  LogOut,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { formatShortDuration } from '@/lib/editor/timelineMath';
import { resendAccountVerification, signOutAccount } from '@/lib/firebase/client';
import type { CloudProjectSummary } from '@/lib/firebase/projectStore';

interface ProjectsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  projects: CloudProjectSummary[];
  activeProjectId: string;
  isSaving: boolean;
  loadingProjectId: string | null;
  onOpenAuth: () => void;
  onSaveCurrent: () => void;
  onCreateNewProject: () => void;
  onLoadProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

export default function ProjectsDrawer({
  isOpen,
  onClose,
  user,
  projects,
  activeProjectId,
  isSaving,
  loadingProjectId,
  onOpenAuth,
  onSaveCurrent,
  onCreateNewProject,
  onLoadProject,
  onDeleteProject,
}: ProjectsDrawerProps) {
  const [verifySent, setVerifySent] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="projects-drawer-title"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-start"
    >
      <div className="w-full max-w-md bg-[#10141D] border-l border-white/15 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-[#0D1017] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2 id="projects-drawer-title" className="text-base font-bold text-white">
              مشاريعي السحابية
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق لوحة المشاريع"
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!user ? (
            <div className="p-5 rounded-xl bg-[#151B26] border border-white/10 text-center space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                سجل الدخول بحسابك (جوجل، أبل، جيت هاب، أو رابط البريد الإلكتروني) لحفظ مشاريعك ووسائطك تلقائياً والرجوع إليها من أي جهاز.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-md transition-colors"
              >
                تسجيل الدخول الآن
              </button>
            </div>
          ) : (
            <>
              {/* Account Bar */}
              <div className="p-3 rounded-lg bg-[#151B26] border border-white/10 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {user.displayName || 'مستخدم سينا ستوديو'}
                  </div>
                  <div dir="ltr" className="text-[11px] font-mono text-slate-400 truncate text-right">
                    {user.email || user.uid}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => signOutAccount()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#1E2636] hover:bg-rose-950/60 text-xs text-slate-300 hover:text-rose-200 border border-white/10 transition-colors shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>خروج</span>
                </button>
              </div>

              {/* Email Verification Notice if unverified */}
              {!user.emailVerified && (
                <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 space-y-2">
                  <div className="flex items-start gap-2 text-xs text-amber-200">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>يرجى توثيق بريدك الإلكتروني لتفعيل الحفظ السحابي الآمن للمشاريع والوسائط.</span>
                  </div>
                  <button
                    type="button"
                    disabled={verifySent}
                    onClick={async () => {
                      await resendAccountVerification(user);
                      setVerifySent(true);
                    }}
                    className="px-3 py-1.5 rounded bg-amber-400 text-slate-950 font-bold text-[11px] disabled:opacity-50"
                  >
                    {verifySent ? 'تم إرسال رسالة التوثيق!' : 'إرسال رسالة توثيق البريد'}
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isSaving || !user.emailVerified}
                  onClick={onSaveCurrent}
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CloudUpload className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>{isSaving ? 'جاري الحفظ...' : 'حفظ المشروع الآن'}</span>
                </button>

                <button
                  type="button"
                  onClick={onCreateNewProject}
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#19202D] hover:bg-[#222B3C] text-slate-100 border border-white/10 font-semibold text-xs transition-colors"
                >
                  <Plus className="w-4 h-4 text-sky-400" aria-hidden="true" />
                  <span>مشروع جديد</span>
                </button>
              </div>

              {/* Saved Projects List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>المشاريع المحفوظة</span>
                  <span className="font-mono">{projects.length}</span>
                </div>

                {projects.length === 0 ? (
                  <div className="p-6 text-center rounded-lg border border-dashed border-white/10 text-xs text-slate-400">
                    لا توجد مشاريع محفوظة بعد. اضغط «حفظ المشروع الآن» لحفظ مشروعك ووسائطه في السحابة.
                  </div>
                ) : (
                  projects.map((proj) => {
                    const isActive = proj.id === activeProjectId;
                    const isLoadingThis = loadingProjectId === proj.id;
                    return (
                      <div
                        key={proj.id}
                        className={`p-3 rounded-lg border transition-colors flex items-center justify-between gap-2 ${
                          isActive
                            ? 'bg-amber-500/10 border-amber-400/50'
                            : 'bg-[#151B26] border-white/10 hover:border-white/25'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onLoadProject(proj.id)}
                          disabled={loadingProjectId !== null}
                          className="flex-1 text-right min-w-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate">
                              {proj.name}
                            </span>
                            {isLoadingThis && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                            )}
                          </div>
                          <div dir="ltr" className="text-[11px] font-mono text-slate-400 mt-0.5 text-right">
                            {proj.aspectRatio} · {formatShortDuration(proj.duration)} · {proj.clipsCount} clips
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteProject(proj.id)}
                          aria-label={`حذف مشروع ${proj.name}`}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/15 transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
