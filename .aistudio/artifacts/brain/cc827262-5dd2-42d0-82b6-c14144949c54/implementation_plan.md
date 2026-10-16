# Cloth Physics Simulation & Webcam Spectral Projection Mapping Plan

Further expand the **2D Contour Sculptor** and **Spectral Shaders Studio** with real-time cloth physics simulation for fluttering shroud hems and live webcam/video spectral projection mapping—while keeping all other systems completely untouched.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during interactive clarification and strictly govern this plan:
>
> - **2D Contour Sculptor Focus**: Real-time cloth physics simulation for fluttering hems (verlet/spring-mass dynamic airflow, wind turbulence, shroud elasticity, interactive cursor draft, and flutter bake-to-bezier).
> - **Spectral Shaders Studio Focus**: Live webcam and video spectral projection mapping (live camera feed and video loops fed as dynamic WebGL sampler textures with chroma keying, edge luminescence, and projection keystone alignment).
> - **Primary Development Scope**: Expand exclusively these two core features without altering other modules (Show Choreography, Sound FX, Projector Calibration, Props).

---

### 1. Overview & Core Concepts

- **2D Contour Sculptor (Real-Time Cloth Physics Simulation)**:
  - Integrates a lightweight 2D Verlet / mass-spring cloth solver directly along the shroud contour vertices and hem fringe.
  - Simulates dynamic environmental factors: **wind turbulence**, **upward thermal draft** (ghostly levitation), **cloth stiffness**, and **spectral drag**.
  - Interactive **Cursor Wind Gust**: moving the mouse or stylus through the contour canvas creates directional air currents that billow and ruffle the cloth in real time.
  - **"Bake Flutter to Bezier"**: Freeze any dynamic ripple moment into editable Bezier control points with a single click.
  - Continuous 3D Sync: dynamically updates the 3D ghost preview with fluttering surface waves.

- **Spectral Shaders Studio (Webcam & Video Spectral Projection Mapping)**:
  - Connects live camera feed (`navigator.mediaDevices.getUserMedia`) or custom video clips directly into the GLSL shader pipeline via dynamic WebGL texture updates.
  - GLSL Shaders receive `sampler2D uSpectralVideo`, `vec2 uVideoResolution`, `float uVideoKeyThreshold`, and `int uVideoBlendMode`.
  - Four eerie spectral blending modes:
    1. *Ectoplasmic Face & Silhouette Keying*: Dark/luma thresholding to turn live facial movement into glowing ethereal apparitions.
    2. *Sobel Edge Luminescence*: Neon phantom outlines highlighting moving silhouettes.
    3. *Holographic Slit-Scan Distortion*: Temporal displacement ripples warping live video with audio or time waves.
    4. *Projector Keystone Quad-Warp*: Interactive 4-corner perspective adjustment to align projected video onto physical props or 3D ghost geometry.

---

### 2. User Experience & Visual Design

#### Key User Flows

1. **Fluttering Hem Simulation (2D Contour Sculptor)**:
   - User switches the contour workspace into **"Cloth Physics"** mode via a dedicated toolbar toggle.
   - Adjusts sliders for **Wind Speed**, **Turbulence Frequency**, **Hem Gravity/Levitation**, and **Fabric Drape**.
   - Hovering/swiping over the canvas generates dynamic air turbulence vectors that flutter the hem nodes.
   - User can click **"Freeze & Bake Pose"** to transfer the simulated cloth deformation back into standard Bezier nodes for manual sculpting.
   - The synchronized 3D preview immediately displays the animated cloth flutter on the ghost shroud.

2. **Webcam & Video Projection Mapping (Spectral Shaders Studio)**:
   - In the shader controls panel, user clicks **"Enable Spectral Video / Webcam"**.
   - Grants camera permission to stream their own live feed or selects from looping ethereal test clips (Mist Maiden, Creeping Fog, Poltergeist Swarm, or Custom MP4 Upload).
   - Selects projection mapping modes: *Silhouette Phantasm*, *Sobel Contour Glow*, *Holographic Mirage*, or *Luma Ghost Key*.
   - Uses interactive on-canvas corner pin handles to skew and perspective-warp the projection texture to match target projection surfaces.
   - Live shader parameters (dissolve, chromatic aberration, audio reactivity) immediately blend with the camera stream.

