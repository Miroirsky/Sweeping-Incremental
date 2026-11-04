/**
 * Sweeping Incremental - Main Application Entry Point, Input Handling & Game Loop
 */

import { Values } from './data.js';
import './sound.js';
import {
  state,
  updateRoomGeometry,
  clampCleanerToPlayfield,
  isPlayerInStation,
  isDirtUnlocked
} from './state.js';
import {
  initWebGL,
  initTextures,
  updateDustTexture,
  updateDirtTexture,
  resizeCanvases,
  renderWebGL
} from './renderer.js';
import {
  spawnFloatingText,
  updateAndDrawParticles
} from './particles.js';
import {
  generateInstantDirt,
  getAutoVacuumRadius,
  syncAutoCleaners,
  updatePlayerAndRoomSimulation
} from './simulation.js';
import {
  dom,
  updateCarouselPositions,
  rotateCarouselByStep,
  getClosestCardToCenter,
  initShopUI,
  buyUpgrade,
  updateUpgradesAndShopUI,
  updateCapacityAndStorageUI,
  calculateCleanedPercentage,
  updateDirtShopVisibility,
  closeShop,
  toggleShop,
  fadeOutHint,
  initShopButtonListeners
} from './ui.js';
import {
  loadGame,
  handleResetRequest,
  initSettingsListeners,
  startAutoSave
} from './settings.js';

// --- Resize Handling ---
function onResize() {
  updateRoomGeometry();
  syncAutoCleaners();
  resizeCanvases();

  clampCleanerToPlayfield(state.cleanerPos, state.cleanerRadius);

  if (state.autoCleaners) {
    const curRadius = getAutoVacuumRadius();
    for (let i = 0; i < state.autoCleaners.length; i++) {
      const bot = state.autoCleaners[i];
      bot.radius = curRadius;
      clampCleanerToPlayfield(bot, bot.radius);
    }
  }

  updateCarouselPositions();
}

// --- Input Event Listeners ---
const UI_INTERACTIVE_SELECTOR = 'button, .menu-square-btn, .upgrade-card, .shop-cards-tray, .hud-top-right, .robot-storage-sidebar, .storage-center-right, [role="button"]';

function onMouseDown(e) {
  // Prevent vacuum movement/cleaning when clicking buttons, upgrade cards, or UI controls
  if (e.target && e.target.closest(UI_INTERACTIVE_SELECTOR)) {
    state.isLeftMouseDown = false;
    return;
  }

  if (e.button === 0) { // Left click: move
    state.isLeftMouseDown = true;
    state.mousePos.x = e.clientX;
    state.mousePos.y = e.clientY;

    if (!state.hasUserMovedMouse) {
      state.hasUserMovedMouse = true;
      fadeOutHint();
    }
    if (window.soundEngine) {
      window.soundEngine.resume();
    }
  } else if (e.button === 2) { // Right click: toggle clean mode (clean / don't clean)
    e.preventDefault();
    state.isRightMouseDown = !state.isRightMouseDown;
    state.mousePos.x = e.clientX;
    state.mousePos.y = e.clientY;

    if (!state.hasUserMovedMouse) {
      state.hasUserMovedMouse = true;
      fadeOutHint();
    }
    if (window.soundEngine) {
      window.soundEngine.resume();
      if (!state.isRightMouseDown && !state.isLeftMouseDown) {
        window.soundEngine.updateMovement(0);
      }
    }
  }
}

function onMouseUp(e) {
  if (e.button === 0) {
    state.isLeftMouseDown = false;
  }
  // Right click toggles clean mode (clean/don't clean), so mouseUp does not deactivate it
  if (!state.isLeftMouseDown && !state.isRightMouseDown && window.soundEngine) {
    window.soundEngine.updateMovement(0);
  }
}

function onMouseMove(e) {
  state.mousePos.x = e.clientX;
  state.mousePos.y = e.clientY;

  if (!state.hasUserMovedMouse && (state.isLeftMouseDown || state.isRightMouseDown)) {
    state.hasUserMovedMouse = true;
    fadeOutHint();
  }
}

function onTouchStart(e) {
  if (e.target && e.target.closest(UI_INTERACTIVE_SELECTOR)) {
    state.isLeftMouseDown = false;
    state.isRightMouseDown = false;
    return;
  }

  if (e.touches.length > 0) {
    const tx = e.touches[0].clientX;
    const ty = e.touches[0].clientY;

    state.isLeftMouseDown = true;
    state.isRightMouseDown = true; // On touch screen, single touch moves and cleans
    state.mousePos.x = tx;
    state.mousePos.y = ty;

    if (!state.hasUserMovedMouse) {
      state.hasUserMovedMouse = true;
      fadeOutHint();
    }
    if (window.soundEngine) {
      window.soundEngine.resume();
    }
  }
}

