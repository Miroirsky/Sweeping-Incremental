/**
 * Sweeping Incremental - Room Simulation, Organic Dirt Waves & Autonomous Cleaners
 */

import { Values } from './data.js';
import {
  state,
  stationGeometry,
  getMaxScreenDirt,
  getDirtRefillThreshold,
  getRoomDustCapacity,
  getMaxVacuumCapacity,
  getSpeedRatio,
  randomizeDirtNoiseSeed,
  isDirtUnlocked,
  isStoringActionActive,
  clampCleanerToPlayfield
} from './state.js';
import {
  spawnDustParticles,
  spawnTransferParticles,
  spawnFloatingText
} from './particles.js';

// 2D Hash & Smooth Value Noise for procedural dirt patches
export function hash2D(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function smoothNoise2D(x, y) {
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

export function pruneDeadDirtZones() {
  const { dirtZones, GRID_RES, dirtGrid } = state;
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

// Generates organic dirt patches instantly up to max dirt capacity ONLY where there is dust
export function generateInstantDirt(onUpdateUI) {
  if (!isDirtUnlocked()) return;

  const maxDirt = getMaxScreenDirt();
  if (state.currentScreenDirtGrams >= maxDirt - 0.2) return;

  const requiredDust = Math.min(getRoomDustCapacity(), maxDirt);
  if (state.currentScreenDustGrams < requiredDust - 0.5) {
    return; // Not enough dust on the screen yet, wait until dust reappears!
  }

  pruneDeadDirtZones();
  randomizeDirtNoiseSeed();

  const {
    GRID_RES,
    cleanerPos,
    roomX,
    roomY,
    roomSize,
    cleanerRadius,
    dustGrid,
    dirtGrid,
    dirtZones,
    dirtNoiseSeed
  } = state;

  const dirtPerPx = Values.room.dirtPerPixel;
  const dustPerPx = Values.room.dustPerPixel;
  const scaleFactor = GRID_RES / 100.0;
  const vx = ((cleanerPos.x - roomX) / roomSize) * GRID_RES;
  const vy = ((cleanerPos.y - roomY) / roomSize) * GRID_RES;
  const minSafeDistCleaner = (cleanerRadius / roomSize) * GRID_RES + Math.max(6, GRID_RES * 0.08);
  const margin = Math.max(4, Math.floor(GRID_RES * 0.12));
  const range = Math.max(8, GRID_RES - margin * 2);

  let attempts = 0;
  let anyDirtAdded = false;

  while (state.currentScreenDirtGrams < maxDirt - 0.2 && attempts < 45) {
    attempts++;

    let bestX = -1;
    let bestY = -1;
    let bestScore = -999;

    for (let a = 0; a < 20; a++) {
      const cx = margin + Math.floor(Math.random() * range);
      const cy = margin + Math.floor(Math.random() * range);
      const cIdx = cy * GRID_RES + cx;
      if (dustGrid[cIdx] < dustPerPx * 0.6) continue;

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
      if (state.currentScreenDirtGrams >= maxDirt) break;
      const dy = cy - zone.y;
      const cellWorldY = roomY + (cy / GRID_RES) * roomSize;
      const dyCleaner = cellWorldY - cleanerPos.y;

      for (let cx = minX; cx <= maxX; cx++) {
        if (state.currentScreenDirtGrams >= maxDirt) break;
        const cellWorldX = roomX + (cx / GRID_RES) * roomSize;
        const distCleaner = Math.hypot(cellWorldX - cleanerPos.x, dyCleaner);
        if (distCleaner <= cleanerRadius + 2.0) {
          continue; // never spawn dirt under cleaner nozzle
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
            continue;
          }

          const normDist = d / rPerimeter;
          const density = Math.pow(Math.max(0.0, 1.0 - normDist * normDist), 0.65);
          const targetVal = Math.min(dirtPerPx * density, pixelDust);
          const currentVal = dirtGrid[idx];

          if (targetVal > currentVal) {
            const capLeft = Math.max(0, maxDirt - state.currentScreenDirtGrams);
            const diff = Math.min(targetVal - currentVal, capLeft);
            if (diff > 0.00001) {
              dirtGrid[idx] += diff;
              state.currentScreenDirtGrams += diff;
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
    state.dirtTextureNeedsUpdate = true;
    state.dustTextureNeedsUpdate = true;
  }
  state.isDirtGenerating = false;
  if (typeof onUpdateUI === 'function') {
    onUpdateUI();
  }
}

export function updateDirtZones(dt, now, onUpdateUI) {
  if (!isDirtUnlocked()) return;

  const refillThreshold = getDirtRefillThreshold();
  if (state.currentScreenDirtGrams < refillThreshold) {
    generateInstantDirt(onUpdateUI);
  }
}

// --- Autonomous Mini Cleaners System ---
export function getAutoVacuumRadius() {
  const sizeRatio = (Values.getAutoVacuumSizeRatio) ? Values.getAutoVacuumSizeRatio() : 0.025;
  return Math.max(5.0, state.roomSize * sizeRatio);
}

export function getAutoVacuumSpeed() {
  const speedVal = (Values.getEffectiveAutoVacuumSpeed)
    ? Values.getEffectiveAutoVacuumSpeed()
    : ((Values.autoVacuum && Values.autoVacuum.speed != null) ? Values.autoVacuum.speed : 0.01);
  const screenDim = Math.min(state.width, state.height);
  return screenDim * speedVal;
}

export function getAutoVacuumCapacity() {
  if (Values.getEffectiveAutoVacuumCapacity) {
    return Values.getEffectiveAutoVacuumCapacity();
  }
  return (Values.autoVacuum && Values.autoVacuum.capacity != null) ? Values.autoVacuum.capacity : 1.0;
}

export function getAutoVacuumCleanRate() {
  if (Values.getEffectiveAutoVacuumCleanRate) {
    return Values.getEffectiveAutoVacuumCleanRate();
  }
  return (Values.autoVacuum && Values.autoVacuum.cleanRate != null) ? Values.autoVacuum.cleanRate : 0.1;
}

export function syncAutoCleaners() {
  const targetCount = Values.getTotalAutoCleanersCount
    ? Values.getTotalAutoCleanersCount()
    : ((Values.shops.dustShop && Values.shops.dustShop.autoCleaner ? Values.shops.dustShop.autoCleaner.level : 0) +
       (Values.shops.dirtShop && Values.shops.dirtShop.autoCleaner ? Values.shops.dirtShop.autoCleaner.level : 0));
  const radius = getAutoVacuumRadius();
  const capacity = getAutoVacuumCapacity();
  const { autoCleaners, roomX, roomY, roomSize } = state;

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
      state: 'cleaning', // 'cleaning' | 'returning' | 'docked' | 'leaving'
      dockTimer: 0
    });
  }

  while (autoCleaners.length > targetCount) {
    autoCleaners.pop();
  }
}

function getRandomRoomPosition(margin) {
  const pad = margin || 30;
  const minX = state.roomX + pad;
  const maxX = state.roomX + state.roomSize - pad;
  const minY = state.roomY + pad;
  const maxY = state.roomY + state.roomSize - pad;
  return {
    x: minX + Math.random() * Math.max(20, maxX - minX),
    y: minY + Math.random() * Math.max(20, maxY - minY)
  };
}

export function updateAutoCleanersSimulation(dt, now, onUpdateUI) {
  const { autoCleaners, roomX, roomY, roomSize, GRID_RES, lastCleanedTime, dirtGrid, dustGrid } = state;
  if (autoCleaners.length === 0) return;

  const currentRadius = getAutoVacuumRadius();
  const currentSpeed = getAutoVacuumSpeed();
  const currentCap = getAutoVacuumCapacity();
  const currentCleanRate = getAutoVacuumCleanRate();

  const s = stationGeometry;

  for (let bIdx = 0; bIdx < autoCleaners.length; bIdx++) {
    const bot = autoCleaners[bIdx];
    bot.radius = currentRadius;
    bot.capacity = currentCap;
    bot.pulseAnim = (bot.pulseAnim || 0) + dt * 4.0;

    if (!bot.state || bot.state === 'teleporting_in' || bot.state === 'teleporting_out') bot.state = 'cleaning';

    // Transition to returning when full
    if (bot.state === 'cleaning' && bot.stored >= bot.capacity - 0.0001 && s.isOpen) {
      bot.state = 'returning';
      const minStationX = s.x + bot.radius + 8;
      const maxStationX = s.x + s.width - bot.radius - 8;
      const minStationY = s.y + bot.radius + 8;
      const maxStationY = s.y + s.height - bot.radius - 8;
      bot.stationTarget = {
        x: minStationX + Math.random() * Math.max(10, maxStationX - minStationX),
        y: minStationY + Math.random() * Math.max(10, maxStationY - minStationY)
      };
    }

    // State: Returning to station (physically moves through doorway into station)
    if (bot.state === 'returning' && s.isOpen) {
      if (!bot.stationTarget) {
        const minStationX = s.x + bot.radius + 8;
        const maxStationX = s.x + s.width - bot.radius - 8;
        const minStationY = s.y + bot.radius + 8;
        const maxStationY = s.y + s.height - bot.radius - 8;
        bot.stationTarget = {
          x: minStationX + Math.random() * Math.max(10, maxStationX - minStationX),
          y: minStationY + Math.random() * Math.max(10, maxStationY - minStationY)
        };
      }

      let steerTargetX = bot.stationTarget.x;
      let steerTargetY = bot.stationTarget.y;

      // If still in main room, steer through the doorway opening
      if (bot.x < roomX + roomSize - bot.radius * 0.5) {
        steerTargetX = roomX + roomSize + 5;
        steerTargetY = Math.max(s.y + bot.radius + 6, Math.min(s.y + s.height - bot.radius - 6, bot.stationTarget.y));
      }

      const dx = steerTargetX - bot.x;
      const dy = steerTargetY - bot.y;
      const dist = Math.hypot(dx, dy);
      bot.angle = Math.atan2(dy, dx);
      const step = Math.min(dist, currentSpeed * dt * 1.3);
      bot.x += Math.cos(bot.angle) * step;
      bot.y += Math.sin(bot.angle) * step;

      // Once inside station boundary, start docked unloading & wandering
      if (bot.x >= s.x + bot.radius + 2) {
        bot.state = 'docked';
        bot.turnTimer = 0.5 + Math.random() * 1.5;
        bot.turnSpeed = (Math.random() - 0.5) * 2.0;
      }
      continue;
    }

    // State: Docked at station (Unloading directly to storage at 1g/s while wandering)
    if (bot.state === 'docked') {
      const unloadRate = 1.0; // 1g/s directly to storage
      if ((bot.stored || 0) > 0.0001) {
        const transferAmount = Math.min(bot.stored, unloadRate * dt);
        const ratio = transferAmount / bot.stored;
        const dustAmount = (bot.storedDust || 0) * ratio;
        const dirtAmount = (bot.storedDirt || 0) * ratio;

        bot.storedDust = Math.max(0, (bot.storedDust || 0) - dustAmount);
        bot.storedDirt = Math.max(0, (bot.storedDirt || 0) - dirtAmount);
        bot.stored = Math.max(0, (bot.storedDust || 0) + (bot.storedDirt || 0));

        const dustMult = Values.getEffectiveDustMultiplier ? Values.getEffectiveDustMultiplier() : 1.0;
        Values.storage.dust = (Values.storage.dust || 0) + dustAmount * dustMult;
        Values.storage.dirt = (Values.storage.dirt || 0) + dirtAmount;

        if (typeof onUpdateUI === 'function') onUpdateUI();

        if (Math.random() < 0.35) {
          spawnTransferParticles(1, dirtAmount > dustAmount, bot.x, bot.y);
        }
        if (Math.random() < 0.2 && window.soundEngine && window.soundEngine.playStoreBlip) {
          window.soundEngine.playStoreBlip();
        }

        // Autonomous wandering inside the station so bots do not bunch in one spot
        bot.turnTimer = (bot.turnTimer || 0) - dt;
        if (bot.turnTimer <= 0) {
          bot.turnSpeed = (Math.random() - 0.5) * 2.0;
          bot.turnTimer = 1.0 + Math.random() * 2.0;
        }
        bot.angle = (bot.angle || 0) + bot.turnSpeed * dt;

        const stationWanderSpeed = currentSpeed * 0.75;
        let nextX = bot.x + Math.cos(bot.angle) * stationWanderSpeed * dt;
        let nextY = bot.y + Math.sin(bot.angle) * stationWanderSpeed * dt;

        // Bounded strictly inside station walls
        const sMinX = s.x + bot.radius + 2;
        const sMaxX = s.x + s.width - bot.radius - 2;
        const sMinY = s.y + bot.radius + 2;
        const sMaxY = s.y + s.height - bot.radius - 2;

        if (nextX <= sMinX) {
          nextX = sMinX;
          bot.angle = Math.PI - bot.angle + (Math.random() - 0.5) * 0.4;
          bot.turnTimer = 0.6 + Math.random();
        } else if (nextX >= sMaxX) {
          nextX = sMaxX;
          bot.angle = Math.PI - bot.angle + (Math.random() - 0.5) * 0.4;
          bot.turnTimer = 0.6 + Math.random();
        }

        if (nextY <= sMinY) {
          nextY = sMinY;
          bot.angle = -bot.angle + (Math.random() - 0.5) * 0.4;
          bot.turnTimer = 0.6 + Math.random();
        } else if (nextY >= sMaxY) {
          nextY = sMaxY;
          bot.angle = -bot.angle + (Math.random() - 0.5) * 0.4;
          bot.turnTimer = 0.6 + Math.random();
        }

        bot.x = nextX;
        bot.y = nextY;
      } else {
        // Finished unloading! Pick random spot in room and drive there to clean
        bot.stored = 0;
        bot.storedDust = 0;
        bot.storedDirt = 0;
        spawnFloatingText('✦ Stored!', bot.x, bot.y - bot.radius - 8, '#38bdf8');
        bot.state = 'leaving';
        const margin = Math.max(25, bot.radius * 2.5);
        bot.roomTarget = getRandomRoomPosition(margin);
      }
      continue;
    }

    // State: Leaving station to a random place in the room
    if (bot.state === 'leaving') {
      if (!bot.roomTarget) {
        const margin = Math.max(25, bot.radius * 2.5);
        bot.roomTarget = getRandomRoomPosition(margin);
      }

      let steerTargetX = bot.roomTarget.x;
      let steerTargetY = bot.roomTarget.y;

      // If still inside station or doorway, steer through the doorway opening
      if (bot.x > roomX + roomSize - bot.radius) {
        steerTargetX = roomX + roomSize - bot.radius - 6;
        steerTargetY = Math.max(s.y + bot.radius + 6, Math.min(s.y + s.height - bot.radius - 6, bot.roomTarget.y));
      }

      const dx = steerTargetX - bot.x;
      const dy = steerTargetY - bot.y;
      const dist = Math.hypot(dx, dy);
      bot.angle = Math.atan2(dy, dx);
      const step = Math.min(dist, currentSpeed * dt * 1.15);
      bot.x += Math.cos(bot.angle) * step;
      bot.y += Math.sin(bot.angle) * step;

      // Once arrived at target in room, start cleaning!
      const distToRoomTarget = Math.hypot(bot.roomTarget.x - bot.x, bot.roomTarget.y - bot.y);
      if (bot.x <= roomX + roomSize - bot.radius && distToRoomTarget < 25) {
        bot.state = 'cleaning';
        bot.angle = Math.random() * Math.PI * 2;
        bot.turnTimer = 1.0 + Math.random() * 2.0;
        bot.turnSpeed = (Math.random() - 0.5) * 1.8;
        spawnFloatingText('✦ Cleaning', bot.x, bot.y - bot.radius - 8, '#38bdf8');
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

    // Clean the ground under the robot!
    if (bot.x < roomX + roomSize) {
      const bgx = ((bot.x - roomX) / roomSize) * GRID_RES;
      const bgy = ((bot.y - roomY) / roomSize) * GRID_RES;
      const bgr = Math.max((bot.radius / roomSize) * GRID_RES, 0.75);

      const bMinX = Math.max(0, Math.floor(bgx - bgr));
      const bMaxX = Math.min(GRID_RES - 1, Math.ceil(bgx + bgr));
      const bMinY = Math.max(0, Math.floor(bgy - bgr));
      const bMaxY = Math.min(GRID_RES - 1, Math.ceil(bgy + bgr));

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
            state.currentScreenDirtGrams = Math.max(0, state.currentScreenDirtGrams - take);
            state.dirtTextureNeedsUpdate = true;
          }

          if (dustGrid[idx] > 0 && pixelBudget > 0) {
            const take = Math.min(dustGrid[idx], pixelBudget);
            dustGrid[idx] -= take;
            remainingBotCap -= take;
            pixelBudget -= take;
            botDustGained += take;
            lastCleanedTime[idx] = now;
            state.dustTextureNeedsUpdate = true;
          }

          if (remainingBotCap <= 0.00001) break;
        }
      }

      if (botDustGained > 0 || botDirtGained > 0) {
        if (botDustGained > 0) {
          state.currentScreenDustGrams = Math.max(0, state.currentScreenDustGrams - botDustGained);
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

export function updatePlayerAndRoomSimulation(dt, now, onUpdateUI) {
  const {
    width,
    height,
    roomX,
    roomY,
    roomSize,
    cleanerPos,
    prevCleanerPos,
    cleanerRadius,
    mousePos,
    isLeftMouseDown,
    isRightMouseDown,
    GRID_RES,
    TOTAL_PIXELS,
    dustGrid,
    dirtGrid,
    lastCleanedTime
  } = state;

  prevCleanerPos.x = cleanerPos.x;
  prevCleanerPos.y = cleanerPos.y;

  const maxCapacity = getMaxVacuumCapacity();
  const isVacuumFull = (Values.vacuum.stored >= maxCapacity - 0.0001);

  // Storing dust and dirt into their separate Infinite Storages when in Station
  const isStoringActive = isStoringActionActive() && (Values.vacuum.stored > 0.0001);
  if (isStoringActive) {
    const storeRate = Values.getEffectiveStoreRate ? Values.getEffectiveStoreRate() : (Values.vacuum.storeRate || 1.0);
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

    const dustMult = Values.getEffectiveDustMultiplier ? Values.getEffectiveDustMultiplier() : 1.0;
    Values.storage.dust = (Values.storage.dust || 0) + transferDust * dustMult;
    Values.storage.dirt = (Values.storage.dirt || 0) + transferDirt;

    if (Values.vacuum.stored < 0.0001) {
      Values.vacuum.stored = 0.0;
      Values.vacuum.storedDust = 0.0;
      Values.vacuum.storedDirt = 0.0;
      state.hadPlayedFullAlert = false;
    }

    if (Math.random() < 0.25 && window.soundEngine) {
      window.soundEngine.playStoreBlip();
    }

    if (transferDust > 0.0001) {
      spawnTransferParticles(2, false, cleanerPos.x, cleanerPos.y);
    }
    if (transferDirt > 0.0001) {
      spawnTransferParticles(2, true, cleanerPos.x, cleanerPos.y);
    }
  }

  // Update and grow organic dirt zones over time
  updateDirtZones(dt, now, onUpdateUI);

  // 1. Vacuum moves towards mouse when Left Click is held:
  let isMoving = false;
  let distToMouse = 0;
  if (isLeftMouseDown) {
    const dx = mousePos.x - cleanerPos.x;
    const dy = mousePos.y - cleanerPos.y;
    distToMouse = Math.hypot(dx, dy);

    if (distToMouse > 0.01) {
      isMoving = true;
      const screenDimension = Math.min(width, height);
      const speedPxPerSec = screenDimension * getSpeedRatio();
      const step = Math.min(distToMouse, speedPxPerSec * dt);

      cleanerPos.x += (dx / distToMouse) * step;
      cleanerPos.y += (dy / distToMouse) * step;

      clampCleanerToPlayfield(cleanerPos, cleanerRadius);

      if (distToMouse > 1.0) {
        const targetAngle = Math.atan2(dy, dx);
        let diff = targetAngle - state.cleanerAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        state.cleanerAngle += diff * Math.min(1.0, 18.0 * dt);
        Values.cleanerAngle = state.cleanerAngle;
      }
    }
  }

  // 2. Vacuum cleans under it when Right Click is held:
  if (isRightMouseDown) {
    if (cleanerPos.x < roomX + roomSize) {
      const gx = ((cleanerPos.x - roomX) / roomSize) * GRID_RES;
      const gy = ((cleanerPos.y - roomY) / roomSize) * GRID_RES;
      const gr = (cleanerRadius / roomSize) * GRID_RES;
      const effectiveGr = Math.max(gr, 0.75);

      const minX = Math.max(0, Math.floor(gx - effectiveGr));
      const maxX = Math.min(GRID_RES - 1, Math.ceil(gx + effectiveGr));
      const minY = Math.max(0, Math.floor(gy - effectiveGr));
      const maxY = Math.min(GRID_RES - 1, Math.ceil(gy + effectiveGr));

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
            state.currentScreenDirtGrams = Math.max(0, state.currentScreenDirtGrams - take);
            state.dirtTextureNeedsUpdate = true;
          }

          if (dustGrid[idx] > 0 && pixelBudget > 0) {
            const take = Math.min(dustGrid[idx], pixelBudget);
            dustGrid[idx] -= take;
            remainingCapacity -= take;
            pixelBudget -= take;
            dustGained += take;
            lastCleanedTime[idx] = now;
            state.dustTextureNeedsUpdate = true;
          }

          if (remainingCapacity <= 0.00001) break;
        }
      }

      if (dustGained > 0 || dirtCleanedGrams > 0) {
        if (dustGained > 0) {
          state.currentScreenDustGrams = Math.max(0, state.currentScreenDustGrams - dustGained);
        }
        Values.vacuum.storedDust = (Values.vacuum.storedDust || 0) + dustGained;
        Values.vacuum.storedDirt = (Values.vacuum.storedDirt || 0) + dirtCleanedGrams;
        Values.vacuum.stored = Values.vacuum.storedDust + Values.vacuum.storedDirt;

        if (Values.vacuum.stored >= maxCapacity - 0.0001) {
          Values.vacuum.stored = maxCapacity;
          if (!state.hadPlayedFullAlert) {
            state.hadPlayedFullAlert = true;
            if (window.soundEngine) window.soundEngine.playFullWarning();
          }
        } else {
          state.hadPlayedFullAlert = false;
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
        if (window.soundEngine) {
          window.soundEngine.updateMovement(isMoving ? 0.35 : 0.2);
        }
      }
    }
  } else {
    if (window.soundEngine) {
      if (isMoving) {
        window.soundEngine.updateMovement(0.12);
      } else {
        window.soundEngine.updateMovement(0);
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
    state.currentScreenDustGrams = Math.min(getRoomDustCapacity(), state.currentScreenDustGrams + dustGainedFromReappearance);
    state.dustTextureNeedsUpdate = true;
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

  // Autonomous Mini Cleaners simulation (wandering & vacuuming)
  updateAutoCleanersSimulation(dt, now, onUpdateUI);
}
