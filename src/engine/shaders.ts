import * as THREE from 'three';

export const SHADOW_RES = 2048;

export const VS_MAIN = `
#ifdef USE_ACT
attribute float aAct;
attribute vec3 aRef;
#endif
#ifdef HAIR
attribute float aTip;
varying float vTip;
#endif
varying vec3 vW;
varying vec3 vN;
varying vec4 vP;
varying vec4 vC;
varying float vAct;
varying vec2 vUv;
uniform mat4 uProjVP, uContentVP;
uniform float uRep, uStick;

void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vP = uProjVP * w;
  #ifdef USE_ACT
  vAct = aAct;
  vUv = uv * uRep;
  #ifdef HAIR
  vTip = aTip;
  #endif
  vC = uContentVP * vec4(mix(w.xyz, aRef, uStick), 1.0);
  #else
  vAct = 0.0;
  vUv = w.xz * uRep;
  vC = uContentVP * w;
  #endif
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const FS_MAIN = `
#include <packing>
uniform sampler2D uShadow;
uniform vec3 uProjPos;
uniform float uNear, uFar, uBias;
uniform float uTime, uScale, uInt, uHue, uReact, uAmb, uLight;
uniform vec3 uLightDir;
uniform vec3 uTouch;
uniform float uTouchAge, uTouchHold;
uniform vec3 uAlbedo;
uniform float uGloss;
uniform sampler2D uNM;
uniform float uHasNM, uNMStr, uFloorProj;
uniform float uPattern, uContrast, uColorize, uShadowK, uSpill;
uniform float uTestPattern;
uniform sampler2D uUserTex;
uniform float uFogStart, uFogLen;
uniform float uChromatic, uBloom, uGodRays, uWrinkle;
uniform vec2 uWindVel;

varying vec3 vW;
varying vec3 vN;
varying vec4 vP;
varying vec4 vC;
varying float vAct;
varying vec2 vUv;
#ifdef HAIR
varying float vTip;
#endif

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0;
}

float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(dot(hash22(i), f), dot(hash22(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
    mix(dot(hash22(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash22(i + vec2(1, 1)), f - vec2(1, 1)), u.x),
    u.y
  ) * 0.5 + 0.5;
}

float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    s += a * gnoise(p);
    p = m * p + vec2(3.1, 1.7);
    a *= 0.5;
  }
  return s;
}

float tri(float x) { return abs(fract(x) - 0.5); }
vec2 tri2(vec2 p) { return vec2(tri(p.x + tri(p.y * 2.0)), tri(p.y + tri(p.x * 2.0))); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

float triNoise(vec2 p, float t) {
  float z = 1.8, z2 = 2.5, rz = 0.0;
  vec2 bp = p;
  mat2 m2 = mat2(0.95534, 0.29552, -0.29552, 0.95534);
  for (int i = 0; i < 5; i++) {
    vec2 dg = tri2(bp * 1.85) * 0.75;
    dg = rot(t * 0.6) * dg;
    p -= dg / z2;
    bp *= 1.3;
    z2 *= 0.45;
    z *= 0.42;
    p *= 1.21 + (rz - 1.0) * 0.02;
    rz += tri(p.x + tri(p.y)) * z;
    p = -(m2 * p);
  }
  return clamp(1.0 - (rz - 0.08) / 0.45, 0.0, 1.0);
}

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + t));
}

// Test pattern overlay for spatial projector alignment
vec3 getTestPattern(vec2 uv) {
  vec2 p = uv * 10.0;
  // Alignment grid
  vec2 grid = abs(fract(p - 0.5) - 0.5) / fwidth(p);
  float line = 1.0 - min(min(grid.x, grid.y), 1.0);
  
  // Center crosshair
  vec2 centerD = abs(uv - 0.5);
  float crosshair = (centerD.x < 0.002 || centerD.y < 0.002) ? 1.0 : 0.0;
  
  // Outer border
  float border = (uv.x < 0.02 || uv.x > 0.98 || uv.y < 0.02 || uv.y > 0.98) ? 1.0 : 0.0;
  
  vec3 col = vec3(0.05, 0.15, 0.25);
  col += vec3(0.1, 0.6, 0.8) * line;
  col = mix(col, vec3(1.0, 0.3, 0.2), crosshair);
  col = mix(col, vec3(0.2, 0.9, 0.4), border);
  return col;
}

vec3 content(vec2 uv, float act, float touch, float wrinkle) {
  if (uTestPattern > 0.5) {
    return getTestPattern(uv) * 1.8;
  }

  vec2 p = uv * uScale;
  float t = uTime;
  vec2 w = vec2(1.0, -0.7) * uReact * (act * 0.8 + touch * 0.6 + wrinkle * uWrinkle * 0.35);

  if (uPattern > 1.5) {
    vec3 c = texture2D(uUserTex, uv + w * 0.04).rgb;
    // Allow deep cavernous voids to stay pitch black while highlights radiate
    c = pow(c, vec3(max(0.6, uContrast * 0.65)));
    return c * uInt * 1.6 + uReact * touch * 0.35;
  }

  float f, h;
  if (uPattern < 0.5) {
    f = triNoise(p * 0.35 + w, t);
    h = gnoise(p * 0.15 + vec2(t * 0.05, 0.0));
  } else {
    vec2 q = vec2(fbm(p + vec2(0.0, t * 0.11)), fbm(p + vec2(5.2, 1.3) - vec2(t * 0.08, 0.0)));
    f = fbm(p + 2.2 * q + w * 2.0);
    h = q.x;
  }
  f = clamp((f - 0.5) * uContrast + 0.5, 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  vec3 c = pal(h * 0.8 + uHue + uReact * (act * 0.2 + touch * 0.15));
  return mix(pal(h * 0.8 + uHue + 0.5) * 0.35, c * 1.6, f) + uReact * touch * 0.35;
}

float shadowAt(vec2 uv, float dist, float ndl) {
  float lit = 0.0;
  vec2 tx = vec2(1.5 / float(${SHADOW_RES}));
  float bias = uBias + 14.0 * (1.0 - ndl);
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      float d = unpackRGBAToDepth(texture2D(uShadow, uv + vec2(float(i), float(j)) * tx)) * (uFar - uNear) + uNear;
      lit += (dist - bias <= d) ? 1.0 : 0.0;
    }
  }
  return smoothstep(0.0, 1.0, lit / 9.0);
}

