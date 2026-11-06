/**
 * Sweeping Incremental - Prestige Upgrades Configuration
 *
 * All prestige upgrade definitions live in this file.
 * Add or edit entries in PRESTIGE_UPGRADES to automatically generate
 * Prestige Tree nodes, connections, tooltips, purchase validation, and effects.
 */

export const PRESTIGE_UPGRADES = [
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
