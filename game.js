/**
 * Sweeping Incremental - Main Game Controller & WebGL Engine
 * - Centered square room at max scale (adapts to screen)
 * - Full room contains 1 Kg (1000g) of dust
 * - Vacuum size: 1% of the screen (0.01 * roomSize)
 * - Vacuum collects dust ONLY by cleaning uncleaned/reappeared dust
 * - Vacuum movement is frozen while storing dust
 * - Upgrades in Square Dust Shop (0px radius):
 *    • Speed (+0.1% screen/s, cost: 0.5g * 1.5^lvl)
 *    • Capacity Mult (+0.1x to vacuum space, cost: 0.5g * 1.5^lvl)
 * - Vacuum Capacity: base 0.5g * capacityMult (when full, moves without removing dust)
 * - Hold Space to store dust at 0.1g/s into 10g Storage
 * - Dust reappears 10s after being cleaned (never under the vacuum)
 */

(function() {
  'use strict';

  // --- DOM Elements ---
  const glCanvas = document.getElementById('glcanvas');
  const overlayCanvas = document.getElementById('overlay-canvas');
  const overlayCtx = overlayCanvas.getContext('2d');
  const dustIndicator = document.getElementById('dust-indicator');
  const dirtBadge = document.getElementById('dirt-badge');
  const dirtIndicator = document.getElementById('dirt-indicator');
  const robotStorageCard = document.getElementById('robot-storage-card');
  const robotStorageFillDust = document.getElementById('robot-storage-fill-dust');
  const robotStorageFillDirt = document.getElementById('robot-storage-fill-dirt');
  const robotStorageValue = document.getElementById('robot-storage-value');
  const robotDustText = document.getElementById('robot-dust-text');
  const robotDirtText = document.getElementById('robot-dirt-text');
  const storageDustCard = document.getElementById('storage-dust-card');
  const storageDirtCard = document.getElementById('storage-dirt-card');
  const storageDustValue = document.getElementById('storage-dust-value');
  const storageDirtValue = document.getElementById('storage-dirt-value');
  const soundBtn = document.getElementById('sound-btn');
  const soundIcon = document.getElementById('sound-icon');
  const hintOverlay = document.getElementById('hint-overlay');
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');

  // Shop Elements
  const dustShopBtn = document.getElementById('dust-shop-btn') || document.getElementById('shop-btn');
  const dirtShopBtn = document.getElementById('dirt-shop-btn');
  const shopCardsTray = document.getElementById('shop-cards-tray');
  let currentShop = 'dustShop';

  // Default Vacuum Bot Images (B.O.B. Bottom & Top)
  const bobBottomImg = new Image();
  bobBottomImg.src = (Values.vacuum && Values.vacuum.bottomImage) || 'Assets/Icons/B.O.B. Bottom.png';

  const bobTopImg = new Image();
  bobTopImg.src = (Values.vacuum && Values.vacuum.topImage) || 'Assets/Icons/B.O.B. Top.png';

  // --- WebGL Context ---
  let gl = null;
  let shaderProgram = null;
  let maskTexture = null;
  let dirtTexture = null;
  let dustTextureNeedsUpdate = true;
  let dirtTextureNeedsUpdate = true;

  // --- Game State & Room Geometry ---
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Centered Square Room (Max scale adapting to screen)
  let roomSize = 0;
  let roomX = 0;
  let roomY = 0;

  // Station on the right of the room (opens when first auto cleaner is bought)
  const stationGeometry = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    isOpen: false
  };
  Values.stationGeometry = stationGeometry;

  const stationStorage = {
    dust: 0.0,
    dirt: 0.0,
    get stored() { return (this.dust || 0) + (this.dirt || 0); }
  };
  Values.station = stationStorage;

  // Vacuum Specifications: size ratio from Values (1% of room dimension)
  let cleanerRadius = 8.0;

  // Room Dust & Dirt Tracking Grid: resolution & mass values loaded dynamically from Values
  let GRID_RES = Values.room.gridRes;
  let TOTAL_PIXELS = Values.room.totalPixels;

  let dustGrid = new Float32Array(TOTAL_PIXELS);
  let dirtGrid = new Float32Array(TOTAL_PIXELS);
  let dustBytes = new Uint8Array(TOTAL_PIXELS);
  let dirtBytes = new Uint8Array(TOTAL_PIXELS);
  let lastCleanedTime = new Float64Array(TOTAL_PIXELS);

  function syncGridDimensions() {
    GRID_RES = Values.room.gridRes;
    TOTAL_PIXELS = Values.room.totalPixels;
    if (dustGrid.length !== TOTAL_PIXELS) {
      dustGrid = new Float32Array(TOTAL_PIXELS);
      dirtGrid = new Float32Array(TOTAL_PIXELS);
      dustBytes = new Uint8Array(TOTAL_PIXELS);
      dirtBytes = new Uint8Array(TOTAL_PIXELS);
      lastCleanedTime = new Float64Array(TOTAL_PIXELS);
    }
  }

  function getMaxScreenDirt() {
    return Values.getMaxDirt ? Values.getMaxDirt() : Values.room.dirtCapacity;
  }

  function getDirtRefillThreshold() {
    return Values.getDirtRefillThreshold ? Values.getDirtRefillThreshold() : (getMaxScreenDirt() * 0.70);
  }

  let currentScreenDirtGrams = 0.0;
  let currentScreenDustGrams = Values.room.dustCapacity;
  let dirtZones = []; // active organic dirt zones that sprout & grow
  let lastDirtZoneSpawn = performance.now();
  let dirtNoiseSeed = Math.random() * 10000.0;
  let isDirtGenerating = false;

  // Randomizes the Perlin noise seed so dirt patches appear at new locations when refilling
  function randomizeDirtNoiseSeed() {
    noiseOffset[0] = Math.random() * 5000.0;
    noiseOffset[1] = Math.random() * 5000.0;
    dirtNoiseSeed = Math.random() * 10000.0;
  }

  // Upgrades and dynamic state helpers referencing window.Values
  function getSpeedCost() {
    return Values.getUpgradeCost('speed');
  }

  function getSpeedRatio() {
    return Values.getEffectiveSpeed();
  }

  function getCapacityCost() {
    return Values.getUpgradeCost('capacity');
  }

  function getCapacityMult() {
    const upg = Values.shops.dustShop.capacity || Values.shops.dustShop.Capacity;
    return 1.0 + (upg ? (upg.level * upg.effect) : 0);
  }

  function getMaxVacuumCapacity() {
    return Values.getEffectiveCapacity();
  }

  function getEffectiveSuckMultiplier() {
    return Values.getEffectiveSuckMultiplier ? Values.getEffectiveSuckMultiplier() : 1.0;
  }

  function getEffectiveSuckRadius() {
    return cleanerRadius * getEffectiveSuckMultiplier();
  }

  let isSpaceHeld = false;
  let isShopOpen = false;
  let hadPlayedFullAlert = false;

  // Movement State
  let isLeftMouseDown = false;
  let mousePos = { x: width * 0.5, y: height * 0.5 };
  let cleanerPos = { x: width * 0.5, y: height * 0.5 };
  Values.cleanerPos = cleanerPos;
  let cleanerAngle = Math.PI * 0.5; // Default orientation: resting upright
  Values.cleanerAngle = cleanerAngle;
  let prevCleanerPos = { x: width * 0.5, y: height * 0.5 };
  let hasUserMovedMouse = false;
  let lastFrameTime = performance.now();

  // Noise Seed & Time
  let noiseOffset = [Math.random() * 100.0, Math.random() * 100.0];
  let startTime = performance.now();

  // Progress Tracking
  let cleanedPercent = 0;
  let lastSampleTime = 0;
  let reachedMilestones = new Set();
  const MILESTONES = [25, 50, 75, 90, 100];

  // Particle Systems
  const particles = [];
  const MAX_PARTICLES = 80;

  // Transfer particles from bot to top of storage progress
  const transferParticles = [];
  const MAX_TRANSFER_PARTICLES = 90;
  const splashParticles = [];
  const MAX_SPLASH_PARTICLES = 30;

  // --- Shaders ---
  const vertexShaderSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // Fragment Shader: Centered square room, 2 Perlin noise layers, brown carpet, dust erasure, white cleaner
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
    uniform float u_suck_radius;
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
        // Inside Station alcove on the right (Tech Docking Pad Floor)
        vec2 stationUV = (fragCoord - u_station.xy) / u_station.zw;
        vec2 tile = fract(stationUV * vec2(3.0, 6.0));
        float tileBorder = step(0.06, tile.x) * step(0.06, tile.y);
        vec3 stationFloor = mix(vec3(0.11, 0.13, 0.16), vec3(0.18, 0.21, 0.26), tileBorder);

        // Center runway stripe in station
        float centerDistY = abs(stationUV.y - 0.5);
        float runway = smoothstep(0.18, 0.04, centerDistY);
        stationFloor = mix(stationFloor, vec3(0.14, 0.32, 0.38), runway * 0.40);

        // Ambient contact shadow along station perimeter walls
        float sDistX = min(fragCoord.x - u_station.x, (u_station.x + u_station.z) - fragCoord.x);
        float sDistY = min(fragCoord.y - u_station.y, (u_station.y + u_station.w) - fragCoord.y);
        float sDist = min(max(0.0, (u_station.x + u_station.z) - fragCoord.x), sDistY);
        float stationShadow = smoothstep(0.0, 14.0, sDist);
        stationFloor *= (0.75 + 0.25 * stationShadow);

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

        // Reveal carpet underneath dust proportionally to remaining dust:
        // E.g. 50% dust -> 50% transparent dust, revealing 50% carpet!
        surface = mix(carpetColor, dustColor, clamp(dustVal, 0.0, 1.0));

        // ==========================================
        // 3.5. DIRT LAYER (Dirt is directly OVER dust pixels)
        // ==========================================
        float dirtVal = texture2D(u_dirt_mask, maskUV).r; // fraction of dirt: 0.0 to 1.0
        if (dirtVal > 0.001) {
          float dirtNoise = perlin(roomUV * 22.0 + u_noise_offset * 0.3);
          float microTexture = perlin(roomUV * 55.0);

          // Warm terracotta/clay dirt tones matching the reference drawing
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

      // ==========================================
      // 3.9 SUCK ZONE (Black transparent circle behind the bot, overlaying room)
      // ==========================================
      float distToCleaner = length(fragCoord - u_cleaner);
      float r = u_cleaner_radius;
      float rSuck = u_suck_radius;

      if (rSuck > r + 0.1) {
        float suckMask = clamp(rSuck - distToCleaner + 0.6, 0.0, 1.0);
        if (suckMask > 0.0) {
          // Black transparent circle overlaying the room (32% opacity)
          surface = mix(surface, vec3(0.0, 0.0, 0.0), 0.32 * suckMask);

          // Subtle dark outer rim
          float suckRim = smoothstep(1.8, 0.0, abs(distToCleaner - rSuck));
          surface = mix(surface, vec3(0.0, 0.0, 0.0), 0.40 * suckRim);
        }
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

  function initWebGL() {
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

  function isAutoCleanerStationOpen() {
    const upg = Values.shops && Values.shops.dustShop && (Values.shops.dustShop.autoCleaner || Values.shops.dustShop['Auto Cleaner']);
    return upg ? (upg.level >= 1) : false;
  }

  // --- Room Geometry Calculation ---
  function updateRoomGeometry() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    const margin = 20; // Margin around playfield
    const isStationOpen = isAutoCleanerStationOpen();
    stationGeometry.isOpen = isStationOpen;

    // Allocate right-side space for station if open (~16% of roomSize)
    const maxRoomW = isStationOpen ? (width - margin) / 1.18 : (width - margin);
    const maxRoomH = height - margin;
    roomSize = Math.max(80, Math.min(maxRoomW, maxRoomH));

    const stationW = isStationOpen ? Math.max(50, Math.min(130, roomSize * 0.16)) : 0;
    const stationH = isStationOpen ? Math.max(70, Math.min(190, roomSize * 0.35)) : 0;

    const totalPlayfieldW = roomSize + stationW;
    roomX = (width - totalPlayfieldW) * 0.5;
    roomY = (height - roomSize) * 0.5;

    stationGeometry.x = roomX + roomSize;
    stationGeometry.y = roomY + (roomSize - stationH) * 0.5;
    stationGeometry.width = stationW;
    stationGeometry.height = stationH;

    // Vacuum radius: 1% of the room size (from Values)
    cleanerRadius = Math.max(3.0, roomSize * Values.getSizeRatio());
  }

  function clampCleanerToPlayfield(pos, radius) {
    if (!stationGeometry.isOpen) {
      pos.x = Math.max(roomX + radius, Math.min(roomX + roomSize - radius, pos.x));
      pos.y = Math.max(roomY + radius, Math.min(roomY + roomSize - radius, pos.y));
      return;
    }

    const s = stationGeometry;
    const inStationDoorY = (pos.y >= s.y + radius && pos.y <= s.y + s.height - radius);

    if (inStationDoorY) {
      // In doorway band: can move between room left and station right
      pos.x = Math.max(roomX + radius, Math.min(s.x + s.width - radius, pos.x));
    } else {
      pos.x = Math.max(roomX + radius, Math.min(roomX + roomSize - radius, pos.x));
    }

    if (pos.x > roomX + roomSize - radius * 0.5) {
      // Inside station alcove: Y clamped to station height
      pos.y = Math.max(s.y + radius, Math.min(s.y + s.height - radius, pos.y));
    } else {
      // Inside main room: Y clamped to room height
      pos.y = Math.max(roomY + radius, Math.min(roomY + roomSize - radius, pos.y));
    }
  }

  // --- WebGL Dust & Dirt Textures Setup ---
  function initTextures() {
    syncGridDimensions();
    currentScreenDustGrams = Values.room.dustCapacity;
    const dustPerPx = Values.room.dustPerPixel;
    for (let i = 0; i < TOTAL_PIXELS; i++) {
      dustGrid[i] = dustPerPx;
      dirtGrid[i] = 0.0;
      dustBytes[i] = 255;
      dirtBytes[i] = 0;
      lastCleanedTime[i] = 0;
    }
    updateDustTexture();
    updateDirtTexture();
  }

  function updateDustTexture() {
    if (!gl || !maskTexture) return;
    const dustPerPx = Values.room.dustPerPixel;
    for (let i = 0; i < TOTAL_PIXELS; i++) {
      dustBytes[i] = Math.min(255, Math.max(0, Math.floor((dustGrid[i] / dustPerPx) * 255.99)));
    }
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, GRID_RES, GRID_RES, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, dustBytes);
  }

  function updateDirtTexture() {
    if (!gl || !dirtTexture) return;
    const dirtPerPx = Values.room.dirtPerPixel;
    for (let i = 0; i < TOTAL_PIXELS; i++) {
      dirtBytes[i] = Math.min(255, Math.max(0, Math.floor((dirtGrid[i] / dirtPerPx) * 255.99)));
    }
    gl.bindTexture(gl.TEXTURE_2D, dirtTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, GRID_RES, GRID_RES, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, dirtBytes);
  }

  // Dynamic Cards Shop Rendering & Updates (Dust Shop & Dirt Shop)
  function initShopUI() {
    if (!shopCardsTray) return;
    shopCardsTray.innerHTML = '';

    const shopData = (Values.shops && Values.shops[currentShop]) ? Values.shops[currentShop] : Values.shops.dustShop;
    const isDirtShop = (currentShop === 'dirtShop');
    const currentFunds = isDirtShop ? (Values.storage.dirt || 0) : (Values.storage.dust || 0);

    const keys = Object.keys(shopData);
    keys.forEach((key) => {
      const upg = shopData[key];

      // Only display the card if requirement is satisfied!
      if (Values.isUpgradeVisible && !Values.isUpgradeVisible(upg)) {
        return;
      }

      const cost = Values.getUpgradeCost(key);
      const canAfford = currentFunds >= cost;

      const cardEl = document.createElement('div');
      cardEl.className = `upgrade-card ${canAfford ? 'can-afford' : 'cannot-afford'}`;
      cardEl.id = `card-${key}`;
      cardEl.setAttribute('data-key', key);
      cardEl.setAttribute('data-shop', currentShop);
      cardEl.setAttribute('role', 'button');
      cardEl.setAttribute('tabindex', '0');
      cardEl.setAttribute('title', `Buy ${upg.name || key}`);

      cardEl.innerHTML = `
        <img class="card-img" src="${upg.image || ''}" alt="${upg.name || key}" draggable="false" />
        <div class="card-top-bar">
          <div class="card-top-header">
            <span class="card-lvl-badge" id="card-lvl-${key}">${upg.isUnlock ? (upg.level >= 1 ? 'UNLOCKED' : 'LOCKED') : (upg.maxLevel ? `LVL ${upg.level}/${upg.maxLevel}` : `LVL ${upg.level}`)}</span>
            <span class="card-effect-desc" id="card-effect-${key}">${upg.getEffect ? upg.getEffect(upg) : ''}</span>
          </div>
          <div class="card-effect-row">
            <span class="card-stat-label">Actual:</span>
            <span class="card-stat-val" id="card-stat-${key}">${upg.getStat ? upg.getStat(upg) : ''}</span>
          </div>
        </div>
        <div class="card-price-overlay">
          <span class="card-price-val" id="card-cost-${key}">${cost >= 100 ? cost.toFixed(0) : (cost % 1 === 0 ? cost.toFixed(0) : cost.toFixed(2))}g</span>
        </div>
      `;

      // Prevent bot from moving when interacting with upgrade cards
      cardEl.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        isLeftMouseDown = false;
      });
      cardEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isLeftMouseDown = false;
      });

      // Interactive 3D tilt & follow mouse on hover
      cardEl.addEventListener('pointerenter', () => {
        cardEl.style.transition = 'transform 0.08s ease-out, filter 0.15s ease-out';
      });

      cardEl.addEventListener('pointermove', (e) => {
        const rect = cardEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const percentX = ((x / rect.width) - 0.5) * 2; // -1 (left) to 1 (right)
        const percentY = ((y / rect.height) - 0.5) * 2; // -1 (top) to 1 (bottom)

        // Rotate towards mouse (up to 12 degrees)
        const rotX = (percentY * 12).toFixed(2);
        const rotY = (-percentX * 12).toFixed(2);

        // Move towards mouse (up to 8px) + base hover lift (-10px)
        const moveX = (percentX * 8).toFixed(2);
        const moveY = (percentY * 8 - 10).toFixed(2);

        cardEl.style.transform = `perspective(700px) translate3d(${moveX}px, ${moveY}px, 0) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.05)`;
        cardEl.style.filter = `drop-shadow(${-percentX * 10}px ${16 - percentY * 6}px 24px rgba(0, 0, 0, 0.75))`;
      });

      cardEl.addEventListener('pointerleave', () => {
        cardEl.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2), filter 0.35s ease';
        cardEl.style.transform = '';
        cardEl.style.filter = '';
      });

      cardEl.addEventListener('click', (e) => {
        e.stopPropagation();
        isLeftMouseDown = false;
        buyUpgrade(key, currentShop);
      });

      cardEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          isLeftMouseDown = false;
          buyUpgrade(key, currentShop);
        }
      });

      shopCardsTray.appendChild(cardEl);
    });
  }

  function buyUpgrade(key, shopKey) {
    isLeftMouseDown = false;
    const targetShop = shopKey || currentShop;
    const shopData = (Values.shops && Values.shops[targetShop]) ? Values.shops[targetShop] : (Values.shops.dustShop[key] ? Values.shops.dustShop : Values.shops.dirtShop);
    const upg = shopData ? shopData[key] : null;
    if (!upg) return;
    if (upg.isUnlock && upg.level >= 1) return; // already unlocked
    if (upg.maxLevel && upg.level >= upg.maxLevel) return; // already maxed

    const cost = Values.getUpgradeCost(key);
    const cardEl = document.getElementById(`card-${key}`);
    const isDirtShop = (upg.currency === 'dirt' || targetShop === 'dirtShop');
    const currentFunds = isDirtShop ? (Values.storage.dirt || 0) : (Values.storage.dust || 0);

    if (currentFunds >= cost) {
      if (isDirtShop) {
        Values.storage.dirt -= cost;
      } else {
        Values.storage.dust -= cost;
      }
      upg.level++;

      // When Dirt upgrade is bought, unlocked and generates dirt instantly
      if (key === 'dirt' || key === 'Dirt') {
        generateInstantDirt();
      }

      // Sync active auto-cleaners and open station when autoCleaner upgrade is bought
      updateRoomGeometry();
      syncAutoCleaners();

      updateDirtShopVisibility();
      initShopUI();
      updateUpgradesAndShopUI();
      updateCapacityAndStorageUI();
      if (window.soundEngine) window.soundEngine.playPurchaseSound();

      const updatedCardEl = document.getElementById(`card-${key}`);
      if (updatedCardEl) {
        updatedCardEl.classList.remove('purchased-anim', 'shake-anim');
        void updatedCardEl.offsetWidth; // trigger reflow
        updatedCardEl.classList.add('purchased-anim');
      }
    } else {
      if (cardEl) {
        cardEl.classList.remove('purchased-anim', 'shake-anim');
        void cardEl.offsetWidth;
        cardEl.classList.add('shake-anim');
      }
    }
  }

  // Update Card UI with dynamic level, effect and hover price
  function updateUpgradesAndShopUI() {
    const shopData = (Values.shops && Values.shops[currentShop]) ? Values.shops[currentShop] : Values.shops.dustShop;
    const isDirtShop = (currentShop === 'dirtShop');
    const currentFunds = isDirtShop ? (Values.storage.dirt || 0) : (Values.storage.dust || 0);

    const keys = Object.keys(shopData);
    keys.forEach((key) => {
      const upg = shopData[key];

      // Only display the card if requirement is satisfied!
      if (Values.isUpgradeVisible && !Values.isUpgradeVisible(upg)) {
        return;
      }

      const cost = Values.getUpgradeCost(key);
      const canAfford = currentFunds >= cost;
      const isMaxed = upg.isUnlock ? (upg.level >= 1) : (upg.maxLevel ? (upg.level >= upg.maxLevel) : false);

      const cardEl = document.getElementById(`card-${key}`);
      if (cardEl) {
        cardEl.classList.toggle('is-owned', isMaxed);
        if (isMaxed) {
          cardEl.classList.remove('cannot-afford');
          cardEl.classList.add('can-afford');
        } else {
          cardEl.classList.toggle('can-afford', canAfford);
          cardEl.classList.toggle('cannot-afford', !canAfford);
        }
      }

      const lvlEl = document.getElementById(`card-lvl-${key}`);
      if (lvlEl) {
        lvlEl.textContent = upg.isUnlock ? (isMaxed ? 'UNLOCKED' : 'LOCKED') : (upg.maxLevel ? `LVL ${upg.level}/${upg.maxLevel}` : `LVL ${upg.level}`);
      }

      const effectEl = document.getElementById(`card-effect-${key}`);
      if (effectEl && upg.getEffect) {
        effectEl.textContent = upg.getEffect(upg);
      }

      const statEl = document.getElementById(`card-stat-${key}`);
      if (statEl && upg.getStat) {
        statEl.textContent = upg.getStat(upg);
      }

      const costEl = document.getElementById(`card-cost-${key}`);
      if (costEl) {
        costEl.textContent = isMaxed ? (upg.isUnlock ? 'OWNED' : 'MAX') : `${cost >= 100 ? cost.toFixed(0) : (cost % 1 === 0 ? cost.toFixed(0) : cost.toFixed(2))}g`;
      }
    });

    if (dustShopBtn) {
      dustShopBtn.classList.toggle('active-shop', isShopOpen && currentShop === 'dustShop');
    }
    if (dirtShopBtn) {
      dirtShopBtn.classList.toggle('active-shop', isShopOpen && currentShop === 'dirtShop');
    }
  }

  // Update Robot Storage (Grey for Dust, Brown for Dirt) and Main Storage UI
  function updateCapacityAndStorageUI() {
    const maxCapacity = getMaxVacuumCapacity();
    const storedDust = Values.vacuum.storedDust || 0;
    const storedDirt = Values.vacuum.storedDirt || 0;
    const totalStored = storedDust + storedDirt;
    Values.vacuum.stored = totalStored;

    const isFull = (totalStored >= maxCapacity - 0.0001);

    // Robot Storage (Bottom-Left)
    if (robotStorageCard && robotStorageValue) {
      if (isFull) {
        robotStorageCard.classList.add('full');
        robotStorageValue.textContent = `FULL! (${maxCapacity.toFixed(2)}g)`;
      } else {
        robotStorageCard.classList.remove('full');
        robotStorageValue.textContent = `${totalStored.toFixed(2)} / ${maxCapacity.toFixed(2)}g`;
      }
    }

    if (robotStorageFillDust && robotStorageFillDirt) {
      const dustPct = Math.min(100, (storedDust / maxCapacity) * 100);
      const dirtPct = Math.min(100 - dustPct, (storedDirt / maxCapacity) * 100);

      robotStorageFillDust.style.height = `${dustPct.toFixed(1)}%`;
      robotStorageFillDirt.style.bottom = `${dustPct.toFixed(1)}%`;
      robotStorageFillDirt.style.height = `${dirtPct.toFixed(1)}%`;
    }

    if (robotDustText) robotDustText.textContent = `${storedDust.toFixed(2)}g`;
    if (robotDirtText) robotDirtText.textContent = `${storedDirt.toFixed(2)}g`;

    // Separate Infinite Storage Indicators: Dust & Dirt (Center Right)
    if (storageDustValue) {
      storageDustValue.textContent = `${(Values.storage.dust || 0).toFixed(1)}g`;
    }
    if (storageDirtValue) {
      storageDirtValue.textContent = `${(Values.storage.dirt || 0).toFixed(1)}g`;
    }

    if (storageDustCard) {
      const isDustTransferActive = isSpaceHeld && (storedDust > 0.0001);
      storageDustCard.classList.toggle('receiving', isDustTransferActive);
    }
    if (storageDirtCard) {
      const isDirtTransferActive = isSpaceHeld && (storedDirt > 0.0001);
      storageDirtCard.classList.toggle('receiving', isDirtTransferActive);
    }

    // Dirt on Screen Indicator (Top Right)
    const maxDirt = getMaxScreenDirt();
    const requiredDust = Math.min(Values.room.dustCapacity, maxDirt);
    const isWaitingForDust = isDirtUnlocked() && (currentScreenDirtGrams < getDirtRefillThreshold()) && (currentScreenDustGrams < requiredDust - 0.5);

    if (dirtIndicator) {
      if (currentScreenDirtGrams >= maxDirt - 0.05) {
        dirtIndicator.textContent = `Dirt: ${maxDirt.toFixed(0)} / ${maxDirt.toFixed(0)}g (MAX)`;
      } else if (isWaitingForDust) {
        dirtIndicator.textContent = `Dirt: ${currentScreenDirtGrams.toFixed(1)} / ${maxDirt.toFixed(0)}g (Waiting for dust...)`;
      } else {
        dirtIndicator.textContent = `Dirt: ${currentScreenDirtGrams.toFixed(1)} / ${maxDirt.toFixed(0)}g`;
      }
    }
    if (dirtBadge) {
      dirtBadge.classList.toggle('active', currentScreenDirtGrams > 0.1);
    }

    updateUpgradesAndShopUI();
  }

  // Calculate percentage and grams of cleaned dust within the square room:
  // Directly sums exact remaining grams from dustGrid across all pixels
  function calculateCleanedPercentage() {
    let remainingDustGrams = 0;
    for (let i = 0; i < TOTAL_PIXELS; i++) {
      remainingDustGrams += dustGrid[i];
    }
    currentScreenDustGrams = remainingDustGrams;

    const totalCapacity = Values.room.dustCapacity;
    const gramsCleared = Math.max(0, totalCapacity - remainingDustGrams);
    const pct = Math.min(100, (gramsCleared / totalCapacity) * 100);
    cleanedPercent = pct;

    if (dustIndicator) {
      dustIndicator.textContent = `Dust Cleared: ${gramsCleared.toFixed(1)}g [${pct.toFixed(1)}%]`;
    }

    const milestones = (Values.progress && Values.progress.milestones) ? Values.progress.milestones : MILESTONES;
    // Check milestones
    for (const milestone of milestones) {
      if (pct >= milestone && !reachedMilestones.has(milestone)) {
        reachedMilestones.add(milestone);
        showMilestoneToast(milestone);
        if (window.soundEngine) {
          window.soundEngine.playMilestone();
        }
        break;
      }
    }
  }

  function showMilestoneToast(milestone) {
    if (milestone === 100) {
      toastText.textContent = '🏆 100% Spotless Room! Perfection!';
    } else {
      toastText.textContent = `✨ ${milestone}% of the Room Cleaned!`;
    }
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3200);
  }

  // Dirt Shop visibility helper (only displayed when Dirt is unlocked)
  function updateDirtShopVisibility() {
    if (!dirtShopBtn) return;
    const isUnlocked = isDirtUnlocked();
    dirtShopBtn.classList.toggle('hidden', !isUnlocked);
    dirtShopBtn.style.display = isUnlocked ? 'flex' : 'none';
  }

  // Shop Management & Cards Tray (Supports Dust Shop and Dirt Shop)
  function openShop(shopKey) {
    if (shopKey === 'dirtShop' && !isDirtUnlocked()) {
      return; // Cannot open Dirt Shop until Dirt is unlocked!
    }
    if (shopKey) currentShop = shopKey;
    isShopOpen = true;
    document.body.classList.add('shop-open');
    if (shopCardsTray) {
      shopCardsTray.classList.remove('hidden');
    }
    updateDirtShopVisibility();
    initShopUI();
    updateUpgradesAndShopUI();
  }

  function closeShop() {
    if (!isShopOpen) return;
    isShopOpen = false;
    document.body.classList.remove('shop-open');
    if (shopCardsTray) {
      shopCardsTray.classList.add('hidden');
    }
    updateDirtShopVisibility();
    updateUpgradesAndShopUI();
  }

  function toggleShop(targetShop) {
    isLeftMouseDown = false;
    if (targetShop === 'dirtShop' && !isDirtUnlocked()) {
      return;
    }
    if (targetShop) {
      if (isShopOpen && currentShop === targetShop) {
        closeShop();
      } else {
        openShop(targetShop);
      }
    } else {
      if (isShopOpen) {
        closeShop();
      } else {
        if (currentShop === 'dirtShop' && !isDirtUnlocked()) {
          currentShop = 'dustShop';
        }
        openShop(currentShop);
      }
    }
  }

  // 2D Hash & Smooth Value Noise for procedural dirt patches
  function hash2D(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function smoothNoise2D(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const sx = fx * fx * (3.0 - 2.0 * fx);
    const sy = fy * fy * (3.0 - 2.0 * fy);

    const n00 = hash2D(ix, iy);
    const n10 = hash2D(ix + 1, iy);
    const n01 = hash2D(ix, iy + 1);
    const n11 = hash2D(ix + 1, iy + 1);

    const nx0 = n00 * (1.0 - sx) + n10 * sx;
    const nx1 = n01 * (1.0 - sx) + n11 * sx;
    return nx0 * (1.0 - sy) + nx1 * sy;
  }

  function isDirtUnlocked() {
    const upg = Values.shops.dustShop.dirt || Values.shops.dustShop.Dirt;
    return upg ? (upg.level > 0) : false;
  }

  function pruneDeadDirtZones() {
    for (let i = dirtZones.length - 1; i >= 0; i--) {
      const z = dirtZones[i];
      let zoneRemainingDirt = 0;
      const checkR = Math.ceil(z.maxRadius + 2);
      const minX = Math.max(0, Math.floor(z.x - checkR));
      const maxX = Math.min(GRID_RES - 1, Math.ceil(z.x + checkR));
      const minY = Math.max(0, Math.floor(z.y - checkR));
      const maxY = Math.min(GRID_RES - 1, Math.ceil(z.y + checkR));

      for (let cy = minY; cy <= maxY; cy++) {
        for (let cx = minX; cx <= maxX; cx++) {
          zoneRemainingDirt += dirtGrid[cy * GRID_RES + cx];
        }
      }

      if (zoneRemainingDirt < 0.05) {
        dirtZones.splice(i, 1);
      }
    }
  }

  // Generates organic dirt patches instantly up to max dirt capacity (100g) ONLY where there is dust
  function generateInstantDirt() {
    if (!isDirtUnlocked()) return;

    const maxDirt = getMaxScreenDirt();
    if (currentScreenDirtGrams >= maxDirt - 0.2) return;

    // Check if there is enough dust on the screen:
    // If not enough dust, wait until there is enough!
    const requiredDust = Math.min(Values.room.dustCapacity, maxDirt);
    if (currentScreenDustGrams < requiredDust - 0.5) {
      return; // Not enough dust on the screen yet, wait until dust reappears!
    }

    pruneDeadDirtZones();
    randomizeDirtNoiseSeed();

    const dirtPerPx = Values.room.dirtPerPixel;
    const dustPerPx = Values.room.dustPerPixel;
    const scaleFactor = GRID_RES / 100.0;
    const vx = ((cleanerPos.x - roomX) / roomSize) * GRID_RES;
    const vy = ((cleanerPos.y - roomY) / roomSize) * GRID_RES;
    const suckRadius = getEffectiveSuckRadius();
    const minSafeDistCleaner = (suckRadius / roomSize) * GRID_RES + Math.max(6, GRID_RES * 0.08);
    const margin = Math.max(4, Math.floor(GRID_RES * 0.12));
    const range = Math.max(8, GRID_RES - margin * 2);

    let attempts = 0;
    let anyDirtAdded = false;

    while (currentScreenDirtGrams < maxDirt - 0.2 && attempts < 45) {
      attempts++;

      // Pick candidate center away from edges, vacuum, and other zones, ONLY where dust exists!
      let bestX = -1;
      let bestY = -1;
      let bestScore = -999;

      for (let a = 0; a < 20; a++) {
        const cx = margin + Math.floor(Math.random() * range);
        const cy = margin + Math.floor(Math.random() * range);
        const cIdx = cy * GRID_RES + cx;
        if (dustGrid[cIdx] < dustPerPx * 0.6) continue; // Must be on a dusty pixel!

        const distToVacuum = Math.hypot(cx - vx, cy - vy);
        if (distToVacuum < minSafeDistCleaner) continue;

        let tooClose = false;
        for (let i = 0; i < dirtZones.length; i++) {
          if (Math.hypot(cx - dirtZones[i].x, cy - dirtZones[i].y) < (dirtZones[i].maxRadius * 0.8 + 4)) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        const noiseScore = smoothNoise2D((cx + dirtNoiseSeed) * 0.08, (cy + dirtNoiseSeed) * 0.08);
        if (noiseScore > bestScore) {
          bestScore = noiseScore;
          bestX = cx;
          bestY = cy;
        }
      }

      if (bestScore === -999 || bestX === -1) {
        let found = false;
        for (let a = 0; a < 20; a++) {
          const cx = margin + Math.floor(Math.random() * range);
          const cy = margin + Math.floor(Math.random() * range);
          if (dustGrid[cy * GRID_RES + cx] >= dustPerPx * 0.6 && Math.hypot(cx - vx, cy - vy) >= minSafeDistCleaner) {
            bestX = cx;
            bestY = cy;
            found = true;
            break;
          }
        }
        if (!found) continue;
      }

      // Zone size and mass profile
      const typeRoll = Math.random();
      let maxRadius, maxGrams;
      if (typeRoll < 0.25) {
        maxRadius = (4.0 + Math.random() * 2.5) * scaleFactor;
        maxGrams = 2.0 + Math.random() * 2.5;
      } else if (typeRoll < 0.70) {
        maxRadius = (7.0 + Math.random() * 4.0) * scaleFactor;
        maxGrams = 5.0 + Math.random() * 4.0;
      } else {
        maxRadius = (11.0 + Math.random() * 4.5) * scaleFactor;
        maxGrams = 9.0 + Math.random() * 6.0;
      }

      const zone = {
        id: Math.random(),
        x: bestX,
        y: bestY,
        startRadius: maxRadius,
        currentRadius: maxRadius,
        maxRadius: maxRadius,
        currentGrams: maxGrams,
        maxGrams: maxGrams,
        aspect: 0.70 + Math.random() * 0.58,
        angle: (Math.random() * Math.PI) + (dirtNoiseSeed % Math.PI),
        wobbleFreq: 2 + Math.floor(Math.random() * 3),
        wobbleAmp: 0.12 + Math.random() * 0.16,
        phase: (Math.random() * Math.PI * 2) + (dirtNoiseSeed % 6.28),
        seed: Math.random() * 1000 + dirtNoiseSeed,
        isFullyGrown: true
      };

      const cosA = Math.cos(zone.angle);
      const sinA = Math.sin(zone.angle);
      const maxR = zone.maxRadius * (1.0 + zone.wobbleAmp);
      const maxR2 = maxR * maxR;
      const boundR = Math.ceil(maxR * Math.max(1.0, zone.aspect) + 2);

      const minX = Math.max(0, Math.floor(zone.x - boundR));
      const maxX = Math.min(GRID_RES - 1, Math.ceil(zone.x + boundR));
      const minY = Math.max(0, Math.floor(zone.y - boundR));
      const maxY = Math.min(GRID_RES - 1, Math.ceil(zone.y + boundR));

      let zoneGramsAdded = 0;

      for (let cy = minY; cy <= maxY; cy++) {
        if (currentScreenDirtGrams >= maxDirt) break;
        const dy = cy - zone.y;
        const cellWorldY = roomY + (cy / GRID_RES) * roomSize;
        const dyCleaner = cellWorldY - cleanerPos.y;

        for (let cx = minX; cx <= maxX; cx++) {
          if (currentScreenDirtGrams >= maxDirt) break;
          const cellWorldX = roomX + (cx / GRID_RES) * roomSize;
          const distCleaner = Math.hypot(cellWorldX - cleanerPos.x, dyCleaner);
          if (distCleaner <= suckRadius + 2.0) {
            continue; // never spawn dirt under cleaner nozzle / suck zone
          }

          const dx = cx - zone.x;
          const rx = (dx * cosA - dy * sinA) / zone.aspect;
          const ry = (dx * sinA + dy * cosA);
          const d2 = rx * rx + ry * ry;
          if (d2 > maxR2) continue;

          const d = Math.sqrt(d2);
          const theta = Math.atan2(ry, rx);
          const rPerimeter = zone.maxRadius * (1.0 + zone.wobbleAmp * Math.sin(theta * zone.wobbleFreq + zone.phase));

          if (d <= rPerimeter) {
            const idx = cy * GRID_RES + cx;
            const pixelDust = dustGrid[idx];

            // Make dirt spawn ONLY where there is dust!
            if (pixelDust < dustPerPx * 0.5) {
              continue; // no dust here, cannot spawn dirt!
            }

            const normDist = d / rPerimeter;
            const density = Math.pow(Math.max(0.0, 1.0 - normDist * normDist), 0.65);
            // Dirt amount on this pixel is capped by the dust available on this pixel
            const targetVal = Math.min(dirtPerPx * density, pixelDust);
            const currentVal = dirtGrid[idx];

            if (targetVal > currentVal) {
              const capLeft = Math.max(0, maxDirt - currentScreenDirtGrams);
              const diff = Math.min(targetVal - currentVal, capLeft);
              if (diff > 0.00001) {
                dirtGrid[idx] += diff;
                currentScreenDirtGrams += diff;
                zoneGramsAdded += diff;
                anyDirtAdded = true;
              }
            }
          }
        }
      }

      if (zoneGramsAdded > 0.05) {
        dirtZones.push(zone);
      }
    }

    if (anyDirtAdded) {
      dirtTextureNeedsUpdate = true;
      dustTextureNeedsUpdate = true;
    }
    isDirtGenerating = false;
    updateCapacityAndStorageUI();
  }

  // Refills dirt instantly whenever screen dirt drops below the refill threshold
  function updateDirtZones(dt, now) {
    if (!isDirtUnlocked()) return;

    const refillThreshold = getDirtRefillThreshold();
    if (currentScreenDirtGrams < refillThreshold) {
      generateInstantDirt();
    }
  }

  // --- Particle FX (Dust Motes sucked into vacuum) ---
  function spawnDustParticles(x, y, count = 1, isDirt = false) {
    const maxDustMotes = (Values.particles && Values.particles.maxDustMotes) || 80;
    if (particles.length >= maxDustMotes) return;
    const currentSuckR = getEffectiveSuckRadius();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spawnDist = currentSuckR + 4 + Math.random() * 10;
      particles.push({
        x: x + Math.cos(angle) * spawnDist,
        y: y + Math.sin(angle) * spawnDist,
        size: 1.0 + Math.random() * 1.5,
        alpha: 0.8 + Math.random() * 0.2,
        speed: 0.12 + Math.random() * 0.1,
        color: isDirt
          ? (Math.random() > 0.4 ? 'rgba(184, 98, 74,' : 'rgba(138, 64, 45,')
          : (Math.random() > 0.4 ? 'rgba(220, 220, 225,' : 'rgba(165, 165, 175,')
      });
    }
  }

  // Coordinate of separate storage indicators at center right (Dust or Dirt)
  function getStorageTargetCoord(isDirt = false) {
    const cardId = isDirt ? 'storage-dirt-card' : 'storage-dust-card';
    const card = document.getElementById(cardId) || document.querySelector(isDirt ? '.dirt-storage-card' : '.dust-storage-card');
    if (card) {
      const rect = card.getBoundingClientRect();
      return {
        x: rect.left + rect.width * 0.5,
        y: rect.top + rect.height * 0.5
      };
    }
    return { x: width - 60, y: isDirt ? (height * 0.5 + 40) : (height * 0.5 - 40) };
  }

  // Transfer particles that fly from the bot to separate storage indicators at center right
  function spawnTransferParticles(count = 2, isDirt = false) {
    const target = getStorageTargetCoord(isDirt);
    const maxTransfer = (Values.particles && Values.particles.maxTransferParticles) || 90;
    for (let i = 0; i < count; i++) {
      if (transferParticles.length >= maxTransfer) break;

      const angle = Math.random() * Math.PI * 2;
      const startDist = Math.random() * cleanerRadius * 0.75;
      const startX = cleanerPos.x + Math.cos(angle) * startDist;
      const startY = cleanerPos.y + Math.sin(angle) * startDist;

      const targetX = target.x + (Math.random() - 0.5) * 16;
      const targetY = target.y + (Math.random() - 0.5) * 12;

      const midX = (startX + targetX) * 0.5;
      const dist = Math.hypot(targetX - startX, targetY - startY);
      const arcHeight = Math.min(130, Math.max(35, dist * 0.22));
      const midY = Math.min(startY, targetY) - arcHeight + (Math.random() - 0.5) * 16;

      transferParticles.push({
        x: startX,
        y: startY,
        prevX: startX,
        prevY: startY,
        p0x: startX,
        p0y: startY,
        p1x: midX,
        p1y: midY,
        targetOffsetX: (Math.random() - 0.5) * 16,
        targetOffsetY: (Math.random() - 0.5) * 12,
        t: 0,
        speed: 0.024 + Math.random() * 0.016,
        size: 2.2 + Math.random() * 1.5,
        alpha: 0.95,
        isDirt: isDirt,
        color: isDirt
          ? (Math.random() > 0.35 ? '184, 98, 74' : '140, 68, 48')
          : (Math.random() > 0.35 ? '190, 195, 205' : '225, 230, 240')
      });
    }
  }

  function spawnStorageSplash(x, y, isDirt = false) {
    const maxSplash = (Values.particles && Values.particles.maxSplashParticles) || 30;
    if (splashParticles.length >= maxSplash) return;
    for (let i = 0; i < 2; i++) {
      splashParticles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -0.5 - Math.random() * 1.2,
        alpha: 0.85,
        size: 1.0 + Math.random() * 1.2,
        color: isDirt ? '184, 98, 74' : '220, 225, 235'
      });
    }
  }

  // --- Autonomous Mini Cleaners System ---
  const autoCleaners = [];
  Values.autoCleaners = autoCleaners;
  const floatingTexts = [];
  const autoCleanerParticles = [];

  function getAutoVacuumRadius() {
    const sizeRatio = (Values.getAutoVacuumSizeRatio) ? Values.getAutoVacuumSizeRatio() : 0.01;
    return Math.max(3.0, roomSize * sizeRatio);
  }

  function getAutoVacuumSpeed() {
    const speedVal = (Values.autoVacuum && Values.autoVacuum.speed != null) ? Values.autoVacuum.speed : 0.01;
    const screenDim = Math.min(width, height);
    return screenDim * speedVal;
  }

  function getAutoVacuumCapacity() {
    return (Values.autoVacuum && Values.autoVacuum.capacity != null) ? Values.autoVacuum.capacity : 1.0;
  }

  function getAutoVacuumCleanRate() {
    if (Values.getEffectiveAutoVacuumCleanRate) {
      return Values.getEffectiveAutoVacuumCleanRate();
    }
    return (Values.autoVacuum && Values.autoVacuum.cleanRate != null) ? Values.autoVacuum.cleanRate : 0.1;
  }

  function syncAutoCleaners() {
    const upg = Values.shops.dustShop && (Values.shops.dustShop.autoCleaner || Values.shops.dustShop['Auto Cleaner']);
    const targetCount = upg ? upg.level : 0;
    const radius = getAutoVacuumRadius();
    const capacity = getAutoVacuumCapacity();

    while (autoCleaners.length < targetCount) {
      const spawnMargin = radius + 25;
      const x = roomX + spawnMargin + Math.random() * Math.max(10, roomSize - spawnMargin * 2);
      const y = roomY + spawnMargin + Math.random() * Math.max(10, roomSize - spawnMargin * 2);
      const angle = Math.random() * Math.PI * 2;
      autoCleaners.push({
        id: Math.random(),
        x: x,
        y: y,
        prevX: x,
        prevY: y,
        radius: radius,
        angle: angle,
        turnTimer: 1.5 + Math.random() * 2.0,
        turnSpeed: 0,
        capacity: capacity,
        storedDust: 0.0,
        storedDirt: 0.0,
        stored: 0.0,
        pulseAnim: Math.random() * Math.PI * 2,
        state: 'cleaning', // 'cleaning' | 'returning' | 'docked'
        dockTimer: 0
      });
    }

    while (autoCleaners.length > targetCount) {
      autoCleaners.pop();
    }
  }

  function spawnFloatingText(text, x, y, color = '#4ade80') {
    floatingTexts.push({
      text: text,
      x: x,
      y: y,
      vy: -0.65,
      alpha: 1.0,
      color: color,
      size: 12
    });
  }

  function spawnStationDepositParticles(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 0.6 + Math.random() * 1.8;
      splashParticles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 0.4,
        alpha: 0.9,
        size: 1.5 + Math.random() * 1.5,
        color: '56, 189, 248' // bright cyan docking spark
      });
    }
  }

  function spawnStationPickupParticles(fromX, fromY, toX, toY, isDirt) {
    for (let i = 0; i < 3; i++) {
      const pAngle = Math.random() * Math.PI * 2;
      const pR = Math.random() * 6;
      const startX = fromX + Math.cos(pAngle) * pR;
      const startY = fromY + Math.sin(pAngle) * pR;

      const midX = (startX + toX) * 0.5 + (Math.random() - 0.5) * 16;
      const midY = (startY + toY) * 0.5 - 20 + (Math.random() - 0.5) * 12;

      autoCleanerParticles.push({
        p0x: startX,
        p0y: startY,
        p1x: midX,
        p1y: midY,
        t: 0,
        speed: 0.04 + Math.random() * 0.025,
        size: 2.2 + Math.random() * 1.5,
        alpha: 1.0,
        color: isDirt ? '184, 98, 74' : '220, 225, 235'
      });
    }
  }

  function updateAutoCleanersSimulation(dt, now) {
    if (autoCleaners.length === 0) return;

    const currentRadius = getAutoVacuumRadius();
    const currentSpeed = getAutoVacuumSpeed();
    const currentCap = getAutoVacuumCapacity();
    const currentCleanRate = getAutoVacuumCleanRate();

    const s = stationGeometry;
    const dockX = s.isOpen ? (s.x + s.width * 0.45) : (roomX + roomSize);
    const dockY = s.isOpen ? (s.y + s.height * 0.5) : (roomY + roomSize * 0.5);

    for (let bIdx = 0; bIdx < autoCleaners.length; bIdx++) {
      const bot = autoCleaners[bIdx];
      bot.radius = currentRadius;
      bot.capacity = currentCap;
      bot.pulseAnim = (bot.pulseAnim || 0) + dt * 4.0;

      if (!bot.state) bot.state = 'cleaning';

      // Transition to returning when full
      if (bot.state === 'cleaning' && bot.stored >= bot.capacity - 0.0001 && s.isOpen) {
        bot.state = 'returning';
      }

      // State: Docked at station
      if (bot.state === 'docked') {
        bot.dockTimer = (bot.dockTimer || 0) - dt;
        if (bot.dockTimer <= 0) {
          bot.state = 'cleaning';
          bot.angle = Math.PI + (Math.random() - 0.5) * 0.6; // head left back into room
        }
        continue; // stationary while docked
      }

      // State: Returning to station
      if (bot.state === 'returning' && s.isOpen) {
        let steerTargetX = dockX;
        let steerTargetY = dockY;

        // If still in main room, steer towards the doorway threshold
        if (bot.x < roomX + roomSize - bot.radius * 0.5) {
          steerTargetX = roomX + roomSize + 5;
          steerTargetY = dockY;
        }

        const dx = steerTargetX - bot.x;
        const dy = steerTargetY - bot.y;
        const dist = Math.hypot(dx, dy);

        // Turn towards target
        const desiredAngle = Math.atan2(dy, dx);
        bot.angle = desiredAngle;

        // Move towards target
        const step = Math.min(dist, currentSpeed * dt * 1.3); // slightly brisker return
        bot.x += Math.cos(bot.angle) * step;
        bot.y += Math.sin(bot.angle) * step;

        // Check if arrived at dock
        if (Math.hypot(dockX - bot.x, dockY - bot.y) < Math.max(6.0, bot.radius * 0.5)) {
          bot.state = 'docked';
          bot.dockTimer = 0.65; // brief unload pause

          const depDust = bot.storedDust || 0;
          const depDirt = bot.storedDirt || 0;
          const totalDep = depDust + depDirt;

          stationStorage.dust += depDust;
          stationStorage.dirt += depDirt;

          bot.storedDust = 0;
          bot.storedDirt = 0;
          bot.stored = 0;

          spawnStationDepositParticles(bot.x, bot.y);
          if (window.soundEngine && window.soundEngine.playPickContentSound) {
            window.soundEngine.playPickContentSound();
          }
          if (totalDep > 0.005) {
            spawnFloatingText(`+${totalDep.toFixed(2)}g deposited`, dockX, s.y - 8, '#38bdf8');
          }
        }
        continue;
      }

      // State: Cleaning & Autonomous Wandering
      bot.turnTimer -= dt;
      if (bot.turnTimer <= 0) {
        bot.turnSpeed = (Math.random() - 0.5) * 1.8;
        bot.turnTimer = 1.2 + Math.random() * 2.5;
      }
      bot.angle += bot.turnSpeed * dt;

      bot.prevX = bot.x;
      bot.prevY = bot.y;
      let nextX = bot.x + Math.cos(bot.angle) * currentSpeed * dt;
      let nextY = bot.y + Math.sin(bot.angle) * currentSpeed * dt;

      // Wall bouncing with angle reflection within room boundary
      const minX = roomX + bot.radius;
      const maxX = roomX + roomSize - bot.radius;
      const minY = roomY + bot.radius;
      const maxY = roomY + roomSize - bot.radius;

      if (nextX <= minX) {
        nextX = minX;
        bot.angle = Math.PI - bot.angle + (Math.random() - 0.5) * 0.4;
        bot.turnTimer = 0.8 + Math.random();
      } else if (nextX >= maxX) {
        nextX = maxX;
        bot.angle = Math.PI - bot.angle + (Math.random() - 0.5) * 0.4;
        bot.turnTimer = 0.8 + Math.random();
      }

      if (nextY <= minY) {
        nextY = minY;
        bot.angle = -bot.angle + (Math.random() - 0.5) * 0.4;
        bot.turnTimer = 0.8 + Math.random();
      } else if (nextY >= maxY) {
        nextY = maxY;
        bot.angle = -bot.angle + (Math.random() - 0.5) * 0.4;
        bot.turnTimer = 0.8 + Math.random();
      }

      bot.x = nextX;
      bot.y = nextY;

      // 2. Clean the ground under the robot! (like the default vacuum: pick a little dust on every pixel under it with set cleanRate)
      if (bot.x < roomX + roomSize) {
        const bgx = ((bot.x - roomX) / roomSize) * GRID_RES;
        const bgy = ((bot.y - roomY) / roomSize) * GRID_RES;
        const bgr = Math.max((bot.radius / roomSize) * GRID_RES, 0.75);

        const bMinX = Math.max(0, Math.floor(bgx - bgr));
        const bMaxX = Math.min(GRID_RES - 1, Math.ceil(bgx + bgr));
        const bMinY = Math.max(0, Math.floor(bgy - bgr));
        const bMaxY = Math.min(GRID_RES - 1, Math.ceil(bgy + bgr));

        // 1. Keep pixels under vacuum protected from dust reappearance & collect pixels under vacuum
        const pixelsUnderBot = [];
        for (let cy = bMinY; cy <= bMaxY; cy++) {
          for (let cx = bMinX; cx <= bMaxX; cx++) {
            if (Math.hypot(cx + 0.5 - bgx, cy + 0.5 - bgy) <= bgr) {
              const idx = cy * GRID_RES + cx;
              lastCleanedTime[idx] = now;
              pixelsUnderBot.push(idx);
            }
          }
        }

        // 2. Perform pixel cleaning (clean rate distributed across pixels under bot)
        let botDustGained = 0;
        let botDirtGained = 0;
        let remainingBotCap = Math.max(0, bot.capacity - (bot.stored || 0));

        if (remainingBotCap > 0.00001 && pixelsUnderBot.length > 0) {
          const cleanRatePerPixel = currentCleanRate / pixelsUnderBot.length;
          const maxCleanThisPixel = cleanRatePerPixel * dt;

          for (let i = 0; i < pixelsUnderBot.length; i++) {
            const idx = pixelsUnderBot[i];
            let pixelBudget = Math.min(maxCleanThisPixel, remainingBotCap);

            // DIRT IS OVER DUST: remove dirt first to start getting dust!
            if (dirtGrid[idx] > 0 && pixelBudget > 0) {
              const take = Math.min(dirtGrid[idx], pixelBudget);
              dirtGrid[idx] -= take;
              remainingBotCap -= take;
              pixelBudget -= take;
              botDirtGained += take;
              currentScreenDirtGrams = Math.max(0, currentScreenDirtGrams - take);
              dirtTextureNeedsUpdate = true;
            }

            if (dustGrid[idx] > 0 && pixelBudget > 0) {
              const take = Math.min(dustGrid[idx], pixelBudget);
              dustGrid[idx] -= take;
              remainingBotCap -= take;
              pixelBudget -= take;
              botDustGained += take;
              lastCleanedTime[idx] = now;
              dustTextureNeedsUpdate = true;
            }

            if (remainingBotCap <= 0.00001) break;
          }
        }

        if (botDustGained > 0 || botDirtGained > 0) {
          if (botDustGained > 0) {
            currentScreenDustGrams = Math.max(0, currentScreenDustGrams - botDustGained);
          }
          bot.storedDust = (bot.storedDust || 0) + botDustGained;
          bot.storedDirt = (bot.storedDirt || 0) + botDirtGained;
          bot.stored = bot.storedDust + bot.storedDirt;

          if (bot.stored >= bot.capacity - 0.0001) {
            bot.stored = bot.capacity;
            if (s.isOpen) bot.state = 'returning';
          }

          if (Math.random() < 0.20) {
            spawnDustParticles(bot.x, bot.y, 1, botDirtGained > 0);
          }
        }
      }
    }

    // Sync total stored dust & dirt into Values.autoVacuum
    if (Values.autoVacuum) {
      let totalAutoDust = 0;
      let totalAutoDirt = 0;
      for (let i = 0; i < autoCleaners.length; i++) {
        totalAutoDust += autoCleaners[i].storedDust || 0;
        totalAutoDirt += autoCleaners[i].storedDirt || 0;
      }
      Values.autoVacuum.storedDust = totalAutoDust;
      Values.autoVacuum.storedDirt = totalAutoDirt;
      Values.autoVacuum.stored = totalAutoDust + totalAutoDirt;
    }
  }

  function drawAutoCleaner(bot) {
    const r = Math.max(4.0, bot.radius);
    const topOffsetRatio = (Values.getAutoVacuumTopVisualOffset)
      ? Values.getAutoVacuumTopVisualOffset()
      : ((Values.autoVacuum && Values.autoVacuum.topVisualOffset != null) ? Values.autoVacuum.topVisualOffset : 0.15);
    const topOffsetY = -r * topOffsetRatio;
    const rotation = bot.angle - Math.PI * 0.5;

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

    // 3. Label Tag (Status text above elevated top lid, no red outline)
    overlayCtx.font = '700 10px Outfit, sans-serif';
    overlayCtx.textAlign = 'center';
    overlayCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    overlayCtx.shadowBlur = 4;

    const labelY = bot.y - r * (1.0 + Math.max(0, topOffsetRatio)) - 6;
    if (bot.state === 'returning') {
      overlayCtx.fillStyle = '#f87171';
      overlayCtx.fillText('Full -> Docking', bot.x, labelY);
    } else if (bot.state === 'docked') {
      overlayCtx.fillStyle = '#38bdf8';
      overlayCtx.fillText('Unloading...', bot.x, labelY);
    } else if (bot.stored > 0.01) {
      overlayCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      overlayCtx.fillText(`${bot.stored.toFixed(2)}g`, bot.x, labelY);
    }

    overlayCtx.restore();
  }

  function drawAutoCleaners() {
    for (let i = 0; i < autoCleaners.length; i++) {
      drawAutoCleaner(autoCleaners[i]);
    }
  }

  // Draw Station (Docking Pad, Storage Tank Silo, Labels) on overlayCanvas
  function drawStation() {
    if (!stationGeometry.isOpen) return;
    const s = stationGeometry;

    overlayCtx.save();

    // 1. Station perimeter subtle border
    overlayCtx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    overlayCtx.lineWidth = 1.5;
    overlayCtx.setLineDash([4, 4]);
    overlayCtx.strokeRect(s.x, s.y, s.width, s.height);
    overlayCtx.setLineDash([]);

    // 2. Glowing central docking pad
    const padX = s.x + s.width * 0.42;
    const padY = s.y + s.height * 0.5;
    const padR = Math.max(13, Math.min(26, s.height * 0.28));

    const now = performance.now() * 0.003;
    const pulse = 0.5 + 0.5 * Math.sin(now);

    overlayCtx.beginPath();
    overlayCtx.arc(padX, padY, padR, 0, Math.PI * 2);
    overlayCtx.fillStyle = `rgba(14, 165, 233, ${0.12 + 0.08 * pulse})`;
    overlayCtx.fill();
    overlayCtx.strokeStyle = `rgba(56, 189, 248, ${0.5 + 0.35 * pulse})`;
    overlayCtx.lineWidth = 2.0;
    overlayCtx.stroke();

    // Docking crosshair circle
    overlayCtx.beginPath();
    overlayCtx.arc(padX, padY, padR * 0.5, 0, Math.PI * 2);
    overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    overlayCtx.lineWidth = 1.4;
    overlayCtx.stroke();

    // Floor runway indicator pointing into dock
    overlayCtx.font = '700 11px Outfit, sans-serif';
    overlayCtx.textAlign = 'center';
    overlayCtx.fillStyle = `rgba(56, 189, 248, ${0.35 + 0.25 * pulse})`;
    overlayCtx.fillText('▶▶', s.x + 14, padY + 4);

    // 3. Station Storage Tank / Silo (at right edge of station)
    const tankX = s.x + s.width - 15;
    const tankY = padY;
    const tankW = 12;
    const tankH = Math.min(48, s.height * 0.65);

    // Tank outline & backdrop
    overlayCtx.fillStyle = '#0f172a';
    overlayCtx.fillRect(tankX - tankW * 0.5, tankY - tankH * 0.5, tankW, tankH);
    overlayCtx.strokeStyle = '#38bdf8';
    overlayCtx.lineWidth = 1.5;
    overlayCtx.strokeRect(tankX - tankW * 0.5, tankY - tankH * 0.5, tankW, tankH);

    // Tank fill levels (grey for dust, brown for dirt)
    const storedMass = stationStorage.stored;
    const maxTankDisplay = 10.0;
    const fillRatio = Math.min(1.0, storedMass / maxTankDisplay);
    if (fillRatio > 0.005) {
      const totalFillH = (tankH - 2) * fillRatio;
      const dustRatio = storedMass > 0 ? (stationStorage.dust / storedMass) : 1;
      const dustH = totalFillH * dustRatio;
      const dirtH = totalFillH - dustH;

      const bottomY = tankY + tankH * 0.5 - 1;
      if (dustH > 0) {
        overlayCtx.fillStyle = '#9ca3af';
        overlayCtx.fillRect(tankX - tankW * 0.5 + 1, bottomY - dustH, tankW - 2, dustH);
      }
      if (dirtH > 0) {
        overlayCtx.fillStyle = '#b8624a';
        overlayCtx.fillRect(tankX - tankW * 0.5 + 1, bottomY - dustH - dirtH, tankW - 2, dirtH);
      }
    }

    // 4. Station Labels & Value Tag
    overlayCtx.font = '700 10px Outfit, sans-serif';
    overlayCtx.textAlign = 'center';
    overlayCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    overlayCtx.shadowBlur = 4;

    overlayCtx.fillStyle = '#94a3b8';
    overlayCtx.fillText('STATION', s.x + s.width * 0.5, s.y - 7);

    if (stationStorage.stored > 0.005) {
      overlayCtx.fillStyle = '#4ade80';
      overlayCtx.fillText(`${stationStorage.stored.toFixed(2)}g`, padX, padY - padR - 5);
      overlayCtx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      overlayCtx.fillText('Stand to collect', s.x + s.width * 0.5, s.y + s.height + 12);
    } else {
      overlayCtx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      overlayCtx.fillText('Empty', padX, padY - padR - 5);
    }

    overlayCtx.restore();
  }

  // Draw Default Player Vacuum (B.O.B. Bottom base & Top elevated lid)
  function drawDefaultVacuum() {
    const r = cleanerRadius;
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

    // Fill top canister with dust & dirt content (only the top part, like before!)
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

      // Meniscus highlights at top of dust and dirt (like before)
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

  function updateAndDrawParticles() {
    overlayCtx.clearRect(0, 0, width, height);

    const dx = mousePos.x - cleanerPos.x;
    const dy = mousePos.y - cleanerPos.y;
    const dist = Math.hypot(dx, dy);

    // Draw tether leash when mouse is moved
    if (dist > cleanerRadius * 0.8) {
      overlayCtx.save();
      if (isLeftMouseDown) {
        overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        overlayCtx.lineWidth = 1.6;
        overlayCtx.setLineDash([5, 5]);
      } else {
        overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        overlayCtx.lineWidth = 1.2;
        overlayCtx.setLineDash([4, 6]);
      }
      overlayCtx.beginPath();
      overlayCtx.moveTo(cleanerPos.x, cleanerPos.y);
      overlayCtx.lineTo(mousePos.x, mousePos.y);
      overlayCtx.stroke();

      // Mouse target cursor
      overlayCtx.setLineDash([]);
      overlayCtx.strokeStyle = isLeftMouseDown ? 'rgba(123, 241, 168, 0.85)' : 'rgba(255, 255, 255, 0.4)';
      overlayCtx.beginPath();
      overlayCtx.arc(mousePos.x, mousePos.y, 5, 0, Math.PI * 2);
      overlayCtx.stroke();
      overlayCtx.restore();
    }

    // Draw default vacuum (B.O.B. Bottom base & Top elevated lid)
    drawDefaultVacuum();

    // Indicator tag directly above vacuum if full
    const maxCapacity = getMaxVacuumCapacity();
    const isFull = (Values.vacuum.stored >= maxCapacity - 0.0001);
    const topOffsetRatio = (Values.getVacuumTopVisualOffset)
      ? Values.getVacuumTopVisualOffset()
      : ((Values.vacuum && Values.vacuum.topVisualOffset != null) ? Values.vacuum.topVisualOffset : 0.15);
    const labelY = cleanerPos.y - cleanerRadius * (1.0 + Math.max(0, topOffsetRatio)) - 8;

    if (isFull) {
      overlayCtx.save();
      overlayCtx.font = '700 11px Outfit, sans-serif';
      overlayCtx.textAlign = 'center';
      overlayCtx.fillStyle = 'rgba(239, 68, 68, 0.95)';
      overlayCtx.fillText('FULL (Hold Space)', cleanerPos.x, labelY);
      overlayCtx.restore();
    }

    // Indicator if storing dust or locked while Space is pressed:
    if (isSpaceHeld) {
      overlayCtx.save();
      overlayCtx.font = '700 11px Outfit, sans-serif';
      overlayCtx.textAlign = 'center';
      overlayCtx.fillStyle = 'rgba(74, 222, 128, 0.95)';
      overlayCtx.fillText(Values.vacuum.stored > 0.0001 ? 'STORING (Locked)...' : 'LOCKED (Space held)...', cleanerPos.x, labelY);
      overlayCtx.restore();
    }

    // Update and draw intake dust motes
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += (cleanerPos.x - p.x) * p.speed;
      p.y += (cleanerPos.y - p.y) * p.speed;
      p.alpha -= 0.045;

      const currentDist = Math.hypot(cleanerPos.x - p.x, cleanerPos.y - p.y);
      if (p.alpha <= 0 || currentDist < cleanerRadius * 0.4) {
        particles.splice(i, 1);
        continue;
      }

      overlayCtx.fillStyle = `${p.color} ${p.alpha})`;
      overlayCtx.beginPath();
      overlayCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      overlayCtx.fill();
    }

    // Update and draw storage transfer particles (from bot to separate storage indicators at center right)
    for (let i = transferParticles.length - 1; i >= 0; i--) {
      const p = transferParticles[i];
      p.t += p.speed;
      p.prevX = p.x;
      p.prevY = p.y;

      const currentTarget = getStorageTargetCoord(p.isDirt);
      const destX = currentTarget.x + (p.targetOffsetX || 0);
      const destY = currentTarget.y + (p.targetOffsetY || 0);

      const t = p.t;
      const invT = 1.0 - t;
      p.x = invT * invT * p.p0x + 2.0 * invT * t * p.p1x + t * t * destX;
      p.y = invT * invT * p.p0y + 2.0 * invT * t * p.p1y + t * t * destY;

      if (p.t >= 1.0) {
        spawnStorageSplash(destX, destY, p.isDirt);
        transferParticles.splice(i, 1);
        continue;
      }

      overlayCtx.save();
      overlayCtx.strokeStyle = `rgba(${p.color}, ${p.alpha * 0.55})`;
      overlayCtx.lineWidth = p.size;
      overlayCtx.lineCap = 'round';
      overlayCtx.beginPath();
      overlayCtx.moveTo(p.prevX, p.prevY);
      overlayCtx.lineTo(p.x, p.y);
      overlayCtx.stroke();

      overlayCtx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
      overlayCtx.beginPath();
      overlayCtx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
      overlayCtx.fill();
      overlayCtx.restore();
    }

    // Splash particles at destination
    for (let i = splashParticles.length - 1; i >= 0; i--) {
      const sp = splashParticles[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.alpha -= 0.08;
      if (sp.alpha <= 0) {
        splashParticles.splice(i, 1);
        continue;
      }
      overlayCtx.fillStyle = `rgba(${sp.color || '220, 225, 235'}, ${sp.alpha})`;
      overlayCtx.beginPath();
      overlayCtx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      overlayCtx.fill();
    }

    // Update and draw auto-cleaner transfer particles (from mini bot into player Roomba)
    for (let i = autoCleanerParticles.length - 1; i >= 0; i--) {
      const p = autoCleanerParticles[i];
      p.t += p.speed;
      if (p.t >= 1.0) {
        autoCleanerParticles.splice(i, 1);
        continue;
      }
      const u = 1.0 - p.t;
      const curX = u * u * p.p0x + 2.0 * u * p.t * p.p1x + p.t * p.t * cleanerPos.x;
      const curY = u * u * p.p0y + 2.0 * u * p.t * p.p1y + p.t * p.t * cleanerPos.y;

      overlayCtx.fillStyle = `rgba(${p.color}, ${p.alpha * (1.0 - p.t * 0.3)})`;
      overlayCtx.beginPath();
      overlayCtx.arc(curX, curY, p.size, 0, Math.PI * 2);
      overlayCtx.fill();
    }

    // Draw Station (Docking Pad, Silo Tank, Status)
    drawStation();

    // Draw active autonomous cleaners
    drawAutoCleaners();

    // Update and draw floating feedback texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.018;
      if (ft.alpha <= 0) {
        floatingTexts.splice(i, 1);
        continue;
      }
      overlayCtx.save();
      overlayCtx.font = `700 ${ft.size || 12}px Outfit, sans-serif`;
      overlayCtx.textAlign = 'center';
      overlayCtx.globalAlpha = Math.max(0, ft.alpha);
      overlayCtx.fillStyle = ft.color;
      overlayCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      overlayCtx.shadowBlur = 5;
      overlayCtx.fillText(ft.text, ft.x, ft.y);
      overlayCtx.restore();
    }
  }

  // --- Resize Handling ---
  function onResize() {
    updateRoomGeometry();
    syncAutoCleaners();

    glCanvas.width = width * dpr;
    glCanvas.height = height * dpr;
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);

    overlayCanvas.width = width;
    overlayCanvas.height = height;

    clampCleanerToPlayfield(cleanerPos, cleanerRadius);

    if (autoCleaners) {
      const curRadius = getAutoVacuumRadius();
      for (let i = 0; i < autoCleaners.length; i++) {
        const bot = autoCleaners[i];
        bot.radius = curRadius;
        clampCleanerToPlayfield(bot, bot.radius);
      }
    }
  }

  // --- Reset Game ---
  function resetGame() {
    noiseOffset = [Math.random() * 100.0, Math.random() * 100.0];
    reachedMilestones.clear();
    particles.length = 0;
    transferParticles.length = 0;
    splashParticles.length = 0;
    autoCleaners.length = 0;
    floatingTexts.length = 0;
    autoCleanerParticles.length = 0;
    dirtZones = [];
    currentScreenDirtGrams = 0.0;
    isDirtGenerating = false;
    randomizeDirtNoiseSeed();

    stationStorage.dust = 0.0;
    stationStorage.dirt = 0.0;
    cleanerAngle = Math.PI * 0.5;
    Values.cleanerAngle = cleanerAngle;
    updateRoomGeometry();

    initTextures();

    Values.vacuum.stored = 0.0;
    Values.vacuum.storedDust = 0.0;
    Values.vacuum.storedDirt = 0.0;
    Values.storage.dust = 0.0;
    Values.storage.dirt = 0.0;

    if (Values.autoVacuum) {
      Values.autoVacuum.stored = 0.0;
      Values.autoVacuum.storedDust = 0.0;
      Values.autoVacuum.storedDirt = 0.0;
    }

    if (Values.shops) {
      Object.keys(Values.shops).forEach((sKey) => {
        const s = Values.shops[sKey];
        if (s) {
          Object.keys(s).forEach((k) => {
            s[k].level = 0;
          });
        }
      });
    }

    isSpaceHeld = false;
    hadPlayedFullAlert = false;
    currentShop = 'dustShop';

    updateDirtShopVisibility();
    initShopUI();
    updateUpgradesAndShopUI();
    calculateCleanedPercentage();
    updateCapacityAndStorageUI();

    if (window.soundEngine) {
      window.soundEngine.resume();
    }
  }

  // --- Main Animation Loop ---
  function render(time) {
    requestAnimationFrame(render);

    const now = performance.now();
    const dt = Math.min(0.08, (now - lastFrameTime) * 0.001);
    lastFrameTime = now;

    prevCleanerPos.x = cleanerPos.x;
    prevCleanerPos.y = cleanerPos.y;

    const maxCapacity = getMaxVacuumCapacity();
    const isVacuumFull = (Values.vacuum.stored >= maxCapacity - 0.0001);

    // Storing dust and dirt into their separate Infinite Storages:
    // "you should keep pressing space to store"
    const isStoringActive = isSpaceHeld && (Values.vacuum.stored > 0.0001);
    if (isStoringActive) {
      const storeRate = Values.getEffectiveStoreRate ? Values.getEffectiveStoreRate() : (Values.vacuum.storeRate || 0.1);
      const transferTotal = Math.min(Values.vacuum.stored, storeRate * dt);

      let transferDust = 0;
      let transferDirt = 0;
      if (Values.vacuum.stored > 0.00001) {
        const dustRatio = (Values.vacuum.storedDust || 0) / Values.vacuum.stored;
        transferDust = transferTotal * dustRatio;
        transferDirt = transferTotal * (1.0 - dustRatio);
      } else {
        transferDust = transferTotal;
      }

      Values.vacuum.storedDust = Math.max(0, (Values.vacuum.storedDust || 0) - transferDust);
      Values.vacuum.storedDirt = Math.max(0, (Values.vacuum.storedDirt || 0) - transferDirt);
      Values.vacuum.stored = Values.vacuum.storedDust + Values.vacuum.storedDirt;

      // Stored separately:
      Values.storage.dust = (Values.storage.dust || 0) + transferDust;
      Values.storage.dirt = (Values.storage.dirt || 0) + transferDirt;

      if (Values.vacuum.stored < 0.0001) {
        Values.vacuum.stored = 0.0;
        Values.vacuum.storedDust = 0.0;
        Values.vacuum.storedDirt = 0.0;
        hadPlayedFullAlert = false;
      }

      if (Math.random() < 0.25 && window.soundEngine) {
        window.soundEngine.playStoreBlip();
      }

      // Spawn transfer particles streaming from bot to their separate storage indicators
      if (transferDust > 0.0001) {
        spawnTransferParticles(2, false); // flies to Dust Storage
      }
      if (transferDirt > 0.0001) {
        spawnTransferParticles(2, true);  // flies to Dirt Storage
      }
    }

    // Update and grow organic dirt zones over time
    // "Make dirt not dirt patch but more dirt zones that grow"
    // "dirt is capped at 100g on the screen (when under 100, more dirt appear but never exeed 100g)"
    updateDirtZones(dt, now);

    // Vacuum moves and cleans ONLY when left click is held down AND Space is NOT held:
    // When Space is pressed, player cannot move or clean (prevents clean & insta-store)
    if (!isSpaceHeld && isLeftMouseDown) {
      const dx = mousePos.x - cleanerPos.x;
      const dy = mousePos.y - cleanerPos.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0.01) {
        // Speed: base speed * effective speed multiplier
        const screenDimension = Math.min(width, height);
        const speedPxPerSec = screenDimension * getSpeedRatio();
        const step = Math.min(dist, speedPxPerSec * dt);

        cleanerPos.x += (dx / dist) * step;
        cleanerPos.y += (dy / dist) * step;

        // Keep vacuum bounded strictly inside the room or station alcove
        clampCleanerToPlayfield(cleanerPos, cleanerRadius);

        // Turn towards movement direction
        if (dist > 1.0) {
          const targetAngle = Math.atan2(dy, dx);
          let diff = targetAngle - cleanerAngle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          cleanerAngle += diff * Math.min(1.0, 18.0 * dt);
          Values.cleanerAngle = cleanerAngle;
        }
      }

      // Convert cleaner position to grid coords (cleans under the suck zone whether moving or stationary!)
      if (cleanerPos.x < roomX + roomSize) {
        const suckRadius = getEffectiveSuckRadius();
        const gx = ((cleanerPos.x - roomX) / roomSize) * GRID_RES;
        const gy = ((cleanerPos.y - roomY) / roomSize) * GRID_RES;
        const gr = (suckRadius / roomSize) * GRID_RES;
        const effectiveGr = Math.max(gr, 0.75); // Covers at least the pixel under center

        const minX = Math.max(0, Math.floor(gx - effectiveGr));
        const maxX = Math.min(GRID_RES - 1, Math.ceil(gx + effectiveGr));
        const minY = Math.max(0, Math.floor(gy - effectiveGr));
        const maxY = Math.min(GRID_RES - 1, Math.ceil(gy + effectiveGr));

        // 1. Keep pixels under vacuum protected from dust reappearance & collect pixels under vacuum
        const pixelsUnderBot = [];
        for (let cy = minY; cy <= maxY; cy++) {
          for (let cx = minX; cx <= maxX; cx++) {
            if (Math.hypot(cx + 0.5 - gx, cy + 0.5 - gy) <= effectiveGr) {
              const idx = cy * GRID_RES + cx;
              lastCleanedTime[idx] = now;
              pixelsUnderBot.push(idx);
            }
          }
        }

        // 2. Perform pixel cleaning (clean rate distributed across pixels under bot)
        let dustGained = 0;
        let dirtCleanedGrams = 0;
        let remainingCapacity = Math.max(0, maxCapacity - (Values.vacuum.stored || 0));

        if (!isVacuumFull && remainingCapacity > 0.00001 && pixelsUnderBot.length > 0) {
          const cleanRate = Values.getEffectiveCleanRate ? Values.getEffectiveCleanRate() : 0.1;
          const cleanRatePerPixel = cleanRate / pixelsUnderBot.length;
          const maxCleanThisPixel = cleanRatePerPixel * dt;

          for (let i = 0; i < pixelsUnderBot.length; i++) {
            const idx = pixelsUnderBot[i];
            let pixelBudget = Math.min(maxCleanThisPixel, remainingCapacity);

            // DIRT IS OVER DUST: remove dirt first to start getting dust!
            if (dirtGrid[idx] > 0 && pixelBudget > 0) {
              const take = Math.min(dirtGrid[idx], pixelBudget);
              dirtGrid[idx] -= take;
              remainingCapacity -= take;
              pixelBudget -= take;
              dirtCleanedGrams += take;
              currentScreenDirtGrams = Math.max(0, currentScreenDirtGrams - take);
              dirtTextureNeedsUpdate = true;
            }

            if (dustGrid[idx] > 0 && pixelBudget > 0) {
              // Dirt is removed (0), now cleaner cleans dust from this pixel!
              const take = Math.min(dustGrid[idx], pixelBudget);
              dustGrid[idx] -= take;
              remainingCapacity -= take;
              pixelBudget -= take;
              dustGained += take;
              lastCleanedTime[idx] = now;
              dustTextureNeedsUpdate = true;
            }

            if (remainingCapacity <= 0.00001) break;
          }
        }

        if (dustGained > 0 || dirtCleanedGrams > 0) {
          if (dustGained > 0) {
            currentScreenDustGrams = Math.max(0, currentScreenDustGrams - dustGained);
          }
          Values.vacuum.storedDust = (Values.vacuum.storedDust || 0) + dustGained;
          Values.vacuum.storedDirt = (Values.vacuum.storedDirt || 0) + dirtCleanedGrams;
          Values.vacuum.stored = Values.vacuum.storedDust + Values.vacuum.storedDirt;

          if (Values.vacuum.stored >= maxCapacity - 0.0001) {
            Values.vacuum.stored = maxCapacity;
            if (!hadPlayedFullAlert) {
              hadPlayedFullAlert = true;
              if (window.soundEngine) window.soundEngine.playFullWarning();
            }
          } else {
            hadPlayedFullAlert = false;
          }

          if (dirtCleanedGrams > 0) {
            if (Math.random() < 0.6) spawnDustParticles(cleanerPos.x, cleanerPos.y, 2, true);
            if (window.soundEngine) {
              window.soundEngine.updateMovement(0.85);
              window.soundEngine.playDirtPuff();
            }
          } else if (dustGained > 0) {
            if (Math.random() < 0.45) spawnDustParticles(cleanerPos.x, cleanerPos.y, 1, false);
            if (window.soundEngine) {
              window.soundEngine.updateMovement(0.75);
              window.soundEngine.playDustPuff();
            }
          }
        } else {
          // Sweeping over clean carpet or stationary absorbing: hum
          if (window.soundEngine) {
            window.soundEngine.updateMovement(dist > 0.01 ? 0.2 : 0.15);
          }
        }
      }
    } else {
      if (window.soundEngine) {
        window.soundEngine.updateMovement(0);
      }
    }

    // Station collection: when the player Roomba is in the station alcove, collect stored dust & dirt into player vacuum
    if (stationGeometry.isOpen && stationStorage.stored > 0.0001) {
      const isPlayerInStation = (
        cleanerPos.x >= stationGeometry.x - cleanerRadius * 0.4 &&
        cleanerPos.x <= stationGeometry.x + stationGeometry.width + 5 &&
        cleanerPos.y >= stationGeometry.y - 5 &&
        cleanerPos.y <= stationGeometry.y + stationGeometry.height + 5
      );
      if (isPlayerInStation) {
        const pSpace = Math.max(0, maxCapacity - (Values.vacuum.stored || 0));
        if (pSpace > 0.0001) {
          const tRate = Math.max(6.0, maxCapacity * 2.5); // brisk transfer
          const tAmount = Math.min(stationStorage.stored, pSpace, tRate * dt);
          const r = tAmount / stationStorage.stored;
          const tDust = stationStorage.dust * r;
          const tDirt = stationStorage.dirt * r;

          stationStorage.dust -= tDust;
          stationStorage.dirt -= tDirt;

          Values.vacuum.storedDust = (Values.vacuum.storedDust || 0) + tDust;
          Values.vacuum.storedDirt = (Values.vacuum.storedDirt || 0) + tDirt;
          Values.vacuum.stored = Values.vacuum.storedDust + Values.vacuum.storedDirt;

          updateCapacityAndStorageUI();

          if (Math.random() < 0.6) {
            spawnStationPickupParticles(
              stationGeometry.x + stationGeometry.width * 0.75,
              stationGeometry.y + stationGeometry.height * 0.5,
              cleanerPos.x,
              cleanerPos.y,
              tDirt > tDust
            );
          }
          if (Math.random() < 0.25 && window.soundEngine && window.soundEngine.playPickContentSound) {
            window.soundEngine.playPickContentSound();
          }

          if (Values.vacuum.stored >= maxCapacity - 0.0001) {
            Values.vacuum.stored = maxCapacity;
            if (!hadPlayedFullAlert) {
              hadPlayedFullAlert = true;
              if (window.soundEngine) window.soundEngine.playFullWarning();
            }
          }
        }
      }
    }

    // Dust reappearance: time after being cleaned, dust refills smoothly back to dustPerPixel (never under vacuum)
    const DUST_REAPPEAR_DELAY = Values.room.dustReappearDelay || 10000;
    const DUST_FADE_SEC = (Values.room.dustFadeDuration || 1200) * 0.001;
    const dustPerPx = Values.room.dustPerPixel;
    const DUST_REGAIN_RATE = dustPerPx / DUST_FADE_SEC;
    let dustReappeared = false;
    let dustGainedFromReappearance = 0;

    for (let i = 0; i < TOTAL_PIXELS; i++) {
      if (lastCleanedTime[i] > 0 && now - lastCleanedTime[i] >= DUST_REAPPEAR_DELAY) {
        if (dustGrid[i] < dustPerPx) {
          const step = Math.min(dustPerPx - dustGrid[i], DUST_REGAIN_RATE * dt);
          dustGrid[i] += step;
          dustGainedFromReappearance += step;
          dustReappeared = true;
        }
      }
    }
    if (dustReappeared) {
      currentScreenDustGrams = Math.min(Values.room.dustCapacity, currentScreenDustGrams + dustGainedFromReappearance);
      dustTextureNeedsUpdate = true;
    }

    // Always keep current position protected from dust reappearance so dust NEVER reappears under vacuum suck zone
    const currentSuckRadius = getEffectiveSuckRadius();
    const cgx = ((cleanerPos.x - roomX) / roomSize) * GRID_RES;
    const cgy = ((cleanerPos.y - roomY) / roomSize) * GRID_RES;
    const cgr = Math.max((currentSuckRadius / roomSize) * GRID_RES, 0.75);
    const cminX = Math.max(0, Math.floor(cgx - cgr));
    const cmaxX = Math.min(GRID_RES - 1, Math.ceil(cgx + cgr));
    const cminY = Math.max(0, Math.floor(cgy - cgr));
    const cmaxY = Math.min(GRID_RES - 1, Math.ceil(cgy + cgr));
    for (let cy = cminY; cy <= cmaxY; cy++) {
      for (let cx = cminX; cx <= cmaxX; cx++) {
        if (Math.hypot(cx + 0.5 - cgx, cy + 0.5 - cgy) <= cgr) {
          lastCleanedTime[cy * GRID_RES + cx] = now;
        }
      }
    }

    // Autonomous Mini Cleaners simulation (wandering & vacuuming)
    updateAutoCleanersSimulation(dt, now);

    // Update textures if modified
    if (dustTextureNeedsUpdate) {
      updateDustTexture();
      dustTextureNeedsUpdate = false;
    }
    if (dirtTextureNeedsUpdate) {
      updateDirtTexture();
      dirtTextureNeedsUpdate = false;
    }

    // Update Vacuum Canister and Storage Bar UI
    updateCapacityAndStorageUI();

    // Periodic Cleaned % Calculation (sampled at sampleIntervalMs)
    const sampleInterval = (Values.progress && Values.progress.sampleIntervalMs) || 250;
    if (time - lastSampleTime > sampleInterval) {
      lastSampleTime = time;
      calculateCleanedPercentage();
    }

    // WebGL Draw Call
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

    const uSuckRadius = gl.getUniformLocation(shaderProgram, 'u_suck_radius');
    gl.uniform1f(uSuckRadius, getEffectiveSuckRadius() * dpr);

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

    // Overlay Canvas Draw (Leash & Particles)
    updateAndDrawParticles();
  }

  // --- Input Event Listeners ---
  function onMouseDown(e) {
    // Prevent vacuum movement when clicking buttons, upgrade cards, or UI controls
    if (e.target && e.target.closest('button, .menu-square-btn, .upgrade-card, .shop-cards-tray, .hud-top-right, .robot-storage-sidebar, .storage-center-right, [role="button"]')) {
      isLeftMouseDown = false;
      return;
    }

    if (e.button === 0) { // Left click only
      isLeftMouseDown = true;
      mousePos.x = e.clientX;
      mousePos.y = e.clientY;

      if (!hasUserMovedMouse) {
        hasUserMovedMouse = true;
        hintOverlay.classList.add('fade-out');
      }
      if (window.soundEngine) {
        window.soundEngine.resume();
      }
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) {
      isLeftMouseDown = false;
      if (window.soundEngine) {
        window.soundEngine.updateMovement(0);
      }
    }
  }

  function onMouseMove(e) {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;

    if (!hasUserMovedMouse && isLeftMouseDown) {
      hasUserMovedMouse = true;
      hintOverlay.classList.add('fade-out');
    }
  }

  function onTouchStart(e) {
    if (e.target && e.target.closest('button, .menu-square-btn, .upgrade-card, .shop-cards-tray, .hud-top-right, .robot-storage-sidebar, .storage-center-right, [role="button"]')) {
      isLeftMouseDown = false;
      return;
    }

    if (e.touches.length > 0) {
      const tx = e.touches[0].clientX;
      const ty = e.touches[0].clientY;

      isLeftMouseDown = true;
      mousePos.x = tx;
      mousePos.y = ty;

      if (!hasUserMovedMouse) {
        hasUserMovedMouse = true;
        hintOverlay.classList.add('fade-out');
      }
      if (window.soundEngine) {
        window.soundEngine.resume();
      }
    }
  }

  function onTouchMove(e) {
    if (e.touches.length > 0) {
      mousePos.x = e.touches[0].clientX;
      mousePos.y = e.touches[0].clientY;
    }
  }

  function onTouchEnd() {
    isLeftMouseDown = false;
    if (window.soundEngine) {
      window.soundEngine.updateMovement(0);
    }
  }

  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('blur', () => {
    isLeftMouseDown = false;
    isSpaceHeld = false;
    if (window.soundEngine) window.soundEngine.updateMovement(0);
  });

  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });

  window.addEventListener('resize', onResize);

  // Key Controls:
  // "you should keep pressing space to store"
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (!isSpaceHeld) {
        isSpaceHeld = true;
        if (window.soundEngine) {
          window.soundEngine.resume();
          window.soundEngine.playStoreBlip();
        }
      }
    } else if (e.key === 'e' || e.key === 'E' || e.key === 'b' || e.key === 'B') {
      toggleShop();
    } else if (e.key === 'Escape') {
      closeShop();
    } else if (e.key === 'm' || e.key === 'M') {
      soundBtn.click();
    } else if (e.key === 'r' || e.key === 'R') {
      resetGame();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      isSpaceHeld = false;
    }
  });

  // Shop Buttons Listeners (Dust Shop & Dirt Shop)
  if (dustShopBtn) {
    dustShopBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      isLeftMouseDown = false;
    });
    dustShopBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isLeftMouseDown = false;
    });
    dustShopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isLeftMouseDown = false;
      toggleShop('dustShop');
    });
  }

  if (dirtShopBtn) {
    dirtShopBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      isLeftMouseDown = false;
    });
    dirtShopBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isLeftMouseDown = false;
    });
    dirtShopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isLeftMouseDown = false;
      toggleShop('dirtShop');
    });
  }

  // Sound Button
  soundBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    isLeftMouseDown = false;
  });
  soundBtn.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    isLeftMouseDown = false;
  });
  soundBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isLeftMouseDown = false;
    if (window.soundEngine) {
      window.soundEngine.resume();
      const unmuted = window.soundEngine.toggleMute();
      soundIcon.textContent = unmuted ? '🔊' : '🔇';
      soundBtn.title = unmuted ? 'Mute Sound (M)' : 'Unmute Sound (M)';
    }
  });

  // --- Bootstrap Game ---
  function init() {
    cleanerAngle = Math.PI * 0.5;
    Values.cleanerAngle = cleanerAngle;
    updateRoomGeometry();
    if (!initWebGL()) return;
    initTextures();
    updateDirtShopVisibility();
    initShopUI();
    syncAutoCleaners();
    onResize();

    // Start vacuum in center of room
    cleanerPos.x = width * 0.5;
    cleanerPos.y = height * 0.5;
    prevCleanerPos.x = cleanerPos.x;
    prevCleanerPos.y = cleanerPos.y;
    mousePos.x = width * 0.5;
    mousePos.y = height * 0.5;

    calculateCleanedPercentage();
    if (isDirtUnlocked() && currentScreenDirtGrams < 0.1) {
      generateInstantDirt();
    }
    updateCapacityAndStorageUI();

    lastFrameTime = performance.now();

    // Start render loop
    requestAnimationFrame(render);
  }

  // Launch when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
