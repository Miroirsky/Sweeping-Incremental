/**
 * Sweeping Incremental - Save/Load Persistence, Game Reset & Audio/Settings Controls
 */

import { Values, SAVE_KEY } from './data.js';
import {
  state,
  stationStorage,
  updateRoomGeometry,
  randomizeDirtNoiseSeed
} from './state.js';
import { initTextures } from './renderer.js';
import {
  dom,
  closeShop,
  updateDirtShopVisibility,
  initShopUI,
  updateUpgradesAndShopUI,
  calculateCleanedPercentage,
  updateCapacityAndStorageUI,
  showResetToast,
  updateSoundUI,
  updateConfigsStatsUI,
  initConfigsListeners
} from './ui.js';

export function saveGame() {
  try {
    const upgradeLevels = {};
    if (Values.shops) {
      for (const shopKey of Object.keys(Values.shops)) {
        const shop = Values.shops[shopKey];
        if (!shop) continue;
        upgradeLevels[shopKey] = {};
        for (const upgKey of Object.keys(shop)) {
          const upg = shop[upgKey];
          if (upg && typeof upg.level === 'number') {
            upgradeLevels[shopKey][upgKey] = upg.level;
          }
        }
      }
    }

    const saveData = {
      version: 1,
      timestamp: Date.now(),
      storage: {
        dust: Number(Values.storage.dust) || 0,
        dirt: Number(Values.storage.dirt) || 0
      },
      vacuum: {
        storedDust: Number(Values.vacuum.storedDust) || 0,
        storedDirt: Number(Values.vacuum.storedDirt) || 0
      },
      station: {
        dust: Number(stationStorage.dust) || 0,
        dirt: Number(stationStorage.dirt) || 0
      },
      upgrades: upgradeLevels,
      milestones: Array.from(state.reachedMilestones),
      isMuted: !!(window.soundEngine && window.soundEngine.isMuted),
      volume: (window.soundEngine && typeof window.soundEngine.volume === 'number') ? window.soundEngine.volume : 0.6,
      stats: {
        totalDustCollected: Number(state.stats ? state.stats.totalDustCollected : 0) || 0,
        totalDirtCleaned: Number(state.stats ? state.stats.totalDirtCleaned : 0) || 0,
        totalDistanceTraveled: Number(state.stats ? state.stats.totalDistanceTraveled : 0) || 0,
        totalTimePlayed: Number(state.stats ? state.stats.totalTimePlayed : 0) || 0,
        totalStationUnloads: Number(state.stats ? state.stats.totalStationUnloads : 0) || 0,
        totalClicks: Number(state.stats ? state.stats.totalClicks : 0) || 0
      }
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  } catch (err) {
    console.warn('Could not save game to localStorage:', err);
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data) return false;

    // Restore storage
    if (data.storage) {
      Values.storage.dust = Math.max(0, Number(data.storage.dust) || 0);
      Values.storage.dirt = Math.max(0, Number(data.storage.dirt) || 0);
    }

    // Restore vacuum canister
    if (data.vacuum) {
      Values.vacuum.storedDust = Math.max(0, Number(data.vacuum.storedDust) || 0);
      Values.vacuum.storedDirt = Math.max(0, Number(data.vacuum.storedDirt) || 0);
      Values.vacuum.stored = (Values.vacuum.storedDust || 0) + (Values.vacuum.storedDirt || 0);
    }

    // Restore station
    if (data.station) {
      stationStorage.dust = Math.max(0, Number(data.station.dust) || 0);
      stationStorage.dirt = Math.max(0, Number(data.station.dirt) || 0);
    }

    // Restore upgrade levels
    if (data.upgrades && Values.shops) {
      for (const shopKey of Object.keys(data.upgrades)) {
        const savedShop = data.upgrades[shopKey];
        const currentShopData = Values.shops[shopKey];
        if (!savedShop || !currentShopData) continue;
        for (const upgKey of Object.keys(savedShop)) {
          const targetKey = (upgKey === 'suckZone' || upgKey === 'suck_zone') ? 'size' : upgKey;
          if (currentShopData[targetKey] && typeof savedShop[upgKey] === 'number') {
            currentShopData[targetKey].level = savedShop[upgKey];
          }
        }
      }
    }

    // Restore reached milestones
    if (Array.isArray(data.milestones)) {
      state.reachedMilestones.clear();
      for (const m of data.milestones) {
        state.reachedMilestones.add(m);
      }
    }

    // Restore audio volume and mute if saved
    if (typeof data.volume === 'number' && window.soundEngine && typeof window.soundEngine.setVolume === 'function') {
      window.soundEngine.setVolume(data.volume);
    }
    if (typeof data.isMuted === 'boolean' && window.soundEngine) {
      window.soundEngine.isMuted = data.isMuted;
      if (dom.soundIcon) dom.soundIcon.textContent = data.isMuted ? '🔇' : '🔊';
      if (dom.soundBtn) dom.soundBtn.title = data.isMuted ? 'Unmute Sound (M)' : 'Mute Sound (M)';
      if (dom.modalSoundIcon) dom.modalSoundIcon.textContent = data.isMuted ? '🔇' : '🔊';
      if (dom.modalSoundToggleText) dom.modalSoundToggleText.textContent = data.isMuted ? 'Sound: Muted' : 'Sound: Enabled';
    }
    if (dom.volumeSlider && window.soundEngine) {
      dom.volumeSlider.value = Math.round((window.soundEngine.volume || 0.6) * 100);
      if (dom.volumeVal) dom.volumeVal.textContent = `${dom.volumeSlider.value}%`;
    }

    // Restore statistics
    if (data.stats && state.stats) {
      state.stats.totalDustCollected = Math.max(0, Number(data.stats.totalDustCollected) || 0);
      state.stats.totalDirtCleaned = Math.max(0, Number(data.stats.totalDirtCleaned) || 0);
      state.stats.totalDistanceTraveled = Math.max(0, Number(data.stats.totalDistanceTraveled) || 0);
      state.stats.totalTimePlayed = Math.max(0, Number(data.stats.totalTimePlayed) || 0);
      state.stats.totalStationUnloads = Math.max(0, Number(data.stats.totalStationUnloads) || 0);
      state.stats.totalClicks = Math.max(0, Number(data.stats.totalClicks) || 0);
    }

    return true;
  } catch (err) {
    console.warn('Could not load game from localStorage:', err);
    return false;
  }
}

