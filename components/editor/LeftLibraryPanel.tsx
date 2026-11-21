'use client';

import React, { useMemo, useState } from 'react';
import {
  AudioLines,
  Film,
  Image as ImageIcon,
  Layers,
  Music,
  Palette,
  Plus,
  Search,
  Shapes,
  Sparkles,
  Type,
  Upload,
} from 'lucide-react';
import {
  TRANSITIONS,
  TRANSITION_CATEGORY_LABELS,
} from '@/lib/editor/transitions';
import { formatShortDuration } from '@/lib/editor/timelineMath';
import type {
  FilterPreset,
  MediaAsset,
  ShapeKind,
  TextAnimationType,
  TransitionCategory,
  TransitionType,
} from '@/lib/editor/types';

export type LibraryTab = 'media' | 'transitions' | 'text' | 'shapes' | 'filters';

interface LeftLibraryPanelProps {
  activeTab: LibraryTab;
  onTabChange: (tab: LibraryTab) => void;
  assets: MediaAsset[];
  onImportFiles: (files: FileList | File[]) => void;
  onAddAssetToTimeline: (asset: MediaAsset) => void;
  onExtractAudioFromAsset: (asset: MediaAsset) => void;
  onApplyTransition: (type: TransitionType, target: 'in' | 'out') => void;
  selectedTransitionIn: TransitionType;
  selectedTransitionOut: TransitionType;
  onAddTextClip: (preset: {
    name: string;
    content: string;
    animation: TextAnimationType;
    fontSize: number;
    color: string;
    bgOpacity: number;
  }) => void;
  onAddShapeClip: (preset: {
    name: string;
    shapeType: ShapeKind;
    fillColor: string;
    fillSecondary: string;
    strokeColor: string;
    width: number;
    height: number;
    labelText?: string;
  }) => void;
  onApplyFilterPreset: (preset: FilterPreset) => void;
  activeFilterPreset: FilterPreset;
  isTranscoding: boolean;
}

const TEXT_PRESETS: Array<{
  name: string;
  content: string;
  animation: TextAnimationType;
  fontSize: number;
  color: string;
  bgOpacity: number;
}> = [
  {
    name: 'عنوان سينمائي بارز',
    content: 'لحظات لا تُنسى',
    animation: 'fade_rise',
    fontSize: 56,
    color: '#FFFFFF',
    bgOpacity: 0,
  },
  {
    name: 'كتابة آلية متدرجة',
    content: 'التفاصيل تصنع الفارق',
    animation: 'typewriter',
    fontSize: 44,
    color: '#FDE68A',
    bgOpacity: 0.55,
  },
  {
    name: 'دخول ارتدادي حيوي',
    content: 'اشترك الآن',
    animation: 'pop_bounce',
    fontSize: 48,
    color: '#38BDF8',
    bgOpacity: 0.7,
  },
  {
    name: 'عنوان حركي سريع',
    content: 'مشهد حصري 4K',
    animation: 'slide_kinetic',
    fontSize: 50,
    color: '#FFFFFF',
    bgOpacity: 0.65,
  },
  {
    name: 'توهج نيون ليلي',
    content: 'استوديو الإبداع',
    animation: 'neon_pulse',
    fontSize: 52,
    color: '#22D3EE',
    bgOpacity: 0,
  },
  {
    name: 'تشويش رقمي Glitch',
    content: 'بث مباشر',
    animation: 'glitch_reveal',
    fontSize: 46,
    color: '#FB7185',
    bgOpacity: 0.5,
  },
];

