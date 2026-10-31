# Sweeping Incremental - Dust Cleaner Game

A minimalist, satisfying browser cleaning game built with WebGL and procedural shaders.

## ✨ Features
- **Hold-to-Move**: The vacuum moves **only while Left-Click is held down** (or touch on mobile).
- **Movement Locked While Storing**: You **cannot move while storing** dust into the storage tank. Releasing Space resumes movement.
- **True Dust Collection**:
  - The cleaner now uses the **exact same grid model** as the dust cleared indicator.
  - You **only get dust by cleaning uncleaned/reappeared dust**! Moving over already-cleaned carpet yields **0g**.
  - Total room dust is calibrated to **1 Kg (1000g)**.
- **Robot Storage Bar (Bottom-Left)**:
  - Displayed at the **bottom left of the screen**, styled just like the stored dust display.
  - Thick vertical grey progress bar with white outlines, tick marks, and live numerical read-out (`0.00 / 0.50g`).
  - Warning full state turns red when full.
- **Vacuum Size**: Scaled to **1% of the screen** (`roomSize * 0.01`).
- **Square Dust Shop & Menu**:
  - Located at the bottom as a **sharp brown square button with light brown outlines and a grey circle icon** (0px border-radius).
  - Sharp square shop modal with white title (`DUST SHOP`).
  - **Speed Upgrade**: Adds **+0.1% screen/s** to vacuum movement speed. Base cost: `0.5g`, scales by **1.5x** per level.
  - **Capacity Mult Upgrade**: Adds **+0.1x** to the vacuum space multiplier (`0.5g * multiplier`). Base cost: `0.5g`, scales by **1.5x** per level.
- **Hold-to-Store (Spacebar)**: **Keep pressing (hold) Space** to transfer dust from the vacuum into the storage tank at **0.1g/s** (on-screen button removed for clean HUD).
- **10g Vertical Storage Progress Bar (Right)**: Displayed on the right with tick marks as a **thick vertical grey progress bar with white outlines and a transparent white background**.
- **10-Second Dust Reappearance**: Dust reappears **10 seconds after being vacuumed** (with a smooth settling fade).
- **Protected Vacuum Spot**: Dust **never** reappears underneath the vacuum, even when stationary.
- **Top-Right Minimalist HUD**: Displays `Dust Cleared: X.Xg [X.X%]` (synchronized with the 1 Kg room) and sound toggle.
- **Centered Square Room (Max scale)**: The square cleaning area automatically maximizes to fill your screen and adapts on resize.
- **Procedural Shaders**:
  - Grey dust modulated by **2 layers of Perlin noise** (macro drifts + micro clods).
  - Brown woven plush carpet revealed beneath cleaned paths.
- **Web Audio FX**: Procedural suction whoosh, vacuum motor hum, full warning alert, storage blips, and upgrade purchase chimes.

- **Centralized Configuration (`values.js`)**:
  - All numeric constants, base speeds, capacities, and upgrade configurations are stored in a single global `Values` variable:
    ```javascript
    Values = {
      storage: { max: 10, content: 0 },
      vacuum: { storeRate: 0.1, capacity: 0.5, stored: 0, speed: 0.01, size: 0.1 },
      room: { dustCapacity: 1000 },
      shops: {
        dustShop: {
          Speed: { effect: 0.1, cost: 0.5, mult: 1.5, level: 0 },
          CapacityMult: { effect: 0.5, cost: 0.5, mult: 1.5, level: 0 }
        }
      }
    }
    ```
  - Upgrades act as dynamic multipliers (`1 + level * effect`) without modifying base values.

## 🚀 How to Play
Open `index.html` in any modern web browser.
- **Hold Left Click**: Vacuum towards cursor.
- **Keep Pressing (Hold) Space**: Store collected dust into the 10g vertical storage bar at 0.1g/s (movement locked while storing).
- **Click Shop (or press B)**: Open the square Dust Shop to purchase upgrades with stored dust.
- **Press M**: Toggle audio.
