import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTransitionState,
  DEFAULT_AUDIO_CLEANUP,
  DEFAULT_COLOR_ADJUSTMENTS,
  DEFAULT_TRANSFORM,
  formatTimecode,
  getColorFilterCss,
  getEstimatedBitrateKbps,
  getExportDimensions,
  getProjectDuration,
  snapTime,
  splitClipAtTime,
} from './timelineMath';
import { applyEasing, TRANSITIONS } from './transitions';
import type { TimelineClip } from './types';

function makeClip(overrides: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: 'clip-1',
    trackId: 'track-v1',
    kind: 'video',
    name: 'Test Clip',
    startTime: 0,
    duration: 10,
    trimStart: 0,
    speed: 1,
    inTransition: { type: 'crossfade', duration: 1, easing: 'easeInOut' },
    outTransition: { type: 'dip_black', duration: 1, easing: 'easeInOut' },
    color: { ...DEFAULT_COLOR_ADJUSTMENTS },
    transform: { ...DEFAULT_TRANSFORM },
    audio: { ...DEFAULT_AUDIO_CLEANUP },
    accentColor: '#F59E0B',
    ...overrides,
  };
}

test('formatTimecode formats hours, minutes, seconds, and frames accurately', () => {
  assert.equal(formatTimecode(0, 30), '00:00:00:00');
  assert.equal(formatTimecode(65.5, 30), '00:01:05:15');
  assert.equal(formatTimecode(3661, 24), '01:01:01:00');
});

test('getExportDimensions returns exact even dimensions up to 4K across aspect ratios', () => {
  assert.deepEqual(getExportDimensions('4k', '16:9'), { width: 3840, height: 2160 });
  assert.deepEqual(getExportDimensions('4k', '9:16'), { width: 2160, height: 3840 });
  assert.deepEqual(getExportDimensions('4k', '1:1'), { width: 2160, height: 2160 });
  assert.deepEqual(getExportDimensions('1080p', '4:5'), { width: 1080, height: 1350 });
  const ultraWide = getExportDimensions('1080p', '21:9');
  assert.equal(ultraWide.width % 2, 0);
  assert.equal(ultraWide.height % 2, 0);
});

test('getEstimatedBitrateKbps scales properly with resolution, quality, and fps', () => {
  const uhdUltra60 = getEstimatedBitrateKbps('4k', 'ultra', 60);
  const hdBalanced30 = getEstimatedBitrateKbps('1080p', 'balanced', 30);
  assert.ok(uhdUltra60 > hdBalanced30 * 5);
});

test('splitClipAtTime divides clip cleanly and adjusts trimStart', () => {
  const clip = makeClip({ id: 'c1', startTime: 2, duration: 8, trimStart: 1, speed: 1.5 });
  const result = splitClipAtTime([clip], 'c1', 6);
  assert.equal(result.length, 2);
  assert.equal(result[0].duration, 4);
  assert.equal(result[0].outTransition.type, 'none');
  assert.equal(result[1].startTime, 6);
  assert.equal(result[1].duration, 4);
  assert.equal(result[1].trimStart, 7); // 1 + 4 * 1.5
  assert.equal(result[1].inTransition.type, 'none');
});

test('snapTime snaps to nearest target within threshold', () => {
  assert.equal(snapTime(4.92, [0, 5, 10], 0.15), 5);
  assert.equal(snapTime(4.5, [0, 5, 10], 0.15), 4.5);
});

test('calculateTransitionState detects in, middle, and out phases accurately', () => {
  const clip = makeClip({ startTime: 2, duration: 10 });
  assert.deepEqual(calculateTransitionState(clip, 2.5), { phase: 'in', progress: 0.5 });
  assert.deepEqual(calculateTransitionState(clip, 7), { phase: 'none', progress: 1 });
  assert.deepEqual(calculateTransitionState(clip, 11.5), { phase: 'out', progress: 0.5 });
});

test('getProjectDuration computes total timeline span', () => {
  const clips = [makeClip({ startTime: 0, duration: 4 }), makeClip({ id: 'c2', startTime: 3.5, duration: 6 })];
  assert.equal(getProjectDuration(clips), 9.5);
});

test('getColorFilterCss builds valid CSS filter string', () => {
  const css = getColorFilterCss({ ...DEFAULT_COLOR_ADJUSTMENTS, brightness: 120, blur: 4, sepia: 20 });
  assert.ok(css.includes('brightness(120%)'));
  assert.ok(css.includes('blur(4px)'));
  assert.ok(css.includes('sepia(20%)'));
});

test('transitions catalog contains at least 30 distinct animated transitions and valid easing', () => {
  assert.ok(TRANSITIONS.length >= 30);
  const ids = new Set(TRANSITIONS.map((t) => t.id));
  assert.equal(ids.size, TRANSITIONS.length);
  assert.equal(applyEasing(0, 'easeInOut'), 0);
  assert.equal(applyEasing(1, 'easeInOut'), 1);
});

test('getActiveClipsAtTime sorts base video track before shape and text overlays', async () => {
  const { getActiveClipsAtTime } = await import('./timelineMath');
  const tracks = [
    { id: 'track-t1', name: 'Text', type: 'text' as const, muted: false, hidden: false, locked: false },
    { id: 'track-s1', name: 'Shape', type: 'shape' as const, muted: false, hidden: false, locked: false },
    { id: 'track-v1', name: 'Video', type: 'video' as const, muted: false, hidden: false, locked: false },
  ];
  const clips = [
    makeClip({ id: 'txt', trackId: 'track-t1', kind: 'text', startTime: 0, duration: 5 }),
    makeClip({ id: 'shp', trackId: 'track-s1', kind: 'shape', startTime: 0, duration: 5 }),
    makeClip({ id: 'vid', trackId: 'track-v1', kind: 'video', startTime: 0, duration: 5 }),
  ];
  const ordered = getActiveClipsAtTime(clips, tracks, 1.5);
  assert.deepEqual(
    ordered.map((c) => c.id),
    ['vid', 'shp', 'txt']
  );
});
