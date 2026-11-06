/**
 * Sweeping Incremental - Prestige System & Interactive Physics Prestige Tree UI
 *
 * Handles prestige unlocking (10g lifetime total dirt), PP calculation ((tt dirt / 10)^1.5),
 * prestige resets, automatic force-directed initial tree layout, physics-based draggable
 * upgrade bubbles with momentum and collision/repulsion, live attached connection bars,
 * node purchasing, and persistent upgrade effects driven by js/prestigeData.js.
 */

import { Values } from './data.js';
import { PRESTIGE_UPGRADES } from './prestigeData.js';
import {
  state,
  stationStorage,
  updateRoomGeometry,
  randomizeDirtNoiseSeed,
  isDirtUnlocked
} from './state.js';
import { initTextures } from './renderer.js';
import {
  generateInstantDirt,
  syncAutoCleaners
} from './simulation.js';
import {
  dom,
  closeShop,
  closeConfigsModal,
  updateDirtShopVisibility,
  initShopUI,
  updateUpgradesAndShopUI,
  calculateCleanedPercentage,
  updateCapacityAndStorageUI,
  getTotalDustCollected,
  getTotalDirtCleaned,
  getCurrentPrestigeDirtCleaned,
  getCurrentPrestigeDustCollected
} from './ui.js';
import { saveGame } from './settings.js';

export const PRESTIGE_UNLOCK_DIRT = 10; // 10g lifetime total dirt (tt dirt)
export const PRESTIGE_UNLOCK_DUST = 10; // Alias kept for compatibility
export const PRESTIGE_NODE_DIAMETER = 72; // Circular node diameter in px
export const PRESTIGE_BAR_LENGTH = PRESTIGE_NODE_DIAMETER * 2; // Connection bar length is 2x node diameter (144px visible)
export const PRESTIGE_CENTER_LINK_DIST = PRESTIGE_NODE_DIAMETER + PRESTIGE_BAR_LENGTH; // Center-to-center link distance (216px)

let hasShownPrestigeUnlockToast = false;
let treePanX = 0;
let treePanY = 0;
let isPanningTree = false;
let panStartX = 0;
let panStartY = 0;
let cachedLayoutSignature = '';
let cachedNodePositions = new Map();
let activeTreeBars = [];
let activeDragNode = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragStartClientX = 0;
let dragStartClientY = 0;
let hasDraggedNode = false;
let treePhysicsRafId = null;
let prestigeListenersInitialized = false;

/**
 * Retrieve the list of prestige upgrade definitions from prestigeData.js
 */
export function getPrestigeUpgrades() {
  const source = (typeof window !== 'undefined' && Array.isArray(window.PRESTIGE_UPGRADES))
    ? window.PRESTIGE_UPGRADES
    : PRESTIGE_UPGRADES;

  if (!Array.isArray(source)) return [];

  return source.map((upg) => {
    const reqs = upg.requirements || upg.requires || upg.require || [];
    const normalizedReqs = Array.isArray(reqs) ? reqs : (reqs ? [reqs] : []);
    const baseCost = Math.max(0, Number(upg.baseCost != null ? upg.baseCost : upg.cost) || 0);
    const maxLevel = Math.max(1, parseInt(upg.maxLevel, 10) || 1);
    const costMultiplier = Math.max(1.0, Number(upg.costMultiplier || upg.priceMultiplier) || 1.0);

    return {
      id: String(upg.id),
      name: upg.name || String(upg.id),
      description: upg.description || upg.desc || '',
      emoji: upg.emoji || upg.icon || '⭐',
      image: upg.image || null,
      cost: baseCost,
      baseCost,
      maxLevel,
      costMultiplier,
      requirements: normalizedReqs.map(String),
      effects: upg.effects || upg.effect || {}
    };
  });
}

export function getPrestigeUpgradeById(id) {
  if (!id) return null;
  const list = getPrestigeUpgrades();
  return list.find((u) => u.id === id) || null;
}

/**
 * Format PP number cleanly (integer if whole, otherwise up to 2 decimals)
 */
export function formatPP(val) {
  const num = Math.max(0, Number(val) || 0);
  if (Math.abs(num - Math.round(num)) < 1e-5) {
    return String(Math.round(num));
  }
  return Number(num.toFixed(2)).toString();
}

/**
 * Calculate PP gained from current prestige total dirt: PP = (current prestige tt dirt / 10)^1.5
 */
export function calculatePrestigePP(currentPrestigeDirt) {
  const dirt = currentPrestigeDirt !== undefined
    ? Math.max(0, Number(currentPrestigeDirt) || 0)
    : getCurrentPrestigeDirtCleaned();
  if (dirt <= 0) return 0;
  const basePP = Math.pow(dirt / 10, 1.5);
  const ppMult = (Values.prestigeEffects && typeof Values.prestigeEffects.ppMultiplier === 'number')
    ? Values.prestigeEffects.ppMultiplier
    : 0;
  return basePP * (1.0 + ppMult);
}

export function getPendingPrestigePP() {
  const currentRunDirt = getCurrentPrestigeDirtCleaned();
  if (currentRunDirt < PRESTIGE_UNLOCK_DIRT - 1e-6) return 0;
  return calculatePrestigePP(currentRunDirt);
}

/**
 * Check if the prestige requirement is met (10g total dirt collected during current prestige run)
 */
export function isPrestigeRequirementMet() {
  return getCurrentPrestigeDirtCleaned() >= PRESTIGE_UNLOCK_DIRT - 1e-6;
}

export function canPerformPrestige() {
  return isPrestigeRequirementMet();
}

/**
 * Check if prestige requirement is met for current run
 */
export function isPrestigeUnlocked() {
  if (!state.prestige) return false;
  return isPrestigeRequirementMet();
}

/**
 * Check if the Prestige Tree itself has been unlocked/accessed (persists so player can view tree & spend PP)
 */
export function isPrestigeTreeUnlocked() {
  if (!state.prestige) return false;
  if (state.prestige.treeUnlocked) return true;
  if (state.prestige.count > 0 || (state.prestige.pp || 0) > 0) return true;
  if (state.prestige.purchased && state.prestige.purchased.size > 0) return true;
  return isPrestigeRequirementMet();
}

export function getPrestigeUpgradeLevel(id) {
  if (!state.prestige) return 0;
  if (state.prestige.upgradeLevels && typeof state.prestige.upgradeLevels[id] === 'number') {
    return state.prestige.upgradeLevels[id];
  }
  if (state.prestige.purchased && state.prestige.purchased.has(id)) {
    return 1;
  }
  return 0;
}

export function isPrestigeUpgradePurchased(id) {
  if (!state.prestige) return false;
  if (getPrestigeUpgradeLevel(id) >= 1) return true;
  return !!(state.prestige.purchased && state.prestige.purchased.has(id));
}

export function isPrestigeUpgradeMaxed(id) {
  const upg = getPrestigeUpgradeById(id);
  if (!upg) return false;
  const maxLvl = upg.maxLevel || 1;
  return getPrestigeUpgradeLevel(id) >= maxLvl;
}

export function getPrestigeUpgradeCost(upgOrId) {
  const upg = typeof upgOrId === 'string' ? getPrestigeUpgradeById(upgOrId) : upgOrId;
  if (!upg) return Infinity;
  const curLvl = getPrestigeUpgradeLevel(upg.id);
  const maxLvl = upg.maxLevel || 1;
  if (curLvl >= maxLvl) return Infinity;
  const base = (upg.baseCost != null) ? upg.baseCost : (upg.cost || 0);
  const mult = upg.costMultiplier || 1.0;
  return base * Math.pow(mult, curLvl);
}

