# Thrnd 8.0 — browser preview

## Install and use
Unzip, remove the previous Thrnd extension at chrome://extensions, enable Developer mode, then Load unpacked and select the thrnd-v8 folder. Requires Chrome 116+. Refresh your YouTube tab after installation. Pin Thrnd to the toolbar.

Click Thrnd: no website or player tab opens. Enter your Gemini API key, consent to Google analysis, leave Model ID blank and Test connection. Choose Violence, Sexual content / nudity and optionally Strong language. Enter additional requests and click Apply request to compile them into real Gemini filtering predicates. Review the reply and resulting rules, then Go on this tab. Play the video. Use Stop to leave it paused and remove filtering.

Settings and the key stay in Chrome session storage (trusted extension contexts only), across popup closures and service-worker restarts, until browser restart/extension reload. The key is never sent to a webpage. Go arms only that tab. Other tabs require their own Go. YouTube reloads in the armed tab are supported by the content script; on other sites click Go again after navigation. It does not enable itself on every website.

## What changed
The popup contains API/model settings, Test, three category switches, a chat request area, applied custom rules, Go/Stop and diagnostics. The badge shows ARM (waiting for playback), WAIT (analysis), ON (classified playback) or ! (error). Pinning the extension is required to keep its badge visible.

This is an experimental **same-player scan-and-return** implementation, not a hidden duplicate of YouTube. Before viewing a section, Thrnd covers the page, pauses and mutes the player, seeks through 30 source seconds and samples four frames per two-second interval. It sends batches of three intervals to Gemini in an offscreen extension document. The popup may close while requests continue. It returns to your viewing position, applies any initial skips, then reveals the video. At an unknown boundary it covers and scans again. It does not analyze an independent stream while you watch, and it does not maintain the v7 180-second horizon.

Thirty seconds is analyzed media coverage, not a fixed waiting timer. Seeking and Gemini can take longer. Each 30-source-second window uses approximately 60 image samples and five requests, plus bounded repair requests if required. Costs and latency depend on Google and your video. HTTP 400 or incomplete replies receive one-segment repair; unresolved evidence holds playback. Go retries from the held position. No score threshold establishes an accuracy guarantee.

## Compatibility and limits
YouTube integration is implemented but **has not passed a live YouTube/Gemini test in this environment**. The earlier test browser loaded the page but never decoded video. Treat this release as a preview to test in your Chrome, not verified YouTube protection.

Only finite seekable top-level HTML video is targeted. Frame access must be readable; cross-origin security errors, protected media, unavailable seeking and detected YouTube ads stop analysis. It does not bypass DRM or browser security restrictions. Stop before playing an ad normally, then Go again after the ad. Iframe-only players and live streams are unsupported. Picture-in-picture and fullscreen are exited before scanning. This modifies the existing page player; site behavior may change or interfere. It is not based on a hidden YouTube embedded-player API integration.

Language requires a readable HTML text track with cues extending near the end of the video. This check is a heuristic, not proof of subtitle completeness; ordinary YouTube caption display often does not expose such a track. If unavailable, language rules hold playback: disable them to test visual filtering. Audio is not analyzed. Custom audio/subtitle rules cannot silently become visual detectors.

Sampled frames may miss brief events. Gemini may misclassify content or refuse it. Browser event timing is not frame-perfect; content could briefly appear before a pause/skip, particularly under heavy load or site interference. The historical false-skip budget is unvalidated. Background tabs pause. New videos clear decisions; user seeking triggers fresh analysis when needed. Closing the popup does not stop filtering; Stop or a browser restart does.

## Code and validation
- popup.html / popup.js: controls and request UI.
- background.js: trusted settings, tab activation, status badge and offscreen routing.
- browser-content.js: real video seeking, canvas frame extraction, covering/muting, timestamps and playback skips.
- offscreen.js: real Gemini requests, custom-rule compilation, decision validation and repair.
- categories.js / rules.js / core.js: category expansion and decision logic.

Legacy local-player files are retained as a fallback for developers but are not opened by the extension button. Their v7 tests remain in the suite. Run node --test --test-timeout=5000 tests/*.test.js. See VALIDATION.md.

## Privacy
With consent Google receives sampled frames, available subtitles, rule definitions and chat requests. Provider charges/policies apply. Diagnostic logs omit keys, frames and caption payloads. They include model errors and safe request counts/sizes. Settings/rule text can be personal; review before sharing. No external telemetry is implemented.
