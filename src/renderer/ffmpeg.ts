// Shared ffmpeg helpers for the Node backends. Both the sequential renderer
// (node.ts) and the parallel segment renderer (node-parallel.ts) drive ffmpeg
// the same way, so these live in one leaf module to keep partial-movie files
// byte-compatible across both cache paths. Node-only (spawns the `ffmpeg` CLI).

/// <reference types="node" />
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname } from "node:path";

// Start an ffmpeg process reading PNGs from stdin (image2pipe) and encoding to
// `outPath`. Codec/pixel-format is chosen by `format` ("webm" | "gif" | "mov" |
// otherwise mp4/h264). `transparent` is accepted for signature compatibility but
// unused here — transparency is decided upstream by picking the .mov (prores)
// container, since h264 cannot store an alpha channel.
export function startFfmpeg(
  { fps, pixelWidth, pixelHeight, outPath, format, verbose }: any,
) {
  const args = [
    "-y",
    "-f", "image2pipe",
    "-framerate", String(fps),
    "-i", "-",
    "-s", `${pixelWidth}x${pixelHeight}`,
  ];
  if (format === "webm") {
    // VP9 with alpha (yuva420p) — transparent by default.
    args.push("-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "30");
  } else if (format === "gif") {
    args.push("-vf", `fps=${fps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`);
  } else if (format === "mov") {
    // ProRes 4444 preserves an alpha channel — the transparent-capable path.
    args.push("-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le");
  } else {
    // mp4 / h264. h264 cannot store alpha; transparency uses the .mov fallback.
    args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "18", "-movflags", "+faststart");
  }
  args.push(outPath);
  return spawn("ffmpeg", args, { stdio: ["pipe", "inherit", verbose ? "inherit" : "ignore"] });
}

// Write one buffer to a stream, honoring backpressure (await the drain event
// when the internal buffer is full).
export function writeToStream(stream: any, buf: any): Promise<void> {
  return new Promise<void>((res) => {
    if (!stream.write(buf)) stream.once("drain", res);
    else res();
  });
}

// Encode an array of PNG buffers to a single file via startFfmpeg. Used to write
// one partial-movie file per animation segment.
export async function encodeFrames(frames: any[], opts: any): Promise<void> {
  const { outPath } = opts;
  mkdirSync(dirname(outPath), { recursive: true });
  const ff = startFfmpeg(opts);
  for (const buf of frames) await writeToStream(ff.stdin, buf);
  ff.stdin.end();
  await new Promise<void>((res, rej) => {
    ff.on("close", (code: number) => (code === 0 ? res() : rej(new Error("ffmpeg partial exited " + code))));
    ff.on("error", rej);
  });
}

// Run a one-shot ffmpeg command. Resolves true on exit 0; on failure either
// rejects (throwOnFail) or resolves false so callers can attempt a fallback.
export function runFfmpeg(args: string[], verbose: boolean, throwOnFail = false): Promise<boolean> {
  return new Promise<boolean>((res, rej) => {
    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "inherit", verbose ? "inherit" : "ignore"] });
    ff.on("close", (code: number) => {
      if (code === 0) res(true);
      else if (throwOnFail) rej(new Error("ffmpeg exited " + code));
      else res(false);
    });
    ff.on("error", (e) => (throwOnFail ? rej(e) : res(false)));
  });
}

// Concatenate partial movie files into the final output using ffmpeg's concat
// demuxer (stream copy — no re-encode). Falls back to a re-encode concat if
// stream-copy fails (e.g. mismatched partials).
export async function concatPartials(partials: string[], outPath: string, verbose: boolean): Promise<void> {
  const listPath = outPath.replace(/\.[^.]+$/, "") + ".concat.txt";
  const body = partials.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n") + "\n";
  writeFileSync(listPath, body);
  const args = ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath];
  const ok = await runFfmpeg(args, verbose);
  if (!ok) {
    // Re-encode fallback.
    const args2 = ["-y", "-f", "concat", "-safe", "0", "-i", listPath, outPath];
    await runFfmpeg(args2, verbose, true);
  }
  if (existsSync(listPath)) rmSync(listPath);
}

// Copy/remux a single partial to the final output (stream copy).
export async function remuxCopy(src: string, outPath: string, verbose: boolean): Promise<void> {
  const ok = await runFfmpeg(["-y", "-i", src, "-c", "copy", outPath], verbose);
  if (!ok) await runFfmpeg(["-y", "-i", src, outPath], verbose, true);
}