export function arePrestigeRequirementsMet(upg) {
  const target = typeof upg === 'string' ? getPrestigeUpgradeById(upg) : upg;
  if (!target) return false;
  if (!target.requirements || target.requirements.length === 0) return true;
  for (const reqId of target.requirements) {
    if (!isPrestigeUpgradePurchased(reqId)) return false;
  }
  return true;
}

export function canPurchasePrestigeUpgrade(id) {
  const upg = getPrestigeUpgradeById(id);
  if (!upg) return false;
  if (isPrestigeUpgradeMaxed(upg.id)) return false;
  if (!arePrestigeRequirementsMet(upg)) return false;
  const cost = getPrestigeUpgradeCost(upg);
  const currentPP = (state.prestige && typeof state.prestige.pp === 'number') ? state.prestige.pp : 0;
  return currentPP + 1e-7 >= cost;
}

/**
 * Aggregate and apply effects from all purchased prestige upgrades
 */
export function applyPrestigeEffects() {
  const upgrades = getPrestigeUpgrades();
  const aggregated = {
    unlockTree: false,
    maxRoomDirt: null,
    addRoomDirt: 0,
    startingDust: 0,
    startingDirt: 0,
    storingResourceBonus: 0,
    dustMultiplier: 0,
    dustDensityMultiplier: 0,
    cleanRateMultiplier: 0,
    speedMultiplier: 0,
    capacityMultiplier: 0,
    storeRateMultiplier: 0,
    sizeMultiplier: 0,
    autoCleanRateMultiplier: 0,
    autoSpeedMultiplier: 0,
    autoCapacityMultiplier: 0,
    freeAutoCleaners: 0,
    ppMultiplier: 0
  };

  for (const upg of upgrades) {
    const level = getPrestigeUpgradeLevel(upg.id);
    if (level <= 0) continue;
    const eff = upg.effects;
    if (!eff) continue;

    if (typeof eff === 'function') {
      try { eff(Values, state, aggregated, level); } catch (e) {}
      continue;
    }

    if (eff.unlockTree) aggregated.unlockTree = true;
    if (typeof eff.maxRoomDirt === 'number') {
      aggregated.maxRoomDirt = aggregated.maxRoomDirt === null
        ? eff.maxRoomDirt
        : Math.max(aggregated.maxRoomDirt, eff.maxRoomDirt);
    }
    if (typeof eff.addRoomDirt === 'number') aggregated.addRoomDirt += eff.addRoomDirt * level;
    if (typeof eff.startingDust === 'number') aggregated.startingDust += eff.startingDust * level;
    if (typeof eff.startingDirt === 'number') aggregated.startingDirt += eff.startingDirt * level;
    if (typeof eff.storingResourceBonus === 'number') aggregated.storingResourceBonus += eff.storingResourceBonus * level;
    if (typeof eff.dustMultiplier === 'number') aggregated.dustMultiplier += eff.dustMultiplier * level;
    if (typeof eff.dustDensityMultiplier === 'number') aggregated.dustDensityMultiplier += eff.dustDensityMultiplier * level;
    if (typeof eff.cleanRateMultiplier === 'number') aggregated.cleanRateMultiplier += eff.cleanRateMultiplier * level;
    if (typeof eff.speedMultiplier === 'number') aggregated.speedMultiplier += eff.speedMultiplier * level;
    if (typeof eff.capacityMultiplier === 'number') aggregated.capacityMultiplier += eff.capacityMultiplier * level;
    if (typeof eff.storeRateMultiplier === 'number') aggregated.storeRateMultiplier += eff.storeRateMultiplier * level;
    if (typeof eff.sizeMultiplier === 'number') aggregated.sizeMultiplier += eff.sizeMultiplier * level;
    if (typeof eff.autoCleanRateMultiplier === 'number') aggregated.autoCleanRateMultiplier += eff.autoCleanRateMultiplier * level;
    if (typeof eff.autoSpeedMultiplier === 'number') aggregated.autoSpeedMultiplier += eff.autoSpeedMultiplier * level;
    if (typeof eff.autoCapacityMultiplier === 'number') aggregated.autoCapacityMultiplier += eff.autoCapacityMultiplier * level;
    if (typeof eff.freeAutoCleaners === 'number') aggregated.freeAutoCleaners += eff.freeAutoCleaners * level;
    if (typeof eff.ppMultiplier === 'number') aggregated.ppMultiplier += eff.ppMultiplier * level;
  }

  Values.prestigeEffects = aggregated;

  // Update room dirt capacity directly (10g base -> 25g with Dirty)
  const baseDirt = (Values.room && typeof Values.room.baseDirtCapacity === 'number') ? Values.room.baseDirtCapacity : 10;
  let effectiveDirtCap = aggregated.maxRoomDirt !== null ? Math.max(baseDirt, aggregated.maxRoomDirt) : baseDirt;
  effectiveDirtCap += aggregated.addRoomDirt;
  if (Values.room) {
    Values.room.dirtCapacity = effectiveDirtCap;
  }

  return aggregated;
}

/**
 * Automatically unlock "The Tree" (and any free root upgrades with no requirements) on first access
 */
export function ensureFreeRootUpgradesUnlocked() {
  let changed = false;
  const upgrades = getPrestigeUpgrades();
  for (const upg of upgrades) {
    if (upg.cost === 0 && (!upg.requirements || upg.requirements.length === 0)) {
      if (!isPrestigeUpgradePurchased(upg.id)) {
        if (!state.prestige.upgradeLevels) state.prestige.upgradeLevels = {};
        state.prestige.upgradeLevels[upg.id] = 1;
        state.prestige.purchased.add(upg.id);
        changed = true;
      }
    }
  }
  if (changed) {
    applyPrestigeEffects();
    saveGame();
  }
  return changed;
}

/**
 * Purchase a prestige upgrade node by ID (supports multi-level upgrades like Richer)
 */
