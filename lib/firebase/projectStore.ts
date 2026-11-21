import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { AspectRatio, MediaAsset, TimelineClip, TimelineTrack } from '@/lib/editor/types';
import { getFirebaseServices, handleFirestoreError, OperationType } from './client';

export const BLUEPRINT_LIMITS = {
  MAX_PROJECT_NAME: 120,
  MAX_TRACKS: 16,
  MAX_CLIPS: 200,
  MAX_THUMBNAIL_CHARS: 175_000,
  MAX_ASSET_NAME: 200,
  MAX_INLINE_DATA_CHARS: 340_000,
  MAX_CHUNK_CHARS: 650_000,
  MAX_CHUNKS_PER_ASSET: 32,
  MAX_WAVEFORM_LEN: 256,
} as const;

export interface CloudProjectSummary {
  id: string;
  ownerId: string;
  name: string;
  aspectRatio: AspectRatio;
  duration: number;
  clipsCount: number;
  updatedAtMs: number;
  thumbnail?: string;
}

export interface SerializedProjectPayload {
  id: string;
  ownerId: string;
  name: string;
  aspectRatio: AspectRatio;
  duration: number;
  tracks: Array<Record<string, unknown>>;
  clips: Array<Record<string, unknown>>;
  thumbnail?: string;
}

