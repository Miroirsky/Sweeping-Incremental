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
  const shopBtn = document.getElementById('shop-btn');
  const shopModal = document.getElementById('shop-modal');
  const shopCloseBtn = document.getElementById('shop-close-btn');
  const shopItemsContainer = document.getElementById('shop-items');
  const shopStoredDust = document.getElementById('shop-stored-dust');

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
    return Values.getUpgradeCost('Speed');
  }

  function getSpeedRatio() {
    return Values.getEffectiveSpeed();
  }

  function getCapacityCost() {
    return Values.getUpgradeCost('CapacityMult');
  }

  function getCapacityMult() {
    const upg = Values.shops.dustShop.CapacityMult;
    return 1.0 + (upg ? (upg.level * upg.effect) : 0);
  }

  function getMaxVacuumCapacity() {
    return Values.getEffectiveCapacity();
  }

  let isSpaceHeld = false;
  let isShopOpen = false;
  let hadPlayedFullAlert = false;

  // Movement State
  let isLeftMouseDown = false;
  let mousePos = { x: width * 0.5, y: height * 0.5 };
  let cleanerPos = { x: width * 0.5, y: height * 0.5 };
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

      vec3 surface = vec3(0.0);

      if (!isInsideRoom) {
        // Outside the room: Dark cozy floor / wall frame surrounding the room
        float distFromRoom = -roomEdgeDist;
        
        // Dark floor base
        vec3 outsideFloor = vec3(0.08, 0.05, 0.03);
        
        // Wooden frame/baseboard trim around the square room
        float trim = smoothstep(14.0, 0.0, distFromRoom);
        vec3 trimColor = vec3(0.22, 0.14, 0.09);
        // Bevel highlight right along the carpet edge
        float bevel = smoothstep(3.0, 0.0, distFromRoom);
        trimColor = mix(trimColor, vec3(0.35, 0.23, 0.15), bevel);
        
        surface = mix(outsideFloor, trimColor, trim);
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
      // 4. CLEANER CIRCLE (Grey for Dust, Brown for Dirt)
      // ==========================================
      float distToCleaner = length(fragCoord - u_cleaner);
      float r = u_cleaner_radius;

      // Antialiased circle edge
      float circleMask = clamp(r - distToCleaner + 0.6, 0.0, 1.0);

      // Soft white visibility halo so circle is easily trackable
      float halo = exp(-distToCleaner / max(3.0, r * 1.6)) * 0.35;
      surface = mix(surface, vec3(1.0, 1.0, 1.0), halo * (1.0 - circleMask));

      // Ambient contact shadow under circle
      float shadowDist = smoothstep(r + 6.0, r, distToCleaner);
      surface = mix(surface, vec3(0.05, 0.02, 0.01), shadowDist * 0.35 * (1.0 - circleMask));

      // Crisp circle with white outer rim and stacked dust/dirt fills inside
      if (circleMask > 0.0) {
        float borderWidth = max(1.8, r * 0.20);
        float rInner = max(1.0, r - borderWidth);

        vec3 circleColor;
        if (distToCleaner >= rInner) {
          // White outer rim (pulsing red when full)
          vec3 rimColor = vec3(1.0, 1.0, 1.0);
          if (u_cleaner_is_full > 0.5) {
            rimColor = mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.35, 0.35), 0.5 + 0.5 * sin(u_time * 8.0));
          }
          circleColor = rimColor;
        } else {
          // Inner canister: fills with grey for dust and brown for dirt!
          float fillY = clamp((fragCoord.y - (u_cleaner.y - rInner)) / (2.0 * rInner), 0.0, 1.0);

          // Storage grey gradient (matches #9ca3af to #6b7280)
          vec3 greyFill = mix(vec3(0.42, 0.45, 0.50), vec3(0.61, 0.64, 0.69), fillY);

          // Storage brown gradient (matches terracotta/clay dirt tone)
          vec3 brownFill = mix(vec3(0.48, 0.22, 0.15), vec3(0.70, 0.38, 0.29), fillY);

          // Empty canister interior (clean off-white background)
          vec3 emptyFill = vec3(0.92, 0.94, 0.96);

          float totalFill = clamp(u_dust_fill + u_dirt_fill, 0.0, 1.0);

          vec3 innerColor = emptyFill;
          if (fillY <= u_dust_fill) {
            innerColor = greyFill;
            // Meniscus highlight at top of dust
            if (abs(fillY - u_dust_fill) < 0.02 && u_dust_fill > 0.02) {
              innerColor = mix(innerColor, vec3(1.0, 1.0, 1.0), 0.7);
            }
          } else if (fillY <= totalFill) {
            innerColor = brownFill;
            // Meniscus highlight at top of dirt
            if (abs(fillY - totalFill) < 0.02 && totalFill > 0.02) {
              innerColor = mix(innerColor, vec3(1.0, 0.9, 0.8), 0.75);
            }
          }

          if (u_cleaner_is_full > 0.5) {
            innerColor = mix(innerColor, vec3(0.92, 0.35, 0.35), 0.3 + 0.2 * sin(u_time * 8.0));
          }

          circleColor = innerColor;
        }

        surface = mix(surface, circleColor, circleMask);
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

  // --- Room Geometry Calculation ---
  function updateRoomGeometry() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Max scale centered square room (fits comfortably on screen and adapts)
    const margin = 20; // 10px on each side
    roomSize = Math.max(80, Math.min(width - margin, height - margin));
    roomX = (width - roomSize) * 0.5;
    roomY = (height - roomSize) * 0.5;

    // Vacuum radius: 1% of the room size (from Values)
    cleanerRadius = Math.max(3.0, roomSize * Values.getSizeRatio());
  }

  // --- WebGL Dust & Dirt Textures Setup ---
  function initTextures() {
    syncGridDimensions();
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

  // Dynamic Shop Item Rendering & Updates
  function initShopUI() {
    if (!shopItemsContainer) return;
    shopItemsContainer.innerHTML = '';

    const keys = Object.keys(Values.shops.dustShop);
    keys.forEach((key) => {
      const upg = Values.shops.dustShop[key];
      const itemEl = document.createElement('div');
      itemEl.className = 'shop-item';
      itemEl.id = `shop-item-${key}`;
      itemEl.innerHTML = `
        <div class="item-info">
          <div class="item-title-row">
            <span class="item-name">${upg.name || key}</span>
            <span class="item-level" id="shop-lvl-${key}">Lvl ${upg.level}</span>
          </div>
          <p class="item-desc" id="shop-desc-${key}">${upg.getDesc ? upg.getDesc(upg) : ''}</p>
          <div class="item-stat-row">
            <span class="stat-current">Current: <strong id="shop-stat-${key}">${upg.getStat ? upg.getStat(upg) : ''}</strong></span>
          </div>
        </div>
        <button class="buy-btn" id="shop-buy-${key}" title="Buy ${upg.name || key}">
          <span class="buy-label">Buy</span>
          <span class="buy-cost" id="shop-cost-${key}">0.50g</span>
        </button>
      `;

      const buyBtn = itemEl.querySelector(`#shop-buy-${key}`);
      buyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        buyUpgrade(key);
      });

      shopItemsContainer.appendChild(itemEl);
    });
  }

  function buyUpgrade(key) {
    const upg = Values.shops.dustShop[key];
    if (!upg) return;
    if (upg.isUnlock && upg.level >= 1) return; // already unlocked (no multiple levels)

    const cost = Values.getUpgradeCost(key);
    // Dust shop strictly uses DUST only - dirt cannot be used to buy upgrades!
    if ((Values.storage.dust || 0) >= cost) {
      Values.storage.dust -= cost;
      Values.shops.dustShop[key].level++;

      // When Dirt upgrade is bought, unlocked once and starts generation up to 100%!
      if (key === 'Dirt') {
        isDirtGenerating = true;
        randomizeDirtNoiseSeed();
        const remainingCap = getMaxScreenDirt() - currentScreenDirtGrams;
        if (remainingCap > 0.5) {
          spawnDirtZoneSeed();
          spawnDirtZoneSeed();
        }
      }

      updateUpgradesAndShopUI();
      updateCapacityAndStorageUI();
      if (window.soundEngine) window.soundEngine.playPurchaseSound();
    }
  }

  // Update Shop & Upgrades UI with dynamic values, text & descriptions
  function updateUpgradesAndShopUI() {
    const keys = Object.keys(Values.shops.dustShop);
    keys.forEach((key) => {
      const upg = Values.shops.dustShop[key];
      const cost = Values.getUpgradeCost(key);
      const isMaxed = upg.isUnlock ? (upg.level >= 1) : false;

      const lvlEl = document.getElementById(`shop-lvl-${key}`);
      if (lvlEl) {
        lvlEl.textContent = upg.isUnlock ? (isMaxed ? 'Unlocked' : 'Locked') : `Lvl ${upg.level}`;
      }

      const descEl = document.getElementById(`shop-desc-${key}`);
      if (descEl && upg.getDesc) descEl.textContent = upg.getDesc(upg);

      const statEl = document.getElementById(`shop-stat-${key}`);
      if (statEl && upg.getStat) statEl.textContent = upg.getStat(upg);

      const costEl = document.getElementById(`shop-cost-${key}`);
      if (costEl) {
        costEl.textContent = isMaxed ? 'OWNED' : `${cost.toFixed(2)}g`;
      }

      const buyBtn = document.getElementById(`shop-buy-${key}`);
      if (buyBtn) {
        const buyLabel = buyBtn.querySelector('.buy-label');
        if (isMaxed) {
          buyBtn.disabled = true;
          buyBtn.classList.add('unlocked-btn');
          if (buyLabel) buyLabel.textContent = 'Unlocked';
        } else {
          // You can't buy in the dust shop with dirt - strictly checks stored dust!
          buyBtn.disabled = ((Values.storage.dust || 0) < cost);
          buyBtn.classList.remove('unlocked-btn');
          if (buyLabel) buyLabel.textContent = 'Buy';
        }
      }
    });

    if (shopStoredDust) {
      shopStoredDust.textContent = `${(Values.storage.dust || 0).toFixed(2)}g`;
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
    if (dirtIndicator) {
      if (currentScreenDirtGrams >= maxDirt - 0.05) {
        dirtIndicator.textContent = `Dirt: ${maxDirt.toFixed(0)} / ${maxDirt.toFixed(0)}g (MAX)`;
      } else if (isDirtGenerating) {
        dirtIndicator.textContent = `Dirt: ${currentScreenDirtGrams.toFixed(1)} / ${maxDirt.toFixed(0)}g (Growing)`;
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

  // Shop Toggle & Upgrades
  function toggleShop() {
    isShopOpen = !isShopOpen;
    if (shopModal) {
      shopModal.classList.toggle('hidden', !isShopOpen);
      if (isShopOpen) {
        updateUpgradesAndShopUI();
      }
    }
  }

  function closeShop() {
    isShopOpen = false;
    if (shopModal) {
      shopModal.classList.add('hidden');
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

  // Spawns a new seed for an organic dirt zone that will grow
  function spawnDirtZoneSeed() {
    const maxDirt = getMaxScreenDirt();
    if (currentScreenDirtGrams >= maxDirt - 0.5) return false;
    const isDirtUnlocked = Values.shops.dustShop.Dirt ? (Values.shops.dustShop.Dirt.level > 0) : false;
    if (!isDirtUnlocked) return false;

    const maxActiveZones = Values.dirt ? Values.dirt.maxActiveZones : 14;
    if (dirtZones.length >= maxActiveZones) return false;

    const vx = ((cleanerPos.x - roomX) / roomSize) * GRID_RES;
    const vy = ((cleanerPos.y - roomY) / roomSize) * GRID_RES;
    const minSafeDistCleaner = (cleanerRadius / roomSize) * GRID_RES + Math.max(6, GRID_RES * 0.08);

    // Pick candidate center away from edges, vacuum, and other zones
    // Uses smoothNoise2D with dirtNoiseSeed to find new organic clustering locations
    const margin = Math.max(4, Math.floor(GRID_RES * 0.12));
    const range = Math.max(8, GRID_RES - margin * 2);
    let bestX = margin + Math.floor(Math.random() * range);
    let bestY = margin + Math.floor(Math.random() * range);
    let bestScore = -999;

    for (let attempts = 0; attempts < 20; attempts++) {
      const cx = margin + Math.floor(Math.random() * range);
      const cy = margin + Math.floor(Math.random() * range);
      const distToVacuum = Math.hypot(cx - vx, cy - vy);
      if (distToVacuum < minSafeDistCleaner) continue;

      let tooClose = false;
      for (let i = 0; i < dirtZones.length; i++) {
        if (Math.hypot(cx - dirtZones[i].x, cy - dirtZones[i].y) < (dirtZones[i].currentRadius + 4)) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Score candidate location using current dirtNoiseSeed
      const noiseScore = smoothNoise2D((cx + dirtNoiseSeed) * 0.08, (cy + dirtNoiseSeed) * 0.08);
      if (noiseScore > bestScore) {
        bestScore = noiseScore;
        bestX = cx;
        bestY = cy;
      }
    }

    if (bestScore === -999) return false;
    const cx = bestX;
    const cy = bestY;

    // Target max radius and grams for this zone scaled to grid resolution
    const scaleFactor = GRID_RES / 100.0;
    const typeRoll = Math.random();
    let maxRadius, maxGrams;
    if (typeRoll < 0.3) {
      maxRadius = (3.5 + Math.random() * 2.5) * scaleFactor;
      maxGrams = 1.5 + Math.random() * 2.5;
    } else if (typeRoll < 0.75) {
      maxRadius = (6.0 + Math.random() * 4.0) * scaleFactor;
      maxGrams = 4.0 + Math.random() * 4.0;
    } else {
      maxRadius = (10.0 + Math.random() * 4.5) * scaleFactor;
      maxGrams = 8.0 + Math.random() * 6.0;
    }

    const growthMin = Values.dirt ? Values.dirt.zoneGrowthRateMin : 0.40;
    const growthMax = Values.dirt ? Values.dirt.zoneGrowthRateMax : 0.75;
    const zoneSeed = Math.random() * 1000 + dirtNoiseSeed;
    const zone = {
      id: Math.random(),
      x: cx,
      y: cy,
      startRadius: 1.5 * scaleFactor,
      currentRadius: 1.5 * scaleFactor,
      maxRadius: maxRadius,
      currentGrams: 0.15,
      maxGrams: maxGrams,
      growthRate: growthMin + Math.random() * (growthMax - growthMin),
      aspect: 0.70 + Math.random() * 0.58, // elongation (egg / bean / oval)
      angle: (Math.random() * Math.PI) + (dirtNoiseSeed % Math.PI),
      wobbleFreq: 2 + Math.floor(Math.random() * 3), // 2, 3, or 4 lobes
      wobbleAmp: 0.12 + Math.random() * 0.16, // organic edge deformation
      phase: (Math.random() * Math.PI * 2) + (dirtNoiseSeed % 6.28),
      seed: zoneSeed,
      isFullyGrown: false
    };

    dirtZones.push(zone);
    return true;
  }

  // Updates and grows active organic dirt zones over time
  // When dirt falls below refill percent threshold, triggers refill and changes noise seed!
  function updateDirtZones(dt, now) {
    const isDirtUnlocked = Values.shops.dustShop.Dirt ? (Values.shops.dustShop.Dirt.level > 0) : false;
    if (!isDirtUnlocked) return;

    const maxDirt = getMaxScreenDirt();
    const refillThreshold = getDirtRefillThreshold();

    // Check generation trigger:
    // If under refill threshold, trigger refill wave and randomize noise seed!
    if (currentScreenDirtGrams < refillThreshold) {
      if (!isDirtGenerating) {
        isDirtGenerating = true;
        randomizeDirtNoiseSeed(); // Seed changes so patches appear at other places when refilling!
      }
    }

    // When dirt reaches cap, stop generating wave and randomize noise seed for next time
    if (currentScreenDirtGrams >= maxDirt - 0.05) {
      if (isDirtGenerating) {
        isDirtGenerating = false;
        randomizeDirtNoiseSeed();
      }
    }

    // 1. Prune dead zones whose cells have been completely vacuumed
    for (let i = dirtZones.length - 1; i >= 0; i--) {
      const z = dirtZones[i];
      let zoneRemainingDirt = 0;
      const checkR = Math.ceil(z.currentRadius + 2);
      const minX = Math.max(0, Math.floor(z.x - checkR));
      const maxX = Math.min(GRID_RES - 1, Math.ceil(z.x + checkR));
      const minY = Math.max(0, Math.floor(z.y - checkR));
      const maxY = Math.min(GRID_RES - 1, Math.ceil(z.y + checkR));

      for (let cy = minY; cy <= maxY; cy++) {
        for (let cx = minX; cx <= maxX; cx++) {
          zoneRemainingDirt += dirtGrid[cy * GRID_RES + cx];
        }
      }

      if (zoneRemainingDirt < 0.02 && z.currentGrams > 0.3) {
        dirtZones.splice(i, 1);
      }
    }

    // If NOT actively generating a wave (i.e. sitting between threshold and 100%), do not generate/grow
    if (!isDirtGenerating) return;

    // 2. Spawn new seeds if room under cap and not enough active zones
    const availableCap = Math.max(0, maxDirt - currentScreenDirtGrams);
    const maxActiveZones = Values.dirt ? Values.dirt.maxActiveZones : 14;
    const spawnInterval = Values.dirt ? Values.dirt.spawnIntervalMs : 2000;
    if (availableCap > 0.5 && dirtZones.length < maxActiveZones) {
      if (now - lastDirtZoneSpawn > spawnInterval || dirtZones.length === 0) {
        lastDirtZoneSpawn = now;
        spawnDirtZoneSeed();
      }
    }

    // 3. Grow active dirt zones up to cap
    if (availableCap <= 0.01) return;

    let totalGramsAdded = 0;
    let anyZoneGrew = false;

    for (let i = 0; i < dirtZones.length; i++) {
      const z = dirtZones[i];
      if (z.isFullyGrown || z.currentGrams >= z.maxGrams) continue;
      if (currentScreenDirtGrams + totalGramsAdded >= maxDirt) break;

      const remainingCapThisZone = Math.max(0, maxDirt - (currentScreenDirtGrams + totalGramsAdded));
      const growAmount = Math.min(z.growthRate * dt, remainingCapThisZone);
      if (growAmount <= 0.0001) continue;

      z.currentGrams += growAmount;
      const growthProgress = Math.min(1.0, z.currentGrams / z.maxGrams);
      z.currentRadius = z.startRadius + (z.maxRadius - z.startRadius) * Math.pow(growthProgress, 0.7);
      if (growthProgress >= 1.0) {
        z.isFullyGrown = true;
      }

      // Stamp / expand zone into dirtGrid
      const cosA = Math.cos(z.angle);
      const sinA = Math.sin(z.angle);
      const boundR = Math.ceil(z.currentRadius * 1.5 + 2);

      const minX = Math.max(0, Math.floor(z.x - boundR));
      const maxX = Math.min(GRID_RES - 1, Math.ceil(z.x + boundR));
      const minY = Math.max(0, Math.floor(z.y - boundR));
      const maxY = Math.min(GRID_RES - 1, Math.ceil(z.y + boundR));

      const dirtPerPx = Values.room.dirtPerPixel;
      const dustPerPx = Values.room.dustPerPixel;

      for (let cy = minY; cy <= maxY; cy++) {
        for (let cx = minX; cx <= maxX; cx++) {
          const dx = cx - z.x;
          const dy = cy - z.y;
          const rx = (dx * cosA - dy * sinA) / z.aspect;
          const ry = (dx * sinA + dy * cosA);
          const d = Math.hypot(rx, ry);

          const theta = Math.atan2(ry, rx);
          const rPerimeter = z.currentRadius * (1.0 + z.wobbleAmp * Math.sin(theta * z.wobbleFreq + z.phase));

          if (d <= rPerimeter) {
            // Check if cell is currently right under the vacuum cleaner circle:
            const cellWorldX = roomX + (cx / GRID_RES) * roomSize;
            const cellWorldY = roomY + (cy / GRID_RES) * roomSize;
            const distToCleaner = Math.hypot(cellWorldX - cleanerPos.x, cellWorldY - cleanerPos.y);
            if (distToCleaner <= cleanerRadius + 2.0) {
              continue; // never spawn dirt right under the vacuum!
            }

            const normDist = d / rPerimeter;
            const density = Math.pow(Math.max(0.0, 1.0 - normDist * normDist), 0.65);
            const targetVal = dirtPerPx * density;

            if (targetVal > dirtGrid[cy * GRID_RES + cx]) {
              const capLeft = Math.max(0, maxDirt - (currentScreenDirtGrams + totalGramsAdded));
              const diff = Math.min(targetVal - dirtGrid[cy * GRID_RES + cx], capLeft);
              if (diff > 0.0001) {
                dirtGrid[cy * GRID_RES + cx] += diff;
                // Dirt pixels contain dust underneath!
                dustGrid[cy * GRID_RES + cx] = dustPerPx;
                totalGramsAdded += diff;
                anyZoneGrew = true;
              }
            }
          }
        }
      }
    }

    if (anyZoneGrew && totalGramsAdded > 0) {
      currentScreenDirtGrams = Math.min(maxDirt, currentScreenDirtGrams + totalGramsAdded);
      dirtTextureNeedsUpdate = true;
      dustTextureNeedsUpdate = true;
      updateCapacityAndStorageUI();

      // Check if this growth step brought dirt to 100%:
      if (currentScreenDirtGrams >= maxDirt - 0.05) {
        if (isDirtGenerating) {
          isDirtGenerating = false;
          randomizeDirtNoiseSeed();
        }
      }
    }
  }

  // --- Particle FX (Dust Motes sucked into vacuum) ---
  function spawnDustParticles(x, y, count = 1, isDirt = false) {
    const maxDustMotes = (Values.particles && Values.particles.maxDustMotes) || 80;
    if (particles.length >= maxDustMotes) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spawnDist = cleanerRadius + 4 + Math.random() * 10;
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

    // Indicator tag directly above vacuum if full
    const maxCapacity = getMaxVacuumCapacity();
    const isFull = (Values.vacuum.stored >= maxCapacity - 0.0001);
    if (isFull) {
      overlayCtx.save();
      overlayCtx.font = '700 11px Outfit, sans-serif';
      overlayCtx.textAlign = 'center';
      overlayCtx.fillStyle = 'rgba(239, 68, 68, 0.95)';
      overlayCtx.fillText('FULL (Hold Space)', cleanerPos.x, cleanerPos.y - cleanerRadius - 8);
      overlayCtx.restore();
    }

    // Indicator if storing dust (transfer active)
    const isStoringActive = isSpaceHeld && (Values.vacuum.stored > 0.0001);
    if (isStoringActive) {
      overlayCtx.save();
      overlayCtx.font = '700 11px Outfit, sans-serif';
      overlayCtx.textAlign = 'center';
      overlayCtx.fillStyle = 'rgba(74, 222, 128, 0.95)';
      overlayCtx.fillText('STORING (Locked)...', cleanerPos.x, cleanerPos.y - cleanerRadius - 8);
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
  }

  // --- Resize Handling ---
  function onResize() {
    updateRoomGeometry();

    glCanvas.width = width * dpr;
    glCanvas.height = height * dpr;
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);

    overlayCanvas.width = width;
    overlayCanvas.height = height;
  }

  // --- Reset Game ---
  function resetGame() {
    noiseOffset = [Math.random() * 100.0, Math.random() * 100.0];
    reachedMilestones.clear();
    particles.length = 0;
    transferParticles.length = 0;
    splashParticles.length = 0;
    dirtZones = [];
    currentScreenDirtGrams = 0.0;
    isDirtGenerating = false;
    randomizeDirtNoiseSeed();

    initTextures();

    Values.vacuum.stored = 0.0;
    Values.vacuum.storedDust = 0.0;
    Values.vacuum.storedDirt = 0.0;
    Values.storage.dust = 0.0;
    Values.storage.dirt = 0.0;

    Object.keys(Values.shops.dustShop).forEach((k) => {
      Values.shops.dustShop[k].level = 0;
    });

    isSpaceHeld = false;
    hadPlayedFullAlert = false;

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

    // Vacuum moves ONLY when left click is held down AND NOT storing:
    // "make that you cant move while storing"
    if (!isStoringActive && isLeftMouseDown) {
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

        // Keep vacuum bounded strictly inside the square room
        cleanerPos.x = Math.max(roomX + cleanerRadius, Math.min(roomX + roomSize - cleanerRadius, cleanerPos.x));
        cleanerPos.y = Math.max(roomY + cleanerRadius, Math.min(roomY + roomSize - cleanerRadius, cleanerPos.y));

        // Convert cleaner position to 100x100 grid coords
        const gx = ((cleanerPos.x - roomX) / roomSize) * GRID_RES;
        const gy = ((cleanerPos.y - roomY) / roomSize) * GRID_RES;
        const gr = (cleanerRadius / roomSize) * GRID_RES;
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
              if (currentScreenDirtGrams < getDirtRefillThreshold()) {
                if (!isDirtGenerating) {
                  isDirtGenerating = true;
                  randomizeDirtNoiseSeed();
                }
              }
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
          // Sweeping over already-clean carpet or stationary: hum
          if (window.soundEngine) {
            window.soundEngine.updateMovement(0.2);
          }
        }
      } else {
        if (window.soundEngine) {
          window.soundEngine.updateMovement(0);
        }
      }
    } else {
      if (window.soundEngine) {
        window.soundEngine.updateMovement(0);
      }
    }

    // Dust reappearance: time after being cleaned, dust refills smoothly back to dustPerPixel (never under vacuum)
    const DUST_REAPPEAR_DELAY = Values.room.dustReappearDelay || 10000;
    const DUST_FADE_SEC = (Values.room.dustFadeDuration || 1200) * 0.001;
    const dustPerPx = Values.room.dustPerPixel;
    const DUST_REGAIN_RATE = dustPerPx / DUST_FADE_SEC;
    let dustReappeared = false;

    for (let i = 0; i < TOTAL_PIXELS; i++) {
      if (lastCleanedTime[i] > 0 && now - lastCleanedTime[i] >= DUST_REAPPEAR_DELAY) {
        if (dustGrid[i] < dustPerPx) {
          dustGrid[i] = Math.min(dustPerPx, dustGrid[i] + DUST_REGAIN_RATE * dt);
          dustReappeared = true;
        }
      }
    }
    if (dustReappeared) {
      dustTextureNeedsUpdate = true;
    }

    // Always keep current position protected from dust reappearance so dust NEVER reappears under vacuum
    const cgx = ((cleanerPos.x - roomX) / roomSize) * GRID_RES;
    const cgy = ((cleanerPos.y - roomY) / roomSize) * GRID_RES;
    const cgr = Math.max((cleanerRadius / roomSize) * GRID_RES, 0.75);
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

    // Overlay Canvas Draw (Leash & Particles)
    updateAndDrawParticles();
  }

  // --- Input Event Listeners ---
  function onMouseDown(e) {
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
    if (e.touches.length > 0) {
      isLeftMouseDown = true;
      mousePos.x = e.touches[0].clientX;
      mousePos.y = e.touches[0].clientY;

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
    } else if (e.key === 'b' || e.key === 'B') {
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

  // Shop Button & Upgrades Listeners
  if (shopBtn) {
    shopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleShop();
    });
  }

  if (shopCloseBtn) {
    shopCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeShop();
    });
  }

  // Click outside shop modal to close
  window.addEventListener('click', (e) => {
    if (isShopOpen && shopModal && !shopModal.contains(e.target) && !shopBtn.contains(e.target)) {
      closeShop();
    }
  });

  // Sound Button
  soundBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.soundEngine) {
      window.soundEngine.resume();
      const unmuted = window.soundEngine.toggleMute();
      soundIcon.textContent = unmuted ? '🔊' : '🔇';
      soundBtn.title = unmuted ? 'Mute Sound (M)' : 'Unmute Sound (M)';
    }
  });

  // --- Bootstrap Game ---
  function init() {
    updateRoomGeometry();
    if (!initWebGL()) return;
    initTextures();
    initShopUI();
    onResize();

    // Start vacuum in center of room
    cleanerPos.x = width * 0.5;
    cleanerPos.y = height * 0.5;
    prevCleanerPos.x = cleanerPos.x;
    prevCleanerPos.y = cleanerPos.y;
    mousePos.x = width * 0.5;
    mousePos.y = height * 0.5;

    calculateCleanedPercentage();
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
