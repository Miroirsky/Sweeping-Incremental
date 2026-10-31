/**
 * Sweeping Incremental - Central Game Configuration & Dynamic State Values
 * All core numeric values, capacities, rates, and upgrade configurations in one variable.
 */

var Values = {
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
  vacuum: {
    storeRate: 1,
    capacity: 0.5,
    stored: 0,
    storedDust: 0,
    storedDirt: 0,
    speed: 0.01,
    size: 0.1
  },
  room: {
    dustCapacity: 1000,
    dirtCapacity: 100
  },
  shops: {
    dustShop: {
      Speed: {
        name: "Vacuum Speed",
        effect: 0.5,
        cost: 0.5,
        mult: 1.5,
        level: 0,
        getDesc(upg) {
          return `+${(upg.effect * 1.0).toFixed(1)}% screen/s movement speed`;
        },
        getStat(upg) {
          return `${(Values.getEffectiveSpeed() * 100).toFixed(1)}% / s`;
        }
      },
      CapacityMult: {
        name: "Capacity Mult",
        effect: 0.5,
        cost: 0.5,
        mult: 1.5,
        level: 0,
        getDesc(upg) {
          return `+${(upg.effect * 100).toFixed(0)}% canister space multiplier`;
        },
        getStat(upg) {
          return `${Values.getEffectiveCapacity().toFixed(2)}g (${(1 + upg.level * upg.effect).toFixed(1)}x)`;
        }
      },
      StoreRate: {
        name: "Store Rate",
        effect: 0.5,
        cost: 0.5,
        mult: 1.5,
        level: 0,
        getDesc(upg) {
          return `+${(upg.effect * 100).toFixed(0)}% transfer speed while storing`;
        },
        getStat(upg) {
          return `${Values.getEffectiveStoreRate().toFixed(2)}g / s`;
        }
      },
      Dirt: {
        name: "Dirt Zones",
        isUnlock: true,
        maxLevel: 1,
        cost: 0.5,
        level: 0,
        getDesc(upg) {
          return upg.level === 0
            ? "Unlocks organic dirt zones (when dirt falls below 70%, generates up to 100%)"
            : "Organic dirt zones unlocked (generates up to 100g when under 70g)";
        },
        getStat(upg) {
          return upg.level === 0 ? "Locked" : "Unlocked";
        }
      }
    }
  },

  // --- Dynamic Multiplier Calculation Helpers (Without altering default values) ---

  // Effective vacuum movement speed ratio (e.g. 0.01 * (1 + level * 0.2))
  getEffectiveSpeed() {
    const upg = this.shops.dustShop.Speed;
    const multiplier = 1.0 + (upg.level * upg.effect);
    return this.vacuum.speed * multiplier;
  },

  // Effective vacuum capacity in grams (e.g. 0.5 * (1 + level * 0.5))
  getEffectiveCapacity() {
    const upg = this.shops.dustShop.CapacityMult;
    const multiplier = 1.0 + (upg.level * upg.effect);
    return this.vacuum.capacity * multiplier;
  },

  // Effective store rate in g/s (e.g. 0.1 * (1 + level * 0.5))
  getEffectiveStoreRate() {
    const upg = this.shops.dustShop.StoreRate;
    const multiplier = upg ? (1.0 + (upg.level * upg.effect)) : 1.0;
    return this.vacuum.storeRate * multiplier;
  },

  // Current purchase cost for an upgrade (base cost * mult^level)
  getUpgradeCost(upgradeKey) {
    const upg = this.shops.dustShop[upgradeKey];
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