vec3 perturb(vec3 p, vec3 N, vec3 m, float fd) {
  vec3 q0 = dFdx(p), q1 = dFdy(p);
  vec2 s0 = dFdx(vUv), s1 = dFdy(vUv);
  vec3 q1p = cross(q1, N), q0p = cross(N, q0);
  vec3 T = q1p * s0.x + q0p * s1.x, B = q1p * s0.y + q0p * s1.y;
  float det = max(dot(T, T), dot(B, B));
  float sc = (det == 0.0) ? 0.0 : fd * inversesqrt(det);
  return normalize(T * (m.x * sc) + B * (m.y * sc) + N * m.z);
}

float spec(vec3 N, vec3 L, vec3 V, float fres) {
  float sh = mix(6.0, 600.0, uGloss * uGloss);
  float ndh = max(dot(N, normalize(L + V)), 0.0);
  return uGloss * (sh + 8.0) / 25.13 * pow(ndh, sh) * (0.15 + 0.85 * fres) * 0.35;
}

void main() {
  float fd = gl_FrontFacing ? 1.0 : -1.0;
  vec3 N = normalize(vN) * fd;

  #ifndef HAIR
  if (uHasNM > 0.5 && uNMStr > 0.0) {
    vec3 m = texture2D(uNM, vUv).xyz * 2.0 - 1.0;
    m.xy *= uNMStr * 2.0;
    N = perturb(vW, N, m, fd);
  }
  #endif

  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 5.0);
  float ndlD = max(dot(N, uLightDir), 0.0);
  vec3 col = uAlbedo * (uAmb + uLight * ndlD) + vec3(uLight * ndlD * spec(N, uLightDir, V, fres));

  vec3 ndc = vP.xyz / vP.w;
  float rNdc = length(ndc.xy);
  bool inCone = vP.w > 0.0 && rNdc < 1.0;
  bool proj = inCone;

  #ifdef IS_GROUND
  proj = proj && uFloorProj > 0.5;
  if (inCone && !proj) {
    vec2 uvS = ndc.xy * 0.5 + 0.5;
    vec3 toS = uProjPos - vW;
    float dS = length(toS);
    vec3 LS = toS / dS;
    float ndlS = max(dot(N, LS), 0.0);
    float shS = shadowAt(uvS, dS, max(dot(normalize(vN), LS), 0.0));
    // Soft circular radial falloff (no square box boundary glitch on stage floor)
    float vigS = smoothstep(1.0, 0.2, rNdc);
    float fallS = clamp(pow(1200.0 / dS, 2.0), 0.0, 2.5);
    col += uAlbedo * uSpill * ndlS * vigS * fallS * shS;
    col *= 1.0 - uShadowK * (1.0 - shS) * vigS * 0.85;
  }
  #endif

  if (proj) {
    vec2 uv = ndc.xy * 0.5 + 0.5;
    vec3 toP = uProjPos - vW;
    float dist = length(toP);
    vec3 Lp = toP / dist;
    float ndl = max(dot(N, Lp), 0.0);
    float sh = shadowAt(uv, dist, max(dot(normalize(vN) * fd, Lp), 0.0));
    // Smooth circular vignette (no box edges)
    float vig = smoothstep(1.0, 0.35, rNdc);
    float fall = clamp(pow(1200.0 / dist, 2.0), 0.0, 2.5);

    // Dynamic touch wave shockwave
    float d = distance(vW, uTouch);
    float ring = max(0.0, sin(d * 0.07 - uTouchAge * 7.0)) * exp(-d * 0.005) * exp(-uTouchAge * 0.8) * step(d, uTouchAge * 100.0 + 30.0);
    float touch = ring + exp(-d * 0.025) * uTouchHold;

    // Dynamic screen-space normal derivatives reveal cloth wrinkles
    vec3 dNx = dFdx(vN);
    vec3 dNy = dFdy(vN);
    float wrinkle = clamp(length(dNx) + length(dNy), 0.0, 3.0);

    vec2 cuv = vC.xy / vC.w * 0.5 + 0.5;

    // Prismatic Chromatic Dispersion (spectral wavelength separation)
    vec3 L;
    if (uChromatic > 0.005) {
      vec2 dispOffset = (cuv - 0.5) * (uChromatic * 0.035) + vec2(uWindVel.x, -uWindVel.y) * (uChromatic * 0.00004);
      vec3 L_r = content(cuv + dispOffset, vAct, touch, wrinkle);
      vec3 L_g = content(cuv, vAct, touch, wrinkle);
      vec3 L_b = content(cuv - dispOffset, vAct, touch, wrinkle);
      L = vec3(L_r.r, L_g.g, L_b.b);
    } else {
      L = content(cuv, vAct, touch, wrinkle);
    }

    // Phosphorescent Bloom Flare (high-luminance emission bleed)
    if (uBloom > 0.005) {
      vec3 bloomGlow = pow(max(vec3(0.0), L - 0.55), vec3(2.0)) * uBloom * 2.2;
      L += bloomGlow;
    }

    vec3 projLight = L * uInt * sh * vig * fall;
    col += uAlbedo * projLight * ndl + projLight * ndl * spec(N, Lp, V, fres);

    // Volumetric God-Rays cutting through nocturnal courtyard mist
    if (uGodRays > 0.005) {
      float beamCone = pow(max(0.0, 1.0 - length(ndc.xy) * 0.7), 4.0);
      float dust = (gnoise(vW.xz * 0.02 + vec2(uTime * 0.15, 0.0)) * 0.6 + 0.4);
      vec3 rayTint = mix(vec3(0.15, 0.45, 0.60), vec3(0.5, 0.85, 1.0), L.g);
      col += rayTint * (beamCone * dust * uGodRays * sh * 0.65);
    }
  }

  #ifdef HAIR
  col *= mix(0.2, 1.4, vTip);
  #endif

  // Deep spatial mist
  col *= 1.0 - smoothstep(uFogStart, uFogStart + uFogLen, length(cameraPosition - vW));
  gl_FragColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);
}
`;

export const UC_GLOBALS = `
uniform vec2 uRes, uMouse, uWindVel;
uniform float uMorph, uBass, uCurvature;
uniform sampler2D backbuffer;
uniform sampler2D videoTexture;
uniform float videoEnabled;
uniform float videoBlend;
uniform float videoThreshold;
uniform float videoChroma;
uniform float videoExposure;
float time;
vec2 mouse;
vec2 resolution;
vec2 surfaceSize;
vec2 surfacePosition;
vec2 windVel;
float morph;
float bass;
float curvature;
vec4 uc_fc;
vec4 uc_out;

