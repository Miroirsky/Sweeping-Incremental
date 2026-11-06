/**
 * Sweeping Incremental - HUD, Notifications, Storage Indicators & Circular Shop Carousel UI
 */

import { Values, MILESTONES } from './data.js';
import {
  state,
  stationStorage,
  updateRoomGeometry,
  clampCleanerToPlayfield,
  getMaxVacuumCapacity,
  getMaxScreenDirt,
  getDirtRefillThreshold,
  getRoomDustCapacity,
  isStoringActionActive,
  isDirtUnlocked
} from './state.js';
import {
  generateInstantDirt,
  syncAutoCleaners
} from './simulation.js';
import { saveGame } from './settings.js';

// --- DOM Elements ---
export const dom = {
  dustIndicator: document.getElementById('dust-indicator'),
  dirtBadge: document.getElementById('dirt-badge'),
  dirtIndicator: document.getElementById('dirt-indicator'),
  robotStorageCard: document.getElementById('robot-storage-card'),
  robotStorageFillDust: document.getElementById('robot-storage-fill-dust'),
  robotStorageFillDirt: document.getElementById('robot-storage-fill-dirt'),
  robotStorageValue: document.getElementById('robot-storage-value'),
  robotDustText: document.getElementById('robot-dust-text'),
  robotDirtText: document.getElementById('robot-dirt-text'),
  storageDustCard: document.getElementById('storage-dust-card'),
  storageDirtCard: document.getElementById('storage-dirt-card'),
  storageDustValue: document.getElementById('storage-dust-value'),
  storageDirtValue: document.getElementById('storage-dirt-value'),
  soundBtn: document.getElementById('sound-btn'),
  soundIcon: document.getElementById('sound-icon'),
  resetBtn: document.getElementById('reset-btn') || document.getElementById('modal-reset-btn'),
  configBtn: document.getElementById('config-btn'),
  hintOverlay: document.getElementById('hint-overlay'),
  toast: document.getElementById('toast'),
  toastText: document.getElementById('toast-text'),

  // Configs Modal Elements
  configsModalOverlay: document.getElementById('configs-modal-overlay'),
  configsModalCard: document.getElementById('configs-modal-card'),
  configsCloseBtn: document.getElementById('configs-close-btn'),
  tabBtnStats: document.getElementById('tab-btn-stats'),
  tabBtnSettings: document.getElementById('tab-btn-settings'),
  paneStats: document.getElementById('pane-stats'),
  paneSettings: document.getElementById('pane-settings'),
  modalSoundToggleBtn: document.getElementById('modal-sound-toggle-btn'),
  modalSoundIcon: document.getElementById('modal-sound-icon'),
  modalSoundToggleText: document.getElementById('modal-sound-toggle-text'),
  volumeSlider: document.getElementById('sound-volume-slider'),
  volumeVal: document.getElementById('volume-val-badge'),
  modalResetBtn: document.getElementById('modal-reset-btn'),

  // Stat Elements
  statTotalDust: document.getElementById('stat-total-dust'),
  statTotalDustSub: document.getElementById('stat-total-dust-sub'),
  statTotalDirt: document.getElementById('stat-total-dirt'),
  statTotalDirtSub: document.getElementById('stat-total-dirt-sub'),
  statStorageDust: document.getElementById('stat-storage-dust'),
  statStorageDirt: document.getElementById('stat-storage-dirt'),
  statCleanGrade: document.getElementById('stat-clean-grade'),
  statCleanPercent: document.getElementById('stat-clean-percent'),
  statTimePlayed: document.getElementById('stat-time-played'),
  statBotCount: document.getElementById('stat-bot-count'),
  statBotSub: document.getElementById('stat-bot-sub'),
  statUpgradesBought: document.getElementById('stat-upgrades-bought'),
  statDistanceTraveled: document.getElementById('stat-distance-traveled'),
  statStationUnloads: document.getElementById('stat-station-unloads'),
  statTotalClicks: document.getElementById('stat-total-clicks'),
  statMitesEvicted: document.getElementById('stat-mites-evicted'),
  statBunniesPacified: document.getElementById('stat-bunnies-pacified'),

  // Shop Elements
  dustShopBtn: document.getElementById('dust-shop-btn') || document.getElementById('shop-btn'),
  dirtShopBtn: document.getElementById('dirt-shop-btn'),
  shopCardsTray: document.getElementById('shop-cards-tray'),
  carouselCardsViewport: document.getElementById('carousel-cards-viewport'),
  carouselPrevBtn: document.getElementById('carousel-prev-btn'),
  carouselNextBtn: document.getElementById('carousel-next-btn'),
  carouselScrollHint: document.getElementById('carousel-scroll-hint'),
  vacuumHubContainer: document.getElementById('vacuum-hub-container'),
  vacuumTopSprite: document.getElementById('vacuum-hub-img'),
  vacuumHubNotch: document.querySelector('.vacuum-hub-notch')
};

// --- Circular Upgrades Carousel State & Engine ---
let carouselAngle = 0;           // Continuous rotation angle around hub (radians)
let carouselAngleVelocity = 0;   // Velocity of rotation (radians/frame)
let carouselTargetAngle = 0;     // Target angle when rotating card to center
let isCenteringCard = false;     // True when animating to center a card
let carouselCards = [];          // [{ el, inner, lvlEl, effectEl, statEl, costEl, key, slotIndex, slotAngle }]
let carouselVisibleKeys = [];    // Visible upgrade keys in active shop
let carouselStepAngle = Math.PI / 6; // Angular distance between adjacent card slots
let lastClosestCard = null;      // Last centered card item (for click sound on switch)
let carouselIsDragging = false;
let carouselDragStartX = 0;
let carouselLastDragX = 0;
let carouselLastDragTime = 0;
let carouselHasDragged = false;
let carouselRafId = null;
let carouselHasInteracted = false;
let carouselEventsInitialized = false;

