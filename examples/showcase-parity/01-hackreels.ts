// Showcase parity: HackReels (hackreels.com) — animated code walkthroughs.
// Proves: Code mobject with syntax highlighting, diffTo() token-matched code
// morphs, MovingCamera push-in on the changed region, and per-line glow
// effects (Cluster A) calling out the diff.

import { MovingCameraScene, Code, Text, FadeIn, FadeOut, Write } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const V1 = `function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}`;

const V2 = `function fib(n, memo = {}) {
  if (n < 2) return n;
  memo[n] ??= fib(n - 1, memo)
    + fib(n - 2, memo);
  return memo[n];
}`;

class HackReels extends MovingCameraScene {
  async construct() {
    const title = new Text("Memoize it.", { fontSize: 0.8, color: "#FFE066", point: [0, 3.2, 0] });
    await this.play(new Write(title), { runTime: 0.8 });

    const before = new Code(V1, { language: "javascript", fontSize: 0.36, lineNumbers: false });
    before.moveTo([0, -0.4, 0]);
    await this.play(new FadeIn(before, { shift: [0, 0.4, 0] }), { runTime: 0.8 });
    await this.wait(0.8);

    // Token-matched code morph (the HackReels signature move).
    const after = new Code(V2, { language: "javascript", fontSize: 0.36, lineNumbers: false });
    after.moveTo([0, -0.4, 0]);
    await this.play(before.diffTo(after), { runTime: 1.6 });
    await this.wait(0.4);

    // Camera push-in on the memo lines + glow the new logic.
    const memoLine = after.codeLines.submobjects[2];
    const frame = this.camera!.frame!;
    await this.play(frame.animate.scale(0.72).moveTo([0, -0.75, 0]), { runTime: 1.2 });
    const glowTargets = [2, 3, 4].map((i) => after.codeLines.submobjects[i]).filter(Boolean);
    for (const line of glowTargets) line.glow(40, "#FFE066", 1.4);
    await this.wait(1.2);
    for (const line of glowTargets) line.clearEffects();
    void memoLine;

    // Pull back out and close.
    await this.play(frame.animate.scale(1 / 0.72).moveTo([0, 0, 0]), { runTime: 1.0 });
    await this.wait(0.3);
    await this.play(new FadeOut(before), new FadeOut(after), new FadeOut(title), { runTime: 0.8 });
  }
}

await demoRender(HackReels, import.meta.url, { background: "#0e1116" });