vec4 getSpectralVideo(vec2 uv) {
  if (videoEnabled < 0.5) return vec4(0.0);
  vec4 vid = texture2D(videoTexture, uv);
  float luma = dot(vid.rgb, vec3(0.299, 0.587, 0.114));
  // Mode 0: Luma Ghost Key
  if (videoBlend < 0.5) {
    float k = smoothstep(videoThreshold * 0.5, max(videoThreshold, 0.05), luma);
    return vec4(vid.rgb * videoExposure, k);
  }
  // Mode 1: Sobel Edge Luminescence
  else if (videoBlend < 1.5) {
    vec2 off = vec2(1.5 / max(resolution.x, 256.0), 1.5 / max(resolution.y, 256.0));
    float lx = dot(texture2D(videoTexture, uv + vec2(off.x, 0.0)).rgb, vec3(0.333)) - dot(texture2D(videoTexture, uv - vec2(off.x, 0.0)).rgb, vec3(0.333));
    float ly = dot(texture2D(videoTexture, uv + vec2(0.0, off.y)).rgb, vec3(0.333)) - dot(texture2D(videoTexture, uv - vec2(0.0, off.y)).rgb, vec3(0.333));
    float edge = length(vec2(lx, ly)) * 5.0;
    return vec4(vec3(0.25, 0.85, 1.0) * edge * videoExposure, clamp(edge, 0.0, 1.0));
  }
  // Mode 2: Slit-Scan Distortion
  else if (videoBlend < 2.5) {
    float slit = sin(uv.y * 36.0 + time * 3.5) * 0.035;
    vec3 c = texture2D(videoTexture, uv + vec2(slit, 0.0)).rgb;
    return vec4(c * videoExposure, 1.0);
  }
  // Mode 3: Ectoplasmic Overlay
  return vec4(vid.rgb * vec3(0.4, 1.0, 0.85) * videoExposure, luma);
}

