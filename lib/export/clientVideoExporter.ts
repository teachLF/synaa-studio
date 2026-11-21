import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmArrayBufferTarget } from 'webm-muxer';
import { renderProjectMixdownChannels } from '@/lib/audio/noiseSuppressor';
import { renderCompositionFrame, type MediaElementCache } from '@/lib/editor/canvasRenderer';
import { getEstimatedBitrateKbps, getExportDimensions } from '@/lib/editor/timelineMath';
import type { ExportSettings, MediaAsset, TimelineClip, TimelineTrack } from '@/lib/editor/types';

export interface ClientExportResult {
  blob: Blob;
  actualFormat: string;
  width: number;
  height: number;
  engineLabel: string;
}

async function seekVideoElementsForTime(
  clips: TimelineClip[],
  mediaCache: MediaElementCache,
  t: number
): Promise<void> {
  const promises: Array<Promise<void>> = [];
  for (const clip of clips) {
    if (
      clip.kind === 'video' &&
      clip.assetId &&
      t >= clip.startTime &&
      t <= clip.startTime + clip.duration
    ) {
      const vid = mediaCache.videos.get(clip.assetId);
      if (!vid || vid.readyState < 1) continue;
      const speed = clip.speed || 1;
      const mediaDuration = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 0;
      // Clamp (never wrap with %) so a clip longer than its source freezes on the
      // last frame instead of restarting the video from the beginning.
      const rawTarget = clip.trimStart + (t - clip.startTime) * speed;
      const targetVidTime = mediaDuration > 0
        ? Math.max(0, Math.min(mediaDuration - 0.03, rawTarget))
        : Math.max(0, rawTarget);
      if (Math.abs(vid.currentTime - targetVidTime) > 0.03) {
        promises.push(
          new Promise<void>((resolve) => {
            let settled = false;
            const done = () => {
              if (settled) return;
              settled = true;
              vid.removeEventListener('seeked', done);
              resolve();
            };
            vid.addEventListener('seeked', done, { once: true });
            try {
              vid.currentTime = targetVidTime;
            } catch {
              done();
            }
            setTimeout(done, 90);
          })
        );
      }
    }
  }
  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

async function pickSupportedVideoCodec(
  target: 'mp4' | 'webm',
  width: number,
  height: number,
  bitrate: number,
  fps: number,
  preferredCodec: ExportSettings['codec']
): Promise<{ codecString: string; muxerCodec: string; isHardware: boolean } | null> {
  if (typeof VideoEncoder === 'undefined') return null;

  const isHighRes = width > 1920 || height > 1080;
  const mp4Candidates =
    preferredCodec === 'h265'
      ? [
          { codecString: 'hvc1.1.6.L153.B0', muxerCodec: 'hevc' },
          { codecString: 'avc1.640034', muxerCodec: 'avc' },
          { codecString: 'avc1.4d0032', muxerCodec: 'avc' },
          { codecString: 'avc1.4d002a', muxerCodec: 'avc' },
        ]
      : preferredCodec === 'vp9'
        ? [
            { codecString: 'vp09.00.10.08', muxerCodec: 'vp9' },
            { codecString: 'avc1.4d002a', muxerCodec: 'avc' },
          ]
        : isHighRes
          ? [
              { codecString: 'avc1.640034', muxerCodec: 'avc' },
              { codecString: 'avc1.640033', muxerCodec: 'avc' },
              { codecString: 'avc1.4d0032', muxerCodec: 'avc' },
            ]
          : [
              { codecString: 'avc1.4d002a', muxerCodec: 'avc' },
              { codecString: 'avc1.4d0032', muxerCodec: 'avc' },
              { codecString: 'avc1.640033', muxerCodec: 'avc' },
              { codecString: 'avc1.640034', muxerCodec: 'avc' },
            ];

  const webmCandidates =
    preferredCodec === 'vp9'
      ? [
          { codecString: 'vp09.00.10.08', muxerCodec: 'V_VP9' },
          { codecString: 'vp8', muxerCodec: 'V_VP8' },
        ]
      : [
          { codecString: 'vp8', muxerCodec: 'V_VP8' },
          { codecString: 'vp09.00.10.08', muxerCodec: 'V_VP9' },
        ];

  const candidates = target === 'mp4' ? mp4Candidates : webmCandidates;

  // First try hardware-accelerated encoder if available on user's GPU
  for (const hw of ['prefer-hardware', 'no-preference'] as const) {
    for (const cand of candidates) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec: cand.codecString,
          width,
          height,
          bitrate,
          framerate: fps,
          hardwareAcceleration: hw,
        });
        if (support.supported) {
          return { ...cand, isHardware: hw === 'prefer-hardware' };
        }
      } catch {
        // try next candidate
      }
    }
  }
  return null;
}

