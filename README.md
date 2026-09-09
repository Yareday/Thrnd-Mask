# Thrnd 8.1

Thrnd is an experimental Chrome MV3 extension that classifies video intervals with Gemini and skips intervals matching configured viewing rules. Requires Chrome 116+.

## Install and use
Run `npm test` from the repository root. To test the extension, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the `extension/` folder. Refresh your YouTube tab after installation and pin Thrnd to the toolbar.

The local-player harness is at `extension/legacy/player.html`. It uses the bundled demo video and does not require an API key for fixture mode. Run `npm run package` to create `dist/Thrnd_Extension_v8.0.zip` for testing or distribution.

Click Thrnd: no website or player tab opens. Enter your Gemini API key, consent to Google analysis, leave Model ID blank and Test connection. Choose Violence, Sexual content / nudity and optionally Strong language. Enter additional requests and click Apply request to compile them into real Gemini filtering predicates. Review the reply and resulting rules, then Go on this tab. Play the video. Use Stop to leave it paused and remove filtering.

Settings and the key stay in Chrome session storage (trusted extension contexts only), across popup closures and service-worker restarts, until browser restart/extension reload. The key is never sent to a webpage. Go arms only that tab. Other tabs require their own Go. YouTube reloads in the armed tab are supported by the content script; on other sites click Go again after navigation. It does not enable itself on every website.

## What changed
The popup contains API/model settings, Test, three category switches, a chat request area, applied custom rules, Go/Stop and diagnostics. The badge shows ARM (waiting for playback), WAIT (analysis), ON (classified playback) or ! (error). Pinning the extension is required to keep its badge visible.

This is an experimental **same-player scan-and-return** implementation, not a hidden duplicate of YouTube. Before viewing a section, Thrnd covers the page, pauses and mutes the player, seeks through up to 180 source seconds and samples four frames per two-second interval. It sends batches of three intervals to Gemini in an offscreen extension document. The popup may close while requests continue. It returns to your viewing position, applies any initial skips, then reveals the video. At an unknown boundary it covers and scans again, normally only after roughly three minutes of classified playback. It does not analyze an independent stream while you watch.

Up to 180 source seconds is analyzed media coverage, not a fixed waiting timer. Seeking and Gemini can take longer. A full 180-source-second window uses approximately 360 image samples and 30 requests, plus bounded repair requests if required. Costs and latency depend on Google and your video. HTTP 400 or incomplete replies receive one-segment repair; unresolved evidence holds playback. Go retries from the held position. No score threshold establishes an accuracy guarantee.

## Compatibility and limits
YouTube integration is implemented but **has not passed a live YouTube/Gemini test in this environment**. The earlier test browser loaded the page but never decoded video. Treat this release as a preview to test in your Chrome, not verified YouTube protection.

Only finite seekable top-level HTML video is targeted. Frame access must be readable; cross-origin security errors, protected media, unavailable seeking and detected YouTube ads stop analysis. It does not bypass DRM or browser security restrictions. Stop before playing an ad normally, then Go again after the ad. Iframe-only players and live streams are unsupported. Picture-in-picture and fullscreen are exited before scanning. This modifies the existing page player; site behavior may change or interfere. It is not based on a hidden YouTube embedded-player API integration.

Language requires a readable HTML text track with cues extending near the end of the video. This check is a heuristic, not proof of subtitle completeness; ordinary YouTube caption display often does not expose such a track. If unavailable, language rules hold playback: disable them to test visual filtering. Audio is not analyzed. Custom audio/subtitle rules cannot silently become visual detectors.

Sampled frames may miss brief events. Gemini may misclassify content or refuse it. Browser event timing is not frame-perfect; content could briefly appear before a pause/skip, particularly under heavy load or site interference. The historical false-skip budget is unvalidated. Background tabs pause. New videos clear decisions; user seeking triggers fresh analysis when needed. Closing the popup does not stop filtering; Stop or a browser restart does.

## Repository layout
- `extension/`: loadable Chrome extension source and manifest.
- `extension/legacy/`: local-player development harness and demo media.
- `tests/`: Node unit tests and simulated browser tests.
- `scripts/`: release packaging scripts.
- `releases/`: historical archives; generated releases go in `dist/`.

The active runtime is split across `popup.js`, `background.js`, `browser-content.js`, `offscreen.js`, and the Gemini transport modules. The legacy player is not opened by the extension action.

## Privacy
With consent Google receives sampled frames, available subtitles, rule definitions and chat requests. Provider charges/policies apply. Diagnostic logs omit keys, frames and caption payloads. They include model errors and safe request counts/sizes. Settings/rule text can be personal; review before sharing. No external telemetry is implemented.