function normalizeAngle(rad) {
  let a = rad % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export function getClosestCardToCenter() {
  if (carouselCards.length === 0) return null;
  let closest = null;
  let minAbs = Infinity;
  for (let i = 0; i < carouselCards.length; i++) {
    const item = carouselCards[i];
    const norm = normalizeAngle(item.slotAngle + carouselAngle);
    const abs = Math.abs(norm);
    if (abs < minAbs) {
      minAbs = abs;
      closest = item;
    }
  }
  return closest;
}

function getCarouselRadii() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w * 0.5;
  const cy = h; // Center of vacuum circle at bottom edge of screen

  // Radius of vacuum circle (1/2 circle sticking out from bottom)
  const hubRadius = Math.min(w * 0.16, Math.max(120, h * 0.20));

  // Base card dimensions
  const cardWidth = Math.max(68, Math.min(115, w * 0.09, h * 0.13));
  const cardHeight = cardWidth * 1.5;

  // Radius from center of hub to center of cards
  const cardRadius = hubRadius + cardHeight * 0.52 + 12;

  return { cx, cy, hubRadius, cardRadius, cardWidth, cardHeight };
}

function dismissCarouselHint() {
  if (carouselHasInteracted) return;
  carouselHasInteracted = true;
  if (dom.carouselScrollHint) dom.carouselScrollHint.classList.add('faded');
}

