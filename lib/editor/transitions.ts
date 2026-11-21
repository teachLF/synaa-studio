import type { EasingType, TransitionCategory, TransitionType } from './types';

export interface TransitionDefinition {
  id: TransitionType;
  nameAr: string;
  nameEn: string;
  category: TransitionCategory;
  defaultDuration: number;
  descriptionAr: string;
  previewGradient: string;
}

export const TRANSITION_CATEGORY_LABELS: Record<TransitionCategory | 'all', string> = {
  all: 'الكل',
  cinematic: 'سينمائي وإضاءة',
  motion: 'انزلاق وحركة',
  distortion: 'تشويه وموجات',
  geometric: 'هندسي وقواطع',
};

export const TRANSITIONS: TransitionDefinition[] = [
  {
    id: 'crossfade',
    nameAr: 'تلاشي ناعم',
    nameEn: 'Crossfade',
    category: 'cinematic',
    defaultDuration: 0.8,
    descriptionAr: 'مزج تدريجي ناعم بين المشهدين',
    previewGradient: 'from-amber-500/40 to-slate-900',
  },
  {
    id: 'dip_black',
    nameAr: 'تعتيم سينمائي',
    nameEn: 'Dip to Black',
    category: 'cinematic',
    defaultDuration: 0.9,
    descriptionAr: 'هبوط للون الأسود ثم ظهور المشهد الجديد',
    previewGradient: 'from-black to-amber-500/30',
  },
  {
    id: 'dip_white',
    nameAr: 'ومضة بيضاء',
    nameEn: 'Dip to White',
    category: 'cinematic',
    defaultDuration: 0.7,
    descriptionAr: 'إضاءة بيضاء سريعة كفلاش الكاميرا',
    previewGradient: 'from-white/50 to-slate-800',
  },
  {
    id: 'flash_burn',
    nameAr: 'احتراق ضوئي',
    nameEn: 'Flash Burn',
    category: 'cinematic',
    defaultDuration: 0.75,
    descriptionAr: 'توهج سطوع عالٍ مع تلاشي سينمائي',
    previewGradient: 'from-amber-400/60 to-orange-900/50',
  },
  {
    id: 'light_leak',
    nameAr: 'تسرب ضوء دافئ',
    nameEn: 'Light Leak',
    category: 'cinematic',
    defaultDuration: 1.0,
    descriptionAr: 'موجة إضاءة دافئة تعبر الشاشة',
    previewGradient: 'from-orange-500/50 via-amber-300/30 to-slate-900',
  },
  {
    id: 'anamorphic_flare',
    nameAr: 'وهج عدسة سينمائية',
    nameEn: 'Anamorphic Flare',
    category: 'cinematic',
    defaultDuration: 0.9,
    descriptionAr: 'خط ضوئي أفقي عريض بأسلوب الأفلام',
    previewGradient: 'from-cyan-400/50 via-sky-200/30 to-slate-900',
  },
  {
    id: 'film_burn',
    nameAr: 'احتراق شريط فيلم',
    nameEn: 'Film Burn',
    category: 'cinematic',
    defaultDuration: 1.0,
    descriptionAr: 'تأثير احتراق كلاسيكي لشريط 35مم',
    previewGradient: 'from-red-500/50 via-amber-500/40 to-black',
  },
  {
    id: 'slide_left',
    nameAr: 'انزلاق لليسار',
    nameEn: 'Slide Left',
    category: 'motion',
    defaultDuration: 0.65,
    descriptionAr: 'دخول المشهد الجديد من اليمين إلى اليسار',
    previewGradient: 'from-sky-500/40 to-slate-900',
  },
  {
    id: 'slide_right',
    nameAr: 'انزلاق لليمين',
    nameEn: 'Slide Right',
    category: 'motion',
    defaultDuration: 0.65,
    descriptionAr: 'دخول المشهد الجديد من اليسار إلى اليمين',
    previewGradient: 'from-sky-500/40 to-slate-900',
  },
  {
    id: 'slide_up',
    nameAr: 'انزلاق للأعلى',
    nameEn: 'Slide Up',
    category: 'motion',
    defaultDuration: 0.65,
    descriptionAr: 'صعود المشهد الجديد من الأسفل للأعلى',
    previewGradient: 'from-emerald-500/40 to-slate-900',
  },
  {
    id: 'slide_down',
    nameAr: 'انزلاق للأسفل',
    nameEn: 'Slide Down',
    category: 'motion',
    defaultDuration: 0.65,
    descriptionAr: 'نزول المشهد الجديد من الأعلى للأسفل',
    previewGradient: 'from-emerald-500/40 to-slate-900',
  },
  {
    id: 'push_left',
    nameAr: 'دفع ديناميكي يسار',
    nameEn: 'Push Left',
    category: 'motion',
    defaultDuration: 0.6,
    descriptionAr: 'دفع المشهد القديم خارج الإطار بقوة',
    previewGradient: 'from-amber-500/40 to-sky-900/40',
  },
  {
    id: 'push_right',
    nameAr: 'دفع ديناميكي يمين',
    nameEn: 'Push Right',
    category: 'motion',
    defaultDuration: 0.6,
    descriptionAr: 'دفع المشهد القديم لليمين بسلاسة',
    previewGradient: 'from-amber-500/40 to-sky-900/40',
  },
  {
    id: 'whip_pan',
    nameAr: 'التفات كاميرا سريع',
    nameEn: 'Whip Pan',
    category: 'motion',
    defaultDuration: 0.5,
    descriptionAr: 'حركة كاميرا خاطفة مع ضبابية الحركة',
    previewGradient: 'from-cyan-500/50 to-slate-950',
  },
  {
    id: 'zoom_in_cross',
    nameAr: 'تقريب متداخل',
    nameEn: 'Zoom In Cross',
    category: 'motion',
    defaultDuration: 0.75,
    descriptionAr: 'تقريب سريع نحو المشهد الجديد',
    previewGradient: 'from-amber-400/50 to-slate-900',
  },
  {
    id: 'zoom_out_cross',
    nameAr: 'تبعيد متداخل',
    nameEn: 'Zoom Out Cross',
    category: 'motion',
    defaultDuration: 0.75,
    descriptionAr: 'ابتعاد سينمائي يكشف المشهد الجديد',
    previewGradient: 'from-teal-400/50 to-slate-900',
  },
  {
    id: 'spin_twist',
    nameAr: 'دوران حلزوني 360',
    nameEn: 'Spin Twist',
    category: 'motion',
    defaultDuration: 0.8,
    descriptionAr: 'تدوير وتكبير متناغم بين المشهدين',
    previewGradient: 'from-rose-500/40 to-amber-500/30',
  },
  {
    id: 'elastic_bounce',
    nameAr: 'ارتداد مرن احترافي',
    nameEn: 'Elastic Bounce',
    category: 'motion',
    defaultDuration: 0.85,
    descriptionAr: 'دخول مطاطي بنبضة احترافية سريعة',
    previewGradient: 'from-emerald-400/50 to-slate-900',
  },
  {
    id: 'glitch_rgb',
    nameAr: 'تشويش رقمي RGB',
    nameEn: 'RGB Glitch',
    category: 'distortion',
    defaultDuration: 0.65,
    descriptionAr: 'انفصال القنوات اللونية مع تقطيع رقمي',
    previewGradient: 'from-rose-500/50 via-cyan-400/40 to-slate-900',
  },
  {
    id: 'chromatic_shake',
    nameAr: 'اهتزاز لوني حركي',
    nameEn: 'Chromatic Shake',
    category: 'distortion',
    defaultDuration: 0.55,
    descriptionAr: 'اهتزاز بصري حاد للأكشن والموسيقى',
    previewGradient: 'from-red-500/50 to-sky-500/40',
  },
  {
    id: 'pixelate_dissolve',
    nameAr: 'تفكك بيكسلي',
    nameEn: 'Pixelate Dissolve',
    category: 'distortion',
    defaultDuration: 0.85,
    descriptionAr: 'تحول الإطار لمربعات بيكسل متداخلة',
    previewGradient: 'from-amber-500/50 to-slate-800',
  },
  {
    id: 'ripple_wave',
    nameAr: 'تموج مائي متسع',
    nameEn: 'Ripple Wave',
    category: 'distortion',
    defaultDuration: 0.9,
    descriptionAr: 'موجات دائرية تنساب فوق الصورة',
    previewGradient: 'from-cyan-500/50 to-blue-900/50',
  },
  {
    id: 'vortex_swirl',
    nameAr: 'دوامة سحب سريعة',
    nameEn: 'Vortex Swirl',
    category: 'distortion',
    defaultDuration: 0.85,
    descriptionAr: 'التفاف حلزوني يمتص المشهد القديم',
    previewGradient: 'from-orange-500/50 to-slate-900',
  },
  {
    id: 'kaleidoscope_flip',
    nameAr: 'انعكاس مرآوي هندسي',
    nameEn: 'Kaleidoscope Flip',
    category: 'distortion',
    defaultDuration: 0.8,
    descriptionAr: 'انقسام وتكرار متناظر أثناء التحول',
    previewGradient: 'from-sky-400/50 to-amber-500/40',
  },
  {
    id: 'iris_circle',
    nameAr: 'فتح دائري سينمائي',
    nameEn: 'Iris Circle',
    category: 'geometric',
    defaultDuration: 0.8,
    descriptionAr: 'توسع دائري من مركز الشاشة',
    previewGradient: 'from-amber-500/40 to-slate-950',
  },
  {
    id: 'diamond_wipe',
    nameAr: 'مسح معيني هندسي',
    nameEn: 'Diamond Wipe',
    category: 'geometric',
    defaultDuration: 0.75,
    descriptionAr: 'تمدد شكل معين يكشف المشهد الجديد',
    previewGradient: 'from-cyan-500/40 to-slate-900',
  },
  {
    id: 'blinds_horizontal',
    nameAr: 'ستائر شرائحية أفقية',
    nameEn: 'Horizontal Blinds',
    category: 'geometric',
    defaultDuration: 0.8,
    descriptionAr: 'انكشاف عبر شرائح أفقية متزامنة',
    previewGradient: 'from-slate-600 to-amber-500/40',
  },
  {
    id: 'blinds_vertical',
    nameAr: 'ستائر شرائحية عمودية',
    nameEn: 'Vertical Blinds',
    category: 'geometric',
    defaultDuration: 0.8,
    descriptionAr: 'انكشاف عبر أعمدة رأسية متزامنة',
    previewGradient: 'from-slate-600 to-cyan-500/40',
  },
  {
    id: 'checkerboard',
    nameAr: 'مربعات شطرنجية',
    nameEn: 'Checkerboard',
    category: 'geometric',
    defaultDuration: 0.85,
    descriptionAr: 'ظهور مربعات متناوبة في كامل الإطار',
    previewGradient: 'from-amber-400/40 to-slate-900',
  },
  {
    id: 'starburst',
    nameAr: 'انفجار نجمي شعاعي',
    nameEn: 'Starburst Wipe',
    category: 'geometric',
    defaultDuration: 0.8,
    descriptionAr: 'قناع نجمي متسع من المنتصف',
    previewGradient: 'from-amber-400/60 to-rose-900/40',
  },
  {
    id: 'barn_doors',
    nameAr: 'فتح بوابة مزدوجة',
    nameEn: 'Barn Doors',
    category: 'geometric',
    defaultDuration: 0.75,
    descriptionAr: 'انفتاح الستار من المنتصف للجانبين',
    previewGradient: 'from-sky-500/40 to-slate-950',
  },
  {
    id: 'diagonal_slice',
    nameAr: 'قطع قطري مائل',
    nameEn: 'Diagonal Slice',
    category: 'geometric',
    defaultDuration: 0.7,
    descriptionAr: 'انزياح قطري حاد بزاوية 45 درجة',
    previewGradient: 'from-emerald-500/40 to-slate-900',
  },
  {
    id: 'clock_radial',
    nameAr: 'مسح ساعي دائري',
    nameEn: 'Clock Radial',
    category: 'geometric',
    defaultDuration: 0.85,
    descriptionAr: 'مسح دائري بزاوية 360 كعقرب الساعة',
    previewGradient: 'from-amber-500/50 to-slate-950',
  },
];

