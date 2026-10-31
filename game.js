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
  const canisterBadge = document.getElementById('canister-badge');
  const canisterMeterFill = document.getElementById('canister-meter-fill');
  const canisterText = document.getElementById('canister-text');
  const storageFill = document.getElementById('storage-fill');
  const storageValue = document.getElementById('storage-value');
  const storeActionBtn = document.getElementById('store-action-btn');
  const storeStatusText = document.getElementById('store-status-text');
  const soundBtn = document.getElementById('sound-btn');
  const soundIcon = document.getElementById('sound-icon');
  const hintOverlay = document.getElementById('hint-overlay');
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');

  // Shop Elements
  const shopBtn = document.getElementById('shop-btn');
  const shopModal = document.getElementById('shop-modal');
  const shopCloseBtn = document.getElementById('shop-close-btn');
  const speedLevelDisplay = document.getElementById('speed-level');
  const speedCurrentDisplay = document.getElementById('speed-current');
  const speedCostDisplay = document.getElementById('speed-cost');
  const buySpeedBtn = document.getElementById('buy-speed-btn');
  const capacityLevelDisplay = document.getElementById('capacity-level');
  const capacityCurrentDisplay = document.getElementById('capacity-current');
  const capacityCostDisplay = document.getElementById('capacity-cost');
  const buyCapacityBtn = document.getElementById('buy-capacity-btn');
  const shopStoredDust = document.getElementById('shop-stored-dust');

  // --- WebGL Context ---
  let gl = null;
  let shaderProgram = null;
  let maskTexture = null;
  let maskCanvas = null;
  let maskCtx = null;

  // --- Game State & Room Geometry ---
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Centered Square Room (Max scale adapting to screen)
  let roomSize = 0;
  let roomX = 0;
  let roomY = 0;

  // Vacuum Specifications: 1% of the screen (0.01 * roomSize)
  const RADIUS_RATIO = 0.01;
  let cleanerRadius = 8.0;

  // Physical Dust Mass: Full room is 1 Kg (1000g)
  const TOTAL_ROOM_DUST = 1000.0;

  // Room Dust Tracking Grid: 160 x 160 cells (synchronized with dust cleared indicator)
  const GRID_RES = 160;
  const roomGrid = new Float64Array(GRID_RES * GRID_RES); // stores timeCleaned
  const CELL_DUST = TOTAL_ROOM_DUST / (GRID_RES * GRID_RES); // mass of single cell

  // Upgrades State
  let speedLevel = 0;       // Each level adds 0.1% screen/s (+0.001)
  let capacityLevel = 0;    // Each level adds 0.1x to vacuum capacity mult

  function getSpeedCost() {
    return 0.5 * Math.pow(1.5, speedLevel);
  }

  function getSpeedRatio() {
    // Base speed: 1.0% screen/s (0.01). Each level adds +0.1% screen/s (+0.001)
    return 0.01 + speedLevel * 0.001;
  }

  function getCapacityCost() {
    return 0.5 * Math.pow(1.5, capacityLevel);
  }

  function getCapacityMult() {
    // Base mult: 1.0x. Each level adds +0.1x
    return 1.0 + capacityLevel * 0.1;
  }

  function getMaxVacuumCapacity() {
    // Multiplies the vacuum space: base 0.5g * capacityMult
    return 0.5 * getCapacityMult();
  }

  // Vacuum Capacity & Storage Mechanics
  const MAX_STORAGE = 10.0;        // Storage holds max 10.0g
  const STORE_TRANSFER_RATE = 0.1; // 0.1g per second transfer rate

  let vacuumDust = 0.0;
  let storedDust = 0.0;
  let isSpaceHeld = false;
  let isStorePointerDown = false;
  let isShopOpen = false;
  let hadPlayedFullAlert = false;

  // 10-Second Dust Reappearance Trail Engine
  const DUST_REAPPEAR_DELAY = 10000; // 10 seconds in ms
  const FADE_DURATION = 1200; // 1.2s smooth reappearance fade
  let cleanTrail = [];

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

  // Particle System
  const particles = [];
  const MAX_PARTICLES = 80;

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
    uniform vec2 u_cleaner; // gl_FragCoord px
    uniform float u_cleaner_radius;
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
        // 3. ERASURE MASK (Erasing dust to reveal carpet)
        // ==========================================
        vec2 maskUV = vec2(roomUV.x, 1.0 - roomUV.y);
        float maskVal = texture2D(u_mask, maskUV).r;

        // Soft dust edge
        float dustAlpha = 1.0 - smoothstep(0.04, 0.96, maskVal);

        // Reveal carpet underneath dust
        surface = mix(carpetColor, dustColor, dustAlpha);

        // Soft wall ambient occlusion inside perimeter of room
        float wallShadow = smoothstep(0.0, 16.0, roomEdgeDist);
        surface *= (0.76 + 0.24 * wallShadow);
      }

      // ==========================================
      // 4. WHITE CLEANER CIRCLE
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

      // Crisp solid white circle
      if (circleMask > 0.0) {
        surface = mix(surface, vec3(1.0, 1.0, 1.0), circleMask);
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

    // Vacuum radius: 1% of the room size
    cleanerRadius = Math.max(3.0, roomSize * RADIUS_RATIO);
  }

  // --- Offscreen Mask Setup ---
  function initMaskCanvas() {
    maskCanvas = document.createElement('canvas');
    const res = Math.min(1024, Math.max(256, Math.floor(roomSize)));
    maskCanvas.width = res;
    maskCanvas.height = res;
    maskCtx = maskCanvas.getContext('2d');

    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    updateMaskTexture();
  }

  function updateMaskTexture() {
    if (!gl || !maskCanvas) return;
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, maskCanvas);
  }

  // Record cleaned segment with normalized room coords [0..1] and timestamp
  function recordCleanSegment(fromX, fromY, toX, toY, radius, now) {
    const rx1 = (fromX - roomX) / roomSize;
    const ry1 = (fromY - roomY) / roomSize;
    const rx2 = (toX - roomX) / roomSize;
    const ry2 = (toY - roomY) / roomSize;
    const nr = radius / roomSize;

    cleanTrail.push({
      x1: rx1,
      y1: ry1,
      x2: rx2,
      y2: ry2,
      r: nr,
      time: now
    });
  }

  // Render mask: dust reappears 10s after being cleaned, but NOT under the vacuum!
  function renderMask(now) {
    if (!maskCtx || !maskCanvas) return;

    const w = maskCanvas.width;
    const h = maskCanvas.height;

    // 1. Clear to black (dust present)
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, w, h);

    // 2. Prune expired segments (> 10s old)
    const cutoffTime = now - DUST_REAPPEAR_DELAY;
    cleanTrail = cleanTrail.filter(seg => seg.time > cutoffTime);

    // 3. Draw active trail segments with gentle fade near 10s
    for (let i = 0; i < cleanTrail.length; i++) {
      const seg = cleanTrail[i];
      const age = now - seg.time;

      let alpha = 1.0;
      if (age > DUST_REAPPEAR_DELAY - FADE_DURATION) {
        alpha = Math.max(0.0, 1.0 - (age - (DUST_REAPPEAR_DELAY - FADE_DURATION)) / FADE_DURATION);
      }

      const colStr = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
      maskCtx.strokeStyle = colStr;
      maskCtx.fillStyle = colStr;
      maskCtx.lineWidth = seg.r * 2 * w;
      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';

      const mx1 = seg.x1 * w;
      const my1 = seg.y1 * h;
      const mx2 = seg.x2 * w;
      const my2 = seg.y2 * h;
      const mr = seg.r * w;

      maskCtx.beginPath();
      maskCtx.moveTo(mx1, my1);
      maskCtx.lineTo(mx2, my2);
      maskCtx.stroke();

      maskCtx.beginPath();
      maskCtx.arc(mx2, my2, mr, 0, Math.PI * 2);
      maskCtx.fill();
    }

    // 4. CRITICAL: "not under the vacuum"
    // The current vacuum circle is ALWAYS stamped at 100% white opacity
    // so dust can NEVER reappear beneath the vacuum!
    const cx = ((cleanerPos.x - roomX) / roomSize) * w;
    const cy = ((cleanerPos.y - roomY) / roomSize) * h;
    const cr = (cleanerRadius / roomSize) * w;

    maskCtx.fillStyle = '#ffffff';
    maskCtx.beginPath();
    maskCtx.arc(cx, cy, cr, 0, Math.PI * 2);
    maskCtx.fill();

    // 5. Upload mask to WebGL texture
    updateMaskTexture();
  }

  // Update Shop & Upgrades UI
  function updateUpgradesAndShopUI() {
    const speedCost = getSpeedCost();
    const capacityCost = getCapacityCost();
    const speedPct = (getSpeedRatio() * 100).toFixed(1);
    const capMult = getCapacityMult().toFixed(1);
    const maxCap = getMaxVacuumCapacity().toFixed(2);

    if (speedLevelDisplay) speedLevelDisplay.textContent = `Lvl ${speedLevel}`;
    if (speedCurrentDisplay) speedCurrentDisplay.textContent = `${speedPct}% / s`;
    if (speedCostDisplay) speedCostDisplay.textContent = `${speedCost.toFixed(2)}g`;
    if (buySpeedBtn) buySpeedBtn.disabled = (storedDust < speedCost);

    if (capacityLevelDisplay) capacityLevelDisplay.textContent = `Lvl ${capacityLevel}`;
    if (capacityCurrentDisplay) capacityCurrentDisplay.textContent = `${maxCap}g (${capMult}x)`;
    if (capacityCostDisplay) capacityCostDisplay.textContent = `${capacityCost.toFixed(2)}g`;
    if (buyCapacityBtn) buyCapacityBtn.disabled = (storedDust < capacityCost);

    if (shopStoredDust) shopStoredDust.textContent = `${storedDust.toFixed(2)}g`;
  }

  // Update Vacuum Canister and Storage UI
  function updateCapacityAndStorageUI() {
    const maxCapacity = getMaxVacuumCapacity();
    const isFull = (vacuumDust >= maxCapacity - 0.0001);

    if (canisterBadge && canisterText) {
      if (isFull) {
        canisterBadge.classList.add('full');
        canisterText.textContent = `FULL! (${maxCapacity.toFixed(2)}g)`;
      } else {
        canisterBadge.classList.remove('full');
        canisterText.textContent = `${vacuumDust.toFixed(2)} / ${maxCapacity.toFixed(2)}g`;
      }
    }

    if (canisterMeterFill) {
      const capPct = Math.min(100, (vacuumDust / maxCapacity) * 100);
      canisterMeterFill.style.width = `${capPct.toFixed(1)}%`;
    }

    if (storageFill && storageValue) {
      const storagePct = Math.min(100, (storedDust / MAX_STORAGE) * 100);
      storageFill.style.height = `${storagePct.toFixed(1)}%`;
      storageValue.textContent = `${storedDust.toFixed(1)} / ${MAX_STORAGE.toFixed(0)}g`;
    }

    const isStoringActive = (isSpaceHeld || isStorePointerDown) && (vacuumDust > 0.0001) && (storedDust < MAX_STORAGE);
    if (storeActionBtn && storeStatusText) {
      if (isStoringActive) {
        storeActionBtn.classList.add('active');
        storeStatusText.textContent = 'Storing...';
      } else {
        storeActionBtn.classList.remove('active');
        storeStatusText.textContent = isFull ? 'Hold to Store' : 'Store';
      }
    }

    updateUpgradesAndShopUI();
  }

  // Calculate percentage of cleaned dust within the square room:
  // Uses the EXACT SAME roomGrid model as dust collection!
  function calculateCleanedPercentage() {
    let cleanCount = 0;
    const now = performance.now();
    const totalCells = GRID_RES * GRID_RES;

    for (let i = 0; i < totalCells; i++) {
      if (roomGrid[i] > 0 && now - roomGrid[i] < DUST_REAPPEAR_DELAY) {
        cleanCount++;
      }
    }

    const pct = Math.min(100, (cleanCount / totalCells) * 100);
    cleanedPercent = pct;

    // Grams cleared based on full screen = 1Kg (1000g) of dust
    const grams = (cleanCount / totalCells) * TOTAL_ROOM_DUST;
    if (dustIndicator) {
      dustIndicator.textContent = `Dust Cleared: ${grams.toFixed(1)}g [${pct.toFixed(1)}%]`;
    }

    // Check milestones
    for (const milestone of MILESTONES) {
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

  function buySpeedUpgrade() {
    const cost = getSpeedCost();
    if (storedDust >= cost) {
      storedDust -= cost;
      speedLevel++;
      updateUpgradesAndShopUI();
      updateCapacityAndStorageUI();
      if (window.soundEngine) window.soundEngine.playPurchaseSound();
    }
  }

  function buyCapacityUpgrade() {
    const cost = getCapacityCost();
    if (storedDust >= cost) {
      storedDust -= cost;
      capacityLevel++;
      updateUpgradesAndShopUI();
      updateCapacityAndStorageUI();
      if (window.soundEngine) window.soundEngine.playPurchaseSound();
    }
  }

  // --- Particle FX (Dust Motes sucked into vacuum) ---
  function spawnDustParticles(x, y, count = 1) {
    if (particles.length >= MAX_PARTICLES) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spawnDist = cleanerRadius + 4 + Math.random() * 10;
      particles.push({
        x: x + Math.cos(angle) * spawnDist,
        y: y + Math.sin(angle) * spawnDist,
        size: 1.0 + Math.random() * 1.5,
        alpha: 0.8 + Math.random() * 0.2,
        speed: 0.12 + Math.random() * 0.1,
        color: Math.random() > 0.4 ? 'rgba(220, 220, 225,' : 'rgba(165, 165, 175,'
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
    const isFull = (vacuumDust >= maxCapacity - 0.0001);
    if (isFull) {
      overlayCtx.save();
      overlayCtx.font = '700 11px Outfit, sans-serif';
      overlayCtx.textAlign = 'center';
      overlayCtx.fillStyle = 'rgba(239, 68, 68, 0.95)';
      overlayCtx.fillText('FULL (Hold Space)', cleanerPos.x, cleanerPos.y - cleanerRadius - 8);
      overlayCtx.restore();
    }

    // Indicator if storing dust (transfer active)
    const isStoringActive = (isSpaceHeld || isStorePointerDown) && (vacuumDust > 0.0001) && (storedDust < MAX_STORAGE);
    if (isStoringActive) {
      overlayCtx.save();
      overlayCtx.font = '700 11px Outfit, sans-serif';
      overlayCtx.textAlign = 'center';
      overlayCtx.fillStyle = 'rgba(74, 222, 128, 0.95)';
      overlayCtx.fillText('STORING (Locked)...', cleanerPos.x, cleanerPos.y - cleanerRadius - 8);
      overlayCtx.restore();
    }

    // Update and draw particles
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
  }

  // --- Resize Handling ---
  function onResize() {
    updateRoomGeometry();

    glCanvas.width = width * dpr;
    glCanvas.height = height * dpr;
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);

    overlayCanvas.width = width;
    overlayCanvas.height = height;

    const res = Math.min(1024, Math.max(256, Math.floor(roomSize)));
    if (maskCanvas) {
      maskCanvas.width = res;
      maskCanvas.height = res;
      renderMask(performance.now());
    }
  }

  // --- Reset Game ---
  function resetGame() {
    noiseOffset = [Math.random() * 100.0, Math.random() * 100.0];
    reachedMilestones.clear();
    particles.length = 0;
    cleanTrail = [];
    roomGrid.fill(0);
    vacuumDust = 0.0;
    storedDust = 0.0;
    isSpaceHeld = false;
    isStorePointerDown = false;
    hadPlayedFullAlert = false;

    renderMask(performance.now());
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
    const isVacuumFull = (vacuumDust >= maxCapacity - 0.0001);

    // Storing dust into Storage Tank:
    // "you should keep pressing space to store"
    const isStoringActive = (isSpaceHeld || isStorePointerDown) && (vacuumDust > 0.0001) && (storedDust < MAX_STORAGE);
    if (isStoringActive) {
      const transfer = Math.min(vacuumDust, STORE_TRANSFER_RATE * dt);
      const actualTransfer = Math.min(transfer, MAX_STORAGE - storedDust);

      vacuumDust -= actualTransfer;
      storedDust += actualTransfer;

      if (vacuumDust < 0.0001) {
        vacuumDust = 0.0;
        hadPlayedFullAlert = false;
      }

      if (storedDust >= MAX_STORAGE) {
        storedDust = MAX_STORAGE;
      }

      if (Math.random() < 0.25 && window.soundEngine) {
        window.soundEngine.playStoreBlip();
      }
    }

    // Vacuum moves ONLY when left click is held down AND NOT storing:
    // "make that you cant move while storing"
    if (!isStoringActive && isLeftMouseDown) {
      const dx = mousePos.x - cleanerPos.x;
      const dy = mousePos.y - cleanerPos.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0.01) {
        // Speed: (1.0% + speedLevel * 0.1%) of screen dimension per second
        const screenDimension = Math.min(width, height);
        const speedPxPerSec = screenDimension * getSpeedRatio();
        const step = Math.min(dist, speedPxPerSec * dt);

        cleanerPos.x += (dx / dist) * step;
        cleanerPos.y += (dy / dist) * step;

        // Keep vacuum bounded strictly inside the square room
        cleanerPos.x = Math.max(roomX + cleanerRadius, Math.min(roomX + roomSize - cleanerRadius, cleanerPos.x));
        cleanerPos.y = Math.max(roomY + cleanerRadius, Math.min(roomY + roomSize - cleanerRadius, cleanerPos.y));

        const moveDist = Math.hypot(cleanerPos.x - prevCleanerPos.x, cleanerPos.y - prevCleanerPos.y);

        if (moveDist > 0.005) {
          // Check how many cells under the cleaner circle are DUSTY vs ALREADY CLEAN:
          // Uses the same model as the dust cleared indicator!
          const gx = ((cleanerPos.x - roomX) / roomSize) * GRID_RES;
          const gy = ((cleanerPos.y - roomY) / roomSize) * GRID_RES;
          const gr = (cleanerRadius / roomSize) * GRID_RES;

          const minX = Math.max(0, Math.floor(gx - gr));
          const maxX = Math.min(GRID_RES - 1, Math.ceil(gx + gr));
          const minY = Math.max(0, Math.floor(gy - gr));
          const maxY = Math.min(GRID_RES - 1, Math.ceil(gy + gr));

          let dustyCellsCleared = 0;

          for (let cy = minY; cy <= maxY; cy++) {
            for (let cx = minX; cx <= maxX; cx++) {
              const d2 = (cx - gx) * (cx - gx) + (cy - gy) * (cy - gy);
              if (d2 <= gr * gr) {
                const idx = cy * GRID_RES + cx;
                const timeCleaned = roomGrid[idx];
                const isCellDusty = (timeCleaned === 0 || now - timeCleaned >= DUST_REAPPEAR_DELAY);

                if (isCellDusty) {
                  if (!isVacuumFull) {
                    dustyCellsCleared++;
                    roomGrid[idx] = now; // cell becomes clean!
                  }
                } else {
                  // Already clean cell: refresh timeCleaned so it never reappears under the vacuum!
                  roomGrid[idx] = now;
                }
              }
            }
          }

          if (!isVacuumFull) {
            // Record visual clean segment in trail
            recordCleanSegment(prevCleanerPos.x, prevCleanerPos.y, cleanerPos.x, cleanerPos.y, cleanerRadius, now);

            if (dustyCellsCleared > 0) {
              // Gain dust strictly for newly cleared dusty cells!
              const dustGained = dustyCellsCleared * CELL_DUST;
              vacuumDust = Math.min(maxCapacity, vacuumDust + dustGained);

              if (vacuumDust >= maxCapacity - 0.0001) {
                if (!hadPlayedFullAlert) {
                  hadPlayedFullAlert = true;
                  if (window.soundEngine) window.soundEngine.playFullWarning();
                }
              } else {
                hadPlayedFullAlert = false;
              }

              // Subtle dust motes & puff sound ONLY when collecting actual dust
              if (Math.random() < 0.45) {
                spawnDustParticles(cleanerPos.x, cleanerPos.y, 1);
              }

              if (window.soundEngine) {
                window.soundEngine.updateMovement(0.75);
                window.soundEngine.playDustPuff();
              }
            } else {
              // Sweeping over already-clean carpet: ZERO dust collected!
              if (window.soundEngine) {
                window.soundEngine.updateMovement(0.2); // smooth gliding hum
              }
            }
          } else {
            // Vacuum IS full: you still can move but no dust is removed
            if (window.soundEngine) {
              window.soundEngine.updateMovement(0.2); // low motor hum
            }
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

    // Always keep current position clean on grid so dust NEVER reappears under vacuum
    const cgx = ((cleanerPos.x - roomX) / roomSize) * GRID_RES;
    const cgy = ((cleanerPos.y - roomY) / roomSize) * GRID_RES;
    const cgr = (cleanerRadius / roomSize) * GRID_RES;
    const cminX = Math.max(0, Math.floor(cgx - cgr));
    const cmaxX = Math.min(GRID_RES - 1, Math.ceil(cgx + cgr));
    const cminY = Math.max(0, Math.floor(cgy - cgr));
    const cmaxY = Math.min(GRID_RES - 1, Math.ceil(cgy + cgr));
    for (let cy = cminY; cy <= cmaxY; cy++) {
      for (let cx = cminX; cx <= cmaxX; cx++) {
        if ((cx - cgx) * (cx - cgx) + (cy - cgy) * (cy - cgy) <= cgr * cgr) {
          roomGrid[cy * GRID_RES + cx] = now;
        }
      }
    }

    // Render the dynamic mask (draws active trail with 10s expiration + vacuum circle)
    renderMask(now);

    // Update Vacuum Canister and Storage Bar UI
    updateCapacityAndStorageUI();

    // Periodic Cleaned % Calculation (every 250ms)
    if (time - lastSampleTime > 250) {
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

    const uNoiseOffset = gl.getUniformLocation(shaderProgram, 'u_noise_offset');
    gl.uniform2f(uNoiseOffset, noiseOffset[0], noiseOffset[1]);

    const uTime = gl.getUniformLocation(shaderProgram, 'u_time');
    gl.uniform1f(uTime, (time - startTime) * 0.001);

    // Texture Unit 0: Mask
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    const uMask = gl.getUniformLocation(shaderProgram, 'u_mask');
    gl.uniform1i(uMask, 0);

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
    isStorePointerDown = false;
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

  // Hold-to-Store Button Listeners
  if (storeActionBtn) {
    storeActionBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isStorePointerDown = true;
      if (window.soundEngine) {
        window.soundEngine.resume();
        window.soundEngine.playStoreBlip();
      }
    });

    window.addEventListener('mouseup', () => {
      isStorePointerDown = false;
    });

    storeActionBtn.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      isStorePointerDown = true;
      if (window.soundEngine) {
        window.soundEngine.resume();
        window.soundEngine.playStoreBlip();
      }
    }, { passive: true });

    storeActionBtn.addEventListener('touchend', () => {
      isStorePointerDown = false;
    });
  }

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

  if (buySpeedBtn) {
    buySpeedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      buySpeedUpgrade();
    });
  }

  if (buyCapacityBtn) {
    buyCapacityBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      buyCapacityUpgrade();
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
    initMaskCanvas();
    onResize();

    // Start vacuum in center of room
    cleanerPos.x = width * 0.5;
    cleanerPos.y = height * 0.5;
    prevCleanerPos.x = cleanerPos.x;
    prevCleanerPos.y = cleanerPos.y;
    mousePos.x = width * 0.5;
    mousePos.y = height * 0.5;

    renderMask(performance.now());
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
