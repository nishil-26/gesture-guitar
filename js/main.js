// main.js
import { HandTracker } from "./handTracker.js";
import { StrumZone } from "./strumEngine.js";
import { AudioEngine, CHORD_ORDER, chordFrequencies } from "./audioEngine.js";
import { SongEngine, parseChordSheet } from "./songEngine.js";
import { Recorder } from "./recorder.js";
import * as ui from "./uiRenderer.js";

const videoEl = document.getElementById("webcam");
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const recordBtn = document.getElementById("recordBtn");
const chordChipRow = document.getElementById("chordChips");
const songSelect = document.getElementById("songSelect");
const customSheetBox = document.getElementById("customSheet");
const loadCustomBtn = document.getElementById("loadCustomBtn");
const exitSongBtn = document.getElementById("exitSongBtn");
const downloadLink = document.getElementById("downloadLink");
const statusEl = document.getElementById("status");

const FINGER_TIP_INDEX = 8;
const PRESET_SONGS = {
  darkhaast: "songs/darkhaast.json",
  phir_kabhi: "songs/phir_kabhi.json",
  jab_tak: "songs/jab_tak.json",
};

let tracker, audio, recorder, zone;
let currentChord = "Em";
let recording = false;
let song = null;
let running = false;

function setStatus(msg) { statusEl.textContent = msg; }

async function setup() {
  audio = new AudioEngine();
  await audio.init();

  tracker = new HandTracker();
  setStatus("Loading hand-tracking model…");
  await tracker.init();

  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 720 } });
  videoEl.srcObject = stream;
  await new Promise((res) => (videoEl.onloadedmetadata = res));
  videoEl.play();

  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;

  zone = new StrumZone(
    canvas.width * 0.55, canvas.height * 0.28,
    canvas.width * 0.92, canvas.height * 0.82
  );

  recorder = new Recorder(canvas, audio);
  running = true;
  setStatus("Ready — left hand picks the chord, right hand strums.");
  requestAnimationFrame(loop);
}

function loop(timestampMs) {
  if (!running) return;

  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, -canvas.width, 0, canvas.width, canvas.height);
  ctx.restore();

  const hands = tracker.detect(videoEl, timestampMs, canvas.width, canvas.height);
  const leftHand = hands.find((h) => h.label === "Left");
  const rightHand = hands.find((h) => h.label === "Right");

  if (leftHand) {
    currentChord = CHORD_ORDER[Math.min(leftHand.fingerCount, CHORD_ORDER.length - 1)];
    drawHandDots(leftHand, "#F4D58D");
  }

  let strumPoint = null;
  if (rightHand) {
    strumPoint = mirrorX(rightHand.points[FINGER_TIP_INDEX], canvas.width);
    drawHandDots(rightHand, "#8FB6C9");
  }

  const struck = zone.update(strumPoint);
  if (struck.length) {
    const freqs = chordFrequencies(currentChord);
    struck.forEach((i) => audio.pluck(i, freqs[i]));
  }
  const muted = chordFrequencies(currentChord)
    .map((f, i) => (f === null ? i : -1))
    .filter((i) => i >= 0);

  if (song && song.isPlaying()) {
    const [ticked, isBarStart] = song.beatJustTicked();
    if (ticked) audio.click(isBarStart);
    if (song.isFinished()) {
      setStatus(`"${song.title}" finished. Pick another or replay.`);
      song.stop();
    }
  }

  ui.drawTitle(ctx, canvas.width);
  ui.drawStringZone(ctx, zone, struck, muted);

  if (song) {
    const entry = song.currentEntry();
    const matched = entry && entry.chord === currentChord;
    ui.drawSongHud(ctx, canvas.width, canvas.height, song, currentChord, matched);
    if (song.isPlaying()) {
      const barStartNow = Math.floor(song.elapsedBeats()) % song.beatsPerBar === 0;
      ui.drawBeatPulse(ctx, canvas.width, barStartNow);
    }
  } else {
    ui.drawChordBadge(ctx, currentChord);
  }
  ui.drawRecordingIndicator(ctx, recording, canvas.width);

  requestAnimationFrame(loop);
}

function mirrorX(point, width) {
  return [width - point[0], point[1]];
}

function drawHandDots(hand, color) {
  ctx.save();
  ctx.fillStyle = color;
  hand.points.forEach(([x, y]) => {
    const mx = canvas.width - x;
    ctx.beginPath();
    ctx.arc(mx, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// ---- UI wiring ----

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  startBtn.textContent = "Starting…";
  try {
    await setup();
    startBtn.style.display = "none";
  } catch (err) {
    console.error(err);
    setStatus("Couldn't access camera/mic. Check browser permissions and reload.");
    startBtn.disabled = false;
    startBtn.textContent = "Try again";
  }
});

recordBtn.addEventListener("click", async () => {
  if (!recording) {
    recorder.start();
    recording = true;
    recordBtn.textContent = "⏹ Stop & Save";
    downloadLink.hidden = true;
  } else {
    recording = false;
    recordBtn.textContent = "● Record";
    const url = await recorder.stop();
    downloadLink.href = url;
    downloadLink.download = `gesture-guitar-${Date.now()}.webm`;
    downloadLink.hidden = false;
    downloadLink.textContent = "⬇ Download your recording";
  }
});

songSelect.addEventListener("change", async () => {
  const key = songSelect.value;
  if (!key) return;
  const res = await fetch(PRESET_SONGS[key]);
  const data = await res.json();
  song = new SongEngine(data);
  song.start();
  exitSongBtn.hidden = false;
  setStatus(`Song-Guide: "${song.title}" — ${song.bpm} BPM. ${song.note || ""}`);
});

loadCustomBtn.addEventListener("click", () => {
  const text = customSheetBox.value.trim();
  if (!text) return;
  const data = parseChordSheet(text);
  song = new SongEngine(data);
  song.start();
  exitSongBtn.hidden = false;
  songSelect.value = "";
  setStatus(`Song-Guide: "${song.title}" — ${song.bpm} BPM (custom chord sheet).`);
});

exitSongBtn.addEventListener("click", () => {
  song = null;
  songSelect.value = "";
  exitSongBtn.hidden = true;
  setStatus("Back to free-play.");
});
