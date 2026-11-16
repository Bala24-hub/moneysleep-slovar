// Обработка звука через ffmpeg: обрезка тишины по краям, громкость, склейка прослушки.
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

async function ffmpeg(args: string[]): Promise<string> {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], { maxBuffer: 32 << 20 });
  return stderr;
}

/** Интегральная громкость (LUFS) по EBU R128. */
export async function loudness(file: string): Promise<number> {
  const err = await ffmpeg(['-i', file, '-af', 'ebur128', '-f', 'null', '-']);
  const m = [...err.matchAll(/^\s+I:\s+(-?[\d.]+) LUFS/gm)].pop();
  if (!m) throw new Error(`не удалось измерить громкость: ${file}`);
  return Number(m[1]);
}

export interface Shape {
  targetLufs: number;
  peakLimit: number;
  keepSilenceSec: number;
  silenceThresholdDb: number;
}

/**
 * raw (mp3 от API) → out (mp3 44.1 кГц, моно, 128 кбит/с):
 * тишина по краям обрезается до keepSilenceSec, громкость → targetLufs (усиление + лимитер пиков).
 */
export async function shape(raw: string, out: string, o: Shape): Promise<number> {
  const dir = mkdtempSync(join(tmpdir(), 'ms-voice-'));
  try {
    const trimmed = join(dir, 'trim.wav');
    const sr = `silenceremove=start_periods=1:start_threshold=${o.silenceThresholdDb}dB:start_silence=${o.keepSilenceSec}:detection=peak`;
    await ffmpeg(['-i', raw, '-af', `${sr},areverse,${sr},areverse`, '-ar', '44100', '-ac', '1', trimmed]);
    let gain = o.targetLufs - (await loudness(trimmed));
    let got = NaN;
    for (let pass = 0; pass < 3; pass++) {
      await ffmpeg(['-i', trimmed, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=${o.peakLimit}:attack=3:release=40:level=false`, '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', out]);
      got = await loudness(out);
      if (Math.abs(got - o.targetLufs) <= 0.3) break;
      gain += o.targetLufs - got;
    }
    return got;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Прослушка: файлы подряд с паузой gapSec. */
export async function concatWithGaps(files: string[], out: string, gapSec: number): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'ms-preview-'));
  try {
    const gap = join(dir, 'gap.wav');
    await ffmpeg(['-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono`, '-t', String(gapSec), gap]);
    const parts: string[] = [];
    for (const [i, f] of files.entries()) {
      const w = join(dir, `${i}.wav`);
      await ffmpeg(['-i', f, '-ar', '44100', '-ac', '1', w]);
      parts.push(w, gap);
    }
    const list = join(dir, 'list.txt');
    writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
    await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'libmp3lame', '-b:a', '128k', out]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