#### Visual Hierarchy & Styling
- **Carbon & Phosphor Palette**: Maintained aesthetic matching dark production UI (`#090a0f`), cyan (`#22d3ee`) for vector splines, neon violet (`#c084fc`) for video textures, and spectral emerald (`#34d399`) for physics vector arrows.
- **HUD Overlays**: Minimalist floating HUDs for webcam feed status (FPS, resolution, permissions), wind direction indicator compass, and cloth physics energy meter.

---

### 3. Technical Architecture & Implementation Details

#### A. Real-Time Cloth Physics Engine (`src/engine/clothPhysics.ts`)
- Verlet integration particle network:
  - Pin boundary conditions: top head node and neck anchors stay anchored or damped; bottom hem nodes have maximum freedom.
  - Distance constraints between adjacent contour sample points to preserve contour perimeter length without extreme stretching.
  - Perlin/simplex noise driven wind force vector: `F_wind = vec2(cos(time * freq) * windSpeed, sin(time * freq * 1.3) * draft)`.
  - Cursor impulse injection: records mouse velocity and exerts localized radial aerodynamic impulse onto nearby particles.
  - Real-time synchronization hook to `meshBuilder.ts` with animated hem vertices.

#### B. Dynamic WebGL Video & Camera Pipeline (`src/engine/videoTexture.ts` & `src/engine/shaders.ts`)
- Browser Media Stream Management:
  - Requests 720p/1080p video stream with graceful permission fallback and video element caching.
  - Supports drag-and-drop of video files (`.mp4`, `.webm`) with automatic looping and autoplay.
  - In WebGL render loop: `gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement)` updated on `requestAnimationFrame` when video frame changes.
- Shader Extension:
  - Extends GLSL shaders with camera uniforms:
    - `uniform sampler2D uVideoTexture;`
    - `uniform bool uVideoEnabled;`
    - `uniform int uVideoBlendMode;`
    - `uniform float uVideoThreshold;`
    - `uniform float uVideoChromaKey;`
    - `uniform mat3 uKeystoneMatrix;`
  - Keystone perspective transformation matrix calculated from 4 interactive corner pins.

#### C. Component Enhancements
- **`src/components/SilhouetteEditor.tsx`**:
  - Add Cloth Simulation control drawer: Play/Pause simulation, Wind vector compass, Flutter turbulence slider, Bake button, and interactive wind gust canvas listeners.
- **`src/components/ShaderStudio.tsx`**:
  - Add Video & Webcam Projection drawer: Camera toggle, Video loop selector, Blend Mode radio buttons, Luma threshold slider, and Keystone Calibration canvas overlay.
- **`src/types/index.ts` & `src/engine/archetypes.ts`**:
  - Include cloth physics parameters and video projection settings in `GhostArchetype` so custom creations preserve both settings.

---

### 4. Verification Plan

#### Automated Verification
1. Run `npx tsc --noEmit` and `npm run lint` to ensure type safety across all WebGL texture bindings, video streams, and physics math.
2. Verify production build with `npm run build` / `compile_applet`.

#### Interactive / Manual Verification
1. **2D Contour Sculptor Cloth Fluttering**:
   - Open 2D Contour Sculptor.
   - Enable Cloth Physics and verify fluttering motion on lower hem nodes.
   - Adjust Wind and Turbulence sliders to verify responsive fluid motion.
   - Hover and drag cursor across the hem to test wind gust aerodynamic reaction.
   - Click "Freeze & Bake Pose" and confirm nodes convert to editable Bezier anchors.
   - Verify the 3D preview viewport updates smoothly with fluttering geometry.
2. **Webcam & Video Spectral Projection**:
   - Open Spectral Shaders Studio.
   - Toggle Webcam on, verify video stream feeds into WebGL texture in real time.
   - Switch between sample video loops and camera feed.
   - Test each blend mode (*Luma Key*, *Sobel Outline*, *Holographic Mirage*).
   - Drag keystone corner handles and confirm perspective quad warping responds accurately.
   - Confirm unified archetypes save and restore cloth flutter and projection settings.
