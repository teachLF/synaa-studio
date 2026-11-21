import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLUEPRINT_LIMITS,
  prepareProjectPayload,
  sanitizeId,
  splitStringIntoChunks,
  stripUndefinedDeep,
} from './projectStore';
import { INITIAL_TRACKS } from '../editor/demoProject';
import {
  DEFAULT_AUDIO_CLEANUP,
  DEFAULT_COLOR_ADJUSTMENTS,
  DEFAULT_TRANSFORM,
} from '../editor/timelineMath';
import type { TimelineClip } from '../editor/types';

describe('Cloud Project Serialization & Blueprint Compliance', () => {
  it('strips undefined values recursively without JSON.stringify', () => {
    const input = {
      name: 'demo',
      optional: undefined,
      nested: { a: 1, b: undefined, list: [1, { c: undefined, d: 2 }] },
    };
    const out = stripUndefinedDeep(input);
    assert.deepEqual(out, {
      name: 'demo',
      nested: { a: 1, list: [1, { d: 2 }] },
    });
    assert.equal('optional' in out, false);
  });

  it('sanitizes IDs to strictly match ^[a-zA-Z0-9_-]+$', () => {
    assert.equal(sanitizeId('proj/bad id?123'), 'proj_bad_id_123');
    assert.match(sanitizeId('user@domain.com'), /^[a-zA-Z0-9_-]+$/);
    assert.ok(sanitizeId('a'.repeat(300)).length <= 128);
  });

  it('splits large base64 strings into Firestore-safe chunks under 700KB', () => {
    const sample = 'A'.repeat(1_400_000);
    const chunks = splitStringIntoChunks(sample);
    assert.equal(chunks.length, 3);
    for (const c of chunks) {
      assert.ok(c.length <= BLUEPRINT_LIMITS.MAX_CHUNK_CHARS);
    }
    assert.equal(chunks.join(''), sample);
  });

  it('enforces firebase-blueprint.json bounds on tracks, clips, and thumbnail', () => {
    const hugeClips: TimelineClip[] = Array.from({ length: 240 }, (_, i) => ({
      id: `c_${i}`,
      trackId: 'track-v1',
      kind: 'text',
      name: `نص ${i}`,
      startTime: i,
      duration: 2,
      trimStart: 0,
      speed: 1,
      inTransition: { type: 'none', duration: 0.5, easing: 'easeInOut' },
      outTransition: { type: 'none', duration: 0.5, easing: 'easeInOut' },
      color: { ...DEFAULT_COLOR_ADJUSTMENTS },
      transform: { ...DEFAULT_TRANSFORM },
      audio: { ...DEFAULT_AUDIO_CLEANUP },
      accentColor: '#F59E0B',
    }));

    const payload = prepareProjectPayload({
      projectId: 'proj/1',
      ownerId: 'uid:1',
      name: 'ت'.repeat(200),
      aspectRatio: '16:9',
      duration: 12.6,
      tracks: INITIAL_TRACKS,
      clips: hugeClips,
      thumbnail: 'x'.repeat(200_000),
    });

    assert.equal(payload.id, 'proj_1');
    assert.equal(payload.ownerId, 'uid_1');
    assert.ok(payload.name.length <= BLUEPRINT_LIMITS.MAX_PROJECT_NAME);
    assert.ok(payload.clips.length <= BLUEPRINT_LIMITS.MAX_CLIPS);
    assert.equal(payload.thumbnail, undefined);
  });
});
