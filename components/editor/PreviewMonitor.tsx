'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  SkipBack,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatTimecode } from '@/lib/editor/timelineMath';
import type { AspectRatio } from '@/lib/editor/types';

interface PreviewMonitorProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeekStart: () => void;
  onStepFrame: (direction: -1 | 1) => void;
  currentTime: number;
  duration: number;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  masterMuted: boolean;
  onToggleMasterMute: () => void;
  audioLevel: number; // 0..100
  activeDenoiseCount: number;
}

const ASPECT_OPTIONS: Array<{ id: AspectRatio; label: string }> = [
  { id: '16:9', label: '16:9 سينما' },
  { id: '9:16', label: '9:16 ريلز' },
  { id: '1:1', label: '1:1 مربع' },
  { id: '4:5', label: '4:5 بورتريه' },
  { id: '21:9', label: '21:9 عريض' },
];

export default function PreviewMonitor({
  canvasRef,
  isPlaying,
  onTogglePlay,
  onSeekStart,
  onStepFrame,
  currentTime,
  duration,
  aspectRatio,
  onAspectRatioChange,
  masterMuted,
  onToggleMasterMute,
  audioLevel,
  activeDenoiseCount,
}: PreviewMonitorProps) {
  const aspectCss: Record<AspectRatio, string> = {
    '16:9': '16 / 9',
    '9:16': '9 / 16',
    '1:1': '1 / 1',
    '4:5': '4 / 5',
    '21:9': '21 / 9',
  };

  return (
    <section
      aria-label="شاشة المعاينة اللحظية"
      className="flex-1 flex flex-col bg-[#080B10] min-w-0 min-h-0"
    >
      {/* Monitor Top Strip */}
      <div className="h-10 shrink-0 px-3 border-b border-white/10 bg-[#0D1118] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="aspect-select" className="text-xs text-slate-400 whitespace-nowrap">
            الأبعاد
          </label>
          <select
            id="aspect-select"
            value={aspectRatio}
            onChange={(e) => onAspectRatioChange(e.target.value as AspectRatio)}
            className="bg-[#161C27] text-slate-100 text-xs border border-white/10 rounded px-2 py-1 outline-none focus:border-amber-400"
          >
            {ASPECT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          {activeDenoiseCount > 0 && (
            <span className="text-cyan-300 font-medium whitespace-nowrap">
              عزل الضوضاء مفعل ({activeDenoiseCount})
            </span>
          )}
          <div className="flex items-center gap-2" aria-label="مؤشر مستوى الصوت">
            <span className="text-[11px] font-mono text-slate-400">VU</span>
            <div className="w-20 h-2 bg-[#171D29] rounded-sm overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-l from-amber-400 via-emerald-400 to-cyan-400 transition-all duration-75"
                style={{ width: `${Math.min(100, Math.max(2, audioLevel))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Live Canvas Stage */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0 overflow-hidden bg-[#07090D]">
        <div
          className="relative max-h-full max-w-full shadow-2xl border border-white/12 bg-black flex items-center justify-center"
          style={{
            aspectRatio: aspectCss[aspectRatio],
            height: aspectRatio === '9:16' || aspectRatio === '4:5' ? '100%' : 'auto',
            width: aspectRatio === '9:16' || aspectRatio === '4:5' ? 'auto' : '100%',
            maxHeight: '100%',
            maxWidth: '100%',
          }}
        >
          <canvas
            ref={canvasRef}
            data-testid="preview-canvas"
            className="w-full h-full block object-contain"
          />
        </div>
      </div>

      {/* Transport Controls Bar */}
      <div className="h-12 shrink-0 px-4 border-t border-white/10 bg-[#0D1118] flex items-center justify-between gap-4">
        <div className="font-mono text-xs text-slate-200 whitespace-nowrap" dir="ltr">
          <span className="text-amber-400 font-semibold">{formatTimecode(currentTime, 30)}</span>
          <span className="text-slate-500 mx-1.5">/</span>
          <span className="text-slate-400">{formatTimecode(duration, 30)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSeekStart}
            aria-label="العودة للبداية"
            title="العودة للبداية"
            className="p-2 text-slate-300 hover:text-white hover:bg-[#19202D] rounded-md transition-colors"
          >
            <SkipBack className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onStepFrame(-1)}
            aria-label="إطار للخلف"
            title="إطار للخلف"
            className="p-2 text-slate-300 hover:text-white hover:bg-[#19202D] rounded-md transition-colors"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'إيقاف المعاينة' : 'تشغيل المعاينة'}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" aria-hidden="true" />
                <span>إيقاف</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" aria-hidden="true" />
                <span>تشغيل</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onStepFrame(1)}
            aria-label="إطار للأمام"
            title="إطار للأمام"
            className="p-2 text-slate-300 hover:text-white hover:bg-[#19202D] rounded-md transition-colors"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMasterMute}
            aria-label={masterMuted ? 'إلغاء كتم الصوت العام' : 'كتم الصوت العام'}
            className="p-2 text-slate-300 hover:text-white hover:bg-[#19202D] rounded-md transition-colors"
          >
            {masterMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4 text-slate-200" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
