'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  applyAudioCleanupToGraph,
  type LiveAudioNodes,
} from '@/lib/audio/noiseSuppressor';
import { renderCompositionFrame, type MediaElementCache } from '@/lib/editor/canvasRenderer';
import { buildDemoProject, INITIAL_TRACKS } from '@/lib/editor/demoProject';
import {
  DEFAULT_AUDIO_CLEANUP,
  DEFAULT_COLOR_ADJUSTMENTS,
  DEFAULT_TRANSFORM,
  FILTER_PRESET_VALUES,
  getExportDimensions,
  getProjectDuration,
  splitClipAtTime,
} from '@/lib/editor/timelineMath';
import { getTransitionById } from '@/lib/editor/transitions';
import type {
  AspectRatio,
  FilterPreset,
  MediaAsset,
  MediaKind,
  ShapeKind,
  TextAnimationType,
  TimelineClip,
  TimelineTrack,
  TransitionType,
} from '@/lib/editor/types';
import {
  completeEmailLinkSignInIfNeeded,
  getFirebaseServices,
  translateFirebaseAuthError,
} from '@/lib/firebase/client';
import {
  deleteCloudProject,
  loadCloudProjectWithMedia,
  saveCloudProject,
  subscribeUserProjects,
  upsertUserProfile,
  type CloudProjectSummary,
} from '@/lib/firebase/projectStore';
import AuthModal from '../auth/AuthModal';
import ProjectsDrawer from '../auth/ProjectsDrawer';
import AudioExtractModal from './AudioExtractModal';
import ExportModal from './ExportModal';
import LeftLibraryPanel, { type LibraryTab } from './LeftLibraryPanel';
import PreviewMonitor from './PreviewMonitor';
import RightInspectorPanel, { type InspectorTab } from './RightInspectorPanel';
import TimelinePanel from './TimelinePanel';
import TopToolbar from './TopToolbar';

function inferMediaKind(file: File): MediaKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif', 'heic', 'tiff', 'tif'].includes(ext)) {
    return 'image';
  }
  if (['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac', 'wma', 'opus', 'aiff'].includes(ext)) {
    return 'audio';
  }
  return 'video';
}