export function handleResetRequest() {
  state.isLeftMouseDown = false;
  const confirmed = window.confirm('Reset all game progress? This will reset all storage, bots, and upgrades.');
  if (confirmed) {
    resetGame();
  }
}

export function resetGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.warn('Could not remove save from localStorage:', e);
  }

  state.noiseOffset = [Math.random() * 100.0, Math.random() * 100.0];
  state.reachedMilestones.clear();
  if (state.stats) {
    state.stats.totalDustCollected = 0.0;
    state.stats.totalDirtCleaned = 0.0;
    state.stats.totalDistanceTraveled = 0.0;
    state.stats.totalTimePlayed = 0.0;
    state.stats.totalStationUnloads = 0;
    state.stats.totalClicks = 0;
  }
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

  stationStorage.dust = 0.0;
  stationStorage.dirt = 0.0;
  state.cleanerAngle = Math.PI * 0.5;
  Values.cleanerAngle = state.cleanerAngle;
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

  state.isSpaceHeld = false;
  state.isRightMouseDown = false;
  state.hadPlayedFullAlert = false;
  state.currentShop = 'dustShop';

  closeShop();
  updateDirtShopVisibility();
  initShopUI();
  updateUpgradesAndShopUI();
  calculateCleanedPercentage();
  updateCapacityAndStorageUI();
  updateSoundUI();
  updateConfigsStatsUI();

  if (window.soundEngine) {
    window.soundEngine.resume();
  }

  showResetToast();
}

export function initSettingsListeners() {
  const { soundBtn } = dom;

  if (soundBtn) {
    soundBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
    soundBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
      if (window.soundEngine) {
        window.soundEngine.resume();
        window.soundEngine.toggleMute();
        updateSoundUI();
        saveGame();
      }
    });
  }

  initConfigsListeners(handleResetRequest);
}

export function startAutoSave() {
  setInterval(saveGame, 2000);
  window.addEventListener('beforeunload', saveGame);
  window.addEventListener('pagehide', saveGame);
}

// Expose save, load, and reset on Values for console access
Values.saveGame = saveGame;
Values.loadGame = loadGame;
Values.resetGame = resetGame;
