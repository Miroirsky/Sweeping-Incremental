/**
 * Sweeping Incremental - WebGL Shader Pipeline, Mask Textures & 2D Canvas Entity Drawing
 */

import { Values } from './data.js';
import {
  state,
  stationGeometry,
  syncGridDimensions,
  getRoomDustCapacity,
  getMaxVacuumCapacity
} from './state.js';

export const glCanvas = document.getElementById('glcanvas');
export const overlayCanvas = document.getElementById('overlay-canvas');
export const overlayCtx = overlayCanvas.getContext('2d');

// Default Vacuum Bot Images (B.O.B. Bottom & Top)
export const bobBottomImg = new Image();
bobBottomImg.src = (Values.vacuum && Values.vacuum.bottomImage) || 'assets/icons/B.O.B. Bottom.png';

export const bobTopImg = new Image();
bobTopImg.src = (Values.vacuum && Values.vacuum.topImage) || 'assets/icons/B.O.B. Top.png';

// WebGL Context & Objects
let gl = null;
let shaderProgram = null;
let maskTexture = null;
let dirtTexture = null;

// --- Shaders ---
const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Fragment Shader: Centered square room, 2 Perlin noise layers, brown carpet, dust erasure, dirt layer
const fragmentShaderSource = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform vec4 u_room; // (roomMinX, roomMinY, roomSize, roomSize) in gl_FragCoord px
  uniform vec4 u_station; // (stationMinX, stationMinY, stationWidth, stationHeight) in gl_FragCoord px
  uniform float u_station_open; // 1.0 if station space is open on the right, 0.0 if closed
  uniform sampler2D u_mask;
  uniform sampler2D u_dirt_mask;
  uniform vec2 u_cleaner; // gl_FragCoord px
  uniform float u_cleaner_radius;
  uniform float u_dust_fill; // [0.0 .. 1.0] vacuum canister dust fraction
  uniform float u_dirt_fill; // [0.0 .. 1.0] vacuum canister dirt fraction
  uniform float u_cleaner_is_full; // 1.0 if vacuum canister is full
  uniform vec2 u_noise_offset;
  uniform float u_time;

  varying vec2 v_uv;

  // 2D Hash function
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  // 2D Perlin Noise
  float perlin(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float n00 = dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
    float n10 = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
    float n01 = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
    float n11 = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));

    return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
  }

  void main() {
    vec2 fragCoord = gl_FragCoord.xy;

    // Coordinate relative to square room: [0..1, 0..1]
    vec2 roomUV = (fragCoord - u_room.xy) / u_room.zw;

    // Distance to room boundary in pixels (positive inside, negative outside)
    float edgeDistX = min(fragCoord.x - u_room.x, (u_room.x + u_room.z) - fragCoord.x);
    float edgeDistY = min(fragCoord.y - u_room.y, (u_room.y + u_room.w) - fragCoord.y);
    float roomEdgeDist = min(edgeDistX, edgeDistY);
    bool isInsideRoom = (roomEdgeDist >= 0.0);

    // Station alcove on the right of the room
    bool isInsideStation = false;
    float stationEdgeDist = -9999.0;
    if (u_station_open > 0.5) {
      float sDistX = min(fragCoord.x - u_station.x, (u_station.x + u_station.z) - fragCoord.x);
      float sDistY = min(fragCoord.y - u_station.y, (u_station.y + u_station.w) - fragCoord.y);
      stationEdgeDist = min(sDistX, sDistY);
      isInsideStation = (fragCoord.x >= u_station.x - 1.5 && fragCoord.x <= u_station.x + u_station.z &&
                         fragCoord.y >= u_station.y && fragCoord.y <= u_station.y + u_station.w);
    }

    bool isInsidePlayfield = isInsideRoom || isInsideStation;

    // Distance to combined playfield boundary for exterior walls/trim
    float playfieldDist = roomEdgeDist;
    if (u_station_open > 0.5) {
      playfieldDist = max(roomEdgeDist, stationEdgeDist);
    }

    vec3 surface = vec3(0.0);

    if (!isInsidePlayfield) {
      // Outside the room & station: Dark cozy floor / wall frame
      float distFromRoom = -playfieldDist;
      
      // Dark floor base
      vec3 outsideFloor = vec3(0.08, 0.05, 0.03);
      
      // Wooden frame/baseboard trim around the room and station perimeter
      float trim = smoothstep(14.0, 0.0, distFromRoom);
      vec3 trimColor = vec3(0.22, 0.14, 0.09);
      // Bevel highlight right along the floor edge
      float bevel = smoothstep(3.0, 0.0, distFromRoom);
      trimColor = mix(trimColor, vec3(0.35, 0.23, 0.15), bevel);
      
      surface = mix(outsideFloor, trimColor, trim);
    } else if (isInsideStation && !isInsideRoom) {
      // Inside Station square on the right (Clean square tiles pattern)
      vec2 stationUV = (fragCoord - u_station.xy) / u_station.zw;
      vec2 tile = fract(stationUV * vec2(4.0, 4.0));
      float tileBorder = step(0.05, tile.x) * step(0.05, tile.y);
      vec3 stationFloor = mix(vec3(0.10, 0.12, 0.15), vec3(0.18, 0.21, 0.26), tileBorder);

      // Ambient contact shadow along station perimeter walls
      float sDistX = (u_station.x + u_station.z) - fragCoord.x;
      float sDistY = min(fragCoord.y - u_station.y, (u_station.y + u_station.w) - fragCoord.y);
      float sDist = min(sDistX, sDistY);
      float stationShadow = smoothstep(0.0, 14.0, sDist);
      stationFloor *= (0.78 + 0.22 * stationShadow);

      surface = stationFloor;
    } else {
      // Inside the square room:

      // ==========================================
      // 1. DUST LAYER (Grey with 2 Perlin noise layers)
      // ==========================================
      float n1 = perlin(roomUV * 4.2 + u_noise_offset);
      float n2 = perlin(roomUV * 12.5 + u_noise_offset * 1.7);

      float dustPattern = 0.5 + 0.38 * n1 + 0.24 * n2;
      dustPattern = clamp(dustPattern, 0.0, 1.0);

      // Micro grit noise
      float grit = fract(sin(dot(floor(fragCoord), vec2(12.9898, 78.233))) * 43758.5453);

      vec3 lightGrey = vec3(0.73, 0.74, 0.77);
      vec3 darkGrey  = vec3(0.31, 0.32, 0.35);
      vec3 dustColor = mix(darkGrey, lightGrey, dustPattern);
      dustColor += (grit - 0.5) * 0.05;

      // ==========================================
      // 2. CARPET BACKGROUND (Warm brown plush texture)
      // ==========================================
      vec2 carpetP = roomUV * 50.0;
      float weave = sin(carpetP.x * 3.14159) * cos(carpetP.y * 3.14159);
      float fiberNoise = perlin(roomUV * 30.0 + vec2(37.5, 82.1));
      float microPile = fract(sin(dot(floor(fragCoord * 0.5), vec2(17.3, 59.7))) * 53123.4);

      // Cozy warm brown tones
      vec3 carpetDeepMocha = vec3(0.33, 0.19, 0.11);
      vec3 carpetWarmCaramel = vec3(0.50, 0.32, 0.19);
      vec3 carpetColor = mix(carpetDeepMocha, carpetWarmCaramel, 0.5 + 0.3 * fiberNoise + 0.15 * weave);
      carpetColor += (microPile - 0.5) * 0.05;

      // ==========================================
      // 3. DUST LAYER (Grey with 2 Perlin noise layers)
      // ==========================================
      vec2 maskUV = vec2(roomUV.x, 1.0 - roomUV.y);
      float dustVal = texture2D(u_mask, maskUV).r; // fraction of dust: 0.0 (clean) to 1.0 (full dust)

      // Reveal carpet underneath dust proportionally to remaining dust
      surface = mix(carpetColor, dustColor, clamp(dustVal, 0.0, 1.0));

      // ==========================================
      // 3.5. DIRT LAYER (Dirt is directly OVER dust pixels)
      // ==========================================
      float dirtVal = texture2D(u_dirt_mask, maskUV).r; // fraction of dirt: 0.0 to 1.0
      if (dirtVal > 0.001) {
        float dirtNoise = perlin(roomUV * 22.0 + u_noise_offset * 0.3);
        float microTexture = perlin(roomUV * 55.0);

        // Warm terracotta/clay dirt tones
        vec3 deepDirt = vec3(0.55, 0.27, 0.20);
        vec3 warmDirt = vec3(0.72, 0.38, 0.30);
        vec3 rimDirt  = vec3(0.44, 0.19, 0.13);

        vec3 dirtColor = mix(deepDirt, warmDirt, 0.5 + 0.35 * dirtNoise + 0.15 * microTexture);

        // Dirt opacity proportional to remaining dirt mass
        float dirtAlpha = clamp(dirtVal, 0.0, 1.0);
        float edgeRim = smoothstep(0.02, 0.15, dirtVal) * (1.0 - smoothstep(0.15, 0.35, dirtVal));
        dirtColor = mix(dirtColor, rimDirt, edgeRim * 0.35);

        // Dirt sits directly over dust
        surface = mix(surface, dirtColor, dirtAlpha);
      }

      // Soft wall ambient occlusion inside perimeter of room
      float wallShadow = smoothstep(0.0, 16.0, roomEdgeDist);
      surface *= (0.76 + 0.24 * wallShadow);
    }

    gl_FragColor = vec4(surface, 1.0);
  }
