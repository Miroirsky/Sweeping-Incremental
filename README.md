# 🧹 Sweeping Incremental

> A minimalist, satisfying, and tactically rich incremental cleaning game built with vanilla JavaScript, procedural WebGL shaders, dynamic particle physics, and synthetic Web Audio.

---

## 📖 Overview

**Sweeping Incremental** puts you in command of **B.O.B.** (*Battery-Operated Broom*), a precision robotic vacuum tasked with maintaining a pristine living space. Vacuum across high-density woven carpet, strip away layered dust and resilient organic dirt patches, navigate into the docking station to offload your payload into infinite storage silos, and invest collected resources into an extensive progression tree of mechanical enhancements and autonomous fleet bots.

---

## 🎮 How to Play

### Quick Start (No Server Needed)
- **Direct Play**: Double-click [`index.html`](file:///index.html) or drop it into any modern web browser (Chrome, Edge, Firefox, Safari). It runs locally with zero external build dependencies or server requirements.
- **Local Dev Server**:
  ```bash
  npm start
  ```
  Then navigate to [http://localhost:3000](http://localhost:3000).

### Rebuilding the Bundle
If you edit individual source files in `js/`, rebuild the standalone distribution bundle:
```bash
npm run build
```

---

## 🕹️ Controls

| Input | Action |
| :--- | :--- |
| **Left Click (Hold)** | Move B.O.B. toward cursor |
| **Right Click** | Toggle vacuum suction mode (ON / OFF) |
| **Touch & Drag** | Move and vacuum simultaneously on mobile/touch screens |
| **Docking Station** | Drive B.O.B. into the right-hand alcove to transfer payload into storage |
| **<kbd>E</kbd>** or **<kbd>B</kbd>** | Open / close the Upgrade Shop carousel |
| **<kbd>←</kbd> / <kbd>→</kbd>** or **<kbd>A</kbd> / <kbd>D</kbd>** | Cycle through upgrades in the carousel tray |
| **<kbd>Enter</kbd>** | Purchase currently focused upgrade card |
| **<kbd>Esc</kbd>** | Close the Upgrade Shop tray |
| **<kbd>M</kbd>** | Toggle audio mute |
| **<kbd>R</kbd>** | Reset game save data (prompts for confirmation) |

---

## ⚙️ Core Mechanics

### 1. High-Precision Grid Simulation
- **Mass-Calibrated Room**: The floor is divided into a high-resolution simulation grid calibrated to **1,000 g (1 Kg)** of base dust mass.
- **Continuous Distribution**: Suction power is distributed evenly across all pixels covered by the vacuum's intake radius rather than applied as a binary flat brush.
- **True Partial Cleaning**: Fast sweeps partially clear pixels, leaving semi-transparent dust layers that reveal the woven plush carpet underneath.
- **Settling & Regrowth**: Cleaned areas gradually collect dust again after a **10-second delay**, settling smoothly over **1.2 seconds**. Active vacuum robots protect the carpet beneath them from accumulation.

### 2. Dual-Layer Material System (Dirt over Dust)
- **Layer Priority**: Organic dirt patches spawn directly over existing dust. The vacuum must suction away the surface dirt layer entirely before the underlying dust can be harvested.
- **Wave Growth Cycles**: Once unlocked, dirt grows in organic cluster zones up to a **100 g** room cap. When total room dirt drops below the replenishment threshold, a new growth wave activates with a randomized Perlin noise seed to generate brand-new organic patterns across the floor.
- **Visual Feedback**: Real-time shader rendering blends dirt clumps over dust motes over woven textile shaders.

### 3. Docking Station & Silo Storage
- **Automated Docking Alcove**: Located on the right edge of the playfield with an open gateway.
- **Hands-Free Transfer**: Driving B.O.B. into the station triggers high-speed pneumatic transfer of collected dust and dirt directly into infinite silos.
- **Dual Silos**: Dust and dirt are stored separately as distinct currencies used for specialized tech trees.

### 4. Autonomous Helper Bots (Auto Cleaners)
- **Fleet Automation**: Deploy up to **6 autonomous B.O.B. units** (3 unlocked via Dust, 3 via Dirt).
- **Intelligent Routine**:
  1. *Patrol & Clean*: Bots roam the playfield, vacuuming both dust and dirt within their cleaning radius.
  2. *Full Alert*: Once their canisters reach capacity, bots transition state and navigate toward the docking station doorway.
  3. *Unload & Disperse*: Bots enter the docking station, empty their canisters into infinite storage, and venture back out into the room.

---

## 🛒 Upgrade Progression & Tech Trees

Upgrades are browsed via a bottom carousel tray featuring a central vacuum inspection hub and dynamic 3D card rotation. Costs scale exponentially based on:
$$\text{Cost} = \text{BaseCost} \times \text{Multiplier}^{\text{Level}}$$

### 🌫️ Dust Shop (Currency: Stored Dust)

| Upgrade | Base Cost | Scale | Description | Prerequisites |
| :--- | :---: | :---: | :--- | :--- |
| **Speed** | 0.50 g | $\times 1.5$ | Increases B.O.B. movement speed by **+50%** per level | None |
| **Capacity** | 0.50 g | $\times 1.5$ | Increases B.O.B. canister capacity by **+50%** per level | None |
| **Efficiency** | 1.00 g | $\times 1.5$ | Increases B.O.B. suction rate by **+50%** per level | Speed Lvl 2 |
| **Storing Speed** | 0.75 g | $\times 1.5$ | Increases docking station offload rate by **+50%** per level | Capacity Lvl 2 |
| **Dirt** | 25.00 g | *Unlock* | Unlocks organic dirt zone spawning (up to 100 g cap) | Efficiency Lvl 1 |
| **Auto Cleaner** | 2.00 g | $\times 50.0$ | Deploys an autonomous vacuum bot (up to 3 bots) | Capacity Lvl 5 |

### 🟤 Dirt Shop (Currency: Stored Dirt)
*Unlocked after purchasing the Dirt upgrade in the Dust Shop.*

| Upgrade | Base Cost | Scale | Description | Prerequisites |
| :--- | :---: | :---: | :--- | :--- |
| **Size** | 1.00 g | $\times 10.0$ | Increases B.O.B. intake radius by **+20%** per level | Dirt Unlocked |
| **Auto Efficiency** | 1.00 g | $\times 1.5$ | Increases auto cleaner suction rate by **+50%** per level | Dirt Unlocked |
| **Auto Speed** | 1.00 g | $\times 1.5$ | Increases auto cleaner movement speed by **+50%** per level | Dirt Unlocked |
| **Auto Capacity** | 5.00 g | $\times 1.75$ | Increases auto cleaner canister size by **+50%** per level | Dirt Unlocked |
| **More Dust** | 5.00 g | $\times 2.0$ | Adds **+50%** dust offload bonus & **+30%** room dust density | Dirt Unlocked |
| **Auto Cleaner** | 5.00 g | $\times 25.0$ | Deploys additional autonomous bots (up to 3 more; 6 total) | More Dust Lvl 1 |

---

## 🏗️ Technical Architecture

The engine is engineered in vanilla JavaScript with no third-party framework dependencies, utilizing hardware-accelerated shaders and Web Audio synthesis:

```
┌─────────────────────────────────────────────────────────────────┐
│                          index.html                             │
└────────────────────────────────┬────────────────────────────────┘
                                 │
     ┌───────────────────────────┴───────────────────────────┐
     ▼                                                       ▼
┌─────────────────────────┐                             ┌─────────────────────────┐
│     glcanvas (WebGL)    │                             │ overlay-canvas (2D API) │
├─────────────────────────┤                             ├─────────────────────────┤
│ • Procedural carpet     │                             │ • B.O.B. top & base     │
│ • Dust grid texture     │                             │ • Auto cleaner robots   │
│ • Dirt grid texture     │                             │ • Dynamic particle FX   │
│ • Room & station bounds │                             │ • Floating damage text  │
└─────────────────────────┘                             └─────────────────────────┘
```

### Source File Breakdown
- [`js/data.js`](file:///js/data.js): Centralized configuration object (`Values`), dynamic cost formulas, and upgrade milestone configurations.
- [`js/state.js`](file:///js/state.js): Simulation grid memory buffers (`Float32Array`), room coordinates, and entity positions.
- [`js/simulation.js`](file:///js/simulation.js): Physics clamping, suction raycasting, auto-bot state machines, and organic dirt clustering algorithms.
- [`js/renderer.js`](file:///js/renderer.js): WebGL shader pipeline, GLSL fragment shader, dynamic texture updates, and Canvas 2D overlay rendering.
- [`js/particles.js`](file:///js/particles.js): Particle systems for intake motes, station transfer streams, and floating notifications.
- [`js/sound.js`](file:///js/sound.js): Procedural audio synthesizer creating filtered pink noise suction loops, motor hum, and harmonic purchase chimes.
- [`js/ui.js`](file:///js/ui.js): HUD state synchronization, carousel tray 3D math, and DOM interaction management.
- [`js/settings.js`](file:///js/settings.js): Persistent auto-saving to `localStorage` and progress reset handlers.
- [`js/main.js`](file:///js/main.js): Input event listeners, window resize throttling, and the core `requestAnimationFrame` loop.
- [`build.js`](file:///build.js): Bundler script compiling source modules into [`js/bundle.js`](file:///js/bundle.js).
- [`server.js`](file:///server.js): Built-in zero-dependency Node.js HTTP server.

---

## 🎨 Audio & Visual Design

- **Procedural Carpet Shaders**: Custom GLSL shader combines multi-octave 2D Perlin noise with warp distortion to generate tactile woven fabric under clean paths.
- **Dual-Phase Robot Sprites**: Custom B.O.B. artwork separates the base suction plate from the elevated lid with dynamic orientation tracking.
- **Synthetic Sound Design**:
  - *Suction Hum*: Dual bandpass-filtered noise generator modulated by player speed.
  - *Dirt Suction Thud*: Low-frequency resonant pop on dirt absorption.
  - *Pneumatic Transfer*: High-frequency pitch blips when offloading at the docking station.
  - *Chimes & Fanfares*: Procedural arpeggios on upgrade purchase and milestone completion.

---

## 💾 Save & Persistence

- **Auto-Save**: Progress (infinite storage, robot canisters, upgrades, and milestones) automatically serializes to `localStorage` every **2 seconds** and immediately upon purchasing upgrades.
- **Fresh Sessions**: Room dust resets to full on page refresh while preserving all purchased stats and stored materials.
- **Hard Reset**: Press <kbd>R</kbd> or click the 🔄 icon in the top header to clear all saved progress.

---

## 📄 License

MIT License. Open-source and free to adapt, extend, or build upon.
