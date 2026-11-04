/**
 * Sweeping Incremental - Shared Runtime Game State & Room Geometry
 */

import { Values } from './data.js';

export const stationGeometry = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  isOpen: false
};
Values.stationGeometry = stationGeometry;

export function getStationCapacity() {
  if (Values.station && typeof Values.station.capacity === 'number') {
    return Values.station.capacity;
  }
  if (typeof Values.getStationCapacity === 'function') {
    const c = Values.getStationCapacity();
    if (typeof c === 'number' && !isNaN(c)) return c;
  }
  return 50.0;
}

export const stationStorage = {
  get dust() { return Values.station ? (Values.station.dust || 0) : 0; },
  set dust(val) {
    if (Values.station) {
      Values.station.dust = val;
      Values.station.stored = (Values.station.dust || 0) + (Values.station.dirt || 0);
    }
  },
  get dirt() { return Values.station ? (Values.station.dirt || 0) : 0; },
  set dirt(val) {
    if (Values.station) {
      Values.station.dirt = val;
      Values.station.stored = (Values.station.dust || 0) + (Values.station.dirt || 0);
    }
  },
  get capacity() { return getStationCapacity(); },
  get stored() { return (this.dust || 0) + (this.dirt || 0); }
};

const initialGridRes = Values.room.gridRes;
const initialTotalPixels = Values.room.totalPixels;

export const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  dpr: Math.min(window.devicePixelRatio || 1, 2),

  // Centered Square Room (Max scale adapting to screen)
  roomSize: 0,
  roomX: 0,
  roomY: 0,
  cleanerRadius: 8.0,

  // Grid buffers
  GRID_RES: initialGridRes,
  TOTAL_PIXELS: initialTotalPixels,
  dustGrid: new Float32Array(initialTotalPixels),
  dirtGrid: new Float32Array(initialTotalPixels),
  dustBytes: new Uint8Array(initialTotalPixels),
  dirtBytes: new Uint8Array(initialTotalPixels),
  lastCleanedTime: new Float64Array(initialTotalPixels),

  dustTextureNeedsUpdate: true,
  dirtTextureNeedsUpdate: true,

  // Room Dust & Dirt state
  currentScreenDirtGrams: 0.0,
  currentScreenDustGrams: Values.room.dustCapacity,
  dirtZones: [],
  lastDirtZoneSpawn: performance.now(),
  dirtNoiseSeed: Math.random() * 10000.0,
  isDirtGenerating: false,

  // Input & Shop state
  currentShop: 'dustShop',
  isSpaceHeld: false,
  isRightMouseDown: false,
  isLeftMouseDown: false,
  isShopOpen: false,
  hadPlayedFullAlert: false,

  // Movement & Position state
  mousePos: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 },
  cleanerPos: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 },
  prevCleanerPos: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 },
  cleanerAngle: Math.PI * 0.5,
  hasUserMovedMouse: false,
  lastFrameTime: performance.now(),

  // Noise & Timing
  noiseOffset: [Math.random() * 100.0, Math.random() * 100.0],
  startTime: performance.now(),

  // Progress & Milestones
  cleanedPercent: 0,
  lastSampleTime: 0,
  reachedMilestones: new Set(),

  // Particle & Bot arrays
  particles: [],
  transferParticles: [],
  splashParticles: [],
  autoCleaners: [],
  floatingTexts: [],
  autoCleanerParticles: []
};

Values.cleanerPos = state.cleanerPos;
Values.cleanerAngle = state.cleanerAngle;
Values.autoCleaners = state.autoCleaners;

export function syncGridDimensions() {
  state.GRID_RES = Values.room.gridRes;
  state.TOTAL_PIXELS = Values.room.totalPixels;
  if (state.dustGrid.length !== state.TOTAL_PIXELS) {
    state.dustGrid = new Float32Array(state.TOTAL_PIXELS);
    state.dirtGrid = new Float32Array(state.TOTAL_PIXELS);
    state.dustBytes = new Uint8Array(state.TOTAL_PIXELS);
    state.dirtBytes = new Uint8Array(state.TOTAL_PIXELS);
    state.lastCleanedTime = new Float64Array(state.TOTAL_PIXELS);
  }
}

export function getMaxScreenDirt() {
  return Values.getMaxDirt ? Values.getMaxDirt() : Values.room.dirtCapacity;
}

export function getDirtRefillThreshold() {
  return Values.getDirtRefillThreshold ? Values.getDirtRefillThreshold() : (getMaxScreenDirt() * 0.70);
}

export function getRoomDustCapacity() {
  return Values.getEffectiveDustCapacity ? Values.getEffectiveDustCapacity() : (Values.room ? Values.room.dustCapacity : 1000);
}

export function randomizeDirtNoiseSeed() {
  state.noiseOffset[0] = Math.random() * 5000.0;
  state.noiseOffset[1] = Math.random() * 5000.0;
  state.dirtNoiseSeed = Math.random() * 10000.0;
}

export function getSpeedCost() {
  return Values.getUpgradeCost('speed');
}

export function getSpeedRatio() {
  return Values.getEffectiveSpeed();
}

export function getCapacityCost() {
  return Values.getUpgradeCost('capacity');
}

export function getCapacityMult() {
  const upg = Values.shops.dustShop.capacity || Values.shops.dustShop.Capacity;
  return 1.0 + (upg ? (upg.level * upg.effect) : 0);
}

export function getMaxVacuumCapacity() {
  return Values.getEffectiveCapacity();
}

export function isPlayerInStation() {
  const s = stationGeometry;
  if (!s || !s.isOpen) return false;
  return (
    state.cleanerPos.x >= s.x &&
    state.cleanerPos.x <= s.x + s.width &&
    state.cleanerPos.y >= s.y &&
    state.cleanerPos.y <= s.y + s.height
  );
}

export function isStoringActionActive() {
  return isPlayerInStation() && (Values.vacuum.stored > 0.0001);
}

export function isDirtUnlocked() {
  const upg = Values.shops.dustShop.dirt || Values.shops.dustShop.Dirt;
  return upg ? (upg.level > 0) : false;
}

export function isAutoCleanerStationOpen() {
  return true;
}

export function updateRoomGeometry() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);

  const margin = 20; // Margin around playfield
  stationGeometry.isOpen = true; // Station is always open

  // Total playfield width = roomSize (square) + stationWidth (square of 1/2 room height)
  const maxRoomW = (state.width - margin * 2) / 1.55;
  const maxRoomH = state.height - margin * 2;
  state.roomSize = Math.max(80, Math.min(maxRoomW, maxRoomH));

  // Station is a square that is 1/2 the height of the room
  const stationSize = state.roomSize * 0.5;
  const stationW = stationSize;
  const stationH = stationSize;

  const totalPlayfieldW = state.roomSize + stationW;
  state.roomX = (state.width - totalPlayfieldW) * 0.5;
  state.roomY = (state.height - state.roomSize) * 0.5;

  stationGeometry.x = state.roomX + state.roomSize;
  stationGeometry.y = state.roomY + (state.roomSize - stationH) * 0.5;
  stationGeometry.width = stationW;
  stationGeometry.height = stationH;

  // Vacuum radius: 1% of the room size (from Values)
  state.cleanerRadius = Math.max(3.0, state.roomSize * Values.getSizeRatio());
}

export function clampCleanerToPlayfield(pos, radius) {
  const { roomX, roomY, roomSize } = state;
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