void uc_main();
`;

export const UC_STUB = 'void uc_main() { uc_out = vec4(0.0); }';

export const QFS_TEMPLATE = `
precision highp float;
uniform float uTime, uScale;
uniform sampler2D uVideoTexture;
uniform float uVideoEnabled, uVideoBlend, uVideoThreshold, uVideoChroma, uVideoExposure;
varying vec2 vUv2;
${UC_GLOBALS}
void main() {
  float k = max(0.2, uScale / 6.0);
  resolution = uRes;
  surfaceSize = vec2(k);
  surfacePosition = (vUv2 - 0.5) * surfaceSize;
  uc_fc = vec4(vUv2 * uRes, 0.5, 1.0);
  time = uTime;
  mouse = uMouse;
  windVel = uWindVel;
  morph = uMorph;
  bass = uBass;
  curvature = uCurvature;
  videoEnabled = uVideoEnabled;
  videoBlend = uVideoBlend;
  videoThreshold = uVideoThreshold;
  videoChroma = uVideoChroma;
  videoExposure = uVideoExposure;
  uc_out = vec4(0.0);
  uc_main();
  vec3 c = uc_out.rgb;
  if (uVideoEnabled > 0.5) {
    vec4 vSample = getSpectralVideo(vUv2);
    if (uVideoBlend < 0.5) {
      c = mix(c, vSample.rgb, vSample.a * 0.85);
    } else if (uVideoBlend < 1.5) {
      c += vSample.rgb;
    } else if (uVideoBlend < 2.5) {
      c = mix(c, vSample.rgb, 0.65);
    } else {
      c = 1.0 - (1.0 - c) * (1.0 - vSample.rgb);
    }
  }
  gl_FragColor = vec4((c.r == c.r && c.g == c.g && c.b == c.b) ? clamp(c, 0.0, 1.0) : vec3(0.0), 1.0);
}
/*USER*/
`;

export function processUserShader(code: string): string {
  const c = code
    .replace(/^[ \t]*#extension[^\n]*$/gm, '')
    .replace(/^[ \t]*precision\s+\w+\s+\w+\s*;/gm, '')
    .replace(
      /^[ \t]*uniform\s+[\w\<\>\[\]]+\s+(uTime|uScale|uRes|uMouse|uWindVel|uMorph|uBass|uCurvature|time|mouse|resolution|surfaceSize|backbuffer|windVel|morph|bass|curvature|videoTexture|uVideoTexture|videoEnabled|uVideoEnabled|videoBlend|uVideoBlend|videoThreshold|uVideoThreshold|videoChroma|uVideoChroma|videoExposure|uVideoExposure)\s*;/gm,
      ''
    )
    .replace(/^[ \t]*varying\s+\w+\s+surfacePosition\s*;/gm, '');
  return (
    '#undef gl_FragColor\n#define gl_FragColor uc_out\n#define gl_FragCoord uc_fc\n#define main uc_main\n' +
    c +
    '\n#undef main\n'
  );
}

export function testUserShader(block: string, gl: WebGLRenderingContext | WebGL2RenderingContext): string | null {
  const gl2 = gl instanceof WebGL2RenderingContext;
  const head =
    (gl2
      ? '#version 300 es\n#define texture2D texture\nout highp vec4 pc_fragColor;\n#define gl_FragColor pc_fragColor\n'
      : '#extension GL_OES_standard_derivatives : enable\n') +
    'precision highp float;\nprecision highp int;\n' +
    UC_GLOBALS +
    '\nvoid main(){uc_main();gl_FragColor=uc_out;}\n';
  const sh = gl.createShader(gl.FRAGMENT_SHADER);
  if (!sh) return 'Unable to allocate shader';
  gl.shaderSource(sh, head + block);
  gl.compileShader(sh);
  const ok = gl.getShaderParameter(sh, gl.COMPILE_STATUS);
  const log = gl.getShaderInfoLog(sh) || '';
  gl.deleteShader(sh);
  if (ok) return null;
  const off = head.split('\n').length + 3;
  return log.replace(/(ERROR:\s*\d+:)(\d+)/g, (_, a, n) => a + Math.max(1, parseInt(n) - off));
}

export interface ShaderPresetItem {
  name: string;
  category: 'raymarch' | 'fractal' | 'morphogenesis' | 'visage';
  desc: string;
  code: string;
}

export const SHADER_PRESETS: Record<string, ShaderPresetItem> = {
  raymarch_phantom: {
    name: '3D Raymarched Wraith',
    category: 'raymarch',
    desc: 'True 3D sphere-traced SDF hollow wraith skull with floating spirit orbs and ambient occlusion',
    code: `// 3D Volumetric Raymarched Spectral Phantom
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform vec2 mouse;
uniform vec2 windVel;
uniform float morph;
uniform float bass;
uniform float curvature;

float sdSphere(vec3 p, float r) { return length(p) - r; }

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(1e-4, k1);
}

