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
| **<kbd>C</kbd>** | Open / close the Configurations & Statistics menu |
| **<kbd>Esc</kbd>** | Close active menu (Upgrade Shop or Configurations) |
| **<kbd>M</kbd>** | Quick toggle audio mute |

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

### 5. Configurations & Lifetime Statistics Menu
Access via the **⚙️ Config** button in the top-right header or by pressing **<kbd>C</kbd>**:
- **📊 Statistics Tab**:
  - *Cleaning Totals*: Total all-time dust collected and dirt cleaned (live formatted in grams and kilograms), alongside available infinite storage silos.
  - *Room Status & Fleet*: Live cleanliness grades (*SSS Sterile Lab* to *C Dusty Attic*), active play session time, fleet size, and total upgrades purchased.
  - *Fun & Useless Trivia*: Distance swept by B.O.B. (in meters/km), station unload count, directive clicks issued, estimated dust mites evicted, dust bunnies neutralized, perpetual cold fusion battery health, and warranty status.
- **⚙️ Settings & Audio Tab**:
  - *Audio Controls*: Master sound toggle (Mute / Unmute) and smooth volume slider (0% to 100%).
  - *Danger Zone*: Game progress reset button with safe confirmation. *(Note: The <kbd>R</kbd> hotkey has been removed to prevent accidental save wipes during gameplay).*

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
| **Auto Cleaner** | 1.00 g | $\times 10.0$ | Deploys additional autonomous vacuum bot (up to 3 bots) | Size Lvl 1 |

---

## 🎨 Visual & Audio Architecture

- **Hardware Acceleration**: Procedural fragment shaders render woven fibers, dynamic dust opacity, organic Voronoi-like dirt patches, and robotic drop shadows.
- **Particle System**: Procedural canvas particles for dust suction motes, station transfer streams, and organic dirt bursts.
- **Web Audio Engine**: Pure procedural audio synthesis—no external audio files required. Uses filtered pink noise for vacuum airflow, modulating bandpass frequencies based on cleaner speed, saw-wave motor hum, and custom pentatonic chimes for milestone achievements.
