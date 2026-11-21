import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const FFMPEG_CANDIDATES = [
  process.env.FFMPEG_PATH,
  '/usr/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/opt/homebrew/bin/ffmpeg',
].filter((v): v is string => Boolean(v && v.trim()));

const FFPROBE_CANDIDATES = [
  process.env.FFPROBE_PATH,
  '/usr/bin/ffprobe',
  '/usr/local/bin/ffprobe',
  '/opt/homebrew/bin/ffprobe',
].filter((v): v is string => Boolean(v && v.trim()));

async function findExecutable(candidates: string[], fallbackCmd: string): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // continue checking next path
    }
  }
  try {
    await execFileAsync(fallbackCmd, ['-version'], { timeout: 2500 });
    return fallbackCmd;
  } catch {
    return null;
  }
}

export async function resolveFfmpegBinary(): Promise<string | null> {
  return findExecutable(FFMPEG_CANDIDATES, 'ffmpeg');
}

export async function resolveFfprobeBinary(): Promise<string | null> {
  return findExecutable(FFPROBE_CANDIDATES, 'ffprobe');
}
