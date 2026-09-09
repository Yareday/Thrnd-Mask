# Thrnd 8.0 validation

43 automated tests passed, including 36 retained tests for shared/v7 behavior and seven v8 tests. V8 simulated media tests exercise thirty-second readiness, bounded frame batches, restoration, initial skips before reveal, errors holding playback and Stop cancellation. Mocked Gemini tests exercise actual custom predicates in request construction, actionable scores, rejection of missing scores after repair and missing-subtitle blocking.

These tests are not real Chrome extension integration tests. Neither live Gemini nor YouTube decoding/frame extraction was verified. The earlier browser test could load YouTube controls but produced no decoded video. Offscreen creation, Chrome message routing, popup lifetime, site event interactions, actual audio/video timing, ad transitions and pixel access require on-device testing. No measured classification accuracy or exposure guarantee exists.
