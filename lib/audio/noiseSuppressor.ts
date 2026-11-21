import { encodePcmWav } from './wavEncoder';
import type { AudioCleanupProps, MediaAsset, TimelineClip, TimelineTrack } from '../editor/types';

export interface LiveAudioNodes {
  source: MediaElementAudioSourceNode;
  highpass: BiquadFilterNode;
  lowpass: BiquadFilterNode;
  humNotch: BiquadFilterNode;
  voicePresence: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  gain: GainNode;
  analyser: AnalyserNode;
}

export function applyAudioCleanupToGraph(
  nodes: Omit<LiveAudioNodes, 'source' | 'analyser'>,
  audio: AudioCleanupProps,
  trackMuted: boolean,
  bypassDenoise = false
) {
  const effectiveVolume = audio.muted || trackMuted ? 0 : audio.volume;
  nodes.gain.gain.value = effectiveVolume;

  if (!audio.denoiseEnabled || bypassDenoise) {
    nodes.highpass.frequency.value = 20;
    nodes.lowpass.frequency.value = 20000;
    nodes.humNotch.Q.value = 0.5;
    nodes.humNotch.gain.value = 0;
    nodes.voicePresence.gain.value = 0;
    nodes.compressor.threshold.value = 0;
    nodes.compressor.ratio.value = 1;
    return;
  }

  const strength = Math.max(0.1, audio.denoiseStrength / 100);
  nodes.highpass.frequency.value = Math.max(20, Math.min(400, audio.windCutHz));
  nodes.lowpass.frequency.value = Math.max(3000, Math.min(18500, audio.hissCutHz));
  nodes.humNotch.frequency.value = 60;
  nodes.humNotch.Q.value = 4;
  nodes.humNotch.gain.value = -12 * strength;

  nodes.voicePresence.frequency.value = 2900;
  nodes.voicePresence.Q.value = 1.2;
  nodes.voicePresence.gain.value = audio.voiceBoost * strength;

  if (audio.normalize) {
    nodes.compressor.threshold.value = -24;
    nodes.compressor.knee.value = 18;
    nodes.compressor.ratio.value = 4 + strength * 4;
    nodes.compressor.attack.value = 0.005;
    nodes.compressor.release.value = 0.18;
  } else {
    nodes.compressor.threshold.value = -10;
    nodes.compressor.ratio.value = 1.5;
  }
}

/**
 * Mixes all active audio clips via OfflineAudioContext with full noise-removal DSP
 * and returns stereo Float32Array channels + sampleRate.
 */
export async function renderProjectMixdownChannels(
  clips: TimelineClip[],
  tracks: TimelineTrack[],
  assets: Map<string, MediaAsset>,
  totalDuration: number,
  sampleRate = 48000,
  forceDenoiseAll = false
): Promise<{ channels: [Float32Array, Float32Array]; sampleRate: number }> {
  const safeDuration = Math.max(0.5, totalDuration);
  const length = Math.ceil(safeDuration * sampleRate);
  const offline = new OfflineAudioContext(2, length, sampleRate);

  const mutedTrackIds = new Set(tracks.filter((t) => t.muted).map((t) => t.id));
  const audioClips = clips.filter(
    (c) =>
      (c.kind === 'audio' || c.kind === 'video') &&
      c.assetId &&
      !c.audio.muted &&
      !mutedTrackIds.has(c.trackId)
  );

  for (const clip of audioClips) {
    const asset = clip.assetId ? assets.get(clip.assetId) : undefined;
    if (!asset) continue;

    try {
      const resp = await fetch(asset.src);
      const arrBuf = await resp.arrayBuffer();
      const decoded = await offline.decodeAudioData(arrBuf).catch(() => null);
      if (!decoded) continue;

      const source = offline.createBufferSource();
      source.buffer = decoded;
      source.playbackRate.value = clip.speed || 1;

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

      const effectiveAudio: AudioCleanupProps = forceDenoiseAll
        ? { ...clip.audio, denoiseEnabled: true }
        : clip.audio;

      applyAudioCleanupToGraph(
        { highpass, lowpass, humNotch, voicePresence, compressor, gain },
        effectiveAudio,
        false,
        false
      );

      const start = Math.max(0, clip.startTime);
      const end = start + clip.duration;
      const baseVol = effectiveAudio.volume;
      if (effectiveAudio.fadeIn > 0) {
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(baseVol, Math.min(end, start + effectiveAudio.fadeIn));
      } else {
        gain.gain.setValueAtTime(baseVol, start);
      }
      if (effectiveAudio.fadeOut > 0) {
        const fadeOutStart = Math.max(start, end - effectiveAudio.fadeOut);
        gain.gain.setValueAtTime(baseVol, fadeOutStart);
        gain.gain.linearRampToValueAtTime(0.001, end);
      }

      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(humNotch);
      humNotch.connect(voicePresence);
      voicePresence.connect(compressor);
      compressor.connect(gain);
      gain.connect(offline.destination);

      source.start(start, clip.trimStart, clip.duration * (clip.speed || 1));
    } catch {
      // Skip clips whose decoded stream has no audio track
    }
  }

  const rendered = await offline.startRendering();
  const ch0 = rendered.getChannelData(0);
  const ch1 = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : ch0;
  return { channels: [ch0, ch1], sampleRate };
}

/**
 * Mixes all active audio clips via OfflineAudioContext and returns a clean WAV Uint8Array.
 */
export async function renderProjectMixdownWav(
  clips: TimelineClip[],
  tracks: TimelineTrack[],
  assets: Map<string, MediaAsset>,
  totalDuration: number,
  sampleRate = 48000,
  forceDenoiseAll = false
): Promise<Uint8Array> {
  const { channels } = await renderProjectMixdownChannels(
    clips,
    tracks,
    assets,
    totalDuration,
    sampleRate,
    forceDenoiseAll
  );
  return encodePcmWav(channels, sampleRate, 16);
}
