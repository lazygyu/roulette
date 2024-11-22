import { pad } from './utils';

export class VideoRecorder {
  private targetCanvas: HTMLCanvasElement;
  private mediaRecorder: MediaRecorder;
  private videoStream: MediaStream;

  private chunks: Blob[] = [];
  private stopping = false;

  constructor(canvas: HTMLCanvasElement) {
    this.targetCanvas = canvas;
    this.videoStream = this.targetCanvas.captureStream();
    this.mediaRecorder = new MediaRecorder(this.videoStream, {
      videoBitsPerSecond: 6000000,
    });
  }

  public async start() {
    this.stopping = false;
    return new Promise<void>((rs) => {
      this.chunks = [];
      this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
        this.chunks.push(e.data);
      };
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        const d = new Date();

        downloadLink.href = videoUrl;
        downloadLink.download = `marble_roulette_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.webm`;
        downloadLink.click();
        downloadLink.remove();
        URL.revokeObjectURL(videoUrl);
      };
      this.mediaRecorder.onstart = () => {
        rs();
      };
      this.mediaRecorder.start();
    });
  }

  public stop() {
    this.stopping = true;
    if (this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }
}