export function buyPrestigeUpgrade(id) {
  const upg = getPrestigeUpgradeById(id);
  if (!upg) return false;

  if (isPrestigeUpgradeMaxed(upg.id)) {
    return false;
  }

  const nodeEl = document.querySelector(`.prestige-node[data-upgrade-id="${upg.id}"]`);

  // Validate requirements and available PP
  if (!arePrestigeRequirementsMet(upg) || !canPurchasePrestigeUpgrade(upg.id)) {
    if (nodeEl) {
      nodeEl.classList.remove('node-shake');
      void nodeEl.offsetWidth;
      nodeEl.classList.add('node-shake');
    }
    return false;
  }

  const cost = getPrestigeUpgradeCost(upg);
  state.prestige.pp = Math.max(0, (state.prestige.pp || 0) - cost);
  if (Math.abs(state.prestige.pp - Math.round(state.prestige.pp)) < 1e-6) {
    state.prestige.pp = Math.round(state.prestige.pp);
  }

  const curLevel = getPrestigeUpgradeLevel(upg.id);
  const nextLevel = curLevel + 1;
  if (!state.prestige.upgradeLevels) state.prestige.upgradeLevels = {};
  state.prestige.upgradeLevels[upg.id] = nextLevel;
  state.prestige.purchased.add(upg.id);

  const prevMaxDirt = Values.room ? Values.room.dirtCapacity : 10;
  applyPrestigeEffects();
  const newMaxDirt = Values.room ? Values.room.dirtCapacity : 10;

  // If Clean Start (or another startingDust upgrade) is purchased right after prestiging, apply starting dust immediately
  if (upg.effects && typeof upg.effects.startingDust === 'number' && state.prestige.justPrestiged) {
    const targetStartDust = Values.prestigeEffects.startingDust || 0;
    if ((Values.storage.dust || 0) < targetStartDust) {
      Values.storage.dust = targetStartDust;
    }
  }
  if (upg.effects && typeof upg.effects.startingDirt === 'number' && state.prestige.justPrestiged) {
    const targetStartDirt = Values.prestigeEffects.startingDirt || 0;
    if ((Values.storage.dirt || 0) < targetStartDirt) {
      Values.storage.dirt = targetStartDirt;
    }
  }

  // If max room dirt increased while Dirt is unlocked, spawn dirt up to new cap
  if (newMaxDirt > prevMaxDirt && isDirtUnlocked()) {
    generateInstantDirt(updateCapacityAndStorageUI);
  }

  syncAutoCleaners();
  updateCapacityAndStorageUI();
  updateUpgradesAndShopUI();
  updatePrestigeTreeUI();

  if (nodeEl) {
    nodeEl.classList.remove('node-purchased-anim');
    void nodeEl.offsetWidth;
    nodeEl.classList.add('node-purchased-anim');
  }

  // Refresh tooltip if hovering this node
  const tooltip = document.getElementById('prestige-node-tooltip');
  if (tooltip && tooltip.getAttribute('data-active-id') === upg.id) {
    showNodeTooltip(upg, nodeEl);
  }

  if (window.soundEngine && window.soundEngine.playPurchaseSound) {
    window.soundEngine.playPurchaseSound();
  }

  saveGame();
  return true;
}

/**
 * Execute Prestige:
 * - Awards PP = (tt dirt / 10)^1.5
 * - Resets storage and normal upgrades
 * - Keeps PP, lifetime stats, and purchased prestige upgrades
 * - Automatically opens the Prestige Tree after each prestige
 */
export function performPrestige() {
  if (!canPerformPrestige()) {
    if (dom.toast && dom.toastText) {
      const currentRunDirt = getCurrentPrestigeDirtCleaned();
      dom.toastText.textContent = `Need at least ${PRESTIGE_UNLOCK_DIRT}g dirt this prestige run to prestige! (${currentRunDirt.toFixed(1)}/${PRESTIGE_UNLOCK_DIRT}g)`;
      dom.toast.classList.remove('hidden');
      setTimeout(() => {
        dom.toast.classList.add('hidden');
      }, 3000);
    }
    return false;
  }

  // 1. Commit and preserve lifetime statistics
  const lifetimeDust = getTotalDustCollected();
  const lifetimeDirt = getTotalDirtCleaned();
  if (state.stats) {
    state.stats.totalDustCollected = lifetimeDust;
    state.stats.totalDirtCleaned = lifetimeDirt;
  }

  // 2. Calculate and award PP based on CURRENT prestige total dirt: (current prestige tt dirt / 10)^1.5
  const currentRunDirt = getCurrentPrestigeDirtCleaned();
  const gainedPP = calculatePrestigePP(currentRunDirt);

  state.prestige.treeUnlocked = true;
  state.prestige.unlocked = true;
  state.prestige.pp = (state.prestige.pp || 0) + gainedPP;
  if (Math.abs(state.prestige.pp - Math.round(state.prestige.pp)) < 1e-6) {
    state.prestige.pp = Math.round(state.prestige.pp);
  }
  state.prestige.totalPP = (state.prestige.totalPP || 0) + gainedPP;
  state.prestige.count = (state.prestige.count || 0) + 1;
  state.prestige.justPrestiged = true;

  // 3. Reset current prestige statistics after prestige, but preserve lifetime statistics
  if (state.currentPrestigeStats) {
    state.currentPrestigeStats.totalDirtCleaned = 0.0;
    state.currentPrestigeStats.totalDustCollected = 0.0;
    state.currentPrestigeStats.totalDistanceTraveled = 0.0;
    state.currentPrestigeStats.totalTimePlayed = 0.0;
    state.currentPrestigeStats.totalStationUnloads = 0;
    state.currentPrestigeStats.totalClicks = 0;
  }

  // 4. Re-apply purchased prestige upgrade effects
  applyPrestigeEffects();

  // Reset normal upgrades in Dust Shop and Dirt Shop
  if (Values.shops) {
    for (const shopKey of Object.keys(Values.shops)) {
      const shop = Values.shops[shopKey];
      if (!shop) continue;
      for (const upgKey of Object.keys(shop)) {
        if (shop[upgKey] && typeof shop[upgKey].level === 'number') {
          shop[upgKey].level = 0;
        }
      }
    }
  }

  // Reset vacuum, auto-vacuum, and station canisters
  Values.vacuum.stored = 0.0;
  Values.vacuum.storedDust = 0.0;
  Values.vacuum.storedDirt = 0.0;
  if (Values.autoVacuum) {
    Values.autoVacuum.stored = 0.0;
    Values.autoVacuum.storedDust = 0.0;
    Values.autoVacuum.storedDirt = 0.0;
  }
  stationStorage.dust = 0.0;
  stationStorage.dirt = 0.0;

  // Reset main storage (granting Clean Start 100g dust if owned)
  const startDust = (Values.prestigeEffects && Values.prestigeEffects.startingDust) ? Values.prestigeEffects.startingDust : 0.0;
  const startDirt = (Values.prestigeEffects && Values.prestigeEffects.startingDirt) ? Values.prestigeEffects.startingDirt : 0.0;
  Values.storage.dust = startDust;
  Values.storage.dirt = startDirt;

  // Reset room floor, particles, dirt zones, and autonomous bots
  state.noiseOffset = [Math.random() * 100.0, Math.random() * 100.0];
  state.reachedMilestones.clear();
  state.particles.length = 0;
  state.transferParticles.length = 0;
  state.splashParticles.length = 0;
  state.autoCleaners.length = 0;
  state.floatingTexts.length = 0;
  state.autoCleanerParticles.length = 0;
  state.dirtZones = [];
  state.currentScreenDirtGrams = 0.0;
  state.isDirtGenerating = false;
  randomizeDirtNoiseSeed();

  state.cleanerAngle = Math.PI * 0.5;
  Values.cleanerAngle = state.cleanerAngle;
  updateRoomGeometry();
  initTextures();
  syncAutoCleaners();

  state.cleanerPos.x = state.width * 0.5;
  state.cleanerPos.y = state.height * 0.5;
  state.prevCleanerPos.x = state.cleanerPos.x;
  state.prevCleanerPos.y = state.cleanerPos.y;

  state.isSpaceHeld = false;
  state.isRightMouseDown = false;
  state.isLeftMouseDown = false;
  state.hadPlayedFullAlert = false;
  state.currentShop = 'dustShop';

  closeShop();
  updateDirtShopVisibility();
  initShopUI();
  updateUpgradesAndShopUI();
  calculateCleanedPercentage();
  updateCapacityAndStorageUI();
  updatePrestigeButtonVisibility();

  if (window.soundEngine) {
    window.soundEngine.resume();
    if (window.soundEngine.playBlackHoleExit) {
      window.soundEngine.playBlackHoleExit();
    } else if (window.soundEngine.playMilestone) {
      window.soundEngine.playMilestone();
    }
  }

  saveGame();

  // Automatically open the Prestige Tree after each prestige
  openPrestigeTree();

  if (dom.toast && dom.toastText) {
    dom.toastText.textContent = `🔮 Prestiged! +${formatPP(gainedPP)} PP (Total: ${formatPP(state.prestige.pp)} PP)`;
    dom.toast.classList.remove('hidden');
    setTimeout(() => {
      dom.toast.classList.add('hidden');
    }, 3200);
  }

  return true;
}

