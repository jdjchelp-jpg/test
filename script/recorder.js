
export class Recorder {
    constructor(canvas) {
        this.canvas = canvas;
        this.mediaRecorder = null;
        this.chunks = [];
        this.isCapturingFrames = false;
        this.frames = []; // Stores blob/dataURL for PNGs
    }

    startVideoRecording() {
        const stream = this.canvas.captureStream(60); // 60 FPS
        this.chunks = [];

        const mimeTypes = [
            "video/webm;codecs=vp9",
            "video/webm;codecs=vp8",
            "video/webm"
        ];

        let options = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || "video/webm";

        this.mediaRecorder = new MediaRecorder(stream, { mimeType: options });

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.chunks.push(e.data);
        };

        this.mediaRecorder.start();
        console.log("Recording started with", options);
    }

    stopVideoRecording() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) { resolve(); return; }

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: "video/webm" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "math_animation.webm";
                a.click();
                URL.revokeObjectURL(url);
                resolve();
            };
            this.mediaRecorder.stop();
            console.log("Recording stopped");
        });
    }

    enableFrameCapture() {
        this.isCapturingFrames = true;
        this.frames = [];
    }

    captureFrame(stepName) {
        if (!this.isCapturingFrames) return Promise.resolve();

        return new Promise(resolve => {
            this.canvas.toBlob((blob) => {
                if (blob) {
                    const idx = this.frames.length.toString().padStart(3, '0');
                    this.frames.push({ blob, name: `frame_${idx}_${stepName}.png` });
                }
                resolve();
            }); // Default is PNG, OK.
        });
    }

    async downloadZip() {
        if (!this.frames.length) return;

        if (typeof JSZip === 'undefined') {
            console.error("JSZip not loaded");
            alert("JSZip library not found.");
            return;
        }

        const zip = new JSZip();
        this.frames.forEach(frame => {
            zip.file(frame.name, frame.blob);
        });

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "math_frames.zip");

        this.isCapturingFrames = false;
        this.frames = [];
    }
}
