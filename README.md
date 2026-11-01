# Sweeping Incremental - Dust Cleaner Game

A minimalist, satisfying browser cleaning game built with WebGL and procedural shaders.

## ✨ Features
- **Hold-to-Move**: The vacuum moves **only while Left-Click is held down** (or touch on mobile).
- **Movement Locked While Storing**: You **cannot move while storing** dust into the storage tank. Releasing Space resumes movement.
- **True Dust & Dirt Collection (100x100 Precise Grid)**:
  - The room is modeled as a high-precision **100x100 pixel grid (10,000 pixels total)**.
  - Each pixel stores its exact mass: **0.1g of dust per pixel** (`1000g / 10,000px = 0.1g/px`).
  - The cleaner removes dust and dirt at **0.1g/s distributed across pixels under the vacuum** (rather than applied individually to each pixel).
  - Moving quickly over a pixel leaves it partially cleaned: the visual opacity is directly proportional to remaining dust (e.g. 50% dust = 50% transparent, revealing the warm woven carpet underneath).
  - **Layered Dirt Over Dust**:
    - Dirt zones place dirt on top of dust pixels (containing up to 0.1g dirt and 0.1g dust beneath).
    - Dirt must be completely removed from a pixel before dust from that pixel can be collected!
    - Dirt visually fades as it is vacuumed away, revealing the dust layer, which in turn fades to reveal spotless carpet.
  - Total room dust is calibrated to **1 Kg (1000g)**. Moving over already-cleaned carpet yields **0g**.
- **Robot Storage Bar (Bottom-Left)**:
  - Displayed at the **bottom left of the screen**, styled just like the stored dust display.
  - Thick vertical grey progress bar with white outlines, tick marks, and live numerical read-out (`0.00 / 0.50g`).
  - Warning full state turns red when full.
- **Dynamic Circle Canister Fill**:
  - The vacuum cleaner circle now **fills with grey from bottom to top like its storage** as it vacuums up dust.
  - Features a crisp white outer rim and an internal meniscus level indicating exact canister fullness.
  - When full, the rim and fill pulse red in warning.
- **Separate Infinite Storage Indicators (Center-Right)**:
  - Dust and dirt are **stored separately** in two dedicated infinite containers on the center-right:
    - **Dust Storage**: Dedicated silver/grey HUD card (`DUST: X.Xg`).
    - **Dirt Storage**: Dedicated terracotta/brown HUD card (`DIRT: X.Xg`).
  - While holding Space, aerodynamic transfer particles route to their respective containers: silver dust particles flow into the Dust Storage, while warm terracotta dirt particles flow into the Dirt Storage.
- **Dust Shop (Dust Currency Only)**:
  - The Dust Shop accepts **DUST only**—you **cannot buy upgrades in the dust shop with dirt**.
  - All upgrade prices and wallet balances strictly consume and display your stored dust.
- **Vacuum Size**: Scaled to **1% of the screen** (`roomSize * 0.01`).
- **Dynamic Upgrades & Live Shop Descriptions**:
  - Located at the bottom as a **sharp brown square button with light brown outlines and a grey circle icon** (0px border-radius).
  - Sharp square shop modal with white title (`DUST SHOP`).
  - Upgrade cards and descriptions update dynamically with every purchase and value change.
  - **Speed Upgrade**: Adds **+0.1% screen/s** movement speed. Cost: `0.5g * 1.5^lvl`.
  - **Clean Rate Upgrade**: Adds **+50%** cleaning speed. Cost: `0.5g * 1.5^lvl`.
  - **Capacity Mult Upgrade**: Adds **+0.5x** to vacuum canister space multiplier. Cost: `0.5g * 1.5^lvl`.
  - **Store Rate Upgrade**: Adds **+50%** transfer speed while holding Space. Cost: `0.5g * 1.5^lvl`.
  - **Dirt Upgrade**: One-time permanent unlock. Cost: `25g`.
  - **Auto Cleaner Upgrade**: Autonomous mini-cleaner bot that wanders, vacuums, and docks at station. Cost: `2.0g * 50^lvl`.
- **Dirt Shop (Dirt Currency Only)**:
  - **Suck Zone Upgrade**: Expands suction radius by **+20%**. Cost: `1.0g * 10^lvl` dirt.
  - **Auto Efficiency Upgrade**: Gives **+50%** cleaning efficiency to automatic cleaner bots. Cost: `1.0g * 1.5^lvl` dirt.
