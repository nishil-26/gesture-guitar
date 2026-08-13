// strumEngine.js
// Defines the 6-string strum zone and detects when the strumming hand's
// fingertip sweeps through it fast enough to count as a strum.

const NUM_STRINGS = 6;

export class StrumZone {
  constructor(x1, y1, x2, y2) {
    this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
    this.bandHeight = (y2 - y1) / NUM_STRINGS;
    this._lastBand = null;
    this._lastY = null;
    this._lastTime = null;
  }

  bandBounds(i) {
    const top = this.y1 + i * this.bandHeight;
    return [top, top + this.bandHeight];
  }

  inZone(x, y) {
    return x >= this.x1 && x <= this.x2 && y >= this.y1 && y <= this.y2;
  }

  bandOf(y) {
    const idx = Math.floor((y - this.y1) / this.bandHeight);
    return Math.max(0, Math.min(NUM_STRINGS - 1, idx));
  }

  // fingertip: [x, y] or null. Returns array of freshly-struck string indices.
  update(fingertip) {
    const now = performance.now() / 1000;
    const struck = [];

    if (!fingertip || !this.inZone(fingertip[0], fingertip[1])) {
      this._lastBand = null;
      this._lastY = null;
      this._lastTime = now;
      return struck;
    }

    const [x, y] = fingertip;
    const band = this.bandOf(y);

    let speed = 0;
    if (this._lastY !== null && this._lastTime !== null) {
      const dt = Math.max(now - this._lastTime, 1e-3);
      speed = Math.abs(y - this._lastY) / dt;
    }

    if (this._lastBand === null) {
      this._lastBand = band;
    } else if (band !== this._lastBand) {
      const lo = Math.min(this._lastBand, band);
      const hi = Math.max(this._lastBand, band);
      if (speed > 250) {
        for (let i = lo; i <= hi; i++) struck.push(i);
      }
      this._lastBand = band;
    }

    this._lastY = y;
    this._lastTime = now;
    return struck;
  }
}