export function updateCarouselPositions() {
  const viewport = dom.carouselCardsViewport || dom.shopCardsTray;
  if (!viewport || carouselCards.length === 0) return;

  const { cx, cy, hubRadius, cardRadius } = getCarouselRadii();

  // Update vacuum hub circle size
  if (dom.vacuumHubContainer) {
    const d = Math.round(hubRadius * 2);
    dom.vacuumHubContainer.style.width = `${d}px`;
    dom.vacuumHubContainer.style.height = `${d}px`;
  }

  // Robot sprite in vacuum circle rotates with carouselAngle
  if (dom.vacuumTopSprite) {
    const bobRotationDeg = 180 + (carouselAngle * 180 / Math.PI);
    dom.vacuumTopSprite.style.transform = `rotate(${bobRotationDeg.toFixed(2)}deg)`;
  }

  // Notch fixed at 12 o'clock center selection position
  if (dom.vacuumHubNotch) {
    dom.vacuumHubNotch.style.transform = `translate(-50%, -50%) translateY(-${(hubRadius - 2).toFixed(1)}px)`;
  }

  const closest = getClosestCardToCenter();

  // Audio tick when active card changes
  if (closest && closest !== lastClosestCard) {
    if (lastClosestCard && window.soundEngine && window.soundEngine.playPickContentSound) {
      window.soundEngine.playPickContentSound();
    }
    lastClosestCard = closest;
  }

  const minScale = 0.70;
  const maxScale = 1.25;

  carouselCards.forEach((item) => {
    const normAngle = normalizeAngle(item.slotAngle + carouselAngle);
    const absAngle = Math.abs(normAngle);

    // Hide cards that are below the horizontal horizon
    if (absAngle >= Math.PI * 0.50) {
      item.el.style.display = 'none';
      item.el.style.pointerEvents = 'none';
      return;
    }

    item.el.style.display = '';
    item.el.style.pointerEvents = 'auto';

    const cosVal = Math.cos(normAngle); // 0 at 90deg, 1 at center
    const centerFactor = Math.pow(Math.max(0, cosVal), 1.6);
    const scale = minScale + (maxScale - minScale) * centerFactor;

    const isMiddle = (item === closest);
    const radialDist = cardRadius + centerFactor * 16;
    const x = cx + Math.sin(normAngle) * radialDist;
    const y = cy - Math.cos(normAngle) * radialDist;
    const rotDeg = normAngle * (180 / Math.PI);

    const zIndex = isMiddle ? 100 : Math.round(20 + centerFactor * 70);
    const opacity = 0.45 + 0.55 * centerFactor;

    item.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${rotDeg.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    item.el.style.opacity = opacity.toFixed(2);
    item.el.style.zIndex = zIndex;

    item.el.classList.toggle('is-middle-card', isMiddle);
    item.el.setAttribute('aria-selected', isMiddle ? 'true' : 'false');
  });
}

function startCarouselLoop() {
  if (carouselRafId) return;
  function animLoop() {
    let keepRunning = false;

    if (isCenteringCard) {
      const diff = carouselTargetAngle - carouselAngle;
      if (Math.abs(diff) > 0.0006) {
        carouselAngle += diff * 0.18;
        keepRunning = true;
      } else {
        carouselAngle = carouselTargetAngle;
        isCenteringCard = false;
      }
      updateCarouselPositions();
    } else {
      if (Math.abs(carouselAngleVelocity) > 0.00008) {
        carouselAngle += carouselAngleVelocity;
        carouselAngleVelocity *= 0.88; // friction damping
        keepRunning = true;
        updateCarouselPositions();
      } else {
        carouselAngleVelocity = 0;
      }
    }

    if (keepRunning) {
      carouselRafId = requestAnimationFrame(animLoop);
    } else {
      carouselRafId = null;
      carouselAngle = carouselAngle % (2 * Math.PI);
      if (carouselAngle < 0) carouselAngle += 2 * Math.PI;
      updateCarouselPositions();
    }
  }
  carouselRafId = requestAnimationFrame(animLoop);
}

function rotateCardToCenter(item) {
  if (!item) return;
  dismissCarouselHint();
  const normAngle = normalizeAngle(item.slotAngle + carouselAngle);
  carouselTargetAngle = carouselAngle - normAngle;
  isCenteringCard = true;
  carouselAngleVelocity = 0;
  startCarouselLoop();
}

export function rotateCarouselByStep(direction) {
  if (!state.isShopOpen || carouselCards.length <= 1) return;
  dismissCarouselHint();
  const step = carouselStepAngle || (Math.PI / 6);
  carouselTargetAngle = carouselAngle - direction * step;
  isCenteringCard = true;
  carouselAngleVelocity = 0;
  startCarouselLoop();
}

export function initCarouselEvents() {
  const { shopCardsTray, carouselPrevBtn, carouselNextBtn } = dom;
  if (carouselEventsInitialized || !shopCardsTray) return;
  carouselEventsInitialized = true;

  // Mouse Wheel Scroll: continuous rotation without snapping
  shopCardsTray.addEventListener('wheel', (e) => {
    if (!state.isShopOpen || carouselCards.length <= 1) return;
    e.preventDefault();
    e.stopPropagation();
    state.isLeftMouseDown = false;
    dismissCarouselHint();

    const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
    if (Math.abs(delta) < 1) return;

    isCenteringCard = false;
    const scrollSensitivity = 0.0007;
    carouselAngleVelocity -= delta * scrollSensitivity;

    const maxVel = 0.12;
    carouselAngleVelocity = Math.max(-maxVel, Math.min(maxVel, carouselAngleVelocity));

    startCarouselLoop();
  }, { passive: false });

  // Pointer Drag across shop tray
  shopCardsTray.addEventListener('pointerdown', (e) => {
    if (!state.isShopOpen || carouselCards.length <= 1) return;
    if (e.target && e.target.closest('.carousel-nav-btn')) return;

    carouselIsDragging = true;
    carouselHasDragged = false;
    carouselDragStartX = e.clientX;
    carouselLastDragX = e.clientX;
    carouselLastDragTime = performance.now();
    carouselAngleVelocity = 0;
    isCenteringCard = false;
    dismissCarouselHint();

    try { shopCardsTray.setPointerCapture?.(e.pointerId); } catch (err) {}
  });

  shopCardsTray.addEventListener('pointermove', (e) => {
    if (!carouselIsDragging) return;
    const dx = e.clientX - carouselLastDragX;
    const totalDx = e.clientX - carouselDragStartX;
    const now = performance.now();
    const dt = Math.max(1, now - carouselLastDragTime);

    if (Math.abs(totalDx) > 6) {
      carouselHasDragged = true;
    }

    const dragSensitivity = 0.0032;
    const dAngle = dx * dragSensitivity;

    carouselAngle += dAngle;
    carouselAngleVelocity = (dAngle / dt) * 16.6;

    carouselLastDragX = e.clientX;
    carouselLastDragTime = now;

    updateCarouselPositions();
  });

  const endDrag = (e) => {
    if (!carouselIsDragging) return;
    carouselIsDragging = false;
    try { shopCardsTray.releasePointerCapture?.(e.pointerId); } catch (err) {}

    const maxVel = 0.12;
    carouselAngleVelocity = Math.max(-maxVel, Math.min(maxVel, carouselAngleVelocity));
    startCarouselLoop();
  };

  shopCardsTray.addEventListener('pointerup', endDrag);
  shopCardsTray.addEventListener('pointercancel', endDrag);

  // Prev & Next Buttons
  if (carouselPrevBtn) {
    carouselPrevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
      rotateCarouselByStep(-1);
    });
    carouselPrevBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
  }

  if (carouselNextBtn) {
    carouselNextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
      rotateCarouselByStep(1);
    });
    carouselNextBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
  }
}

