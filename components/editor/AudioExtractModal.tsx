'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileAudio,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import {
  extractAudioInBrowser,
  processAudioChannelsWithDenoise,
} from '@/lib/audio/clientAudioExtractor';
import { renderProjectMixdownChannels } from '@/lib/audio/noiseSuppressor';
import { DENOISE_PRESETS } from '@/lib/editor/timelineMath';
import type {
  AudioExtractFormat,
  DenoisePreset,
  MediaAsset,
  TimelineClip,
  TimelineTrack,
} from '@/lib/editor/types';

interface AudioExtractModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: MediaAsset[];
  initialAssetId?: string | null;
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  assetsMap: Map<string, MediaAsset>;
  projectDuration: number;
}

export default function AudioExtractModal({
  isOpen,
  onClose,
  assets,
  initialAssetId,
  clips,
  tracks,
  assetsMap,
  projectDuration,
}: AudioExtractModalProps) {
  const mediaWithAudio = assets.filter((a) => a.kind === 'video' || a.kind === 'audio');

  const [sourceMode, setSourceMode] = useState<'timeline' | 'asset' | 'upload'>(
    initialAssetId ? 'asset' : mediaWithAudio.length > 0 ? 'asset' : 'timeline'
  );
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    initialAssetId || mediaWithAudio[0]?.id || ''
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [format, setFormat] = useState<AudioExtractFormat>('mp3');
  const [bitrate, setBitrate] = useState<'320k' | '256k' | '192k' | '128k'>('320k');
  const [sampleRate, setSampleRate] = useState<48000 | 44100>(48000);
  const [denoiseEnabled, setDenoiseEnabled] = useState(true);
  const [denoisePreset, setDenoisePreset] = useState<DenoisePreset>('studio');

  const [status, setStatus] = useState<'idle' | 'converting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [outputName, setOutputName] = useState('audio_extracted.mp3');
  const [outputNote, setOutputNote] = useState<string>('');

  if (!isOpen) return null;

  const handleExtract = async () => {
    setStatus('converting');
    setErrorMsg('');
    setOutputNote('');
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    try {
      let baseName = 'cinestudio_audio';
      let channels: [Float32Array, Float32Array] | null = null;
      let inputFile: File | null = null;

      if (sourceMode === 'timeline') {
        const mix = await renderProjectMixdownChannels(
          clips,
          tracks,
          assetsMap,
          Math.max(1, projectDuration),
          sampleRate,
          denoiseEnabled
        );
        channels = mix.channels;
        baseName = 'timeline_master';
      } else {
        let arrayBuffer: ArrayBuffer;
        if (sourceMode === 'upload') {
          if (!uploadedFile) {
            throw new Error('يرجى اختيار ملف فيديو أو صوت أولاً');
          }
          inputFile = uploadedFile;
          baseName = uploadedFile.name.replace(/\.[^.]+$/, '');
          arrayBuffer = await uploadedFile.arrayBuffer();
        } else {
          const asset = assets.find((a) => a.id === selectedAssetId);
          if (!asset) throw new Error('يرجى اختيار ملف من المشروع');
          baseName = asset.name.replace(/\.[^.]+$/, '');
          if (asset.rawFile) {
            inputFile = asset.rawFile;
            arrayBuffer = await asset.rawFile.arrayBuffer();
          } else {
            const resp = await fetch(asset.src);
            const blob = await resp.blob();
            inputFile = new File([blob], asset.name, { type: asset.mimeType || 'audio/wav' });
            arrayBuffer = await blob.arrayBuffer();
          }
        }

        // Decode audio directly in browser
        const decodeCtx = new AudioContext();
        try {
          const decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
          const ch0 = decoded.getChannelData(0);
          const ch1 = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : ch0;
          channels = await processAudioChannelsWithDenoise(
            [ch0, ch1],
            decoded.sampleRate,
            sampleRate,
            denoiseEnabled,
            denoisePreset
          );
        } catch {
          channels = null;
        } finally {
          await decodeCtx.close().catch(() => {});
        }
      }

      if (channels) {
        const res = await extractAudioInBrowser({
          channels,
          sampleRate,
          format,
          bitrate,
        });
        const url = URL.createObjectURL(res.blob);
        setDownloadUrl(url);
        setOutputName(`${baseName}.${res.actualExt}`);
        if (res.note) setOutputNote(res.note);
        setStatus('done');
        return;
      }

      // Optional server fallback only if browser couldn't decode an exotic format AND server has FFmpeg
      if (inputFile) {
        const preset = DENOISE_PRESETS[denoisePreset];
        const formData = new FormData();
        formData.append('file', inputFile);
        formData.append('format', format);
        formData.append('bitrate', bitrate);
        formData.append('sampleRate', String(sampleRate));
        formData.append('denoiseEnabled', String(denoiseEnabled));
        formData.append('denoiseStrength', String(preset.denoiseStrength));
        formData.append('windCutHz', String(preset.windCutHz));
        formData.append('hissCutHz', String(preset.hissCutHz));
        formData.append('voiceBoost', String(preset.voiceBoost));
        formData.append('normalize', String(preset.normalize));

        const resp = await fetch('/api/audio/extract', {
          method: 'POST',
          body: formData,
        });

        if (!resp.ok) {
          throw new Error(
            'صيغة هذا الملف غير مدعومة لفك التشفير الصوتي في المتصفح. جرب ملف MP4 أو WebM أو WAV أو MP3.'
          );
        }

        const outBlob = await resp.blob();
        const ext = format === 'aac' ? 'm4a' : format;
        const url = URL.createObjectURL(outBlob);
        setDownloadUrl(url);
        setOutputName(`${baseName}.${ext}`);
        setStatus('done');
        return;
      }

      throw new Error('تعذر استخراج المسار الصوتي من هذا الملف');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'فشلت عملية التحويل');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-extract-title"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-xl bg-[#10141D] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-[#0D1017] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileAudio className="w-5 h-5 text-cyan-400" aria-hidden="true" />
            <div>
              <h2 id="audio-extract-title" className="text-base font-bold text-white">
                تحويل الفيديو إلى صوت (MP3 · WAV · M4A)
              </h2>
              <p className="text-xs text-slate-400">
                استخراج فوري مباشرة على جهازك مع إزالة الضوضاء والهواء
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة استخراج الصوت"
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Source Selector */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 block">مصدر الفيديو أو الصوت</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSourceMode('upload')}
                className={`p-2 rounded-md border text-xs font-medium transition-colors ${
                  sourceMode === 'upload'
                    ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                    : 'border-white/10 bg-[#161C27] text-slate-300'
                }`}
              >
                رفع ملف من الجهاز
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('asset')}
                className={`p-2 rounded-md border text-xs font-medium transition-colors ${
                  sourceMode === 'asset'
                    ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                    : 'border-white/10 bg-[#161C27] text-slate-300'
                }`}
              >
                من وسائط المشروع
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('timeline')}
                className={`p-2 rounded-md border text-xs font-medium transition-colors ${
                  sourceMode === 'timeline'
                    ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                    : 'border-white/10 bg-[#161C27] text-slate-300'
                }`}
              >
                كامل التايم لاين
              </button>
            </div>

            {sourceMode === 'upload' && (
              <label className="flex items-center justify-center gap-2 p-4 border border-dashed border-white/20 rounded-lg bg-[#161C27] hover:border-cyan-400/60 cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                <span className="text-xs text-slate-200">
                  {uploadedFile ? uploadedFile.name : 'اختر أي فيديو (MP4, MOV, MKV, WebM...)'}
                </span>
                <input
                  type="file"
                  accept="video/*,audio/*,*/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setUploadedFile(f);
                  }}
                />
              </label>
            )}

            {sourceMode === 'asset' && (
              <select
                aria-label="اختيار ملف من المشروع"
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full bg-[#161C27] border border-white/10 rounded-md px-3 py-2 text-xs text-white outline-none"
              >
                {mediaWithAudio.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.originalExt.toUpperCase()})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Target Format Grid */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300 block">صيغة الصوت المطلوبة</span>
            <div className="grid grid-cols-5 gap-2">
              {(
                [
                  { id: 'mp3', label: 'MP3', desc: 'شامل' },
                  { id: 'wav', label: 'WAV', desc: 'بدون ضغط' },
                  { id: 'aac', label: 'AAC', desc: 'M4A' },
                  { id: 'flac', label: 'FLAC', desc: 'نقي 100%' },
                  { id: 'ogg', label: 'OGG', desc: 'Opus' },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setFormat(fmt.id)}
                  className={`p-2 rounded-md border text-center transition-colors ${
                    format === fmt.id
                      ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                      : 'border-white/10 bg-[#161C27] text-slate-300 hover:border-white/25'
                  }`}
                >
                  <div className="font-mono text-xs font-bold">{fmt.label}</div>
                  <div className="text-[10px] text-slate-400">{fmt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Bitrate & Sample Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="audio-bitrate" className="text-xs text-slate-300 block">
                جودة البت (Bitrate)
              </label>
              <select
                id="audio-bitrate"
                value={bitrate}
                disabled={format === 'wav' || format === 'flac'}
                onChange={(e) =>
                  setBitrate(e.target.value as '320k' | '256k' | '192k' | '128k')
                }
                className="w-full bg-[#161C27] border border-white/10 rounded-md px-2.5 py-2 text-xs text-white outline-none disabled:opacity-45"
              >
                <option value="320k">320 kbps (أعلى جودة)</option>
                <option value="256k">256 kbps (عالية)</option>
                <option value="192k">192 kbps (متوازنة)</option>
                <option value="128k">128 kbps (حجم صغير)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="audio-samplerate" className="text-xs text-slate-300 block">
                معدل التردد (Sample Rate)
              </label>
              <select
                id="audio-samplerate"
                value={sampleRate}
                onChange={(e) => setSampleRate(Number(e.target.value) as 48000 | 44100)}
                className="w-full bg-[#161C27] border border-white/10 rounded-md px-2.5 py-2 text-xs text-white outline-none"
              >
                <option value={48000}>48,000 Hz (استوديو فيديو)</option>
                <option value={44100}>44,100 Hz (CD قياسي)</option>
              </select>
            </div>
          </div>

          {/* Noise Removal Option */}
          <div className="p-3.5 rounded-lg bg-[#161C27] border border-white/10 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-xs font-bold text-cyan-300">
                  إزالة الضوضاء والهواء أثناء التحويل
                </div>
                <div className="text-[11px] text-slate-400">
                  ينقي المقطع الصوتي من الرياح والوشوشة تلقائياً
                </div>
              </div>
              <input
                type="checkbox"
                checked={denoiseEnabled}
                onChange={(e) => setDenoiseEnabled(e.target.checked)}
                className="accent-cyan-400 w-4 h-4"
              />
            </label>

            {denoiseEnabled && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                {(['studio', 'wind', 'voice', 'hiss'] as DenoisePreset[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDenoisePreset(key)}
                    className={`py-1.5 px-2 rounded border text-[11px] transition-colors ${
                      denoisePreset === key
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 font-semibold'
                        : 'border-white/10 bg-[#10141D] text-slate-300'
                    }`}
                  >
                    {DENOISE_PRESETS[key].labelAr}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status & Download */}
          {status === 'done' && downloadUrl && (
            <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
                <div>
                  <span className="text-xs font-bold text-emerald-200 block">
                    جاهز! تم التحويل إلى {outputName.split('.').pop()?.toUpperCase()} بنجاح
                  </span>
                  {outputNote && (
                    <span className="text-[11px] text-emerald-300/80 block">{outputNote}</span>
                  )}
                </div>
              </div>
              <a
                href={downloadUrl}
                download={outputName}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs rounded-md transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>تحميل {outputName.split('.').pop()?.toUpperCase()}</span>
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
            disabled={status === 'converting'}
            onClick={handleExtract}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors disabled:opacity-50"
          >
            {status === 'converting' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>جاري التحويل...</span>
              </>
            ) : (
              <>
                <FileAudio className="w-4 h-4" aria-hidden="true" />
                <span>تحويل واستخراج الآن</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
