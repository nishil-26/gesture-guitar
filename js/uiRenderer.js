// uiRenderer.js
// Draws every on-screen overlay onto the same canvas the video frame is
// drawn to. Visual language: warm amber stage-light strings over a dark
// walnut backdrop, chord names set in monospace like real tab notation.

const STRING_COLORS = [
  "#E8A33D", // low E - honey amber
  "#E0B15A",
  "#D9C27E",
  "#9FBFA6",
  "#8FB6C9",
  "#C99BD1", // high E - dusty violet
];

export function drawStringZone(ctx, zone, struck = [], muted = []) {
  ctx.save();
  ctx.globalAlpha = 0.92;
  for (let i = 0; i < 6; i++) {
    const [top, bottom] = zone.bandBounds(i);
    const y = (top + bottom) / 2;
    let color = STRING_COLORS[i];
    let lineWidth = 2.5;

    if (muted.includes(i)) color = "#5a5048";
    if (struck.includes(i)) {
      lineWidth = 7;
      ctx.shadowColor = "#F4D58D";
      ctx.shadowBlur = 18;
      color = "#FCEFC7";
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(zone.x1, y);
    ctx.lineTo(zone.x2, y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(232, 163, 61, 0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1);
  ctx.restore();
}

export function drawChordBadge(ctx, chordName, x = 36, y = 70) {
  ctx.save();
  ctx.font = "13px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#B8A88F";
  ctx.fillText("CHORD", x, y - 30);
  ctx.font = "700 40px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#F4D58D";
  ctx.shadowColor = "rgba(244, 213, 141, 0.5)";
  ctx.shadowBlur = 14;
  ctx.fillText(chordName, x, y + 14);
  ctx.restore();
}

export function drawRecordingIndicator(ctx, recording, width) {
  if (!recording) return;
  ctx.save();
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (blink) {
    ctx.fillStyle = "#D9503F";
    ctx.beginPath();
    ctx.arc(width - 46, 40, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = "600 13px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#D9503F";
  ctx.fillText("REC", width - 96, 45);
  ctx.restore();
}

export function drawTitle(ctx, width) {
  ctx.save();
  ctx.font = "600 15px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "rgba(244, 237, 224, 0.55)";
  ctx.textAlign = "center";
  ctx.fillText("E—A—D—G—B—E  ·  GESTURE GUITAR", width / 2, 32);
  ctx.textAlign = "left";
  ctx.restore();
}

export function drawSongHud(ctx, width, height, song, playedChord, matched) {
  const barY = height - 150;
  const barH = 110;

  ctx.save();
  ctx.fillStyle = "rgba(20, 15, 12, 0.78)";
  ctx.fillRect(0, barY, width, barH);

  const entry = song.currentEntry();
  if (!entry) { ctx.restore(); return; }

  ctx.font = "13px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#B8A88F";
  ctx.fillText(`${song.title.toUpperCase()} — ${entry.section}`, 30, barY + 22);

  // current chord box
  const cx = 140, cy = barY + 70;
  ctx.fillStyle = matched ? "#7FB069" : "#E8A33D";
  ctx.shadowColor = matched ? "rgba(127,176,105,0.5)" : "rgba(232,163,61,0.4)";
  ctx.shadowBlur = 16;
  roundRect(ctx, cx - 68, cy - 38, 136, 76, 10);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#1B1410";
  ctx.font = "700 30px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText(entry.chord, cx, cy + 11);
  ctx.textAlign = "left";

  // progress bar
  const progress = song.progressInCurrentChord();
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(cx - 68, cy + 46, 136, 6);
  ctx.fillStyle = "#F4D58D";
  ctx.fillRect(cx - 68, cy + 46, 136 * progress, 6);

  // upcoming chords fading right
  const upcoming = song.upcoming(4);
  let ux = cx + 130;
  upcoming.forEach((up, i) => {
    const alpha = Math.max(0.18, 0.65 - i * 0.14);
    ctx.fillStyle = `rgba(232, 214, 189, ${alpha})`;
    ctx.font = `${28 - i * 3}px 'IBM Plex Mono', monospace`;
    ctx.fillText(up.chord, ux, cy + 8);
    ux += 90;
  });

  // played-chord readout
  ctx.textAlign = "right";
  ctx.font = "14px 'Space Grotesk', sans-serif";
  ctx.fillStyle = "#E8DDCB";
  ctx.fillText(`You: ${playedChord}`, width - 30, barY + 28);
  ctx.font = "700 20px 'Space Grotesk', sans-serif";
  ctx.fillStyle = matched ? "#7FB069" : "#D9503F";
  ctx.fillText(matched ? "MATCH" : "SWITCH", width - 30, barY + 58);
  ctx.textAlign = "left";

  ctx.restore();
}

export function drawBeatPulse(ctx, width, isBarStart) {
  ctx.save();
  const r = isBarStart ? 12 : 6;
  ctx.fillStyle = isBarStart ? "#F4D58D" : "rgba(244,213,141,0.5)";
  ctx.beginPath();
  ctx.arc(width - 40, 90, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
