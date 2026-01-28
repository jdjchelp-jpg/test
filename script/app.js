
import { MathEngine } from './math-engine.js';
import { Renderer } from './renderer.js';
import { Recorder } from './recorder.js';

class App {
    constructor() {
        this.canvas = document.getElementById('math-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.renderer = new Renderer(this.canvas, this.ctx);
        this.mathEngine = new MathEngine();
        this.recorder = new Recorder(this.canvas);

        this.bindEvents();

        // Initial render test
        this.renderer.clear();
        this.renderer.drawText("Ready to Calculate", 960, 540, "black", "60px Arial");
    }

    bindEvents() {
        document.getElementById('btn-animate').addEventListener('click', () => this.startAnimation());
        document.getElementById('btn-export-video').addEventListener('click', () => this.exportVideo());
        document.getElementById('btn-export-png').addEventListener('click', () => this.exportPNG());
    }

    async startAnimation() {
        const input = document.getElementById('math-input').value;
        const base = 10; // Default to 10, selector removed
        console.log(`Starting animation for ${input} in base ${base}`);

        try {
            const steps = this.mathEngine.generateSteps(input, base);
            await this.renderer.playAnimation(steps);
        } catch (e) {
            console.error("Animation failed:", e);
            alert("Error: " + e.message);
        }
    }

    exportVideo() {
        this.recorder.startVideoRecording();
        this.setUIState('recording');

        const input = document.getElementById('math-input').value;
        const base = 10;

        // Trigger animation
        try {
            const steps = this.mathEngine.generateSteps(input, base);
            this.renderer.playAnimation(steps).then(async () => {
                // Wait a moment for final frames to flush to recorder
                await new Promise(r => setTimeout(r, 1000));
                await this.recorder.stopVideoRecording();
                this.setUIState('idle');
            });
        } catch (e) {
            alert(e.message);
            this.setUIState('idle');
        }
    }

    exportPNG() {
        this.recorder.enableFrameCapture();
        this.setUIState('recording');

        const input = document.getElementById('math-input').value;
        const base = 10;

        try {
            const steps = this.mathEngine.generateSteps(input, base);
            this.renderer.playAnimation(steps, async (step, index) => {
                // Callback after each step
                const name = `${step.type}_col${step.columnIndex}`;
                await this.recorder.captureFrame(name);
            }).then(() => {
                this.recorder.downloadZip();
                this.setUIState('idle');
            });
        } catch (e) {
            alert(e.message);
            this.setUIState('idle');
        }
    }

    setUIState(state) {
        const btns = document.querySelectorAll('button');
        btns.forEach(b => b.disabled = (state === 'recording'));
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