async function encodeAudioTracksToEncoder(
  channels: [Float32Array, Float32Array],
  sampleRate: number,
  codecString: 'mp4a.40.2' | 'opus',
  onChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void
): Promise<boolean> {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') {
    return false;
  }
  try {
    const support = await AudioEncoder.isConfigSupported({
      codec: codecString,
      sampleRate,
      numberOfChannels: 2,
      bitrate: 192_000,
    });
    if (!support.supported) return false;

    let encodeErr: Error | null = null;
    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => onChunk(chunk, meta),
      error: (err) => {
        encodeErr = err instanceof Error ? err : new Error('AudioEncoder error');
      },
    });

    audioEncoder.configure({
      codec: codecString,
      sampleRate,
      numberOfChannels: 2,
      bitrate: 192_000,
    });

    const totalFrames = channels[0].length;
    const chunkSize = 1024;
    for (let offset = 0; offset < totalFrames; offset += chunkSize) {
      if (encodeErr) break;
      const frames = Math.min(chunkSize, totalFrames - offset);
      const planar = new Float32Array(frames * 2);
      planar.set(channels[0].subarray(offset, offset + frames), 0);
      planar.set(channels[1].subarray(offset, offset + frames), frames);

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: frames,
        numberOfChannels: 2,
        timestamp: Math.round((offset / sampleRate) * 1_000_000),
        data: planar,
      });
      audioEncoder.encode(audioData);
      audioData.close();
      if (audioEncoder.encodeQueueSize >= 16) {
        await new Promise((r) => setTimeout(r, 5));
      }
    }

    await audioEncoder.flush();
    audioEncoder.close();
    return !encodeErr;
  } catch {
    return false;
  }
}

async function exportGifInBrowser(
  width: number,
  height: number,
  fps: number,
  duration: number,
  clips: TimelineClip[],
  tracks: TimelineTrack[],
  assets: Map<string, MediaAsset>,
  mediaCache: MediaElementCache,
  onProgress: (pct: number) => void
): Promise<ClientExportResult> {
  const gifW = Math.min(width, 640);
  const gifH = Math.max(120, Math.round((height / width) * gifW / 2) * 2);
  const gifFps = Math.min(fps, 15);
  const totalFrames = Math.max(2, Math.round(duration * gifFps));
  const delayMs = Math.round(1000 / gifFps);

  const canvas = document.createElement('canvas');
  canvas.width = gifW;
  canvas.height = gifH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('تعذر تهيئة محرك الرسم لتصدير GIF');

  const gif = GIFEncoder();

  for (let i = 0; i < totalFrames; i++) {
    const t = Math.min(duration, i / gifFps);
    await seekVideoElementsForTime(clips, mediaCache, t);
    renderCompositionFrame(ctx, gifW, gifH, clips, tracks, assets, mediaCache, t);
    const { data } = ctx.getImageData(0, 0, gifW, gifH);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, gifW, gifH, { palette, delay: delayMs });
    onProgress(15 + Math.round(((i + 1) / totalFrames) * 82));
    if (i % 4 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  gif.finish();
  const bytes = gif.bytes();
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: 'image/gif' }),
    actualFormat: 'gif',
    width: gifW,
    height: gifH,
    engineLabel: 'محرك المتصفح السريع (GIF)',
  };
}