/**
 * Automatic Force-Directed Initial Tree Layout Generator
 * - Places dependent upgrades near their prerequisites with connection bars ~2x node diameter (144px visible, 216px center-to-center)
 * - Pushes upgrades as far apart as possible from every other upgrade while avoiding overlaps and keeping prerequisite connections intact
 */
export function computePrestigeTreeLayout(upgrades, nodeDiameter = PRESTIGE_NODE_DIAMETER) {
  // Center-to-center link distance: nodeDiameter (72px) + bar length (144px) = 216px
  // This guarantees the visible white connection bar between node circles is exactly 2x node diameter (144px).
  const targetLinkDist = nodeDiameter + (nodeDiameter * 2);
  const minNodeSeparation = nodeDiameter * 1.6; // Minimum center-to-center distance (115px) preventing any bubble overlap

  const nodes = new Map();
  const childrenMap = new Map();
  const edges = [];

  for (const upg of upgrades) {
    nodes.set(upg.id, {
      id: upg.id,
      upg,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      targetX: 0,
      targetY: 0,
      isDragging: false,
      depth: 0,
      isRoot: !upg.requirements || upg.requirements.length === 0,
      wrapperEl: null,
      nodeBtn: null
    });
    childrenMap.set(upg.id, []);
  }

  for (const upg of upgrades) {
    if (!upg.requirements) continue;
    for (const reqId of upg.requirements) {
      if (nodes.has(reqId)) {
        edges.push({ source: reqId, target: upg.id });
        childrenMap.get(reqId).push(upg.id);
      }
    }
  }

  // 1. Initial BFS placement from roots: fan outward with maximum angular spread
  const roots = Array.from(nodes.values()).filter((n) => n.isRoot);
  const visited = new Set();
  const queue = [];

  roots.forEach((root, idx) => {
    root.x = idx === 0 ? 0 : (idx * targetLinkDist * 2.0);
    root.y = 0;
    root.depth = 0;
    visited.add(root.id);
    queue.push(root.id);
  });

  // Fallback if circular dependency left nodes unvisited
  if (queue.length === 0 && upgrades.length > 0) {
    const first = nodes.get(upgrades[0].id);
    first.isRoot = true;
    visited.add(first.id);
    queue.push(first.id);
  }

  while (queue.length > 0) {
    const parentId = queue.shift();
    const parentNode = nodes.get(parentId);
    const children = childrenMap.get(parentId) || [];
    const unvisitedChildren = children.filter((cid) => !visited.has(cid));

    // Determine parent's outward vector from grandparent (or default downwards)
    let baseAngle = Math.PI * 0.5;
    if (parentNode.upg.requirements && parentNode.upg.requirements.length > 0) {
      const grandParent = nodes.get(parentNode.upg.requirements[0]);
      if (grandParent) {
        baseAngle = Math.atan2(parentNode.y - grandParent.y, parentNode.x - grandParent.x);
      }
    }

    const count = unvisitedChildren.length;
    unvisitedChildren.forEach((childId, i) => {
      visited.add(childId);
      const childNode = nodes.get(childId);
      childNode.depth = parentNode.depth + 1;

      let angle;
      if (parentNode.isRoot) {
        if (count === 1) {
          angle = Math.PI * 0.5;
        } else if (count === 2) {
          // Push direct children far apart to opposite sides (wide left & right)
          angle = i === 0 ? Math.PI * 0.85 : Math.PI * 0.15;
        } else {
          // Evenly distributed in a circle around root
          angle = -Math.PI * 0.5 + (i * 2 * Math.PI) / count;
        }
      } else {
        // Continue outward away from grandparent, fanning if multiple children
        const spread = Math.min(Math.PI * 0.9, Math.max(Math.PI * 0.45, (count - 1) * 0.6));
        angle = count === 1
          ? baseAngle
          : (baseAngle - spread * 0.5 + (i / (count - 1)) * spread);
      }

      childNode.x = parentNode.x + Math.cos(angle) * targetLinkDist;
      childNode.y = parentNode.y + Math.sin(angle) * targetLinkDist;
      queue.push(childId);
    });
  }

  // Place any remaining disconnected nodes
  let extraIdx = 1;
  for (const node of nodes.values()) {
    if (!visited.has(node.id)) {
      node.x = extraIdx * targetLinkDist * 1.5;
      node.y = -targetLinkDist;
      extraIdx++;
    }
  }

  // 2. Force-directed simulation: pushes upgrades as far apart as possible from every other upgrade,
  // avoids overlaps, and keeps prerequisite connections intact.
  const nodeArray = Array.from(nodes.values());
  const iterations = 320;

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 1.0 - (iter / iterations) * 0.82;

    for (let i = 0; i < nodeArray.length; i++) {
      nodeArray[i].vx = 0;
      nodeArray[i].vy = 0;
    }

    // A. Strong global all-pairs repulsion: pushes every upgrade away from every other upgrade
    for (let i = 0; i < nodeArray.length; i++) {
      const a = nodeArray[i];
      for (let j = i + 1; j < nodeArray.length; j++) {
        const b = nodeArray[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.1) {
          dx = (i - j) * 1.2 + 0.3;
          dy = (i % 2 === 0 ? 1 : -1) * 0.5;
          dist = Math.hypot(dx, dy);
        }

        const nx = dx / dist;
        const ny = dy / dist;

        // Hard anti-overlap repulsion
        if (dist < minNodeSeparation) {
          const push = (minNodeSeparation - dist) * 0.65;
          a.vx -= nx * push;
          a.vy -= ny * push;
          b.vx += nx * push;
          b.vy += ny * push;
        }

        // Global repulsion across wide radius: pushes all upgrades apart from each other
        const repulseRange = targetLinkDist * 5.0;
        if (dist < repulseRange) {
          const factor = Math.max(0, (repulseRange - dist) / repulseRange);
          const repulseForce = factor * factor * 16.0 * temp;
          a.vx -= nx * repulseForce;
          a.vy -= ny * repulseForce;
          b.vx += nx * repulseForce;
          b.vy += ny * repulseForce;
        }
      }
    }

    // B. Prerequisite connection springs: keeps connections intact at targetLinkDist (~2x diameter bar)
    for (let e = 0; e < edges.length; e++) {
      const s = nodes.get(edges[e].source);
      const t = nodes.get(edges[e].target);
      if (!s || !t) continue;

      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.hypot(dx, dy) || 0.1;
      const diff = dist - targetLinkDist;
      const nx = dx / dist;
      const ny = dy / dist;

      const springForce = diff * 0.42;
      if (!s.isRoot) {
        s.vx += nx * springForce * 0.5;
        s.vy += ny * springForce * 0.5;
      }
      if (!t.isRoot) {
        t.vx -= nx * springForce * (s.isRoot ? 1.0 : 0.5);
        t.vy -= ny * springForce * (s.isRoot ? 1.0 : 0.5);
      }
    }

    // C. Integrate positions and keep primary root anchored at center
    for (let i = 0; i < nodeArray.length; i++) {
      const n = nodeArray[i];
      if (n.isRoot && i === 0) {
        n.x = 0;
        n.y = 0;
        continue;
      }
      n.x += n.vx;
      n.y += n.vy;
    }

    // D. Soft distance alignment in second half of simulation
    if (iter > iterations * 0.5) {
      for (let i = 0; i < nodeArray.length; i++) {
        const n = nodeArray[i];
        if (n.upg.requirements && n.upg.requirements.length === 1) {
          const parent = nodes.get(n.upg.requirements[0]);
          if (parent) {
            const dx = n.x - parent.x;
            const dy = n.y - parent.y;
            const dist = Math.hypot(dx, dy) || 0.1;
            const targetRatio = targetLinkDist / dist;
            n.x = parent.x + dx * (0.85 + 0.15 * targetRatio);
            n.y = parent.y + dy * (0.85 + 0.15 * targetRatio);
          }
        }
      }
    }
  }

  // Final exact link distance alignment along prerequisite connections
  for (let e = 0; e < edges.length; e++) {
    const s = nodes.get(edges[e].source);
    const t = nodes.get(edges[e].target);
    if (!s || !t) continue;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const dist = Math.hypot(dx, dy) || 0.1;
    t.x = s.x + (dx / dist) * targetLinkDist;
    t.y = s.y + (dy / dist) * targetLinkDist;
  }

  // Zero out velocities after initial static layout solver
  for (let i = 0; i < nodeArray.length; i++) {
    nodeArray[i].vx = 0;
    nodeArray[i].vy = 0;
    nodeArray[i].targetX = nodeArray[i].x;
    nodeArray[i].targetY = nodeArray[i].y;
  }

  return { nodes, edges, nodeDiameter, targetLinkDist };
}