export function applyEasing(t: number, easing: EasingType): number {
  const x = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'linear':
      return x;
    case 'easeInOut':
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    case 'easeOutBack': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
    case 'easeInOutQuint':
      return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
    case 'elastic': {
      if (x === 0 || x === 1) return x;
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
    }
    default:
      return x;
  }
}

export function getTransitionById(id: TransitionType): TransitionDefinition | undefined {
  return TRANSITIONS.find((t) => t.id === id);
}

// Shared scratch canvas used by pixel-based transitions (created lazily).
let pixelScratch: HTMLCanvasElement | null = null;

/**
 * Renders a smooth transition frame from canvasA (outgoing/background) to canvasB (incoming)
 * at progress p in [0, 1].
 */
export function renderTransitionFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fromCanvas: HTMLCanvasElement,
  toCanvas: HTMLCanvasElement,
  type: TransitionType,
  rawProgress: number,
  easing: EasingType = 'easeInOut'
): void {
  const p = Math.max(0, Math.min(1, applyEasing(rawProgress, easing)));
  const lin = Math.max(0, Math.min(1, rawProgress));

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  switch (type) {
    case 'none': {
      ctx.drawImage(toCanvas, 0, 0, width, height);
      break;
    }

    case 'crossfade': {
      ctx.globalAlpha = 1 - p;
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.globalAlpha = p;
      ctx.drawImage(toCanvas, 0, 0, width, height);
      break;
    }

    case 'dip_black': {
      if (lin < 0.5) {
        const sub = lin * 2;
        ctx.drawImage(fromCanvas, 0, 0, width, height);
        ctx.fillStyle = `rgba(0,0,0,${sub})`;
        ctx.fillRect(0, 0, width, height);
      } else {
        const sub = (lin - 0.5) * 2;
        ctx.drawImage(toCanvas, 0, 0, width, height);
        ctx.fillStyle = `rgba(0,0,0,${1 - sub})`;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }

    case 'dip_white': {
      if (lin < 0.5) {
        const sub = lin * 2;
        ctx.drawImage(fromCanvas, 0, 0, width, height);
        ctx.fillStyle = `rgba(255,255,255,${sub})`;
        ctx.fillRect(0, 0, width, height);
      } else {
        const sub = (lin - 0.5) * 2;
        ctx.drawImage(toCanvas, 0, 0, width, height);
        ctx.fillStyle = `rgba(255,255,255,${1 - sub})`;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }

    case 'flash_burn': {
      const peak = Math.sin(lin * Math.PI);
      if (lin < 0.5) {
        ctx.drawImage(fromCanvas, 0, 0, width, height);
      } else {
        ctx.drawImage(toCanvas, 0, 0, width, height);
      }
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        10,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.75
      );
      grad.addColorStop(0, `rgba(255, 245, 220, ${peak * 0.95})`);
      grad.addColorStop(0.5, `rgba(245, 158, 11, ${peak * 0.7})`);
      grad.addColorStop(1, `rgba(255, 255, 255, ${peak * 0.4})`);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      break;
    }

    case 'light_leak': {
      ctx.globalAlpha = 1 - p;
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.globalAlpha = p;
      ctx.drawImage(toCanvas, 0, 0, width, height);
      ctx.globalAlpha = 1;
      const peak = Math.sin(lin * Math.PI);
      const leakX = width * (1.2 - lin * 1.4);
      const grad = ctx.createRadialGradient(
        leakX,
        height * 0.4,
        20,
        leakX,
        height * 0.4,
        width * 0.7
      );
      grad.addColorStop(0, `rgba(255, 190, 90, ${peak * 0.9})`);
      grad.addColorStop(0.45, `rgba(249, 115, 22, ${peak * 0.55})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      break;
    }

    case 'anamorphic_flare': {
      ctx.globalAlpha = 1 - p;
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.globalAlpha = p;
      ctx.drawImage(toCanvas, 0, 0, width, height);
      ctx.globalAlpha = 1;
      const peak = Math.sin(lin * Math.PI);
      ctx.globalCompositeOperation = 'screen';
      const streak = ctx.createLinearGradient(0, height * 0.42, 0, height * 0.58);
      streak.addColorStop(0, 'rgba(56, 189, 248, 0)');
      streak.addColorStop(0.5, `rgba(186, 230, 253, ${peak * 0.95})`);
      streak.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = streak;
      ctx.fillRect(0, height * 0.38, width, height * 0.24);
      break;
    }

    case 'film_burn': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.save();
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.5, Math.hypot(width, height) * 0.65 * p, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(toCanvas, 0, 0, width, height);
      ctx.restore();
      const ringRadius = Math.hypot(width, height) * 0.65 * p;
      const ringGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.max(1, ringRadius - 60),
        width * 0.5,
        height * 0.5,
        ringRadius + 40
      );
      ringGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
      ringGrad.addColorStop(0.5, `rgba(249, 115, 22, ${Math.sin(lin * Math.PI) * 0.9})`);
      ringGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = ringGrad;
      ctx.fillRect(0, 0, width, height);
      break;
    }

    case 'slide_left': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.drawImage(toCanvas, width * (1 - p), 0, width, height);
      break;
    }
    case 'slide_right': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.drawImage(toCanvas, -width * (1 - p), 0, width, height);
      break;
    }
    case 'slide_up': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.drawImage(toCanvas, 0, height * (1 - p), width, height);
      break;
    }
    case 'slide_down': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.drawImage(toCanvas, 0, -height * (1 - p), width, height);
      break;
    }
    case 'push_left': {
      ctx.drawImage(fromCanvas, -width * p, 0, width, height);
      ctx.drawImage(toCanvas, width * (1 - p), 0, width, height);
      break;
    }
    case 'push_right': {
      ctx.drawImage(fromCanvas, width * p, 0, width, height);
      ctx.drawImage(toCanvas, -width * (1 - p), 0, width, height);
      break;
    }

    case 'whip_pan': {
      const blurAmount = Math.sin(lin * Math.PI) * 18;
      ctx.filter = `blur(${blurAmount.toFixed(1)}px)`;
      ctx.drawImage(fromCanvas, -width * p, 0, width, height);
      ctx.drawImage(toCanvas, width * (1 - p), 0, width, height);
      ctx.filter = 'none';
      break;
    }

    case 'zoom_in_cross': {
      const s1 = 1 + p * 0.65;
      const s2 = 0.65 + p * 0.35;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.translate(width / 2, height / 2);
      ctx.scale(s1, s1);
      ctx.drawImage(fromCanvas, -width / 2, -height / 2, width, height);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = p;
      ctx.translate(width / 2, height / 2);
      ctx.scale(s2, s2);
      ctx.drawImage(toCanvas, -width / 2, -height / 2, width, height);
      ctx.restore();
      break;
    }

    case 'zoom_out_cross': {
      const s1 = 1 - p * 0.4;
      const s2 = 1.6 - p * 0.6;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.translate(width / 2, height / 2);
      ctx.scale(s1, s1);
      ctx.drawImage(fromCanvas, -width / 2, -height / 2, width, height);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = p;
      ctx.translate(width / 2, height / 2);
      ctx.scale(s2, s2);
      ctx.drawImage(toCanvas, -width / 2, -height / 2, width, height);
      ctx.restore();
      break;
    }

    case 'spin_twist': {
      const angle = (1 - p) * Math.PI;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.translate(width / 2, height / 2);
      ctx.rotate(-p * Math.PI * 0.5);
      ctx.scale(1 + p * 0.4, 1 + p * 0.4);
      ctx.drawImage(fromCanvas, -width / 2, -height / 2, width, height);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = p;
      ctx.translate(width / 2, height / 2);
      ctx.rotate(angle);
      ctx.scale(0.5 + 0.5 * p, 0.5 + 0.5 * p);
      ctx.drawImage(toCanvas, -width / 2, -height / 2, width, height);
      ctx.restore();
      break;
    }

    case 'elastic_bounce': {
      const bounce = applyEasing(lin, 'easeOutBack');
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2, height / 2);
      const s = Math.max(0.05, bounce);
      ctx.scale(s, s);
      ctx.globalAlpha = Math.min(1, lin * 2);
      ctx.drawImage(toCanvas, -width / 2, -height / 2, width, height);
      ctx.restore();
      break;
    }

    case 'glitch_rgb': {
      const intensity = Math.sin(lin * Math.PI);
      const base = lin < 0.5 ? fromCanvas : toCanvas;
      ctx.drawImage(base, 0, 0, width, height);
      const slices = 12;
      const sliceH = height / slices;
      for (let i = 0; i < slices; i++) {
        const seed = Math.sin(i * 19.7 + lin * 37.3);
        const offset = seed * 45 * intensity;
        const src = i % 2 === 0 ? toCanvas : fromCanvas;
        if (Math.abs(seed) > 0.25) {
          ctx.drawImage(src, 0, i * sliceH, width, sliceH, offset, i * sliceH, width, sliceH);
        }
      }
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = intensity * 0.5;
      ctx.drawImage(toCanvas, 16 * intensity, 0, width, height);
      ctx.drawImage(fromCanvas, -16 * intensity, 0, width, height);
      break;
    }

    case 'chromatic_shake': {
      const intensity = Math.sin(lin * Math.PI);
      const dx = Math.sin(lin * 48) * 28 * intensity;
      const dy = Math.cos(lin * 39) * 18 * intensity;
      const base = lin < 0.5 ? fromCanvas : toCanvas;
      ctx.drawImage(base, dx, dy, width, height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 * intensity;
      ctx.drawImage(toCanvas, -dx * 1.4, -dy, width, height);
      break;
    }

    case 'pixelate_dissolve': {
      const peak = Math.sin(lin * Math.PI);
      const blocks = Math.max(8, Math.round(64 - peak * 52));
      const base = lin < 0.5 ? fromCanvas : toCanvas;
      const smallW = Math.max(8, Math.round(blocks * (width / height)));
      const smallH = Math.max(8, blocks);
      // Downscale into a scratch canvas first — drawing the main canvas into
      // itself produced garbage blocks and corrupted the frame.
      if (!pixelScratch) pixelScratch = document.createElement('canvas');
      if (pixelScratch.width !== smallW || pixelScratch.height !== smallH) {
        pixelScratch.width = smallW;
        pixelScratch.height = smallH;
      }
      const sCtx = pixelScratch.getContext('2d');
      if (!sCtx) break;
      sCtx.imageSmoothingEnabled = false;
      sCtx.clearRect(0, 0, smallW, smallH);
      sCtx.drawImage(base, 0, 0, width, height, 0, 0, smallW, smallH);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pixelScratch, 0, 0, smallW, smallH, 0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      break;
    }

    case 'ripple_wave': {
      ctx.globalAlpha = 1 - p;
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.globalAlpha = p;
      const strips = 24;
      const stripH = height / strips;
      const amp = Math.sin(lin * Math.PI) * 32;
      for (let i = 0; i < strips; i++) {
        const wave = Math.sin(i * 0.6 + lin * Math.PI * 4) * amp;
        ctx.drawImage(toCanvas, 0, i * stripH, width, stripH, wave, i * stripH, width, stripH);
      }
      break;
    }

    case 'vortex_swirl': {
      const peak = Math.sin(lin * Math.PI);
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.translate(width / 2, height / 2);
      ctx.rotate(p * Math.PI * 1.5);
      ctx.scale(1 - p * 0.7, 1 - p * 0.7);
      ctx.drawImage(fromCanvas, -width / 2, -height / 2, width, height);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = p;
      ctx.translate(width / 2, height / 2);
      ctx.rotate(-(1 - p) * Math.PI * 1.5);
      ctx.scale(0.3 + p * 0.7 + peak * 0.1, 0.3 + p * 0.7 + peak * 0.1);
      ctx.drawImage(toCanvas, -width / 2, -height / 2, width, height);
      ctx.restore();
      break;
    }

    case 'kaleidoscope_flip': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.save();
      ctx.globalAlpha = p;
      const halfW = width / 2;
      const halfH = height / 2;
      const offset = (1 - p) * 60;
      ctx.drawImage(toCanvas, 0, 0, halfW, halfH, -offset, -offset, halfW, halfH);
      ctx.drawImage(toCanvas, halfW, 0, halfW, halfH, halfW + offset, -offset, halfW, halfH);
      ctx.drawImage(toCanvas, 0, halfH, halfW, halfH, -offset, halfH + offset, halfW, halfH);
      ctx.drawImage(toCanvas, halfW, halfH, halfW, halfH, halfW + offset, halfH + offset, halfW, halfH);
      ctx.restore();
      break;
    }

    case 'iris_circle': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.save();
      ctx.beginPath();
      const maxR = Math.hypot(width / 2, height / 2);
      ctx.arc(width / 2, height / 2, maxR * p, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(toCanvas, 0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'diamond_wipe': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.save();
      ctx.beginPath();
      const r = (width + height) * 0.75 * p;
      ctx.moveTo(width / 2, height / 2 - r);
      ctx.lineTo(width / 2 + r, height / 2);
      ctx.lineTo(width / 2, height / 2 + r);
      ctx.lineTo(width / 2 - r, height / 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(toCanvas, 0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'blinds_horizontal': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      const count = 10;
      const bandH = height / count;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        ctx.rect(0, i * bandH, width, bandH * p);
      }
      ctx.clip();
      ctx.drawImage(toCanvas, 0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'blinds_vertical': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      const count = 12;
      const bandW = width / count;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        ctx.rect(i * bandW, 0, bandW * p, height);
      }
      ctx.clip();
      ctx.drawImage(toCanvas, 0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'checkerboard': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      const cols = 8;
      const rows = 5;
      const cw = width / cols;
      const ch = height / rows;
      ctx.save();
      ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const delay = ((r + c) / (rows + cols)) * 0.5;
          const cellP = Math.max(0, Math.min(1, (p - delay) / 0.5));
          if (cellP > 0) {
            const w = cw * cellP;
            const h = ch * cellP;
            ctx.rect(c * cw + (cw - w) / 2, r * ch + (ch - h) / 2, w, h);
          }
        }
      }
      ctx.clip();
      ctx.drawImage(toCanvas, 0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'starburst': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.save();
      ctx.beginPath();
      const spikes = 10;
      const outerR = Math.hypot(width, height) * 0.85 * p;
      const innerR = outerR * 0.48;
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerR : innerR;
        const a = (i * Math.PI) / spikes - Math.PI / 2;
        const px = width / 2 + Math.cos(a) * radius;
        const py = height / 2 + Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(toCanvas, 0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'barn_doors': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.save();
      ctx.beginPath();
      const openW = (width / 2) * p;
      ctx.rect(width / 2 - openW, 0, openW * 2, height);
      ctx.clip();
      ctx.drawImage(toCanvas, 0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'diagonal_slice': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.save();
      ctx.beginPath();
      const offset = (width + height) * p;
      ctx.moveTo(0, 0);
      ctx.lineTo(offset, 0);
      ctx.lineTo(0, offset);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(toCanvas, 0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'clock_radial': {
      ctx.drawImage(fromCanvas, 0, 0, width, height);
      ctx.save();
      ctx.beginPath();
      const maxR = Math.hypot(width, height);
      ctx.moveTo(width / 2, height / 2);
      ctx.arc(width / 2, height / 2, maxR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(toCanvas, 0, 0, width, height);
      ctx.restore();
      break;
    }
  }

  ctx.restore();
}
