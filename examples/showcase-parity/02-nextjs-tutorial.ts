// Showcase parity: Next.js tutorial videos — narrated coding explainers.
// Proves: voiceover() with <bookmark/> sync (silent provider by default —
// set ECMANIM_TTS=openai for real narration), TypeWithCursor live typing,
// the lowerThird template, and nextSection() chaptering.

import {
  Scene, Code, Text, FadeIn, FadeOut, Write, TypeWithCursor,
  voiceover, lowerThird,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const SNIPPET = `export default async function Page() {
  const posts = await getPosts();
  return <PostList posts={posts} />;
}`;

class NextjsTutorial extends Scene {
  async construct() {
    this.nextSection("intro");
    const title = new Text("Server Components in 30s", { fontSize: 0.75, color: "#F5F6F8", point: [0, 3.1, 0] });
    const host = lowerThird("Sam Rivera", { role: "Next.js instructor", theme: "midnight" });
    await this.play(new Write(title), { runTime: 0.9 });
    await this.play(host.animateIn());

    this.nextSection("typing");
    const code = new Code(SNIPPET, { language: "javascript", fontSize: 0.4 });
    code.moveTo([0, 0.1, 0]);
    const provider = (process.env.ECMANIM_TTS as any) ?? "silent";
    await voiceover(
      this,
      "This whole page is a server component. <bookmark mark='fetch'/> The data " +
      "fetch runs on the server, <bookmark mark='render'/> and only the rendered " +
      "list ships to the browser.",
      async (vt) => {
        await this.play(new TypeWithCursor(code, undefined, { timePerChar: 0.012 }));
        await vt.waitUntilBookmark("fetch");
        const fetchLine = code.codeLines.submobjects[1];
        fetchLine.glow(24, "#58C4DD", 0.8);
        await this.wait(0.6);
        await vt.waitUntilBookmark("render");
        fetchLine.clearEffects();
        code.codeLines.submobjects[2].glow(24, "#83C167", 0.8);
        await this.wait(0.6);
        code.codeLines.submobjects[2].clearEffects();
      },
      { provider },
    );

    this.nextSection("outro");
    const takeaway = new Text("Zero client JS for data fetching", { fontSize: 0.5, color: "#FFE066", point: [0, -3.0, 0] });
    await this.play(new FadeIn(takeaway, { shift: [0, 0.3, 0] }), { runTime: 0.7 });
    await this.wait(1.0);
    await this.play(new FadeOut(code), new FadeOut(takeaway), new FadeOut(title), host.animateOut(), { runTime: 0.8 });
  }
}

await demoRender(NextjsTutorial, import.meta.url, { background: "#101216" });
