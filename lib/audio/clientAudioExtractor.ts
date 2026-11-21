import * as lamejsPkg from '@breezystack/lamejs';
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmArrayBufferTarget } from 'webm-muxer';
import { applyAudioCleanupToGraph } from './noiseSuppressor';
import { encodePcmWav } from './wavEncoder';
import { DEFAULT_AUDIO_CLEANUP, DENOISE_PRESETS } from '@/lib/editor/timelineMath';
import type { AudioExtractFormat, DenoisePreset } from '@/lib/editor/types';

function resolveMp3Encoder(): typeof lamejsPkg.Mp3Encoder {
  const mod = lamejsPkg as unknown as {
    Mp3Encoder?: typeof lamejsPkg.Mp3Encoder;
    default?: { Mp3Encoder?: typeof lamejsPkg.Mp3Encoder };
  };
  const globalLame = (
    globalThis as unknown as { lamejs?: { Mp3Encoder?: typeof lamejsPkg.Mp3Encoder } }
  ).lamejs;
  const ctor = mod.Mp3Encoder || mod.default?.Mp3Encoder || globalLame?.Mp3Encoder;
  if (!ctor) {
    throw new Error('تعذر تهيئة مشفر MP3 في المتصفح');
  }
  return ctor;
}

export function float32ToInt16Pcm(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return out;
}

export function encodeMp3FromChannels(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  kbps: number,
  encoderCtor?: typeof lamejsPkg.Mp3Encoder
): Uint8Array {
  const leftPcm = float32ToInt16Pcm(left);
  const rightPcm = float32ToInt16Pcm(right);
  const EncoderCtor = encoderCtor ?? resolveMp3Encoder();
  const encoder = new EncoderCtor(2, sampleRate, kbps);

  const chunks: Uint8Array[] = [];
  const blockSize = 1152;

  for (let i = 0; i < leftPcm.length; i += blockSize) {
    const lSlice = leftPcm.subarray(i, i + blockSize);
    const rSlice = rightPcm.subarray(i, i + blockSize);
    const buf = encoder.encodeBuffer(lSlice, rSlice);
    if (buf.length > 0) chunks.push(new Uint8Array(buf));
  }

  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(new Uint8Array(tail));

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return merged;
}

export async function processAudioChannelsWithDenoise(
  rawChannels: [Float32Array, Float32Array],
  sourceSampleRate: number,
  targetSampleRate: 44100 | 48000,
  denoiseEnabled: boolean,
  denoisePreset: DenoisePreset
): Promise<[Float32Array, Float32Array]> {
  const duration = Math.max(0.25, rawChannels[0].length / sourceSampleRate);
  const length = Math.ceil(duration * targetSampleRate);
  const offline = new OfflineAudioContext(2, length, targetSampleRate);

  const srcBuffer = offline.createBuffer(2, rawChannels[0].length, sourceSampleRate);
  srcBuffer.getChannelData(0).set(rawChannels[0]);
  srcBuffer.getChannelData(1).set(rawChannels[1]);

  const source = offline.createBufferSource();
  source.buffer = srcBuffer;

  const highpass = offline.createBiquadFilter();
  highpass.type = 'highpass';
  const lowpass = offline.createBiquadFilter();
  lowpass.type = 'lowpass';
  const humNotch = offline.createBiquadFilter();
  humNotch.type = 'peaking';
  const voicePresence = offline.createBiquadFilter();
  voicePresence.type = 'peaking';
  const compressor = offline.createDynamicsCompressor();
  const gain = offline.createGain();

  const preset = DENOISE_PRESETS[denoisePreset];
  applyAudioCleanupToGraph(
    { highpass, lowpass, humNotch, voicePresence, compressor, gain },
    {
      ...DEFAULT_AUDIO_CLEANUP,
      denoiseEnabled,
      denoisePreset,
      denoiseStrength: preset.denoiseStrength,
      windCutHz: preset.windCutHz,
      hissCutHz: preset.hissCutHz,
      voiceBoost: preset.voiceBoost,
      normalize: preset.normalize,
    },
    false,
    false
  );

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(humNotch);
  humNotch.connect(voicePresence);
  voicePresence.connect(compressor);
  compressor.connect(gain);
  gain.connect(offline.destination);

  source.start(0);
  const rendered = await offline.startRendering();
  const c0 = rendered.getChannelData(0);
  const c1 = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : c0;
  return [c0, c1];
}

