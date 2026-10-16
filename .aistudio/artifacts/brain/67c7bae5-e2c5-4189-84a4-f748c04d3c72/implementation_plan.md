# Implementation Plan: Spectral Town Hall MVP3 (Haunt Show Choreography & Atmospheric Storm)

## 1. Executive Summary & User Scope Alignment
Following user requirements for **MVP3**, this release introduces professional haunt show choreography, flight path recording, and high-impact atmospheric weather:
1. **Haunt Show Choreography & Flight Path Timeline**: An interactive multi-track keyframe timeline enabling users to record live ghost flights or construct choreographed spectral shows with smooth 3D spline interpolation.
2. **Recorded Fly Paths & 3D Flight Ribbon**: Real-time motion capture of cursor dragging into keyframe sequences, editable waypoints, and glowing 3D trajectory ribbons rendered in the stage view.
3. **Volumetric Ground Fog & Dynamic Lightning Storm**: Ground-hugging rolling fog with procedural noise displacement, dynamic fractal lightning bolts striking the clock tower with sharp facade shadows, and spatial thunder synthesis with sound-delay physics.

---

## 2. Architecture & Technical Design

### A. Choreography & Keyframe Engine (`src/engine/choreography.ts`)
- **Keyframe Data Model**:
  - `KeyframePoint`: Timestamp $t$ (seconds), 3D position $(x, y, z)$, tension/inflation multiplier, spectral color/hue, and ease curve.
  - `ShowCue`: Discrete events along the timeline (lightning flash strike, ethereal shockwave, ghost wail audio cue, blackout strobe, speed swoop).
  - `ChoreographyTrack`: Assigned to specific ghost entities (Primary Phantom, Wraith Companion, etc.).
- **Smooth Spline Motion Evaluation**:
  - Catmull-Rom or Hermite spline curve passing smoothly through 3D waypoints over time.
  - Tangent tension control to prevent overshoot when ghosts execute sharp swoops or dive-bombs.
  - Velocity-adaptive XPBD simulation: Ghost cloth physically drags, stretches, and billows naturally in response to timeline-driven acceleration.
- **Flight Path Recorder**:
  - Live Recording Mode: When enabled, user pointer-dragging samples 3D positions at 20–30 Hz, automatically simplifying points into optimized keyframes via Douglas-Peucker tolerance.
- **Pre-choreographed Signature Shows**:
  - *The Midnight Spiral*: Ghost spirals down from the clock tower, swoops across the courtyard, and rises with a lightning burst.
  - *Poltergeist Tempest*: Aggressive multi-ghost synchronized storm chase with strobe lightning and pumpkin scattering.
  - *Phantom Waltz*: Graceful harmonic figure-8 oscillation hovering over floating candles with gentle chiming.

### B. Atmospheric Storm & Weather Engine (`src/engine/lightningSystem.ts` & `src/engine/volumetricFog.ts`)
- **Dynamic 3D Lightning System**:
  - Procedural fractal midpoint-displacement lightning bolt generator rendered with glowing bloom line segments.
  - Dynamic sky-burst directional light that flashes at 8–15 intensity, washing the facade in cold spectral blue-white, casting high-contrast shadows.
  - Timeline cue trigger or randomized storm frequency slider.
- **Procedural Volumetric Ground Mist**:
  - Multi-layered procedural mist shader or animated noise fog plane with depth fading and soft soft-particle edge blending.
  - Rolling FBM wave motion responding to clock time.
  - Interactive disturbance: When ghosts swoop low (altitude $< 100\text{ mm}$), the fog locally disperses or glows with spectral backlighting.
- **Thunder & Acoustic Sound Synthesis (`src/engine/spatialAudio.ts`)**:
  - Procedural Web Audio thunder crack & low-frequency rolling rumble (band-passed noise with exponential decay).
  - Spatialized distance delay (light-to-sound delay simulating speed of sound in the town square).
  - Dramatic organ stab & banshee shriek sound cues available for timeline keying.

### C. Interactive Timeline Component (`src/components/ChoreographyTimeline.tsx`)
- **Dockable Timeline Interface**:
  - Play / Pause / Stop / Loop controls, playback scrubber, current time display ($00:00.00$), and duration scale ($10\text{s} - 60\text{s}$).
  - Multi-track visual timeline:
    - Track 1: Primary Ghost Flight Path (with keyframe diamonds).
    - Track 2: Companion Ghost Flight Path.
    - Track 3: Atmospheric Cues (Lightning strikes, Fog surges).
    - Track 4: Audio Cues (Organ stabs, thunderclaps, wails).
  - **Live Record Button**: One-click record to capture mouse maneuvers into a fly path.
  - **3D Trajectory Ribbon Toggle**: Shows/hides the glowing neon spline path in the Three.js viewport with draggable 3D handle markers.
  - **Show Preset Selector**: Quick load buttons for pre-choreographed shows.

### D. App & Scene Integration
- Add `'choreography'` tab and header quick-controls in `TopBar.tsx`.
- Connect timeline playhead state to `StageCanvas.tsx` render loop.
- Support seamless blending between manual physics dragging and timeline playback.

---

## 3. Step-by-Step Implementation Sequence

### Step 1: Types & Choreography Model (`src/types/index.ts`, `src/engine/choreography.ts`)
- Define `KeyframePoint`, `ChoreographyTrack`, `ShowCue`, `ChoreographyShow`, and `AtmosphereState`.
- Implement spline interpolation (`evaluateSpline`), keyframe insertion, deletion, and path smoothing in `choreography.ts`.
- Bundle 3 pre-built signature haunt shows ready for immediate playback.

### Step 2: Atmospheric Storm & Lightning Engine (`src/engine/lightningSystem.ts`, `src/engine/volumetricFog.ts`)
- Build procedural 3D lightning bolt geometry generator and flash controller.
- Build layered volumetric mist meshes with custom scrolling noise shader on the stage floor.
- Add thunder rumble, banshee wail, and organ stab procedural synthesizers to `src/engine/spatialAudio.ts`.

### Step 3: Interactive Choreography Timeline UI (`src/components/ChoreographyTimeline.tsx`)
- Build full-featured scrubbable timeline UI with playhead, track rows, keyframe diamonds, cue chips, record toggle, and preset dropdown.
- Add keyframe inspector allowing users to adjust waypoint coordinates and timestamp.

### Step 4: Stage Viewport & 3D Path Integration (`src/components/StageCanvas.tsx`, `src/App.tsx`)
- Render glowing 3D Catmull-Rom spline curves with colored glow ribbons for each ghost's recorded flight path.
- Hook animation loop to evaluate the timeline and drive ghost positions when playing.
- Hook live recording: when recording is active, sample drag trajectory into new keyframes.
- Render dynamic lightning bolts and fog planes in the 3D scene.

### Step 5: Verification & Compilation
- Run `compile_applet` and `lint_applet` to verify clean compilation.
- Verify timeline scrubbing, keyframe playback, live flight path recording, ground mist rendering, and lightning flashes with synchronized audio thunder.

---

## 4. User Review Checklist
- **Choreography Control**: Does the scrubbable timeline with both manual keyframes and live drag-recording match your vision?
- **Atmospheric Storm**: Are the dynamic lightning strikes and ground mist tuned for spooky theatrical atmosphere?
- **Preset Shows**: Ready-to-play shows allow instant demonstration before creating custom choreographies.