/**
 * Interactive Physics Simulation Step for Draggable Prestige Tree Bubbles
 * - Smooth motion toward pointer when dragging a bubble
 * - Momentum & velocity damping when released
 * - Collision & soft repulsion between bubbles so they push each other naturally
 * - Allows free rearrangement of the tree layout
 */
export function stepTreePhysics() {
  const nodeArray = Array.from(cachedNodePositions.values());
  if (nodeArray.length === 0) return false;

  const repulseRadius = PRESTIGE_NODE_DIAMETER * 1.45; // Soft repulsion threshold (104.4px)
  const minCollisionDist = PRESTIGE_NODE_DIAMETER * 1.08; // Hard collision threshold (77.8px)

  // 1. Update dragged node velocity & position smoothly toward cursor target
  for (let i = 0; i < nodeArray.length; i++) {
    const n = nodeArray[i];
    if (n.isDragging) {
      const dx = n.targetX - n.x;
      const dy = n.targetY - n.y;
      n.vx = dx * 0.45;
      n.vy = dy * 0.45;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  // 2. Pairwise bubble collision & repulsion forces
  for (let i = 0; i < nodeArray.length; i++) {
    const a = nodeArray[i];
    for (let j = i + 1; j < nodeArray.length; j++) {
      const b = nodeArray[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);

      if (dist < 0.01) {
        dx = (i - j) * 0.5 + 0.25;
        dy = 0.25;
        dist = Math.hypot(dx, dy);
      }

      if (dist < repulseRadius) {
        const nx = dx / dist;
        const ny = dy / dist;
        const softFactor = (repulseRadius - dist) / repulseRadius;
        let impulse = softFactor * softFactor * 2.2;

        if (dist < minCollisionDist) {
          impulse += (minCollisionDist - dist) * 0.35;
        }

        if (a.isDragging && !b.isDragging) {
          b.vx += nx * impulse * 1.8;
          b.vy += ny * impulse * 1.8;
        } else if (b.isDragging && !a.isDragging) {
          a.vx -= nx * impulse * 1.8;
          a.vy -= ny * impulse * 1.8;
        } else if (!a.isDragging && !b.isDragging) {
          a.vx -= nx * impulse;
          a.vy -= ny * impulse;
          b.vx += nx * impulse;
          b.vy += ny * impulse;
        }
      }
    }
  }

  // 3. Integrate momentum & apply smooth friction damping for non-dragged bubbles
  let anyMoving = !!activeDragNode;
  for (let i = 0; i < nodeArray.length; i++) {
    const n = nodeArray[i];
    if (n.isDragging) continue;

    n.x += n.vx;
    n.y += n.vy;

    // Smooth momentum damping
    n.vx *= 0.88;
    n.vy *= 0.88;

    const speed = Math.hypot(n.vx, n.vy);
    if (speed < 0.02) {
      n.vx = 0;
      n.vy = 0;
    } else {
      anyMoving = true;
    }
  }

  syncTreeDOMPositions();
  return anyMoving;
}

/**
 * Synchronize node DOM positions and keep connection bars attached to their nodes
 */
export function syncTreeDOMPositions() {
  const centerX = window.innerWidth * 0.5;
  const centerY = window.innerHeight * 0.46;

  // Update node wrappers
  for (const node of cachedNodePositions.values()) {
    if (node.wrapperEl) {
      const x = centerX + node.x;
      const y = centerY + node.y;
      node.wrapperEl.style.left = `${x.toFixed(1)}px`;
      node.wrapperEl.style.top = `${y.toFixed(1)}px`;
    }
  }

  // Update white connection bars so they stay attached to their nodes while moving
  for (let i = 0; i < activeTreeBars.length; i++) {
    const item = activeTreeBars[i];
    const sourcePos = cachedNodePositions.get(item.fromId);
    const targetPos = cachedNodePositions.get(item.toId);
    if (!sourcePos || !targetPos || !item.barEl) continue;

    const x1 = centerX + sourcePos.x;
    const y1 = centerY + sourcePos.y;
    const x2 = centerX + targetPos.x;
    const y2 = centerY + targetPos.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

    item.barEl.style.width = `${dist.toFixed(1)}px`;
    item.barEl.style.left = `${x1.toFixed(1)}px`;
    item.barEl.style.top = `${y1.toFixed(1)}px`;
    item.barEl.style.transform = `translateY(-50%) rotate(${angleDeg.toFixed(2)}deg)`;
  }
}

function startTreePhysicsLoop() {
  if (treePhysicsRafId) return;
  function loop() {
    if (!state.isPrestigeTreeOpen) {
      treePhysicsRafId = null;
      return;
    }
    const keepRunning = stepTreePhysics();
    if (keepRunning) {
      treePhysicsRafId = requestAnimationFrame(loop);
    } else {
      treePhysicsRafId = null;
    }
  }
  treePhysicsRafId = requestAnimationFrame(loop);
}

/**
 * Populate and show the hover tooltip for a Prestige Tree node
 */
function showNodeTooltip(upg, nodeEl) {
  if (activeDragNode) return;
  const tooltip = document.getElementById('prestige-node-tooltip');
  if (!tooltip || !upg) return;

  const curLvl = getPrestigeUpgradeLevel(upg.id);
  const maxLvl = upg.maxLevel || 1;
  const isMaxed = curLvl >= maxLvl;
  const reqsMet = arePrestigeRequirementsMet(upg);
  const cost = getPrestigeUpgradeCost(upg);
  const currentPP = (state.prestige && typeof state.prestige.pp === 'number') ? state.prestige.pp : 0;
  const canAfford = !isMaxed && (currentPP + 1e-7 >= cost);

  const costText = isMaxed
    ? 'Max Level'
    : (cost === 0 ? 'Free' : `${formatPP(cost)} PP`);

  let reqNames = 'None';
  if (upg.requirements && upg.requirements.length > 0) {
    reqNames = upg.requirements
      .map((reqId) => {
        const reqUpg = getPrestigeUpgradeById(reqId);
        const name = reqUpg ? reqUpg.name : reqId;
        const met = isPrestigeUpgradePurchased(reqId);
        return `<span class="${met ? 'req-met' : 'req-missing'}">${name} ${met ? '✓' : '✗'}</span>`;
      })
      .join(', ');
  }

  let levelInfoHtml = '';
  if (maxLvl > 1) {
    const bonusRate = (upg.effects && typeof upg.effects.storingResourceBonus === 'number')
      ? upg.effects.storingResourceBonus
      : 0.50;
    const curBonus = bonusRate * curLvl * 100;
    const nextBonus = bonusRate * (curLvl + 1) * 100;
    levelInfoHtml = `
      <div class="prestige-tooltip-row">
        <span class="prestige-tooltip-label">Level:</span>
        <span class="prestige-tooltip-val font-semibold">${isMaxed ? `Level ${maxLvl}/${maxLvl} (MAX)` : `Level ${curLvl}/${maxLvl}`}</span>
      </div>
      <div class="prestige-tooltip-row">
        <span class="prestige-tooltip-label">Current Bonus:</span>
        <span class="prestige-tooltip-val ${curLvl > 0 ? 'text-owned' : ''}">+${curBonus.toFixed(0)}% dust & dirt on storing</span>
      </div>
      ${!isMaxed ? `
      <div class="prestige-tooltip-row">
        <span class="prestige-tooltip-label">Next Level:</span>
        <span class="prestige-tooltip-val text-affordable">+${nextBonus.toFixed(0)}% dust & dirt on storing</span>
      </div>` : ''}
    `;
  }

  let statusHtml = '';
  if (isMaxed) {
    statusHtml = `<div class="prestige-tooltip-status status-owned">✓ Max Level Reached</div>`;
  } else if (!reqsMet) {
    statusHtml = `<div class="prestige-tooltip-status status-locked">🔒 Locked — Prerequisite required</div>`;
  } else if (!canAfford) {
    statusHtml = `<div class="prestige-tooltip-status status-unaffordable">Need ${formatPP(cost - currentPP)} more PP</div>`;
  } else {
    statusHtml = `<div class="prestige-tooltip-status status-available">Click to ${curLvl > 0 ? `Upgrade (${curLvl + 1}/${maxLvl})` : 'Purchase'}</div>`;
  }

  tooltip.setAttribute('data-active-id', upg.id);
  tooltip.innerHTML = `
    <div class="prestige-tooltip-title">${upg.name} ${maxLvl > 1 ? `(${curLvl}/${maxLvl})` : ''}</div>
    <div class="prestige-tooltip-desc">${upg.description}</div>
    <div class="prestige-tooltip-meta">
      ${levelInfoHtml}
      <div class="prestige-tooltip-row">
        <span class="prestige-tooltip-label">Cost:</span>
        <span class="prestige-tooltip-cost ${isMaxed ? 'text-owned' : (canAfford ? 'text-affordable' : 'text-unaffordable')}">${costText}</span>
      </div>
      <div class="prestige-tooltip-row">
        <span class="prestige-tooltip-label">Requires:</span>
        <span class="prestige-tooltip-reqs">${reqNames}</span>
      </div>
    </div>
    ${statusHtml}
  `;

  tooltip.classList.remove('hidden');

  if (nodeEl) {
    const rect = nodeEl.getBoundingClientRect();
    const tooltipW = 270;
    let left = rect.left + rect.width * 0.5;
    let top = rect.bottom + 14;

    if (left - tooltipW * 0.5 < 16) left = tooltipW * 0.5 + 16;
    if (left + tooltipW * 0.5 > window.innerWidth - 16) left = window.innerWidth - tooltipW * 0.5 - 16;

    if (top + 175 > window.innerHeight - 20) {
      top = Math.max(16, rect.top - 180);
    }

    tooltip.style.left = `${left.toFixed(1)}px`;
    tooltip.style.top = `${top.toFixed(1)}px`;
  }
}

function hideNodeTooltip() {
  const tooltip = document.getElementById('prestige-node-tooltip');
  if (tooltip) {
    tooltip.classList.add('hidden');
    tooltip.removeAttribute('data-active-id');
  }
}

/**
 * Render the Prestige Tree nodes and white connecting bars from the configuration file
 */
export function renderPrestigeTree() {
  const canvasEl = document.getElementById('prestige-tree-canvas');
  const linksLayer = document.getElementById('prestige-links-layer');
  const nodesLayer = document.getElementById('prestige-nodes-layer');
  if (!canvasEl || !linksLayer || !nodesLayer) return;

  const upgrades = getPrestigeUpgrades();
  const sig = JSON.stringify(upgrades.map((u) => ({ id: u.id, req: u.requirements })));
  if (sig !== cachedLayoutSignature || cachedNodePositions.size === 0) {
    const layout = computePrestigeTreeLayout(upgrades, PRESTIGE_NODE_DIAMETER);
    cachedNodePositions = layout.nodes;
    cachedLayoutSignature = sig;
  }

  linksLayer.innerHTML = '';
  nodesLayer.innerHTML = '';
  activeTreeBars = [];

  const centerX = window.innerWidth * 0.5;
  const centerY = window.innerHeight * 0.46;

  // 1. Generate white connecting bars between prerequisites and dependents
  for (const upg of upgrades) {
    const targetPos = cachedNodePositions.get(upg.id);
    if (!targetPos || !upg.requirements) continue;

    for (const reqId of upg.requirements) {
      const sourcePos = cachedNodePositions.get(reqId);
      if (!sourcePos) continue;

      const barEl = document.createElement('div');
      barEl.className = 'prestige-connector-bar';
      barEl.setAttribute('data-from', reqId);
      barEl.setAttribute('data-to', upg.id);

      linksLayer.appendChild(barEl);
      activeTreeBars.push({ fromId: reqId, toId: upg.id, barEl });
    }
  }

  // 2. Generate draggable circular upgrade nodes with white titles over them and images/emojis inside
  for (const upg of upgrades) {
    const nodeState = cachedNodePositions.get(upg.id);
    if (!nodeState) continue;

    const x = centerX + nodeState.x;
    const y = centerY + nodeState.y;

    const nodeWrapper = document.createElement('div');
    nodeWrapper.className = 'prestige-node-wrapper';
    nodeWrapper.style.left = `${x.toFixed(1)}px`;
    nodeWrapper.style.top = `${y.toFixed(1)}px`;
    nodeWrapper.setAttribute('data-upgrade-id', upg.id);

    // White title over the circular node
    const titleEl = document.createElement('div');
    titleEl.className = 'prestige-node-title';
    titleEl.textContent = upg.name;

    // Circular node button
    const nodeBtn = document.createElement('button');
    nodeBtn.type = 'button';
    nodeBtn.className = 'prestige-node';
    nodeBtn.setAttribute('data-upgrade-id', upg.id);
    nodeBtn.setAttribute('aria-label', `${upg.name} - ${upg.description}`);
    nodeBtn.style.width = `${PRESTIGE_NODE_DIAMETER}px`;
    nodeBtn.style.height = `${PRESTIGE_NODE_DIAMETER}px`;

    nodeState.wrapperEl = nodeWrapper;
    nodeState.nodeBtn = nodeBtn;

    if (upg.image) {
      const img = document.createElement('img');
      img.className = 'prestige-node-img';
      img.src = upg.image;
      img.alt = upg.name;
      img.draggable = false;
      img.onerror = () => {
        img.style.display = 'none';
        const fallback = document.createElement('span');
        fallback.className = 'prestige-node-emoji';
        fallback.textContent = upg.emoji || '⭐';
        nodeBtn.appendChild(fallback);
      };
      nodeBtn.appendChild(img);
    } else {
      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'prestige-node-emoji';
      emojiSpan.textContent = upg.emoji || '⭐';
      nodeBtn.appendChild(emojiSpan);
    }

    if (upg.maxLevel > 1) {
      const levelBadge = document.createElement('span');
      levelBadge.className = 'prestige-node-level-badge';
      const curLvl = getPrestigeUpgradeLevel(upg.id);
      const isMaxed = curLvl >= upg.maxLevel;
      levelBadge.textContent = isMaxed ? 'MAX' : `${curLvl}/${upg.maxLevel}`;
      if (isMaxed) levelBadge.classList.add('is-maxed');
      nodeBtn.appendChild(levelBadge);
    }

    nodeBtn.addEventListener('pointerenter', () => {
      if (!activeDragNode) showNodeTooltip(upg, nodeBtn);
    });
    nodeBtn.addEventListener('pointerleave', () => {
      hideNodeTooltip();
    });
    nodeBtn.addEventListener('focus', () => {
      if (!activeDragNode) showNodeTooltip(upg, nodeBtn);
    });
    nodeBtn.addEventListener('blur', () => {
      hideNodeTooltip();
    });

    // Drag start on holding a bubble
    nodeBtn.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.stopPropagation();
      state.isLeftMouseDown = false;

      const cx = window.innerWidth * 0.5;
      const cy = window.innerHeight * 0.46;

      activeDragNode = nodeState;
      nodeState.isDragging = true;
      nodeState.vx = 0;
      nodeState.vy = 0;

      const currentScreenX = cx + treePanX + nodeState.x;
      const currentScreenY = cy + treePanY + nodeState.y;
      dragOffsetX = currentScreenX - e.clientX;
      dragOffsetY = currentScreenY - e.clientY;
      nodeState.targetX = nodeState.x;
      nodeState.targetY = nodeState.y;

      dragStartClientX = e.clientX;
      dragStartClientY = e.clientY;
      hasDraggedNode = false;

      nodeBtn.classList.add('is-dragging');
      try { nodeBtn.setPointerCapture?.(e.pointerId); } catch (err) {}

      startTreePhysicsLoop();
    });

    nodeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hasDraggedNode) {
        hasDraggedNode = false;
        return;
      }
      buyPrestigeUpgrade(upg.id);
    });

    nodeWrapper.appendChild(titleEl);
    nodeWrapper.appendChild(nodeBtn);
    nodesLayer.appendChild(nodeWrapper);
  }

  syncTreeDOMPositions();
  applyTreePanTransform();
  updatePrestigeTreeUI();
}