const SHAPE_PRESETS: Array<{
  name: string;
  shapeType: ShapeKind;
  fillColor: string;
  fillSecondary: string;
  strokeColor: string;
  width: number;
  height: number;
  labelText?: string;
}> = [
  {
    name: 'شريط سفلي احترافي',
    shapeType: 'lower_third',
    fillColor: '#0F172A',
    fillSecondary: '#1E293B',
    strokeColor: '#F59E0B',
    width: 55,
    height: 15,
  },
  {
    name: 'بطاقة بزوايا ناعمة',
    shapeType: 'rounded',
    fillColor: '#1E293B',
    fillSecondary: '#0F172A',
    strokeColor: '#38BDF8',
    width: 38,
    height: 22,
  },
  {
    name: 'إطار شارة مضيء',
    shapeType: 'badge_frame',
    fillColor: '#0F172A',
    fillSecondary: '#0F172A',
    strokeColor: '#F59E0B',
    width: 28,
    height: 12,
    labelText: 'جديد 4K',
  },
  {
    name: 'دائرة تركيز',
    shapeType: 'circle',
    fillColor: '#F59E0B',
    fillSecondary: '#EA580C',
    strokeColor: '#FFFFFF',
    width: 22,
    height: 36,
  },
  {
    name: 'حلقة مؤشر',
    shapeType: 'ring',
    fillColor: 'transparent',
    fillSecondary: 'transparent',
    strokeColor: '#22D3EE',
    width: 24,
    height: 38,
  },
  {
    name: 'فقاعة تنبيه',
    shapeType: 'callout',
    fillColor: '#0284C7',
    fillSecondary: '#0369A1',
    strokeColor: '#BAE6FD',
    width: 34,
    height: 22,
    labelText: 'ملاحظة مهمة',
  },
  {
    name: 'سهم توجيه',
    shapeType: 'arrow',
    fillColor: '#F59E0B',
    fillSecondary: '#D97706',
    strokeColor: '#FEF3C7',
    width: 24,
    height: 16,
  },
  {
    name: 'نجمة تمييز',
    shapeType: 'star',
    fillColor: '#FBBF24',
    fillSecondary: '#F59E0B',
    strokeColor: '#FFFFFF',
    width: 18,
    height: 30,
  },
  {
    name: 'مثلث هندسي',
    shapeType: 'triangle',
    fillColor: '#10B981',
    fillSecondary: '#059669',
    strokeColor: '#D1FAE5',
    width: 20,
    height: 30,
  },
];

const FILTER_PRESETS: Array<{ id: FilterPreset; label: string; swatch: string }> = [
  { id: 'none', label: 'أصلي بدون فلتر', swatch: 'from-slate-600 to-slate-800' },
  { id: 'cinematic_teal', label: 'سينمائي تيل-برتقالي', swatch: 'from-cyan-700 to-amber-700' },
  { id: 'golden_hour', label: 'الساعة الذهبية', swatch: 'from-amber-500 to-orange-800' },
  { id: 'noir_bw', label: 'أبيض وأسود نوار', swatch: 'from-neutral-200 to-neutral-900' },
  { id: 'vintage_warm', label: 'كلاسيكي دافئ', swatch: 'from-yellow-700 to-stone-800' },
  { id: 'cyber_vivid', label: 'ألوان فائقة التشبع', swatch: 'from-sky-500 to-rose-600' },
  { id: 'soft_pastel', label: 'ناعم هادئ', swatch: 'from-stone-300 to-slate-500' },
  { id: 'vhs_retro', label: 'تأثير VHS قديم', swatch: 'from-rose-700 to-slate-900' },
];