function onTouchMove(e) {
  if (e.touches.length > 0) {
    state.mousePos.x = e.touches[0].clientX;
    state.mousePos.y = e.touches[0].clientY;
  }
}

function onTouchEnd() {
  state.isLeftMouseDown = false;
  state.isRightMouseDown = false;
  if (window.soundEngine) {
    window.soundEngine.updateMovement(0);
  }
}

function initInputListeners() {
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
  window.addEventListener('blur', () => {
    state.isLeftMouseDown = false;
    state.isRightMouseDown = false;
    state.isSpaceHeld = false;
    if (window.soundEngine) window.soundEngine.updateMovement(0);
  });

  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });

  window.addEventListener('resize', onResize);

  // Keyboard Controls
  window.addEventListener('keydown', (e) => {
    if (state.isShopOpen) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        rotateCarouselByStep(-1);
        return;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        rotateCarouselByStep(1);
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const closest = getClosestCardToCenter();
        if (closest) {
          buyUpgrade(closest.key, state.currentShop);
        }
        return;
      }
    }

    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (Values.vacuum.stored > 0.0001 && !isPlayerInStation()) {
        spawnFloatingText('Go to Station to store!', state.cleanerPos.x, state.cleanerPos.y - state.cleanerRadius - 10, '#38bdf8');
      }
    } else if (e.key === 'e' || e.key === 'E' || e.key === 'b' || e.key === 'B') {
      toggleShop();
    } else if (e.key === 'Escape') {
      closeShop();
    } else if (e.key === 'm' || e.key === 'M') {
      if (dom.soundBtn) dom.soundBtn.click();
    } else if (e.key === 'r' || e.key === 'R') {
      handleResetRequest();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      state.isSpaceHeld = false;
    }
  });

  initShopButtonListeners();
  initSettingsListeners();
}

// --- Main Animation Loop ---
function render(time) {
  requestAnimationFrame(render);

  const now = performance.now();
  const dt = Math.min(0.08, (now - state.lastFrameTime) * 0.001);
  state.lastFrameTime = now;

  // Run player movement, vacuuming, dirt zones, dust reappearance & auto-cleaner simulation
  updatePlayerAndRoomSimulation(dt, now, updateCapacityAndStorageUI);

  // Update WebGL textures if modified
  if (state.dustTextureNeedsUpdate) {
    updateDustTexture();
    state.dustTextureNeedsUpdate = false;
  }
  if (state.dirtTextureNeedsUpdate) {
    updateDirtTexture();
    state.dirtTextureNeedsUpdate = false;
  }

  // Update Vacuum Canister and Storage Bar UI
  updateCapacityAndStorageUI();

  // Periodic Cleaned % Calculation (sampled at sampleIntervalMs)
  const sampleInterval = (Values.progress && Values.progress.sampleIntervalMs) || 250;
  if (time - state.lastSampleTime > sampleInterval) {
    state.lastSampleTime = time;
    calculateCleanedPercentage();
  }

  // WebGL Draw Call
  renderWebGL(time);

  // Overlay Canvas Draw (Leash, Robots, Station & Particles)
  updateAndDrawParticles(getAutoVacuumRadius());
}

// --- Bootstrap Game ---
function init() {
  initInputListeners();
  loadGame();

  state.cleanerAngle = Math.PI * 0.5;
  Values.cleanerAngle = state.cleanerAngle;
  updateRoomGeometry();
  if (!initWebGL()) return;
  initTextures();
  updateDirtShopVisibility();
  initShopUI();
  updateUpgradesAndShopUI();
  syncAutoCleaners();
  onResize();

  // Start vacuum in center of room
  state.cleanerPos.x = state.width * 0.5;
  state.cleanerPos.y = state.height * 0.5;
  state.prevCleanerPos.x = state.cleanerPos.x;
  state.prevCleanerPos.y = state.cleanerPos.y;
  state.mousePos.x = state.width * 0.5;
  state.mousePos.y = state.height * 0.5;

  calculateCleanedPercentage();
  if (isDirtUnlocked() && state.currentScreenDirtGrams < 0.1) {
    generateInstantDirt(updateCapacityAndStorageUI);
  }
  updateCapacityAndStorageUI();

  state.lastFrameTime = performance.now();

  // Auto-save every 2 seconds and on page hide/unload
  startAutoSave();

  // Start render loop
  requestAnimationFrame(render);
}

// Launch when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
