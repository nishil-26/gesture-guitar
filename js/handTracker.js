// handTracker.js
// Wraps MediaPipe Tasks Vision's HandLandmarker for real-time browser hand
// tracking. Reports up to 2 hands with a Left/Right label and a 0-5
// finger count used to select chords.

import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const FINGER_TIPS = [4, 8, 12, 16, 20];
const FINGER_PIPS = [3, 6, 10, 14, 18];

export class HandTracker {
  constructor() {
    this.landmarker = null;
    this.swapLabels = true; // flip if left/right feel reversed for your webcam
  }

  async init() {
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    this.landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
  }

  // videoEl: the <video> element streaming the webcam. width/height in px.
  detect(videoEl, timestampMs, width, height) {
    if (!this.landmarker) return [];
    const result = this.landmarker.detectForVideo(videoEl, timestampMs);
    const hands = [];

    if (result.landmarks && result.landmarks.length) {
      result.landmarks.forEach((lm, i) => {
        let label = result.handedness[i][0].categoryName; // "Left" / "Right"
        if (this.swapLabels) label = label === "Left" ? "Right" : "Left";

        const pts = lm.map((p) => [p.x * width, p.y * height]);
        const count = this._countFingers(pts, label);
        hands.push({ label, points: pts, fingerCount: count });
      });
    }
    return hands;
  }

  _countFingers(pts, label) {
    let count = 0;
    // thumb
    if (label === "Right") {
      if (pts[FINGER_TIPS[0]][0] > pts[FINGER_PIPS[0]][0]) count++;
    } else {
      if (pts[FINGER_TIPS[0]][0] < pts[FINGER_PIPS[0]][0]) count++;
    }
    // other four fingers: extended if tip is above pip (smaller y)
    for (let f = 1; f < 5; f++) {
      if (pts[FINGER_TIPS[f]][1] < pts[FINGER_PIPS[f]][1]) count++;
    }
    return count;
  }
}