export default function LeftLibraryPanel({
  activeTab,
  onTabChange,
  assets,
  onImportFiles,
  onAddAssetToTimeline,
  onExtractAudioFromAsset,
  onApplyTransition,
  selectedTransitionIn,
  selectedTransitionOut,
  onAddTextClip,
  onAddShapeClip,
  onApplyFilterPreset,
  activeFilterPreset,
  isTranscoding,
}: LeftLibraryPanelProps) {
  const [transitionSearch, setTransitionSearch] = useState('');
  const [transitionCategory, setTransitionCategory] = useState<TransitionCategory | 'all'>('all');
  const [transitionTarget, setTransitionTarget] = useState<'in' | 'out'>('in');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const filteredTransitions = useMemo(() => {
    const q = transitionSearch.trim().toLowerCase();
    return TRANSITIONS.filter((t) => {
      if (transitionCategory !== 'all' && t.category !== transitionCategory) return false;
      if (!q) return true;
      return (
        t.nameAr.toLowerCase().includes(q) ||
        t.nameEn.toLowerCase().includes(q) ||
        t.descriptionAr.toLowerCase().includes(q)
      );
    });
  }, [transitionSearch, transitionCategory]);

  const tabs: Array<{ id: LibraryTab; label: string; icon: React.ReactNode }> = [
    { id: 'media', label: 'الوسائط', icon: <Layers className="w-4 h-4" /> },
    { id: 'transitions', label: 'الانتقالات', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'text', label: 'النصوص', icon: <Type className="w-4 h-4" /> },
    { id: 'shapes', label: 'الأشكال', icon: <Shapes className="w-4 h-4" /> },
    { id: 'filters', label: 'الفلاتر', icon: <Palette className="w-4 h-4" /> },
  ];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files?.length) {
      onImportFiles(e.dataTransfer.files);
    }
  };

  return (
    <aside className="w-full lg:w-80 xl:w-[340px] shrink-0 bg-[#10141D] border-l border-white/10 flex flex-col min-h-0">
      {/* Tab Bar */}
      <div
        role="tablist"
        aria-label="مكتبة الأدوات"
        className="grid grid-cols-5 border-b border-white/10 bg-[#0D1017] shrink-0"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-amber-400 text-amber-300 bg-[#151B26]'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#131822]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {activeTab === 'media' && (
          <>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-1.5 p-4 border border-dashed rounded-lg cursor-pointer transition-colors text-center ${
                isDraggingOver
                  ? 'border-amber-400 bg-amber-500/10'
                  : 'border-white/15 bg-[#151B26] hover:border-amber-400/50 hover:bg-[#19202E]'
              }`}
            >
              <Upload className="w-5 h-5 text-amber-400" aria-hidden="true" />
              <span className="text-xs font-semibold text-slate-100">
                {isTranscoding ? 'جاري معالجة وتحويل الصيغة...' : 'اسحب أو اختر أي فيديو، صورة، أو صوت'}
              </span>
              <span className="text-[11px] text-slate-400">
                MP4 · MOV · MKV · AVI · PNG · JPG · WEBP · MP3 · WAV · FLAC
              </span>
              <input
                type="file"
                multiple
                accept="*/*"
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    onImportFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-0.5">
                <span>ملفات المشروع</span>
                <span className="font-mono">{assets.length}</span>
              </div>

              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="group flex items-center gap-2.5 p-2 rounded-md bg-[#161C27] border border-white/8 hover:border-white/20 transition-colors"
                >
                  <div className="w-16 h-11 rounded bg-[#0A0D12] overflow-hidden shrink-0 flex items-center justify-center border border-white/10">
                    {asset.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.thumbnail}
                        alt={asset.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : asset.kind === 'video' ? (
                      <Film className="w-5 h-5 text-amber-400" aria-hidden="true" />
                    ) : asset.kind === 'audio' ? (
                      <Music className="w-5 h-5 text-cyan-400" aria-hidden="true" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-100 truncate">{asset.name}</p>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                      {asset.originalExt.toUpperCase()} · {formatShortDuration(asset.duration)}
                      {asset.width > 0 ? ` · ${asset.width}×${asset.height}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {(asset.kind === 'video' || asset.kind === 'audio') && (
                      <button
                        type="button"
                        onClick={() => onExtractAudioFromAsset(asset)}
                        aria-label={`استخراج الصوت من ${asset.name}`}
                        title="استخراج/تحويل الصوت MP3/WAV"
                        className="p-1.5 text-cyan-300 hover:bg-cyan-500/15 rounded transition-colors"
                      >
                        <AudioLines className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onAddAssetToTimeline(asset)}
                      aria-label={`إضافة ${asset.name} للمسار`}
                      title="إضافة للتايم لاين"
                      className="p-1.5 text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'transitions' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200">
                  مكتبة الانتقالات ({TRANSITIONS.length} حركة)
                </span>
                <div className="flex items-center bg-[#161C27] p-0.5 rounded border border-white/10 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setTransitionTarget('in')}
                    className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                      transitionTarget === 'in'
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    دخول
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransitionTarget('out')}
                    className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                      transitionTarget === 'out'
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    خروج
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search
                  className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={transitionSearch}
                  onChange={(e) => setTransitionSearch(e.target.value)}
                  placeholder="ابحث عن انتقال (تلاشي، تشويش، دوران...)"
                  aria-label="بحث في الانتقالات"
                  className="w-full bg-[#161C27] border border-white/10 focus:border-amber-400/60 rounded-md pr-8 pl-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-1">
                {(Object.keys(TRANSITION_CATEGORY_LABELS) as Array<TransitionCategory | 'all'>).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTransitionCategory(cat)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                        transitionCategory === cat
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                          : 'bg-[#161C27] text-slate-400 border border-white/8 hover:text-slate-200'
                      }`}
                    >
                      {TRANSITION_CATEGORY_LABELS[cat]}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {filteredTransitions.map((tr) => {
                const isSelected =
                  transitionTarget === 'in'
                    ? selectedTransitionIn === tr.id
                    : selectedTransitionOut === tr.id;
                return (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => onApplyTransition(tr.id, transitionTarget)}
                    className={`text-right p-2 rounded-md border transition-all group ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/10'
                        : 'border-white/10 bg-[#151B26] hover:border-white/25 hover:bg-[#1A2230]'
                    }`}
                  >
                    <div
                      className={`h-10 rounded mb-1.5 bg-gradient-to-br ${tr.previewGradient} border border-white/10 flex items-center justify-center overflow-hidden relative`}
                    >
                      <Sparkles
                        className="w-4 h-4 text-white/80 group-hover:scale-125 transition-transform"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {tr.nameAr}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {tr.nameEn} · {tr.defaultDuration}s
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'text' && (
          <div className="space-y-2.5">
            <p className="text-xs text-slate-400">
              أضف نصوصاً عربية وإنجليزية متحركة قابلة للتعديل الكامل على الطبقة T1.
            </p>
            <div className="space-y-2">
              {TEXT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => onAddTextClip(preset)}
                  className="w-full text-right p-3 rounded-md bg-[#161C27] hover:bg-[#1C2433] border border-white/10 hover:border-amber-400/50 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-100">{preset.name}</div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {preset.content}
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'shapes' && (
          <div className="space-y-2.5">
            <p className="text-xs text-slate-400">
              أضف أشكالاً هندسية وشرائط سفلية Lower Thirds احترافية مع تدرجات لونية وحركة.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SHAPE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => onAddShapeClip(preset)}
                  className="text-right p-2.5 rounded-md bg-[#161C27] hover:bg-[#1C2433] border border-white/10 hover:border-amber-400/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="w-5 h-5 rounded-sm border border-white/20 inline-block"
                      style={{
                        background:
                          preset.fillColor === 'transparent'
                            ? 'transparent'
                            : `linear-gradient(135deg, ${preset.fillColor}, ${preset.fillSecondary})`,
                        borderColor: preset.strokeColor,
                      }}
                    />
                    <Plus className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  </div>
                  <div className="text-xs font-semibold text-slate-100 truncate">{preset.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'filters' && (
          <div className="space-y-2.5">
            <p className="text-xs text-slate-400">
              تدرجات لونية سينمائية فورية للمقطع المحدد:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {FILTER_PRESETS.map((fp) => {
                const active = activeFilterPreset === fp.id;
                return (
                  <button
                    key={fp.id}
                    type="button"
                    onClick={() => onApplyFilterPreset(fp.id)}
                    className={`text-right p-2 rounded-md border transition-colors ${
                      active
                        ? 'border-amber-400 bg-amber-500/10'
                        : 'border-white/10 bg-[#161C27] hover:border-white/25'
                    }`}
                  >
                    <div
                      className={`h-9 rounded mb-1.5 bg-gradient-to-r ${fp.swatch} border border-white/10`}
                    />
                    <div className="text-xs font-medium text-slate-100 truncate">{fp.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