async function exportWithMediaRecorderFallback(
  targetWidth: number,
  targetHeight: number,
  fps: number,
  bitrateBps: number,
  preferredFormat: ExportSettings['format'],
  duration: number,
  clips: TimelineClip[],
  tracks: TimelineTrack[],
  assets: Map<string, MediaAsset>,
  mediaCache: MediaElementCache,
  channels: [Float32Array, Float32Array],
  sampleRate: number,
  onProgress: (pct: number) => void
): Promise<ClientExportResult> {
  const capScale = targetWidth > 1920 ? 1920 / targetWidth : 1;
  const capW = Math.max(320, Math.round((targetWidth * capScale) / 2) * 2);
  const capH = Math.max(240, Math.round((targetHeight * capScale) / 2) * 2);

  const canvas = document.createElement('canvas');
  canvas.width = capW;
  canvas.height = capH;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('تعذر تهيئة محرك الرسم للتصدير');

  const videoStream = canvas.captureStream(Math.min(fps, 30));
  const combinedStream = new MediaStream(videoStream.getVideoTracks());

  let audioCtx: AudioContext | null = null;
  let audioSource: AudioBufferSourceNode | null = null;
  try {
    audioCtx = new AudioContext({ sampleRate });
    await audioCtx.resume().catch(() => {});
    const audioBuf = audioCtx.createBuffer(2, channels[0].length, sampleRate);
    audioBuf.getChannelData(0).set(channels[0]);
    audioBuf.getChannelData(1).set(channels[1]);
    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = audioBuf;
    const dest = audioCtx.createMediaStreamDestination();
    audioSource.connect(dest);
    for (const track of dest.stream.getAudioTracks()) {
      combinedStream.addTrack(track);
    }
  } catch {
    // proceed video-only if audio stream creation restricted
  }

  const preferMp4 = preferredFormat === 'mp4' || preferredFormat === 'mov' || preferredFormat === 'avi';
  const mimeCandidates = preferMp4
    ? [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm',
      ]
    : [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm',
        'video/mp4',
      ];
  const mimeType =
    mimeCandidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ||
    'video/webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: Math.min(20_000_000, bitrateBps),
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const donePromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  renderCompositionFrame(ctx, capW, capH, clips, tracks, assets, mediaCache, 0);
  recorder.start(250);
  if (audioSource) audioSource.start(0);

  const stepMs = 1000 / Math.min(fps, 30);
  const startMs = performance.now();

  await new Promise<void>((resolve) => {
    const timer = window.setInterval(() => {
      const elapsedSec = (performance.now() - startMs) / 1000;
      if (elapsedSec >= duration) {
        window.clearInterval(timer);
        resolve();
        return;
      }
      renderCompositionFrame(ctx, capW, capH, clips, tracks, assets, mediaCache, elapsedSec);
      onProgress(22 + Math.round((elapsedSec / duration) * 74));
    }, stepMs);
  });

  try {
    audioSource?.stop();
  } catch {
    // ignore
  }
  recorder.stop();
  const blob = await donePromise;
  for (const track of combinedStream.getTracks()) track.stop();
  for (const track of videoStream.getTracks()) track.stop();
  await audioCtx?.close().catch(() => {});

  const isMp4 = mimeType.includes('mp4');
  return {
    blob,
    actualFormat: isMp4 ? 'mp4' : 'webm',
    width: capW,
    height: capH,
    engineLabel: 'محرك المتصفح المباشر (MediaRecorder)',
  };
}