// Dynamic Cards Shop Rendering & Updates (Dust Shop & Dirt Shop)
export function initShopUI(keyToCenter) {
  const { shopCardsTray, carouselCardsViewport } = dom;
  if (!shopCardsTray) return;
  const viewport = carouselCardsViewport || shopCardsTray;
  viewport.innerHTML = '';

  const currentShop = state.currentShop;
  const shopData = (Values.shops && Values.shops[currentShop]) ? Values.shops[currentShop] : Values.shops.dustShop;
  const isDirtShop = (currentShop === 'dirtShop');
  const currentFunds = isDirtShop ? (Values.storage.dirt || 0) : (Values.storage.dust || 0);

  const prevClosestKey = keyToCenter || (getClosestCardToCenter() ? getClosestCardToCenter().key : null);
  carouselCards = [];

  const keys = Object.keys(shopData);
  const visibleKeys = keys.filter((key) => {
    const upg = shopData[key];
    return !(Values.isUpgradeVisible && !Values.isUpgradeVisible(upg));
  });

  carouselVisibleKeys = visibleKeys;
  const N = visibleKeys.length;
  if (N === 0) return;

  // Number of repetitions around full 360 circle (so cards seamlessly repeat)
  const k = Math.max(2, Math.ceil(12 / N));
  const totalSlots = k * N;
  const stepAngle = (2 * Math.PI) / totalSlots;
  carouselStepAngle = stepAngle;

  for (let j = 0; j < totalSlots; j++) {
    const keyIndex = j % N;
    const key = visibleKeys[keyIndex];
    const upg = shopData[key];
    const cost = Values.getUpgradeCost(key, currentShop);
    const canAfford = currentFunds >= cost;
    const isMaxed = upg.isUnlock ? (upg.level >= 1) : (upg.maxLevel ? (upg.level >= upg.maxLevel) : false);

    const cardEl = document.createElement('div');
    cardEl.className = `upgrade-card ${isMaxed ? 'is-owned can-afford' : (canAfford ? 'can-afford' : 'cannot-afford')}`;
    cardEl.setAttribute('data-key', key);
    cardEl.setAttribute('data-shop', currentShop);
    cardEl.setAttribute('data-slot', j);
    cardEl.setAttribute('role', 'button');
    cardEl.setAttribute('tabindex', '0');
    cardEl.setAttribute('title', `Buy ${upg.name || key}`);

    cardEl.innerHTML = `
      <div class="card-inner">
        <img class="card-img" src="${upg.image || ''}" alt="${upg.name || key}" draggable="false" />
        <div class="card-top-bar">
          <div class="card-top-header">
            <span class="card-lvl-badge">${upg.isUnlock ? (upg.level >= 1 ? 'UNLOCKED' : 'LOCKED') : (upg.maxLevel ? `LVL ${upg.level}/${upg.maxLevel}` : `LVL ${upg.level}`)}</span>
            <span class="card-effect-desc">${upg.getEffect ? upg.getEffect(upg) : ''}</span>
          </div>
          <div class="card-effect-row">
            <span class="card-stat-label">Actual:</span>
            <span class="card-stat-val">${upg.getStat ? upg.getStat(upg) : ''}</span>
          </div>
        </div>
        <div class="card-price-overlay">
          <span class="card-price-val">${isMaxed ? 'MAX' : `${cost >= 100 ? cost.toFixed(0) : (cost % 1 === 0 ? cost.toFixed(0) : cost.toFixed(2))}g`}</span>
        </div>
      </div>
    `;

    const cardInner = cardEl.querySelector('.card-inner');
    const lvlEl = cardEl.querySelector('.card-lvl-badge');
    const effectEl = cardEl.querySelector('.card-effect-desc');
    const statEl = cardEl.querySelector('.card-stat-val');
    const costEl = cardEl.querySelector('.card-price-val');

    const slotAngle = j * stepAngle;

    const item = {
      el: cardEl,
      inner: cardInner,
      lvlEl,
      effectEl,
      statEl,
      costEl,
      key,
      slotIndex: j,
      slotAngle
    };

    // Prevent bot from moving when interacting with upgrade cards
    cardEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
    cardEl.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });

    // Interactive 3D tilt & follow mouse on hover ONLY on the closest card
    cardEl.addEventListener('pointermove', (e) => {
      if (!cardEl.classList.contains('is-middle-card')) return;
      const rect = cardEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const percentX = ((x / rect.width) - 0.5) * 2;
      const percentY = ((y / rect.height) - 0.5) * 2;

      const rotX = (percentY * 10).toFixed(2);
      const rotY = (-percentX * 10).toFixed(2);
      const moveX = (percentX * 6).toFixed(2);
      const moveY = (percentY * 6 - 8).toFixed(2);

      cardInner.style.transform = `perspective(700px) translate3d(${moveX}px, ${moveY}px, 0) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.05)`;
      cardInner.style.filter = `drop-shadow(${-percentX * 10}px ${16 - percentY * 6}px 24px rgba(0, 0, 0, 0.75))`;
    });

    cardEl.addEventListener('pointerleave', () => {
      cardInner.style.transform = '';
      cardInner.style.filter = '';
    });

    // Click card: buy ONLY if closest to center! Otherwise center it!
    cardEl.addEventListener('click', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
      if (carouselHasDragged) return;
      dismissCarouselHint();

      const closest = getClosestCardToCenter();
      if (item === closest) {
        buyUpgrade(item.key, state.currentShop);
      } else {
        rotateCardToCenter(item);
      }
    });

    cardEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        state.isLeftMouseDown = false;
        const closest = getClosestCardToCenter();
        if (item === closest) {
          buyUpgrade(item.key, state.currentShop);
        } else {
          rotateCardToCenter(item);
        }
      }
    });

    viewport.appendChild(cardEl);
    carouselCards.push(item);
  }

  // Align carouselAngle so target card is centered
  if (prevClosestKey) {
    const matchIdx = visibleKeys.indexOf(prevClosestKey);
    if (matchIdx !== -1) {
      carouselAngle = -matchIdx * stepAngle;
    }
  } else {
    carouselAngle = 0;
  }
  carouselAngleVelocity = 0;
  isCenteringCard = false;

  initCarouselEvents();
  updateCarouselPositions();
}

