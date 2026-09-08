# Thrnd 7.0 — See what you want

## Install
Unzip. Remove the previous extension at chrome://extensions, enable Developer mode, and Load unpacked → select the new thrnd-extension folder. Close old player tabs. Open Thrnd from its extension icon and check the V7.0 header.

Enter your Gemini key, check consent, leave Model ID blank and click Test connection. It verifies image input and structured JSON. Then choose a local MP4 and press Play.

## Three switches
- Violence enables the full Violence group plus sexual violence, self-harm/suicide, animal harm, child endangerment, corpses and serious accidents. It includes punches, kicks, knockdowns and immediate injury aftermath.
- Sexual content enables sexual activity, nudity, suggestive behavior and sexual assault. Sexual assault is also covered by Violence, so either switch can skip it.
- Strong language enables profanity, hateful slurs and verbal threats/bullying. This requires complete aligned subtitles. It switches off when a new local video is loaded.

Sensitivity: Balanced 0.80, More filtering 0.65, Fewer false skips 0.98. These are uncalibrated model-score thresholds. Higher sensitivity may skip wanted material. The internal category definitions remain available to developers, but the viewer does not need to select 27 boxes.

## Chat and new custom rules
After Test connection succeeds, use the chat to say things like:
- Skip scenes with spiders, but keep drawings of spiders.
- Skip needles entering skin, but keep ordinary hospital scenes.
- Also skip cigarette smoking.
- Remove the spider rule.

Chat makes an actual Gemini request that compiles your request into a structured configuration. It can create new observable-content predicates that are not hard-coded categories. It does not fetch/install software or browse for detector plugins. The resulting definitions are dynamically added to future video prompts and required response-score keys. Matching custom scores can trigger the same skip engine as built-in categories.

Rules apply automatically and appear below the chat, with an enabled switch, editable condition, visual/subtitle evidence selector, Save and Remove controls. At most eight custom rules are kept. Conversation context supports follow-up requests. Invalid compiler responses leave settings unchanged. A clarifying answer does not modify settings. You can use chat before loading a movie; there is no video content in the chat request.

Any enabled built-in or custom match authorizes a skip. There is no global allow override. An exception inside one rule does not override another matching filter. The chat is instructed to clarify conflicts, for example keeping kissing while another rule might block it. Review applied settings because model interpretations may be wrong.

Filter/rule/sensitivity changes cancel old analysis, rewind at most to the start of the current 2-second interval, clear outdated decisions and rebuild the buffer from that position. Playback resumes automatically if it was running. Restart session explicitly returns to the beginning. Manual changes invalidate an in-flight chat plan so stale replies cannot overwrite new settings.

## Incomplete decision recovery
Version 7 requests JSON output without the complex generated response schema. Source timestamps and all required active category/custom-rule scores are validated locally before decisions can authorize playback. Output validation does not establish content accuracy.

If Google rejects an analysis request with HTTP 400, the player retries fewer target segments: 15 → 5 → 1. A rejection at one segment stops automatic recovery and remains visible in diagnostics. Authentication, quota and network errors do not trigger this compatibility fallback. The reported generic INVALID_ARGUMENT message does not identify its exact cause; this change simplifies the request and exposes its shape for diagnosis.

Valid rows from partial replies are preserved. Missing, duplicate-timestamp, malformed or unassessable decisions stay unknown. Missing work is retried separately in batches of up to three segments, with at most three total attempts per unresolved segment. After that, Retry analysis explicitly starts a new attempt budget while preserving successful decisions and current position. No authentication, quota or network error gets an unbounded retry loop. Automatic repair requests may incur additional API charges.

An error ahead no longer immediately interrupts already-classified content. The player may continue through its usable buffer, then pauses at the low-water boundary if analysis is unavailable. It never treats missing scores as a safe keep. Diagnostics record counts/finish reasons without logging raw frame responses.

## Video pipeline
Four frames per 2-second segment (2 FPS), plus up to two seconds of context at each batch boundary. The model is instructed to recognize attacks, impact, falls and immediate aftermath as a sequence, without requiring blood. Requests initially target up to 15 segments (30 source seconds), shrinking after HTTP 400 rejection, with up to 68 sampled images including context. Extraction gets 60 seconds; Google gets 90 seconds per request. More images and custom rules can increase cost and latency.

Playback begins when 30 source seconds are classified; it re-buffers below six seconds, resuming with 30 ready (or all remaining media for short files). The 180-second decision horizon advances through the entire file. Consecutive 2-second skips are merged. This is not whole-movie pre-indexing or whole-scene guaranteed removal.

## Demo and limits
Try the built-in demo is a synthetic fixture, not AI. Custom rules are intentionally unsupported in fixture mode: choose a local video to evaluate them with Gemini. The synthetic violence cards are at 10–14s, sexual cards at 20–24s and language cards at 30–34s.

Local finite seekable files only; no Netflix/DRM integration. Audio is not analyzed. Dialogue-based rules require supplied subtitles, assumed complete and aligned. Audio-only requests cannot be supported accurately. Chat rules do not eliminate missed events between sampled frames, model errors or refusals. The historical false-skip target is unvalidated. Browser seeking and audio/video boundaries are not frame-perfect; the pre-boundary guard may trim adjacent content. Hidden tabs pause playback.

## Privacy and logs
Key stays in this tab's memory. With consent, Google receives test images, sampled video frames, subtitle text, chat requests/history and rule definitions as appropriate. Provider charges/data policies apply. Chat and custom rules stay in this tab; they are not saved after closing it.

Download diagnostics captures the latest 300 request records with stage, endpoint, model, HTTP status and redacted Google error text. Analysis diagnostics also include target count, image count, approximate request size and invalid field names when supplied by Google. No request headers, frames or subtitle payloads are deliberately logged. Review before sharing. Export event log (schema 3.0) includes settings, custom rule definitions, thresholds, scores, matching rule IDs/titles, retries and actual skips. Custom rule text can be personal; review this export too. Recent 20,000 log entries are retained with a dropped-entry count. Export periodically for long sessions.

## Files and tests
player.js integrates playback, recovery and chat; chat.js calls Gemini and renders editable rules; rules.js defines group expansion and validates compiler output; categories.js supplies predicates; core.js decides keep/skip; decisions.js parses partial replies; transport.js builds the simplified analysis request and batch fallback; api.js handles requests, model fallback and diagnostics.

Run npm test with Node. Optional tests/browser.cjs needs Playwright and Chromium. No build step is required to install the extension. See VALIDATION.md for what was verified.

## Brand
Thrnd blends thrive and ascend, representing growth, elevation and mastery. Its echo of trend reflects tools that evolve with technology and human needs. Thrnd empowers individuals through tools that grow with them.