export async function extractAudioInBrowser(options: {
  channels: [Float32Array, Float32Array];
  sampleRate: number;
  format: AudioExtractFormat;
  bitrate: '320k' | '256k' | '192k' | '128k';
}): Promise<{ blob: Blob; actualExt: string; note?: string }> {
  const { channels, sampleRate, format, bitrate } = options;
  const kbps = Number(bitrate.replace('k', '')) || 320;

  if (format === 'wav') {
    const wavBytes = encodePcmWav(channels, sampleRate, 16);
    return {
      blob: new Blob([new Uint8Array(wavBytes)], { type: 'audio/wav' }),
      actualExt: 'wav',
    };
  }

  if (format === 'mp3') {
    const mp3Bytes = encodeMp3FromChannels(channels[0], channels[1], sampleRate, kbps);
    return {
      blob: new Blob([new Uint8Array(mp3Bytes)], { type: 'audio/mpeg' }),
      actualExt: 'mp3',
    };
  }

  if (format === 'aac' && typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined') {
    try {
      const support = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate,
        numberOfChannels: 2,
        bitrate: kbps * 1000,
      });
      if (support.supported) {
        const target = new Mp4ArrayBufferTarget();
        const muxer = new Mp4Muxer({
          target,
          audio: { codec: 'aac', numberOfChannels: 2, sampleRate },
          fastStart: 'in-memory',
        });
        const encoder = new AudioEncoder({
          output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
          error: () => {},
        });
        encoder.configure({
          codec: 'mp4a.40.2',
          sampleRate,
          numberOfChannels: 2,
          bitrate: kbps * 1000,
        });
        const chunkSize = 1024;
        for (let offset = 0; offset < channels[0].length; offset += chunkSize) {
          const frames = Math.min(chunkSize, channels[0].length - offset);
          const planar = new Float32Array(frames * 2);
          planar.set(channels[0].subarray(offset, offset + frames), 0);
          planar.set(channels[1].subarray(offset, offset + frames), frames);
          const data = new AudioData({
            format: 'f32-planar',
            sampleRate,
            numberOfFrames: frames,
            numberOfChannels: 2,
            timestamp: Math.round((offset / sampleRate) * 1_000_000),
            data: planar,
          });
          encoder.encode(data);
          data.close();
        }
        await encoder.flush();
        encoder.close();
        muxer.finalize();
        return {
          blob: new Blob([target.buffer], { type: 'audio/mp4' }),
          actualExt: 'm4a',
        };
      }
    } catch {
      // fall through to WAV lossless
    }
  }

  if (format === 'ogg' && typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined') {
    try {
      const support = await AudioEncoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: kbps * 1000,
      });
      if (support.supported) {
        const target = new WebmArrayBufferTarget();
        const muxer = new WebmMuxer({
          target,
          audio: { codec: 'A_OPUS', numberOfChannels: 2, sampleRate: 48000 },
        });
        const encoder = new AudioEncoder({
          output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
          error: () => {},
        });
        encoder.configure({
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
          bitrate: kbps * 1000,
        });
        const chunkSize = 960;
        for (let offset = 0; offset < channels[0].length; offset += chunkSize) {
          const frames = Math.min(chunkSize, channels[0].length - offset);
          const planar = new Float32Array(frames * 2);
          planar.set(channels[0].subarray(offset, offset + frames), 0);
          planar.set(channels[1].subarray(offset, offset + frames), frames);
          const data = new AudioData({
            format: 'f32-planar',
            sampleRate: 48000,
            numberOfFrames: frames,
            numberOfChannels: 2,
            timestamp: Math.round((offset / 48000) * 1_000_000),
            data: planar,
          });
          encoder.encode(data);
          data.close();
        }
        await encoder.flush();
        encoder.close();
        muxer.finalize();
        return {
          blob: new Blob([target.buffer], { type: 'audio/webm' }),
          actualExt: 'webm',
          note: 'تم الترميز بصيغة Opus/WebM عالية الكفاءة عبر المتصفح',
        };
      }
    } catch {
      // fall through
    }
  }

  // Fallback for FLAC or unsupported browser codecs -> lossless WAV PCM
  const wavBytes = encodePcmWav(channels, sampleRate, 16);
  return {
    blob: new Blob([new Uint8Array(wavBytes)], { type: 'audio/wav' }),
    actualExt: 'wav',
    note:
      format === 'flac'
        ? 'تم التصدير بصيغة WAV غير مضغوطة (نقاء 100%) مباشرة من المتصفح'
        : undefined,
  };
}