/**
 * Strips any `undefined` keys recursively so Firestore accepts native Maps/Lists cleanly.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefinedDeep(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

export function sanitizeId(raw: string, fallbackPrefix = 'item'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  if (cleaned.length >= 1) return cleaned;
  return `${fallbackPrefix}_${Date.now()}`;
}

export function splitStringIntoChunks(input: string, maxChunkSize = BLUEPRINT_LIMITS.MAX_CHUNK_CHARS): string[] {
  if (!input) return [];
  const chunks: string[] = [];
  for (let i = 0; i < input.length; i += maxChunkSize) {
    chunks.push(input.slice(i, i + maxChunkSize));
  }
  return chunks;
}

export function prepareProjectPayload(params: {
  projectId: string;
  ownerId: string;
  name: string;
  aspectRatio: AspectRatio;
  duration: number;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  thumbnail?: string;
}): SerializedProjectPayload {
  const safeName = (params.name || 'مشروع_سينا_4K').trim().slice(0, BLUEPRINT_LIMITS.MAX_PROJECT_NAME) || 'مشروع_سينا_4K';
  const safeTracks = params.tracks
    .slice(0, BLUEPRINT_LIMITS.MAX_TRACKS)
    .map((t) => stripUndefinedDeep({ ...t }) as Record<string, unknown>);
  const safeClips = params.clips
    .slice(0, BLUEPRINT_LIMITS.MAX_CLIPS)
    .map((c) => stripUndefinedDeep({ ...c }) as Record<string, unknown>);

  const payload: SerializedProjectPayload = {
    id: sanitizeId(params.projectId, 'proj'),
    ownerId: sanitizeId(params.ownerId, 'user'),
    name: safeName,
    aspectRatio: params.aspectRatio,
    duration: Math.max(0, Math.min(86400, Number(params.duration) || 0)),
    tracks: safeTracks,
    clips: safeClips,
  };

  if (params.thumbnail && params.thumbnail.length <= BLUEPRINT_LIMITS.MAX_THUMBNAIL_CHARS) {
    payload.thumbnail = params.thumbnail;
  }
  return payload;
}

async function blobOrUrlToDataUrl(asset: MediaAsset): Promise<{ dataUrl: string; sizeBytes: number } | null> {
  try {
    let blob: Blob | null = asset.rawFile || null;
    if (!blob && asset.src) {
      if (asset.src.startsWith('data:')) {
        return { dataUrl: asset.src, sizeBytes: Math.round((asset.src.length * 3) / 4) };
      }
      const resp = await fetch(asset.src);
      blob = await resp.blob();
    }
    if (!blob) return null;
    const sizeBytes = blob.size;
    // Cap cloud chunking at ~15 MB (32 * 650KB base64 chars ~ 20.8M chars ~ 15MB raw)
    if (sizeBytes > 14_500_000) {
      return { dataUrl: '', sizeBytes };
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob!);
    });
    return { dataUrl, sizeBytes };
  } catch {
    return null;
  }
}

// Lightweight IndexedDB fallback for huge (>15MB) local media files per user+project
const IDB_NAME = 'cinestudio_local_media_v1';
const IDB_STORE = 'blobs';

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveLargeBlobLocally(key: string, blob: Blob): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const idb = await openMediaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore storage quota failure
  }
}

async function loadLargeBlobLocally(key: string): Promise<Blob | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const idb = await openMediaDb();
    return await new Promise<Blob | null>((resolve) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function upsertUserProfile(user: User): Promise<void> {
  if (!user.emailVerified || !user.email) return;
  const { db } = getFirebaseServices();
  const userId = sanitizeId(user.uid, 'user');
  const profilePath = `users/${userId}/private/profile`;
  const ref = doc(db, 'users', userId, 'private', 'profile');

  try {
    const existingSnap = await getDoc(ref);
    const providerId = user.providerData?.[0]?.providerId || 'emailLink';
    const baseData: Record<string, unknown> = {
      uid: userId,
      email: user.email.slice(0, 200),
      providerId: providerId.slice(0, 64),
      updatedAt: serverTimestamp(),
    };
    if (user.displayName) baseData.displayName = user.displayName.slice(0, 120);
    if (user.photoURL) baseData.photoURL = user.photoURL.slice(0, 512);

    if (existingSnap.exists()) {
      await setDoc(ref, { ...baseData, createdAt: existingSnap.data().createdAt }, { merge: false });
    } else {
      await setDoc(ref, { ...baseData, createdAt: serverTimestamp() });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, profilePath);
  }
}

export function subscribeUserProjects(
  userId: string,
  onUpdate: (projects: CloudProjectSummary[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();
  const safeUid = sanitizeId(userId, 'user');
  const path = `users/${safeUid}/projects`;
  const q = query(collection(db, 'users', safeUid, 'projects'), where('ownerId', '==', safeUid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: CloudProjectSummary[] = snapshot.docs.map((d) => {
        const data = d.data();
        const updatedMs =
          data.updatedAt && typeof data.updatedAt.toMillis === 'function'
            ? data.updatedAt.toMillis()
            : Date.now();
        return {
          id: String(data.id || d.id),
          ownerId: String(data.ownerId || safeUid),
          name: String(data.name || 'مشروع بدون اسم'),
          aspectRatio: (data.aspectRatio as AspectRatio) || '16:9',
          duration: Number(data.duration) || 0,
          clipsCount: Array.isArray(data.clips) ? data.clips.length : 0,
          updatedAtMs: updatedMs,
          thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : undefined,
        };
      });
      list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onUpdate(list);
    },
    (err) => {
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function saveCloudProject(params: {
  user: User;
  projectId: string;
  name: string;
  aspectRatio: AspectRatio;
  duration: number;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  assets: MediaAsset[];
  thumbnail?: string;
}): Promise<{ projectId: string; savedAssetsCount: number; skippedLargeCount: number }> {
  const { db } = getFirebaseServices();
  const userId = sanitizeId(params.user.uid, 'user');
  const projectId = sanitizeId(params.projectId, 'proj');
  const projectPath = `users/${userId}/projects/${projectId}`;
  const projectRef = doc(db, 'users', userId, 'projects', projectId);

  const payload = prepareProjectPayload({
    projectId,
    ownerId: userId,
    name: params.name,
    aspectRatio: params.aspectRatio,
    duration: params.duration,
    tracks: params.tracks,
    clips: params.clips,
    thumbnail: params.thumbnail,
  });

  try {
    const existingSnap = await getDoc(projectRef);
    if (existingSnap.exists()) {
      await setDoc(projectRef, {
        ...payload,
        createdAt: existingSnap.data().createdAt,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(projectRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, projectPath);
  }

  let savedAssetsCount = 0;
  let skippedLargeCount = 0;

  for (const asset of params.assets) {
    const mediaId = sanitizeId(asset.id, 'asset');
    const mediaPath = `${projectPath}/media/${mediaId}`;
    const mediaRef = doc(db, 'users', userId, 'projects', projectId, 'media', mediaId);

    try {
      const existingMedia = await getDoc(mediaRef);
      if (existingMedia.exists()) {
        savedAssetsCount += 1;
        continue;
      }

      const encoded = await blobOrUrlToDataUrl(asset);
      const sizeBytes = encoded?.sizeBytes || 0;
      const dataUrl = encoded?.dataUrl || '';

      if (!dataUrl && asset.rawFile) {
        await saveLargeBlobLocally(`${userId}/${projectId}/${mediaId}`, asset.rawFile);
        skippedLargeCount += 1;
      }

      let inlineDataUrl: string | undefined;
      let chunks: string[] = [];

      if (dataUrl) {
        if (dataUrl.length <= BLUEPRINT_LIMITS.MAX_INLINE_DATA_CHARS) {
          inlineDataUrl = dataUrl;
        } else {
          chunks = splitStringIntoChunks(dataUrl, BLUEPRINT_LIMITS.MAX_CHUNK_CHARS).slice(
            0,
            BLUEPRINT_LIMITS.MAX_CHUNKS_PER_ASSET
          );
        }
      }

      const mediaDoc: Record<string, unknown> = {
        id: mediaId,
        ownerId: userId,
        projectId,
        name: (asset.name || 'media').slice(0, BLUEPRINT_LIMITS.MAX_ASSET_NAME),
        kind: asset.kind,
        originalExt: (asset.originalExt || 'bin').slice(0, 16),
        mimeType: (asset.mimeType || 'application/octet-stream').slice(0, 120),
        duration: Math.max(0, Number(asset.duration) || 0),
        width: Math.max(0, Number(asset.width) || 0),
        height: Math.max(0, Number(asset.height) || 0),
        chunkCount: chunks.length,
        sizeBytes,
        createdAt: serverTimestamp(),
      };

      if (asset.thumbnail && asset.thumbnail.length <= 190_000) {
        mediaDoc.thumbnail = asset.thumbnail;
      }
      if (Array.isArray(asset.waveform) && asset.waveform.length > 0) {
        mediaDoc.waveform = asset.waveform.slice(0, BLUEPRINT_LIMITS.MAX_WAVEFORM_LEN);
      }
      if (inlineDataUrl) {
        mediaDoc.inlineDataUrl = inlineDataUrl;
      }

      await setDoc(mediaRef, mediaDoc);

      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `chunk_${String(i).padStart(4, '0')}`;
        const chunkRef = doc(
          db,
          'users',
          userId,
          'projects',
          projectId,
          'media',
          mediaId,
          'chunks',
          chunkId
        );
        await setDoc(chunkRef, {
          ownerId: userId,
          projectId,
          mediaId,
          index: i,
          data: chunks[i],
        });
      }

      savedAssetsCount += 1;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, mediaPath);
    }
  }

  return { projectId, savedAssetsCount, skippedLargeCount };
}

export async function loadCloudProjectWithMedia(
  userId: string,
  projectId: string
): Promise<{
  id: string;
  name: string;
  aspectRatio: AspectRatio;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  assets: MediaAsset[];
}> {
  const { db } = getFirebaseServices();
  const safeUid = sanitizeId(userId, 'user');
  const safePid = sanitizeId(projectId, 'proj');
  const projectPath = `users/${safeUid}/projects/${safePid}`;

  let projectData: Record<string, unknown>;
  try {
    const snap = await getDoc(doc(db, 'users', safeUid, 'projects', safePid));
    if (!snap.exists()) {
      throw new Error('المشروع غير موجود');
    }
    projectData = snap.data();
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, projectPath);
  }

  const mediaColPath = `${projectPath}/media`;
  const loadedAssets: MediaAsset[] = [];

  try {
    const mediaQuery = query(
      collection(db, 'users', safeUid, 'projects', safePid, 'media'),
      where('ownerId', '==', safeUid)
    );
    const mediaSnaps = await getDocs(mediaQuery);

    for (const mDoc of mediaSnaps.docs) {
      const m = mDoc.data();
      let srcUrl = '';

      if (typeof m.inlineDataUrl === 'string' && m.inlineDataUrl.length > 0) {
        srcUrl = m.inlineDataUrl;
      } else if (Number(m.chunkCount) > 0) {
        const chunkQuery = query(
          collection(db, 'users', safeUid, 'projects', safePid, 'media', mDoc.id, 'chunks'),
          where('ownerId', '==', safeUid),
          orderBy('index', 'asc')
        );
        const chunkSnaps = await getDocs(chunkQuery);
        const fullDataUrl = chunkSnaps.docs.map((c) => String(c.data().data || '')).join('');
        if (fullDataUrl) {
          const blob = await (await fetch(fullDataUrl)).blob();
          srcUrl = URL.createObjectURL(blob);
        }
      }

      if (!srcUrl) {
        const localBlob = await loadLargeBlobLocally(`${safeUid}/${safePid}/${mDoc.id}`);
        if (localBlob) {
          srcUrl = URL.createObjectURL(localBlob);
        }
      }

      if (!srcUrl && typeof m.thumbnail === 'string') {
        srcUrl = m.thumbnail;
      }

      loadedAssets.push({
        id: String(m.id || mDoc.id),
        name: String(m.name || 'media'),
        kind: m.kind,
        src: srcUrl,
        originalExt: String(m.originalExt || 'bin'),
        mimeType: String(m.mimeType || 'application/octet-stream'),
        duration: Number(m.duration) || 5,
        width: Number(m.width) || 1280,
        height: Number(m.height) || 720,
        thumbnail: typeof m.thumbnail === 'string' ? m.thumbnail : m.kind === 'image' ? srcUrl : undefined,
        waveform: Array.isArray(m.waveform) ? m.waveform : undefined,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, mediaColPath);
  }

  return {
    id: safePid,
    name: String(projectData.name || 'مشروع محفوظ'),
    aspectRatio: (projectData.aspectRatio as AspectRatio) || '16:9',
    tracks: Array.isArray(projectData.tracks) ? (projectData.tracks as TimelineTrack[]) : [],
    clips: Array.isArray(projectData.clips) ? (projectData.clips as TimelineClip[]) : [],
    assets: loadedAssets,
  };
}

export async function deleteCloudProject(userId: string, projectId: string): Promise<void> {
  const { db } = getFirebaseServices();
  const safeUid = sanitizeId(userId, 'user');
  const safePid = sanitizeId(projectId, 'proj');
  const projectPath = `users/${safeUid}/projects/${safePid}`;

  try {
    const mediaQuery = query(
      collection(db, 'users', safeUid, 'projects', safePid, 'media'),
      where('ownerId', '==', safeUid)
    );
    const mediaSnaps = await getDocs(mediaQuery);
    for (const mDoc of mediaSnaps.docs) {
      const chunksQuery = query(
        collection(db, 'users', safeUid, 'projects', safePid, 'media', mDoc.id, 'chunks'),
        where('ownerId', '==', safeUid)
      );
      const chunkSnaps = await getDocs(chunksQuery);
      for (const cDoc of chunkSnaps.docs) {
        await deleteDoc(cDoc.ref);
      }
      await deleteDoc(mDoc.ref);
    }
    await deleteDoc(doc(db, 'users', safeUid, 'projects', safePid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, projectPath);
  }
}
