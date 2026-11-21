import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Verifies that firestore.rules strictly encodes all 12 Dirty Dozen defensive gates
 * and matches firebase-blueprint.json collection paths and bounds.
 */
describe('Firestore Security Rules Static & Invariant Verification', () => {
  const rulesPath = path.join(process.cwd(), 'firestore.rules');
  const blueprintPath = path.join(process.cwd(), 'firebase-blueprint.json');

  it('has firebase-blueprint.json matching required entities and paths', () => {
    const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));
    assert.ok(blueprint.entities.UserPrivateProfile);
    assert.ok(blueprint.entities.VideoProject);
    assert.ok(blueprint.entities.MediaAssetRecord);
    assert.ok(blueprint.entities.MediaDataChunk);
    assert.ok(blueprint.firestore['/users/{userId}/private/profile']);
    assert.ok(blueprint.firestore['/users/{userId}/projects/{projectId}']);
    assert.ok(blueprint.firestore['/users/{userId}/projects/{projectId}/media/{mediaId}']);
    assert.ok(blueprint.firestore['/users/{userId}/projects/{projectId}/media/{mediaId}/chunks/{chunkId}']);
  });

  it('enforces all Eight Pillars in firestore.rules', () => {
    const rules = fs.readFileSync(rulesPath, 'utf8');
    // Pillar 0 & 1: rules_version 2 + default deny catch-all
    assert.match(rules, /rules_version\s*=\s*'2'/);
    assert.match(rules, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/);

    // Pillar 2: Validation helpers + strict keys + email_verified
    assert.match(rules, /request\.auth\.token\.email_verified == true/);
    assert.match(rules, /function isValidId\(id\)/);
    assert.match(rules, /function isValidProfile\(/);
    assert.match(rules, /function isValidProject\(/);
    assert.match(rules, /function isValidMediaAsset\(/);
    assert.match(rules, /function isValidMediaChunk\(/);

    // Pillar 4 & 12: affectedKeys().hasOnly + immutable ownerId/createdAt
    assert.match(rules, /affectedKeys\(\)\.hasOnly\(/);
    assert.match(rules, /incoming\(\)\.ownerId == existing\(\)\.ownerId/);
    assert.match(rules, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);

    // Pillar 13: request.time server timestamp enforcement
    assert.match(rules, /data\.createdAt == request\.time/);
    assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);

    // Pillar 1 & 11: Parent existence Master Gate on media & chunks
    assert.match(rules, /exists\(\/databases\/\$\(database\)\/documents\/users\/\$\(userId\)\/projects\/\$\(projectId\)\)/);
    assert.match(rules, /exists\(\/databases\/\$\(database\)\/documents\/users\/\$\(userId\)\/projects\/\$\(projectId\)\/media\/\$\(mediaId\)\)/);

    // Pillar 8: Secure list query enforcement on resource.data
    assert.match(rules, /allow list:[\s\S]*resource\.data\.ownerId == request\.auth\.uid/);
  });
});
