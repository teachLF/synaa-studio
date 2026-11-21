'use client';

import React from 'react';
import {
  AudioWaveform,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  DEFAULT_AUDIO_CLEANUP,
  DEFAULT_COLOR_ADJUSTMENTS,
  DEFAULT_TRANSFORM,
  DENOISE_PRESETS,
} from '@/lib/editor/timelineMath';
import { TRANSITIONS } from '@/lib/editor/transitions';
import type {
  AudioCleanupProps,
  ColorAdjustments,
  DenoisePreset,
  EasingType,
  ShapeAnimationType,
  ShapeKind,
  ShapeProps,
  TextAnimationType,
  TextProps,
  TimelineClip,
  TransformProps,
  TransitionType,
} from '@/lib/editor/types';

export type InspectorTab = 'general' | 'color' | 'transitions' | 'audio';

interface RightInspectorPanelProps {
  clip: TimelineClip | null;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onUpdateClip: (clipId: string, updater: (prev: TimelineClip) => TimelineClip) => void;
  onDeleteClip: (clipId: string) => void;
  bypassDenoise: boolean;
  onToggleBypassDenoise: () => void;
}

function SliderRow({
  label,
  valueText,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string;
  valueText: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-400">{valueText}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full studio-slider"
      />
    </div>
  );
}

