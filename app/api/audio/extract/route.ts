import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveFfmpegBinary } from '@/lib/server/ffmpegCheck';

export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const maxDuration = 120;

const execFileAsync = promisify(execFile);

const FORMAT_META: Record<string, { ext: string; mime: string; codec: string[] }> = {
  mp3: { ext: 'mp3', mime: 'audio/mpeg', codec: ['-c:a', 'libmp3lame'] },
  wav: { ext: 'wav', mime: 'audio/wav', codec: ['-c:a', 'pcm_s16le'] },
  aac: { ext: 'm4a', mime: 'audio/mp4', codec: ['-c:a', 'aac'] },
  flac: { ext: 'flac', mime: 'audio/flac', codec: ['-c:a', 'flac'] },
  ogg: { ext: 'ogg', mime: 'audio/ogg', codec: ['-c:a', 'libvorbis'] },
};

export async function POST(req: NextRequest) {
  let workDir = '';
  try {
    const ffmpegBin = await resolveFfmpegBinary();
    if (!ffmpegBin) {
      return NextResponse.json(
        {
          error: 'محرك الخادم غير متاح؛ يتم التحويل مباشرة عبر المتصفح.',
          code: 'FFMPEG_UNAVAILABLE',
          fallbackToClient: true,
        },
        { status: 501 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const format = String(formData.get('format') || 'mp3').toLowerCase();
    const bitrate = String(formData.get('bitrate') || '320k').replace(/[^0-9k]/g, '') || '320k';
    const sampleRate = Number(formData.get('sampleRate')) === 44100 ? 44100 : 48000;
    const denoiseEnabled = formData.get('denoiseEnabled') === 'true';
    const denoiseStrength = Math.max(0, Math.min(100, Number(formData.get('denoiseStrength') ?? 85)));
    const windCutHz = Math.max(20, Math.min(400, Number(formData.get('windCutHz') ?? 140)));
    const hissCutHz = Math.max(3000, Math.min(18500, Number(formData.get('hissCutHz') ?? 10500)));
    const voiceBoost = Math.max(0, Math.min(12, Number(formData.get('voiceBoost') ?? 5)));
    const normalize = formData.get('normalize') !== 'false';
    const startSec = Number(formData.get('start') || 0);
    const durationSec = Number(formData.get('duration') || 0);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'يرجى إرفاق ملف فيديو أو صوت صالح' }, { status: 400 });
    }

    const fmtMeta = FORMAT_META[format] || FORMAT_META.mp3;

    workDir = await mkdtemp(path.join(tmpdir(), 'cinestudio-audio-'));
    const safeExt = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
    const inputPath = path.join(workDir, `source${safeExt}`);
    const outputPath = path.join(workDir, `extracted.${fmtMeta.ext}`);

    const arrBuf = await file.arrayBuffer();
    await writeFile(inputPath, Buffer.from(arrBuf));

    const args: string[] = ['-y'];
    if (startSec > 0) {
      args.push('-ss', startSec.toFixed(3));
    }
    args.push('-i', inputPath);
    if (durationSec > 0) {
      args.push('-t', durationSec.toFixed(3));
    }
    args.push('-vn');

    const filters: string[] = [];
    if (denoiseEnabled) {
      const nf = -Math.round(18 + (denoiseStrength / 100) * 32);
      filters.push(`highpass=f=${windCutHz}`);
      filters.push(`lowpass=f=${hissCutHz}`);
      filters.push(`afftdn=nf=${nf}:nt=w`);
      if (voiceBoost > 0) {
        filters.push(`equalizer=f=2900:width_type=q:width=1.2:g=${voiceBoost}`);
      }
      if (normalize) {
        filters.push('loudnorm=I=-14:TP=-1.5:LRA=11');
      }
    }

    if (filters.length > 0) {
      args.push('-af', filters.join(','));
    }

    args.push('-ar', String(sampleRate), '-ac', '2', ...fmtMeta.codec);
    if (format !== 'wav' && format !== 'flac') {
      args.push('-b:a', bitrate);
    }
    args.push(outputPath);

    await execFileAsync(ffmpegBin, args);
    const outBuffer = await readFile(outputPath);

    return new NextResponse(new Uint8Array(outBuffer), {
      status: 200,
      headers: {
        'Content-Type': fmtMeta.mime,
        'Content-Disposition': `attachment; filename="extracted_audio.${fmtMeta.ext}"`,
        'X-Audio-Format': fmtMeta.ext.toUpperCase(),
      },
    });
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : '';
    if (rawMsg.includes('ENOENT')) {
      return NextResponse.json(
        {
          error: 'محرك الخادم غير متاح؛ يتم التحويل عبر المتصفح.',
          code: 'FFMPEG_UNAVAILABLE',
          fallbackToClient: true,
        },
        { status: 501 }
      );
    }
    return NextResponse.json(
      { error: rawMsg || 'تعذر استخراج الصوت من الملف' },
      { status: 500 }
    );
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