function applyTreePanTransform() {
  const canvasEl = document.getElementById('prestige-tree-canvas');
  if (canvasEl) {
    canvasEl.style.transform = `translate3d(${treePanX.toFixed(1)}px, ${treePanY.toFixed(1)}px, 0)`;
  }
}

/**
 * Update dynamic state classes, available PP display, and Prestige button in the Prestige Tree
 */
export function updatePrestigeTreeUI() {
  const ppValueEl = document.getElementById('prestige-available-pp');
  const prestigeConfirmBtn = document.getElementById('prestige-confirm-btn');
  const hudPpCard = document.getElementById('storage-pp-card');
  const hudPpValue = document.getElementById('storage-pp-value');

  const currentPP = (state.prestige && typeof state.prestige.pp === 'number') ? state.prestige.pp : 0;
  const currentRunDirt = getCurrentPrestigeDirtCleaned();
  const pendingPP = getPendingPrestigePP();
  const canPrestige = canPerformPrestige();

  if (ppValueEl) {
    ppValueEl.textContent = `${formatPP(currentPP)} PP`;
  }

  if (prestigeConfirmBtn) {
    if (canPrestige) {
      prestigeConfirmBtn.disabled = false;
      prestigeConfirmBtn.classList.remove('disabled');
      prestigeConfirmBtn.textContent = `Prestige (+${formatPP(pendingPP)} PP)`;
      prestigeConfirmBtn.title = `Prestige now to gain ${formatPP(pendingPP)} PP`;
    } else {
      prestigeConfirmBtn.disabled = true;
      prestigeConfirmBtn.classList.add('disabled');
      prestigeConfirmBtn.textContent = `Prestige (Need 10g Dirt: ${currentRunDirt.toFixed(1)}/10g)`;
      prestigeConfirmBtn.title = `Need at least 10g dirt collected in this prestige run to prestige`;
    }
  }

  if (hudPpCard && hudPpValue) {
    const treeUnlocked = isPrestigeTreeUnlocked();
    hudPpCard.classList.toggle('hidden', !treeUnlocked);
    hudPpValue.textContent = `${formatPP(currentPP)} PP`;
  }

  // Update node visual states
  const upgrades = getPrestigeUpgrades();
  for (const upg of upgrades) {
    const nodeBtn = document.querySelector(`.prestige-node[data-upgrade-id="${upg.id}"]`);
    if (!nodeBtn) continue;

    const curLvl = getPrestigeUpgradeLevel(upg.id);
    const maxLvl = upg.maxLevel || 1;
    const isMaxed = curLvl >= maxLvl;
    const reqsMet = arePrestigeRequirementsMet(upg);
    const cost = getPrestigeUpgradeCost(upg);
    const canAfford = !isMaxed && (currentPP + 1e-7 >= cost);

    const badgeEl = nodeBtn.querySelector('.prestige-node-level-badge');
    if (badgeEl && maxLvl > 1) {
      badgeEl.textContent = isMaxed ? 'MAX' : `${curLvl}/${maxLvl}`;
      badgeEl.classList.toggle('is-maxed', isMaxed);
    }

    nodeBtn.classList.toggle('is-purchased', isMaxed);
    nodeBtn.classList.toggle('is-available', !isMaxed && reqsMet && canAfford);
    nodeBtn.classList.toggle('is-unaffordable', !isMaxed && reqsMet && !canAfford);
    nodeBtn.classList.toggle('is-locked', !reqsMet);
  }

  // Update connector bar visual states
  const bars = document.querySelectorAll('.prestige-connector-bar');
  bars.forEach((bar) => {
    const fromId = bar.getAttribute('data-from');
    const toId = bar.getAttribute('data-to');
    const bothOwned = isPrestigeUpgradePurchased(fromId) && isPrestigeUpgradePurchased(toId);
    const fromOwned = isPrestigeUpgradePurchased(fromId);
    bar.classList.toggle('bar-purchased', bothOwned);
    bar.classList.toggle('bar-unlocked', fromOwned && !bothOwned);
  });
}

