# Voiceover / TTS-synced narration

Phase-3 adoption (manim-voiceover style). Exported from `manim-js/node`.

```js
import { render, voiceover } from "manim-js/node";

class Narrated extends Scene {
  async construct() {
    await voiceover(
      this,
      "First a circle <bookmark mark='sq'/> then a square.",
      async (vt) => {
        await this.play(new Create(circle), { _playConfig: true, runTime: vt.duration });
        await vt.waitUntilBookmark("sq");     // advance the scene to the '<bookmark>'
        await this.play(new FadeIn(square));
      },
      { provider: "system" },                  // or "openai" | "elevenlabs" | "silent"
    );
  }
}
```

`voiceover()` synthesizes the narration, adds it to the scene at the current time
(muxed into the render), invokes your callback with a **tracker**, then waits out
any remaining audio so scene time reaches the clip's end. The tracker exposes
`duration`, `timeAtBookmark(name)`, `timeUntilBookmark(name)`, and
`waitUntilBookmark(name)`.

## Providers

| name | needs | notes |
|------|-------|-------|
| `silent` | ffmpeg | no key — a silent clip of the **estimated** duration. Great for laying out timing offline / in CI. |
| `system` | macOS `say` or Linux `espeak-ng` | real local speech, no key. |
| `openai` | `OPENAI_API_KEY` | `gpt-4o-mini-tts`. |
| `elevenlabs` | `ELEVENLABS_API_KEY` | `eleven_multilingual_v2`. |

`resolveTTSProvider(preferred)` picks the first available (falling back to
`silent`). Register your own with `registerTTSProvider({ name, available, synthesize })`
— `synthesize(text) → { file, durationSeconds, wordBoundaries? }`. When a provider
supplies `wordBoundaries`, bookmarks map to exact word times; otherwise bookmark
positions are proportional to the character offset.

Bookmarks: put `<bookmark mark="name"/>` inline in the narration text; the tag is
stripped from what's spoken and its position becomes a cue you can wait for.
