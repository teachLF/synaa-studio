'use client';

import React from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  CloudUpload,
  Download,
  FileAudio,
  Film,
  FolderOpen,
  FolderPlus,
  Loader2,
  LogIn,
  Redo2,
  Scissors,
  Undo2,
  UserCheck,
} from 'lucide-react';
import type { AspectRatio } from '@/lib/editor/types';

interface TopToolbarProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  aspectRatio: AspectRatio;
  onImportClick: () => void;
  onSplitClick: () => void;
  canSplit: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenAudioExtract: () => void;
  onOpenExport: () => void;
  isTranscoding: boolean;
  user: User | null;
  authReady: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onSaveProject: () => void;
  onOpenProjects: () => void;
  onOpenAuth: () => void;
}

export default function TopToolbar({
  projectName,
  onProjectNameChange,
  aspectRatio,
  onImportClick,
  onSplitClick,
  canSplit,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenAudioExtract,
  onOpenExport,
  isTranscoding,
  user,
  authReady,
  saveStatus,
  onSaveProject,
  onOpenProjects,
  onOpenAuth,
}: TopToolbarProps) {
  return (
    <header className="h-14 shrink-0 bg-[#10141D] border-b border-white/10 px-4 flex items-center justify-between gap-3">
      {/* Zone 1: Brand & Project Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <Film className="w-5 h-5 text-amber-400" aria-hidden="true" />
          <span className="font-display text-base font-bold tracking-tight text-white">
            سينا ستوديو
          </span>
        </div>
        <span className="text-slate-600 select-none hidden sm:inline" aria-hidden="true">
          /
        </span>
        <input
          type="text"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          aria-label="اسم المشروع"
          className="hidden sm:block bg-transparent text-sm text-slate-200 font-medium border border-transparent hover:border-white/10 focus:border-amber-500/60 focus:bg-[#171D29] rounded px-2 py-1 outline-none w-36 xl:w-44 truncate transition-colors"
        />
        <span
          dir="ltr"
          className="hidden xl:inline text-xs font-mono text-slate-400 whitespace-nowrap shrink-0"
        >
          {aspectRatio} · 4K UHD
        </span>
      </div>

      {/* Zone 2: Primary Editing & Conversion Tools */}
      <nav aria-label="أدوات التحرير السريعة" className="flex items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={onImportClick}
          disabled={isTranscoding}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-100 bg-[#19202D] hover:bg-[#222B3C] border border-white/10 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <FolderPlus className="w-4 h-4 text-amber-400" aria-hidden="true" />
          <span>{isTranscoding ? 'جاري التحويل...' : 'استيراد وسائط'}</span>
        </button>

        <button
          type="button"
          onClick={onSplitClick}
          disabled={!canSplit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#19202D] hover:bg-[#222B3C] border border-white/10 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
        >
          <Scissors className="w-4 h-4 text-sky-400" aria-hidden="true" />
          <span className="hidden md:inline">تقسيم عند المؤشر</span>
        </button>

        <div className="flex items-center border border-white/10 rounded-md overflow-hidden shrink-0">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="تراجع"
            title="تراجع (Ctrl+Z)"
            className="p-1.5 text-slate-300 hover:bg-[#1E2636] disabled:opacity-35 transition-colors"
          >
            <Undo2 className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="إعادة"
            title="إعادة (Ctrl+Y)"
            className="p-1.5 text-slate-300 hover:bg-[#1E2636] border-r border-white/10 disabled:opacity-35 transition-colors"
          >
            <Redo2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenAudioExtract}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-200 bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/30 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <FileAudio className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          <span className="hidden lg:inline">تحويل الفيديو إلى صوت</span>
          <span className="lg:hidden">صوت</span>
        </button>
      </nav>

      {/* Zone 3: Cloud Account, Saved Projects & 4K Export CTA */}
      <div className="flex items-center gap-2 shrink-0">
        {user ? (
          <>
            <button
              type="button"
              onClick={onSaveProject}
              disabled={saveStatus === 'saving'}
              title="حفظ المشروع والوسائط في حسابك"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-200 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 rounded-md transition-colors whitespace-nowrap"
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : saveStatus === 'saved' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              )}
              <span className="hidden md:inline">
                {saveStatus === 'saving'
                  ? 'جاري الحفظ...'
                  : saveStatus === 'saved'
                  ? 'محفوظ'
                  : 'حفظ سحابي'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenProjects}
              aria-label="مشاريعي والحساب"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#19202D] hover:bg-[#222B3C] border border-white/10 rounded-md transition-colors whitespace-nowrap"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span className="hidden lg:inline max-w-[96px] truncate">
                {user.displayName || 'مشاريعي'}
              </span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onOpenProjects}
              aria-label="مشاريعي المحفوظة"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#19202D] hover:bg-[#222B3C] border border-white/10 rounded-md transition-colors whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span className="hidden lg:inline">مشاريعي</span>
            </button>

            <button
              type="button"
              onClick={onOpenAuth}
              disabled={!authReady}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-100 bg-[#1B2232] hover:bg-[#252E44] border border-white/15 rounded-md transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <LogIn className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>تسجيل الدخول</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onOpenExport}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>تصدير 4K</span>
        </button>
      </div>
    </header>
  );
}