/**
 * Update visibility of the Prestige button in the main bottom dock and check 10g tt dirt unlock
 */
export function updatePrestigeButtonVisibility() {
  const prestigeDockBtn = document.getElementById('prestige-dock-btn');
  const reqMet = isPrestigeRequirementMet();
  const treeUnlocked = isPrestigeTreeUnlocked();

  if (reqMet && state.prestige && !state.prestige.treeUnlocked) {
    state.prestige.treeUnlocked = true;
    state.prestige.unlocked = true;
    if (!hasShownPrestigeUnlockToast && dom.toast && dom.toastText) {
      hasShownPrestigeUnlockToast = true;
      dom.toastText.textContent = '🔮 Prestige Unlocked! Open the Prestige Tree!';
      dom.toast.classList.remove('hidden');
      setTimeout(() => {
        dom.toast.classList.add('hidden');
      }, 3200);
    }
    saveGame();
  }

  if (prestigeDockBtn) {
    prestigeDockBtn.classList.toggle('hidden', !treeUnlocked);
    prestigeDockBtn.style.display = treeUnlocked ? 'flex' : 'none';
  }

  const hudPpCard = document.getElementById('storage-pp-card');
  const hudPpValue = document.getElementById('storage-pp-value');
  if (hudPpCard && hudPpValue) {
    hudPpCard.classList.toggle('hidden', !treeUnlocked);
    const currentPP = (state.prestige && typeof state.prestige.pp === 'number') ? state.prestige.pp : 0;
    hudPpValue.textContent = `${formatPP(currentPP)} PP`;
  }
}