export default function VideoStudio() {
  const [projectId, setProjectId] = useState<string>('proj_default_main');
  const [projectName, setProjectName] = useState('مشروع_سينا_4K');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [tracks, setTracks] = useState<TimelineTrack[]>(INITIAL_TRACKS);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const [historyPast, setHistoryPast] = useState<TimelineClip[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<TimelineClip[][]>([]);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterMuted, setMasterMuted] = useState(false);
  const [bypassDenoise, setBypassDenoise] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const [libraryTab, setLibraryTab] = useState<LibraryTab>('transitions');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('general');
  const [zoomPxPerSec, setZoomPxPerSec] = useState(55);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [isTranscoding, setIsTranscoding] = useState(false);

  const [exportOpen, setExportOpen] = useState(false);
  const [audioExtractOpen, setAudioExtractOpen] = useState(false);
  const [audioExtractAssetId, setAudioExtractAssetId] = useState<string | null>(null);

  // Firebase Auth & Cloud Projects State
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [projectsDrawerOpen, setProjectsDrawerOpen] = useState(false);
  const [cloudProjects, setCloudProjects] = useState<CloudProjectSummary[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; kind: 'info' | 'error' } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const mediaCacheRef = useRef<MediaElementCache>({
    videos: new Map(),
    images: new Map(),
  });
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioGraphMapRef = useRef<Map<string, LiveAudioNodes>>(new Map());

  // Last applied audio-graph signature per asset, so we only rewrite AudioParams
  // when something actually changed instead of 60 times per second.
  const audioParamSigRef = useRef<Map<string, string>>(new Map());
  const analyserBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const clipsRef = useRef(clips);
  const tracksRef = useRef(tracks);
  const assetsMapRef = useRef<Map<string, MediaAsset>>(new Map());
  const currentTimeRef = useRef(currentTime);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const assetsMap = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const a of assets) map.set(a.id, a);
    return map;
  }, [assets]);

  useEffect(() => {
    assetsMapRef.current = assetsMap;
  }, [assetsMap]);

  const projectDuration = useMemo(() => Math.max(4, getProjectDuration(clips)), [clips]);

  const selectedClip = useMemo(
    () => clips.find((c) => c.id === selectedClipId) || null,
    [clips, selectedClipId]
  );

  const activeDenoiseCount = useMemo(
    () => clips.filter((c) => (c.kind === 'audio' || c.kind === 'video') && c.audio.denoiseEnabled).length,
    [clips]
  );

  const showToast = useCallback((text: string, kind: 'info' | 'error' = 'info') => {
    setToastMsg({ text, kind });
    window.setTimeout(() => {
      setToastMsg((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  }, []);

  // Applies a clip mutation and records a single undo step.
  // NOTE: this intentionally mutates state outside a functional updater so the
  // history entry is recorded exactly once (React StrictMode double-invokes
  // updater functions, which used to duplicate every undo step).
  const commitClipsChange = useCallback((updater: (prev: TimelineClip[]) => TimelineClip[]) => {
    const prev = clipsRef.current;
    const next = updater(prev);
    if (next === prev) return;
    clipsRef.current = next;
    setClips(next);
    setHistoryPast((h) => [...h.slice(-49), prev]);
    setHistoryFuture([]);
  }, []);

  // Initialize Firebase Auth listener & Email Link completion
  useEffect(() => {
    let unsubProjects: (() => void) | null = null;
    const { auth } = getFirebaseServices();

    completeEmailLinkSignInIfNeeded(() =>
      window.prompt('أدخل بريدك الإلكتروني لإكمال التحقق من الرابط:')
    )
      .then((signedInUser) => {
        if (signedInUser) {
          showToast('تم التحقق من البريد وتسجيل الدخول بنجاح!', 'info');
        }
      })
      .catch((err) => {
        showToast(translateFirebaseAuthError(err), 'error');
      });

    const unsubAuth = onAuthStateChanged(auth, (currentUser: User | null) => {
      setUser(currentUser);
      setAuthReady(true);

      if (unsubProjects) {
        unsubProjects();
        unsubProjects = null;
      }

      if (currentUser) {
        if (currentUser.emailVerified) {
          upsertUserProfile(currentUser).catch(() => {});
        }
        unsubProjects = subscribeUserProjects(
          currentUser.uid,
          (list) => setCloudProjects(list),
          () => {}
        );
      } else {
        setCloudProjects([]);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProjects) unsubProjects();
    };
  }, [showToast]);

  // Load demo project on mount asynchronously after hydration
  const demoLoadedRef = useRef(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active || demoLoadedRef.current) return;
      demoLoadedRef.current = true;
      const demo = buildDemoProject();
      setAssets(demo.assets);
      setClips(demo.clips);
      setSelectedClipId(demo.clips[0]?.id || null);
    });
    return () => {
      active = false;
    };
  }, []);

  // Preload HTMLImageElement / HTMLVideoElement / HTMLAudioElement for assets
  useEffect(() => {
    for (const asset of assets) {
      if (asset.kind === 'image' && !mediaCacheRef.current.images.has(asset.id)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = asset.src;
        img.onload = () => {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (canvas && ctx) {
            renderCompositionFrame(
              ctx,
              canvas.width,
              canvas.height,
              clipsRef.current,
              tracksRef.current,
              assetsMapRef.current,
              mediaCacheRef.current,
              currentTimeRef.current
            );
          }
        };
        mediaCacheRef.current.images.set(asset.id, img);
      } else if (asset.kind === 'video' && !mediaCacheRef.current.videos.has(asset.id)) {
        const vid = document.createElement('video');
        vid.crossOrigin = 'anonymous';
        vid.src = asset.src;
        vid.preload = 'auto';
        vid.playsInline = true;
        mediaCacheRef.current.videos.set(asset.id, vid);
      } else if (asset.kind === 'audio' && !audioElementsRef.current.has(asset.id)) {
        const aud = new Audio(asset.src);
        aud.crossOrigin = 'anonymous';
        aud.preload = 'auto';
        audioElementsRef.current.set(asset.id, aud);
      }
    }
  }, [assets]);

  // Save current project & media to Cloud Firestore
  const handleSaveCurrentProject = useCallback(async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!user.emailVerified) {
      showToast('يرجى توثيق بريدك الإلكتروني أولاً من نافذة المشاريع.', 'error');
      setProjectsDrawerOpen(true);
      return;
    }

    setSaveStatus('saving');
    try {
      let thumb: string | undefined;
      if (canvasRef.current) {
        try {
          thumb = canvasRef.current.toDataURL('image/jpeg', 0.45);
        } catch {
          thumb = undefined;
        }
      }
      const res = await saveCloudProject({
        user,
        projectId,
        name: projectName,
        aspectRatio,
        duration: projectDuration,
        tracks,
        clips,
        assets,
        thumbnail: thumb,
      });
      setSaveStatus('saved');
      if (res.skippedLargeCount > 0) {
        showToast(
          `تم حفظ المشروع (${res.savedAssetsCount} ملف وسائط). الملفات الكبيرة جداً محفوظة محلياً على هذا المتصفح.`,
          'info'
        );
      } else {
        showToast('تم حفظ المشروع وجميع الوسائط في حسابك بنجاح!', 'info');
      }
    } catch (err) {
      setSaveStatus('error');
      showToast(translateFirebaseAuthError(err), 'error');
    }
  }, [user, projectId, projectName, aspectRatio, projectDuration, tracks, clips, assets, showToast]);

  const handleLoadCloudProject = useCallback(
    async (targetProjectId: string) => {
      if (!user) return;
      setLoadingProjectId(targetProjectId);
      setIsPlaying(false);
      try {
        const loaded = await loadCloudProjectWithMedia(user.uid, targetProjectId);
        mediaCacheRef.current.images.clear();
        mediaCacheRef.current.videos.clear();
        audioElementsRef.current.clear();
        audioGraphMapRef.current.clear();
        audioParamSigRef.current.clear();
        currentTimeRef.current = 0;

        setProjectId(loaded.id);
        setProjectName(loaded.name);
        setAspectRatio(loaded.aspectRatio);
        setTracks(loaded.tracks.length > 0 ? loaded.tracks : INITIAL_TRACKS);
        setAssets(loaded.assets);
        setClips(loaded.clips);
        setSelectedClipId(loaded.clips[0]?.id || null);
        setCurrentTime(0);
        setHistoryPast([]);
        setHistoryFuture([]);
        setSaveStatus('saved');
        setProjectsDrawerOpen(false);
        showToast(`تم فتح مشروع «${loaded.name}» بنجاح`, 'info');
      } catch (err) {
        showToast(translateFirebaseAuthError(err), 'error');
      } finally {
        setLoadingProjectId(null);
      }
    },
    [user, showToast]
  );

  const handleCreateNewProject = useCallback(() => {
    const newId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setIsPlaying(false);
    setProjectId(newId);
    setProjectName(`مشروع_جديد_${cloudProjects.length + 1}`);
    setAspectRatio('16:9');
    setTracks(INITIAL_TRACKS);
    setAssets([]);
    setClips([]);
    setSelectedClipId(null);
    setCurrentTime(0);
    setHistoryPast([]);
    setHistoryFuture([]);
    setSaveStatus('idle');
    setProjectsDrawerOpen(false);
    showToast('تم إنشاء مشروع فارغ جديد', 'info');
  }, [cloudProjects.length, showToast]);

  const handleDeleteCloudProject = useCallback(
    async (targetId: string) => {
      if (!user) return;
      try {
        await deleteCloudProject(user.uid, targetId);
        showToast('تم حذف المشروع من السحابة', 'info');
      } catch (err) {
        showToast(translateFirebaseAuthError(err), 'error');
      }
    },
    [user, showToast]
  );

  // Ensure Web Audio API noise-removal graph exists for a media element
  const ensureAudioGraph = useCallback((assetId: string, element: HTMLMediaElement) => {
    if (audioGraphMapRef.current.has(assetId)) return audioGraphMapRef.current.get(assetId)!;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    const source = ctx.createMediaElementSource(element);
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    const humNotch = ctx.createBiquadFilter();
    humNotch.type = 'peaking';
    const voicePresence = ctx.createBiquadFilter();
    voicePresence.type = 'peaking';
    const compressor = ctx.createDynamicsCompressor();
    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(humNotch);
    humNotch.connect(voicePresence);
    voicePresence.connect(compressor);
    compressor.connect(gain);
    gain.connect(analyser);
    analyser.connect(ctx.destination);

    const nodes: LiveAudioNodes = {
      source,
      highpass,
      lowpass,
      humNotch,
      voicePresence,
      compressor,
      gain,
      analyser,
    };
    audioGraphMapRef.current.set(assetId, nodes);
    return nodes;
  }, []);

  // Resize canvas to crisp preview resolution ONLY when aspectRatio changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = getExportDimensions('720p', aspectRatio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      renderCompositionFrame(
        ctx,
        canvas.width,
        canvas.height,
        clipsRef.current,
        tracksRef.current,
        assetsMapRef.current,
        mediaCacheRef.current,
        currentTimeRef.current
      );
    }
  }, [aspectRatio]);

  // Sync audio & video elements and render canvas at currentTime.
  // Returns the media clock (real playback position of the master element) so the
  // playhead can follow the media instead of the wall clock — this is what keeps
  // preview and audio perfectly in sync without seek-thrashing.
  const syncMediaAndRender = useCallback(
    (time: number, playing: boolean): { peak: number; mediaClock: number | null; stalled: boolean } => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        renderCompositionFrame(
          ctx,
          canvas.width,
          canvas.height,
          clipsRef.current,
          tracksRef.current,
          assetsMapRef.current,
          mediaCacheRef.current,
          time
        );
      }

      const mutedTracks = new Set(tracksRef.current.filter((t) => t.muted).map((t) => t.id));
      const activeAudioOrVideoClips = clipsRef.current.filter(
        (c) =>
          (c.kind === 'audio' || c.kind === 'video') &&
          c.assetId &&
          time >= c.startTime &&
          time < c.startTime + c.duration
      );
      const activeAssetIds = new Set(activeAudioOrVideoClips.map((c) => c.assetId!));

      for (const [id, vid] of mediaCacheRef.current.videos.entries()) {
        if (!activeAssetIds.has(id) && !vid.paused) vid.pause();
      }
      for (const [id, aud] of audioElementsRef.current.entries()) {
        if (!activeAssetIds.has(id) && !aud.paused) aud.pause();
      }

      let peakLevel = 0;
      let mediaClock: number | null = null;
      let stalled = false;

      // A video element is the most accurate master clock; fall back to audio.
      const ordered = [...activeAudioOrVideoClips].sort((a, b) =>
        a.kind === b.kind ? 0 : a.kind === 'video' ? -1 : 1
      );

      for (const clip of ordered) {
        const assetId = clip.assetId!;
        const el: HTMLMediaElement | undefined =
          clip.kind === 'video'
            ? mediaCacheRef.current.videos.get(assetId)
            : audioElementsRef.current.get(assetId);
        if (!el) continue;

        const speed = clip.speed || 1;
        const targetTime = clip.trimStart + (time - clip.startTime) * speed;
        const knownDuration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
        const clampedTarget =
          knownDuration > 0
            ? Math.min(knownDuration - 0.03, Math.max(0, targetTime))
            : Math.max(0, targetTime);

        if (!playing) {
          // Paused / scrubbing: park the element exactly on the wanted frame.
          if (Math.abs(el.currentTime - clampedTarget) > 0.02) {
            try {
              el.currentTime = clampedTarget;
            } catch {
              /* element not ready yet */
            }
          }
          if (el.playbackRate !== speed) el.playbackRate = speed;
          if (!el.paused) el.pause();
          continue;
        }

        const drift = el.currentTime - clampedTarget;
        if (!el.seeking) {
          if (Math.abs(drift) > 0.6) {
            // Hard-seek only after a big desync (buffering, tab switch...)
            try {
              el.currentTime = clampedTarget;
            } catch {
              /* ignore */
            }
            el.playbackRate = speed;
          } else if (Math.abs(drift) > 0.08) {
            // Gently converge (±6%) instead of seeking, so playback never cuts.
            el.playbackRate = speed * (drift > 0 ? 0.94 : 1.06);
          } else if (el.playbackRate !== speed) {
            el.playbackRate = speed;
          }
        }

        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }

        const trackMuted = mutedTracks.has(clip.trackId) || masterMuted;
        try {
          const nodes = ensureAudioGraph(assetId, el);
          const a = clip.audio;
          const sig = [
            trackMuted ? 1 : 0,
            bypassDenoise ? 1 : 0,
            a.muted ? 1 : 0,
            a.volume,
            a.denoiseEnabled ? 1 : 0,
            a.denoisePreset,
            a.denoiseStrength,
            a.windCutHz,
            a.hissCutHz,
            a.voiceBoost,
            a.normalize ? 1 : 0,
          ].join('|');
          if (audioParamSigRef.current.get(assetId) !== sig) {
            applyAudioCleanupToGraph(nodes, a, trackMuted, bypassDenoise);
            audioParamSigRef.current.set(assetId, sig);
          }

          if (
            !analyserBufferRef.current ||
            analyserBufferRef.current.length !== nodes.analyser.frequencyBinCount
          ) {
            analyserBufferRef.current = new Uint8Array(nodes.analyser.frequencyBinCount);
          }
          const data = analyserBufferRef.current;
          nodes.analyser.getByteTimeDomainData(data);
          let maxDev = 0;
          for (let i = 0; i < data.length; i++) {
            const dev = Math.abs(data[i] - 128) / 128;
            if (dev > maxDev) maxDev = dev;
          }
          peakLevel = Math.max(peakLevel, maxDev * 140);
        } catch {
          el.muted = trackMuted || clip.audio.muted;
          el.volume = Math.min(1, clip.audio.volume);
        }

        // Never call play() on a finished element: browsers would restart it
        // from 0, which looked like the clip suddenly jumping back to the start.
        if (el.paused && !el.ended) {
          el.play().catch(() => {});
        }

        if (mediaClock === null && !stalled) {
          if (el.ended) {
            // Clip is longer than its media file: freeze the frame, keep the
            // timeline running on the wall clock.
          } else if (el.seeking || el.readyState < 2) {
            stalled = true;
          } else {
            mediaClock = clip.startTime + (el.currentTime - clip.trimStart) / speed;
          }
        }
      }

      return { peak: Math.min(100, Math.round(peakLevel)), mediaClock, stalled };
    },
    [bypassDenoise, ensureAudioGraph, masterMuted]
  );

  // Playback loop.
  // - The canvas is redrawn on every animation frame (smooth 60fps preview).
  // - The playhead follows the media element's real position when a clip is
  //   playing, so audio/video can never drift apart or "jump".
  // - React state is only updated ~30 times/sec, which keeps the whole editor
  //   (timeline, inspector, library) from re-rendering 60 times/sec.
  useEffect(() => {
    if (!isPlaying) return;

    let rafId = 0;
    let anchorTime = currentTimeRef.current;
    let anchorWall = performance.now();
    let lastUiPush = 0;

    const tick = (now: number) => {
      let next = anchorTime + (now - anchorWall) / 1000;

      if (next >= projectDuration) {
        // Stop at the end and stay there — do not jump back to 0.
        currentTimeRef.current = projectDuration;
        setCurrentTime(projectDuration);
        setAudioLevel(0);
        setIsPlaying(false);
        syncMediaAndRender(projectDuration, false);
        return;
      }

      const result = syncMediaAndRender(next, true);

      if (result.mediaClock !== null) {
        next = Math.max(0, Math.min(projectDuration, result.mediaClock));
        anchorTime = next;
        anchorWall = now;
      } else if (result.stalled) {
        // Media is buffering: hold the playhead instead of running ahead of it.
        next = currentTimeRef.current;
        anchorTime = next;
        anchorWall = now;
      }

      currentTimeRef.current = next;
      if (now - lastUiPush >= 33) {
        lastUiPush = now;
        setCurrentTime(next);
        setAudioLevel(result.peak);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, projectDuration, syncMediaAndRender]);

  // Re-render when paused or when inspector properties change
  useEffect(() => {
    if (!isPlaying) {
      syncMediaAndRender(currentTime, false);
    }
  }, [clips, tracks, currentTime, isPlaying, syncMediaAndRender]);

  const handleTogglePlay = useCallback(() => {
    // Play again from the beginning when the playhead is sitting on the end.
    if (!isPlayingRef.current && currentTimeRef.current >= projectDuration - 0.05) {
      currentTimeRef.current = 0;
      setCurrentTime(0);
    }
    // Unlock Web Audio on the user gesture so the preview is never silent.
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    setIsPlaying((p) => !p);
  }, [projectDuration]);

  // Import ANY media format (browser-native fast path + optional server transcode fallback)
  const handleImportFiles = useCallback(
    async (filesInput: FileList | File[]) => {
      const fileList = Array.from(filesInput);
      if (fileList.length === 0) return;

      for (const file of fileList) {
        const kind = inferMediaKind(file);
        const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
        const nativeUrl = URL.createObjectURL(file);

        const tryNativeProbe = (): Promise<{
          ok: boolean;
          duration: number;
          width: number;
          height: number;
          thumbnail?: string;
        }> =>
          new Promise((resolve) => {
            if (kind === 'image') {
              const img = new Image();
              img.onload = () =>
                resolve({
                  ok: true,
                  duration: 5,
                  width: img.naturalWidth || 1920,
                  height: img.naturalHeight || 1080,
                  thumbnail: nativeUrl,
                });
              img.onerror = () => resolve({ ok: false, duration: 5, width: 1920, height: 1080 });
              img.src = nativeUrl;
            } else if (kind === 'audio') {
              const aud = new Audio();
              aud.onloadedmetadata = () =>
                resolve({
                  ok: true,
                  duration: Number.isFinite(aud.duration) ? aud.duration : 10,
                  width: 0,
                  height: 0,
                });
              aud.onerror = () => resolve({ ok: false, duration: 10, width: 0, height: 0 });
              aud.src = nativeUrl;
            } else {
              const vid = document.createElement('video');
              vid.preload = 'metadata';
              vid.onloadedmetadata = () => {
                resolve({
                  ok: true,
                  duration: Number.isFinite(vid.duration) ? vid.duration : 6,
                  width: vid.videoWidth || 1920,
                  height: vid.videoHeight || 1080,
                });
              };
              vid.onerror = () => resolve({ ok: false, duration: 6, width: 1920, height: 1080 });
              vid.src = nativeUrl;
            }
          });

        const probed = await tryNativeProbe();
        let finalSrc = nativeUrl;
        let finalDuration = probed.duration;
        let finalW = probed.width;
        let finalH = probed.height;
        let transcodedFrom: string | undefined;

        if (!probed.ok) {
          setIsTranscoding(true);
          try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('kind', kind);
            const resp = await fetch('/api/media/transcode', { method: 'POST', body: fd });
            if (resp.ok) {
              const blob = await resp.blob();
              URL.revokeObjectURL(nativeUrl);
              finalSrc = URL.createObjectURL(blob);
              finalDuration = Number(resp.headers.get('X-Media-Duration')) || 6;
              finalW = Number(resp.headers.get('X-Media-Width')) || 1920;
              finalH = Number(resp.headers.get('X-Media-Height')) || 1080;
              transcodedFrom = ext.toUpperCase();
            } else {
              showToast(
                `صيغة (${ext.toUpperCase()}) غير مدعومة مباشرة في المتصفح الحالي — جرب MP4/WebM/PNG/JPG/MP3/WAV.`,
                'error'
              );
              continue;
            }
          } finally {
            setIsTranscoding(false);
          }
        }

        const newAsset: MediaAsset = {
          id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          kind,
          src: finalSrc,
          originalExt: ext,
          mimeType: file.type || `${kind}/${ext}`,
          duration: Math.max(1, Number(finalDuration.toFixed(2))),
          width: finalW,
          height: finalH,
          thumbnail: kind === 'image' ? finalSrc : undefined,
          waveform:
            kind === 'audio'
              ? Array.from({ length: 48 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 0.65)) * 0.7)
              : undefined,
          transcodedFrom,
          rawFile: file,
        };

        setAssets((prev) => [newAsset, ...prev]);
        setSaveStatus('idle');
      }
    },
    [showToast]
  );

  const handleAddAssetToTimeline = useCallback(
    (asset: MediaAsset) => {
      const targetTrackId = asset.kind === 'audio' ? 'track-a1' : 'track-v1';

      const trackClips = clips.filter((c) => c.trackId === targetTrackId);
      const endOfTrack = trackClips.reduce(
        (max, c) => Math.max(max, c.startTime + c.duration),
        0
      );

      const newClip: TimelineClip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        trackId: targetTrackId,
        kind: asset.kind,
        name: asset.name.replace(/\.[^.]+$/, ''),
        assetId: asset.id,
        startTime: Number(endOfTrack.toFixed(2)),
        // Use the real media duration (images default to 5s) instead of
        // silently cutting every imported clip down to 12 seconds.
        duration: Number(Math.max(0.5, asset.duration || 5).toFixed(2)),
        trimStart: 0,
        speed: 1,
        inTransition: { type: 'crossfade', duration: 0.7, easing: 'easeInOut' },
        outTransition: { type: 'none', duration: 0.7, easing: 'easeInOut' },
        color: { ...DEFAULT_COLOR_ADJUSTMENTS },
        transform: { ...DEFAULT_TRANSFORM },
        audio: { ...DEFAULT_AUDIO_CLEANUP },
        accentColor:
          asset.kind === 'audio' ? '#06B6D4' : asset.kind === 'image' ? '#10B981' : '#F59E0B',
      };

      commitClipsChange((prev) => [...prev, newClip]);
      setSelectedClipId(newClip.id);
      setCurrentTime(newClip.startTime);
      setSaveStatus('idle');
    },
    [clips, commitClipsChange]
  );

  const handleApplyTransition = useCallback(
    (type: TransitionType, target: 'in' | 'out') => {
      const def = getTransitionById(type);
      const dur = def?.defaultDuration ?? 0.8;
      const targetClip =
        clips.find((c) => c.id === selectedClipId) ||
        clips.find((c) => c.kind === 'video' || c.kind === 'image');
      if (!targetClip) return;

      commitClipsChange((prev) =>
        prev.map((c) => {
          if (c.id !== targetClip.id) return c;
          if (target === 'in') {
            return { ...c, inTransition: { ...c.inTransition, type, duration: dur } };
          }
          return { ...c, outTransition: { ...c.outTransition, type, duration: dur } };
        })
      );
      setSelectedClipId(targetClip.id);
      setSaveStatus('idle');

      if (target === 'in') {
        setCurrentTime(targetClip.startTime + dur * 0.48);
      } else {
        setCurrentTime(Math.max(0, targetClip.startTime + targetClip.duration - dur * 0.48));
      }
    },
    [clips, selectedClipId, commitClipsChange]
  );

  const handleAddTextClip = useCallback(
    (preset: {
      name: string;
      content: string;
      animation: TextAnimationType;
      fontSize: number;
      color: string;
      bgOpacity: number;
    }) => {
      const newClip: TimelineClip = {
        id: `clip_txt_${Date.now()}`,
        trackId: 'track-t1',
        kind: 'text',
        name: preset.name,
        startTime: Number(currentTime.toFixed(2)),
        duration: 4.0,
        trimStart: 0,
        speed: 1,
        inTransition: { type: 'none', duration: 0.5, easing: 'easeInOut' },
        outTransition: { type: 'none', duration: 0.5, easing: 'easeInOut' },
        color: { ...DEFAULT_COLOR_ADJUSTMENTS },
        transform: { ...DEFAULT_TRANSFORM },
        audio: { ...DEFAULT_AUDIO_CLEANUP },
        text: {
          content: preset.content,
          fontFamily: 'Cairo',
          fontSize: preset.fontSize,
          color: preset.color,
          strokeColor: '#000000',
          strokeWidth: 0,
          bgColor: '#0F172A',
          bgOpacity: preset.bgOpacity,
          align: 'center',
          bold: true,
          shadow: true,
          animation: preset.animation,
          letterSpacing: 0,
        },
        accentColor: '#EC4899',
      };
      commitClipsChange((prev) => [...prev, newClip]);
      setSelectedClipId(newClip.id);
      setInspectorTab('general');
      setSaveStatus('idle');
    },
    [currentTime, commitClipsChange]
  );

  const handleAddShapeClip = useCallback(
    (preset: {
      name: string;
      shapeType: ShapeKind;
      fillColor: string;
      fillSecondary: string;
      strokeColor: string;
      width: number;
      height: number;
      labelText?: string;
    }) => {
      const newClip: TimelineClip = {
        id: `clip_shp_${Date.now()}`,
        trackId: 'track-s1',
        kind: 'shape',
        name: preset.name,
        startTime: Number(currentTime.toFixed(2)),
        duration: 4.0,
        trimStart: 0,
        speed: 1,
        inTransition: { type: 'none', duration: 0.5, easing: 'easeInOut' },
        outTransition: { type: 'none', duration: 0.5, easing: 'easeInOut' },
        color: { ...DEFAULT_COLOR_ADJUSTMENTS },
        transform: { ...DEFAULT_TRANSFORM },
        audio: { ...DEFAULT_AUDIO_CLEANUP },
        shape: {
          shapeType: preset.shapeType,
          fillColor: preset.fillColor,
          fillSecondary: preset.fillSecondary,
          useGradient: true,
          strokeColor: preset.strokeColor,
          strokeWidth: 3,
          cornerRadius: 14,
          width: preset.width,
          height: preset.height,
          animation: 'scale_pop',
          shadow: true,
          labelText: preset.labelText,
        },
        accentColor: '#8B5CF6',
      };
      commitClipsChange((prev) => [...prev, newClip]);
      setSelectedClipId(newClip.id);
      setInspectorTab('general');
      setSaveStatus('idle');
    },
    [currentTime, commitClipsChange]
  );

  const handleApplyFilterPreset = useCallback(
    (preset: FilterPreset) => {
      const targetClip =
        clips.find((c) => c.id === selectedClipId && c.kind !== 'audio') ||
        clips.find((c) => c.kind === 'video' || c.kind === 'image');
      if (!targetClip) return;
      const presetVals = FILTER_PRESET_VALUES[preset];
      commitClipsChange((prev) =>
        prev.map((c) =>
          c.id === targetClip.id
            ? { ...c, color: { ...c.color, ...presetVals, preset } }
            : c
        )
      );
      setSelectedClipId(targetClip.id);
      setSaveStatus('idle');
    },
    [clips, selectedClipId, commitClipsChange]
  );

  const handleSplitAtPlayhead = useCallback(() => {
    if (!selectedClipId) return;
    commitClipsChange((prev) => splitClipAtTime(prev, selectedClipId, currentTime));
    setSaveStatus('idle');
  }, [selectedClipId, currentTime, commitClipsChange]);

  const handleDuplicateSelected = useCallback(() => {
    const clip = clips.find((c) => c.id === selectedClipId);
    if (!clip) return;
    const copy: TimelineClip = {
      ...clip,
      id: `${clip.id}_copy_${Date.now().toString().slice(-4)}`,
      name: `${clip.name} (نسخة)`,
      startTime: Number((clip.startTime + clip.duration).toFixed(2)),
    };
    commitClipsChange((prev) => [...prev, copy]);
    setSelectedClipId(copy.id);
    setSaveStatus('idle');
  }, [clips, selectedClipId, commitClipsChange]);

  const handleDeleteClip = useCallback(
    (clipId: string) => {
      commitClipsChange((prev) => prev.filter((c) => c.id !== clipId));
      if (selectedClipId === clipId) setSelectedClipId(null);
      setSaveStatus('idle');
    },
    [selectedClipId, commitClipsChange]
  );

  const handleUndo = useCallback(() => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    const current = clipsRef.current;
    clipsRef.current = previous;
    setClips(previous);
    setHistoryPast((h) => h.slice(0, -1));
    setHistoryFuture((f) => [current, ...f]);
    setSaveStatus('idle');
  }, [historyPast]);

  const handleRedo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    const current = clipsRef.current;
    clipsRef.current = next;
    setClips(next);
    setHistoryFuture((f) => f.slice(1));
    setHistoryPast((p) => [...p, current]);
    setSaveStatus('idle');
  }, [historyFuture]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime((t) => Math.max(0, t - 1 / 30));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime((t) => Math.min(projectDuration, t + 1 / 30));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [projectDuration, handleTogglePlay, handleUndo, handleRedo]);

  const canSplit = Boolean(
    selectedClip &&
      currentTime > selectedClip.startTime + 0.25 &&
      currentTime < selectedClip.startTime + selectedClip.duration - 0.25
  );

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      data-testid="video-studio-root"
      data-playing={String(isPlaying)}
      data-clip-count={clips.length}
      className="h-screen w-screen overflow-hidden bg-[#0A0D12] text-slate-100 flex flex-col relative"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) {
            handleImportFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      <TopToolbar
        projectName={projectName}
        onProjectNameChange={(name) => {
          setProjectName(name);
          setSaveStatus('idle');
        }}
        aspectRatio={aspectRatio}
        onImportClick={() => fileInputRef.current?.click()}
        onSplitClick={handleSplitAtPlayhead}
        canSplit={canSplit}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyPast.length > 0}
        canRedo={historyFuture.length > 0}
        onOpenAudioExtract={() => {
          setAudioExtractAssetId(null);
          setAudioExtractOpen(true);
        }}
        onOpenExport={() => {
          setIsPlaying(false);
          setExportOpen(true);
        }}
        isTranscoding={isTranscoding}
        user={user}
        authReady={authReady}
        saveStatus={saveStatus}
        onSaveProject={handleSaveCurrentProject}
        onOpenProjects={() => setProjectsDrawerOpen(true)}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {toastMsg && (
        <div
          role="status"
          className={`fixed bottom-4 left-4 z-50 px-4 py-2.5 rounded-lg border text-xs font-medium shadow-xl max-w-sm ${
            toastMsg.kind === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-100'
              : 'bg-[#141B26]/95 border-amber-400/40 text-amber-100'
          }`}
        >
          {toastMsg.text}
        </div>
      )}

      {/* Middle Workspace: Left Library + Center Monitor + Right Inspector */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <LeftLibraryPanel
          activeTab={libraryTab}
          onTabChange={setLibraryTab}
          assets={assets}
          onImportFiles={handleImportFiles}
          onAddAssetToTimeline={handleAddAssetToTimeline}
          onExtractAudioFromAsset={(asset) => {
            setAudioExtractAssetId(asset.id);
            setAudioExtractOpen(true);
          }}
          onApplyTransition={handleApplyTransition}
          selectedTransitionIn={selectedClip?.inTransition.type ?? 'none'}
          selectedTransitionOut={selectedClip?.outTransition.type ?? 'none'}
          onAddTextClip={handleAddTextClip}
          onAddShapeClip={handleAddShapeClip}
          onApplyFilterPreset={handleApplyFilterPreset}
          activeFilterPreset={selectedClip?.color.preset ?? 'none'}
          isTranscoding={isTranscoding}
        />

        <PreviewMonitor
          canvasRef={canvasRef}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onSeekStart={() => {
            setIsPlaying(false);
            currentTimeRef.current = 0;
            setCurrentTime(0);
          }}
          onStepFrame={(dir) => {
            setIsPlaying(false);
            setCurrentTime((t) => Math.max(0, Math.min(projectDuration, t + dir * (1 / 30))));
          }}
          currentTime={currentTime}
          duration={projectDuration}
          aspectRatio={aspectRatio}
          onAspectRatioChange={(r) => {
            setAspectRatio(r);
            setSaveStatus('idle');
          }}
          masterMuted={masterMuted}
          onToggleMasterMute={() => setMasterMuted((m) => !m)}
          audioLevel={isPlaying ? audioLevel : 0}
          activeDenoiseCount={activeDenoiseCount}
        />

        <RightInspectorPanel
          clip={selectedClip}
          activeTab={inspectorTab}
          onTabChange={setInspectorTab}
          onUpdateClip={(clipId, updater) => {
            setClips((prev) => prev.map((c) => (c.id === clipId ? updater(c) : c)));
            setSaveStatus('idle');
          }}
          onDeleteClip={handleDeleteClip}
          bypassDenoise={bypassDenoise}
          onToggleBypassDenoise={() => setBypassDenoise((b) => !b)}
        />
      </div>

      <TimelinePanel
        tracks={tracks}
        clips={clips}
        assets={assetsMap}
        selectedClipId={selectedClipId}
        currentTime={currentTime}
        projectDuration={projectDuration}
        zoomPxPerSec={zoomPxPerSec}
        snapEnabled={snapEnabled}
        onSelectClip={setSelectedClipId}
        onSeek={(t) => {
          setIsPlaying(false);
          const clamped = Math.max(0, Math.min(projectDuration, t));
          currentTimeRef.current = clamped;
          setCurrentTime(clamped);
        }}
        onMoveClip={(clipId, newStart) => {
          setClips((prev) =>
            prev.map((c) => (c.id === clipId ? { ...c, startTime: newStart } : c))
          );
          setSaveStatus('idle');
        }}
        onTrimClip={(clipId, newStart, newDuration, newTrim) => {
          setClips((prev) =>
            prev.map((c) =>
              c.id === clipId
                ? { ...c, startTime: newStart, duration: newDuration, trimStart: newTrim }
                : c
            )
          );
          setSaveStatus('idle');
        }}
        onSplitAtPlayhead={handleSplitAtPlayhead}
        onDuplicateSelected={handleDuplicateSelected}
        onDeleteSelected={() => {
          if (selectedClipId) handleDeleteClip(selectedClipId);
        }}
        onToggleTrackMute={(trackId) =>
          setTracks((prev) =>
            prev.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t))
          )
        }
        onToggleTrackHidden={(trackId) =>
          setTracks((prev) =>
            prev.map((t) => (t.id === trackId ? { ...t, hidden: !t.hidden } : t))
          )
        }
        onToggleTrackLock={(trackId) =>
          setTracks((prev) =>
            prev.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t))
          )
        }
        onToggleSnap={() => setSnapEnabled((s) => !s)}
        onZoomChange={setZoomPxPerSec}
      />

      {exportOpen && (
        <ExportModal
          isOpen={exportOpen}
          onClose={() => setExportOpen(false)}
          projectName={projectName}
          aspectRatio={aspectRatio}
          clips={clips}
          tracks={tracks}
          assets={assetsMap}
          getMediaCache={() => mediaCacheRef.current}
          projectDuration={projectDuration}
        />
      )}

      {audioExtractOpen && (
        <AudioExtractModal
          isOpen={audioExtractOpen}
          onClose={() => setAudioExtractOpen(false)}
          assets={assets}
          initialAssetId={audioExtractAssetId}
          clips={clips}
          tracks={tracks}
          assetsMap={assetsMap}
          projectDuration={projectDuration}
        />
      )}

      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => showToast('تم تسجيل الدخول بنجاح! يمكنك الآن حفظ مشاريعك سحابياً.', 'info')}
        />
      )}

      {projectsDrawerOpen && (
        <ProjectsDrawer
          isOpen={projectsDrawerOpen}
          onClose={() => setProjectsDrawerOpen(false)}
          user={user}
          projects={cloudProjects}
          activeProjectId={projectId}
          isSaving={saveStatus === 'saving'}
          loadingProjectId={loadingProjectId}
          onOpenAuth={() => setAuthModalOpen(true)}
          onSaveCurrent={handleSaveCurrentProject}
          onCreateNewProject={handleCreateNewProject}
          onLoadProject={handleLoadCloudProject}
          onDeleteProject={handleDeleteCloudProject}
        />
      )}
    </motion.main>
  );
}
