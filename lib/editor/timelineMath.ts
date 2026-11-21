import type {
  AspectRatio,
  AudioCleanupProps,
  ColorAdjustments,
  DenoisePreset,
  ExportQuality,
  ExportResolution,
  FilterPreset,
  TimelineClip,
  TimelineTrack,
  TransformProps,
} from './types';

export function formatTimecode(seconds: number, fps = 30): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const frames = Math.floor((safe - Math.floor(safe)) * fps);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

export function formatShortDuration(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(safe / 60);
  const secs = (safe % 60).toFixed(1).padStart(4, '0');
  return `${String(mins).padStart(2, '0')}:${secs}`;
}

export function getProjectDuration(clips: TimelineClip[]): number {
  if (clips.length === 0) return 0;
  return clips.reduce((max, clip) => Math.max(max, clip.startTime + clip.duration), 0);
}

export function getExportDimensions(
  resolution: ExportResolution,
  aspectRatio: AspectRatio
): { width: number; height: number } {
  const shortSideMap: Record<ExportResolution, number> = {
    '4k': 2160,
    '2k': 1440,
    '1080p': 1080,
    '720p': 720,
  };
  const shortSide = shortSideMap[resolution];

  let rawW: number;
  let rawH: number;

  switch (aspectRatio) {
    case '16:9':
      rawH = shortSide;
      rawW = Math.round((shortSide * 16) / 9);
      break;
    case '9:16':
      rawW = shortSide;
      rawH = Math.round((shortSide * 16) / 9);
      break;
    case '1:1':
      rawW = shortSide;
      rawH = shortSide;
      break;
    case '4:5':
      rawW = shortSide;
      rawH = Math.round((shortSide * 5) / 4);
      break;
    case '21:9':
      rawH = shortSide;
      rawW = Math.round((shortSide * 21) / 9);
      break;
  }

  // Ensure even dimensions for H.264 / H.265 / FFmpeg compatibility
  const width = rawW % 2 === 0 ? rawW : rawW + 1;
  const height = rawH % 2 === 0 ? rawH : rawH + 1;
  return { width, height };
}

export function getEstimatedBitrateKbps(
  resolution: ExportResolution,
  quality: ExportQuality,
  fps: number
): number {
  const baseByRes: Record<ExportResolution, number> = {
    '4k': 35000,
    '2k': 18000,
    '1080p': 10000,
    '720p': 5000,
  };
  const multByQuality: Record<ExportQuality, number> = {
    ultra: 1.5,
    high: 1.0,
    balanced: 0.65,
    compact: 0.4,
  };
  const fpsFactor = fps >= 50 ? 1.3 : 1.0;
  return Math.round(baseByRes[resolution] * multByQuality[quality] * fpsFactor);
}

export function splitClipAtTime(
  clips: TimelineClip[],
  clipId: string,
  splitTime: number
): TimelineClip[] {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return clips;

  const minSegment = 0.25;
  if (
    splitTime <= target.startTime + minSegment ||
    splitTime >= target.startTime + target.duration - minSegment
  ) {
    return clips;
  }

  const leftDuration = Number((splitTime - target.startTime).toFixed(3));
  const rightDuration = Number((target.duration - leftDuration).toFixed(3));

  const leftClip: TimelineClip = {
    ...target,
    duration: leftDuration,
    outTransition: { ...target.outTransition, type: 'none' },
  };

  const rightClip: TimelineClip = {
    ...target,
    id: `${target.id}_part_${Math.random().toString(36).slice(2, 7)}`,
    name: `${target.name} (2)`,
    startTime: Number(splitTime.toFixed(3)),
    duration: rightDuration,
    trimStart: Number((target.trimStart + leftDuration * target.speed).toFixed(3)),
    inTransition: { ...target.inTransition, type: 'none' },
  };

  return clips.flatMap((c) => (c.id === clipId ? [leftClip, rightClip] : [c]));
}

export function snapTime(
  candidateTime: number,
  snapTargets: number[],
  thresholdSeconds = 0.18
): number {
  let closest = candidateTime;
  let minDelta = thresholdSeconds;

  for (const target of snapTargets) {
    const delta = Math.abs(candidateTime - target);
    if (delta <= minDelta) {
      minDelta = delta;
      closest = target;
    }
  }
  return Math.max(0, Number(closest.toFixed(3)));
}

export function getActiveClipsAtTime(
  clips: TimelineClip[],
  tracks: TimelineTrack[],
  time: number
): TimelineClip[] {
  const visibleTracks = new Set(tracks.filter((t) => !t.hidden).map((t) => t.id));
  const trackOrder = new Map<string, number>();
  tracks.forEach((t, idx) => trackOrder.set(t.id, idx));

  return clips
    .filter((c) => visibleTracks.has(c.trackId) && time >= c.startTime && time < c.startTime + c.duration)
    .sort((a, b) => (trackOrder.get(b.trackId) ?? 0) - (trackOrder.get(a.trackId) ?? 0));
}

export interface ActiveTransitionState {
  phase: 'in' | 'out' | 'none';
  progress: number; // 0..1
}

