export type MediaKind = 'video' | 'image' | 'audio';

export interface MediaAsset {
  id: string;
  name: string;
  kind: MediaKind;
  src: string;
  originalExt: string;
  mimeType: string;
  duration: number; // seconds (default 5 for images)
  width: number;
  height: number;
  thumbnail?: string;
  waveform?: number[];
  transcodedFrom?: string;
  rawFile?: File;
}

export type TrackType = 'video' | 'overlay' | 'text' | 'shape' | 'audio';

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
}

export type TransitionCategory = 'cinematic' | 'motion' | 'distortion' | 'geometric';

export type TransitionType =
  | 'none'
  | 'crossfade'
  | 'dip_black'
  | 'dip_white'
  | 'flash_burn'
  | 'light_leak'
  | 'anamorphic_flare'
  | 'film_burn'
  | 'slide_left'
  | 'slide_right'
  | 'slide_up'
  | 'slide_down'
  | 'push_left'
  | 'push_right'
  | 'whip_pan'
  | 'zoom_in_cross'
  | 'zoom_out_cross'
  | 'spin_twist'
  | 'elastic_bounce'
  | 'glitch_rgb'
  | 'chromatic_shake'
  | 'pixelate_dissolve'
  | 'ripple_wave'
  | 'vortex_swirl'
  | 'kaleidoscope_flip'
  | 'iris_circle'
  | 'diamond_wipe'
  | 'blinds_horizontal'
  | 'blinds_vertical'
  | 'checkerboard'
  | 'starburst'
  | 'barn_doors'
  | 'diagonal_slice'
  | 'clock_radial';

export type EasingType = 'linear' | 'easeInOut' | 'easeOutBack' | 'easeInOutQuint' | 'elastic';

export interface ClipTransition {
  type: TransitionType;
  duration: number; // seconds
  easing: EasingType;
}

export type FilterPreset =
  | 'none'
  | 'cinematic_teal'
  | 'noir_bw'
  | 'vintage_warm'
  | 'cyber_vivid'
  | 'soft_pastel'
  | 'vhs_retro'
  | 'golden_hour';

export interface ColorAdjustments {
  preset: FilterPreset;
  brightness: number; // 0 to 200 (100 default)
  contrast: number; // 0 to 200 (100 default)
  saturation: number; // 0 to 200 (100 default)
  blur: number; // 0 to 20 px
  hueRotate: number; // -180 to 180 deg
  sepia: number; // 0 to 100
  vignette: number; // 0 to 100
  grain: number; // 0 to 100
}

export interface TransformProps {
  x: number; // -50 to 50 % offset from center
  y: number; // -50 to 50 % offset from center
  scale: number; // 0.1 to 3.0
  rotation: number; // -180 to 180 deg
  opacity: number; // 0 to 1
  blendMode: GlobalCompositeOperation;
}

export type DenoisePreset = 'wind' | 'voice' | 'hiss' | 'studio' | 'custom';

export interface AudioCleanupProps {
  volume: number; // 0 to 2 (1 default)
  muted: boolean;
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  denoiseEnabled: boolean;
  denoisePreset: DenoisePreset;
  denoiseStrength: number; // 0 to 100
  windCutHz: number; // 40 to 300 Hz high-pass
  hissCutHz: number; // 4000 to 18000 Hz low-pass
  gateThresholdDb: number; // -80 to -15 dB
  voiceBoost: number; // 0 to 12 dB
  normalize: boolean;
}

export type TextAnimationType =
  | 'none'
  | 'fade_rise'
  | 'typewriter'
  | 'pop_bounce'
  | 'slide_kinetic'
  | 'glitch_reveal'
  | 'neon_pulse';

export interface TextProps {
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  bgColor: string;
  bgOpacity: number;
  align: 'right' | 'center' | 'left';
  bold: boolean;
  shadow: boolean;
  animation: TextAnimationType;
  letterSpacing: number;
}

export type ShapeKind =
  | 'rect'
  | 'rounded'
  | 'circle'
  | 'ring'
  | 'triangle'
  | 'star'
  | 'arrow'
  | 'lower_third'
  | 'callout'
  | 'badge_frame';

export type ShapeAnimationType = 'none' | 'scale_pop' | 'slide_in' | 'draw_reveal' | 'pulse_glow';

export interface ShapeProps {
  shapeType: ShapeKind;
  fillColor: string;
  fillSecondary: string;
  useGradient: boolean;
  strokeColor: string;
  strokeWidth: number;
  cornerRadius: number;
  width: number; // % of canvas width (5..100)
  height: number; // % of canvas height (5..100)
  animation: ShapeAnimationType;
  shadow: boolean;
  labelText?: string;
}

export type ClipKind = 'video' | 'image' | 'audio' | 'text' | 'shape';

export interface TimelineClip {
  id: string;
  trackId: string;
  kind: ClipKind;
  name: string;
  assetId?: string;
  startTime: number; // timeline start in seconds
  duration: number; // clip duration on timeline in seconds
  trimStart: number; // source media offset in seconds
  speed: number; // 0.25 to 4.0
  inTransition: ClipTransition;
  outTransition: ClipTransition;
  color: ColorAdjustments;
  transform: TransformProps;
  audio: AudioCleanupProps;
  text?: TextProps;
  shape?: ShapeProps;
  accentColor: string;
}

export type ExportResolution = '4k' | '2k' | '1080p' | '720p';
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '21:9';
export type ExportFormat = 'mp4' | 'webm' | 'mov' | 'mkv' | 'avi' | 'gif';
export type ExportCodec = 'h264' | 'h265' | 'vp9' | 'prores';
export type ExportQuality = 'ultra' | 'high' | 'balanced' | 'compact';

export interface ExportSettings {
  resolution: ExportResolution;
  aspectRatio: AspectRatio;
  fps: 24 | 30 | 50 | 60;
  format: ExportFormat;
  codec: ExportCodec;
  quality: ExportQuality;
  includeDenoise: boolean;
}

export type AudioExtractFormat = 'mp3' | 'wav' | 'aac' | 'flac' | 'ogg';

export interface AudioExtractSettings {
  format: AudioExtractFormat;
  bitrate: '320k' | '256k' | '192k' | '128k';
  sampleRate: 48000 | 44100;
  denoiseEnabled: boolean;
  denoisePreset: DenoisePreset;
  denoiseStrength: number;
  windCutHz: number;
  hissCutHz: number;
  voiceBoost: number;
  normalize: boolean;
}
