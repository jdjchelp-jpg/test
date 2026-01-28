
export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.width = canvas.width;
        this.height = canvas.height;
        this.activeStepIndex = -1;
        this.steps = [];
        this.animationState = {
            startTime: 0,
            duration: 1000,
            status: 'idle', // idle, animating
            currentStepObj: null
        };

        // Layout Config
        this.config = {
            fontSize: 120,
            fontFamily: "Courier New, monospace", // Monospace helps alignment
            colorNormal: "#000000",
            colorHighlight: "#ff3b30", // Red for active
            colorSecondary: "#777777ff", // Grey for inactive carries
            digitSpacing: 100,
            lineHeight: 160,
            startX: 960, // Center X
            startY: 300  // Top Y
        };

        // State to persist drawn elements
        this.persistentState = {
            resultDigits: {}, // Map columnIndex -> value
            carries: {}, // Map columnIndex -> value
            finalCarry: null
        };
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    async playAnimation(steps, onStepComplete = null) {
        this.steps = steps;
        this.activeStepIndex = 0;
        this.persistentState = { resultDigits: {}, carries: {}, finalCarry: null };

        // Initial Draw (Setup)
        this.drawStep(this.steps[0]);
        if (onStepComplete) await onStepComplete(this.steps[0], -1);

        for (let i = 0; i < steps.length; i++) {
            this.activeStepIndex = i;
            await this.animateStep(steps[i]);

            if (onStepComplete) {
                // Wait for recorder to capture before moving on
                await onStepComplete(steps[i], i);
            }

            // Wait a bit between steps
            await new Promise(r => setTimeout(r, 500));
        }
    }

    async animateStep(step) {
        return new Promise(resolve => {
            const duration = 1000;
            const startTime = performance.now();

            const loop = (now) => {
                const progress = Math.min((now - startTime) / duration, 1);

                this.drawStep(step, progress); // Draw with progress

                if (progress < 1) {
                    requestAnimationFrame(loop);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(loop);
        });
    }

    drawStep(step, progress = 1) {
        this.clear();
        const { ctx, config } = this;

        // We always draw the static operands
        // Find the 'setup' step or use stored operands from the first step in list
        const setupStep = this.steps[0];
        if (!setupStep) return;

        const { operands, maxLength } = setupStep;
        const totalWidth = maxLength * config.digitSpacing;
        const startX = config.startX - (totalWidth / 2); // Left-align derived

        ctx.font = `bold ${config.fontSize}px ${config.fontFamily}`;
        ctx.textAlign = "center";

        // Helper to get X position for a column index
        const getX = (i) => startX + (i * config.digitSpacing) + (config.digitSpacing / 2);

        // Draw Top Number
        for (let i = 0; i < operands.top.length; i++) {
            const char = operands.top[i];
            // Highlight logic
            const isHighlight = (step.type === 'highlight' || step.type === 'calculate') && step.columnIndex === i;
            ctx.fillStyle = isHighlight ? config.colorHighlight : config.colorNormal;
            ctx.fillText(char, getX(i), config.startY);
        }

        // Draw Operator
        // Highlight operator if any calculation is happening
        const isOperatorHighlight = (step.type === 'highlight' || step.type === 'calculate' || step.type === 'write_result');
        ctx.fillStyle = isOperatorHighlight ? config.colorHighlight : config.colorNormal;
        ctx.fillText(setupStep.operator, startX - config.digitSpacing, config.startY + config.lineHeight);

        // Draw Bottom Number
        for (let i = 0; i < operands.bottom.length; i++) {
            const char = operands.bottom[i];
            const isHighlight = (step.type === 'highlight' || step.type === 'calculate') && step.columnIndex === i;
            ctx.fillStyle = isHighlight ? config.colorHighlight : config.colorNormal;
            ctx.fillText(char, getX(i), config.startY + config.lineHeight);
        }

        // Draw Line
        ctx.beginPath();
        ctx.moveTo(startX - config.digitSpacing, config.startY + config.lineHeight + 40);
        ctx.lineTo(startX + totalWidth + 20, config.startY + config.lineHeight + 40);
        ctx.lineWidth = 5;
        ctx.strokeStyle = config.colorNormal;
        ctx.stroke();

        // Draw Results (Persistent)
        Object.entries(this.persistentState.resultDigits).forEach(([colIdx, val]) => {
            ctx.fillStyle = config.colorHighlight; // Results are always red/highlighted in the example? Or black once done? Image shows red result 8. 
            // Let's keep them highlighted as they are "new"
            ctx.fillText(val, getX(parseInt(colIdx)), config.startY + (config.lineHeight * 2));
        });

        if (this.persistentState.finalCarry) {
            ctx.fillStyle = config.colorHighlight;
            ctx.fillText(this.persistentState.finalCarry, getX(-1), config.startY + (config.lineHeight * 2));
        }

        // Draw Intermediate Calculation (Side Style)
        if (step.type === 'calculate' || (step.type === 'write_result' && progress < 1)) {
            if (step.type === 'calculate') {
                ctx.globalAlpha = Math.min(progress * 2, 1);
            } else {
                ctx.globalAlpha = Math.max(0, 1 - progress);
            }

            if (ctx.globalAlpha > 0.01) {
                const stepVal = step.values;
                const colX = getX(step.columnIndex);

                // Position: To the right of the active column.
                // Move it closer if we aren't writing the full equation
                const textX = colX + (config.digitSpacing * 1.8);
                const textY = config.startY + (config.lineHeight * 1.0); // Align with bottom number/operator roughly

                ctx.font = `bold 60px Arial`;
                ctx.textAlign = "left";

                // Draw just "= SUM"
                // e.g. "= 8" or "= 18"
                const text = `= ${step.sum}`;
                ctx.fillStyle = config.colorHighlight; // RED
                ctx.fillText(text, textX, textY);

                // Draw Arrow from the result number to the answer slot
                // Start: Bottom-Center of the RESULT number in the side text
                const textWidth = ctx.measureText(text).width;
                const arrowStartX = textX + (textWidth * 0.7); // Roughly under the number part
                const arrowStartY = textY + 10;

                const arrowEndX = colX;
                const arrowEndY = config.startY + (config.lineHeight * 2) - 30; // Top of the answer digit position

                // Curved Arrow
                this.drawCurvedArrow(arrowStartX, arrowStartY, arrowEndX, arrowEndY);
            }

            ctx.globalAlpha = 1.0;
            ctx.textAlign = "center";
            ctx.font = `bold ${config.fontSize}px ${config.fontFamily}`;
        }

        // Handle "Write Result" appearing
        if (step.type === 'write_result') {
            const currentVal = step.value;
            ctx.fillStyle = config.colorHighlight;
            // Scale effect?
            const scale = progress; // 0 to 1
            ctx.save();
            ctx.translate(getX(step.columnIndex), config.startY + (config.lineHeight * 2));
            ctx.scale(scale, scale);
            ctx.fillText(currentVal, 0, 0);
            ctx.restore();

            // Persist at end of animation
            if (progress === 1) {
                this.persistentState.resultDigits[step.columnIndex] = currentVal;
            }
        }

        if (step.type === 'write_final_carry') {
            ctx.fillStyle = config.colorHighlight;
            ctx.fillText(step.value, getX(-1), config.startY + (config.lineHeight * 2));
            if (progress === 1) this.persistentState.finalCarry = step.value;
        }

        // Handle Carries (Moving)
        if (step.type === 'carry') {
            // Animate from column i to i-1
            const startXPos = getX(step.fromColumn);
            const startYPos = config.startY + (config.lineHeight * 2) - 20; // Near result
            const endXPos = getX(step.toColumn);
            const endYPos = config.startY - 60; // Above top number

            // Parabolic arc?
            const currentX = startXPos + (endXPos - startXPos) * progress;
            const currentY = startYPos + (endYPos - startYPos) * progress - (Math.sin(progress * Math.PI) * 100); // Arc up

            ctx.fillStyle = config.colorHighlight;
            ctx.font = `bold ${config.fontSize * 0.6}px ${config.fontFamily}`;
            ctx.fillText(step.value, currentX, currentY);

            // Draw Arrow?
            if (progress < 1) {
                this.drawArrow(startXPos, startYPos, currentX, currentY);
            }
        }

        // Draw Old Carries (Static)
        Object.entries(this.persistentState.carries).forEach(([colIdx, val]) => {
            ctx.fillStyle = config.colorSecondary;
            ctx.font = `bold ${config.fontSize * 0.6}px ${config.fontFamily}`;
            ctx.fillText(val, getX(parseInt(colIdx)), config.startY - 60);
        });

        // Persist carry at end
        if (step.type === 'carry' && progress === 1) {
            this.persistentState.carries[step.toColumn] = step.value;
        }
    }

    drawCurvedArrow(x1, y1, x2, y2) {
        // Curve outwards to the right
        // If x1 is right of x2, we curve "out" (further right) then back left.
        const dist = Math.abs(x1 - x2);
        const cpX = Math.max(x1, x2) + (dist * 0.5) + 60;
        const cpY = (y1 + y2) / 2;

        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cpX, cpY, x2, y2);

        ctx.lineWidth = 4;
        ctx.strokeStyle = this.config.colorHighlight;
        ctx.stroke();

        const angle = Math.atan2(y2 - cpY, x2 - cpX);
        const headlen = 20;

        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    }

    drawArrow(x1, y1, x2, y2) {
        const headlen = 15;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = this.config.colorHighlight;
        this.ctx.stroke();
    }
}