export function buyUpgrade(key, shopKey) {
  state.isLeftMouseDown = false;
  const targetShop = shopKey || state.currentShop;
  const shopData = (Values.shops && Values.shops[targetShop]) ? Values.shops[targetShop] : (Values.shops.dustShop[key] ? Values.shops.dustShop : Values.shops.dirtShop);
  const upg = shopData ? shopData[key] : null;
  if (!upg) return;

  // Only allow buying the card closer to center
  const closest = getClosestCardToCenter();
  if (closest && closest.key !== key) {
    return;
  }

  if (upg.isUnlock && upg.level >= 1) return; // already unlocked
  if (upg.maxLevel && upg.level >= upg.maxLevel) return; // already maxed

  const cost = Values.getUpgradeCost(key, targetShop);
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
      generateInstantDirt(updateCapacityAndStorageUI);
    }

    // When More Dust upgrade is bought, scale existing dust on the floor to the new density!
    if (key === 'moreDust' || key === 'MoreDust' || key === 'moredust') {
      const prevLvl = upg.level - 1;
      const oldMult = 1.0 + prevLvl * 0.3;
      const newMult = 1.0 + upg.level * 0.3;
      const factor = newMult / oldMult;
      for (let i = 0; i < state.TOTAL_PIXELS; i++) {
        if (state.dustGrid[i] > 0) {
          state.dustGrid[i] *= factor;
        }
      }
      state.currentScreenDustGrams *= factor;
      state.dustTextureNeedsUpdate = true;
    }

    // Sync active auto-cleaners and open station when autoCleaner upgrade is bought
    updateRoomGeometry();
    clampCleanerToPlayfield(state.cleanerPos, state.cleanerRadius);
    syncAutoCleaners();

    updateDirtShopVisibility();

    // Check if visible upgrade set changed (new unlock)
    const currentVisibleKeys = Object.keys(shopData).filter((k) => !(Values.isUpgradeVisible && !Values.isUpgradeVisible(shopData[k])));
    const prevCount = carouselVisibleKeys ? carouselVisibleKeys.length : 0;
    if (currentVisibleKeys.length !== prevCount) {
      initShopUI(key);
    } else {
      updateUpgradesAndShopUI();
    }

    updateCapacityAndStorageUI();
    if (window.soundEngine) window.soundEngine.playPurchaseSound();
    saveGame();

    // Trigger purchase animation on the active center card
    if (closest && closest.inner) {
      closest.inner.classList.remove('purchased-anim', 'shake-anim');
      void closest.inner.offsetWidth; // reflow
      closest.inner.classList.add('purchased-anim');
    }
  } else {
    // Not enough funds: shake animation
    if (closest && closest.inner) {
      closest.inner.classList.remove('purchased-anim', 'shake-anim');
      void closest.inner.offsetWidth;
      closest.inner.classList.add('shake-anim');
    }
  }
}

// Update Card UI with dynamic level, effect and hover price
export function updateUpgradesAndShopUI() {
  const currentShop = state.currentShop;
  const shopData = (Values.shops && Values.shops[currentShop]) ? Values.shops[currentShop] : Values.shops.dustShop;
  const isDirtShop = (currentShop === 'dirtShop');
  const currentFunds = isDirtShop ? (Values.storage.dirt || 0) : (Values.storage.dust || 0);

  carouselCards.forEach((item) => {
    const key = item.key;
    const upg = shopData ? shopData[key] : null;
    if (!upg) return;

    const cost = Values.getUpgradeCost(key, currentShop);
    const canAfford = currentFunds >= cost;
    const isMaxed = upg.isUnlock ? (upg.level >= 1) : (upg.maxLevel ? (upg.level >= upg.maxLevel) : false);

    item.el.classList.toggle('is-owned', isMaxed);
    if (isMaxed) {
      item.el.classList.remove('cannot-afford');
      item.el.classList.add('can-afford');
    } else {
      item.el.classList.toggle('can-afford', canAfford);
      item.el.classList.toggle('cannot-afford', !canAfford);
    }

    if (item.lvlEl) {
      item.lvlEl.textContent = upg.isUnlock ? (isMaxed ? 'UNLOCKED' : 'LOCKED') : (upg.maxLevel ? `LVL ${upg.level}/${upg.maxLevel}` : `LVL ${upg.level}`);
    }
    if (item.effectEl && upg.getEffect) {
      item.effectEl.textContent = upg.getEffect(upg);
    }
    if (item.statEl && upg.getStat) {
      item.statEl.textContent = upg.getStat(upg);
    }
    if (item.costEl) {
      item.costEl.textContent = isMaxed ? (upg.isUnlock ? 'OWNED' : 'MAX') : `${cost >= 100 ? cost.toFixed(0) : (cost % 1 === 0 ? cost.toFixed(0) : cost.toFixed(2))}g`;
    }
  });

  if (dom.dustShopBtn) {
    dom.dustShopBtn.classList.toggle('active-shop', state.isShopOpen && currentShop === 'dustShop');
  }
  if (dom.dirtShopBtn) {
    dom.dirtShopBtn.classList.toggle('active-shop', state.isShopOpen && currentShop === 'dirtShop');
  }
}

// Update Robot Storage (Grey for Dust, Brown for Dirt) and Main Storage UI
export function updateCapacityAndStorageUI() {
  const {
    robotStorageCard,
    robotStorageValue,
    robotStorageFillDust,
    robotStorageFillDirt,
    robotDustText,
    robotDirtText,
    storageDustValue,
    storageDirtValue,
    storageDustCard,
    storageDirtCard,
    dirtIndicator,
    dirtBadge
  } = dom;

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
    const isDustTransferActive = isStoringActionActive() && (storedDust > 0.0001);
    storageDustCard.classList.toggle('receiving', isDustTransferActive);
  }
  if (storageDirtCard) {
    const isDirtTransferActive = isStoringActionActive() && (storedDirt > 0.0001);
    storageDirtCard.classList.toggle('receiving', isDirtTransferActive);
  }

  // Dirt on Screen Indicator (Top Right)
  const maxDirt = getMaxScreenDirt();
  const requiredDust = Math.min(getRoomDustCapacity(), maxDirt);
  const isWaitingForDust = isDirtUnlocked() && (state.currentScreenDirtGrams < getDirtRefillThreshold()) && (state.currentScreenDustGrams < requiredDust - 0.5);

  if (dirtIndicator) {
    if (state.currentScreenDirtGrams >= maxDirt - 0.05) {
      dirtIndicator.textContent = `Dirt: ${maxDirt.toFixed(0)} / ${maxDirt.toFixed(0)}g (MAX)`;
    } else if (isWaitingForDust) {
      dirtIndicator.textContent = `Dirt: ${state.currentScreenDirtGrams.toFixed(1)} / ${maxDirt.toFixed(0)}g (Waiting for dust...)`;
    } else {
      dirtIndicator.textContent = `Dirt: ${state.currentScreenDirtGrams.toFixed(1)} / ${maxDirt.toFixed(0)}g`;
    }
  }
  if (dirtBadge) {
    dirtBadge.classList.toggle('active', state.currentScreenDirtGrams > 0.1);
    dirtBadge.title = `Dirt on Screen (Capped at ${maxDirt.toFixed(0)}g)`;
  }

  if (typeof Values.updatePrestigeButtonVisibility === 'function') {
    Values.updatePrestigeButtonVisibility();
  }
  if (state.isPrestigeTreeOpen && typeof Values.updatePrestigeTreeUI === 'function') {
    Values.updatePrestigeTreeUI();
  }

  updateUpgradesAndShopUI();
}

