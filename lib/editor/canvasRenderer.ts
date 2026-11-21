import {
  calculateTransitionState,
  getActiveClipsAtTime,
  getColorFilterCss,
} from './timelineMath';
import { applyEasing, renderTransitionFrame } from './transitions';
import type {
  MediaAsset,
  ShapeProps,
  TextProps,
  TimelineClip,
  TimelineTrack,
} from './types';

export interface MediaElementCache {
  videos: Map<string, HTMLVideoElement>;
  images: Map<string, HTMLImageElement>;
}

interface RenderBuffers {
  fromCanvas: HTMLCanvasElement;
  toCanvas: HTMLCanvasElement;
  clipCanvas: HTMLCanvasElement;
}

let cachedBuffers: RenderBuffers | null = null;

function ensureBuffers(width: number, height: number): RenderBuffers {
  if (!cachedBuffers) {
    cachedBuffers = {
      fromCanvas: document.createElement('canvas'),
      toCanvas: document.createElement('canvas'),
      clipCanvas: document.createElement('canvas'),
    };
  }
  for (const c of [cachedBuffers.fromCanvas, cachedBuffers.toCanvas, cachedBuffers.clipCanvas]) {
    if (c.width !== width || c.height !== height) {
      c.width = width;
      c.height = height;
    }
  }
  return cachedBuffers;
}

function drawMediaFit(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number
) {
  if (!srcW || !srcH) return;
  const srcRatio = srcW / srcH;
  const dstRatio = targetW / targetH;
  let drawW = targetW;
  let drawH = targetH;
  if (srcRatio > dstRatio) {
    drawH = targetH;
    drawW = targetH * srcRatio;
  } else {
    drawW = targetW;
    drawH = targetW / srcRatio;
  }
  const dx = (targetW - drawW) / 2;
  const dy = (targetH - drawH) / 2;
  ctx.drawImage(source, dx, dy, drawW, drawH);
}

function drawVignetteAndGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  vignette: number,
  grain: number,
  time: number
) {
  if (vignette > 0) {
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.25,
      width / 2,
      height / 2,
      Math.hypot(width, height) * 0.55
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.92, (vignette / 100) * 0.88)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
  if (grain > 0) {
    const count = Math.round((grain / 100) * 280);
    const seedBase = Math.floor(time * 24);
    ctx.save();
    for (let i = 0; i < count; i++) {
      const rx = Math.abs(Math.sin((i + 1) * 12.9898 + seedBase * 78.233) * 43758.5453) % 1;
      const ry = Math.abs(Math.sin((i + 1) * 93.989 + seedBase * 19.13) * 23421.631) % 1;
      const alpha = (grain / 100) * 0.16;
      ctx.fillStyle = i % 2 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(rx * width, ry * height, 2, 2);
    }
    ctx.restore();
  }
}

