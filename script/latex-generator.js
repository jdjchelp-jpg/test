
export class LatexGenerator {
    constructor() {
    }

    generate(steps, base = 10) {
        if (!steps || steps.length === 0) return "";

        const setupStep = steps.find(s => s.type === 'setup');
        const finishStep = steps.find(s => s.type === 'finish');

        if (!setupStep || !finishStep) return "Error: Incomplete steps.";

        const { operands, operator } = setupStep;
        const result = finishStep.result;

        // Parse Values (Decimal equivalent for annotation)
        const valTop = parseInt(operands.rawTop, base);
        const valBottom = parseInt(operands.rawBottom, base);
        const valResult = parseInt(result, base); // Result might include carries

        // Collect Carries from steps
        // We need a map of colIndex -> carryValue
        const carries = {};
        steps.forEach(s => {
            if (s.type === 'carry') {
                // map to destination column? Or source?
                // Visual carry goes "to" i-1. So column i-1 gets a carry.
                // We want to display it above column i-1.
                // User example shows `[1]` above calculation.
                // Note: The column indices in MathEngine are right-to-left 0..N
                // but usually rendered 0 = rightmost. 
                // Let's rely on `toColumn`.
                carries[s.toColumn] = s.value;
            }
        });

        // Reconstruct the visual rows
        // We need to align everything. `setupStep.maxLength` gives the width.
        // Result might be longer (maxLength + 1).
        const width = Math.max(operands.top.length, operands.bottom.length, result.length);

        // Helper to pad strings for LaTeX alignment (optional, but phantom helps)
        // Actually, the user uses `\phantom{0}` for alignment.
        // We'll construct string arrays first.

        let digitsTop = operands.rawTop.padStart(width, ' ');
        let digitsBottom = operands.rawBottom.padStart(width, ' ');
        let digitsResult = result.padStart(width, ' ');

        // Construct Carry String
        // Valid carries are at indices < width.
        // We iterate from left to right (visual) -> index 0 to width? 
        // Wait, math-engine indices: 0 is rightmost (units).
        // Latex usually writes left-to-right.

        let carryRowArr = [];
        let topRowArr = [];
        let bottomRowArr = [];
        let resultRowArr = [];

        // Iterate through visual columns (Left to Right)
        // High indices are on the Left.
        // Max index is roughly `width - 1` (or `width` if there's a final carry).
        // Let's just go from `width` down to 0.

        for (let i = width - 1; i >= 0; i--) {
            // Carry
            // Check if there is a carry LANDING at column i.
            // In math-engine, carry goes 'toColumn'.
            const cVal = carries[i];
            if (cVal !== undefined) {
                carryRowArr.push(`[${cVal.toString(base).toUpperCase()}]`);
            } else {
                // Use phantom or empty space? User ex: `[1][1][1]` grouped.
                // If it's empty, we might just put space.
                carryRowArr.push(`\\phantom{[0]}`);
            }

            // Top
            // `digitsTop` is padded with spaces ' '.
            // math-engine padding logic was `padStart(len, ' ')`.
            // But we can just use `operands.rawTop` and map to index `i`.
            // i=0 is units.
            // We need to be careful matching i to string index.
            // string index `k` corresponds to power `len - 1 - k`.
            // let's stick to math-engine `i` which is power/column index.

            // Get digit at power i
            const topDigit = this.getDigitAt(operands.rawTop, i);
            topRowArr.push(topDigit === ' ' ? '\\phantom{0}' : topDigit); // Use phantom for leading spaces?

            const botDigit = this.getDigitAt(operands.rawBottom, i);
            bottomRowArr.push(botDigit === ' ' ? '\\phantom{0}' : botDigit);

            const resDigit = this.getDigitAt(result, i);
            resultRowArr.push(resDigit === ' ' ? '\\phantom{0}' : resDigit);
        }

        // Final carry (leftmost) handling?
        // If result has length > setup len, we have an extra col at Left.
        // Loop above handled `width` correctly if we set `width` to result length.

        // Formatting to string
        const carryStr = carryRowArr.join(''); // Just concat? Or spacing?
        // User example: `[1][1][1]`, no amps.
        // Arrays usually separate columns with `&` if strict, but user uses one big column `r`.
        // `\begin{array}{r...}` means one right-aligned column usually? 
        // Wait, `r@{\quad}l` means TWO columns.
        // Col 1 (r): Math stuff. Col 2 (l): Annotation.

        // So the Math part is just a string of numbers.
        // We need to ensure monospacing or explicit alignment if we want it perfect.
        // But user provided `1011`. That's just a string.
        // To align digits, `\phantom{0}` is smart.

        // Clean up rows: remove unnecessary phantoms at start?
        // It's safer to keep them for strict alignment.

        // Operator placement: `+ \phantom{0}110`.
        // Operator is usually to the left of the number.

        const topStr = topRowArr.join('');
        const botStr = bottomRowArr.join(''); // w/o operator
        const resStr = resultRowArr.join('');

        // Build the LaTeX block
        return `$$
\\begin{array}{r@{\\quad}l}
  ${carryStr} & \\text{(carries)} \\\\
  ${topStr} & (${valTop}) \\\\
${operator} ${botStr} & (${valBottom}) \\\\
\\hline
  ${resStr} & (${valResult})
\\end{array}
$$`;
    }

    getDigitAt(str, powerIndex) {
        // str "123", len 3.
        // i=0 -> '3' (index 2)
        // i=1 -> '2' (index 1)
        // i=2 -> '1' (index 0)
        // index = len - 1 - i
        const idx = str.length - 1 - powerIndex;
        if (idx < 0 || idx >= str.length) return ' ';
        return str[idx];
    }
}
