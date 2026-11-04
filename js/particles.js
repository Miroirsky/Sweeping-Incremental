/**
 * Sweeping Incremental - Particle Systems & 2D Overlay Rendering
 */

import { Values } from './data.js';
import {
  state,
  getMaxVacuumCapacity,
  isPlayerInStation,
  isStoringActionActive
} from './state.js';
import {
  overlayCtx,
  drawStation,
  drawDefaultVacuum,
  drawAutoCleaners
} from './renderer.js';

export function spawnDustParticles(x, y, count = 1, isDirt = false) {
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
export function getStorageTargetCoord(isDirt = false) {
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
export function spawnTransferParticles(count = 2, isDirt = false, originX = null, originY = null) {
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

export function spawnStorageSplash(x, y, isDirt = false) {
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

export function spawnFloatingText(text, x, y, color = '#4ade80') {
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

export function spawnStationDepositParticles(x, y) {
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

export function spawnStationPickupParticles(fromX, fromY, toX, toY, isDirt) {
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

export function updateAndDrawParticles(defaultAutoRadius) {
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
