'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, Download, Film, Loader2, Sparkles, X } from 'lucide-react';
import type { MediaElementCache } from '@/lib/editor/canvasRenderer';
import {
  getEstimatedBitrateKbps,
  getExportDimensions,
} from '@/lib/editor/timelineMath';
import type {
  AspectRatio,
  ExportCodec,
  ExportFormat,
  ExportQuality,
  ExportResolution,
  ExportSettings,
  MediaAsset,
  TimelineClip,
  TimelineTrack,
} from '@/lib/editor/types';
import { exportProjectInBrowser } from '@/lib/export/clientVideoExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  aspectRatio: AspectRatio;
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  assets: Map<string, MediaAsset>;
  getMediaCache: () => MediaElementCache;
  projectDuration: number;
}

export default function ExportModal({
  isOpen,
  onClose,
  projectName,
  aspectRatio,
  clips,
  tracks,
  assets,
  getMediaCache,
  projectDuration,
}: ExportModalProps) {
  const [resolution, setResolution] = useState<ExportResolution>('4k');
  const [ratio, setRatio] = useState<AspectRatio>(aspectRatio);
  const [fps, setFps] = useState<24 | 30 | 50 | 60>(60);
  const [format, setFormat] = useState<ExportFormat>('mp4');
  const [codec, setCodec] = useState<ExportCodec>('h264');
  const [quality, setQuality] = useState<ExportQuality>('ultra');
  const [includeDenoise, setIncludeDenoise] = useState(true);

  const [status, setStatus] = useState<'idle' | 'rendering' | 'encoding' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportedSizeMb, setExportedSizeMb] = useState<string>('');
  const [exportedDims, setExportedDims] = useState<{ width: number; height: number } | null>(null);
  const [exportedExt, setExportedExt] = useState<string>('mp4');
  const [engineUsed, setEngineUsed] = useState<string>('');

  const dims = useMemo(() => getExportDimensions(resolution, ratio), [resolution, ratio]);
  const bitrateKbps = useMemo(
    () => getEstimatedBitrateKbps(resolution, quality, fps),
    [resolution, quality, fps]
  );

  if (!isOpen) return null;

  const handleStartExport = async () => {
    const safeDuration = Math.max(1, projectDuration);
    setStatus('rendering');
    setProgress(4);
    setErrorMsg('');
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    try {
      const settings: ExportSettings = {
        resolution,
        aspectRatio: ratio,
        fps,
        format,
        codec,
        quality,
        includeDenoise,
      };

      const mediaCache = getMediaCache();
      const result = await exportProjectInBrowser({
        settings,
        clips,
        tracks,
        assets,
        mediaCache,
        duration: safeDuration,
        onProgress: (pct) => {
          setProgress(pct);
          if (pct >= 80) setStatus('encoding');
        },
      });

      const url = URL.createObjectURL(result.blob);
      setDownloadUrl(url);
      setExportedSizeMb((result.blob.size / (1024 * 1024)).toFixed(2));
      setExportedDims({ width: result.width, height: result.height });
      setExportedExt(result.actualFormat);
      setEngineUsed(result.engineLabel);
      setProgress(100);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء تصدير الفيديو');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-2xl bg-[#10141D] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-[#0D1017] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Film className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <div>
              <h2 id="export-modal-title" className="text-base font-bold text-white">
                تصدير الفيديو الاحترافي حتى 4K
              </h2>
              <p className="text-xs text-slate-400">
                معالجة فائقة السرعة مباشرة على جهازك مع دعم كامل لجميع الصيغ وعزل الضوضاء
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة التصدير"
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Resolution Selection */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300 block">دقة التصدير</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: '4k', title: '4K UHD', sub: '2160p فائقة' },
                  { id: '2k', title: '2K QHD', sub: '1440p عالية' },
                  { id: '1080p', title: 'Full HD', sub: '1080p قياسية' },
                  { id: '720p', title: 'HD', sub: '720p سريعة' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setResolution(opt.id)}
                  className={`p-2.5 rounded-lg border text-right transition-colors ${
                    resolution === opt.id
                      ? 'border-amber-400 bg-amber-400/15 text-amber-200'
                      : 'border-white/10 bg-[#161C27] text-slate-200 hover:border-white/25'
                  }`}
                >
                  <div className="font-mono text-sm font-bold">{opt.title}</div>
                  <div className="text-[11px] text-slate-400">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Grid Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label htmlFor="exp-format" className="text-xs text-slate-300 block">
                صيغة الحفظ
              </label>
              <select
                id="exp-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="w-full bg-[#161C27] border border-white/10 rounded-md px-2.5 py-2 text-xs text-white outline-none"
              >
                <option value="mp4">MP4 (الأكثر توافقاً)</option>
                <option value="mov">MOV (Apple Pro)</option>
                <option value="mkv">MKV (Matroska)</option>
                <option value="webm">WebM (ويب حديث)</option>
                <option value="avi">AVI / MP4 متوافق</option>
                <option value="gif">GIF (صورة متحركة)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="exp-fps" className="text-xs text-slate-300 block">
                معدل الإطارات (FPS)
              </label>
              <select
                id="exp-fps"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) as 24 | 30 | 50 | 60)}
                className="w-full bg-[#161C27] border border-white/10 rounded-md px-2.5 py-2 text-xs text-white outline-none"
              >
                <option value={24}>24 fps (سينمائي)</option>
                <option value={30}>30 fps (قياسي)</option>
                <option value={50}>50 fps (سلس)</option>
                <option value={60}>60 fps (فائق السلاسة)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="exp-codec" className="text-xs text-slate-300 block">
                الترميز (Codec)
              </label>
              <select
                id="exp-codec"
                value={codec}
                onChange={(e) => setCodec(e.target.value as ExportCodec)}
                className="w-full bg-[#161C27] border border-white/10 rounded-md px-2.5 py-2 text-xs text-white outline-none"
              >
                <option value="h264">H.264 / AVC</option>
                <option value="h265">H.265 / HEVC</option>
                <option value="vp9">VP9</option>
                <option value="prores">Apple ProRes (MOV)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="exp-quality" className="text-xs text-slate-300 block">
                الجودة ومعدل البت
              </label>
              <select
                id="exp-quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value as ExportQuality)}
                className="w-full bg-[#161C27] border border-white/10 rounded-md px-2.5 py-2 text-xs text-white outline-none"
              >
                <option value="ultra">فائقة (Ultra)</option>
                <option value="high">عالية (High)</option>
                <option value="balanced">متوازنة</option>
                <option value="compact">حجم مضغوط</option>
              </select>
            </div>
          </div>

          {/* Aspect Ratio + Denoise Master Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="exp-ratio" className="text-xs text-slate-300 block">
                نسبة الأبعاد
              </label>
              <select
                id="exp-ratio"
                value={ratio}
                onChange={(e) => setRatio(e.target.value as AspectRatio)}
                className="w-full bg-[#161C27] border border-white/10 rounded-md px-2.5 py-2 text-xs text-white outline-none"
              >
                <option value="16:9">16:9 (يوتيوب وتلفاز)</option>
                <option value="9:16">9:16 (تيك توك وريلز)</option>
                <option value="1:1">1:1 (مربع إنستغرام)</option>
                <option value="4:5">4:5 (بورتريه)</option>
                <option value="21:9">21:9 (سينمائي عريض)</option>
              </select>
            </div>

            <label className="flex items-center justify-between p-3 rounded-lg bg-[#161C27] border border-white/10 cursor-pointer">
              <div>
                <div className="text-xs font-semibold text-cyan-300">
                  تطبيق عزل الضوضاء الشامل
                </div>
                <div className="text-[11px] text-slate-400">
                  تنقية الصوت من الهواء والضجيج أثناء التصدير
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeDenoise}
                onChange={(e) => setIncludeDenoise(e.target.checked)}
                className="accent-cyan-400 w-4 h-4"
              />
            </label>
          </div>

          {/* Spec Summary */}
          <div className="p-3 rounded-lg bg-[#0D1017] border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <div dir="ltr" className="font-mono">
              {dims.width}×{dims.height} · {fps} FPS · {format.toUpperCase()} ·{' '}
              {(bitrateKbps / 1000).toFixed(1)} Mbps
            </div>
            <div className="text-slate-400 font-mono">
              المدة: {Math.max(1, projectDuration).toFixed(1)}s
            </div>
          </div>

          {/* Progress & Result */}
          {(status === 'rendering' || status === 'encoding') && (
            <div className="space-y-2 p-3.5 rounded-lg bg-[#151B26] border border-amber-400/30">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-2 text-amber-300 font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  {status === 'rendering'
                    ? 'جاري رسم الإطارات والانتقالات ومعالجة الصوت...'
                    : 'جاري تغليف وتصدير الملف النهائي عالي الدقة...'}
                </span>
                <span className="font-mono text-white font-bold">{progress}%</span>
              </div>
              <div className="h-2 bg-[#0A0D12] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {status === 'done' && downloadUrl && (
            <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-xs font-bold text-emerald-200">
                    تم تصدير الفيديو بنجاح بدقة{' '}
                    <span dir="ltr">
                      {exportedDims ? `${exportedDims.width}×${exportedDims.height}` : `${dims.width}×${dims.height}`}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-emerald-300/80">
                    الحجم: {exportedSizeMb} MB · الصيغة: {exportedExt.toUpperCase()}
                    {engineUsed ? ` · ${engineUsed}` : ''}
                  </div>
                </div>
              </div>
              <a
                href={downloadUrl}
                download={`${projectName || 'video'}_${resolution}.${exportedExt}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs rounded-md transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>تنزيل الملف الآن</span>
              </a>
            </div>
          )}

          {status === 'error' && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-[#0D1017] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-[#171D29] rounded-md border border-white/10"
          >
            إغلاق
          </button>
          <button
            type="button"
            disabled={status === 'rendering' || status === 'encoding'}
            onClick={handleStartExport}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>
              {status === 'rendering' || status === 'encoding'
                ? 'جاري التصدير...'
                : `بدء التصدير (${resolution.toUpperCase()})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