- **Growing Dirt Zones Wave System**:
  - Dirt does **not generate constantly**. When total dirt drops below **70% of max dirt (70g)**, it activates a generation wave that grows dirt **up to 100% (100g)**.
  - While between 70g and 100g (when not in a wave), dirt generation remains paused until you clean it below 70g again.
  - Every time dirt reaches the 100g cap, generation stops and the noise seed is randomized, ensuring the next wave sprouts in fresh locations with new shapes.
  - Single-unlock upgrade in the shop with no multiple levels or spawn speed upgrades.
  - Top-right HUD highlights dirt status (`(Growing)` when generating, `(MAX)` when capped).
- **Dual Robot Storage (Grey for Dust, Brown for Dirt)**:
  - Both the vacuum cleaner circle and the bottom-left storage progress bar display **grey for dust and brown for dirt**.
  - The canister fills proportionally from bottom to top: grey on the bottom for dust, brown stacked on top for dirt.
  - Detailed sub-breakdown tags show exact grams of dust vs dirt in both robot canister and infinite storage.
  - Transfer particles and intake motes match the material color (grey for dust, earthy brown for dirt).
  - Cleaning dirt triggers a distinct procedural suction thud sound (`playDirtPuff`).
- **Hold-to-Store (Spacebar)**: **Keep pressing (hold) Space** to transfer dust from the vacuum into infinite storage at **0.1g/s** (on-screen button removed for clean HUD).
- **10-Second Dust Reappearance**: Dust reappears **10 seconds after being vacuumed** (with a smooth settling fade).
- **Protected Vacuum Spot**: Dust **never** reappears underneath the vacuum, even when stationary.
- **Top-Right Minimalist HUD**: Displays `Dust Cleared: X.Xg [X.X%]` (synchronized with the 1 Kg room) and sound toggle.
- **Centered Square Room (Max scale)**: The square cleaning area automatically maximizes to fill your screen and adapts on resize.
- **Procedural Shaders**:
  - Grey dust modulated by **2 layers of Perlin noise** (macro drifts + micro clods).
  - Brown woven plush carpet revealed beneath cleaned paths.
- **Web Audio FX**: Procedural suction whoosh, vacuum motor hum, full warning alert, storage blips, and upgrade purchase chimes.

- **Centralized Configuration & Dynamic Calculations (`values.js`)**:
  - All room dimensions, mass capacities, refill percentages, clean rates, and upgrade configurations are stored in `values.js`:
    ```javascript
    Values = {
      storage: { max: Infinity, dust: 0, dirt: 0 },
      vacuum: { cleanRate: 0.1, storeRate: 1.0, capacity: 0.5, stored: 0, storedDust: 0, storedDirt: 0, speed: 0.01, size: 0.1 },
      room: {
        gridRes: 100, dustCapacity: 1000, dirtCapacity: 100, dustReappearDelay: 10000, dustFadeDuration: 1200,
        get totalPixels() { return this.gridRes * this.gridRes; },
        get dustPerPixel() { return this.dustCapacity / this.totalPixels; },
        get dirtPerPixel() { return this.dustPerPixel; }
      },
      dirt: { refillThresholdPercent: 0.70, maxCapPercent: 1.00, spawnIntervalMs: 2000, maxActiveZones: 14 },
      particles: { maxDustMotes: 80, maxTransferParticles: 90, maxSplashParticles: 30 },
      progress: { milestones: [25, 50, 75, 90, 100], sampleIntervalMs: 250 },
      shops: { ... }
    }
    ```
  - **Dynamic Calculations**: Changing `gridRes` or `dustCapacity` automatically recalculates `totalPixels`, `dustPerPixel`, and `dirtPerPixel` without touching other files!
  - **Randomized Seed on Refill**: Every time dirt drops below the refill threshold (`70%`), the noise seed is randomized so dirt patches sprout in completely new locations across the room.

## 🚀 How to Play
Open `index.html` in any modern web browser.
- **Hold Left Click**: Vacuum towards cursor.
- **Keep Pressing (Hold) Space**: Store collected dust into infinite storage at 0.1g/s (movement locked while storing).
- **Click Shop (or press B / E)**: Open the shop to purchase upgrades with stored dust and dirt.
- **Press M**: Toggle audio.
- **Click Reset (🔄 or press R)**: Reset all game progress with a confirmation prompt.
- **Auto-Save**: Game progress (infinite storage, robot canisters, docking station, upgrades, and milestones) is automatically saved to `localStorage` every 2 seconds and upon buying upgrades. The room's dust resets to full on each page load.
