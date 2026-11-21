import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveFfmpegBinary, resolveFfprobeBinary } from '@/lib/server/ffmpegCheck';

export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const maxDuration = 120;

const execFileAsync = promisify(execFile);

interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  hasVideo: boolean;
  hasAudio: boolean;
  codecName: string;
}

async function probeMedia(ffprobeBin: string | null, filePath: string): Promise<ProbeResult> {
  if (!ffprobeBin) {
    return { duration: 5, width: 1920, height: 1080, hasVideo: true, hasAudio: false, codecName: 'unknown' };
  }
  try {
    const { stdout } = await execFileAsync(ffprobeBin, [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);
    const parsed = JSON.parse(stdout);
    const streams: Array<Record<string, unknown>> = Array.isArray(parsed.streams)
      ? parsed.streams
      : [];
    const videoStream = streams.find((s) => s.codec_type === 'video');
    const audioStream = streams.find((s) => s.codec_type === 'audio');
    const duration = Number(parsed.format?.duration) || Number(videoStream?.duration) || 5;

    return {
      duration: Math.max(0.5, duration),
      width: Number(videoStream?.width) || 1920,
      height: Number(videoStream?.height) || 1080,
      hasVideo: Boolean(videoStream),
      hasAudio: Boolean(audioStream),
      codecName: String(videoStream?.codec_name || audioStream?.codec_name || 'unknown'),
    };
  } catch {
    return {
      duration: 5,
      width: 1920,
      height: 1080,
      hasVideo: true,
      hasAudio: false,
      codecName: 'unknown',
    };
  }
}

export async function POST(req: NextRequest) {
  let workDir = '';
  try {
    const ffmpegBin = await resolveFfmpegBinary();
    if (!ffmpegBin) {
      return NextResponse.json(
        {
          error: 'تحويل الصيغ غير المدعومة على الخادم غير متاح في الاستضافة السحابية الحالية.',
          code: 'FFMPEG_UNAVAILABLE',
        },
        { status: 501 }
      );
    }
    const ffprobeBin = await resolveFfprobeBinary();

    const formData = await req.formData();
    const file = formData.get('file');
    const kind = String(formData.get('kind') || 'video');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'لم يتم إرفاق ملف صالح' }, { status: 400 });
    }

    workDir = await mkdtemp(path.join(tmpdir(), 'cinestudio-transcode-'));
    const safeExt = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
    const inputPath = path.join(workDir, `input${safeExt}`);
    const arrayBuffer = await file.arrayBuffer();
    await writeFile(inputPath, Buffer.from(arrayBuffer));

    const probe = await probeMedia(ffprobeBin, inputPath);

    let outputPath = '';
    let outputMime = '';

    if (kind === 'image') {
      outputPath = path.join(workDir, 'proxy.png');
      outputMime = 'image/png';
      await execFileAsync(ffmpegBin, ['-y', '-i', inputPath, '-frames:v', '1', outputPath]);
    } else if (kind === 'audio') {
      outputPath = path.join(workDir, 'proxy.mp3');
      outputMime = 'audio/mpeg';
      await execFileAsync(ffmpegBin, [
        '-y',
        '-i',
        inputPath,
        '-vn',
        '-c:a',
        'libmp3lame',
        '-b:a',
        '192k',
        outputPath,
      ]);
    } else {
      outputPath = path.join(workDir, 'proxy.mp4');
      outputMime = 'video/mp4';
      const args = [
        '-y',
        '-i',
        inputPath,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '22',
        '-pix_fmt',
        'yuv420p',
        '-vf',
        'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      ];
      if (probe.hasAudio) {
        args.push('-c:a', 'aac', '-b:a', '192k');
      } else {
        args.push('-an');
      }
      args.push('-movflags', '+faststart', outputPath);
      await execFileAsync(ffmpegBin, args);
    }

    const outBuffer = await readFile(outputPath);
    return new NextResponse(new Uint8Array(outBuffer), {
      status: 200,
      headers: {
        'Content-Type': outputMime,
        'X-Media-Duration': String(probe.duration),
        'X-Media-Width': String(probe.width),
        'X-Media-Height': String(probe.height),
        'X-Media-Codec': probe.codecName,
      },
    });
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : '';
    if (rawMsg.includes('ENOENT')) {
      return NextResponse.json(
        { error: 'محرك تحويل الصيغ على الخادم غير متوفر', code: 'FFMPEG_UNAVAILABLE' },
        { status: 501 }
      );
    }
    return NextResponse.json({ error: rawMsg || 'فشلت عملية تحويل الصيغة' }, { status: 500 });
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
