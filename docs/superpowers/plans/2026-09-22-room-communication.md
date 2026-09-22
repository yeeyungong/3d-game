# Room communication implementation plan

> Execute inline with superpowers:executing-plans. User approved the communication design. Keep changes in the current project; do not deploy or create paid services.

**Goal:** Room text chat and opt-in microphone voice for the existing 4–8 player game.
**Architecture:** Existing WebSocket carries authenticated chat and WebRTC signaling. Separate server communication policy, browser voice lifecycle and reusable UI modules.
**Tech Stack:** Node.js, ws, browser DOM and WebRTC; no new production dependencies.
**Spec:** ../specs/2026-09-22-room-communication-design.md

## Constraints and review focus

300-character text, bounded history, separate living/ghost channels, HTTPS for microphone, no static TURN secret. Test cross-room targets, replaced sessions, late microphone permission, stale signaling and modal input survival. No deployment or real microphone activation without user participation.

## Tasks

- [x] Add failing real-WebSocket tests in tests/multiplayer.test.mjs for chat delivery, sender identity, validation, channel isolation, voice opt-in and signaling permission.
- [x] Implement multiplayer/communication.mjs with channelFor(room, member), sync(room), handle(room, member, message) and temporary TURN credentials. Wire sync into membership and game-state updates in multiplayer/server.mjs.
- [x] Add public/voice.mjs exposing createVoice({send, onChange, platform}) with join, leave, mute, update, signal and retryPlayback. Test asynchronous getUserMedia completion after exit, permission failure, mute, teardown and stale sessions in tests/voice.test.mjs.
- [x] Add public/communication.mjs, public/communication.css, and module routes in server.mjs. Mount one persistent panel into active dialog outside its replaced content; use textContent, composition-aware input and acknowledged sends. Wire online lifecycle callbacks and suppress game movement while typing.
- [x] Run node --test, npm run build and browser checks for room chat, modal changes and narrow layout. Review the diff and update README.md, DEPLOYMENT.md and .env.example with exact setup and verification limits.

## Execution ledger

- Initial inspection: existing ws room authentication and state snapshots can be reused; dialog content is replaced during render, so communication UI must be a sibling of that content.
- Ruling: apply the user's approval to the described implementation and proceed inline without another permission round. No automatic commit or publication.
- Tests: initial chat integration failed waiting for the unimplemented communication event; after implementation, real WebSocket tests passed. Voice lifecycle tests added before the voice module; completed 5 passing voice tests including offer initiation and answering.
- Review: fresh agent found no blocking defect. Added pagehide voice-leave notification and exercised real browser negotiation rather than relying only on mocked peers.
- Browser: four real room clients entered a game; two clients exchanged Chinese text and literal HTML. Separate QA server used synthetic silent audio to verify both WebRTC peers connected and received increasing inbound audio bytes; mute, exploration channel rotation, meeting chat, persistent draft through countdown renders, endgame channel and voice leave verified.
- Responsive: second QA browser measured clientWidth=390 and scrollWidth=390; meeting panel stayed inside the modal. First browser remained 1280; recorded the actual measured viewport rather than assuming the override applied to all tabs.
- Weak-network regression: failing test reproduced cached-but-unsent roster; server now retries after backpressure clears, including in the lobby.
- Final validation: node --test 45/45 passing; npm run build successful; git diff --check clean.
- Limits: no real microphone or two-device/public TURN test; no deployment. Existing dialog ordering is adequate for current flows; future overlapping modal types should track actual opening order.
