/**
 * Pure PCM WAV encoder and digital audio DSP helpers (no DOM dependencies so unit-testable in Node).
 */

export function encodePcmWav(
  channels: Float32Array[],
  sampleRate: number,
  bitDepth: 16 | 24 = 16
): Uint8Array {
  const numChannels = Math.max(1, channels.length);
  const length = channels[0]?.length ?? 0;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch]?.[i] ?? 0));
      if (bitDepth === 16) {
        const intVal = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
        view.setInt16(offset, intVal, true);
        offset += 2;
      } else {
        const intVal = Math.round(sample * 0x7fffff);
        view.setUint8(offset, intVal & 0xff);
        view.setUint8(offset + 1, (intVal >> 8) & 0xff);
        view.setUint8(offset + 2, (intVal >> 16) & 0xff);
        offset += 3;
      }
    }
  }

  return new Uint8Array(buffer);
}

export function computeRmsDb(samples: Float32Array): number {
  if (samples.length === 0) return -100;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    sumSq += s * s;
  }
  const rms = Math.sqrt(sumSq / samples.length);
  if (rms <= 1e-7) return -100;
  return 20 * Math.log10(rms);
}

export function computeNoiseGateGain(
  signalDb: number,
  thresholdDb: number,
  denoiseStrength: number
): number {
  if (signalDb >= thresholdDb) return 1.0;
  const strength = Math.max(0, Math.min(1, denoiseStrength / 100));
  const diff = thresholdDb - signalDb;
  const attenuation = Math.min(1, diff / 18) * strength;
  return Math.max(0.02, 1 - attenuation);
}