mat2 rot2D(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// Scene Signed Distance Field
float mapScene(vec3 p) {
  float t = time * 0.8;
  // Dynamic wind sway
  p.x += sin(p.y * 2.0 + t) * (windVel.x * 0.003 + 0.04);
  p.z += cos(p.y * 1.5 + t) * (windVel.y * 0.003 + 0.03);

  // Skull / Head ellipsoid
  vec3 pHead = p - vec3(0.0, 0.15, 0.0);
  float head = sdEllipsoid(pHead, vec3(0.55, 0.72 + bass * 0.15, 0.52));

  // Hollow Cavernous Eye Sockets (negative shapes)
  vec3 eyeL = p - vec3(-0.20, 0.22, 0.38);
  vec3 eyeR = p - vec3(0.20, 0.22, 0.38);
  eyeL.xy *= rot2D(0.2);
  eyeR.xy *= rot2D(-0.2);
  float socL = sdEllipsoid(eyeL, vec3(0.12, 0.18, 0.25));
  float socR = sdEllipsoid(eyeR, vec3(0.12, 0.18, 0.25));
  float eyesVoid = min(socL, socR);

  // Agonized Mouth Aperture
  float mouthY = -0.15 - bass * 0.12;
  vec3 pMouth = p - vec3(0.0, mouthY, 0.34);
  float mouthVoid = sdEllipsoid(pMouth, vec3(0.16 + bass * 0.08, 0.24 + bass * 0.15, 0.3));

  // Organic shroud draping waves
  float clothWaves = sin(p.x * 6.0 + t) * cos(p.y * 5.0 - t * 0.8) * sin(p.z * 6.0) * (0.06 + morph * 0.05);

  float d = max(head + clothWaves, -eyesVoid);
  d = max(d, -mouthVoid);

  // Orbiting spirit orbs
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float a = t * (1.2 + fi * 0.4) + fi * 2.094;
    vec3 orbPos = vec3(cos(a) * 0.75, sin(t * 2.0 + fi) * 0.35 + 0.1, sin(a) * 0.75);
    d = min(d, sdSphere(p - orbPos, 0.06 + sin(t * 3.0 + fi) * 0.02));
  }
  return d;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.003, 0.0);
  return normalize(vec3(
    mapScene(p + e.xyy) - mapScene(p - e.xyy),
    mapScene(p + e.yxy) - mapScene(p - e.yxy),
    mapScene(p + e.yyx) - mapScene(p - e.yyx)
  ));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / min(resolution.x, resolution.y);
  float t = time * 0.6;

  // Ray setup
  vec3 ro = vec3(0.0, 0.1, 2.2);
  vec3 rd = normalize(vec3(uv, -1.35));

  // Raymarch loop
  float totalDist = 0.0;
  float minDist = 999.0;
  vec3 col = vec3(0.0);
  bool hit = false;
  vec3 p = ro;

  for (int i = 0; i < 48; i++) {
    p = ro + rd * totalDist;
    float d = mapScene(p);
    minDist = min(minDist, d);
    if (d < 0.002) {
      hit = true;
      break;
    }
    if (totalDist > 4.5) break;
    totalDist += d * 0.85;
  }

  // Ethereal volumetric glow around the silhouette
  float halo = exp(-minDist * 9.0) * 0.65;
  vec3 glowColor = mix(vec3(0.05, 0.85, 0.75), vec3(0.65, 0.20, 0.95), sin(t + uv.y * 3.0) * 0.5 + 0.5);
  col += glowColor * halo;

  if (hit) {
    vec3 n = calcNormal(p);
    vec3 lightDir = normalize(vec3(0.5, 0.8, 0.7));
    float diff = max(dot(n, lightDir), 0.0);
    float fresnel = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);
    
    // Hollow inner void is deep obsidian
    float depthInMouth = smoothstep(0.1, -0.2, p.z);
    vec3 baseColor = mix(vec3(0.12, 0.80, 0.85), vec3(0.02, 0.02, 0.05), depthInMouth);
    baseColor = mix(baseColor, vec3(0.75, 0.25, 0.95), fresnel * 0.8);

    col = baseColor * (diff * 0.7 + 0.3) + vec3(0.3, 0.9, 1.0) * fresnel * 1.5;

    // Glowing pupil voids
    float eyePupilL = length(p - vec3(-0.20, 0.22, 0.26));
    float eyePupilR = length(p - vec3(0.20, 0.22, 0.26));
    if (min(eyePupilL, eyePupilR) < 0.08) {
      col += vec3(1.0, 0.95, 0.8) * 3.5;
    }
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  },

  mandelbulb_fractal: {
    name: '3D Mandelbulb Fractal',
    category: 'fractal',
    desc: '8th-order hyper-dimensional Mandelbulb fractal manifold with dynamic orbit trap coloring',
    code: `// 3D Quaternion Mandelbulb Fractal with Morph Manifold
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform vec2 mouse;
uniform vec2 windVel;
uniform float morph;
uniform float bass;

float mandelbulbSDF(vec3 pos, out float outTrap) {
  vec3 w = pos;
  float m = dot(w, w);
  float dz = 1.0;
  float trap = 1e10;
  float power = 6.0 + morph * 4.0 + bass * 1.5;

  for (int i = 0; i < 6; i++) {
    trap = min(trap, length(w.xz));
    dz = power * pow(m, 0.5 * (power - 1.0)) * dz + 1.0;
    float r = length(w);
    float b = power * acos(clamp(w.y / max(1e-4, r), -1.0, 1.0));
    float a = power * atan(w.x, w.z);
    w = pos + pow(r, power) * vec3(sin(b) * sin(a), cos(b), sin(b) * cos(a));
    m = dot(w, w);
    if (m > 4.0) break;
  }
  outTrap = trap;
  return 0.25 * log(m) * sqrt(m) / dz;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / min(resolution.x, resolution.y);
  float t = time * 0.4;

  // Camera ray setup with dynamic rotation
  vec3 ro = vec3(sin(t * 0.5) * 2.2, cos(t * 0.3) * 0.5, cos(t * 0.5) * 2.2);
  vec3 ta = vec3(0.0, 0.0, 0.0);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.4 * ww);

  float d = 0.0;
  float trap = 0.0;
  float total = 0.0;
  vec3 col = vec3(0.0);

  for (int i = 0; i < 40; i++) {
    vec3 p = ro + rd * total;
    d = mandelbulbSDF(p, trap);
    if (d < 0.003) break;
    if (total > 5.0) break;
    total += d * 0.7;
  }

  if (d < 0.005) {
    vec3 palA = vec3(0.1, 0.9, 0.7);
    vec3 palB = vec3(0.9, 0.2, 0.8);
    col = mix(palA, palB, sin(trap * 6.0 + t) * 0.5 + 0.5);
    col *= 1.4;
    col += vec3(0.3, 0.8, 1.0) * pow(clamp(1.0 - total / 4.0, 0.0, 1.0), 2.0);
  } else {
    // Distant recursive starfield
    col = vec3(0.01, 0.02, 0.04) + vec3(0.05, 0.3, 0.4) * exp(-d * 4.0);
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  },

  reaction_diffusion: {
    name: 'Reaction-Diffusion Morphogenesis',
    category: 'morphogenesis',
    desc: 'Turing chemical morphogenesis with multi-scale Laplacian patterns reacting to wind and wrinkles',
    code: `// Gray-Scott Biomorphic Reaction-Diffusion Morphogenesis
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform vec2 mouse;
uniform vec2 windVel;
uniform float morph;
uniform float bass;
uniform float curvature;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0, 0)), hash(i + vec2(1, 0)), u.x),
    mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  float t = time * 0.5;

  // Morphogenesis simulation scale
  vec2 p = (uv - 0.5) * 8.0;
  // Wind shear and cloth wrinkles create live turbulence
  p += vec2(windVel.x, -windVel.y) * 0.004;
  p += vec2(sin(p.y * 3.0 + t), cos(p.x * 3.0 - t)) * (0.3 + curvature * 0.2);

  // Multi-frequency reaction diffusion approximation
  float pattern = 0.0;
  for (int i = 1; i <= 4; i++) {
    float fi = float(i);
    vec2 q = p * (1.0 + fi * 0.8);
    float n = fbm(q + vec2(t * 0.15 * fi, -t * 0.1 * fi));
    float bands = sin(n * 16.0 + morph * 6.0 + bass * 4.0);
    pattern += abs(bands) / fi;
  }

  // Turing morphogen concentration spots & labyrinths
  float uChem = smoothstep(0.4, 0.8, pattern);
  float vChem = smoothstep(0.2, 0.5, pattern) - uChem;

  vec3 bioCyan = vec3(0.08, 0.95, 0.85);
  vec3 bioViolet = vec3(0.65, 0.15, 0.92);
  vec3 bioGold = vec3(0.98, 0.80, 0.25);
  vec3 abyss = vec3(0.01, 0.015, 0.03);

  vec3 col = mix(abyss, bioCyan, uChem);
  col = mix(col, bioViolet, vChem * 1.3);
  col += bioGold * pow(max(0.0, uChem * vChem * 3.5), 2.0);

  // Phosphorescent rim highlights
  float edge = fwidth(pattern) * 2.5;
  col += vec3(0.8, 1.0, 1.0) * edge;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  },

  hyperbolic_lattice: {
    name: 'Non-Euclidean Hyperbolic Lattice',
    category: 'fractal',
    desc: 'Poincaré disk conformal hyperbolic tessellation with recursive kaleidoscopic folding',
    code: `// Non-Euclidean Hyperbolic Lattice & Kaleidoscopic Manifold
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform vec2 mouse;
uniform vec2 windVel;
uniform float morph;
uniform float bass;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / min(resolution.x, resolution.y);
  float t = time * 0.4;

  // Poincaré disk hyperbolic inversion
  float r = length(uv);
  if (r > 0.495) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Hyperbolic metric stretching towards boundary
  vec2 p = uv / (0.5 - r * r);
  p += vec2(sin(t * 0.5), cos(t * 0.4)) * 0.2;
  p += windVel * 0.002;

  // Kaleidoscopic recursive foldings
  float folds = 6.0 + floor(morph * 4.0);
  for (int i = 0; i < 4; i++) {
    float a = atan(p.y, p.x);
    a = mod(a, 6.283185 / folds) - 3.141592 / folds;
    p = length(p) * vec2(cos(a), sin(a));
    p = abs(p) - vec2(0.4, 0.4);
  }

  float line = smoothstep(0.04, 0.008, abs(sin(p.x * 8.0) * cos(p.y * 8.0)));
  float glow = exp(-length(p) * 2.0);

  vec3 col = vec3(0.05, 0.85, 0.95) * line * 2.0;
  col += vec3(0.9, 0.2, 0.7) * glow * (1.0 + bass * 1.5);
  col *= smoothstep(0.495, 0.46, r); // Clean disk boundary

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  },

  cymatics_resonance: {
    name: 'Acoustic Cymatic Resonator',
    category: 'morphogenesis',
    desc: 'Chladni plate acoustic nodal lines and vibrating sand particles tuned to sound frequencies',
    code: `// Acoustic Cymatic Resonator & Chladni Wave Vibration
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform vec2 mouse;
uniform float bass;
uniform float morph;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / min(resolution.x, resolution.y);
  float t = time * 0.7;

  // Chladni modal frequencies (n, m)
  float n = 3.0 + floor(morph * 3.0);
  float m = 5.0 + floor(morph * 4.0);

  vec2 p = uv * 3.141592 * 2.0;
  float chladni = cos(n * p.x) * cos(m * p.y) - cos(m * p.x) * cos(n * p.y);
  
  // High-frequency harmonic interference
  float ripple = sin(length(uv) * 45.0 - t * 8.0 - bass * 12.0);
  float nodalLine = smoothstep(0.12, 0.015, abs(chladni));
  
  vec3 sandGlow = vec3(0.1, 0.95, 0.75);
  vec3 coreElectric = vec3(0.7, 0.3, 1.0);
  vec3 col = mix(sandGlow, coreElectric, ripple * 0.5 + 0.5) * nodalLine * 2.5;
  col += vec3(0.05, 0.25, 0.35) * exp(-abs(chladni) * 3.0);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  },

  ectoplasm: {
    name: 'Weeping Spectral Face',
    category: 'visage',
    desc: 'Terrifying weeping phantom face with hollow eye sockets and streaming spectral tears',
    code: `// Terrifying Weeping Phantom Face with Hollow Eye Sockets & Streaming Tears
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform vec2 mouse;
uniform vec2 windVel;
uniform float bass;
uniform float curvature;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / resolution.y;
  float t = time * 0.7;
  
  // Ghostly ectoplasm swirls distorting the facial contour with wind
  vec2 warp = vec2(
    noise(uv * 5.0 + vec2(t * 0.25, -t * 0.2) + windVel * 0.002),
    noise(uv * 5.0 + vec2(-t * 0.2, t * 0.25) - windVel * 0.002)
  ) * 0.08;
  vec2 p = uv + warp;
  
  // Phantom head silhouette
  float headDist = length(vec2(p.x * 1.15, p.y * 0.95 - 0.04));
  float headGlow = smoothstep(0.48, 0.16, headDist);
  
  // Sunken Hollow Cavernous Eye Sockets
  vec2 eyeL = vec2(-0.16, 0.14);
  vec2 eyeR = vec2(0.16, 0.14);
  
  float dEyeL = length(vec2((p.x - eyeL.x) * 1.3 - (p.y - eyeL.y) * 0.5, (p.y - eyeL.y) * 1.8 + (p.x - eyeL.x) * 0.4));
  float dEyeR = length(vec2((p.x - eyeR.x) * 1.3 + (p.y - eyeR.y) * 0.5, (p.y - eyeR.y) * 1.8 - (p.x - eyeR.x) * 0.4));
  
  float socketL = smoothstep(0.09, 0.02, dEyeL);
  float socketR = smoothstep(0.09, 0.02, dEyeR);
  float socketVoid = max(socketL, socketR);
  
  // Piercing glowing spectral pupils inside the hollow cavities
  float pupilL = smoothstep(0.024, 0.004, dEyeL);
  float pupilR = smoothstep(0.024, 0.004, dEyeR);
  float pupils = max(pupilL, pupilR);
  
  // Weeping luminous spectral tears trickling down the shroud folds
  float tearStreamL = 0.0;
  float tearStreamR = 0.0;
  if (p.y < eyeL.y && abs(p.x - eyeL.x) < 0.055) {
    float streak = noise(vec2(p.x * 45.0, p.y * 8.0 - t * 3.2));
    tearStreamL = smoothstep(0.035, 0.005, abs(p.x - eyeL.x)) * (eyeL.y - p.y) * 4.0 * streak;
  }
  if (p.y < eyeR.y && abs(p.x - eyeR.x) < 0.055) {
    float streak = noise(vec2(p.x * 45.0 + 12.0, p.y * 8.0 - t * 3.2));
    tearStreamR = smoothstep(0.035, 0.005, abs(p.x - eyeR.x)) * (eyeR.y - p.y) * 4.0 * streak;
  }
  float tears = clamp(tearStreamL + tearStreamR, 0.0, 1.8);
  
  // Agape screaming mouth void expanding with bass audio
  vec2 mouthCenter = vec2(0.0, -0.16 + sin(t * 1.5) * 0.025 - bass * 0.08);
  float dMouth = length(vec2(p.x * (1.8 - bass * 0.4), (p.y - mouthCenter.y) * (1.15 - bass * 0.3)));
  float mouthVoid = smoothstep(0.13 + bass * 0.08, 0.04, dMouth);
  
  // Ectoplasmic smoky mist enveloping the head
  float mist = noise(p * 6.0 + vec2(t * 0.4, t * 0.2)) * noise(p * 3.0 - vec2(t * 0.3, t * 0.4));
  
  vec3 ectoTeal = vec3(0.05, 0.90, 0.75);
  vec3 ectoCyan = vec3(0.40, 0.96, 1.0);
  vec3 spectralViolet = vec3(0.60, 0.15, 0.92);
  vec3 deepVoid = vec3(0.0, 0.0, 0.0);
  
  vec3 col = mix(ectoTeal * 0.45, ectoCyan, headGlow * (0.65 + 0.35 * mist));
  col += spectralViolet * (1.0 - headGlow) * mist * 0.85;
  
  // Plunge eye sockets and screaming mouth into pure pitch-black abyss
  col = mix(col, deepVoid, socketVoid);
  col = mix(col, deepVoid, mouthVoid);
  
  // Radiate piercing glowing pupils and weeping tears
  col += vec3(0.9, 1.0, 1.0) * pupils * 4.5;
  col += vec3(0.2, 0.95, 1.0) * tears * 2.5;
  
  float vignette = smoothstep(0.55, 0.22, length(uv));
  gl_FragColor = vec4(clamp(col * vignette, 0.0, 1.0), 1.0);
}`,
  },

  banshee: {
    name: 'Banshee Screamer Void',
    category: 'visage',
    desc: 'Screaming banshee void radiating sound-reactive acoustic spectral shockwaves',
    code: `// Screaming Banshee Void with Sound-Reactive Spectral Shockwaves
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform vec2 mouse;
uniform float bass;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / resolution.y;
  float t = time * 0.8;
  
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  
  // Resonating screaming mouth void
  float jawOpen = 0.22 + sin(t * 2.0) * 0.06 + bass * 0.12;
  float mouthVoid = smoothstep(jawOpen, jawOpen * 0.3, length(vec2(uv.x * 1.5, uv.y + 0.1)));
  
  // High-frequency sonic screaming ripples
  float waves = sin(r * 32.0 - t * 8.0 + a * 2.0 - bass * 14.0);
  float shock = smoothstep(0.2, 0.8, waves) * exp(-r * 2.0);
  
  // Piercing glowing eyes
  float eyeL = smoothstep(0.07, 0.015, length(vec2(uv.x + 0.18, uv.y - 0.16)));
  float eyeR = smoothstep(0.07, 0.015, length(vec2(uv.x - 0.18, uv.y - 0.16)));
  
  vec3 col = vec3(0.05, 0.75, 0.90) * shock * (1.4 + bass * 1.2);
  col += vec3(0.85, 0.15, 0.40) * exp(-r * 3.5) * 0.7; // eerie phantom crimson
  col = mix(col, vec3(0.0), mouthVoid);
  col = mix(col, vec3(0.0), max(eyeL, eyeR));
  col += vec3(1.0, 1.0, 1.0) * (smoothstep(0.02, 0.005, length(vec2(uv.x + 0.18, uv.y - 0.16))) +
                                smoothstep(0.02, 0.005, length(vec2(uv.x - 0.18, uv.y - 0.16)))) * 4.0;
  
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  },

  screaming_banshee: {
    name: 'Banshee Screamer Void',
    category: 'visage',
    desc: 'Screaming banshee void radiating sound-reactive acoustic spectral shockwaves',
    code: `// Screaming Banshee Void with Sound-Reactive Spectral Shockwaves
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform vec2 mouse;
uniform float bass;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / resolution.y;
  float t = time * 0.8;
  
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  
  // Resonating screaming mouth void
  float jawOpen = 0.22 + sin(t * 2.0) * 0.06 + bass * 0.12;
  float mouthVoid = smoothstep(jawOpen, jawOpen * 0.3, length(vec2(uv.x * 1.5, uv.y + 0.1)));
  
  // High-frequency sonic screaming ripples
  float waves = sin(r * 32.0 - t * 8.0 + a * 2.0 - bass * 14.0);
  float shock = smoothstep(0.2, 0.8, waves) * exp(-r * 2.0);
  
  // Piercing glowing eyes
  float eyeL = smoothstep(0.07, 0.015, length(vec2(uv.x + 0.18, uv.y - 0.16)));
  float eyeR = smoothstep(0.07, 0.015, length(vec2(uv.x - 0.18, uv.y - 0.16)));
  
  vec3 col = vec3(0.05, 0.75, 0.90) * shock * (1.4 + bass * 1.2);
  col += vec3(0.85, 0.15, 0.40) * exp(-r * 3.5) * 0.7; // eerie phantom crimson
  col = mix(col, vec3(0.0), mouthVoid);
  col = mix(col, vec3(0.0), max(eyeL, eyeR));
  col += vec3(1.0, 1.0, 1.0) * (smoothstep(0.02, 0.005, length(vec2(uv.x + 0.18, uv.y - 0.16))) +
                                smoothstep(0.02, 0.005, length(vec2(uv.x - 0.18, uv.y - 0.16)))) * 4.0;
  
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  },

  phantom_void: {
    name: 'Abyssal Ectoplasm Mist',
    category: 'visage',
    desc: 'Deep swirling nocturnal vapors with bioluminescent sea-green spirit embers',
    code: `// Deep smoke with ghostly bioluminescent embers
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform vec2 windVel;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  float t = time * 0.3;
  
  vec2 p = uv * 4.0 - vec2(2.0);
  p += windVel * 0.003;
  float len = length(p);
  float angle = atan(p.y, p.x);
  
  float swirl = sin(angle * 3.0 + len * 4.0 - t * 2.0);
  float smoke = sin(p.x * 2.0 + swirl) * cos(p.y * 2.0 + t);
  
  vec3 dark = vec3(0.01, 0.02, 0.04);
  vec3 glow = vec3(0.15, 0.85, 0.65); // phantom sea-green
  vec3 high = vec3(0.70, 0.98, 0.92);
  
  vec3 col = mix(dark, glow, smoothstep(-0.5, 0.5, smoke));
  col += high * pow(max(0.0, smoke), 3.0) * 0.8;
  
  gl_FragColor = vec4(col, 1.0);
}`,
  },

  spectral_projection: {
    name: 'Live Spectral Projection Visage',
    category: 'visage',
    desc: 'Transforms live webcam stream or video into luminous glowing apparition with chromatic aberration and edge neon radiance',
    code: `// Live Webcam & Video Spectral Projection Visage
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float bass;
uniform float morph;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  
  // Chromatic dispersion offsets driven by bass and spectral turbulence
  vec2 shift = vec2(0.006 + bass * 0.012, 0.0) * sin(time * 2.5 + uv.y * 6.0);
  vec4 vidCenter = getSpectralVideo(uv);
  vec4 vidR = getSpectralVideo(uv + shift);
  vec4 vidB = getSpectralVideo(uv - shift);
  
  // Prismatic spectral composite
  vec3 spectralCol = vec3(vidR.r, vidCenter.g, vidB.b);
  
  // Ambient spirit haze background
  float haze = sin(uv.x * 8.0 + time) * cos(uv.y * 7.0 - time * 0.8) * 0.15 + 0.15;
  vec3 ambientVoid = vec3(0.04, 0.08, 0.14) * (1.0 + haze);
  
  // Pulsing ethereal luminescence
  float aura = 1.0 + 0.35 * sin(time * 4.0 + uv.x * 12.0);
  vec3 finalVisage = ambientVoid + spectralCol * aura * (1.3 + bass * 0.8);
  
  gl_FragColor = vec4(clamp(finalVisage, 0.0, 1.0), 1.0);
}`,
  },
};