// Calculate percentage and grams of cleaned dust within the square room
export function calculateCleanedPercentage() {
  let remainingDustGrams = 0;
  for (let i = 0; i < state.TOTAL_PIXELS; i++) {
    remainingDustGrams += state.dustGrid[i];
  }
  state.currentScreenDustGrams = remainingDustGrams;

  const totalCapacity = getRoomDustCapacity();
  const gramsCleared = Math.max(0, totalCapacity - remainingDustGrams);
  const pct = Math.min(100, (gramsCleared / totalCapacity) * 100);
  state.cleanedPercent = pct;

  if (dom.dustIndicator) {
    dom.dustIndicator.textContent = `Dust Cleared: ${gramsCleared.toFixed(1)}g [${pct.toFixed(1)}%]`;
  }

  const milestones = (Values.progress && Values.progress.milestones) ? Values.progress.milestones : MILESTONES;
  for (const milestone of milestones) {
    if (pct >= milestone && !state.reachedMilestones.has(milestone)) {
      state.reachedMilestones.add(milestone);
      showMilestoneToast(milestone);
      if (window.soundEngine) {
        window.soundEngine.playMilestone();
      }
      break;
    }
  }
}

export function showMilestoneToast(milestone) {
  if (!dom.toast || !dom.toastText) return;
  if (milestone === 100) {
    dom.toastText.textContent = '🏆 100% Spotless Room! Perfection!';
  } else {
    dom.toastText.textContent = `✨ ${milestone}% of the Room Cleaned!`;
  }
  dom.toast.classList.remove('hidden');
  setTimeout(() => {
    dom.toast.classList.add('hidden');
  }, 3200);
}

export function showResetToast() {
  if (dom.toast && dom.toastText) {
    dom.toastText.textContent = '🔄 Game progress reset!';
    dom.toast.classList.remove('hidden');
    setTimeout(() => {
      dom.toast.classList.add('hidden');
    }, 3000);
  }
}

export function fadeOutHint() {
  if (dom.hintOverlay) {
    dom.hintOverlay.classList.add('fade-out');
  }
}

// Dirt Shop visibility helper (only displayed when Dirt is unlocked)
export function updateDirtShopVisibility() {
  if (!dom.dirtShopBtn) return;
  const isUnlocked = isDirtUnlocked();
  dom.dirtShopBtn.classList.toggle('hidden', !isUnlocked);
  dom.dirtShopBtn.style.display = isUnlocked ? 'flex' : 'none';
}

// Shop Management & Cards Tray (Supports Dust Shop and Dirt Shop)
export function openShop(shopKey) {
  if (shopKey === 'dirtShop' && !isDirtUnlocked()) {
    return; // Cannot open Dirt Shop until Dirt is unlocked!
  }
  const prevShop = state.currentShop;
  if (shopKey) state.currentShop = shopKey;
  state.isShopOpen = true;
  document.body.classList.add('shop-open');
  document.body.classList.toggle('dirt-shop-active', state.currentShop === 'dirtShop');
  document.body.classList.toggle('dust-shop-active', state.currentShop === 'dustShop');
  if (dom.shopCardsTray) {
    dom.shopCardsTray.classList.remove('hidden');
  }
  if (prevShop !== state.currentShop) {
    carouselAngle = 0;
    carouselTargetAngle = 0;
    carouselAngleVelocity = 0;
    isCenteringCard = false;
  }
  updateDirtShopVisibility();
  initShopUI();
  updateUpgradesAndShopUI();
}

export function closeShop() {
  if (!state.isShopOpen) return;
  state.isShopOpen = false;
  document.body.classList.remove('shop-open', 'dirt-shop-active', 'dust-shop-active');
  if (dom.shopCardsTray) {
    dom.shopCardsTray.classList.add('hidden');
  }
  if (carouselRafId) {
    cancelAnimationFrame(carouselRafId);
    carouselRafId = null;
  }
  updateDirtShopVisibility();
  updateUpgradesAndShopUI();
}

export function toggleShop(targetShop) {
  state.isLeftMouseDown = false;
  if (targetShop === 'dirtShop' && !isDirtUnlocked()) {
    return;
  }
  if (targetShop) {
    if (state.isShopOpen && state.currentShop === targetShop) {
      closeShop();
    } else {
      openShop(targetShop);
    }
  } else {
    if (state.isShopOpen) {
      closeShop();
    } else {
      if (state.currentShop === 'dirtShop' && !isDirtUnlocked()) {
        state.currentShop = 'dustShop';
      }
      openShop(state.currentShop);
    }
  }
}

