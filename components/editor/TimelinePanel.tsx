'use client';

import React, { useRef, useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  Lock,
  Magnet,
  Scissors,
  Trash2,
  Unlock,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { formatShortDuration, snapTime } from '@/lib/editor/timelineMath';
import { getTransitionById } from '@/lib/editor/transitions';
import type { MediaAsset, TimelineClip, TimelineTrack } from '@/lib/editor/types';

interface TimelinePanelProps {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  assets: Map<string, MediaAsset>;
  selectedClipId: string | null;
  currentTime: number;
  projectDuration: number;
  zoomPxPerSec: number;
  snapEnabled: boolean;
  onSelectClip: (clipId: string) => void;
  onSeek: (time: number) => void;
  onMoveClip: (clipId: string, newStartTime: number) => void;
  onTrimClip: (clipId: string, newStartTime: number, newDuration: number, newTrimStart: number) => void;
  onSplitAtPlayhead: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onToggleTrackMute: (trackId: string) => void;
  onToggleTrackHidden: (trackId: string) => void;
  onToggleTrackLock: (trackId: string) => void;
  onToggleSnap: () => void;
  onZoomChange: (pxPerSec: number) => void;
}

export default function TimelinePanel({
  tracks,
  clips,
  assets,
  selectedClipId,
  currentTime,
  projectDuration,
  zoomPxPerSec,
  snapEnabled,
  onSelectClip,
  onSeek,
  onMoveClip,
  onTrimClip,
  onSplitAtPlayhead,
  onDuplicateSelected,
  onDeleteSelected,
  onToggleTrackMute,
  onToggleTrackHidden,
  onToggleTrackLock,
  onToggleSnap,
  onZoomChange,
}: TimelinePanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<{
    mode: 'move' | 'trim-left' | 'trim-right';
    clipId: string;
    startX: number;
    origStart: number;
    origDuration: number;
    origTrimStart: number;
  } | null>(null);

  const timelineTotalSec = Math.max(20, Math.ceil(projectDuration + 6));
  const timelineWidthPx = timelineTotalSec * zoomPxPerSec;

  // Snapping targets that exclude the clip being dragged — otherwise a clip
  // snaps to its own edges and refuses to move until you jump more than the
  // snap threshold in one gesture.
  const snapTargetsFor = (clipId: string) => {
    const pts = [0, currentTime];
    for (const c of clips) {
      if (c.id === clipId) continue;
      pts.push(c.startTime, c.startTime + c.duration);
    }
    return pts;
  };

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const updateFromClientX = (clientX: number) => {
      // LTR timeline coordinates inside scroll container for precise frame math
      const x = Math.max(0, clientX - rect.left);
      onSeek(Number((x / zoomPxPerSec).toFixed(3)));
    };
    updateFromClientX(e.clientX);

    const onMove = (ev: PointerEvent) => updateFromClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startClipDrag = (
    e: React.PointerEvent,
    clip: TimelineClip,
    mode: 'move' | 'trim-left' | 'trim-right',
    isLocked: boolean
  ) => {
    e.stopPropagation();
    onSelectClip(clip.id);
    if (isLocked) return;

    const startX = e.clientX;
    const origStart = clip.startTime;
    const origDuration = clip.duration;
    const origTrimStart = clip.trimStart;
    const dragSnapTargets = snapTargetsFor(clip.id);

    setDragState({ mode, clipId: clip.id, startX, origStart, origDuration, origTrimStart });

    const onPointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dt = dx / zoomPxPerSec;

      if (mode === 'move') {
        let nextStart = Math.max(0, origStart + dt);
        if (snapEnabled) {
          nextStart = snapTime(nextStart, dragSnapTargets, 0.2);
        }
        onMoveClip(clip.id, nextStart);
      } else if (mode === 'trim-right') {
        let nextDur = Math.max(0.4, origDuration + dt);
        if (snapEnabled) {
          const snappedEnd = snapTime(origStart + nextDur, dragSnapTargets, 0.2);
          nextDur = Math.max(0.4, snappedEnd - origStart);
        }
        onTrimClip(clip.id, origStart, Number(nextDur.toFixed(3)), origTrimStart);
      } else if (mode === 'trim-left') {
        const clampedDt = Math.min(origDuration - 0.4, Math.max(-origStart, dt));
        const nextStart = Math.max(0, Number((origStart + clampedDt).toFixed(3)));
        const nextDur = Math.max(0.4, Number((origDuration - (nextStart - origStart)).toFixed(3)));
        const nextTrim = Math.max(0, Number((origTrimStart + (nextStart - origStart)).toFixed(3)));
        onTrimClip(clip.id, nextStart, nextDur, nextTrim);
      }
    };

    const onPointerUp = () => {
      setDragState(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const tickStepSec = zoomPxPerSec >= 75 ? 1 : zoomPxPerSec >= 35 ? 2 : 5;
  const ticks: number[] = [];
  for (let s = 0; s <= timelineTotalSec; s += tickStepSec) {
    ticks.push(s);
  }

  return (
    <section
      aria-label="المخطط الزمني متعدد الطبقات"
      className="h-64 sm:h-72 shrink-0 bg-[#0E121B] border-t border-white/10 flex flex-col select-none"
    >
      {/* Timeline Toolbar */}
      <div className="h-10 shrink-0 px-3 border-b border-white/10 bg-[#121722] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSplitAtPlayhead}
            disabled={!selectedClipId}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#1A2130] hover:bg-[#232D41] text-slate-200 rounded border border-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <Scissors className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
            <span>تقسيم</span>
          </button>

          <button
            type="button"
            onClick={onDuplicateSelected}
            disabled={!selectedClipId}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#1A2130] hover:bg-[#232D41] text-slate-200 rounded border border-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>تكرار</span>
          </button>

          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={!selectedClipId}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#1A2130] hover:bg-rose-950/60 text-rose-300 rounded border border-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>حذف</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSnap}
            aria-pressed={snapEnabled}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
              snapEnabled
                ? 'bg-amber-400/15 border-amber-400/50 text-amber-300'
                : 'bg-[#1A2130] border-white/10 text-slate-400'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">التصاق ذكي</span>
          </button>

          <div className="flex items-center gap-1 bg-[#161C27] border border-white/10 rounded px-1.5 py-0.5">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(20, zoomPxPerSec - 15))}
              aria-label="تصغير المخطط الزمني"
              className="p-1 text-slate-300 hover:text-white"
            >
              <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <span className="font-mono text-[11px] text-slate-400 w-10 text-center">
              {Math.round(zoomPxPerSec)}%
            </span>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(180, zoomPxPerSec + 15))}
              aria-label="تكبير المخطط الزمني"
              className="p-1 text-slate-300 hover:text-white"
            >
              <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Split: Track Headers (Right in RTL) + LTR Time Canvas */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Track Headers */}
        <div className="w-44 sm:w-52 shrink-0 bg-[#10141D] border-l border-white/10 flex flex-col">
          <div className="h-7 border-b border-white/10 px-2.5 flex items-center text-[11px] font-medium text-slate-400 shrink-0">
            الطبقات والمسارات
          </div>
          <div className="flex-1 overflow-y-auto">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="h-11 border-b border-white/8 px-2.5 flex items-center justify-between gap-1 bg-[#111621]"
              >
                <span className="text-[11px] font-medium text-slate-200 truncate">
                  {track.name}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleTrackMute(track.id)}
                    aria-label={track.muted ? `تشغيل صوت ${track.name}` : `كتم ${track.name}`}
                    className={`p-1 rounded ${
                      track.muted ? 'text-rose-400 bg-rose-500/15' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </button>
                  {track.type !== 'audio' && (
                    <button
                      type="button"
                      onClick={() => onToggleTrackHidden(track.id)}
                      aria-label={track.hidden ? `إظهار ${track.name}` : `إخفاء ${track.name}`}
                      className={`p-1 rounded ${
                        track.hidden ? 'text-amber-400 bg-amber-500/15' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {track.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleTrackLock(track.id)}
                    aria-label={track.locked ? `فك قفل ${track.name}` : `قفل ${track.name}`}
                    className={`p-1 rounded ${
                      track.locked ? 'text-amber-300 bg-amber-500/15' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable LTR Timeline Canvas */}
        <div
          ref={scrollRef}
          dir="ltr"
          className="flex-1 overflow-auto bg-[#0A0D12] relative"
        >
          <div style={{ width: `${timelineWidthPx}px` }} className="relative min-h-full">
            {/* Time Ruler */}
            <div
              onPointerDown={handleRulerPointerDown}
              className="h-7 border-b border-white/10 bg-[#121722] sticky top-0 z-20 cursor-ew-resize"
            >
              {ticks.map((sec) => (
                <div
                  key={sec}
                  style={{ left: `${sec * zoomPxPerSec}px` }}
                  className="absolute top-0 bottom-0 border-l border-white/15 pl-1 flex items-center"
                >
                  <span className="font-mono text-[10px] text-slate-400">
                    {formatShortDuration(sec)}
                  </span>
                </div>
              ))}
            </div>

            {/* Track Lanes */}
            <div className="relative">
              {tracks.map((track) => {
                const trackClips = clips.filter((c) => c.trackId === track.id);
                return (
                  <div
                    key={track.id}
                    className={`h-11 border-b border-white/8 relative ${
                      track.hidden ? 'opacity-40' : ''
                    }`}
                  >
                    {trackClips.map((clip) => {
                      const left = clip.startTime * zoomPxPerSec;
                      const width = Math.max(24, clip.duration * zoomPxPerSec);
                      const selected = clip.id === selectedClipId;
                      const asset = clip.assetId ? assets.get(clip.assetId) : undefined;
                      const inTr =
                        clip.inTransition.type !== 'none'
                          ? getTransitionById(clip.inTransition.type)
                          : null;

                      return (
                        <div
                          key={clip.id}
                          data-testid={`timeline-clip-${clip.id}`}
                          onPointerDown={(e) => startClipDrag(e, clip, 'move', track.locked)}
                          style={{
                            left: `${left}px`,
                            width: `${width}px`,
                            borderColor: selected ? '#FBBF24' : 'rgba(255,255,255,0.16)',
                          }}
                          className={`absolute top-1 bottom-1 rounded overflow-hidden border cursor-grab active:cursor-grabbing flex items-center px-2 transition-shadow ${
                            selected
                              ? 'ring-1 ring-amber-400 bg-[#242C3D] z-10'
                              : 'bg-[#18202E] hover:bg-[#1E283A]'
                          } ${dragState?.clipId === clip.id ? 'opacity-90' : ''}`}
                        >
                          {/* Color Accent Strip on Top */}
                          <div
                            className="absolute top-0 left-0 right-0 h-1"
                            style={{ backgroundColor: clip.accentColor }}
                          />

                          {/* Waveform for Audio */}
                          {clip.kind === 'audio' && asset?.waveform && (
                            <div className="absolute inset-0 flex items-end gap-[2px] px-1 opacity-30 pointer-events-none">
                              {asset.waveform.map((amp, i) => (
                                <div
                                  key={i}
                                  className="flex-1 bg-cyan-400 rounded-t-sm"
                                  style={{ height: `${Math.round(amp * 75)}%` }}
                                />
                              ))}
                            </div>
                          )}

                          {/* Left Trim Handle */}
                          <div
                            onPointerDown={(e) => startClipDrag(e, clip, 'trim-left', track.locked)}
                            title="تقصير بداية المقطع"
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize hover:bg-amber-400/50 z-10"
                          />

                          {/* Label + Transition indicator */}
                          <div className="relative z-0 flex items-center justify-between gap-1.5 w-full min-w-0">
                            <span
                              dir="rtl"
                              className="text-[11px] font-medium text-slate-100 truncate"
                            >
                              {clip.name}
                            </span>
                            {inTr && width > 90 && (
                              <span
                                dir="rtl"
                                className="text-[10px] text-amber-300 font-medium truncate shrink-0"
                              >
                                ✦ {inTr.nameAr}
                              </span>
                            )}
                          </div>

                          {/* Right Trim Handle */}
                          <div
                            onPointerDown={(e) => startClipDrag(e, clip, 'trim-right', track.locked)}
                            title="تقصير نهاية المقطع"
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-amber-400/50 z-10"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Playhead Needle */}
              <div
                style={{ left: `${Math.max(2, currentTime * zoomPxPerSec)}px` }}
                className="absolute top-0 bottom-0 w-[2px] bg-amber-400 pointer-events-none z-30"
              >
                <div className="w-2.5 h-2.5 -ml-[4px] -mt-0.5 bg-amber-400 rotate-45 rounded-[1px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