export function calculateTransitionState(
  clip: TimelineClip,
  time: number
): ActiveTransitionState {
  const localTime = time - clip.startTime;
  if (localTime < 0 || localTime > clip.duration) {
    return { phase: 'none', progress: 0 };
  }

  const inDur = clip.inTransition.type !== 'none'
    ? Math.min(clip.inTransition.duration, clip.duration * 0.48)
    : 0;
  const outDur = clip.outTransition.type !== 'none'
    ? Math.min(clip.outTransition.duration, clip.duration * 0.48)
    : 0;

  if (inDur > 0 && localTime <= inDur) {
    return { phase: 'in', progress: Math.max(0, Math.min(1, localTime / inDur)) };
  }

  if (outDur > 0 && localTime >= clip.duration - outDur) {
    const remaining = clip.duration - localTime;
    return { phase: 'out', progress: Math.max(0, Math.min(1, 1 - remaining / outDur)) };
  }

  return { phase: 'none', progress: 1 };
}

export const FILTER_PRESET_VALUES: Record<FilterPreset, Partial<ColorAdjustments>> = {
  none: { brightness: 100, contrast: 100, saturation: 100, hueRotate: 0, sepia: 0, vignette: 0, grain: 0 },
  cinematic_teal: { brightness: 96, contrast: 118, saturation: 112, hueRotate: -8, sepia: 8, vignette: 35, grain: 10 },
  noir_bw: { brightness: 102, contrast: 132, saturation: 0, hueRotate: 0, sepia: 0, vignette: 45, grain: 18 },
  vintage_warm: { brightness: 104, contrast: 106, saturation: 88, hueRotate: 6, sepia: 38, vignette: 30, grain: 22 },
  cyber_vivid: { brightness: 105, contrast: 124, saturation: 145, hueRotate: 14, sepia: 0, vignette: 20, grain: 5 },
  soft_pastel: { brightness: 110, contrast: 92, saturation: 85, hueRotate: -4, sepia: 10, vignette: 10, grain: 0 },
  vhs_retro: { brightness: 98, contrast: 115, saturation: 120, hueRotate: -12, sepia: 20, vignette: 40, grain: 35 },
  golden_hour: { brightness: 106, contrast: 108, saturation: 122, hueRotate: 8, sepia: 24, vignette: 25, grain: 8 },
};

export function getColorFilterCss(color: ColorAdjustments): string {
  const parts = [
    `brightness(${color.brightness}%)`,
    `contrast(${color.contrast}%)`,
    `saturate(${color.saturation}%)`,
  ];
  if (color.blur > 0) parts.push(`blur(${color.blur}px)`);
  if (color.hueRotate !== 0) parts.push(`hue-rotate(${color.hueRotate}deg)`);
  if (color.sepia > 0) parts.push(`sepia(${color.sepia}%)`);
  return parts.join(' ');
}

export const DEFAULT_COLOR_ADJUSTMENTS: ColorAdjustments = {
  preset: 'none',
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  hueRotate: 0,
  sepia: 0,
  vignette: 0,
  grain: 0,
};

export const DEFAULT_TRANSFORM: TransformProps = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
  blendMode: 'source-over',
};

export const DENOISE_PRESETS: Record<
  DenoisePreset,
  {
    labelAr: string;
    descriptionAr: string;
    denoiseStrength: number;
    windCutHz: number;
    hissCutHz: number;
    gateThresholdDb: number;
    voiceBoost: number;
    normalize: boolean;
  }
> = {
  wind: {
    labelAr: 'إزالة الهواء والرياح',
    descriptionAr: 'يقطع الترددات المنخفضة لضجيج الهواء والاهتزازات',
    denoiseStrength: 75,
    windCutHz: 170,
    hissCutHz: 11000,
    gateThresholdDb: -42,
    voiceBoost: 4,
    normalize: true,
  },
  voice: {
    labelAr: 'تنقية الصوت البشري',
    descriptionAr: 'يعزل الضجيج المحيطي ويبرز وضوح الكلام',
    denoiseStrength: 85,
    windCutHz: 120,
    hissCutHz: 9500,
    gateThresholdDb: -38,
    voiceBoost: 6,
    normalize: true,
  },
  hiss: {
    labelAr: 'إزالة الهسيس والطنين',
    descriptionAr: 'ينقي الهسيس الكهربائي ووشوشة المايكروفون',
    denoiseStrength: 80,
    windCutHz: 90,
    hissCutHz: 7500,
    gateThresholdDb: -45,
    voiceBoost: 3,
    normalize: true,
  },
  studio: {
    labelAr: 'وضع الاستوديو الكامل',
    descriptionAr: 'عزل شامل للضوضاء مع موازنة احترافية للنقاء التام',
    denoiseStrength: 95,
    windCutHz: 140,
    hissCutHz: 10500,
    gateThresholdDb: -36,
    voiceBoost: 7,
    normalize: true,
  },
  custom: {
    labelAr: 'تخصيص يدوي',
    descriptionAr: 'تحكم كامل بجميع ترددات العزل والتنقية',
    denoiseStrength: 70,
    windCutHz: 120,
    hissCutHz: 12000,
    gateThresholdDb: -40,
    voiceBoost: 3,
    normalize: true,
  },
};

export const DEFAULT_AUDIO_CLEANUP: AudioCleanupProps = {
  volume: 1,
  muted: false,
  fadeIn: 0,
  fadeOut: 0,
  denoiseEnabled: false,
  denoisePreset: 'studio',
  denoiseStrength: 85,
  windCutHz: 140,
  hissCutHz: 10500,
  gateThresholdDb: -38,
  voiceBoost: 5,
  normalize: true,
};
