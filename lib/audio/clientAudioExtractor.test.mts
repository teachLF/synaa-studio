import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Mp3Encoder } from '@breezystack/lamejs';
import { encodeMp3FromChannels, float32ToInt16Pcm } from './clientAudioExtractor';

describe('Client Audio Extractor & MP3 Encoder', () => {
  it('converts normalized Float32 samples into clipped Int16 PCM', () => {
    const input = new Float32Array([-1.5, -1.0, 0, 0.5, 1.0, 1.5]);
    const pcm = float32ToInt16Pcm(input);
    assert.equal(pcm[0], -32768);
    assert.equal(pcm[1], -32768);
    assert.equal(pcm[2], 0);
    assert.equal(pcm[4], 32767);
    assert.equal(pcm[5], 32767);
  });

  it('encodes stereo Float32 audio into a valid MP3 bitstream with MPEG sync bytes', () => {
    const sampleRate = 44100;
    const len = sampleRate / 2; // 0.5s sine tone
    const left = new Float32Array(len);
    const right = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const v = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.4;
      left[i] = v;
      right[i] = v;
    }

    const mp3 = encodeMp3FromChannels(left, right, sampleRate, 192, Mp3Encoder);
    assert.ok(mp3.length > 2000, 'Expected non-empty MP3 output');
    // MPEG-1 Layer III frame sync starts with 0xFF 0xFB / 0xFA
    assert.equal(mp3[0], 0xff);
    assert.ok((mp3[1] & 0xe0) === 0xe0, 'Expected MPEG frame sync bits');
  });
});