`;

// --- WebGL Helper Functions ---
function createShader(glCtx, type, source) {
  const shader = glCtx.createShader(type);
  glCtx.shaderSource(shader, source);
  glCtx.compileShader(shader);
  if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
    console.error('Shader compilation error:', glCtx.getShaderInfoLog(shader));
    glCtx.deleteShader(shader);
    return null;
  }
  return shader;
}

export function initWebGL() {
  gl = glCanvas.getContext('webgl', { antialias: true, alpha: false, depth: false });
  if (!gl) {
    alert('WebGL is not supported by your browser.');
    return false;
  }

  const vShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vShader);
  gl.attachShader(shaderProgram, fShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error('Program linking error:', gl.getProgramInfoLog(shaderProgram));
    return false;
  }

  // Fullscreen quad buffer
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1
  ]), gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(shaderProgram, 'a_position');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  // Create mask texture
  maskTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, maskTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Create dirt texture
  dirtTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, dirtTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return true;
}

export function initTextures() {
  syncGridDimensions();
  state.currentScreenDustGrams = getRoomDustCapacity();
  const dustPerPx = Values.room.dustPerPixel;
  for (let i = 0; i < state.TOTAL_PIXELS; i++) {
    state.dustGrid[i] = dustPerPx;
    state.dirtGrid[i] = 0.0;
    state.dustBytes[i] = 255;
    state.dirtBytes[i] = 0;
    state.lastCleanedTime[i] = 0;
  }
  updateDustTexture();
  updateDirtTexture();
}

export function updateDustTexture() {
  if (!gl || !maskTexture) return;
  const dustPerPx = Values.room.dustPerPixel;
  for (let i = 0; i < state.TOTAL_PIXELS; i++) {
    state.dustBytes[i] = Math.min(255, Math.max(0, Math.floor((state.dustGrid[i] / dustPerPx) * 255.99)));
  }
  gl.bindTexture(gl.TEXTURE_2D, maskTexture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, state.GRID_RES, state.GRID_RES, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, state.dustBytes);
}

export function updateDirtTexture() {
  if (!gl || !dirtTexture) return;
  const dirtPerPx = Values.room.dirtPerPixel;
  for (let i = 0; i < state.TOTAL_PIXELS; i++) {
    state.dirtBytes[i] = Math.min(255, Math.max(0, Math.floor((state.dirtGrid[i] / dirtPerPx) * 255.99)));
  }
  gl.bindTexture(gl.TEXTURE_2D, dirtTexture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, state.GRID_RES, state.GRID_RES, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, state.dirtBytes);
}

export function resizeCanvases() {
  glCanvas.width = state.width * state.dpr;
  glCanvas.height = state.height * state.dpr;
  if (gl) {
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  }
  overlayCanvas.width = state.width;
  overlayCanvas.height = state.height;
}

export function renderWebGL(time) {
  if (!gl || !shaderProgram) return;

  const { width, height, dpr, roomX, roomY, roomSize, cleanerPos, cleanerRadius, noiseOffset, startTime } = state;

  gl.useProgram(shaderProgram);

  // Uniform: resolution
  const uResolution = gl.getUniformLocation(shaderProgram, 'u_resolution');
  gl.uniform2f(uResolution, glCanvas.width, glCanvas.height);

  // Uniform: room bounds in WebGL pixels (Y=0 at bottom)
  const roomMinX_dpr = roomX * dpr;
  const roomMinY_dpr = (height - (roomY + roomSize)) * dpr;
  const roomSize_dpr = roomSize * dpr;

  const uRoom = gl.getUniformLocation(shaderProgram, 'u_room');
  gl.uniform4f(uRoom, roomMinX_dpr, roomMinY_dpr, roomSize_dpr, roomSize_dpr);

  // Uniforms: Station alcove bounds (in WebGL pixels, Y=0 at bottom)
  const uStation = gl.getUniformLocation(shaderProgram, 'u_station');
  const uStationOpen = gl.getUniformLocation(shaderProgram, 'u_station_open');
  if (stationGeometry.isOpen) {
    gl.uniform4f(
      uStation,
      stationGeometry.x * dpr,
      (height - (stationGeometry.y + stationGeometry.height)) * dpr,
      stationGeometry.width * dpr,
      stationGeometry.height * dpr
    );
    gl.uniform1f(uStationOpen, 1.0);
  } else {
    gl.uniform4f(uStation, 0.0, 0.0, 0.0, 0.0);
    gl.uniform1f(uStationOpen, 0.0);
  }

  // Cleaner position in screen pixels (gl_FragCoord has Y=0 at bottom)
  const uCleaner = gl.getUniformLocation(shaderProgram, 'u_cleaner');
  gl.uniform2f(uCleaner, cleanerPos.x * dpr, (height - cleanerPos.y) * dpr);

  const uCleanerRadius = gl.getUniformLocation(shaderProgram, 'u_cleaner_radius');
  gl.uniform1f(uCleanerRadius, cleanerRadius * dpr);

  // Cleaner storage fill uniforms (circle fills with grey for dust, brown for dirt)
  const effectiveCap = getMaxVacuumCapacity();
  const dustRatio = Math.min(1.0, Math.max(0.0, (Values.vacuum.storedDust || 0) / effectiveCap));
  const dirtRatio = Math.min(1.0 - dustRatio, Math.max(0.0, (Values.vacuum.storedDirt || 0) / effectiveCap));
  const isVacuumFullVal = (Values.vacuum.stored >= effectiveCap - 0.0001) ? 1.0 : 0.0;

  const uDustFill = gl.getUniformLocation(shaderProgram, 'u_dust_fill');
  gl.uniform1f(uDustFill, dustRatio);

  const uDirtFill = gl.getUniformLocation(shaderProgram, 'u_dirt_fill');
  gl.uniform1f(uDirtFill, dirtRatio);

  const uCleanerIsFull = gl.getUniformLocation(shaderProgram, 'u_cleaner_is_full');
  gl.uniform1f(uCleanerIsFull, isVacuumFullVal);

  const uNoiseOffset = gl.getUniformLocation(shaderProgram, 'u_noise_offset');
  gl.uniform2f(uNoiseOffset, noiseOffset[0], noiseOffset[1]);

  const uTime = gl.getUniformLocation(shaderProgram, 'u_time');
  gl.uniform1f(uTime, (time - startTime) * 0.001);

  // Texture Unit 0: Dust Texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, maskTexture);
  const uMask = gl.getUniformLocation(shaderProgram, 'u_mask');
  gl.uniform1i(uMask, 0);

  // Texture Unit 1: Dirt Texture
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, dirtTexture);
  const uDirtMask = gl.getUniformLocation(shaderProgram, 'u_dirt_mask');
  gl.uniform1i(uDirtMask, 1);

  // Draw Quad
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// --- 2D Overlay Entity Drawing ---

// Draw Station (Outline & Title only) on overlayCanvas
export function drawStation() {
  if (!stationGeometry.isOpen) return;
  const s = stationGeometry;

  overlayCtx.save();

  // 1. Station Outline (Top, Right, Bottom walls - doorway on left is open to room)
  overlayCtx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
  overlayCtx.lineWidth = 2.5;
  overlayCtx.lineCap = 'round';
  overlayCtx.lineJoin = 'round';
  overlayCtx.shadowColor = '#0284c7';
  overlayCtx.shadowBlur = 8;

  overlayCtx.beginPath();
  overlayCtx.moveTo(s.x, s.y);
  overlayCtx.lineTo(s.x + s.width, s.y);
  overlayCtx.lineTo(s.x + s.width, s.y + s.height);
  overlayCtx.lineTo(s.x, s.y + s.height);
  overlayCtx.stroke();

  // 2. Station Title ("STATION")
  const fontSize = Math.max(12, Math.min(18, s.width * 0.09));
  overlayCtx.font = `700 ${fontSize}px Outfit, sans-serif`;
  overlayCtx.textAlign = 'center';
  overlayCtx.textBaseline = 'bottom';
  overlayCtx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  overlayCtx.shadowBlur = 5;
  overlayCtx.fillStyle = '#38bdf8';
  overlayCtx.fillText('STATION', s.x + s.width * 0.5, s.y - 6);

  overlayCtx.restore();
}

// Draw Default Player Vacuum (B.O.B. Bottom base & Top elevated lid)
export function drawDefaultVacuum() {
  const { cleanerRadius: r, cleanerPos, cleanerAngle } = state;
  const topOffsetRatio = (Values.getVacuumTopVisualOffset)
    ? Values.getVacuumTopVisualOffset()
    : ((Values.vacuum && Values.vacuum.topVisualOffset != null) ? Values.vacuum.topVisualOffset : 0.15);
  const topOffsetY = -r * topOffsetRatio;

  const shouldRotate = (Values.vacuum && Values.vacuum.rotateWithMovement !== false);
  const rotation = shouldRotate ? (cleanerAngle - Math.PI * 0.5) : 0;

  overlayCtx.save();
  overlayCtx.imageSmoothingEnabled = true;
  overlayCtx.imageSmoothingQuality = 'high';

  // 1. Draw Bottom image (Base under which pixels are cleaning)
  if (bobBottomImg.complete && bobBottomImg.naturalWidth > 0) {
    overlayCtx.save();
    overlayCtx.translate(cleanerPos.x, cleanerPos.y);
    overlayCtx.rotate(rotation);
    overlayCtx.drawImage(bobBottomImg, -r, -r, r * 2, r * 2);
    overlayCtx.restore();
  } else {
    overlayCtx.beginPath();
    overlayCtx.arc(cleanerPos.x, cleanerPos.y, r, 0, Math.PI * 2);
    overlayCtx.fillStyle = '#a2a2a2';
    overlayCtx.fill();
  }

  // 2. Draw Top image (Visual lid hovering above base with same orientation)
  overlayCtx.save();
  overlayCtx.translate(cleanerPos.x, cleanerPos.y + topOffsetY);

  // Draw Top Sprite
  overlayCtx.save();
  overlayCtx.rotate(rotation);
  if (bobTopImg.complete && bobTopImg.naturalWidth > 0) {
    overlayCtx.drawImage(bobTopImg, -r, -r, r * 2, r * 2);
  } else {
    overlayCtx.beginPath();
    overlayCtx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
    overlayCtx.fillStyle = '#ffffff';
    overlayCtx.fill();
  }
  overlayCtx.restore();

  // Fill top canister with dust & dirt content
  const effectiveCap = getMaxVacuumCapacity();
  const dustRatio = Math.min(1.0, Math.max(0.0, (Values.vacuum.storedDust || 0) / effectiveCap));
  const dirtRatio = Math.min(1.0 - dustRatio, Math.max(0.0, (Values.vacuum.storedDirt || 0) / effectiveCap));

  if (dustRatio > 0.001 || dirtRatio > 0.001) {
    const canisterH = r * 2;
    const bottomY = r;
    const dustH = canisterH * dustRatio;
    const dirtH = canisterH * dirtRatio;

    overlayCtx.save();
    overlayCtx.beginPath();
    overlayCtx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
    overlayCtx.clip();

    overlayCtx.globalCompositeOperation = 'multiply';

    // 1. Dust fill (grey: #9ca3af)
    if (dustH > 0) {
      overlayCtx.fillStyle = '#9ca3af';
      overlayCtx.fillRect(-r, bottomY - dustH, r * 2, dustH);
    }

    // 2. Dirt fill (brown: #b8624a)
    if (dirtH > 0) {
      overlayCtx.fillStyle = '#b8624a';
      overlayCtx.fillRect(-r, bottomY - dustH - dirtH, r * 2, dirtH);
    }
    overlayCtx.restore();

    // Meniscus highlights at top of dust and dirt
    overlayCtx.save();
    overlayCtx.beginPath();
    overlayCtx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
    overlayCtx.clip();

    if (dirtH > 0) {
      overlayCtx.fillStyle = 'rgba(255, 235, 220, 0.7)';
      overlayCtx.fillRect(-r, bottomY - dustH - dirtH, r * 2, Math.max(1.2, r * 0.04));
    }
    if (dustH > 0) {
      overlayCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      overlayCtx.fillRect(-r, bottomY - dustH, r * 2, Math.max(1.2, r * 0.04));
    }
    overlayCtx.restore();
  }

  overlayCtx.restore();
  overlayCtx.restore();
}

export function drawAutoCleaner(bot, defaultAutoRadius) {
  if (!bot || isNaN(bot.x) || isNaN(bot.y)) return;

  const r = Math.max(6.0, bot.radius || defaultAutoRadius || 12.0);
  const topOffsetRatio = (Values.getAutoVacuumTopVisualOffset)
    ? Values.getAutoVacuumTopVisualOffset()
    : ((Values.autoVacuum && Values.autoVacuum.topVisualOffset != null) ? Values.autoVacuum.topVisualOffset : 0.15);
  const topOffsetY = -r * topOffsetRatio;
  const rotation = (bot.angle != null ? bot.angle : 0) - Math.PI * 0.5;

  overlayCtx.save();
  overlayCtx.imageSmoothingEnabled = true;
  overlayCtx.imageSmoothingQuality = 'high';

  // 1. Draw Bottom image (Base under which pixels are cleaning)
  if (bobBottomImg.complete && bobBottomImg.naturalWidth > 0) {
    overlayCtx.save();
    overlayCtx.translate(bot.x, bot.y);
    overlayCtx.rotate(rotation);
    overlayCtx.drawImage(bobBottomImg, -r, -r, r * 2, r * 2);
    overlayCtx.restore();
  } else {
    overlayCtx.beginPath();
    overlayCtx.arc(bot.x, bot.y, r, 0, Math.PI * 2);
    overlayCtx.fillStyle = '#a2a2a2';
    overlayCtx.fill();
  }

  // Suction indicator ring when clean mode is active (toggled via Right Click)
  if (state.isRightMouseDown) {
    overlayCtx.save();
    overlayCtx.beginPath();
    overlayCtx.arc(state.cleanerPos.x, state.cleanerPos.y, r * 1.08, 0, Math.PI * 2);
    overlayCtx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    overlayCtx.lineWidth = 1.8;
    overlayCtx.setLineDash([4, 4]);
    overlayCtx.lineDashOffset = (performance.now() * 0.015) % 8;
    overlayCtx.stroke();
    overlayCtx.restore();
  }

  // 2. Draw Top image (Visual lid hovering above base with same orientation)
  overlayCtx.save();
  overlayCtx.translate(bot.x, bot.y + topOffsetY);

  // Draw Top Sprite
  overlayCtx.save();
  overlayCtx.rotate(rotation);
  if (bobTopImg.complete && bobTopImg.naturalWidth > 0) {
    overlayCtx.drawImage(bobTopImg, -r, -r, r * 2, r * 2);
  } else {
    overlayCtx.beginPath();
    overlayCtx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
    overlayCtx.fillStyle = '#ffffff';
    overlayCtx.fill();
  }
  overlayCtx.restore();

  // Fill top canister with dust & dirt content (only top part, like main bot)
  const dustRatio = Math.min(1.0, Math.max(0.0, (bot.storedDust || 0) / bot.capacity));
  const dirtRatio = Math.min(1.0 - dustRatio, Math.max(0.0, (bot.storedDirt || 0) / bot.capacity));

  if (dustRatio > 0.001 || dirtRatio > 0.001) {
    const canisterH = r * 2;
    const bottomY = r;
    const dustH = canisterH * dustRatio;
    const dirtH = canisterH * dirtRatio;

    overlayCtx.save();
    overlayCtx.beginPath();
    overlayCtx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
    overlayCtx.clip();

    overlayCtx.globalCompositeOperation = 'multiply';

    // 1. Dust fill (grey: #9ca3af)
    if (dustH > 0) {
      overlayCtx.fillStyle = '#9ca3af';
      overlayCtx.fillRect(-r, bottomY - dustH, r * 2, dustH);
    }

    // 2. Dirt fill (brown: #b8624a)
    if (dirtH > 0) {
      overlayCtx.fillStyle = '#b8624a';
      overlayCtx.fillRect(-r, bottomY - dustH - dirtH, r * 2, dirtH);
    }
    overlayCtx.restore();

    // Meniscus highlights at top of dust and dirt
    overlayCtx.save();
    overlayCtx.beginPath();
    overlayCtx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
    overlayCtx.clip();

    if (dirtH > 0) {
      overlayCtx.fillStyle = 'rgba(255, 235, 220, 0.7)';
      overlayCtx.fillRect(-r, bottomY - dustH - dirtH, r * 2, Math.max(1.0, r * 0.04));
    }
    if (dustH > 0) {
      overlayCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      overlayCtx.fillRect(-r, bottomY - dustH, r * 2, Math.max(1.0, r * 0.04));
    }
    overlayCtx.restore();
  }

  overlayCtx.restore();

  // 3. Label Tag (Status text above elevated top lid)
  overlayCtx.font = '700 10px Outfit, sans-serif';
  overlayCtx.textAlign = 'center';
  overlayCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  overlayCtx.shadowBlur = 4;

  const labelY = bot.y - r * (1.0 + Math.max(0, topOffsetRatio)) - 6;
  if (bot.state === 'returning') {
    overlayCtx.fillStyle = '#f87171';
    overlayCtx.fillText('Full -> Station', bot.x, labelY);
  } else if (bot.state === 'docked') {
    overlayCtx.fillStyle = '#38bdf8';
    overlayCtx.fillText(`Storing (${bot.stored.toFixed(2)}g)`, bot.x, labelY);
  } else if (bot.state === 'leaving') {
    overlayCtx.fillStyle = '#a7f3d0';
    overlayCtx.fillText('To Room...', bot.x, labelY);
  } else if (bot.stored > 0.01) {
    overlayCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    overlayCtx.fillText(`${bot.stored.toFixed(2)}g`, bot.x, labelY);
  }

  overlayCtx.restore();
}

export function drawAutoCleaners(defaultAutoRadius) {
  for (let i = 0; i < state.autoCleaners.length; i++) {
    drawAutoCleaner(state.autoCleaners[i], defaultAutoRadius);
  }
}