export default function RightInspectorPanel({
  clip,
  activeTab,
  onTabChange,
  onUpdateClip,
  onDeleteClip,
  bypassDenoise,
  onToggleBypassDenoise,
}: RightInspectorPanelProps) {
  if (!clip) {
    return (
      <aside className="w-full lg:w-80 xl:w-[340px] shrink-0 bg-[#10141D] border-r border-white/10 p-6 flex flex-col items-center justify-center text-center">
        <SlidersHorizontal className="w-8 h-8 text-slate-600 mb-3" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-slate-200">لوحة الخصائص والتنقية</h2>
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
          اختر أي مقطع فيديو أو صورة أو نص أو شكل أو ملف صوتي من التايم لاين لتعديل خصائصه، تطبيق الانتقالات، أو إزالة الضوضاء.
        </p>
      </aside>
    );
  }

  const updateTransform = (patch: Partial<TransformProps>) =>
    onUpdateClip(clip.id, (prev) => ({ ...prev, transform: { ...prev.transform, ...patch } }));

  const updateColor = (patch: Partial<ColorAdjustments>) =>
    onUpdateClip(clip.id, (prev) => ({ ...prev, color: { ...prev.color, ...patch } }));

  const updateAudio = (patch: Partial<AudioCleanupProps>) =>
    onUpdateClip(clip.id, (prev) => ({ ...prev, audio: { ...prev.audio, ...patch } }));

  const updateText = (patch: Partial<TextProps>) =>
    onUpdateClip(clip.id, (prev) =>
      prev.text ? { ...prev, text: { ...prev.text, ...patch } } : prev
    );

  const updateShape = (patch: Partial<ShapeProps>) =>
    onUpdateClip(clip.id, (prev) =>
      prev.shape ? { ...prev, shape: { ...prev.shape, ...patch } } : prev
    );

  const tabs: Array<{ id: InspectorTab; label: string; icon: React.ReactNode }> = [
    { id: 'general', label: 'الخصائص', icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
    { id: 'color', label: 'الألوان', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'transitions', label: 'الانتقالات', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'audio', label: 'الضوضاء', icon: <AudioWaveform className="w-3.5 h-3.5" /> },
  ];

  return (
    <aside className="w-full lg:w-80 xl:w-[340px] shrink-0 bg-[#10141D] border-r border-white/10 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-white/10 bg-[#0D1017] flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-100 truncate">{clip.name}</p>
          <p className="text-[11px] font-mono text-slate-400">
            {clip.kind.toUpperCase()} · {clip.duration.toFixed(1)}s
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDeleteClip(clip.id)}
          aria-label={`حذف المقطع ${clip.name}`}
          title="حذف المقطع"
          className="p-1.5 text-rose-400 hover:bg-rose-500/15 rounded transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="أقسام الخصائص"
        className="grid grid-cols-4 border-b border-white/10 bg-[#0D1017] shrink-0"
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
              className={`flex items-center justify-center gap-1 py-2 px-1 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-amber-400 text-amber-300 bg-[#151B26]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 min-h-0">
        {activeTab === 'general' && (
          <>
            {/* Text-specific controls */}
            {clip.kind === 'text' && clip.text && (
              <div className="space-y-3 pb-3 border-b border-white/10">
                <div className="text-xs font-bold text-amber-300">إعدادات النص</div>
                <div className="space-y-1">
                  <label htmlFor="text-content-input" className="text-xs text-slate-300 block">
                    المحتوى النصي
                  </label>
                  <textarea
                    id="text-content-input"
                    rows={2}
                    value={clip.text.content}
                    onChange={(e) => updateText({ content: e.target.value })}
                    className="w-full bg-[#161C27] border border-white/10 focus:border-amber-400 rounded-md p-2 text-xs text-slate-100 outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label htmlFor="text-font-select" className="text-xs text-slate-300 block">
                      الخط
                    </label>
                    <select
                      id="text-font-select"
                      value={clip.text.fontFamily}
                      onChange={(e) => updateText({ fontFamily: e.target.value })}
                      className="w-full bg-[#161C27] border border-white/10 rounded px-2 py-1.5 text-xs text-slate-100 outline-none"
                    >
                      <option value="Cairo">Cairo (كايرو)</option>
                      <option value="IBM Plex Sans Arabic">IBM Plex Arabic</option>
                      <option value="Tahoma">Tahoma</option>
                      <option value="JetBrains Mono">JetBrains Mono</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="text-anim-select" className="text-xs text-slate-300 block">
                      حركة النص
                    </label>
                    <select
                      id="text-anim-select"
                      value={clip.text.animation}
                      onChange={(e) =>
                        updateText({ animation: e.target.value as TextAnimationType })
                      }
                      className="w-full bg-[#161C27] border border-white/10 rounded px-2 py-1.5 text-xs text-slate-100 outline-none"
                    >
                      <option value="none">بدون حركة</option>
                      <option value="fade_rise">صعود ناعم</option>
                      <option value="typewriter">كتابة آلية</option>
                      <option value="pop_bounce">ارتداد حيوي</option>
                      <option value="slide_kinetic">انزلاق سريع</option>
                      <option value="glitch_reveal">تشويش رقمي</option>
                      <option value="neon_pulse">توهج نيون</option>
                    </select>
                  </div>
                </div>

                <SliderRow
                  label="حجم الخط"
                  valueText={`${clip.text.fontSize}px`}
                  min={18}
                  max={140}
                  value={clip.text.fontSize}
                  onChange={(v) => updateText({ fontSize: v })}
                />

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center justify-between bg-[#161C27] px-2.5 py-1.5 rounded border border-white/10 text-xs">
                    <span>لون النص</span>
                    <input
                      type="color"
                      value={clip.text.color}
                      onChange={(e) => updateText({ color: e.target.value })}
                      className="w-6 h-5 bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between bg-[#161C27] px-2.5 py-1.5 rounded border border-white/10 text-xs">
                    <span>لون الخلفية</span>
                    <input
                      type="color"
                      value={clip.text.bgColor}
                      onChange={(e) => updateText({ bgColor: e.target.value })}
                      className="w-6 h-5 bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                </div>

                <SliderRow
                  label="شفافية خلفية النص"
                  valueText={`${Math.round(clip.text.bgOpacity * 100)}%`}
                  min={0}
                  max={1}
                  step={0.05}
                  value={clip.text.bgOpacity}
                  onChange={(v) => updateText({ bgOpacity: v })}
                />
                <SliderRow
                  label="سمك الحدود الخارجية"
                  valueText={`${clip.text.strokeWidth}px`}
                  min={0}
                  max={12}
                  value={clip.text.strokeWidth}
                  onChange={(v) => updateText({ strokeWidth: v })}
                />
              </div>
            )}

            {/* Shape-specific controls */}
            {clip.kind === 'shape' && clip.shape && (
              <div className="space-y-3 pb-3 border-b border-white/10">
                <div className="text-xs font-bold text-amber-300">إعدادات الشكل الاحترافي</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label htmlFor="shape-kind-select" className="text-xs text-slate-300 block">
                      نوع الشكل
                    </label>
                    <select
                      id="shape-kind-select"
                      value={clip.shape.shapeType}
                      onChange={(e) => updateShape({ shapeType: e.target.value as ShapeKind })}
                      className="w-full bg-[#161C27] border border-white/10 rounded px-2 py-1.5 text-xs text-slate-100 outline-none"
                    >
                      <option value="lower_third">شريط سفلي</option>
                      <option value="rounded">بطاقة ناعمة</option>
                      <option value="rect">مستطيل</option>
                      <option value="badge_frame">إطار شارة</option>
                      <option value="circle">دائرة</option>
                      <option value="ring">حلقة مفرغة</option>
                      <option value="callout">فقاعة تنبيه</option>
                      <option value="arrow">سهم</option>
                      <option value="star">نجمة</option>
                      <option value="triangle">مثلث</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="shape-anim-select" className="text-xs text-slate-300 block">
                      حركة الدخول
                    </label>
                    <select
                      id="shape-anim-select"
                      value={clip.shape.animation}
                      onChange={(e) =>
                        updateShape({ animation: e.target.value as ShapeAnimationType })
                      }
                      className="w-full bg-[#161C27] border border-white/10 rounded px-2 py-1.5 text-xs text-slate-100 outline-none"
                    >
                      <option value="none">ثابت</option>
                      <option value="scale_pop">تكبير ارتدادي</option>
                      <option value="slide_in">انزلاق</option>
                      <option value="draw_reveal">ظهور تدريجي</option>
                      <option value="pulse_glow">نبض مستمر</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="shape-label-input" className="text-xs text-slate-300 block">
                    نص داخل الشكل (اختياري)
                  </label>
                  <input
                    id="shape-label-input"
                    type="text"
                    value={clip.shape.labelText || ''}
                    onChange={(e) => updateShape({ labelText: e.target.value })}
                    placeholder="مثال: جديد · حصري"
                    className="w-full bg-[#161C27] border border-white/10 rounded px-2.5 py-1.5 text-xs text-slate-100 outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1 bg-[#161C27] p-2 rounded border border-white/10 text-[11px]">
                    <span>اللون 1</span>
                    <input
                      type="color"
                      value={clip.shape.fillColor === 'transparent' ? '#0f172a' : clip.shape.fillColor}
                      onChange={(e) => updateShape({ fillColor: e.target.value })}
                      className="w-full h-5 bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex flex-col gap-1 bg-[#161C27] p-2 rounded border border-white/10 text-[11px]">
                    <span>اللون 2</span>
                    <input
                      type="color"
                      value={clip.shape.fillSecondary === 'transparent' ? '#1e293b' : clip.shape.fillSecondary}
                      onChange={(e) => updateShape({ fillSecondary: e.target.value })}
                      className="w-full h-5 bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex flex-col gap-1 bg-[#161C27] p-2 rounded border border-white/10 text-[11px]">
                    <span>الحدود</span>
                    <input
                      type="color"
                      value={clip.shape.strokeColor}
                      onChange={(e) => updateShape({ strokeColor: e.target.value })}
                      className="w-full h-5 bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                </div>

                <SliderRow
                  label="العرض %"
                  valueText={`${clip.shape.width}%`}
                  min={5}
                  max={100}
                  value={clip.shape.width}
                  onChange={(v) => updateShape({ width: v })}
                />
                <SliderRow
                  label="الارتفاع %"
                  valueText={`${clip.shape.height}%`}
                  min={5}
                  max={100}
                  value={clip.shape.height}
                  onChange={(v) => updateShape({ height: v })}
                />
                <SliderRow
                  label="استدارة الزوايا"
                  valueText={`${clip.shape.cornerRadius}px`}
                  min={0}
                  max={60}
                  value={clip.shape.cornerRadius}
                  onChange={(v) => updateShape({ cornerRadius: v })}
                />
              </div>
            )}

            {/* Common Transform & Speed */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">الموضع والتحويل والسرعة</span>
                <button
                  type="button"
                  onClick={() => updateTransform({ ...DEFAULT_TRANSFORM })}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  <span>إعادة ضبط</span>
                </button>
              </div>

              <SliderRow
                label="المدة الزمنية (ثانية)"
                valueText={`${clip.duration.toFixed(1)}s`}
                min={0.5}
                max={60}
                step={0.1}
                value={clip.duration}
                onChange={(v) => onUpdateClip(clip.id, (prev) => ({ ...prev, duration: v }))}
              />

              {clip.kind !== 'audio' && (
                <>
                  <SliderRow
                    label="المقياس (Scale)"
                    valueText={`${Math.round(clip.transform.scale * 100)}%`}
                    min={0.2}
                    max={2.5}
                    step={0.05}
                    value={clip.transform.scale}
                    onChange={(v) => updateTransform({ scale: v })}
                  />
                  <SliderRow
                    label="الإزاحة الأفقية (X)"
                    valueText={`${clip.transform.x}%`}
                    min={-50}
                    max={50}
                    value={clip.transform.x}
                    onChange={(v) => updateTransform({ x: v })}
                  />
                  <SliderRow
                    label="الإزاحة العمودية (Y)"
                    valueText={`${clip.transform.y}%`}
                    min={-50}
                    max={50}
                    value={clip.transform.y}
                    onChange={(v) => updateTransform({ y: v })}
                  />
                  <SliderRow
                    label="الدوران"
                    valueText={`${clip.transform.rotation}°`}
                    min={-180}
                    max={180}
                    value={clip.transform.rotation}
                    onChange={(v) => updateTransform({ rotation: v })}
                  />
                  <SliderRow
                    label="الشفافية"
                    valueText={`${Math.round(clip.transform.opacity * 100)}%`}
                    min={0}
                    max={1}
                    step={0.05}
                    value={clip.transform.opacity}
                    onChange={(v) => updateTransform({ opacity: v })}
                  />

                  <div className="space-y-1">
                    <label htmlFor="blend-mode-select" className="text-xs text-slate-300 block">
                      وضع الدمج (Blend Mode)
                    </label>
                    <select
                      id="blend-mode-select"
                      value={clip.transform.blendMode}
                      onChange={(e) =>
                        updateTransform({
                          blendMode: e.target.value as GlobalCompositeOperation,
                        })
                      }
                      className="w-full bg-[#161C27] border border-white/10 rounded px-2 py-1.5 text-xs text-slate-100 outline-none"
                    >
                      <option value="source-over">عادي (Normal)</option>
                      <option value="screen">تفتيح ضوئي (Screen)</option>
                      <option value="multiply">مضاعفة داكنة (Multiply)</option>
                      <option value="overlay">تراكب تبايني (Overlay)</option>
                      <option value="lighter">إضافة ضوئية (Add)</option>
                    </select>
                  </div>
                </>
              )}

              <SliderRow
                label="سرعة التشغيل"
                valueText={`${clip.speed.toFixed(2)}x`}
                min={0.25}
                max={4}
                step={0.05}
                value={clip.speed}
                onChange={(v) => onUpdateClip(clip.id, (prev) => ({ ...prev, speed: v }))}
              />
            </div>
          </>
        )}

        {activeTab === 'color' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">تعديل الألوان والتأثيرات</span>
              <button
                type="button"
                onClick={() => updateColor({ ...DEFAULT_COLOR_ADJUSTMENTS })}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 transition-colors"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>تصفير</span>
              </button>
            </div>

            <SliderRow
              label="السطوع"
              valueText={`${clip.color.brightness}%`}
              min={30}
              max={200}
              value={clip.color.brightness}
              onChange={(v) => updateColor({ brightness: v })}
            />
            <SliderRow
              label="التباين"
              valueText={`${clip.color.contrast}%`}
              min={40}
              max={200}
              value={clip.color.contrast}
              onChange={(v) => updateColor({ contrast: v })}
            />
            <SliderRow
              label="تشبع الألوان"
              valueText={`${clip.color.saturation}%`}
              min={0}
              max={200}
              value={clip.color.saturation}
              onChange={(v) => updateColor({ saturation: v })}
            />
            <SliderRow
              label="تدوير الألوان (Hue)"
              valueText={`${clip.color.hueRotate}°`}
              min={-180}
              max={180}
              value={clip.color.hueRotate}
              onChange={(v) => updateColor({ hueRotate: v })}
            />
            <SliderRow
              label="الضبابية (Blur)"
              valueText={`${clip.color.blur}px`}
              min={0}
              max={20}
              step={0.5}
              value={clip.color.blur}
              onChange={(v) => updateColor({ blur: v })}
            />
            <SliderRow
              label="الدفء الكلاسيكي (Sepia)"
              valueText={`${clip.color.sepia}%`}
              min={0}
              max={100}
              value={clip.color.sepia}
              onChange={(v) => updateColor({ sepia: v })}
            />
            <SliderRow
              label="تظليل الحواف (Vignette)"
              valueText={`${clip.color.vignette}%`}
              min={0}
              max={100}
              value={clip.color.vignette}
              onChange={(v) => updateColor({ vignette: v })}
            />
            <SliderRow
              label="تحبب الفيلم (Film Grain)"
              valueText={`${clip.color.grain}%`}
              min={0}
              max={100}
              value={clip.color.grain}
              onChange={(v) => updateColor({ grain: v })}
            />
          </div>
        )}

        {activeTab === 'transitions' && (
          <div className="space-y-4">
            {/* In Transition */}
            <div className="space-y-2.5 pb-3 border-b border-white/10">
              <div className="text-xs font-bold text-amber-300">انتقال الدخول (In Transition)</div>
              <select
                aria-label="نوع انتقال الدخول"
                value={clip.inTransition.type}
                onChange={(e) =>
                  onUpdateClip(clip.id, (prev) => ({
                    ...prev,
                    inTransition: {
                      ...prev.inTransition,
                      type: e.target.value as TransitionType,
                    },
                  }))
                }
                className="w-full bg-[#161C27] border border-white/10 rounded px-2.5 py-1.5 text-xs text-slate-100 outline-none"
              >
                <option value="none">بدون انتقال</option>
                {TRANSITIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameAr} ({t.nameEn})
                  </option>
                ))}
              </select>

              <SliderRow
                label="مدة انتقال الدخول"
                valueText={`${clip.inTransition.duration.toFixed(2)}s`}
                min={0.2}
                max={3.0}
                step={0.05}
                value={clip.inTransition.duration}
                onChange={(v) =>
                  onUpdateClip(clip.id, (prev) => ({
                    ...prev,
                    inTransition: { ...prev.inTransition, duration: v },
                  }))
                }
              />

              <select
                aria-label="منحنى حركة الدخول"
                value={clip.inTransition.easing}
                onChange={(e) =>
                  onUpdateClip(clip.id, (prev) => ({
                    ...prev,
                    inTransition: {
                      ...prev.inTransition,
                      easing: e.target.value as EasingType,
                    },
                  }))
                }
                className="w-full bg-[#161C27] border border-white/10 rounded px-2.5 py-1.5 text-xs text-slate-100 outline-none"
              >
                <option value="easeInOut">ناعم متوازن (Ease In-Out)</option>
                <option value="easeOutBack">ارتداد احترافي (Out Back)</option>
                <option value="easeInOutQuint">انسياب سينمائي (Quint)</option>
                <option value="elastic">مرن مطاطي (Elastic)</option>
                <option value="linear">خطي ثابت (Linear)</option>
              </select>
            </div>

            {/* Out Transition */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-sky-300">انتقال الخروج (Out Transition)</div>
              <select
                aria-label="نوع انتقال الخروج"
                value={clip.outTransition.type}
                onChange={(e) =>
                  onUpdateClip(clip.id, (prev) => ({
                    ...prev,
                    outTransition: {
                      ...prev.outTransition,
                      type: e.target.value as TransitionType,
                    },
                  }))
                }
                className="w-full bg-[#161C27] border border-white/10 rounded px-2.5 py-1.5 text-xs text-slate-100 outline-none"
              >
                <option value="none">بدون انتقال</option>
                {TRANSITIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameAr} ({t.nameEn})
                  </option>
                ))}
              </select>

              <SliderRow
                label="مدة انتقال الخروج"
                valueText={`${clip.outTransition.duration.toFixed(2)}s`}
                min={0.2}
                max={3.0}
                step={0.05}
                value={clip.outTransition.duration}
                onChange={(v) =>
                  onUpdateClip(clip.id, (prev) => ({
                    ...prev,
                    outTransition: { ...prev.outTransition, duration: v },
                  }))
                }
              />
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-4">
            <div className="space-y-2.5 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">مستوى الصوت والتلاشي</span>
                <button
                  type="button"
                  onClick={() => updateAudio({ muted: !clip.audio.muted })}
                  className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                    clip.audio.muted
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-[#161C27] text-slate-300 border-white/10'
                  }`}
                >
                  {clip.audio.muted ? 'مكتوم' : 'كتم المقطع'}
                </button>
              </div>

              <SliderRow
                label="مستوى الصوت"
                valueText={`${Math.round(clip.audio.volume * 100)}%`}
                min={0}
                max={2}
                step={0.05}
                value={clip.audio.volume}
                onChange={(v) => updateAudio({ volume: v })}
              />
              <SliderRow
                label="تلاشي الدخول (Fade In)"
                valueText={`${clip.audio.fadeIn.toFixed(1)}s`}
                min={0}
                max={4}
                step={0.1}
                value={clip.audio.fadeIn}
                onChange={(v) => updateAudio({ fadeIn: v })}
              />
              <SliderRow
                label="تلاشي الخروج (Fade Out)"
                valueText={`${clip.audio.fadeOut.toFixed(1)}s`}
                min={0}
                max={4}
                step={0.1}
                value={clip.audio.fadeOut}
                onChange={(v) => updateAudio({ fadeOut: v })}
              />
            </div>

            {/* Complete Noise Removal Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-cyan-300">
                    إزالة الضوضاء الكاملة والهواء
                  </div>
                  <div className="text-[11px] text-slate-400">
                    عزل الرياح والضجيج والهمهمة فورياً
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={clip.audio.denoiseEnabled}
                  aria-label="تفعيل إزالة الضوضاء الكاملة"
                  onClick={() =>
                    updateAudio({ denoiseEnabled: !clip.audio.denoiseEnabled })
                  }
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    clip.audio.denoiseEnabled
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-[#1A2230] text-slate-300 border border-white/10'
                  }`}
                >
                  {clip.audio.denoiseEnabled ? 'مفعل' : 'تفعيل'}
                </button>
              </div>

              {/* Presets */}
              <div className="grid grid-cols-2 gap-1.5">
                {(['wind', 'voice', 'hiss', 'studio'] as DenoisePreset[]).map((presetKey) => {
                  const preset = DENOISE_PRESETS[presetKey];
                  const active =
                    clip.audio.denoiseEnabled && clip.audio.denoisePreset === presetKey;
                  return (
                    <button
                      key={presetKey}
                      type="button"
                      onClick={() =>
                        updateAudio({
                          denoiseEnabled: true,
                          denoisePreset: presetKey,
                          denoiseStrength: preset.denoiseStrength,
                          windCutHz: preset.windCutHz,
                          hissCutHz: preset.hissCutHz,
                          gateThresholdDb: preset.gateThresholdDb,
                          voiceBoost: preset.voiceBoost,
                          normalize: preset.normalize,
                        })
                      }
                      className={`text-right p-2 rounded border text-[11px] transition-colors ${
                        active
                          ? 'bg-cyan-500/15 border-cyan-400 text-cyan-200 font-semibold'
                          : 'bg-[#161C27] border-white/8 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      {preset.labelAr}
                    </button>
                  );
                })}
              </div>

              {clip.audio.denoiseEnabled && (
                <div className="space-y-2.5 pt-1">
                  <SliderRow
                    label="قوة عزل الضوضاء الكلية"
                    valueText={`${clip.audio.denoiseStrength}%`}
                    min={10}
                    max={100}
                    value={clip.audio.denoiseStrength}
                    onChange={(v) =>
                      updateAudio({ denoiseStrength: v, denoisePreset: 'custom' })
                    }
                  />
                  <SliderRow
                    label="قطع ضجيج الهواء والرياح (High-Pass)"
                    valueText={`${clip.audio.windCutHz} Hz`}
                    min={40}
                    max={300}
                    step={5}
                    value={clip.audio.windCutHz}
                    onChange={(v) => updateAudio({ windCutHz: v, denoisePreset: 'custom' })}
                  />
                  <SliderRow
                    label="قطع الهسيس والوشوشة (Low-Pass)"
                    valueText={`${clip.audio.hissCutHz} Hz`}
                    min={4000}
                    max={18000}
                    step={250}
                    value={clip.audio.hissCutHz}
                    onChange={(v) => updateAudio({ hissCutHz: v, denoisePreset: 'custom' })}
                  />
                  <SliderRow
                    label="تعزيز نقاء الصوت البشري"
                    valueText={`+${clip.audio.voiceBoost} dB`}
                    min={0}
                    max={12}
                    step={0.5}
                    value={clip.audio.voiceBoost}
                    onChange={(v) => updateAudio({ voiceBoost: v, denoisePreset: 'custom' })}
                  />

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clip.audio.normalize}
                        onChange={(e) => updateAudio({ normalize: e.target.checked })}
                        className="accent-cyan-400"
                      />
                      <span>موازنة مستوى الصوت تلقائياً</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => updateAudio({ ...DEFAULT_AUDIO_CLEANUP })}
                      className="text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      إعادة ضبط
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={onToggleBypassDenoise}
                    className={`w-full py-2 px-3 rounded text-xs font-semibold border transition-colors ${
                      bypassDenoise
                        ? 'bg-amber-500/15 border-amber-400 text-amber-200'
                        : 'bg-[#161C27] border-white/15 text-slate-200 hover:bg-[#1D2534]'
                    }`}
                  >
                    {bypassDenoise
                      ? 'وضع المقارنة: سماع الصوت الأصلي (قبل التنقية)'
                      : 'اضغط للمقارنة: سماع الصوت الأصلي بدون عزل'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
