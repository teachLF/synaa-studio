import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getEstimatedBitrateKbps, getExportDimensions } from '@/lib/editor/timelineMath';
import type { ExportSettings } from '@/lib/editor/types';
import { resolveFfmpegBinary } from '@/lib/server/ffmpegCheck';

export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const maxDuration = 180;

const execFileAsync = promisify(execFile);

const VIDEO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  gif: 'image/gif',
};

export async function POST(req: NextRequest) {
  let workDir = '';
  try {
    const ffmpegBin = await resolveFfmpegBinary();
    if (!ffmpegBin) {
      return NextResponse.json(
        {
          error: 'محرك الخادم غير متاح في بيئة الاستضافة الحالية؛ يتم التصدير مباشرة عبر المتصفح.',
          code: 'FFMPEG_UNAVAILABLE',
          fallbackToClient: true,
        },
        { status: 501 }
      );
    }

    const formData = await req.formData();
    const videoFile = formData.get('video');
    const audioFile = formData.get('audio');
    const settingsRaw = String(formData.get('settings') || '{}');
    const settings = JSON.parse(settingsRaw) as ExportSettings;

    if (!(videoFile instanceof File)) {
      return NextResponse.json({ error: 'بيانات الفيديو المصدّر مفقودة' }, { status: 400 });
    }

    const resolution = settings.resolution || '1080p';
    const aspectRatio = settings.aspectRatio || '16:9';
    const fps = settings.fps || 30;
    const format = settings.format || 'mp4';
    const codec = settings.codec || 'h264';
    const quality = settings.quality || 'high';
    const includeDenoise = Boolean(settings.includeDenoise);

    const { width, height } = getExportDimensions(resolution, aspectRatio);
    const bitrateKbps = getEstimatedBitrateKbps(resolution, quality, fps);

    workDir = await mkdtemp(path.join(tmpdir(), 'cinestudio-export-'));
    const videoPath = path.join(workDir, 'capture.webm');
    await writeFile(videoPath, Buffer.from(await videoFile.arrayBuffer()));

    let audioPath: string | null = null;
    if (audioFile instanceof File && audioFile.size > 44) {
      audioPath = path.join(workDir, 'mixdown.wav');
      await writeFile(audioPath, Buffer.from(await audioFile.arrayBuffer()));
    }

    const outExt = format in VIDEO_MIME ? format : 'mp4';
    const outputPath = path.join(workDir, `export_master.${outExt}`);

    const args: string[] = ['-y', '-threads', '0', '-i', videoPath];
    if (audioPath) {
      args.push('-i', audioPath);
    }

    if (outExt === 'gif') {
      args.push(
        '-vf',
        `fps=${Math.min(fps, 24)},scale=${Math.min(width, 1280)}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
        '-loop',
        '0',
        outputPath
      );
    } else {
      args.push('-vf', `scale=${width}:${height}:flags=lanczos,fps=${fps}`);

      if (audioPath) {
        args.push('-map', '0:v:0', '-map', '1:a:0', '-shortest');
      } else {
        args.push('-map', '0:v:0', '-an');
      }

      if (outExt === 'webm' || codec === 'vp9') {
        if (outExt === 'webm') {
          args.push('-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '6', '-b:v', `${bitrateKbps}k`);
          if (audioPath) args.push('-c:a', 'libopus', '-b:a', '192k');
        } else {
          args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', `${bitrateKbps}k`, '-pix_fmt', 'yuv420p');
          if (audioPath) args.push('-c:a', 'aac', '-b:a', '256k');
        }
      } else if (codec === 'h265' && (outExt === 'mp4' || outExt === 'mov' || outExt === 'mkv')) {
        args.push('-c:v', 'libx265', '-preset', 'ultrafast', '-b:v', `${Math.round(bitrateKbps * 0.75)}k`, '-pix_fmt', 'yuv420p');
        if (audioPath) args.push('-c:a', 'aac', '-b:a', '256k');
      } else if (codec === 'prores' && outExt === 'mov') {
        args.push('-c:v', 'prores_ks', '-profile:v', '2', '-pix_fmt', 'yuv422p10le');
        if (audioPath) args.push('-c:a', 'pcm_s16le');
      } else {
        args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', `${bitrateKbps}k`, '-pix_fmt', 'yuv420p');
        if (audioPath) {
          args.push('-c:a', outExt === 'avi' ? 'libmp3lame' : 'aac', '-b:a', '256k');
        }
      }

      if (audioPath && includeDenoise) {
        args.push('-af', 'highpass=f=120,lowpass=f=11000,afftdn=nf=-32:nt=w,loudnorm=I=-14:TP=-1.5');
      }

      if (outExt === 'mp4' || outExt === 'mov') {
        args.push('-movflags', '+faststart');
      }
      args.push(outputPath);
    }

    await execFileAsync(ffmpegBin, args);
    const outBuffer = await readFile(outputPath);

    return new NextResponse(new Uint8Array(outBuffer), {
      status: 200,
      headers: {
        'Content-Type': VIDEO_MIME[outExt] || 'video/mp4',
        'Content-Disposition': `attachment; filename="cinestudio_${resolution}.${outExt}"`,
        'X-Export-Dimensions': `${width}x${height}`,
      },
    });
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : '';
    if (rawMsg.includes('ENOENT')) {
      return NextResponse.json(
        {
          error: 'محرك الخادم غير متاح؛ يتم التصدير مباشرة عبر المتصفح.',
          code: 'FFMPEG_UNAVAILABLE',
          fallbackToClient: true,
        },
        { status: 501 }
      );
    }
    return NextResponse.json(
      { error: rawMsg || 'تعذر تصدير الفيديو' },
      { status: 500 }
    );
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