export async function exportProjectInBrowser(options: {
  settings: ExportSettings;
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  assets: Map<string, MediaAsset>;
  mediaCache: MediaElementCache;
  duration: number;
  onProgress: (pct: number) => void;
}): Promise<ClientExportResult> {
  const { settings, clips, tracks, assets, mediaCache, duration, onProgress } = options;
  const safeDuration = Math.max(1, duration);
  const dims = getExportDimensions(settings.resolution, settings.aspectRatio);
  const bitrateBps = getEstimatedBitrateKbps(settings.resolution, settings.quality, settings.fps) * 1000;

  onProgress(5);

  if (settings.format === 'gif') {
    return exportGifInBrowser(
      dims.width,
      dims.height,
      settings.fps,
      safeDuration,
      clips,
      tracks,
      assets,
      mediaCache,
      onProgress
    );
  }

  // 1. Mix audio track cleanly in browser (with optional full noise removal DSP)
  const { channels, sampleRate } = await renderProjectMixdownChannels(
    clips,
    tracks,
    assets,
    safeDuration,
    48000,
    settings.includeDenoise
  );
  onProgress(18);

  const isWebmFamily = settings.format === 'webm' || settings.format === 'mkv' || settings.codec === 'vp9';
  const containerKind: 'mp4' | 'webm' = isWebmFamily ? 'webm' : 'mp4';

  // 2. Try true WebCodecs hardware-accelerated frame-by-frame encoding (supports full 4K 3840x2160!)
  const resolutionsToTry = [
    dims,
    ...(dims.width > 2560 ? [getExportDimensions('2k', settings.aspectRatio)] : []),
    ...(dims.width > 1920 ? [getExportDimensions('1080p', settings.aspectRatio)] : []),
  ];

  for (const candidateDims of resolutionsToTry) {
    const codecPick = await pickSupportedVideoCodec(
      containerKind,
      candidateDims.width,
      candidateDims.height,
      bitrateBps,
      settings.fps,
      settings.codec
    );

    if (!codecPick) continue;
    // When running without hardware GPU VideoEncoder acceleration, real-time MediaRecorder
    // completes predictably at 1x speed instead of stalling in CPU-bound software WebCodecs.
    if (!codecPick.isHardware && typeof MediaRecorder !== 'undefined') {
      break;
    }

    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = candidateDims.width;
      exportCanvas.height = candidateDims.height;
      const ctx = exportCanvas.getContext('2d', { alpha: false });
      if (!ctx) break;

      let audioCodecString: 'mp4a.40.2' | 'opus' | null = null;
      if (typeof AudioEncoder !== 'undefined') {
        const candidates: Array<'mp4a.40.2' | 'opus'> =
          containerKind === 'mp4' ? ['mp4a.40.2', 'opus'] : ['opus'];
        for (const cand of candidates) {
          const ok = await AudioEncoder.isConfigSupported({
            codec: cand,
            sampleRate,
            numberOfChannels: 2,
            bitrate: 192_000,
          })
            .then((r) => r.supported)
            .catch(() => false);
          if (ok) {
            audioCodecString = cand;
            break;
          }
        }
      }

      if (containerKind === 'mp4') {
        const target = new Mp4ArrayBufferTarget();
        const muxer = new Mp4Muxer({
          target,
          video: {
            codec: codecPick.muxerCodec as 'avc' | 'hevc' | 'vp9',
            width: candidateDims.width,
            height: candidateDims.height,
            frameRate: settings.fps,
          },
          audio: audioCodecString
            ? {
                codec: audioCodecString === 'opus' ? 'opus' : 'aac',
                numberOfChannels: 2,
                sampleRate,
              }
            : undefined,
          fastStart: 'in-memory',
        });

        const totalFrames = Math.max(1, Math.round(safeDuration * settings.fps));
        const frameDurationUs = Math.round(1_000_000 / settings.fps);

        let videoErr: Error | null = null;
        let encodedCount = 0;
        const videoEncoder = new VideoEncoder({
          output: (chunk, meta) => {
            try {
              muxer.addVideoChunk(chunk, meta);
            } catch (err) {
              videoErr = err instanceof Error ? err : new Error(String(err));
              return;
            }
            encodedCount++;
            if (encodedCount % 4 === 0 || encodedCount === totalFrames) {
              onProgress(22 + Math.round((encodedCount / totalFrames) * 63));
            }
          },
          error: (err) => {
            videoErr = err instanceof Error ? err : new Error('VideoEncoder error');
          },
        });

        videoEncoder.configure({
          codec: codecPick.codecString,
          width: candidateDims.width,
          height: candidateDims.height,
          bitrate: bitrateBps,
          framerate: settings.fps,
          latencyMode: 'realtime',
        });

        for (let i = 0; i < totalFrames; i++) {
          if (videoErr) throw videoErr;
          const t = i / settings.fps;
          await seekVideoElementsForTime(clips, mediaCache, t);
          renderCompositionFrame(
            ctx,
            candidateDims.width,
            candidateDims.height,
            clips,
            tracks,
            assets,
            mediaCache,
            t
          );
          const frame = new VideoFrame(exportCanvas, {
            timestamp: i * frameDurationUs,
            duration: frameDurationUs,
          });
          videoEncoder.encode(frame, { keyFrame: i % (settings.fps * 2) === 0 });
          frame.close();

          if (i % 6 === 0) {
            if (encodedCount === 0) {
              onProgress(20 + Math.round(((i + 1) / totalFrames) * 8));
            }
            await new Promise((r) => setTimeout(r, 0));
          }
          if (i > 0 && i % 32 === 0) {
            await videoEncoder.flush();
          }
        }

        await videoEncoder.flush();
        videoEncoder.close();

        if (audioCodecString) {
          onProgress(86);
          await encodeAudioTracksToEncoder(channels, sampleRate, audioCodecString, (chunk, meta) => {
            muxer.addAudioChunk(chunk, meta);
          });
        }

        muxer.finalize();
        onProgress(100);
        const outExt = settings.format === 'mov' ? 'mov' : 'mp4';
        return {
          blob: new Blob([target.buffer], {
            type: outExt === 'mov' ? 'video/quicktime' : 'video/mp4',
          }),
          actualFormat: outExt,
          width: candidateDims.width,
          height: candidateDims.height,
          engineLabel: 'محرك WebCodecs فائق السرعة (4K)',
        };
      } else {
        const target = new WebmArrayBufferTarget();
        const muxer = new WebmMuxer({
          target,
          type: settings.format === 'mkv' ? 'matroska' : 'webm',
          video: {
            codec: codecPick.muxerCodec,
            width: candidateDims.width,
            height: candidateDims.height,
            frameRate: settings.fps,
          },
          audio: audioCodecString
            ? { codec: 'A_OPUS', numberOfChannels: 2, sampleRate }
            : undefined,
        });

        const totalFrames = Math.max(1, Math.round(safeDuration * settings.fps));
        const frameDurationUs = Math.round(1_000_000 / settings.fps);

        let videoErr: Error | null = null;
        let encodedCount = 0;
        const videoEncoder = new VideoEncoder({
          output: (chunk, meta) => {
            try {
              muxer.addVideoChunk(chunk, meta);
            } catch (err) {
              videoErr = err instanceof Error ? err : new Error(String(err));
              return;
            }
            encodedCount++;
            if (encodedCount % 4 === 0 || encodedCount === totalFrames) {
              onProgress(22 + Math.round((encodedCount / totalFrames) * 63));
            }
          },
          error: (err) => {
            videoErr = err instanceof Error ? err : new Error('VideoEncoder error');
          },
        });

        videoEncoder.configure({
          codec: codecPick.codecString,
          width: candidateDims.width,
          height: candidateDims.height,
          bitrate: bitrateBps,
          framerate: settings.fps,
          latencyMode: 'realtime',
        });

        for (let i = 0; i < totalFrames; i++) {
          if (videoErr) throw videoErr;
          const t = i / settings.fps;
          await seekVideoElementsForTime(clips, mediaCache, t);
          renderCompositionFrame(
            ctx,
            candidateDims.width,
            candidateDims.height,
            clips,
            tracks,
            assets,
            mediaCache,
            t
          );
          const frame = new VideoFrame(exportCanvas, {
            timestamp: i * frameDurationUs,
            duration: frameDurationUs,
          });
          videoEncoder.encode(frame, { keyFrame: i % (settings.fps * 2) === 0 });
          frame.close();

          if (i % 6 === 0) {
            if (encodedCount === 0) {
              onProgress(20 + Math.round(((i + 1) / totalFrames) * 8));
            }
            await new Promise((r) => setTimeout(r, 0));
          }
          if (i > 0 && i % 32 === 0) {
            await videoEncoder.flush();
          }
        }

        await videoEncoder.flush();
        videoEncoder.close();

        if (audioCodecString) {
          onProgress(86);
          await encodeAudioTracksToEncoder(channels, sampleRate, 'opus', (chunk, meta) => {
            muxer.addAudioChunk(chunk, meta);
          });
        }

        muxer.finalize();
        onProgress(100);
        const outExt = settings.format === 'mkv' ? 'mkv' : 'webm';
        return {
          blob: new Blob([target.buffer], {
            type: outExt === 'mkv' ? 'video/x-matroska' : 'video/webm',
          }),
          actualFormat: outExt,
          width: candidateDims.width,
          height: candidateDims.height,
          engineLabel: 'محرك WebCodecs فائق السرعة',
        };
      }
    } catch (err) {
      console.warn('WebCodecs attempt failed, trying fallback:', err);
    }
  }

  // 3. Universal MediaRecorder Fallback (guaranteed to work across browsers & serverless environments)
  return exportWithMediaRecorderFallback(
    dims.width,
    dims.height,
    settings.fps,
    bitrateBps,
    settings.format,
    safeDuration,
    clips,
    tracks,
    assets,
    mediaCache,
    channels,
    sampleRate,
    onProgress
  );
}