export function initShopButtonListeners() {
  const { dustShopBtn, dirtShopBtn } = dom;
  if (dustShopBtn) {
    dustShopBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
    dustShopBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
    dustShopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
      toggleShop('dustShop');
    });
  }

  if (dirtShopBtn) {
    dirtShopBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
    dirtShopBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
    dirtShopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
      toggleShop('dirtShop');
    });
  }
}

// --- Configurations & Statistics Functions ---

export function getTotalDustCollected() {
  const currentDust = (Values.storage.dust || 0) + (Values.vacuum.storedDust || 0) + (stationStorage ? stationStorage.dust : 0);
  const tracked = (state.stats && typeof state.stats.totalDustCollected === 'number') ? state.stats.totalDustCollected : 0;
  return Math.max(tracked, currentDust);
}

export function getTotalDirtCleaned() {
  const currentDirt = (Values.storage.dirt || 0) + (Values.vacuum.storedDirt || 0) + (stationStorage ? stationStorage.dirt : 0);
  const tracked = (state.stats && typeof state.stats.totalDirtCleaned === 'number') ? state.stats.totalDirtCleaned : 0;
  return Math.max(tracked, currentDirt);
}

export function getCurrentPrestigeDirtCleaned() {
  const tracked = (state.currentPrestigeStats && typeof state.currentPrestigeStats.totalDirtCleaned === 'number')
    ? state.currentPrestigeStats.totalDirtCleaned
    : 0;
  const currentDirt = (Values.storage.dirt || 0) + (Values.vacuum.storedDirt || 0) + (stationStorage ? stationStorage.dirt : 0);
  return Math.max(tracked, currentDirt);
}

export function getCurrentPrestigeDustCollected() {
  const tracked = (state.currentPrestigeStats && typeof state.currentPrestigeStats.totalDustCollected === 'number')
    ? state.currentPrestigeStats.totalDustCollected
    : 0;
  const currentDust = (Values.storage.dust || 0) + (Values.vacuum.storedDust || 0) + (stationStorage ? stationStorage.dust : 0);
  return Math.max(tracked, currentDust);
}

export function getTotalUpgradesBought() {
  let count = 0;
  if (Values.shops) {
    for (const sKey of Object.keys(Values.shops)) {
      const s = Values.shops[sKey];
      if (s) {
        for (const uKey of Object.keys(s)) {
          const u = s[uKey];
          if (u && typeof u.level === 'number') count += u.level;
        }
      }
    }
  }
  return count;
}

function formatGrams(g) {
  const val = Number(g) || 0;
  if (val >= 1000) {
    return `${(val / 1000).toFixed(2)} kg`;
  }
  return `${val.toFixed(1)}g`;
}

