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
                if (this.stopping) {
                    console.log('data available occurred');
                }
                this.chunks.push(e.data);
            }
            this.mediaRecorder.onstop = () => {
                console.log('mediarecorder stop handler');
                const blob = new Blob(this.chunks, {'type': 'video/webm'});
                const videoUrl = URL.createObjectURL(blob);
                const downloadLink = document.createElement('a');
                downloadLink.href = videoUrl;
                downloadLink.download = `${new Date().toDateString()}.webm`;
                downloadLink.click();
                downloadLink.remove();
                URL.revokeObjectURL(videoUrl);
            };
            this.mediaRecorder.onstart = () => {
                rs();
            }
            this.mediaRecorder.start();
        });
    }

    public stop() {
        this.stopping = true;
        console.log('mediarecorder stop');
        this.mediaRecorder.stop();
    }

}
