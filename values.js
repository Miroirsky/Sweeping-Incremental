/**
 * Sweeping Incremental - Central Game Configuration & Dynamic State Values
 * All core numeric values, capacities, rates, and upgrade configurations in one variable.
 */

var Values = {
  storage: {
    max: 10,
    content: 0
  },
  vacuum: {
    storeRate: 1,
    capacity: 0.5,
    stored: 0,
    speed: 0.01,
    size: 0.1
  },
  room: {
    dustCapacity: 1000
  },
  shops: {
    dustShop: {
      Speed: {
        effect: 0.2,
        cost: 0.5,
        mult: 1.5,
        level: 0
      },
      CapacityMult: {
        effect: 0.5,
        cost: 0.5,
        mult: 1.5,
        level: 0
      }
    }
  },

  // --- Dynamic Multiplier Calculation Helpers (Without altering default values) ---

  // Effective vacuum movement speed ratio (e.g. 0.01 * (1 + level * 0.1))
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

  // Current purchase cost for an upgrade (base cost * mult^level)
  getUpgradeCost(upgradeKey) {
    const upg = this.shops.dustShop[upgradeKey];
    if (!upg) return 0;
    return upg.cost * Math.pow(upg.mult, upg.level);
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

