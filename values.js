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
    cleanRate: 100,    // Rate of cleaning distributed across pixels under vacuum (g/s)
    storeRate: 100,    // Transfer rate into infinite storage while holding Space (g/s)
    capacity: 100,     // Base vacuum canister capacity (g)
    stored: 0,         // Current total mass in canister (dust + dirt)
    storedDust: 0,     // Current dust mass in canister (g)
    storedDirt: 0,     // Current dirt mass in canister (g)
    speed: 0.5,       // Base movement speed ratio (fraction of screen dimension per second)
    size: 0.5          // Size ratio (0.1 corresponds to 1% of room dimension in getSizeRatio)
  },

  // Room Geometry, Resolution & Mass Calibration
  room: {
    gridRes: 1000,        // Grid resolution (100 x 100 pixels = 10,000 pixels)
    dustCapacity: 1000,  // Full room total dust capacity in grams (1 Kg = 1000g)
    dirtCapacity: 100,   // Full room max dirt on screen in grams (100g)
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
    refillThresholdPercent: 0.70, // When dirt falls below 70% of max (70g), refill wave triggers
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
        effect: 0.5,
        cost: 0.5,
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
        effect: 0.5,
        cost: 0.5,
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
      suckZone: {
        name: "Suck Zone",
        image: "Assets/Upgrades/Dust/Suck Zone.png",
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
      },
      dirt: {
        name: "Dirt",
        image: "Assets/Upgrades/Dust/Dirt.png",
        isUnlock: true,
        maxLevel: 1,
        effect: 1.0,
        cost: 0.5,
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
    const upg = this.shops.dustShop.suckZone || this.shops.dustShop['suck zone'] || this.shops.dustShop.suck_zone || this.shops.dustShop.SuckZone;
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
    const upg = this.shops.dustShop[upgradeKey] ||
                this.shops.dustShop[key] ||
                this.shops.dustShop[key === 'cleanrate' ? 'efficiency' :
                                   (key === 'capacitymult' ? 'capacity' :
                                   (key === 'storingspeed' || key === 'storing speed' || key === 'storing_speed' ? 'storingSpeed' :
                                   (key === 'suckzone' || key === 'suck zone' || key === 'suck_zone' ? 'suckZone' : key)))];
    if (!upg) return 0;
    if (upg.isUnlock && upg.level >= 1) return Infinity;
    return upg.cost * Math.pow(upg.mult || 1, upg.level);
  },

  // Normalized vacuum radius ratio (1% of room dimension)
  getSizeRatio() {
    return this.vacuum.size >= 0.05 ? (this.vacuum.size * 0.1) : this.vacuum.size;
  }
};

// Expose globally for browser and node environments
if (typeof window !== 'undefined') {
  window.Values = Values;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Values;
}