function formatPlaytime(totalSeconds) {
  const sec = Math.floor(totalSeconds % 60);
  const min = Math.floor((totalSeconds / 60) % 60);
  const hrs = Math.floor(totalSeconds / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hrs)}:${pad(min)}:${pad(sec)}`;
}

function getCleanlinessGrade(percent) {
  if (percent >= 99.5) return '✨ SSS - Sterile Lab';
  if (percent >= 90) return '🌟 SS - Pristine Showroom';
  if (percent >= 75) return '⭐ S - Sparkly Clean';
  if (percent >= 50) return '👍 A - Very Tidy';
  if (percent >= 25) return '🧹 B - In Progress';
  return '🕸️ C - Dusty Attic';
}

export function updateSoundUI() {
  const isMuted = !window.soundEngine || window.soundEngine.isMuted;
  const currentVol = (window.soundEngine && typeof window.soundEngine.volume === 'number') ? window.soundEngine.volume : 0.6;

  if (dom.soundIcon) dom.soundIcon.textContent = isMuted ? '🔇' : '🔊';
  if (dom.soundBtn) dom.soundBtn.title = isMuted ? 'Unmute Sound (M)' : 'Mute Sound (M)';

  if (dom.modalSoundIcon) dom.modalSoundIcon.textContent = isMuted ? '🔇' : '🔊';
  if (dom.modalSoundToggleText) dom.modalSoundToggleText.textContent = isMuted ? 'Sound: Muted' : 'Sound: Enabled';

  if (dom.volumeSlider) {
    dom.volumeSlider.value = Math.round(currentVol * 100);
  }
  if (dom.volumeVal) {
    dom.volumeVal.textContent = `${Math.round(currentVol * 100)}%`;
  }
}

export function updateConfigsStatsUI() {
  if (!state.isConfigsOpen) return;

  const totalDust = getTotalDustCollected();
  const totalDirt = getTotalDirtCleaned();
  const currentPrestigeDirt = getCurrentPrestigeDirtCleaned();

  if (dom.statTotalDust) dom.statTotalDust.textContent = formatGrams(totalDust);
  if (dom.statTotalDustSub) dom.statTotalDustSub.textContent = `${(totalDust / 1000).toFixed(3)} kg all-time`;

  if (dom.statTotalDirt) dom.statTotalDirt.textContent = formatGrams(totalDirt);
  if (dom.statTotalDirtSub) {
    dom.statTotalDirtSub.textContent = `${(totalDirt / 1000).toFixed(3)} kg all-time (${formatGrams(currentPrestigeDirt)} this run)`;
  }

  if (dom.statStorageDust) dom.statStorageDust.textContent = formatGrams(Values.storage.dust || 0);
  if (dom.statStorageDirt) dom.statStorageDirt.textContent = formatGrams(Values.storage.dirt || 0);

  const cleanPct = state.cleanedPercent || 0;
  if (dom.statCleanGrade) dom.statCleanGrade.textContent = getCleanlinessGrade(cleanPct);
  if (dom.statCleanPercent) dom.statCleanPercent.textContent = `${cleanPct.toFixed(1)}% Floor Cleared`;

  const timePlayed = (state.stats && state.stats.totalTimePlayed) || 0;
  if (dom.statTimePlayed) dom.statTimePlayed.textContent = formatPlaytime(timePlayed);

  const botFleetCount = (state.autoCleaners ? state.autoCleaners.length : 0);
  if (dom.statBotCount) dom.statBotCount.textContent = `${botFleetCount + 1} Cleaner${botFleetCount > 0 ? 's' : ''}`;
  if (dom.statBotSub) dom.statBotSub.textContent = `1 Master + ${botFleetCount} Auto Bot${botFleetCount !== 1 ? 's' : ''}`;

  if (dom.statUpgradesBought) dom.statUpgradesBought.textContent = `${getTotalUpgradesBought()} purchased`;

  const distPx = (state.stats && state.stats.totalDistanceTraveled) || 0;
  const distMeters = distPx / 100; // ~100px per meter
  if (dom.statDistanceTraveled) {
    dom.statDistanceTraveled.textContent = distMeters >= 1000 ? `${(distMeters / 1000).toFixed(2)} km` : `${distMeters.toFixed(1)} m`;
  }

  const unloads = (state.stats && state.stats.totalStationUnloads) || 0;
  if (dom.statStationUnloads) dom.statStationUnloads.textContent = `${unloads} time${unloads !== 1 ? 's' : ''}`;

  const clicks = (state.stats && state.stats.totalClicks) || 0;
  if (dom.statTotalClicks) dom.statTotalClicks.textContent = `${clicks} click${clicks !== 1 ? 's' : ''}`;

  const mites = Math.floor(totalDust * 1250);
  if (dom.statMitesEvicted) dom.statMitesEvicted.textContent = `${mites.toLocaleString()} evicted`;

  const bunnies = Math.floor(totalDust * 3.4);
  if (dom.statBunniesPacified) dom.statBunniesPacified.textContent = `${bunnies.toLocaleString()} pacified`;
}

export function switchConfigsTab(tabName) {
  if (!dom.paneStats || !dom.paneSettings) return;

  if (tabName === 'settings') {
    dom.paneStats.classList.remove('active');
    dom.paneSettings.classList.add('active');
    if (dom.tabBtnStats) dom.tabBtnStats.classList.remove('active');
    if (dom.tabBtnSettings) dom.tabBtnSettings.classList.add('active');
  } else {
    dom.paneSettings.classList.remove('active');
    dom.paneStats.classList.add('active');
    if (dom.tabBtnSettings) dom.tabBtnSettings.classList.remove('active');
    if (dom.tabBtnStats) dom.tabBtnStats.classList.add('active');
  }
}

export function openConfigsModal(tab) {
  if (state.isShopOpen) {
    closeShop();
  }
  state.isConfigsOpen = true;
  state.isLeftMouseDown = false;
  state.isRightMouseDown = false;

  if (dom.configsModalOverlay) {
    dom.configsModalOverlay.classList.remove('hidden');
  }

  if (tab) {
    switchConfigsTab(tab);
  }

  updateSoundUI();
  updateConfigsStatsUI();
}

export function closeConfigsModal() {
  state.isConfigsOpen = false;
  state.isLeftMouseDown = false;
  state.isRightMouseDown = false;

  if (dom.configsModalOverlay) {
    dom.configsModalOverlay.classList.add('hidden');
  }
}

export function toggleConfigsModal(tab) {
  if (state.isConfigsOpen) {
    closeConfigsModal();
  } else {
    openConfigsModal(tab);
  }
}

export function initConfigsListeners(handleResetCallback) {
  // Config button in top-right HUD
  if (dom.configBtn) {
    dom.configBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
    dom.configBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
    dom.configBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
      toggleConfigsModal();
    });
  }

  // Close button (X)
  if (dom.configsCloseBtn) {
    dom.configsCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeConfigsModal();
    });
  }

  // Click outside card (on overlay backdrop)
  if (dom.configsModalOverlay) {
    dom.configsModalOverlay.addEventListener('mousedown', (e) => {
      if (e.target === dom.configsModalOverlay) {
        closeConfigsModal();
      }
    });
  }

  // Tabs
  if (dom.tabBtnStats) {
    dom.tabBtnStats.addEventListener('click', (e) => {
      e.stopPropagation();
      switchConfigsTab('stats');
    });
  }
  if (dom.tabBtnSettings) {
    dom.tabBtnSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      switchConfigsTab('settings');
    });
  }

  // Sound toggle button in modal
  if (dom.modalSoundToggleBtn) {
    dom.modalSoundToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.soundEngine) {
        window.soundEngine.resume();
        window.soundEngine.toggleMute();
        updateSoundUI();
        saveGame();
      }
    });
  }

  // Volume slider in modal
  if (dom.volumeSlider) {
    dom.volumeSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value) / 100;
      if (dom.volumeVal) dom.volumeVal.textContent = `${e.target.value}%`;
      if (window.soundEngine) {
        window.soundEngine.resume();
        window.soundEngine.setVolume(val);
        updateSoundUI();
        saveGame();
      }
    });
  }

  // Reset button in modal
  if (dom.modalResetBtn) {
    dom.modalResetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof handleResetCallback === 'function') {
        handleResetCallback();
      }
    });
  }
}