function drawShapeLayer(
  ctx: CanvasRenderingContext2D,
  shape: ShapeProps,
  width: number,
  height: number,
  localTime: number,
  duration: number
) {
  const animDur = Math.min(0.65, duration * 0.4);
  const rawP = animDur > 0 ? Math.min(1, localTime / animDur) : 1;
  let animScale = 1;
  let animOffsetX = 0;
  let animAlpha = 1;

  if (shape.animation === 'scale_pop') {
    animScale = Math.max(0.05, applyEasing(rawP, 'easeOutBack'));
    animAlpha = Math.min(1, rawP * 2);
  } else if (shape.animation === 'slide_in') {
    const p = applyEasing(rawP, 'easeInOut');
    animOffsetX = (1 - p) * width * 0.25;
    animAlpha = p;
  } else if (shape.animation === 'draw_reveal') {
    animAlpha = applyEasing(rawP, 'easeInOut');
  } else if (shape.animation === 'pulse_glow') {
    animScale = 1 + Math.sin(localTime * 4) * 0.03;
  }

  const boxW = (shape.width / 100) * width;
  const boxH = (shape.height / 100) * height;

  ctx.save();
  ctx.globalAlpha *= animAlpha;
  ctx.translate(animOffsetX, 0);
  ctx.scale(animScale, animScale);

  if (shape.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = Math.max(8, width * 0.015);
    ctx.shadowOffsetY = Math.max(4, height * 0.008);
  }

  let fillStyle: string | CanvasGradient = shape.fillColor;
  if (shape.useGradient) {
    const grad = ctx.createLinearGradient(-boxW / 2, -boxH / 2, boxW / 2, boxH / 2);
    grad.addColorStop(0, shape.fillColor);
    grad.addColorStop(1, shape.fillSecondary);
    fillStyle = grad;
  }

  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = shape.strokeColor;
  ctx.lineWidth = (shape.strokeWidth / 1080) * height;

  const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  };

  switch (shape.shapeType) {
    case 'rect': {
      ctx.beginPath();
      ctx.rect(-boxW / 2, -boxH / 2, boxW, boxH);
      ctx.fill();
      if (shape.strokeWidth > 0) ctx.stroke();
      break;
    }
    case 'rounded':
    case 'badge_frame': {
      const rad = shape.shapeType === 'badge_frame' ? boxH / 2 : (shape.cornerRadius / 1080) * height;
      drawRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, rad);
      if (shape.shapeType !== 'badge_frame') {
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(10, 13, 18, 0.55)';
        ctx.fill();
      }
      if (shape.strokeWidth > 0 || shape.shapeType === 'badge_frame') {
        ctx.lineWidth = Math.max(ctx.lineWidth, (4 / 1080) * height);
        ctx.stroke();
      }
      break;
    }
    case 'circle':
    case 'ring': {
      const r = Math.min(boxW, boxH) / 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      if (shape.shapeType === 'circle') {
        ctx.fill();
      }
      if (shape.strokeWidth > 0 || shape.shapeType === 'ring') {
        ctx.lineWidth = Math.max(ctx.lineWidth, (8 / 1080) * height);
        ctx.stroke();
      }
      break;
    }
    case 'triangle': {
      ctx.beginPath();
      ctx.moveTo(0, -boxH / 2);
      ctx.lineTo(boxW / 2, boxH / 2);
      ctx.lineTo(-boxW / 2, boxH / 2);
      ctx.closePath();
      ctx.fill();
      if (shape.strokeWidth > 0) ctx.stroke();
      break;
    }
    case 'star': {
      const outer = Math.min(boxW, boxH) / 2;
      const inner = outer * 0.45;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? outer : inner;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      if (shape.strokeWidth > 0) ctx.stroke();
      break;
    }
    case 'arrow': {
      const shaftH = boxH * 0.36;
      const headW = boxW * 0.38;
      ctx.beginPath();
      ctx.moveTo(-boxW / 2, -shaftH / 2);
      ctx.lineTo(boxW / 2 - headW, -shaftH / 2);
      ctx.lineTo(boxW / 2 - headW, -boxH / 2);
      ctx.lineTo(boxW / 2, 0);
      ctx.lineTo(boxW / 2 - headW, boxH / 2);
      ctx.lineTo(boxW / 2 - headW, shaftH / 2);
      ctx.lineTo(-boxW / 2, shaftH / 2);
      ctx.closePath();
      ctx.fill();
      if (shape.strokeWidth > 0) ctx.stroke();
      break;
    }
    case 'lower_third': {
      drawRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, (12 / 1080) * height);
      ctx.fill();
      ctx.fillStyle = shape.strokeColor || '#F59E0B';
      ctx.fillRect(boxW / 2 - (10 / 1920) * width, -boxH / 2, (10 / 1920) * width, boxH);
      break;
    }
    case 'callout': {
      const r = (16 / 1080) * height;
      drawRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH * 0.82, r);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-boxW * 0.1, boxH * 0.32);
      ctx.lineTo(0, boxH * 0.5);
      ctx.lineTo(boxW * 0.1, boxH * 0.32);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  if (shape.labelText) {
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#FFFFFF';
    const fs = Math.max(14, Math.round(boxH * 0.38));
    ctx.font = `700 ${fs}px Cairo, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shape.labelText, 0, 0);
  }

  ctx.restore();
}

function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  text: TextProps,
  width: number,
  height: number,
  localTime: number,
  duration: number
) {
  const animDur = Math.min(0.7, duration * 0.4);
  const rawP = animDur > 0 ? Math.min(1, localTime / animDur) : 1;
  let visibleText = text.content;
  let offsetY = 0;
  let offsetX = 0;
  let scale = 1;
  let alpha = 1;

  switch (text.animation) {
    case 'fade_rise': {
      const p = applyEasing(rawP, 'easeInOut');
      offsetY = (1 - p) * (height * 0.05);
      alpha = p;
      break;
    }
    case 'typewriter': {
      const count = Math.max(1, Math.floor(text.content.length * Math.min(1, localTime / Math.max(0.6, animDur * 1.4))));
      visibleText = text.content.slice(0, count);
      break;
    }
    case 'pop_bounce': {
      scale = Math.max(0.1, applyEasing(rawP, 'easeOutBack'));
      alpha = Math.min(1, rawP * 2);
      break;
    }
    case 'slide_kinetic': {
      const p = applyEasing(rawP, 'easeInOutQuint');
      offsetX = (1 - p) * (width * 0.2);
      alpha = p;
      break;
    }
    case 'glitch_reveal': {
      if (rawP < 0.85) {
        offsetX = Math.sin(localTime * 60) * 8;
      }
      alpha = Math.min(1, rawP * 1.6);
      break;
    }
    case 'neon_pulse': {
      alpha = 0.85 + Math.sin(localTime * 5) * 0.15;
      break;
    }
  }

  const fontSizePx = Math.round((text.fontSize / 1080) * height);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.font = `${text.bold ? 700 : 500} ${fontSizePx}px ${text.fontFamily}, Cairo, sans-serif`;
  ctx.textAlign = text.align;
  ctx.textBaseline = 'middle';

  const lines = visibleText.split('\n');
  const lineHeight = fontSizePx * 1.32;
  const totalH = lines.length * lineHeight;

  if (text.bgOpacity > 0) {
    const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width), 40);
    const padX = fontSizePx * 0.55;
    const padY = fontSizePx * 0.3;
    const boxW = maxLineW + padX * 2;
    const boxH = totalH + padY * 2;
    let boxX = -boxW / 2;
    if (text.align === 'left') boxX = -padX;
    if (text.align === 'right') boxX = -boxW + padX;
    ctx.save();
    ctx.globalAlpha *= text.bgOpacity;
    ctx.fillStyle = text.bgColor;
    ctx.beginPath();
    const r = Math.min(14, boxH * 0.25);
    ctx.roundRect(boxX, -boxH / 2, boxW, boxH, r);
    ctx.fill();
    ctx.restore();
  }

  if (text.shadow || text.animation === 'neon_pulse') {
    ctx.shadowColor = text.animation === 'neon_pulse' ? text.color : 'rgba(0,0,0,0.72)';
    ctx.shadowBlur = text.animation === 'neon_pulse' ? fontSizePx * 0.45 : fontSizePx * 0.2;
    ctx.shadowOffsetY = text.animation === 'neon_pulse' ? 0 : fontSizePx * 0.06;
  }

  lines.forEach((line, idx) => {
    const y = (idx - (lines.length - 1) / 2) * lineHeight;
    if (text.strokeWidth > 0) {
      ctx.strokeStyle = text.strokeColor;
      ctx.lineWidth = (text.strokeWidth / 1080) * height * 2;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, 0, y);
    }
    ctx.fillStyle = text.color;
    ctx.fillText(line, 0, y);
  });

  ctx.restore();
}

function renderSingleVisualClip(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  assets: Map<string, MediaAsset>,
  cache: MediaElementCache,
  width: number,
  height: number,
  time: number
) {
  const localTime = Math.max(0, time - clip.startTime);

  ctx.save();
  ctx.globalAlpha = clip.transform.opacity;
  ctx.globalCompositeOperation = clip.transform.blendMode || 'source-over';

  const cx = width / 2 + (clip.transform.x / 100) * width;
  const cy = height / 2 + (clip.transform.y / 100) * height;
  ctx.translate(cx, cy);
  ctx.rotate((clip.transform.rotation * Math.PI) / 180);
  ctx.scale(clip.transform.scale, clip.transform.scale);

  if (clip.kind === 'text' && clip.text) {
    drawTextLayer(ctx, clip.text, width, height, localTime, clip.duration);
    ctx.restore();
    return;
  }

  if (clip.kind === 'shape' && clip.shape) {
    drawShapeLayer(ctx, clip.shape, width, height, localTime, clip.duration);
    ctx.restore();
    return;
  }

  const asset = clip.assetId ? assets.get(clip.assetId) : undefined;
  ctx.translate(-width / 2, -height / 2);

  const filterStr = getColorFilterCss(clip.color);
  if (filterStr) ctx.filter = filterStr;

  if (asset?.kind === 'video') {
    const vid = cache.videos.get(asset.id);
    if (vid && vid.readyState >= 2) {
      drawMediaFit(ctx, vid, vid.videoWidth || asset.width, vid.videoHeight || asset.height, width, height);
    } else {
      ctx.fillStyle = '#141923';
      ctx.fillRect(0, 0, width, height);
    }
  } else if (asset?.kind === 'image') {
    const img = cache.images.get(asset.id);
    if (img && img.complete && img.naturalWidth > 0) {
      drawMediaFit(ctx, img, img.naturalWidth, img.naturalHeight, width, height);
    } else {
      ctx.fillStyle = '#141923';
      ctx.fillRect(0, 0, width, height);
    }
  }

  ctx.filter = 'none';
  drawVignetteAndGrain(ctx, width, height, clip.color.vignette, clip.color.grain, time);
  ctx.restore();
}

export function renderCompositionFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  clips: TimelineClip[],
  tracks: TimelineTrack[],
  assets: Map<string, MediaAsset>,
  cache: MediaElementCache,
  time: number
) {
  ctx.save();
  ctx.fillStyle = '#07090D';
  ctx.fillRect(0, 0, width, height);

  const activeClips = getActiveClipsAtTime(clips, tracks, time).filter((c) => c.kind !== 'audio');
  if (activeClips.length === 0) {
    ctx.restore();
    return;
  }

  const buffers = ensureBuffers(width, height);

  for (const clip of activeClips) {
    const tState = calculateTransitionState(clip, time);
    if (tState.phase === 'none' || clip.kind === 'text' || clip.kind === 'shape') {
      renderSingleVisualClip(ctx, clip, assets, cache, width, height, time);
      continue;
    }

    const fromCtx = buffers.fromCanvas.getContext('2d');
    const toCtx = buffers.toCanvas.getContext('2d');
    if (!fromCtx || !toCtx) {
      renderSingleVisualClip(ctx, clip, assets, cache, width, height, time);
      continue;
    }

    if (tState.phase === 'in') {
      // Outgoing is current canvas state below this clip
      fromCtx.clearRect(0, 0, width, height);
      fromCtx.drawImage(ctx.canvas, 0, 0, width, height);

      toCtx.clearRect(0, 0, width, height);
      renderSingleVisualClip(toCtx, clip, assets, cache, width, height, time);

      renderTransitionFrame(
        ctx,
        width,
        height,
        buffers.fromCanvas,
        buffers.toCanvas,
        clip.inTransition.type,
        tState.progress,
        clip.inTransition.easing
      );
    } else if (tState.phase === 'out') {
      fromCtx.clearRect(0, 0, width, height);
      renderSingleVisualClip(fromCtx, clip, assets, cache, width, height, time);

      // Outgoing transitions to dark studio frame (or next clip if overlapping)
      toCtx.clearRect(0, 0, width, height);
      toCtx.fillStyle = '#07090D';
      toCtx.fillRect(0, 0, width, height);

      renderTransitionFrame(
        ctx,
        width,
        height,
        buffers.fromCanvas,
        buffers.toCanvas,
        clip.outTransition.type,
        tState.progress,
        clip.outTransition.easing
      );
    }
  }

  ctx.restore();
}
