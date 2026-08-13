// songEngine.js
// Loads a song definition (either a preset JSON, or one typed/pasted in by
// the user via the plain-text chord-sheet format below) and turns it into
// a beat-accurate playback schedule.
//
// Plain-text format anyone can paste in for ANY song:
//
//   Title: Some Song
//   BPM: 100
//   Capo: 0
//   Intro: G Em C D
//   Verse: G Em C D x2
//   Chorus: C Am F G x2
//
// Each line after Title/BPM/Capo is "SectionName: chord chord chord xN"
// -- xN (optional) repeats that section N times. One chord = one bar.

export function parseChordSheet(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const song = { title: "Untitled Song", bpm: 100, beatsPerBar: 4, capo: 0, sections: [] };

  for (const line of lines) {
    const titleMatch = line.match(/^title:\s*(.+)$/i);
    const bpmMatch = line.match(/^bpm:\s*(\d+)$/i);
    const capoMatch = line.match(/^capo:\s*(\d+)$/i);
    if (titleMatch) { song.title = titleMatch[1]; continue; }
    if (bpmMatch) { song.bpm = parseInt(bpmMatch[1], 10); continue; }
    if (capoMatch) { song.capo = parseInt(capoMatch[1], 10); continue; }

    const sectionMatch = line.match(/^([A-Za-z0-9 \-]+):\s*(.+)$/);
    if (!sectionMatch) continue;
    const name = sectionMatch[1].trim();
    let rest = sectionMatch[2].trim();

    let repeats = 1;
    const repMatch = rest.match(/x(\d+)\s*$/i);
    if (repMatch) {
      repeats = parseInt(repMatch[1], 10);
      rest = rest.slice(0, repMatch.index).trim();
    }

    const chords = rest.split(/\s+/).filter(Boolean);
    if (chords.length) {
      song.sections.push({ name, chords, barsPerChord: 1, repeats });
    }
  }
  return song;
}

export class SongEngine {
  constructor(songData) {
    this.title = songData.title;
    this.bpm = songData.bpm;
    this.beatsPerBar = songData.beatsPerBar || songData.beats_per_bar || 4;
    this.capo = songData.capo || 0;
    this.note = songData.note || "";

    this.timeline = [];
    let beatCursor = 0;
    const sections = songData.sections || [];
    for (const section of sections) {
      const barsPerChord = section.barsPerChord || section.bars_per_chord || 1;
      const repeats = section.repeats || 1;
      const durationBeats = barsPerChord * this.beatsPerBar;
      for (let r = 0; r < repeats; r++) {
        for (const chord of section.chords) {
          this.timeline.push({
            chord,
            startBeat: beatCursor,
            endBeat: beatCursor + durationBeats,
            section: section.name,
          });
          beatCursor += durationBeats;
        }
      }
    }
    this.totalBeats = beatCursor;
    this._startTime = null;
    this._pausedBeats = 0;
    this._lastBeatInt = -1;
  }

  get secondsPerBeat() { return 60.0 / this.bpm; }

  start() {
    this._startTime = performance.now() / 1000;
    this._pausedBeats = 0;
    this._lastBeatInt = -1;
  }

  resume() { this._startTime = performance.now() / 1000; }

  isPlaying() { return this._startTime !== null; }

  stop() {
    if (this._startTime !== null) {
      this._pausedBeats += (performance.now() / 1000 - this._startTime) / this.secondsPerBeat;
    }
    this._startTime = null;
  }

  elapsedBeats() {
    if (this._startTime === null) return this._pausedBeats;
    return this._pausedBeats + (performance.now() / 1000 - this._startTime) / this.secondsPerBeat;
  }

  isFinished() { return this.elapsedBeats() >= this.totalBeats; }

  beatJustTicked() {
    const beat = this.elapsedBeats();
    const beatInt = Math.floor(beat);
    if (beatInt !== this._lastBeatInt && beatInt < this.totalBeats) {
      this._lastBeatInt = beatInt;
      const isBarStart = beatInt % this.beatsPerBar === 0;
      return [true, isBarStart];
    }
    return [false, false];
  }

  currentEntry() {
    const beat = this.elapsedBeats();
    return this.timeline.find((e) => e.startBeat <= beat && beat < e.endBeat) || null;
  }

  upcoming(count = 3) {
    const current = this.currentEntry();
    if (!current) return [];
    const idx = this.timeline.indexOf(current);
    return this.timeline.slice(idx + 1, idx + 1 + count);
  }

  progressInCurrentChord() {
    const entry = this.currentEntry();
    if (!entry) return 0;
    const beat = this.elapsedBeats();
    const span = entry.endBeat - entry.startBeat;
    return Math.max(0, Math.min(1, (beat - entry.startBeat) / span));
  }
}
