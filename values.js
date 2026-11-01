/**
 * Sweeping Incremental - Central Game Configuration & Dynamic State Values
 * All core numeric values, capacities, rates, and upgrade configurations in one variable.
 */

var Values = {
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
    topVisualOffset: 0.2, // Visual vertical offset of the top lid (fraction of vacuum radius, e.g. 0.15 = 15% up)
    rotateWithMovement: true, // Whether the vacuum rotates to face movement direction
    bottomImage: "Assets/Icons/B.O.B. Bottom.png", // Bottom/base sprite image
    topImage: "Assets/Icons/B.O.B. Top.png"         // Top/lid sprite image
  },

  // Automatic Vacuum Robot Configuration
  autoVacuum: {
    cleanRate: 0.1,    // Rate of cleaning distributed across pixels under vacuum (g/s)
    capacity: 5.0,     // Base vacuum canister capacity (g)
    stored: 0,         // Current total mass in canister (dust + dirt)
    storedDust: 0,     // Current dust mass in canister (g)
    storedDirt: 0,     // Current dirt mass in canister (g)
    speed: 0.02,       // Base movement speed ratio (fraction of screen dimension per second)
    size: 0.25,        // Size ratio (0.25 corresponds to 2.5% of room dimension in getSizeRatio, half of main vacuum)
    topVisualOffset: 0.15, // Visual vertical offset of the top lid (fraction of vacuum radius)
    bottomImage: "Assets/Icons/B.O.B. Bottom.png",
    topImage: "Assets/Icons/B.O.B. Top.png"
  },

  // Station Configuration (Docking Station on right)
  station: {
    capacity: 50.0,     // Station storage tank capacity in grams (50g)
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
      return this.dustCapacity / this.totalPixels;
    },
    // Exact grams of dirt per pixel for full dirt pixels (e.g. 0.1g/px)
    get dirtPerPixel() {
      return this.dustPerPixel;
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
          return `${upg.level} Active`;
        }
      }
    },
    dirtShop: {
      suckZone: {
        name: "Suck Zone",
        image: "Assets/Upgrades/Dirt/Suck Zone.png",
        currency: "dirt",
        require: { upgrade: "dirt", level: 1 }, // Requires Dirt level 1 to see this upgrade
        effect: 0.2,
        cost: 1.0,
        mult: 10.0,
        level: 0,
        getDesc(upg) {
          return `+${(upg.effect * 100).toFixed(0)}% suck zone radius`;
        },
        getEffect(upg) {
          return `+${(upg.level * upg.effect * 100).toFixed(0)}% Suck Zone`;
        },
        getStat(upg) {
          return `${(Values.getEffectiveSuckMultiplier() * 100).toFixed(0)}%`;
        }
      }
    }
  },

  // --- Dynamic Multiplier & Calculation Helpers ---

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
    return (this.autoVacuum && this.autoVacuum.cleanRate != null) ? this.autoVacuum.cleanRate : 0.1;
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

  // Effective suck zone radius multiplier (1.0 + level * 0.20)
  getEffectiveSuckMultiplier() {
    const upg = (this.shops.dirtShop && this.shops.dirtShop.suckZone) ||
                (this.shops.dirtShop && this.shops.dirtShop.SuckZone) ||
                (this.shops.dustShop && this.shops.dustShop.suckZone);
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
  getUpgradeCost(upgradeKey) {
    if (!upgradeKey) return 0;
    const key = upgradeKey.toLowerCase();
    let upg = (this.shops.dustShop && (this.shops.dustShop[upgradeKey] || this.shops.dustShop[key])) ||
              (this.shops.dirtShop && (this.shops.dirtShop[upgradeKey] || this.shops.dirtShop[key]));
    if (!upg) {
      const alias = key === 'cleanrate' ? 'efficiency' :
                    (key === 'capacitymult' ? 'capacity' :
                    (key === 'storingspeed' || key === 'storing speed' || key === 'storing_speed' ? 'storingSpeed' :
                    (key === 'suckzone' || key === 'suck zone' || key === 'suck_zone' ? 'suckZone' :
                    (key === 'autocleaner' || key === 'auto cleaner' || key === 'auto_cleaner' ? 'autoCleaner' : key))));
      upg = (this.shops.dustShop && this.shops.dustShop[alias]) ||
            (this.shops.dirtShop && this.shops.dirtShop[alias]);
    }
    if (!upg) return 0;
    if (upg.isUnlock && upg.level >= 1) return Infinity;
    if (upg.maxLevel && upg.level >= upg.maxLevel) return Infinity;
    return upg.cost * Math.pow(upg.mult || 1, upg.level);
  },

  // Look up an upgrade object by key or alias across all shops
  getUpgrade(upgradeKey) {
    if (!upgradeKey) return null;
    const key = upgradeKey.toLowerCase();
    for (const shopName of Object.keys(this.shops)) {
      const shop = this.shops[shopName];
      if (!shop) continue;
      if (shop[upgradeKey]) return shop[upgradeKey];
      if (shop[key]) return shop[key];
      const alias = key === 'cleanrate' ? 'efficiency' :
                    (key === 'capacitymult' ? 'capacity' :
                    (key === 'storingspeed' || key === 'storing speed' || key === 'storing_speed' ? 'storingSpeed' :
                    (key === 'suckzone' || key === 'suck zone' || key === 'suck_zone' ? 'suckZone' :
                    (key === 'autocleaner' || key === 'auto cleaner' || key === 'auto_cleaner' ? 'autoCleaner' : key))));
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

  // Normalized vacuum radius ratio (1% of room dimension)
  getSizeRatio() {
    return this.vacuum.size >= 0.05 ? (this.vacuum.size * 0.1) : this.vacuum.size;
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
