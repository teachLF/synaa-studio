import { NextResponse } from 'next/server';
import { resolveFfmpegBinary, resolveFfprobeBinary } from '@/lib/server/ffmpegCheck';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export async function GET() {
  const [ffmpegPath, ffprobePath] = await Promise.all([
    resolveFfmpegBinary(),
    resolveFfprobeBinary(),
  ]);

  return NextResponse.json({
    ffmpeg: Boolean(ffmpegPath),
    ffprobe: Boolean(ffprobePath),
  });
}
