import test from 'node:test';
import assert from 'node:assert/strict';
import { computeNoiseGateGain, computeRmsDb, encodePcmWav } from './wavEncoder';

test('encodePcmWav creates valid RIFF/WAVE 16-bit header and payload size', () => {
  const left = new Float32Array([0, 0.5, -0.5, 1]);
  const right = new Float32Array([0, -0.5, 0.5, -1]);
  const wav = encodePcmWav([left, right], 48000, 16);

  assert.equal(String.fromCharCode(...wav.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), 'WAVE');
  assert.equal(String.fromCharCode(...wav.slice(12, 16)), 'fmt ');
  assert.equal(String.fromCharCode(...wav.slice(36, 40)), 'data');
  assert.equal(wav.length, 44 + 4 * 2 * 2); // 4 samples * 2 channels * 2 bytes
});

test('computeRmsDb and computeNoiseGateGain attenuate noise below threshold', () => {
  const quiet = new Float32Array(256).fill(0.001); // ~ -60 dB
  const loud = new Float32Array(256).fill(0.5); // ~ -6 dB

  const quietDb = computeRmsDb(quiet);
  const loudDb = computeRmsDb(loud);

  assert.ok(quietDb < -50);
  assert.ok(loudDb > -10);

  assert.equal(computeNoiseGateGain(loudDb, -38, 90), 1);
  assert.ok(computeNoiseGateGain(quietDb, -38, 90) < 0.2);
});
