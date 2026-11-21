import { encodePcmWav } from '../audio/wavEncoder';
import {
  DEFAULT_AUDIO_CLEANUP,
  DEFAULT_COLOR_ADJUSTMENTS,
  DEFAULT_TRANSFORM,
} from './timelineMath';
import type { MediaAsset, TimelineClip, TimelineTrack } from './types';

function createSceneDataUrl(
  title: string,
  subtitle: string,
  palette: [string, string, string],
  motif: 'dunes' | 'skyline' | 'coast'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const bg = ctx.createLinearGradient(0, 0, 1280, 720);
  bg.addColorStop(0, palette[0]);
  bg.addColorStop(0.55, palette[1]);
  bg.addColorStop(1, palette[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1280, 720);

  // Atmospheric sun/glow orb
  const orb = ctx.createRadialGradient(920, 220, 20, 920, 220, 320);
  orb.addColorStop(0, 'rgba(255, 236, 179, 0.85)');
  orb.addColorStop(0.45, 'rgba(245, 158, 11, 0.25)');
  orb.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = orb;
  ctx.fillRect(0, 0, 1280, 720);

  if (motif === 'dunes') {
    ctx.fillStyle = 'rgba(18, 12, 8, 0.52)';
    ctx.beginPath();
    ctx.moveTo(0, 480);
    ctx.quadraticCurveTo(360, 350, 720, 460);
    ctx.quadraticCurveTo(1020, 540, 1280, 410);
    ctx.lineTo(1280, 720);
    ctx.lineTo(0, 720);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(10, 8, 6, 0.78)';
    ctx.beginPath();
    ctx.moveTo(0, 560);
    ctx.quadraticCurveTo(420, 470, 840, 580);
    ctx.quadraticCurveTo(1100, 640, 1280, 530);
    ctx.lineTo(1280, 720);
    ctx.lineTo(0, 720);
    ctx.closePath();
    ctx.fill();
  } else if (motif === 'skyline') {
    const heights = [220, 340, 190, 410, 280, 360, 440, 260, 310, 390, 230, 300];
    heights.forEach((h, i) => {
      const bw = 96;
      const bx = i * 108;
      const by = 720 - h;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(10, 15, 28, 0.85)' : 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(bx, by, bw, h);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
      for (let wy = by + 20; wy < 690; wy += 26) {
        for (let wx = bx + 14; wx < bx + bw - 14; wx += 22) {
          if ((wx + wy + i) % 3 !== 0) {
            ctx.fillRect(wx, wy, 10, 14);
          }
        }
      }
    });
  } else {
    for (let w = 0; w < 5; w++) {
      ctx.fillStyle = `rgba(6, 24, 38, ${0.22 + w * 0.14})`;
      ctx.beginPath();
      const baseY = 420 + w * 55;
      ctx.moveTo(0, baseY);
      for (let x = 0; x <= 1280; x += 64) {
        const y = baseY + Math.sin(x * 0.008 + w * 1.4) * 22;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(1280, 720);
      ctx.lineTo(0, 720);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Subtle editorial caption corner
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '600 22px Cairo, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(title, 1220, 650);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '400 16px JetBrains Mono, monospace';
  ctx.fillText(subtitle, 1220, 680);

  return canvas.toDataURL('image/jpeg', 0.92);
}

function createDemoAudioWavUrl(): { url: string; waveform: number[]; duration: number } {
  const sampleRate = 22050;
  const duration = 12;
  const totalSamples = sampleRate * duration;
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  const notes = [220, 277.18, 329.63, 440, 293.66, 369.99];
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.floor(t / 2) % notes.length;
    const freq = notes[noteIdx];
    const beatEnv = Math.exp(-((t % 1) * 2.4));
    const pad =
      Math.sin(2 * Math.PI * freq * t) * 0.22 * beatEnv +
      Math.sin(2 * Math.PI * (freq * 0.5) * t) * 0.14;
    // Slight low-frequency wind rumble so noise removal demo makes an audible difference
    const wind = Math.sin(2 * Math.PI * 68 * t) * 0.045 + (Math.sin(i * 12.9898) * 0.015);
    const val = Math.max(-0.9, Math.min(0.9, pad + wind));
    left[i] = val;
    right[i] = val * 0.96;
  }

  const wavBytes = encodePcmWav([left, right], sampleRate, 16);
  const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);

  const peaks: number[] = [];
  const bins = 64;
  const step = Math.floor(totalSamples / bins);
  for (let b = 0; b < bins; b++) {
    let maxAmp = 0;
    for (let j = 0; j < step; j += 12) {
      const sample = Math.abs(left[b * step + j] ?? 0);
      if (sample > maxAmp) maxAmp = sample;
    }
    peaks.push(Math.min(1, Math.max(0.15, maxAmp * 1.9)));
  }

  return { url, waveform: peaks, duration };
}

export const INITIAL_TRACKS: TimelineTrack[] = [
  { id: 'track-t1', name: 'النصوص والعناوين T1', type: 'text', muted: false, hidden: false, locked: false },
  { id: 'track-s1', name: 'الأشكال الاحترافية S1', type: 'shape', muted: false, hidden: false, locked: false },
  { id: 'track-v2', name: 'تراكب وصور V2', type: 'overlay', muted: false, hidden: false, locked: false },
  { id: 'track-v1', name: 'الفيديو الرئيسي V1', type: 'video', muted: false, hidden: false, locked: false },
  { id: 'track-a1', name: 'الصوت والموسيقى A1', type: 'audio', muted: false, hidden: false, locked: false },
];

export function buildDemoProject(): { assets: MediaAsset[]; clips: TimelineClip[] } {
  const img1 = createSceneDataUrl('كثبان الغروب الذهبية', 'SCENE 01 · 4K MASTER', ['#1E1008', '#9A3412', '#F59E0B'], 'dunes');
  const img2 = createSceneDataUrl('أفق المدينة الليلي', 'SCENE 02 · 4K MASTER', ['#090D16', '#0F172A', '#0284C7'], 'skyline');
  const img3 = createSceneDataUrl('أمواج الساحل الهادئ', 'SCENE 03 · 4K MASTER', ['#061A26', '#0E7490', '#22D3EE'], 'coast');
  const demoAudio = createDemoAudioWavUrl();

  const assets: MediaAsset[] = [
    {
      id: 'demo-scene-1',
      name: 'كثبان_الغروب.jpg',
      kind: 'image',
      src: img1,
      originalExt: 'jpg',
      mimeType: 'image/jpeg',
      duration: 4.5,
      width: 1280,
      height: 720,
      thumbnail: img1,
    },
    {
      id: 'demo-scene-2',
      name: 'أفق_المدينة_ليلاً.jpg',
      kind: 'image',
      src: img2,
      originalExt: 'jpg',
      mimeType: 'image/jpeg',
      duration: 4.5,
      width: 1280,
      height: 720,
      thumbnail: img2,
    },
    {
      id: 'demo-scene-3',
      name: 'أمواج_المحيط.jpg',
      kind: 'image',
      src: img3,
      originalExt: 'jpg',
      mimeType: 'image/jpeg',
      duration: 4.5,
      width: 1280,
      height: 720,
      thumbnail: img3,
    },
    {
      id: 'demo-audio-1',
      name: 'موسيقى_افتتاحية_مع_هواء.wav',
      kind: 'audio',
      src: demoAudio.url,
      originalExt: 'wav',
      mimeType: 'audio/wav',
      duration: demoAudio.duration,
      width: 0,
      height: 0,
      waveform: demoAudio.waveform,
    },
  ];

  const clips: TimelineClip[] = [
    {
      id: 'clip-v-1',
      trackId: 'track-v1',
      kind: 'image',
      name: 'كثبان الغروب',
      assetId: 'demo-scene-1',
      startTime: 0,
      duration: 4.2,
      trimStart: 0,
      speed: 1,
      inTransition: { type: 'none', duration: 0.8, easing: 'easeInOut' },
      outTransition: { type: 'none', duration: 0.7, easing: 'easeInOut' },
      color: { ...DEFAULT_COLOR_ADJUSTMENTS, preset: 'golden_hour', contrast: 108, saturation: 118, vignette: 20 },
      transform: { ...DEFAULT_TRANSFORM },
      audio: { ...DEFAULT_AUDIO_CLEANUP },
      accentColor: '#F59E0B',
    },
    {
      id: 'clip-v-2',
      trackId: 'track-v1',
      kind: 'image',
      name: 'أفق المدينة',
      assetId: 'demo-scene-2',
      startTime: 4.2,
      duration: 4.2,
      trimStart: 0,
      speed: 1,
      inTransition: { type: 'glitch_rgb', duration: 0.75, easing: 'easeInOut' },
      outTransition: { type: 'none', duration: 0.7, easing: 'easeInOut' },
      color: { ...DEFAULT_COLOR_ADJUSTMENTS, preset: 'cinematic_teal', contrast: 115, saturation: 112, vignette: 28 },
      transform: { ...DEFAULT_TRANSFORM },
      audio: { ...DEFAULT_AUDIO_CLEANUP },
      accentColor: '#0EA5E9',
    },
    {
      id: 'clip-v-3',
      trackId: 'track-v1',
      kind: 'image',
      name: 'أمواج الساحل',
      assetId: 'demo-scene-3',
      startTime: 8.4,
      duration: 4.2,
      trimStart: 0,
      speed: 1,
      inTransition: { type: 'light_leak', duration: 1.0, easing: 'easeInOut' },
      outTransition: { type: 'dip_black', duration: 0.8, easing: 'easeInOut' },
      color: { ...DEFAULT_COLOR_ADJUSTMENTS },
      transform: { ...DEFAULT_TRANSFORM },
      audio: { ...DEFAULT_AUDIO_CLEANUP },
      accentColor: '#10B981',
    },
    {
      id: 'clip-s-1',
      trackId: 'track-s1',
      kind: 'shape',
      name: 'شريط عنوان سفلي',
      startTime: 0.6,
      duration: 4.5,
      trimStart: 0,
      speed: 1,
      inTransition: { type: 'none', duration: 0.5, easing: 'easeInOut' },
      outTransition: { type: 'none', duration: 0.5, easing: 'easeInOut' },
      color: { ...DEFAULT_COLOR_ADJUSTMENTS },
      transform: { ...DEFAULT_TRANSFORM, x: 0, y: 28, opacity: 0.92 },
      audio: { ...DEFAULT_AUDIO_CLEANUP },
      shape: {
        shapeType: 'lower_third',
        fillColor: '#0F172A',
        fillSecondary: '#1E293B',
        useGradient: true,
        strokeColor: '#F59E0B',
        strokeWidth: 3,
        cornerRadius: 12,
        width: 54,
        height: 14,
        animation: 'slide_in',
        shadow: true,
      },
      accentColor: '#8B5CF6',
    },
    {
      id: 'clip-t-1',
      trackId: 'track-t1',
      kind: 'text',
      name: 'عنوان افتتاحي',
      startTime: 0.8,
      duration: 4.1,
      trimStart: 0,
      speed: 1,
      inTransition: { type: 'none', duration: 0.5, easing: 'easeInOut' },
      outTransition: { type: 'none', duration: 0.5, easing: 'easeInOut' },
      color: { ...DEFAULT_COLOR_ADJUSTMENTS },
      transform: { ...DEFAULT_TRANSFORM, x: 0, y: 28 },
      audio: { ...DEFAULT_AUDIO_CLEANUP },
      text: {
        content: 'إنتاج سينمائي متكامل بدقة 4K',
        fontFamily: 'Cairo',
        fontSize: 44,
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 0,
        bgColor: '#000000',
        bgOpacity: 0,
        align: 'center',
        bold: true,
        shadow: true,
        animation: 'fade_rise',
        letterSpacing: 0,
      },
      accentColor: '#EC4899',
    },
    {
      id: 'clip-a-1',
      trackId: 'track-a1',
      kind: 'audio',
      name: 'موسيقى افتتاحية (تجربة إزالة الضوضاء)',
      assetId: 'demo-audio-1',
      startTime: 0,
      duration: 12.0,
      trimStart: 0,
      speed: 1,
      inTransition: { type: 'none', duration: 0.5, easing: 'easeInOut' },
      outTransition: { type: 'none', duration: 0.5, easing: 'easeInOut' },
      color: { ...DEFAULT_COLOR_ADJUSTMENTS },
      transform: { ...DEFAULT_TRANSFORM },
      audio: {
        ...DEFAULT_AUDIO_CLEANUP,
        denoiseEnabled: true,
        denoisePreset: 'wind',
        windCutHz: 160,
        denoiseStrength: 85,
      },
      accentColor: '#06B6D4',
    },
  ];

  return { assets, clips };
}
