// audioEngine.js
// Six independent Tone.PluckSynth voices (one per string) -- PluckSynth is
// Tone.js's built-in Karplus-Strong style plucked-string model, routed
// through a touch of reverb for body. Also owns the metronome click.

export const OPEN_STRING_FREQS = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63]; // E2 A2 D3 G3 B3 E4
export const STRING_NAMES = ["E2", "A2", "D3", "G3", "B3", "E4"];

// Standard open-chord shapes: fret number per string (low E -> high E). "x" = muted.
export const CHORDS = {
  Em: [0, 2, 2, 0, 0, 0],
  Am: ["x", 0, 2, 2, 1, 0],
  C:  ["x", 3, 2, 0, 1, 0],
  D:  ["x", "x", 0, 2, 3, 2],
  G:  [3, 2, 0, 0, 0, 3],
  F:  ["x", "x", 3, 2, 1, 1],
};
export const CHORD_ORDER = ["Em", "Am", "C", "D", "G", "F"];

export function fretToFreq(openFreq, fret) {
  if (fret === "x") return null;
  return openFreq * Math.pow(2, fret / 12);
}

export function chordFrequencies(chordName) {
  const shape = CHORDS[chordName];
  return shape.map((fret, i) => fretToFreq(OPEN_STRING_FREQS[i], fret));
}

export class AudioEngine {
  constructor() {
    this.ready = false;
    this.strings = [];
    this.recordDest = null;
  }

  // Must be called from a user gesture (click) -- browsers require this
  // before any audio can play.
  async init() {
    if (this.ready) return;
    await Tone.start();

    this.reverb = new Tone.Reverb({ decay: 2.2, wet: 0.22 }).toDestination();
    this.comp = new Tone.Compressor(-18, 3).connect(this.reverb);

    for (let i = 0; i < 6; i++) {
      const synth = new Tone.PluckSynth({
        attackNoise: 1,
        dampening: 3500,
        resonance: 0.92,
      }).connect(this.comp);
      this.strings.push(synth);
    }

    this.clickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.08, sustain: 0 },
    }).toDestination();
    this.clickSynth.volume.value = -10;

    this.ready = true;
  }

  pluck(stringIndex, freq) {
    if (freq == null || !this.ready) return;
    this.strings[stringIndex].triggerAttack(freq, Tone.now());
  }

  click(accent = false) {
    if (!this.ready) return;
    this.clickSynth.triggerAttackRelease(accent ? "C3" : "C2", "16n");
  }

  // Returns a MediaStream containing everything routed to the recorder bus,
  // used together with a captured canvas video stream for full recordings.
  getRecordingStream() {
    if (!this.recordDest) {
      this.recordDest = Tone.context.createMediaStreamDestination();
      this.comp.connect(this.recordDest);
      this.clickSynth.connect(this.recordDest);
    }
    return this.recordDest.stream;
  }
}
