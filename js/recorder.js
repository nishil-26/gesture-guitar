// recorder.js
// Records the live canvas (what you see) combined with the Tone.js audio
// bus (what you played) into one downloadable video file using the
// browser's native MediaRecorder -- no server, no ffmpeg needed.

export class Recorder {
  constructor(canvas, audioEngine) {
    this.canvas = canvas;
    this.audioEngine = audioEngine;
    this.mediaRecorder = null;
    this.chunks = [];
    this.active = false;
  }

  start() {
    const canvasStream = this.canvas.captureStream(30);
    const audioStream = this.audioEngine.getRecordingStream();

    const combined = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ]);

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(combined, { mimeType });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
    this.active = true;
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) { resolve(null); return; }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        this.active = false;
        resolve(url);
      };
      this.mediaRecorder.stop();
    });
  }
}
