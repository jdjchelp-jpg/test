
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
            colorNormal: "#ffffffff",
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
        this.ctx.clearRect(0, 0, this.width, this.height);

        // 1. Background Flash Logic
        if (step.type === 'borrow_action') {
            // Flash white based on progress or just solid white?
            // "change the background coluor to white if the number was crossed out"
            // Let's fade it in/out or keep it white during the action
            this.ctx.fillStyle = "white";
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        const { ctx, config } = this;

        // We always draw the static operands
        const setupStep = this.steps[0];
        if (!setupStep) return;

        const { operands, maxLength } = setupStep;
        const totalWidth = maxLength * config.digitSpacing;
        const startX = config.startX - (totalWidth / 2); // Left-align derived

        ctx.font = `bold ${config.fontSize}px ${config.fontFamily}`;
        ctx.textAlign = "center";

        const getX = (i) => startX + (i * config.digitSpacing) + (config.digitSpacing / 2);

        // Determine text color based on background
        // If background is white (borrow_action), text should be black
        const isWhiteBg = step.type === 'borrow_action';
        const textColor = isWhiteBg ? "black" : config.colorNormal;
        const highlightColor = config.colorHighlight; // Keep red

        // Draw Top Number
        for (let i = 0; i < operands.top.length; i++) {
            const char = operands.top[i];
            const isHighlight = (step.type === 'highlight' || step.type === 'calculate') && step.columnIndex === i;

            ctx.fillStyle = isHighlight ? highlightColor : textColor;

            // Pop-up effect for active top digit
            if (isHighlight) {
                this.drawPoppedText(char, getX(i), config.startY, progress);
            } else {
                ctx.fillText(char, getX(i), config.startY);
            }
        }

        // Draw Operator
        const isOperatorHighlight = (step.type === 'highlight' || step.type === 'calculate' || step.type === 'write_result');
        ctx.fillStyle = isOperatorHighlight ? highlightColor : textColor;
        ctx.fillText(setupStep.operator, startX - config.digitSpacing, config.startY + config.lineHeight);

        // Draw Bottom Number
        for (let i = 0; i < operands.bottom.length; i++) {
            const char = operands.bottom[i];
            const isHighlight = (step.type === 'highlight' || step.type === 'calculate') && step.columnIndex === i;

            ctx.fillStyle = isHighlight ? highlightColor : textColor;
            if (isHighlight) {
                this.drawPoppedText(char, getX(i), config.startY + config.lineHeight, progress);
            } else {
                ctx.fillText(char, getX(i), config.startY + config.lineHeight);
            }
        }

        // Draw Line
        ctx.beginPath();
        ctx.moveTo(startX - config.digitSpacing, config.startY + config.lineHeight + 40);
        ctx.lineTo(startX + totalWidth + 20, config.startY + config.lineHeight + 40);
        ctx.lineWidth = 5;
        ctx.strokeStyle = textColor;
        ctx.stroke();

        // Draw Results (Persistent)
        Object.entries(this.persistentState.resultDigits).forEach(([colIdx, val]) => {
            ctx.fillStyle = highlightColor;
            ctx.fillText(val || "?", getX(parseInt(colIdx)), config.startY + (config.lineHeight * 2));
        });

        if (!this.persistentState.borrows) this.persistentState.borrows = {};
        const borrowRowY = config.startY - 50;

        // Draw Borrows (Persistent)
        Object.entries(this.persistentState.borrows).forEach(([colIdx, data]) => {
            const cIdx = parseInt(colIdx);
            if (data.crossed) {
                const x = getX(cIdx);
                const y = config.startY;
                ctx.strokeStyle = highlightColor;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x - 20, y - 20);
                ctx.lineTo(x + 20, y - 50);
                ctx.stroke();
            }
            if (data.newVal) {
                ctx.fillStyle = highlightColor;
                ctx.font = `bold ${config.fontSize * 0.6}px ${config.fontFamily}`;
                ctx.fillText(data.newVal, getX(cIdx), borrowRowY);
                // Reset font
                ctx.font = `bold ${config.fontSize}px ${config.fontFamily}`;
            }
        });

        // Handle Borrow Animation (Action/Receive)
        if (step.type === 'borrow_action' || step.type === 'borrow_receive') {
            const colX = getX(step.columnIndex);

            if (step.type === 'borrow_action') {
                ctx.strokeStyle = highlightColor;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(colX - 20, config.startY - 20);
                const endX = colX + 20;
                const endY = config.startY - 50;

                const curX = (colX - 20) + ((endX - (colX - 20)) * progress);
                const curY = (config.startY - 20) + ((endY - (config.startY - 20)) * progress);

                ctx.lineTo(curX, curY);
                ctx.stroke();

                if (progress > 0.5) {
                    ctx.globalAlpha = (progress - 0.5) * 2;
                    ctx.fillStyle = highlightColor;
                    this.drawPoppedText(step.newValue, colX, borrowRowY, progress, 0.6);
                    ctx.globalAlpha = 1.0;
                }

                if (progress === 1) {
                    this.persistentState.borrows[step.columnIndex] = { crossed: true, newVal: step.newValue };
                }
            }

            if (step.type === 'borrow_receive') {
                ctx.globalAlpha = progress;
                ctx.fillStyle = highlightColor;
                this.drawPoppedText(step.newValue, colX, borrowRowY, progress, 0.6);
                ctx.globalAlpha = 1.0;

                if (progress === 1) {
                    this.persistentState.borrows[step.columnIndex] = { crossed: false, newVal: step.newValue };
                }
            }
        }

        // Draw Intermediate Calculation
        if (step.type === 'calculate' || step.type === 'calculate_diff' || (step.type === 'write_result' && progress < 1)) {
            if (step.type.includes('calculate')) {
                ctx.globalAlpha = Math.min(progress * 2, 1);
            } else {
                ctx.globalAlpha = Math.max(0, 1 - progress);
            }

            if (ctx.globalAlpha > 0.01) {
                const colX = getX(step.columnIndex);
                const textX = colX + (config.digitSpacing * 1.8);
                const textY = config.startY + (config.lineHeight * 1.0);

                ctx.font = `bold 60px Arial`;
                ctx.textAlign = "left";

                let text = "";
                // Fix for undefined
                if (step.type === 'calculate_diff') {
                    const diffVal = step.diff !== undefined ? step.diff : "?";
                    text = `= ${diffVal}`;
                } else {
                    const sumVal = step.sum !== undefined ? step.sum : "?";
                    text = `= ${sumVal}`;
                }

                ctx.fillStyle = highlightColor;
                ctx.fillText(text, textX, textY);

                // Draw Arrow - Fixed logic
                const textWidth = ctx.measureText(text).width;
                const arrowStartX = textX; // Start from start of text
                const arrowStartY = textY + 10;

                // Make arrow point to where the result WILL be written
                const arrowEndX = colX;
                const arrowEndY = config.startY + (config.lineHeight * 2) - 10;

                this.drawCurvedArrow(arrowStartX, arrowStartY, arrowEndX, arrowEndY);
            }

            ctx.globalAlpha = 1.0;
            ctx.textAlign = "center";
            ctx.font = `bold ${config.fontSize}px ${config.fontFamily}`;
        }

        // Handle "Write Result"
        if (step.type === 'write_result') {
            const currentVal = step.value !== undefined ? step.value : "?";
            ctx.fillStyle = highlightColor;
            this.drawPoppedText(currentVal, getX(step.columnIndex), config.startY + (config.lineHeight * 2), progress);

            if (progress === 1) {
                this.persistentState.resultDigits[step.columnIndex] = currentVal;
            }
        }

        if (step.type === 'write_final_carry') {
            const val = step.value !== undefined ? step.value : "?";
            ctx.fillStyle = highlightColor;
            ctx.fillText(val, getX(-1), config.startY + (config.lineHeight * 2));
            if (progress === 1) this.persistentState.finalCarry = val;
        }

        // Handle Carries
        if (step.type === 'carry') {
            const startXPos = getX(step.fromColumn);
            const startYPos = config.startY + (config.lineHeight * 2) - 20;
            const endXPos = getX(step.toColumn);
            const endYPos = config.startY - 60;

            const currentX = startXPos + (endXPos - startXPos) * progress;
            const currentY = startYPos + (endYPos - startYPos) * progress - (Math.sin(progress * Math.PI) * 100);

            ctx.fillStyle = highlightColor;
            ctx.font = `bold ${config.fontSize * 0.6}px ${config.fontFamily}`;
            ctx.fillText(step.value, currentX, currentY);

            if (progress < 1) {
                this.drawArrow(startXPos, startYPos, currentX, currentY);
            }
        }

        // Draw Old Carries
        Object.entries(this.persistentState.carries).forEach(([colIdx, val]) => {
            ctx.fillStyle = config.colorSecondary;
            ctx.font = `bold ${config.fontSize * 0.6}px ${config.fontFamily}`;
            ctx.fillText(val, getX(parseInt(colIdx)), config.startY - 60);
        });

        if (step.type === 'carry' && progress === 1) {
            this.persistentState.carries[step.toColumn] = step.value;
        }
    }

    drawPoppedText(text, x, y, progress, scaleFactor = 1.0) {
        // Pop effect: starts large then settles? Or grows?
        // Let's do a quick "pop" at the start of progress (sin wave)
        // scale = 1 + sin(progress * pi) * 0.5
        const p = Math.max(0, Math.min(progress, 1));
        const pop = 1 + (Math.sin(p * Math.PI) * 0.5);
        const scale = pop * scaleFactor;

        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.scale(scale, scale);
        // Reset font size locally if needed but context scale handles it
        this.ctx.fillText(text, 0, 0);
        this.ctx.restore();
    }

    drawCurvedArrow(x1, y1, x2, y2) {
        // Curve from Right to Left usually
        const ctx = this.ctx;
        const dist = Math.abs(x1 - x2);

        // Control point: "out" to the right and down? 
        // We want to go from the side text (= result) back to the column bottom.
        const cpX = (x1 + x2) / 2 + 50;
        const cpY = (y1 + y2) / 2 + 50;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cpX, cpY, x2, y2);

        ctx.lineWidth = 4;
        ctx.strokeStyle = this.config.colorHighlight;
        ctx.stroke();

        // Arrowhead
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
