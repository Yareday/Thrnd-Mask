# Thrnd 8.0 validation

Run `npm test` from the repository root. The suite contains 43 automated tests covering shared and legacy-player behavior, Gemini transport and diagnostics, rule compilation, response validation, and v8 simulated media behavior. V8 tests exercise the extended analysis horizon, bounded frame batches, restoration, initial skips before reveal, errors holding playback, and Stop cancellation. Mocked Gemini tests exercise custom predicates, actionable scores, incomplete-response repair, and missing-subtitle blocking.

Run `npm run test:browser` for the local Chromium harness. It loads the unpacked `extension/` directory, exercises the local-player fixture, verifies skip behavior and filter resets, and checks that AI mode fails closed without credentials.

The browser harness does not test live Gemini or YouTube decoding/frame extraction. Offscreen creation, Chrome message routing, popup lifetime, site event interactions, actual YouTube timing, ad transitions and pixel access still require on-device testing. No measured classification accuracy or exposure guarantee exists.
