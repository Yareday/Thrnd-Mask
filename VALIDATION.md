# Thrnd 7.0 validation

All 36 automated tests passed. Automated core, mocked API and simulated DOM/media tests cover group expansion; dynamic custom rules; a custom match executing a playback skip; invalid-plan rejection; partial-reply preservation; bounded repair; buffering; and model compatibility diagnostics.

Version 7 adds regression coverage for HTTP 400 analysis recovery from 15 to 5 to 1 target segments, stopping after a one-segment rejection, manual retry, simplified JSON requests without a response schema, request-shape diagnostics that omit image contents, and invalid-field diagnostics with key redaction.

Live Gemini requests, real movie recognition and actual Chrome playback are not verified in this environment. There is no supplied Gemini API key and no installed Chromium executable. Simulated tests verify implementation paths, not accuracy of Gemini decisions. The generic provider error does not establish the exact rejected argument. No false-skip or missed-event rate is established.
