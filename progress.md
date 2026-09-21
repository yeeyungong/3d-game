# Execution ledger — docs/superpowers/plans/2026-09-21-rules-prototype.md

Method: inline. Tasks: 1 state, 2 resources, 3 corruption, 4 meeting/combat, 5 UI, 6 acceptance.
Ruling: New workspace has no Git directory. Work in place; retain ledger; no Git-dependent scripts or commits.
Pre-flight: Tasks share createGame/reduce/playerView. Per-player interaction channels prevent a global task lock. Meeting stage timers use absolute deadlines.
Ruling: Local rule simulator only; no claims of real 3D, networking, AI or client secrecy. Pause and time acceleration are explicit test controls.
Ruling: Reduced single-player tasks per approved plan; equipment, sabotage and spatial combat are future milestones.
Visual plan: architectural station floor plan as signature; slate #101c25, panel #182a35, warm white #e8eadf, amber #e8b765, teal #6eada9, violet #b39bd4. Bahnschrift display, Microsoft YaHei body, Consolas data. Map dominates the interface.

Task 1: complete — initial tests failed on missing module, then 2/2 passed.
Task 2: complete — resource tests failed on absent actions, then 5/5 passed.
Task 3: complete — 3 conversion tests failed then passed (8/8 suite).
Task 4: complete — meeting/combat failures reproduced, 13/13 suite passed. Absolute chronological events ensure meeting cancels simultaneous conversion; paused cooldowns resume after meeting.
Task 5: complete — view/server tests first failed on missing modules; 16/16 suite passed; browser first conversion and resource reward verified.
Task 6: in progress — full game test passes; independent reviewer identified meeting retry cooldown missing and misleading environment clue hint. Added regression, observed 95000 vs 108000 failure; fixed interruption before pause and corrected scope copy.
Ruling: Public map intentionally shows simulated positions, explicitly labeled. No false claim of real player information privacy.

User steering: user explicitly requires actual 3D human characters that move. Upgrade current view now, preserving existing rules. Add Three.js rendered low-poly human models, walk/run animation, WASD/touch controls, follow/orbit camera and real positions. This replaces the diagram as primary view. Room-based interaction remains simplified and disclosed. World movement tests added and observed missing-module failure before implementation.

3D upgrade: local Three.js 0.186.0 installed (sandbox network escalation approved). Articulated people, camera, floor navigation, mobile pad and collision implemented. Browser verified rendered humans, navigation to power and converted player view.
Focused review: console blocked straight navigation. Added route test (missing export RED) and grid routing (24/24 GREEN). Pause explicitly labeled as clock-only; movement permitted intentionally for scene setup. Removed deprecated Three shadow mode warning.

Browser QA: 1440 desktop and 390 mobile render actual articulated humans; mobile scrollWidth375<=viewport390. ArrowRight tap changed X -2.5 to -2.1. Three consecutive resets cleared roles, energy and time. Conversion target view verified. DOM patching adjusted to cache input markup (browser serialization normalized disabled attributes causing needless replacement).

Task 6: complete — browser task loop earned100, meeting required5/8, five individually cast votes ejected original and displayed Good victory at09:08. Converted private view separately verified. Full automated suite24/24. Desktop1440 and mobile390 checked. Existing historical shadow warning predates replacement, no new errors after reload.
Finish: No Git repository/branch to merge. Retain user files and local server; no publishing. Final milestone is 3D local simulator per explicit user correction.

UI reskin requested: Among Us-inspired cartoon space UI. Original CSS/SVG artwork; colored crew busts, chunky buttons, green energy gauge, red meeting action, offwhite voting tablet. Existing 3D humans and rules preserved. Additive theme file keeps established layout hooks. Pure presentation change; verify existing tests and browser responsive/actions.
UI QA: desktop1440 and mobile390 screenshots inspected; no horizontal overflow (1425/1440 and375/390). Original human SVG portraits color-match eight Three.js outfits. 24/24 existing tests passed after reskin. Theme route enabled by local server restart.

### Room scenery update
- Rebuilt all five spaces with outlined equipment, colored hull panels, floor lettering and matching room navigation colors.
- Added localized lighting and darker perimeter service aisles; retained the equipment collision footprints and existing movement.
- Darkness is visual atmosphere/geometry occlusion only. Same-room combat targeting is unchanged; this is not a stealth/line-of-sight system.
- Verified 24 automated tests and syntax checks; browser walkthrough checks recorded during implementation.

### Expanded station
- Horizontal scale 1.7 (2.89x floor area), unchanged human size and walking speed.
- Added collision-backed doorway partitions to all four outer rooms; shared partition data drives rendering and navigation.
- Expanded click destinations/world bounds, spaced player spawn points and shortened distant visibility with fog.
- Verification: 26 tests pass, including routes around partitions and all 40 room/player spawn combinations. Browser navigation reached the expanded power room without errors.
- Same-room combat targeting remains unchanged; geometric cover does not implement authoritative visibility rules.

### Immersive controls and interactive tasks
- Full-window 3D scene with compact HUD. Removed destination buttons and per-player action list.
- J converts / K attacks the nearest living player within 3.5 units in the same room, with geometric obstacle checks and a red target ring. These checks apply to the playable UI; the rule simulator still uses rooms.
- All playable regular/secret tasks launch interactive maintenance panels: power wires (drag or click), lab numbered scans, storage switches, communications sliders.
- Interactive channels cannot finish from time alone. Answers are validated before a short completion delay; closing/Escape cancels without reward. The noninteractive rule simulation remains supported for existing tests.
- Browser verified K reduced target HP to 75, J began conversion, incorrect wire rejection and matching wire rendering. Unit coverage includes all four answer types, delayed reward, interruption, and secret progress.

### Multiplayer implementation
- Added authoritative Node WebSocket room service, server-side movement/collision/targeting, private per-player views and actor-bound actions.
- 6-character invitations, nickname lobby, readiness and eight-player host start; sessionStorage reconnect token with 2-minute disconnect grace. Online mode disables local simulation controls.
- Added Vercel static build/config and Render single-service blueprint; deployment is prepared but not published. See DEPLOYMENT.md.
- Real 8-client socket test covers capacity, host authority, private roles, malicious tick/move rejection, motion, task/reward sync and reconnect. Browser verified create/ready/start with seven temporary socket test clients and refresh rejoining the same role.
- Upgraded ws to 8.21.0 following npm audit; zero reported vulnerabilities at install.
