(() => {
"use strict";

/* ==================== data.js ==================== */
/**
 * Sweeping Incremental - Central Game Configuration & Dynamic State Values
 * All core numeric values, capacities, rates, and upgrade configurations in one variable.
 */

const Values = {
  // Infinite Main Storage
  storage: {
    max: Infinity,
    dust: 0,
    dirt: 0,
    get content() { return (this.dust || 0) + (this.dirt || 0); },
    get contentDust() { return this.dust || 0; },
    set contentDust(v) { this.dust = v; },
    get contentDirt() { return this.dirt || 0; },
    set contentDirt(v) { this.dirt = v; }
  },

  // Vacuum Robot Configuration
  vacuum: {
    cleanRate: 0.1,    // Rate of cleaning distributed across pixels under vacuum (g/s)
    storeRate: 1,    // Transfer rate into infinite storage while holding Space (g/s)
    capacity: 0.5,     // Base vacuum canister capacity (g)
    stored: 0,         // Current total mass in canister (dust + dirt)
    storedDust: 0,     // Current dust mass in canister (g)
    storedDirt: 0,     // Current dirt mass in canister (g)
    speed: 0.01,       // Base movement speed ratio (fraction of screen dimension per second)
    size: 0.1,         // Size ratio (0.1 corresponds to 1% of room dimension in getSizeRatio)
    topVisualOffset: 0.22, // Visual vertical offset of the top lid (fraction of vacuum radius, e.g. 0.15 = 15% up)
    rotateWithMovement: true, // Whether the vacuum rotates to face movement direction
    bottomImage: "Assets/Icons/B.O.B. Bottom.png", // Bottom/base sprite image
    topImage: "Assets/Icons/B.O.B. Top.png"         // Top/lid sprite image
  },

  // Automatic Vacuum Robot Configuration
  autoVacuum: {
    cleanRate: 0.1,    // Rate of cleaning distributed across pixels under vacuum (g/s)
    capacity: 1.0,     // Base vacuum canister capacity (g)
    stored: 0,         // Current total mass in canister (dust + dirt)
    storedDust: 0,     // Current dust mass in canister (g)
    storedDirt: 0,     // Current dirt mass in canister (g)
    speed: 0.01,       // Base movement speed ratio (fraction of screen dimension per second)
    size: 0.1,        // Size ratio (0.25 corresponds to 2.5% of room dimension in getSizeRatio, half of main vacuum)
    topVisualOffset: 0.22, // Visual vertical offset of the top lid (fraction of vacuum radius)
    bottomImage: "Assets/Icons/B.O.B. Bottom.png",
    topImage: "Assets/Icons/B.O.B. Top.png"
  },

  // Station Configuration (Docking Station on right)
  station: {
    capacity: 20.0,     // Station storage tank capacity in grams (50g)
    stored: 0,          // Current total mass in station tank (dust + dirt)
    dust: 0,            // Current dust mass in station tank (g)
    dirt: 0             // Current dirt mass in station tank (g)
  },

  // Room Geometry, Resolution & Mass Calibration
  room: {
    gridRes: 1000,        // Grid resolution (100 x 100 pixels = 10,000 pixels)
    dustCapacity: 1000,  // Full room total dust capacity in grams (1 Kg = 1000g)
    baseDirtCapacity: 10, // Default base room max dirt on screen in grams (10g)
    dirtCapacity: 10,   // Full room max dirt on screen in grams (10g base, 25g with Dirty prestige upgrade)
    dustReappearDelay: 10000, // Time in ms before cleaned dust starts reappearing (10s)
    dustFadeDuration: 1200,   // Smooth reappear fade duration in ms (1.2s)

    // Dynamic calculations: Automatically calculated from gridRes and capacities!
    get totalPixels() {
      return this.gridRes * this.gridRes;
    },
    // Exact grams of dust per pixel (e.g. 1000g / 10,000px = 0.1g/px)
    get dustPerPixel() {
      const basePerPx = this.dustCapacity / this.totalPixels;
      const densMult = (typeof Values !== 'undefined' && Values.getEffectiveDustDensityMultiplier)
        ? Values.getEffectiveDustDensityMultiplier()
        : 1.0;
      return basePerPx * densMult;
    },
    // Exact grams of dirt per pixel for full dirt pixels (e.g. 0.1g/px)
    get dirtPerPixel() {
      return this.dustCapacity / this.totalPixels;
    }
  },

  // Organic Dirt Zones & Wave Refill Settings
  dirt: {
    refillThresholdPercent: 0.50, // When dirt falls below 70% of max (70g), refill wave triggers
    maxCapPercent: 1.00,          // Refill wave grows dirt up to 100% of max (100g)
    spawnIntervalMs: 2000,        // Milliseconds between spawning new dirt zone seeds (2s)
    maxActiveZones: 14,           // Maximum simultaneous active growing zones
    zoneGrowthRateMin: 0.40,      // Minimum zone growth rate (g/s)
    zoneGrowthRateMax: 0.75       // Maximum zone growth rate (g/s)
  },

  // Particle System Limits
  particles: {
    maxDustMotes: 80,
    maxTransferParticles: 90,
    maxSplashParticles: 30
  },

  // Progress & Sampling
  progress: {
    milestones: [25, 50, 75, 90, 100],
    sampleIntervalMs: 250
  },

  // Dynamic Upgrades & Shop Configurations (Card System)
  shops: {
    dustShop: {
      capacity: {
        name: "Capacity",
        image: "Assets/Upgrades/Dust/Capacity.png",
        currency: "dust",
        require: null, // e.g. { upgrade: "speed", level: 1 } to require another upgrade & level
        effect: 0.5,
        cost: 0.5,
        mult: 1.5,
        level: 0,
        getDesc(upg) {
          return `+${(upg.effect * 100).toFixed(0)}% canister capacity`;
        },
        getEffect(upg) {
          return `+${(upg.level * upg.effect * 100).toFixed(0)}% Capacity`;
        },
        getStat(upg) {
          return `${Values.getEffectiveCapacity().toFixed(2)}g`;
        }
      },
      efficiency: {
        name: "Efficiency",
        image: "Assets/Upgrades/Dust/Efficiency.png",
        currency: "dust",
        require: { upgrade: "speed", level: 2 }, // e.g. { upgrade: "capacity", level: 1 }
        effect: 0.5,
        cost: 1,
        mult: 1.5,
        level: 0,
        getDesc(upg) {
          return `+${(upg.effect * 100).toFixed(0)}% cleaning rate`;
        },
        getEffect(upg) {
          return `+${(upg.level * upg.effect * 100).toFixed(0)}% Clean Rate`;
        },
        getStat(upg) {
          return `${Values.getEffectiveCleanRate().toFixed(2)}g/s`;
        }
      },
      speed: {
        name: "Speed",
        image: "Assets/Upgrades/Dust/Speed.png",
        currency: "dust",
        require: null, // e.g. { upgrade: "efficiency", level: 1 }
        effect: 0.5,
        cost: 0.5,
        mult: 1.5,
        level: 0,
        getDesc(upg) {
          return `+${(upg.effect * 100).toFixed(0)}% vacuum movement speed`;
        },
        getEffect(upg) {
          return `+${(upg.level * upg.effect * 100).toFixed(0)}% Speed`;
        },
        getStat(upg) {
          return `${(Values.getEffectiveSpeed() * 100).toFixed(1)}%/s`;
        }
      },
      storingSpeed: {
        name: "Storing Speed",
        image: "Assets/Upgrades/Dust/Storing Speed.png",
        currency: "dust",
        require: { upgrade: "capacity", level: 2 }, // e.g. { upgrade: "capacity", level: 1 }
        effect: 0.5,
        cost: 0.75,
        mult: 1.5,
        level: 0,
        getDesc(upg) {
          return `+${(upg.effect * 100).toFixed(0)}% storing transfer rate`;
        },
        getEffect(upg) {
          return `+${(upg.level * upg.effect * 100).toFixed(0)}% Store Rate`;
        },
        getStat(upg) {
          return `${Values.getEffectiveStoreRate().toFixed(2)}g/s`;
        }
      },
      dirt: {
        name: "Dirt",
        image: "Assets/Upgrades/Dust/Dirt.png",
        currency: "dust",
        require: { upgrade: "efficiency", level: 1 }, // e.g. { upgrade: "speed", level: 2 }
        isUnlock: true,
        maxLevel: 1,
        effect: 1.0,
        cost: 25,
        mult: 1.5,
        level: 0,
        getDesc(upg) {
          const maxD = Values.getMaxDirt ? Values.getMaxDirt() : 10;
          return upg.level === 0
            ? `Unlocks organic dirt zones up to ${maxD}g`
            : `Organic dirt zones active (generates up to ${maxD}g)`;
        },
        getEffect(upg) {
          return upg.level === 0 ? "Unlock Dirt" : "Dirt Active";
        },
        getStat(upg) {
          const maxD = Values.getMaxDirt ? Values.getMaxDirt() : 10;
          return upg.level === 0 ? "Locked" : `${maxD}g Max`;
        }
      },
      autoCleaner: {
        name: "Auto Cleaner",
        image: "Assets/Upgrades/Dust/Auto Cleaner.png",
        currency: "dust",
        require: { upgrade: "capacity", level: 5 }, // Unlocked after buying 5 capacity upgrades
        effect: 1.0,
        cost: 2.0,
        mult: 50.0,
        level: 0,
        maxLevel: 3,
        getDesc(upg) {
          return `Auto-cleaner bot that wanders and vacuums dust & dirt (${upg.level}/3)`;
        },
        getEffect(upg) {
          return `${upg.level} / 3 Bots`;
        },
        getStat(upg) {
          return `${Values.getTotalAutoCleanersCount ? Values.getTotalAutoCleanersCount() : upg.level} Active`;
        }
      }
    },
    dirtShop: {
      size: {
        name: "Size",
        image: "Assets/Upgrades/Dirt/Size.png",
        currency: "dirt",
        require: { upgrade: "dirt", level: 1 }, // Requires Dirt level 1 to see this upgrade
        effect: 0.2,
        cost: 1.0,
        mult: 10.0,
        level: 0,
        getDesc(upg) {
          return `+${(upg.effect * 100).toFixed(0)}% vacuum size`;
        },
        getEffect(upg) {
          return `+${(upg.level * upg.effect * 100).toFixed(0)}% Size`;
        },
        getStat(upg) {
          return `${(Values.getEffectiveSizeMultiplier() * 100).toFixed(0)}%`;
        }
      },
      autoEfficiency: {
        name: "Auto Efficiency",
        image: "Assets/Upgrades/Dirt/Auto Efficiency.png",
        currency: "dirt",
        require: { upgrade: "dirt", level: 1 },
        effect: 0.5,
        cost: 1.0,
        mult: 1.5,
        level: 0,
        getDesc(upg) {
          return `+${(upg.effect * 100).toFixed(0)}% auto cleaner efficiency`;
        },
        getEffect(upg) {
          return `+${(upg.level * upg.effect * 100).toFixed(0)}% Auto Rate`;
        },
        getStat(upg) {
          return `${Values.getEffectiveAutoVacuumCleanRate().toFixed(2)}g/s`;
        }
      },
      autoCapacity: {
        name: "Auto Capacity",
        image: "Assets/Upgrades/Dirt/Auto Capacity.png",
        currency: "dirt",
        require: { upgrade: "dirt", level: 1 },
        effect: 0.5,
        cost: 5.0,
        mult: 1.75,
        level: 0,
        getDesc(upg) {
          return `+${(upg.effect * 100).toFixed(0)}% auto cleaner capacity`;
        },
        getEffect(upg) {
          return `+${(upg.level * upg.effect * 100).toFixed(0)}% Capacity`;
        },
        getStat(upg) {
          return `${Values.getEffectiveAutoVacuumCapacity().toFixed(2)}g`;
        }
      },
      moreDust: {
        name: "More Dust",
        image: "Assets/Upgrades/Dirt/More Dust.png",
        currency: "dirt",
        require: { upgrade: "dirt", level: 1 },
        cost: 5.0,
        mult: 2.0,
        dustMultEffect: 0.5,
        dustDensityEffect: 0.3,
        level: 0,
        getDesc(upg) {
          return `+50% dust multiplier & +30% dust density`;
        },
        getEffect(upg) {
          return `+${(upg.level * 50)}% Sell / +${(upg.level * 30)}% Dens`;
        },
        getStat(upg) {
          return `x${Values.getEffectiveDustMultiplier().toFixed(1)} Mult / x${Values.getEffectiveDustDensityMultiplier().toFixed(1)} Dens`;
        }
      },
      autoSpeed: {
        name: "Auto Speed",
        image: "Assets/Upgrades/Dirt/Auto Speed.png",
        currency: "dirt",
        require: { upgrade: "dirt", level: 1 },
        effect: 0.5,
        cost: 1.0,
        mult: 1.5,
        level: 0,
        getDesc(upg) {
          return `+${(upg.effect * 100).toFixed(0)}% auto cleaner speed`;
        },
        getEffect(upg) {
          return `+${(upg.level * upg.effect * 100).toFixed(0)}% Speed`;
        },
        getStat(upg) {
          return `${(Values.getEffectiveAutoVacuumSpeed() * 100).toFixed(1)}%/s`;
        }
      },
      autoCleaner: {
        name: "Auto Cleaner",
        image: "Assets/Upgrades/Dirt/Auto Cleaner.png",
        currency: "dirt",
        require: { upgrade: "moreDust", level: 1 },
        effect: 1.0,
        cost: 5.0,
        mult: 25.0,
        level: 0,
        maxLevel: 3,
        getDesc(upg) {
          return `Auto-cleaner bot that wanders and vacuums dust & dirt (${upg.level}/3)`;
        },
        getEffect(upg) {
          return `${upg.level} / 3 Bots`;
        },
        getStat(upg) {
          return `${Values.getTotalAutoCleanersCount ? Values.getTotalAutoCleanersCount() : upg.level} Active`;
        }
      }
    }
  },

  // Active Prestige Upgrade Effects Cache
  prestigeEffects: {
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
  },

  // --- Dynamic Multiplier & Calculation Helpers ---

  // Total active auto cleaners across both Dust Shop and Dirt Shop (plus any prestige bonus bots)
  getTotalAutoCleanersCount() {
    const dustUpg = this.shops.dustShop && (this.shops.dustShop.autoCleaner || this.shops.dustShop['Auto Cleaner']);
    const dirtUpg = this.shops.dirtShop && (this.shops.dirtShop.autoCleaner || this.shops.dirtShop['Auto Cleaner']);
    const bonusBots = (this.prestigeEffects && this.prestigeEffects.freeAutoCleaners) ? this.prestigeEffects.freeAutoCleaners : 0;
    const count = (dustUpg ? dustUpg.level : 0) + (dirtUpg ? dirtUpg.level : 0) + bonusBots;
    return count;
  },

  // Effective multiplier for dust and dirt gained on storing (e.g. Richer prestige upgrade: +50% per level)
  getStoringResourceMultiplier() {
    const bonus = (this.prestigeEffects && typeof this.prestigeEffects.storingResourceBonus === 'number')
      ? this.prestigeEffects.storingResourceBonus
      : 0;
    return Math.max(1.0, 1.0 + bonus);
  },

  // Effective dust multiplier applied when storing/selling dust (1.0 + level * 0.50)
  getEffectiveDustMultiplier() {
    const upg = (this.shops.dirtShop && (this.shops.dirtShop.moreDust || this.shops.dirtShop.MoreDust)) ||
                (this.shops.dustShop && (this.shops.dustShop.moreDust || this.shops.dustShop.MoreDust));
    const effect = (upg && upg.dustMultEffect != null) ? upg.dustMultEffect : 0.5;
    const prestigeBonus = (this.prestigeEffects && this.prestigeEffects.dustMultiplier) ? this.prestigeEffects.dustMultiplier : 0;
    const multiplier = (1.0 + (upg ? (upg.level * effect) : 0)) * (1.0 + prestigeBonus);
    return multiplier;
  },

  // Effective dust density multiplier for grams per pixel (1.0 + level * 0.30)
  getEffectiveDustDensityMultiplier() {
    const upg = (this.shops.dirtShop && (this.shops.dirtShop.moreDust || this.shops.dirtShop.MoreDust)) ||
                (this.shops.dustShop && (this.shops.dustShop.moreDust || this.shops.dustShop.MoreDust));
    const effect = (upg && upg.dustDensityEffect != null) ? upg.dustDensityEffect : 0.3;
    const prestigeBonus = (this.prestigeEffects && this.prestigeEffects.dustDensityMultiplier) ? this.prestigeEffects.dustDensityMultiplier : 0;
    const multiplier = (1.0 + (upg ? (upg.level * effect) : 0)) * (1.0 + prestigeBonus);
    return multiplier;
  },

  // Effective total room dust capacity in grams (1000g * density multiplier)
  getEffectiveDustCapacity() {
    const baseCap = (this.room && this.room.dustCapacity != null) ? this.room.dustCapacity : 1000;
    return baseCap * this.getEffectiveDustDensityMultiplier();
  },

  // Effective vacuum movement speed ratio (e.g. 0.01 * (1 + level * 0.5))
  getEffectiveSpeed() {
    const upg = this.shops.dustShop.speed || this.shops.dustShop.Speed;
    const prestigeBonus = (this.prestigeEffects && this.prestigeEffects.speedMultiplier) ? this.prestigeEffects.speedMultiplier : 0;
    const multiplier = (1.0 + (upg ? (upg.level * upg.effect) : 0)) * (1.0 + prestigeBonus);
    return this.vacuum.speed * multiplier;
  },

  // Effective cleaning rate in g/s distributed across pixels under vacuum
  getEffectiveCleanRate() {
    const upg = this.shops.dustShop.efficiency || this.shops.dustShop.CleanRate || this.shops.dustShop.Efficiency;
    const prestigeBonus = (this.prestigeEffects && this.prestigeEffects.cleanRateMultiplier) ? this.prestigeEffects.cleanRateMultiplier : 0;
    const multiplier = (upg ? (1.0 + (upg.level * upg.effect)) : 1.0) * (1.0 + prestigeBonus);
    return (this.vacuum.cleanRate != null ? this.vacuum.cleanRate : 0.1) * multiplier;
  },

  // Effective auto vacuum cleaning rate in g/s distributed across pixels under vacuum
  getEffectiveAutoVacuumCleanRate() {
    const upg = (this.shops.dirtShop && (this.shops.dirtShop.autoEfficiency || this.shops.dirtShop.AutoEfficiency)) ||
                (this.shops.dustShop && (this.shops.dustShop.autoEfficiency || this.shops.dustShop.AutoEfficiency));
    const prestigeBonus = (this.prestigeEffects && this.prestigeEffects.autoCleanRateMultiplier) ? this.prestigeEffects.autoCleanRateMultiplier : 0;
    const multiplier = (1.0 + (upg ? (upg.level * upg.effect) : 0)) * (1.0 + prestigeBonus);
    const baseRate = (this.autoVacuum && this.autoVacuum.cleanRate != null) ? this.autoVacuum.cleanRate : 0.1;
    return baseRate * multiplier;
  },

  // Effective auto vacuum canister capacity in grams (1.0 * (1 + level * 0.5))
  getEffectiveAutoVacuumCapacity() {
    const upg = (this.shops.dirtShop && (this.shops.dirtShop.autoCapacity || this.shops.dirtShop.AutoCapacity)) ||
                (this.shops.dustShop && (this.shops.dustShop.autoCapacity || this.shops.dustShop.AutoCapacity));
    const prestigeBonus = (this.prestigeEffects && this.prestigeEffects.autoCapacityMultiplier) ? this.prestigeEffects.autoCapacityMultiplier : 0;
    const multiplier = (1.0 + (upg ? (upg.level * upg.effect) : 0)) * (1.0 + prestigeBonus);
    const baseCap = (this.autoVacuum && this.autoVacuum.capacity != null) ? this.autoVacuum.capacity : 1.0;
    return baseCap * multiplier;
  },

  // Effective auto vacuum movement speed ratio (0.01 * (1 + level * 0.5))
  getEffectiveAutoVacuumSpeed() {
    const upg = (this.shops.dirtShop && (this.shops.dirtShop.autoSpeed || this.shops.dirtShop.AutoSpeed)) ||
                (this.shops.dustShop && (this.shops.dustShop.autoSpeed || this.shops.dustShop.AutoSpeed));
    const prestigeBonus = (this.prestigeEffects && this.prestigeEffects.autoSpeedMultiplier) ? this.prestigeEffects.autoSpeedMultiplier : 0;
    const multiplier = (1.0 + (upg ? (upg.level * upg.effect) : 0)) * (1.0 + prestigeBonus);
    const baseSpeed = (this.autoVacuum && this.autoVacuum.speed != null) ? this.autoVacuum.speed : 0.01;
    return baseSpeed * multiplier;
  },

  // Visual vertical offset for top lid of default vacuum (fraction of vacuum radius)
  getVacuumTopVisualOffset() {
    return (this.vacuum && this.vacuum.topVisualOffset != null) ? this.vacuum.topVisualOffset : 0.15;
  },

  // Visual vertical offset for top lid of auto vacuum (fraction of vacuum radius)
  getAutoVacuumTopVisualOffset() {
    return (this.autoVacuum && this.autoVacuum.topVisualOffset != null)
      ? this.autoVacuum.topVisualOffset
      : this.getVacuumTopVisualOffset();
  },

  // Station storage tank capacity in grams (50g)
  getStationCapacity() {
    return (this.station && typeof this.station.capacity === 'number') ? this.station.capacity : 50.0;
  },

  // Effective vacuum capacity in grams (e.g. 0.5 * (1 + level * 0.5))
  getEffectiveCapacity() {
    const upg = this.shops.dustShop.capacity || this.shops.dustShop.Capacity || this.shops.dustShop.CapacityMult;
    const prestigeBonus = (this.prestigeEffects && this.prestigeEffects.capacityMultiplier) ? this.prestigeEffects.capacityMultiplier : 0;
    const multiplier = (1.0 + (upg ? (upg.level * upg.effect) : 0)) * (1.0 + prestigeBonus);
    return this.vacuum.capacity * multiplier;
  },

  // Effective store rate in g/s (e.g. 100 * (1 + level * 0.5))
  getEffectiveStoreRate() {
    const upg = this.shops.dustShop.storingSpeed || this.shops.dustShop['storing speed'] || this.shops.dustShop.storing_speed || this.shops.dustShop.StoringSpeed;
    const prestigeBonus = (this.prestigeEffects && this.prestigeEffects.storeRateMultiplier) ? this.prestigeEffects.storeRateMultiplier : 0;
    const multiplier = (1.0 + (upg ? (upg.level * upg.effect) : 0)) * (1.0 + prestigeBonus);
    return (this.vacuum.storeRate != null ? this.vacuum.storeRate : 1.0) * multiplier;
  },

  // Effective vacuum size multiplier (1.0 + level * 0.20)
  getEffectiveSizeMultiplier() {
    const upg = (this.shops.dirtShop && (this.shops.dirtShop.size || this.shops.dirtShop.Size)) ||
                (this.shops.dustShop && (this.shops.dustShop.size || this.shops.dustShop.Size));
    const prestigeBonus = (this.prestigeEffects && this.prestigeEffects.sizeMultiplier) ? this.prestigeEffects.sizeMultiplier : 0;
    const multiplier = (1.0 + (upg ? (upg.level * upg.effect) : 0)) * (1.0 + prestigeBonus);
    return multiplier;
  },

  // Dirt refill trigger threshold in grams (e.g. maxDirt * 0.50)
  getDirtRefillThreshold() {
    const thresholdPct = (this.dirt && this.dirt.refillThresholdPercent != null) ? this.dirt.refillThresholdPercent : 0.70;
    return this.getMaxDirt() * thresholdPct;
  },

  // Max dirt on screen in grams (10g base, 25g with Dirty prestige upgrade)
  getMaxDirt() {
    const maxPct = (this.dirt && this.dirt.maxCapPercent != null) ? this.dirt.maxCapPercent : 1.00;
    let baseCap = (this.room && this.room.dirtCapacity != null) ? this.room.dirtCapacity : 10;
    if (this.prestigeEffects) {
      if (typeof this.prestigeEffects.maxRoomDirt === 'number' && this.prestigeEffects.maxRoomDirt > baseCap) {
        baseCap = this.prestigeEffects.maxRoomDirt;
      }
      if (typeof this.prestigeEffects.addRoomDirt === 'number') {
        baseCap += this.prestigeEffects.addRoomDirt;
      }
    }
    return baseCap * maxPct;
  },

  // Current purchase cost for an upgrade (base cost * mult^level)
  getUpgradeCost(upgradeKey, shopKey) {
    if (!upgradeKey) return 0;
    const key = upgradeKey.toLowerCase();
    let upg = null;
    if (shopKey && this.shops[shopKey]) {
      upg = this.shops[shopKey][upgradeKey] || this.shops[shopKey][key];
    }
    if (!upg) {
      const alias = key === 'cleanrate' ? 'efficiency' :
                    (key === 'capacitymult' ? 'capacity' :
                    (key === 'storingspeed' || key === 'storing speed' || key === 'storing_speed' ? 'storingSpeed' :
                    (key === 'suckzone' || key === 'suck zone' || key === 'suck_zone' || key === 'size' ? 'size' :
                    (key === 'autocleaner' || key === 'auto cleaner' || key === 'auto_cleaner' ? 'autoCleaner' :
                    (key === 'autocapacity' || key === 'auto capacity' || key === 'auto_capacity' ? 'autoCapacity' :
                    (key === 'autospeed' || key === 'auto speed' || key === 'auto_speed' ? 'autoSpeed' :
                    (key === 'moredust' || key === 'more dust' || key === 'more_dust' ? 'moreDust' :
                    (key === 'autoefficiency' || key === 'auto efficiency' || key === 'auto_efficiency' || key === 'autoefficienty' || key === 'auto efficienty' ? 'autoEfficiency' : key))))))));
      if (shopKey && this.shops[shopKey]) {
        upg = this.shops[shopKey][alias];
      }
      if (!upg) {
        upg = (this.shops.dustShop && (this.shops.dustShop[upgradeKey] || this.shops.dustShop[key] || this.shops.dustShop[alias])) ||
              (this.shops.dirtShop && (this.shops.dirtShop[upgradeKey] || this.shops.dirtShop[key] || this.shops.dirtShop[alias]));
      }
    }
    if (!upg) return 0;
    if (upg.isUnlock && upg.level >= 1) return Infinity;
    if (upg.maxLevel && upg.level >= upg.maxLevel) return Infinity;
    return upg.cost * Math.pow(upg.mult || 1, upg.level);
  },

  // Look up an upgrade object by key or alias across all shops
  getUpgrade(upgradeKey, shopKey) {
    if (!upgradeKey) return null;
    const key = upgradeKey.toLowerCase();
    if (shopKey && this.shops[shopKey]) {
      if (this.shops[shopKey][upgradeKey]) return this.shops[shopKey][upgradeKey];
      if (this.shops[shopKey][key]) return this.shops[shopKey][key];
    }
    const alias = key === 'cleanrate' ? 'efficiency' :
                  (key === 'capacitymult' ? 'capacity' :
                  (key === 'storingspeed' || key === 'storing speed' || key === 'storing_speed' ? 'storingSpeed' :
                  (key === 'suckzone' || key === 'suck zone' || key === 'suck_zone' || key === 'size' ? 'size' :
                  (key === 'autocleaner' || key === 'auto cleaner' || key === 'auto_cleaner' ? 'autoCleaner' :
                  (key === 'autocapacity' || key === 'auto capacity' || key === 'auto_capacity' ? 'autoCapacity' :
                  (key === 'autospeed' || key === 'auto speed' || key === 'auto_speed' ? 'autoSpeed' :
                  (key === 'moredust' || key === 'more dust' || key === 'more_dust' ? 'moreDust' :
                  (key === 'autoefficiency' || key === 'auto efficiency' || key === 'auto_efficiency' || key === 'autoefficienty' || key === 'auto efficienty' ? 'autoEfficiency' : key))))))));
    if (shopKey && this.shops[shopKey] && this.shops[shopKey][alias]) {
      return this.shops[shopKey][alias];
    }
    for (const shopName of Object.keys(this.shops)) {
      const shop = this.shops[shopName];
      if (!shop) continue;
      if (shop[upgradeKey]) return shop[upgradeKey];
      if (shop[key]) return shop[key];
      if (shop[alias]) return shop[alias];
    }
    return null;
  },

  // Check if an upgrade requirement is satisfied
  // Supports:
  // require: { upgrade: "dirt", level: 1 }
  // require: { key: "speed", level: 2 }
  // require: "dirt" (defaults to level 1)
  // require: { speed: 2, capacity: 1 }
  checkRequirement(req) {
    if (!req) return true; // No requirement: always visible

    if (typeof req === 'string') {
      const target = this.getUpgrade(req);
      return target ? (target.level >= 1) : false;
    }

    if (typeof req === 'object') {
      const targetKey = req.upgrade || req.key || req.name || req.id;
      if (targetKey) {
        const requiredLvl = (req.level != null) ? req.level : 1;
        const target = this.getUpgrade(targetKey);
        return target ? (target.level >= requiredLvl) : false;
      }

      // Key-value map: { speed: 2, capacity: 1 }
      const entries = Object.entries(req);
      if (entries.length > 0) {
        for (const [k, lvl] of entries) {
          if (k === 'level' || k === 'upgrade' || k === 'key') continue;
          const target = this.getUpgrade(k);
          if (!target || target.level < lvl) return false;
        }
        return true;
      }
    }

    return true;
  },

  // Determines whether an upgrade is visible in the shop
  isUpgradeVisible(upg) {
    if (!upg) return false;
    return this.checkRequirement(upg.require);
  },

  // Normalized vacuum radius ratio (1% of room dimension base) scaled by Size upgrade
  getSizeRatio() {
    const baseRatio = this.vacuum.size >= 0.05 ? (this.vacuum.size * 0.1) : this.vacuum.size;
    return baseRatio * this.getEffectiveSizeMultiplier();
  },

  // Normalized auto vacuum radius ratio
  getAutoVacuumSizeRatio() {
    const s = (this.autoVacuum && this.autoVacuum.size != null) ? this.autoVacuum.size : 0.1;
    return s >= 0.05 ? (s * 0.1) : s;
  }
};

// Expose globally for browser and node environments
if (typeof window !== 'undefined') {
  window.Values = Values;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Values;
}

const SAVE_KEY = 'sweeping_incremental_save';

const MILESTONES = [25, 50, 75, 90, 100];


/* ==================== prestigeData.js ==================== */
/**
 * Sweeping Incremental - Prestige Upgrades Configuration
 *
 * All prestige upgrade definitions live in this file.
 * Add or edit entries in PRESTIGE_UPGRADES to automatically generate
 * Prestige Tree nodes, connections, tooltips, purchase validation, and effects.
 */

const PRESTIGE_UPGRADES = [
  {
    id: 'theTree',
    name: 'The Tree',
    description: 'Unlocks the Prestige Tree.',
    emoji: '🌳',
    image: null,
    cost: 0,
    requirements: [],
    effects: {
      unlockTree: true
    }
  },
  {
    id: 'dirty',
    name: 'Dirty',
    description: 'Increases maximum room dirt from 10g to 25g.',
    emoji: '🟤',
    image: 'assets/icons/Dirt.png',
    cost: 3,
    requirements: ['theTree'],
    effects: {
      maxRoomDirt: 25
    }
  },
  {
    id: 'cleanStart',
    name: 'Clean Start',
    description: 'Start each prestige with 100g dust.',
    emoji: '✨',
    image: 'assets/icons/Dust.png',
    cost: 2,
    baseCost: 2,
    maxLevel: 1,
    costMultiplier: 1.0,
    requirements: ['theTree'],
    effects: {
      startingDust: 100
    }
  },
  {
    id: 'richer',
    name: 'Richer',
    description: 'Give 50% more dust and dirt on storing.',
    emoji: '💰',
    image: null,
    cost: 3,
    baseCost: 3,
    maxLevel: 5,
    costMultiplier: 1.5,
    requirements: ['dirty'],
    effects: {
      storingResourceBonus: 0.50
    }
  }
];

if (typeof window !== 'undefined') {
  window.PRESTIGE_UPGRADES = PRESTIGE_UPGRADES;
}


/* ==================== sound.js ==================== */
/**
 * Procedural Audio Engine for Sweeping Incremental
 * Generates vacuum hum, brush sweeping whoosh, and milestone chimes via Web Audio API.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isInitialized = false;
    this.volume = 0.6;

    // Vacuum loop nodes
    this.vacuumGain = null;
    this.filterNode = null;
    this.noiseNode = null;
    this.subOsc = null;

    this.currentSuctionLevel = 0;
    this.targetSuctionLevel = 0;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Setup vacuum noise generator (pink/white noise filtered)
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2 + white * 0.5362) * 0.15;
      }

      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;

      // Bandpass filter for suction whoosh
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'bandpass';
      this.filterNode.frequency.setValueAtTime(450, this.ctx.currentTime);
      this.filterNode.Q.setValueAtTime(1.8, this.ctx.currentTime);

      this.vacuumGain = this.ctx.createGain();
      this.vacuumGain.gain.setValueAtTime(0, this.ctx.currentTime);

      // Low motor hum
      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'sawtooth';
      this.subOsc.frequency.setValueAtTime(65, this.ctx.currentTime);

      const subFilter = this.ctx.createBiquadFilter();
      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(130, this.ctx.currentTime);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      this.noiseNode.connect(this.filterNode);
      this.filterNode.connect(this.vacuumGain);

      this.subOsc.connect(subFilter);
      subFilter.connect(subGain);
      subGain.connect(this.vacuumGain);

      this.vacuumGain.connect(this.masterGain);

      this.noiseNode.start();
      this.subOsc.start();

      this.isInitialized = true;
    } catch (e) {
      console.warn("AudioContext could not be initialized:", e);
    }
  }

  resume() {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
    return !this.isMuted;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, Number(vol) || 0));
    if (this.volume > 0 && this.isMuted) {
      this.isMuted = false;
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  updateMovement(speedNorm) {
    if (!this.isInitialized || this.isMuted) return;
    this.targetSuctionLevel = Math.min(1.0, Math.max(0, speedNorm));
    // Smooth lerp
    this.currentSuctionLevel += (this.targetSuctionLevel - this.currentSuctionLevel) * 0.15;

    const baseGain = 0.03;
    const activeGain = baseGain + this.currentSuctionLevel * 0.28;
    this.vacuumGain.gain.setTargetAtTime(activeGain, this.ctx.currentTime, 0.05);

    // Modulate filter frequency based on speed
    const targetFreq = 380 + this.currentSuctionLevel * 500;
    this.filterNode.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
  }

  playDustPuff() {
    if (!this.isInitialized || this.isMuted) return;
    if (Math.random() > 0.3) return; // limit frequency

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180 + Math.random() * 80, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  playDirtPuff() {
    if (!this.isInitialized || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140 + Math.random() * 40, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.13);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.14);
  }

  playFullWarning() {
    if (!this.isInitialized || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.setValueAtTime(240, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playStoreBlip() {
    if (!this.isInitialized || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440 + Math.random() * 60, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playPurchaseSound() {
    if (!this.isInitialized || this.isMuted) return;
    const notes = [587.33, 880.0]; // D5, A5
    notes.forEach((freq, idx) => {
      const startTime = this.ctx.currentTime + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.28);
    });
  }

  playMilestone() {
    if (!this.isInitialized || this.isMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      const startTime = this.ctx.currentTime + index * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }

  playPickContentSound() {
    if (!this.isInitialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    // Pleasant ascending chime/slurp when picking auto cleaner content
    const freqs = [440.0, 659.25, 880.0]; // A4, E5, A5
    freqs.forEach((freq, idx) => {
      const startTime = now + idx * 0.045;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.18);
    });
  }

  playBlackHoleEntrance() {
    if (!this.isInitialized || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      // 1. Deep graviton sub-bass plunge (space-time folding)
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(140, now);
      sub.frequency.exponentialRampToValueAtTime(32, now + 0.42);
      subGain.gain.setValueAtTime(0.16, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
      sub.connect(subGain);
      subGain.connect(this.masterGain);
      sub.start(now);
      sub.stop(now + 0.46);

      // 2. Cosmic vortex suction filter whoosh
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.40);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(750, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.40);
      filter.Q.setValueAtTime(4.5, now);
      oscGain.gain.setValueAtTime(0.09, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {
      // Audio fallback
    }
  }

  playBlackHoleExit() {
    if (!this.isInitialized || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      // 1. Warp exit harmonic triad shimmer
      const freqs = [523.25, 783.99, 1046.50]; // C5, G5, C6
      freqs.forEach((freq, idx) => {
        const startTime = now + idx * 0.035;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 0.8, startTime);
        osc.frequency.exponentialRampToValueAtTime(freq, startTime + 0.08);
        gain.gain.setValueAtTime(0.10, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });

      // 2. Rising warp pop & energy surge
      const noiseOsc = this.ctx.createOscillator();
      const noiseGain = this.ctx.createGain();
      const bq = this.ctx.createBiquadFilter();
      noiseOsc.type = 'triangle';
      noiseOsc.frequency.setValueAtTime(180, now);
      noiseOsc.frequency.exponentialRampToValueAtTime(560, now + 0.22);
      bq.type = 'bandpass';
      bq.frequency.setValueAtTime(320, now);
      bq.frequency.exponentialRampToValueAtTime(1200, now + 0.22);
      bq.Q.setValueAtTime(3.2, now);
      noiseGain.gain.setValueAtTime(0.09, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      noiseOsc.connect(bq);
      bq.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noiseOsc.start(now);
      noiseOsc.stop(now + 0.26);
    } catch (e) {
      // Audio fallback
    }
  }
}

const soundEngine = new SoundEngine();

if (typeof window !== 'undefined') {
  window.soundEngine = soundEngine;
}


/* ==================== state.js ==================== */
/**
 * Sweeping Incremental - Shared Runtime Game State & Room Geometry
 */



const stationGeometry = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  isOpen: false
};
Values.stationGeometry = stationGeometry;

function getStationCapacity() {
  if (Values.station && typeof Values.station.capacity === 'number') {
    return Values.station.capacity;
  }
  if (typeof Values.getStationCapacity === 'function') {
    const c = Values.getStationCapacity();
    if (typeof c === 'number' && !isNaN(c)) return c;
  }
  return 50.0;
}

const stationStorage = {
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

const state = {
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
  isConfigsOpen: false,
  isPrestigeTreeOpen: false,
  hadPlayedFullAlert: false,

  // Prestige State (Persisted across prestiges & saves)
  prestige: {
    unlocked: false,
    pp: 0,
    totalPP: 0,
    count: 0,
    justPrestiged: false,
    purchased: new Set(),
    upgradeLevels: {},
    get points() {
      return this.pp;
    },
    set points(val) {
      this.pp = val;
    },
    get timesPrestiged() {
      return this.count;
    },
    set timesPrestiged(val) {
      this.count = val;
    }
  },

  // Game Statistics (All-Time Lifetime stats)
  stats: {
    totalDustCollected: 0.0,
    totalDirtCleaned: 0.0,
    totalDistanceTraveled: 0.0,
    totalTimePlayed: 0.0,
    totalStationUnloads: 0,
    totalClicks: 0
  },

  // Current Prestige Run Statistics (Reset on each prestige, separate from lifetime stats)
  currentPrestigeStats: {
    totalDirtCleaned: 0.0,
    totalDustCollected: 0.0,
    totalDistanceTraveled: 0.0,
    totalTimePlayed: 0.0,
    totalStationUnloads: 0,
    totalClicks: 0
  },

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

Values.state = state;
Values.updateRoomGeometry = updateRoomGeometry;
Values.cleanerPos = state.cleanerPos;
Values.cleanerAngle = state.cleanerAngle;
Values.autoCleaners = state.autoCleaners;
Values.prestige = state.prestige;
Values.stats = state.stats;
Values.lifetimeStats = state.stats;
state.lifetimeStats = state.stats;
Values.currentPrestigeStats = state.currentPrestigeStats;

function syncGridDimensions() {
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

function getMaxScreenDirt() {
  return Values.getMaxDirt ? Values.getMaxDirt() : Values.room.dirtCapacity;
}

function getDirtRefillThreshold() {
  return Values.getDirtRefillThreshold ? Values.getDirtRefillThreshold() : (getMaxScreenDirt() * 0.70);
}

function getRoomDustCapacity() {
  return Values.getEffectiveDustCapacity ? Values.getEffectiveDustCapacity() : (Values.room ? Values.room.dustCapacity : 1000);
}

function randomizeDirtNoiseSeed() {
  state.noiseOffset[0] = Math.random() * 5000.0;
  state.noiseOffset[1] = Math.random() * 5000.0;
  state.dirtNoiseSeed = Math.random() * 10000.0;
}

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

function isPlayerInStation() {
  const s = stationGeometry;
  if (!s || !s.isOpen) return false;
  return (
    state.cleanerPos.x >= s.x &&
    state.cleanerPos.x <= s.x + s.width &&
    state.cleanerPos.y >= s.y &&
    state.cleanerPos.y <= s.y + s.height
  );
}

function isStoringActionActive() {
  return isPlayerInStation() && (Values.vacuum.stored > 0.0001);
}

function isDirtUnlocked() {
  const upg = Values.shops.dustShop.dirt || Values.shops.dustShop.Dirt;
  return upg ? (upg.level > 0) : false;
}

function isAutoCleanerStationOpen() {
  return true;
}

function updateRoomGeometry() {
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

function clampCleanerToPlayfield(pos, radius) {
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


/* ==================== particles.js ==================== */
/**
 * Sweeping Incremental - Particle Systems & 2D Overlay Rendering
 */





function spawnDustParticles(x, y, count = 1, isDirt = false) {
  const maxDustMotes = (Values.particles && Values.particles.maxDustMotes) || 80;
  if (state.particles.length >= maxDustMotes) return;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = state.cleanerRadius + 4 + Math.random() * 10;
    state.particles.push({
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
  return { x: state.width - 60, y: isDirt ? (state.height * 0.5 + 40) : (state.height * 0.5 - 40) };
}

// Transfer particles that fly from the bot / station to separate storage indicators at center right
function spawnTransferParticles(count = 2, isDirt = false, originX = null, originY = null) {
  const target = getStorageTargetCoord(isDirt);
  const maxTransfer = (Values.particles && Values.particles.maxTransferParticles) || 90;
  const fromX = originX != null ? originX : state.cleanerPos.x;
  const fromY = originY != null ? originY : state.cleanerPos.y;
  for (let i = 0; i < count; i++) {
    if (state.transferParticles.length >= maxTransfer) break;

    const angle = Math.random() * Math.PI * 2;
    const startDist = Math.random() * Math.min(10, state.cleanerRadius * 0.75);
    const startX = fromX + Math.cos(angle) * startDist;
    const startY = fromY + Math.sin(angle) * startDist;

    const targetX = target.x + (Math.random() - 0.5) * 16;
    const targetY = target.y + (Math.random() - 0.5) * 12;

    const midX = (startX + targetX) * 0.5;
    const dist = Math.hypot(targetX - startX, targetY - startY);
    const arcHeight = Math.min(130, Math.max(35, dist * 0.22));
    const midY = Math.min(startY, targetY) - arcHeight + (Math.random() - 0.5) * 16;

    state.transferParticles.push({
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
  if (state.splashParticles.length >= maxSplash) return;
  for (let i = 0; i < 2; i++) {
    state.splashParticles.push({
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

function spawnFloatingText(text, x, y, color = '#4ade80') {
  state.floatingTexts.push({
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
    state.splashParticles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 0.4,
      alpha: 0.9,
      size: 1.5 + Math.random() * 1.5,
      color: '56, 189, 248'
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

    state.autoCleanerParticles.push({
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

function updateAndDrawParticles(defaultAutoRadius) {
  const {
    width,
    height,
    mousePos,
    cleanerPos,
    cleanerRadius,
    isLeftMouseDown,
    particles,
    transferParticles,
    splashParticles,
    autoCleanerParticles,
    floatingTexts
  } = state;

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

  if (isFull && !isPlayerInStation()) {
    overlayCtx.save();
    overlayCtx.font = '700 11px Outfit, sans-serif';
    overlayCtx.textAlign = 'center';
    overlayCtx.fillStyle = 'rgba(239, 68, 68, 0.95)';
    overlayCtx.fillText('FULL (Go to Station)', cleanerPos.x, labelY);
    overlayCtx.restore();
  } else if (isStoringActionActive()) {
    overlayCtx.save();
    overlayCtx.font = '700 11px Outfit, sans-serif';
    overlayCtx.textAlign = 'center';
    overlayCtx.fillStyle = 'rgba(74, 222, 128, 0.95)';
    overlayCtx.fillText('STORING...', cleanerPos.x, labelY);
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

  // Update and draw auto-cleaner transfer particles
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

  // Draw Station (Outline & Title)
  drawStation();

  // Draw active autonomous cleaners
  drawAutoCleaners(defaultAutoRadius);

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


/* ==================== renderer.js ==================== */
/**
 * Sweeping Incremental - WebGL Shader Pipeline, Mask Textures & 2D Canvas Entity Drawing
 */




const glCanvas = document.getElementById('glcanvas');
const overlayCanvas = document.getElementById('overlay-canvas');
const overlayCtx = overlayCanvas.getContext('2d');

// Default Vacuum Bot Images (B.O.B. Bottom & Top)
const bobBottomImg = new Image();
bobBottomImg.src = (Values.vacuum && Values.vacuum.bottomImage) || 'assets/icons/B.O.B. Bottom.png';

const bobTopImg = new Image();
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

function initTextures() {
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

function updateDustTexture() {
  if (!gl || !maskTexture) return;
  const dustPerPx = Values.room.dustPerPixel;
  for (let i = 0; i < state.TOTAL_PIXELS; i++) {
    state.dustBytes[i] = Math.min(255, Math.max(0, Math.floor((state.dustGrid[i] / dustPerPx) * 255.99)));
  }
  gl.bindTexture(gl.TEXTURE_2D, maskTexture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, state.GRID_RES, state.GRID_RES, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, state.dustBytes);
}

function updateDirtTexture() {
  if (!gl || !dirtTexture) return;
  const dirtPerPx = Values.room.dirtPerPixel;
  for (let i = 0; i < state.TOTAL_PIXELS; i++) {
    state.dirtBytes[i] = Math.min(255, Math.max(0, Math.floor((state.dirtGrid[i] / dirtPerPx) * 255.99)));
  }
  gl.bindTexture(gl.TEXTURE_2D, dirtTexture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, state.GRID_RES, state.GRID_RES, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, state.dirtBytes);
}

function resizeCanvases() {
  glCanvas.width = state.width * state.dpr;
  glCanvas.height = state.height * state.dpr;
  if (gl) {
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  }
  overlayCanvas.width = state.width;
  overlayCanvas.height = state.height;
}

function renderWebGL(time) {
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
function drawStation() {
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
function drawDefaultVacuum() {
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

function drawAutoCleaner(bot, defaultAutoRadius) {
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

function drawAutoCleaners(defaultAutoRadius) {
  for (let i = 0; i < state.autoCleaners.length; i++) {
    drawAutoCleaner(state.autoCleaners[i], defaultAutoRadius);
  }
}


/* ==================== simulation.js ==================== */
/**
 * Sweeping Incremental - Room Simulation, Organic Dirt Waves & Autonomous Cleaners
 */





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

function pruneDeadDirtZones() {
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
function generateInstantDirt(onUpdateUI) {
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

  while (state.currentScreenDirtGrams < maxDirt - 0.2 && attempts < 95) {
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

function updateDirtZones(dt, now, onUpdateUI) {
  if (!isDirtUnlocked()) return;

  const refillThreshold = getDirtRefillThreshold();
  if (state.currentScreenDirtGrams < refillThreshold) {
    generateInstantDirt(onUpdateUI);
  }
}

// --- Autonomous Mini Cleaners System ---
function getAutoVacuumRadius() {
  const sizeRatio = (Values.getAutoVacuumSizeRatio) ? Values.getAutoVacuumSizeRatio() : 0.025;
  return Math.max(5.0, state.roomSize * sizeRatio);
}

function getAutoVacuumSpeed() {
  const speedVal = (Values.getEffectiveAutoVacuumSpeed)
    ? Values.getEffectiveAutoVacuumSpeed()
    : ((Values.autoVacuum && Values.autoVacuum.speed != null) ? Values.autoVacuum.speed : 0.01);
  const screenDim = Math.min(state.width, state.height);
  return screenDim * speedVal;
}

function getAutoVacuumCapacity() {
  if (Values.getEffectiveAutoVacuumCapacity) {
    return Values.getEffectiveAutoVacuumCapacity();
  }
  return (Values.autoVacuum && Values.autoVacuum.capacity != null) ? Values.autoVacuum.capacity : 1.0;
}

function getAutoVacuumCleanRate() {
  if (Values.getEffectiveAutoVacuumCleanRate) {
    return Values.getEffectiveAutoVacuumCleanRate();
  }
  return (Values.autoVacuum && Values.autoVacuum.cleanRate != null) ? Values.autoVacuum.cleanRate : 0.1;
}

function syncAutoCleaners() {
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

function updateAutoCleanersSimulation(dt, now, onUpdateUI) {
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

        const storeMult = Values.getStoringResourceMultiplier ? Values.getStoringResourceMultiplier() : 1.0;
        const dustMult = (Values.getEffectiveDustMultiplier ? Values.getEffectiveDustMultiplier() : 1.0) * storeMult;
        const dirtMult = storeMult;
        Values.storage.dust = (Values.storage.dust || 0) + dustAmount * dustMult;
        Values.storage.dirt = (Values.storage.dirt || 0) + dirtAmount * dirtMult;

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
        if (state.stats) state.stats.totalStationUnloads = (state.stats.totalStationUnloads || 0) + 1;
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
        if (state.stats) {
          if (botDustGained > 0) state.stats.totalDustCollected += botDustGained;
          if (botDirtGained > 0) state.stats.totalDirtCleaned += botDirtGained;
        }
        if (state.currentPrestigeStats) {
          if (botDustGained > 0) state.currentPrestigeStats.totalDustCollected += botDustGained;
          if (botDirtGained > 0) state.currentPrestigeStats.totalDirtCleaned += botDirtGained;
        }
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

function updatePlayerAndRoomSimulation(dt, now, onUpdateUI) {
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

  if (state.stats) {
    state.stats.totalTimePlayed += dt;
  }
  if (state.currentPrestigeStats) {
    state.currentPrestigeStats.totalTimePlayed = (state.currentPrestigeStats.totalTimePlayed || 0) + dt;
  }

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

    const storeMult = Values.getStoringResourceMultiplier ? Values.getStoringResourceMultiplier() : 1.0;
    const dustMult = (Values.getEffectiveDustMultiplier ? Values.getEffectiveDustMultiplier() : 1.0) * storeMult;
    const dirtMult = storeMult;
    Values.storage.dust = (Values.storage.dust || 0) + transferDust * dustMult;
    Values.storage.dirt = (Values.storage.dirt || 0) + transferDirt * dirtMult;

    if (Values.vacuum.stored < 0.0001) {
      if (transferTotal > 0.001) {
        if (state.stats) {
          state.stats.totalStationUnloads = (state.stats.totalStationUnloads || 0) + 1;
        }
        if (state.currentPrestigeStats) {
          state.currentPrestigeStats.totalStationUnloads = (state.currentPrestigeStats.totalStationUnloads || 0) + 1;
        }
      }
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

      if (state.stats) {
        state.stats.totalDistanceTraveled += Math.hypot(cleanerPos.x - prevCleanerPos.x, cleanerPos.y - prevCleanerPos.y);
      }
      if (state.currentPrestigeStats) {
        state.currentPrestigeStats.totalDistanceTraveled = (state.currentPrestigeStats.totalDistanceTraveled || 0) + Math.hypot(cleanerPos.x - prevCleanerPos.x, cleanerPos.y - prevCleanerPos.y);
      }

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
        if (state.stats) {
          if (dustGained > 0) state.stats.totalDustCollected += dustGained;
          if (dirtCleanedGrams > 0) state.stats.totalDirtCleaned += dirtCleanedGrams;
        }
        if (state.currentPrestigeStats) {
          if (dustGained > 0) state.currentPrestigeStats.totalDustCollected += dustGained;
          if (dirtCleanedGrams > 0) state.currentPrestigeStats.totalDirtCleaned += dirtCleanedGrams;
        }
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

Values.updatePlayerAndRoomSimulation = updatePlayerAndRoomSimulation;
Values.updateAutoCleanersSimulation = updateAutoCleanersSimulation;


/* ==================== ui.js ==================== */
/**
 * Sweeping Incremental - HUD, Notifications, Storage Indicators & Circular Shop Carousel UI
 */






// --- DOM Elements ---
const dom = {
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

function getClosestCardToCenter() {
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

function updateCarouselPositions() {
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

function rotateCarouselByStep(direction) {
  if (!state.isShopOpen || carouselCards.length <= 1) return;
  dismissCarouselHint();
  const step = carouselStepAngle || (Math.PI / 6);
  carouselTargetAngle = carouselAngle - direction * step;
  isCenteringCard = true;
  carouselAngleVelocity = 0;
  startCarouselLoop();
}

function initCarouselEvents() {
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
function initShopUI(keyToCenter) {
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

function buyUpgrade(key, shopKey) {
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
function updateUpgradesAndShopUI() {
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
function updateCapacityAndStorageUI() {
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
function calculateCleanedPercentage() {
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

function showMilestoneToast(milestone) {
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

function showResetToast() {
  if (dom.toast && dom.toastText) {
    dom.toastText.textContent = '🔄 Game progress reset!';
    dom.toast.classList.remove('hidden');
    setTimeout(() => {
      dom.toast.classList.add('hidden');
    }, 3000);
  }
}

function fadeOutHint() {
  if (dom.hintOverlay) {
    dom.hintOverlay.classList.add('fade-out');
  }
}

// Dirt Shop visibility helper (only displayed when Dirt is unlocked)
function updateDirtShopVisibility() {
  if (!dom.dirtShopBtn) return;
  const isUnlocked = isDirtUnlocked();
  dom.dirtShopBtn.classList.toggle('hidden', !isUnlocked);
  dom.dirtShopBtn.style.display = isUnlocked ? 'flex' : 'none';
}

// Shop Management & Cards Tray (Supports Dust Shop and Dirt Shop)
function openShop(shopKey) {
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

function closeShop() {
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

function toggleShop(targetShop) {
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

function initShopButtonListeners() {
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

function getTotalDustCollected() {
  const currentDust = (Values.storage.dust || 0) + (Values.vacuum.storedDust || 0) + (stationStorage ? stationStorage.dust : 0);
  const tracked = (state.stats && typeof state.stats.totalDustCollected === 'number') ? state.stats.totalDustCollected : 0;
  return Math.max(tracked, currentDust);
}

function getTotalDirtCleaned() {
  const currentDirt = (Values.storage.dirt || 0) + (Values.vacuum.storedDirt || 0) + (stationStorage ? stationStorage.dirt : 0);
  const tracked = (state.stats && typeof state.stats.totalDirtCleaned === 'number') ? state.stats.totalDirtCleaned : 0;
  return Math.max(tracked, currentDirt);
}

function getCurrentPrestigeDirtCleaned() {
  const tracked = (state.currentPrestigeStats && typeof state.currentPrestigeStats.totalDirtCleaned === 'number')
    ? state.currentPrestigeStats.totalDirtCleaned
    : 0;
  const currentDirt = (Values.storage.dirt || 0) + (Values.vacuum.storedDirt || 0) + (stationStorage ? stationStorage.dirt : 0);
  return Math.max(tracked, currentDirt);
}

function getCurrentPrestigeDustCollected() {
  const tracked = (state.currentPrestigeStats && typeof state.currentPrestigeStats.totalDustCollected === 'number')
    ? state.currentPrestigeStats.totalDustCollected
    : 0;
  const currentDust = (Values.storage.dust || 0) + (Values.vacuum.storedDust || 0) + (stationStorage ? stationStorage.dust : 0);
  return Math.max(tracked, currentDust);
}

function getTotalUpgradesBought() {
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

function updateSoundUI() {
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

function updateConfigsStatsUI() {
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

function switchConfigsTab(tabName) {
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

function openConfigsModal(tab) {
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

function closeConfigsModal() {
  state.isConfigsOpen = false;
  state.isLeftMouseDown = false;
  state.isRightMouseDown = false;

  if (dom.configsModalOverlay) {
    dom.configsModalOverlay.classList.add('hidden');
  }
}

function toggleConfigsModal(tab) {
  if (state.isConfigsOpen) {
    closeConfigsModal();
  } else {
    openConfigsModal(tab);
  }
}

function initConfigsListeners(handleResetCallback) {
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


/* ==================== settings.js ==================== */
/**
 * Sweeping Incremental - Save/Load Persistence, Game Reset & Audio/Settings Controls
 */






function saveGame() {
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
      },
      lifetimeStats: {
        totalDustCollected: Number(state.stats ? state.stats.totalDustCollected : 0) || 0,
        totalDirtCleaned: Number(state.stats ? state.stats.totalDirtCleaned : 0) || 0,
        totalDistanceTraveled: Number(state.stats ? state.stats.totalDistanceTraveled : 0) || 0,
        totalTimePlayed: Number(state.stats ? state.stats.totalTimePlayed : 0) || 0,
        totalStationUnloads: Number(state.stats ? state.stats.totalStationUnloads : 0) || 0,
        totalClicks: Number(state.stats ? state.stats.totalClicks : 0) || 0
      },
      currentPrestigeStats: {
        totalDirtCleaned: Number(state.currentPrestigeStats ? state.currentPrestigeStats.totalDirtCleaned : 0) || 0,
        totalDustCollected: Number(state.currentPrestigeStats ? state.currentPrestigeStats.totalDustCollected : 0) || 0,
        totalDistanceTraveled: Number(state.currentPrestigeStats ? state.currentPrestigeStats.totalDistanceTraveled : 0) || 0,
        totalTimePlayed: Number(state.currentPrestigeStats ? state.currentPrestigeStats.totalTimePlayed : 0) || 0,
        totalStationUnloads: Number(state.currentPrestigeStats ? state.currentPrestigeStats.totalStationUnloads : 0) || 0,
        totalClicks: Number(state.currentPrestigeStats ? state.currentPrestigeStats.totalClicks : 0) || 0
      },
      prestige: {
        unlocked: !!(state.prestige && state.prestige.unlocked),
        pp: Number(state.prestige ? state.prestige.pp : 0) || 0,
        totalPP: Number(state.prestige ? state.prestige.totalPP : 0) || 0,
        count: Number(state.prestige ? state.prestige.count : 0) || 0,
        justPrestiged: !!(state.prestige && state.prestige.justPrestiged),
        purchased: state.prestige && state.prestige.purchased ? Array.from(state.prestige.purchased) : [],
        upgradeLevels: state.prestige && state.prestige.upgradeLevels ? { ...state.prestige.upgradeLevels } : {}
      }
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  } catch (err) {
    console.warn('Could not save game to localStorage:', err);
  }
}

function loadGame() {
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

    // Restore lifetime statistics
    const lifetimeSrc = data.lifetimeStats || data.stats;
    if (lifetimeSrc && state.stats) {
      state.stats.totalDustCollected = Math.max(0, Number(lifetimeSrc.totalDustCollected) || 0);
      state.stats.totalDirtCleaned = Math.max(0, Number(lifetimeSrc.totalDirtCleaned) || 0);
      state.stats.totalDistanceTraveled = Math.max(0, Number(lifetimeSrc.totalDistanceTraveled) || 0);
      state.stats.totalTimePlayed = Math.max(0, Number(lifetimeSrc.totalTimePlayed) || 0);
      state.stats.totalStationUnloads = Math.max(0, Number(lifetimeSrc.totalStationUnloads) || 0);
      state.stats.totalClicks = Math.max(0, Number(lifetimeSrc.totalClicks) || 0);
    }

    // Restore current prestige statistics separately
    if (!state.currentPrestigeStats) {
      state.currentPrestigeStats = {
        totalDirtCleaned: 0.0,
        totalDustCollected: 0.0,
        totalDistanceTraveled: 0.0,
        totalTimePlayed: 0.0,
        totalStationUnloads: 0,
        totalClicks: 0
      };
    }
    if (data.currentPrestigeStats) {
      state.currentPrestigeStats.totalDirtCleaned = Math.max(0, Number(data.currentPrestigeStats.totalDirtCleaned) || 0);
      state.currentPrestigeStats.totalDustCollected = Math.max(0, Number(data.currentPrestigeStats.totalDustCollected) || 0);
      state.currentPrestigeStats.totalDistanceTraveled = Math.max(0, Number(data.currentPrestigeStats.totalDistanceTraveled) || 0);
      state.currentPrestigeStats.totalTimePlayed = Math.max(0, Number(data.currentPrestigeStats.totalTimePlayed) || 0);
      state.currentPrestigeStats.totalStationUnloads = Math.max(0, Number(data.currentPrestigeStats.totalStationUnloads) || 0);
      state.currentPrestigeStats.totalClicks = Math.max(0, Number(data.currentPrestigeStats.totalClicks) || 0);
    } else {
      if (data.prestige && data.prestige.count > 0) {
        state.currentPrestigeStats.totalDirtCleaned = Math.max(0, Number(data.storage && data.storage.dirt) || 0);
        state.currentPrestigeStats.totalDustCollected = Math.max(0, Number(data.storage && data.storage.dust) || 0);
      } else {
        state.currentPrestigeStats.totalDirtCleaned = state.stats.totalDirtCleaned;
        state.currentPrestigeStats.totalDustCollected = state.stats.totalDustCollected;
      }
    }

    // Restore prestige state & apply purchased prestige upgrade effects
    if (state.prestige) {
      if (data.prestige) {
        state.prestige.unlocked = !!data.prestige.unlocked;
        state.prestige.pp = Math.max(0, Number(data.prestige.pp) || 0);
        state.prestige.totalPP = Math.max(0, Number(data.prestige.totalPP) || 0);
        state.prestige.count = Math.max(0, Number(data.prestige.count) || 0);
        state.prestige.justPrestiged = !!data.prestige.justPrestiged;
        state.prestige.purchased = new Set(Array.isArray(data.prestige.purchased) ? data.prestige.purchased : []);
        state.prestige.upgradeLevels = (data.prestige.upgradeLevels && typeof data.prestige.upgradeLevels === 'object')
          ? { ...data.prestige.upgradeLevels }
          : {};
        for (const pid of state.prestige.purchased) {
          if (!state.prestige.upgradeLevels[pid]) {
            state.prestige.upgradeLevels[pid] = 1;
          }
        }
      }
      if (typeof Values.applyPrestigeEffects === 'function') {
        Values.applyPrestigeEffects();
      }
    }

    return true;
  } catch (err) {
    console.warn('Could not load game from localStorage:', err);
    return false;
  }
}

function handleResetRequest() {
  state.isLeftMouseDown = false;
  const confirmed = window.confirm('Reset all game progress? This will reset all storage, bots, and upgrades.');
  if (confirmed) {
    resetGame();
  }
}

function resetGame() {
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
  if (state.currentPrestigeStats) {
    state.currentPrestigeStats.totalDirtCleaned = 0.0;
    state.currentPrestigeStats.totalDustCollected = 0.0;
    state.currentPrestigeStats.totalDistanceTraveled = 0.0;
    state.currentPrestigeStats.totalTimePlayed = 0.0;
    state.currentPrestigeStats.totalStationUnloads = 0;
    state.currentPrestigeStats.totalClicks = 0;
  }
  if (state.prestige) {
    state.prestige.unlocked = false;
    state.prestige.pp = 0;
    state.prestige.totalPP = 0;
    state.prestige.count = 0;
    state.prestige.justPrestiged = false;
    if (state.prestige.purchased) state.prestige.purchased.clear();
    state.prestige.upgradeLevels = {};
  }
  if (typeof Values.applyPrestigeEffects === 'function') {
    Values.applyPrestigeEffects();
  }
  if (typeof Values.closePrestigeTree === 'function') {
    Values.closePrestigeTree();
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

function initSettingsListeners() {
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

function startAutoSave() {
  setInterval(saveGame, 2000);
  window.addEventListener('beforeunload', saveGame);
  window.addEventListener('pagehide', saveGame);
}

// Expose save, load, and reset on Values for console access
Values.saveGame = saveGame;
Values.loadGame = loadGame;
Values.resetGame = resetGame;


/* ==================== prestige.js ==================== */
/**
 * Sweeping Incremental - Prestige System & Interactive Physics Prestige Tree UI
 *
 * Handles prestige unlocking (10g lifetime total dirt), PP calculation ((tt dirt / 10)^1.5),
 * prestige resets, automatic force-directed initial tree layout, physics-based draggable
 * upgrade bubbles with momentum and collision/repulsion, live attached connection bars,
 * node purchasing, and persistent upgrade effects driven by js/prestigeData.js.
 */









const PRESTIGE_UNLOCK_DIRT = 10; // 10g lifetime total dirt (tt dirt)
const PRESTIGE_UNLOCK_DUST = 10; // Alias kept for compatibility
const PRESTIGE_NODE_DIAMETER = 72; // Circular node diameter in px
const PRESTIGE_BAR_LENGTH = PRESTIGE_NODE_DIAMETER * 2; // Connection bar length is 2x node diameter (144px visible)
const PRESTIGE_CENTER_LINK_DIST = PRESTIGE_NODE_DIAMETER + PRESTIGE_BAR_LENGTH; // Center-to-center link distance (216px)

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
function getPrestigeUpgrades() {
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

function getPrestigeUpgradeById(id) {
  if (!id) return null;
  const list = getPrestigeUpgrades();
  return list.find((u) => u.id === id) || null;
}

/**
 * Format PP number cleanly (integer if whole, otherwise up to 2 decimals)
 */
function formatPP(val) {
  const num = Math.max(0, Number(val) || 0);
  if (Math.abs(num - Math.round(num)) < 1e-5) {
    return String(Math.round(num));
  }
  return Number(num.toFixed(2)).toString();
}

/**
 * Calculate PP gained from current prestige total dirt: PP = (current prestige tt dirt / 10)^1.5
 */
function calculatePrestigePP(currentPrestigeDirt) {
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

function getPendingPrestigePP() {
  const currentRunDirt = getCurrentPrestigeDirtCleaned();
  if (currentRunDirt < PRESTIGE_UNLOCK_DIRT - 1e-6) return 0;
  return calculatePrestigePP(currentRunDirt);
}

/**
 * Check if the prestige requirement is met (10g total dirt collected during current prestige run)
 */
function isPrestigeRequirementMet() {
  return getCurrentPrestigeDirtCleaned() >= PRESTIGE_UNLOCK_DIRT - 1e-6;
}

function canPerformPrestige() {
  return isPrestigeRequirementMet();
}

/**
 * Check if prestige requirement is met for current run
 */
function isPrestigeUnlocked() {
  if (!state.prestige) return false;
  return isPrestigeRequirementMet();
}

/**
 * Check if the Prestige Tree itself has been unlocked/accessed (persists so player can view tree & spend PP)
 */
function isPrestigeTreeUnlocked() {
  if (!state.prestige) return false;
  if (state.prestige.treeUnlocked) return true;
  if (state.prestige.count > 0 || (state.prestige.pp || 0) > 0) return true;
  if (state.prestige.purchased && state.prestige.purchased.size > 0) return true;
  return isPrestigeRequirementMet();
}

function getPrestigeUpgradeLevel(id) {
  if (!state.prestige) return 0;
  if (state.prestige.upgradeLevels && typeof state.prestige.upgradeLevels[id] === 'number') {
    return state.prestige.upgradeLevels[id];
  }
  if (state.prestige.purchased && state.prestige.purchased.has(id)) {
    return 1;
  }
  return 0;
}

function isPrestigeUpgradePurchased(id) {
  if (!state.prestige) return false;
  if (getPrestigeUpgradeLevel(id) >= 1) return true;
  return !!(state.prestige.purchased && state.prestige.purchased.has(id));
}

function isPrestigeUpgradeMaxed(id) {
  const upg = getPrestigeUpgradeById(id);
  if (!upg) return false;
  const maxLvl = upg.maxLevel || 1;
  return getPrestigeUpgradeLevel(id) >= maxLvl;
}

function getPrestigeUpgradeCost(upgOrId) {
  const upg = typeof upgOrId === 'string' ? getPrestigeUpgradeById(upgOrId) : upgOrId;
  if (!upg) return Infinity;
  const curLvl = getPrestigeUpgradeLevel(upg.id);
  const maxLvl = upg.maxLevel || 1;
  if (curLvl >= maxLvl) return Infinity;
  const base = (upg.baseCost != null) ? upg.baseCost : (upg.cost || 0);
  const mult = upg.costMultiplier || 1.0;
  return base * Math.pow(mult, curLvl);
}

function arePrestigeRequirementsMet(upg) {
  const target = typeof upg === 'string' ? getPrestigeUpgradeById(upg) : upg;
  if (!target) return false;
  if (!target.requirements || target.requirements.length === 0) return true;
  for (const reqId of target.requirements) {
    if (!isPrestigeUpgradePurchased(reqId)) return false;
  }
  return true;
}

function canPurchasePrestigeUpgrade(id) {
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
function applyPrestigeEffects() {
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
function ensureFreeRootUpgradesUnlocked() {
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
function buyPrestigeUpgrade(id) {
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
function performPrestige() {
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
function computePrestigeTreeLayout(upgrades, nodeDiameter = PRESTIGE_NODE_DIAMETER) {
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
function stepTreePhysics() {
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
function syncTreeDOMPositions() {
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
function renderPrestigeTree() {
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
function updatePrestigeTreeUI() {
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
function updatePrestigeButtonVisibility() {
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
function openPrestigeTree() {
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

function closePrestigeTree() {
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

function togglePrestigeTree() {
  if (state.isPrestigeTreeOpen) {
    closePrestigeTree();
  } else {
    openPrestigeTree();
  }
}

/**
 * Initialize event listeners for the Prestige Tree interface & dock button
 */
function initPrestigeListeners() {
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


/* ==================== main.js ==================== */
/**
 * Sweeping Incremental - Main Application Entry Point, Input Handling & Game Loop
 */










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
const UI_INTERACTIVE_SELECTOR = 'button, .menu-square-btn, .upgrade-card, .shop-cards-tray, .hud-top-right, .robot-storage-sidebar, .storage-center-right, [role="button"], #configs-modal-overlay, .configs-modal-card, input[type="range"], #prestige-tree-overlay, .prestige-node';

function onMouseDown(e) {
  // Prevent vacuum movement/cleaning when clicking buttons, upgrade cards, or UI controls
  if (state.isPrestigeTreeOpen || (e.target && e.target.closest(UI_INTERACTIVE_SELECTOR))) {
    state.isLeftMouseDown = false;
    return;
  }

  if (state.stats) {
    state.stats.totalClicks = (state.stats.totalClicks || 0) + 1;
  }
  if (state.currentPrestigeStats) {
    state.currentPrestigeStats.totalClicks = (state.currentPrestigeStats.totalClicks || 0) + 1;
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
      if (state.isPrestigeTreeOpen) {
        closePrestigeTree();
      } else if (state.isConfigsOpen) {
        closeConfigsModal();
      } else {
        closeShop();
      }
    } else if (e.key === 'p' || e.key === 'P') {
      togglePrestigeTree();
    } else if (e.key === 'c' || e.key === 'C') {
      toggleConfigsModal();
    } else if (e.key === 'm' || e.key === 'M') {
      if (dom.soundBtn) dom.soundBtn.click();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      state.isSpaceHeld = false;
    }
  });

  initShopButtonListeners();
  initSettingsListeners();
  initPrestigeListeners();
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

  // Update Configs Stats UI if modal is open
  if (state.isConfigsOpen) {
    updateConfigsStatsUI();
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
  applyPrestigeEffects();

  state.cleanerAngle = Math.PI * 0.5;
  Values.cleanerAngle = state.cleanerAngle;
  updateRoomGeometry();
  if (!initWebGL()) return;
  initTextures();
  updateDirtShopVisibility();
  updatePrestigeButtonVisibility();
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


})();
