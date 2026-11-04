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
    dirtCapacity: 10,   // Full room max dirt on screen in grams (100g)
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
          return upg.level === 0
            ? "Unlocks organic dirt zones up to 100g"
            : "Organic dirt zones active (generates up to 100g)";
        },
        getEffect(upg) {
          return upg.level === 0 ? "Unlock Dirt" : "Dirt Active";
        },
        getStat(upg) {
          return upg.level === 0 ? "Locked" : "100g Max";
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

  // --- Dynamic Multiplier & Calculation Helpers ---

  // Total active auto cleaners across both Dust Shop and Dirt Shop (up to 3 + 3 = 6 bots!)
  getTotalAutoCleanersCount() {
    const dustUpg = this.shops.dustShop && (this.shops.dustShop.autoCleaner || this.shops.dustShop['Auto Cleaner']);
    const dirtUpg = this.shops.dirtShop && (this.shops.dirtShop.autoCleaner || this.shops.dirtShop['Auto Cleaner']);
    const count = (dustUpg ? dustUpg.level : 0) + (dirtUpg ? dirtUpg.level : 0);
    return count;
  },

  // Effective dust multiplier applied when storing/selling dust (1.0 + level * 0.50)
  getEffectiveDustMultiplier() {
    const upg = (this.shops.dirtShop && (this.shops.dirtShop.moreDust || this.shops.dirtShop.MoreDust)) ||
                (this.shops.dustShop && (this.shops.dustShop.moreDust || this.shops.dustShop.MoreDust));
    const effect = (upg && upg.dustMultEffect != null) ? upg.dustMultEffect : 0.5;
    const multiplier = 1.0 + (upg ? (upg.level * effect) : 0);
    return multiplier;
  },

  // Effective dust density multiplier for grams per pixel (1.0 + level * 0.30)
  getEffectiveDustDensityMultiplier() {
    const upg = (this.shops.dirtShop && (this.shops.dirtShop.moreDust || this.shops.dirtShop.MoreDust)) ||
                (this.shops.dustShop && (this.shops.dustShop.moreDust || this.shops.dustShop.MoreDust));
    const effect = (upg && upg.dustDensityEffect != null) ? upg.dustDensityEffect : 0.3;
    const multiplier = 1.0 + (upg ? (upg.level * effect) : 0);
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
    const multiplier = 1.0 + (upg ? (upg.level * upg.effect) : 0);
    return this.vacuum.speed * multiplier;
  },

  // Effective cleaning rate in g/s distributed across pixels under vacuum
  getEffectiveCleanRate() {
    const upg = this.shops.dustShop.efficiency || this.shops.dustShop.CleanRate || this.shops.dustShop.Efficiency;
    const multiplier = upg ? (1.0 + (upg.level * upg.effect)) : 1.0;
    return (this.vacuum.cleanRate != null ? this.vacuum.cleanRate : 0.1) * multiplier;
  },

  // Effective auto vacuum cleaning rate in g/s distributed across pixels under vacuum
  getEffectiveAutoVacuumCleanRate() {
    const upg = (this.shops.dirtShop && (this.shops.dirtShop.autoEfficiency || this.shops.dirtShop.AutoEfficiency)) ||
                (this.shops.dustShop && (this.shops.dustShop.autoEfficiency || this.shops.dustShop.AutoEfficiency));
    const multiplier = 1.0 + (upg ? (upg.level * upg.effect) : 0);
    const baseRate = (this.autoVacuum && this.autoVacuum.cleanRate != null) ? this.autoVacuum.cleanRate : 0.1;
    return baseRate * multiplier;
  },

  // Effective auto vacuum canister capacity in grams (1.0 * (1 + level * 0.5))
  getEffectiveAutoVacuumCapacity() {
    const upg = (this.shops.dirtShop && (this.shops.dirtShop.autoCapacity || this.shops.dirtShop.AutoCapacity)) ||
                (this.shops.dustShop && (this.shops.dustShop.autoCapacity || this.shops.dustShop.AutoCapacity));
    const multiplier = 1.0 + (upg ? (upg.level * upg.effect) : 0);
    const baseCap = (this.autoVacuum && this.autoVacuum.capacity != null) ? this.autoVacuum.capacity : 1.0;
    return baseCap * multiplier;
  },

  // Effective auto vacuum movement speed ratio (0.01 * (1 + level * 0.5))
  getEffectiveAutoVacuumSpeed() {
    const upg = (this.shops.dirtShop && (this.shops.dirtShop.autoSpeed || this.shops.dirtShop.AutoSpeed)) ||
                (this.shops.dustShop && (this.shops.dustShop.autoSpeed || this.shops.dustShop.AutoSpeed));
    const multiplier = 1.0 + (upg ? (upg.level * upg.effect) : 0);
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
    const multiplier = 1.0 + (upg ? (upg.level * upg.effect) : 0);
    return this.vacuum.capacity * multiplier;
  },

  // Effective store rate in g/s (e.g. 100 * (1 + level * 0.5))
  getEffectiveStoreRate() {
    const upg = this.shops.dustShop.storingSpeed || this.shops.dustShop['storing speed'] || this.shops.dustShop.storing_speed || this.shops.dustShop.StoringSpeed;
    const multiplier = 1.0 + (upg ? (upg.level * upg.effect) : 0);
    return (this.vacuum.storeRate != null ? this.vacuum.storeRate : 1.0) * multiplier;
  },

  // Effective vacuum size multiplier (1.0 + level * 0.20)
  getEffectiveSizeMultiplier() {
    const upg = (this.shops.dirtShop && (this.shops.dirtShop.size || this.shops.dirtShop.Size)) ||
                (this.shops.dustShop && (this.shops.dustShop.size || this.shops.dustShop.Size));
    const multiplier = 1.0 + (upg ? (upg.level * upg.effect) : 0);
    return multiplier;
  },

  // Dirt refill trigger threshold in grams (e.g. 100g * 0.70 = 70g)
  getDirtRefillThreshold() {
    const thresholdPct = (this.dirt && this.dirt.refillThresholdPercent != null) ? this.dirt.refillThresholdPercent : 0.70;
    return this.room.dirtCapacity * thresholdPct;
  },

  // Max dirt on screen in grams (e.g. 100g * 1.00 = 100g)
  getMaxDirt() {
    const maxPct = (this.dirt && this.dirt.maxCapPercent != null) ? this.dirt.maxCapPercent : 1.00;
    return this.room.dirtCapacity * maxPct;
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
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.6, this.ctx.currentTime);
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
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.6, this.ctx.currentTime, 0.05);
    }
    return !this.isMuted;
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
  resetBtn: document.getElementById('reset-btn'),
  hintOverlay: document.getElementById('hint-overlay'),
  toast: document.getElementById('toast'),
  toastText: document.getElementById('toast-text'),

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
      isMuted: !!(window.soundEngine && window.soundEngine.isMuted)
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

    // Restore audio mute if saved
    if (typeof data.isMuted === 'boolean' && window.soundEngine) {
      window.soundEngine.isMuted = data.isMuted;
      if (dom.soundIcon) dom.soundIcon.textContent = data.isMuted ? '🔇' : '🔊';
      if (dom.soundBtn) dom.soundBtn.title = data.isMuted ? 'Unmute Sound (M)' : 'Mute Sound (M)';
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

  if (window.soundEngine) {
    window.soundEngine.resume();
  }

  showResetToast();
}

function initSettingsListeners() {
  const { soundBtn, soundIcon, resetBtn } = dom;

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
        const unmuted = window.soundEngine.toggleMute();
        if (soundIcon) soundIcon.textContent = unmuted ? '🔊' : '🔇';
        soundBtn.title = unmuted ? 'Mute Sound (M)' : 'Unmute Sound (M)';
        saveGame();
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
    resetBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
    });
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.isLeftMouseDown = false;
      handleResetRequest();
    });
  }
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


})();