/**
 * Open the full-screen Prestige Tree interface
 * Automatically unlocks "The Tree" for free on first access
 */
export function openPrestigeTree() {
  if (!isPrestigeTreeUnlocked()) return;

  if (state.isShopOpen) closeShop();
  if (state.isConfigsOpen) closeConfigsModal();

  state.isPrestigeTreeOpen = true;
  state.isLeftMouseDown = false;
  state.isRightMouseDown = false;

  // Automatically unlock The Tree for free on first access
  ensureFreeRootUpgradesUnlocked();

  const overlay = document.getElementById('prestige-tree-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }

  renderPrestigeTree();
  startTreePhysicsLoop();
}

export function closePrestigeTree() {
  state.isPrestigeTreeOpen = false;
  if (state.prestige) state.prestige.justPrestiged = false;
  state.isLeftMouseDown = false;
  state.isRightMouseDown = false;
  if (activeDragNode) {
    if (activeDragNode.nodeBtn) activeDragNode.nodeBtn.classList.remove('is-dragging');
    activeDragNode.isDragging = false;
    activeDragNode = null;
  }
  isPanningTree = false;
  if (treePhysicsRafId) {
    cancelAnimationFrame(treePhysicsRafId);
    treePhysicsRafId = null;
  }
  hideNodeTooltip();

  const overlay = document.getElementById('prestige-tree-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

export function togglePrestigeTree() {
  if (state.isPrestigeTreeOpen) {
    closePrestigeTree();
  } else {
    openPrestigeTree();
  }
}

/**
 * Initialize event listeners for the Prestige Tree interface & dock button
 */
export function initPrestigeListeners() {
  if (prestigeListenersInitialized) return;
  prestigeListenersInitialized = true;

  const prestigeDockBtn = document.getElementById('prestige-dock-btn');
  const cancelBtn = document.getElementById('prestige-cancel-btn');
  const confirmBtn = document.getElementById('prestige-confirm-btn');
  const overlay = document.getElementById('prestige-tree-overlay');

  if (prestigeDockBtn) {
    prestigeDockBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
    prestigeDockBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
    prestigeDockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
      togglePrestigeTree();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closePrestigeTree();
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      performPrestige();
    });
  }

  if (overlay) {
    overlay.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
      if (e.target && e.target.closest && e.target.closest('.prestige-node, button, .prestige-bottom-actions, .prestige-top-bar')) {
        return;
      }
      isPanningTree = true;
      panStartX = e.clientX - treePanX;
      panStartY = e.clientY - treePanY;
      hideNodeTooltip();
    });

    window.addEventListener('pointermove', (e) => {
      if (!state.isPrestigeTreeOpen) return;

      if (activeDragNode) {
        const moveDist = Math.hypot(e.clientX - dragStartClientX, e.clientY - dragStartClientY);
        if (moveDist > 5) {
          hasDraggedNode = true;
          hideNodeTooltip();
        }
        const cx = window.innerWidth * 0.5;
        const cy = window.innerHeight * 0.46;
        activeDragNode.targetX = (e.clientX + dragOffsetX) - cx - treePanX;
        activeDragNode.targetY = (e.clientY + dragOffsetY) - cy - treePanY;
        stepTreePhysics();
        startTreePhysicsLoop();
        return;
      }

      if (isPanningTree) {
        treePanX = e.clientX - panStartX;
        treePanY = e.clientY - panStartY;
        applyTreePanTransform();
      }
    });

    const endInteraction = (e) => {
      if (activeDragNode) {
        if (activeDragNode.nodeBtn) {
          activeDragNode.nodeBtn.classList.remove('is-dragging');
          try { activeDragNode.nodeBtn.releasePointerCapture?.(e.pointerId); } catch (err) {}
        }
        activeDragNode.isDragging = false;
        activeDragNode = null;
        startTreePhysicsLoop();
      }
      isPanningTree = false;
    };

    window.addEventListener('pointerup', endInteraction);
    window.addEventListener('pointercancel', endInteraction);

    window.addEventListener('resize', () => {
      if (state.isPrestigeTreeOpen) {
        syncTreeDOMPositions();
      }
    });
  }
}

// Expose Prestige helpers on Values for easy inspection and integration
Values.openPrestigeTree = openPrestigeTree;
Values.closePrestigeTree = closePrestigeTree;
Values.performPrestige = performPrestige;
Values.canPerformPrestige = canPerformPrestige;
Values.isPrestigeRequirementMet = isPrestigeRequirementMet;
Values.buyPrestigeUpgrade = buyPrestigeUpgrade;
Values.calculatePrestigePP = calculatePrestigePP;
Values.getPendingPrestigePP = getPendingPrestigePP;
Values.applyPrestigeEffects = applyPrestigeEffects;
Values.updatePrestigeButtonVisibility = updatePrestigeButtonVisibility;
Values.updatePrestigeTreeUI = updatePrestigeTreeUI;
Values.stepTreePhysics = stepTreePhysics;
Values.isPrestigeUnlocked = isPrestigeUnlocked;
Values.isPrestigeTreeUnlocked = isPrestigeTreeUnlocked;
Values.getPrestigeUpgrades = getPrestigeUpgrades;
Values.getPrestigeUpgradeById = getPrestigeUpgradeById;
Values.getPrestigeUpgradeLevel = getPrestigeUpgradeLevel;
Values.isPrestigeUpgradePurchased = isPrestigeUpgradePurchased;
Values.canPurchasePrestigeUpgrade = canPurchasePrestigeUpgrade;
Values.isPrestigeUpgradeMaxed = isPrestigeUpgradeMaxed;
Values.getPrestigeUpgradeCost = getPrestigeUpgradeCost;
Values.PRESTIGE_NODE_DIAMETER = PRESTIGE_NODE_DIAMETER;
Values.PRESTIGE_BAR_LENGTH = PRESTIGE_BAR_LENGTH;
Values.PRESTIGE_CENTER_LINK_DIST = PRESTIGE_CENTER_LINK_DIST;
Values.getCurrentPrestigeDirtCleaned = getCurrentPrestigeDirtCleaned;
Values.getCurrentPrestigeDustCollected = getCurrentPrestigeDustCollected;
Values.getTotalDirtCleaned = getTotalDirtCleaned;
Values.getTotalDustCollected = getTotalDustCollected;
