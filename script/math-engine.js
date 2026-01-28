
export class MathEngine {
    constructor() {
    }

    parseInput(expression) {
        // Remove spaces
        expression = expression.trim().replace(/\s+/g, '');
        // Match "Number operator Number"
        const match = expression.match(/^([0-9A-Za-z]+)([\+\-])([0-9A-Za-z]+)$/);
        if (!match) {
            throw new Error("Invalid format. Expected 'Num + Num' or 'Num - Num'");
        }
        return {
            op1: match[1],
            operator: match[2],
            op2: match[3]
        };
    }

    generateSteps(expression, base = 10) {
        const { op1, operator, op2 } = this.parseInput(expression);

        if (operator === '+') {
            return this.generateAdditionSteps(op1, op2, base);
        } else {
            return this.generateSubtractionSteps(op1, op2, base);
        }
    }

    generateAdditionSteps(op1, op2, base) {
        // Parse numbers based on base
        const val1 = parseInt(op1, base);
        const val2 = parseInt(op2, base);

        if (isNaN(val1) || isNaN(val2)) {
            throw new Error(`Invalid numbers for base ${base}`);
        }

        // Align numbers for column processing (pad with left spaces/zeros logically)
        // We work with strings to preserve individual digits
        const len = Math.max(op1.length, op2.length);
        const str1 = op1.padStart(len, ' ');
        const str2 = op2.padStart(len, ' ');

        const steps = [];
        let carry = 0;
        const resultDigits = []; // Storing result from right to left

        // 1. Setup Step
        steps.push({
            type: 'setup',
            operands: {
                top: str1,
                bottom: str2,
                rawTop: op1,
                rawBottom: op2
            },
            base: base,
            maxLength: len,
            operator: '+'
        });

        // Loop columns from right to left
        for (let i = len - 1; i >= 0; i--) {
            const digit1Char = str1[i];
            const digit2Char = str2[i];

            const digit1Val = digit1Char === ' ' ? 0 : parseInt(digit1Char, base);
            const digit2Val = digit2Char === ' ' ? 0 : parseInt(digit2Char, base);

            // 2. Highlight Column
            steps.push({
                type: 'highlight',
                columnIndex: i, // Index relative to the padded string
                digitTop: digit1Char,
                digitBottom: digit2Char,
                valTop: digit1Val,
                valBottom: digit2Val,
                carryIn: carry
            });

            const sum = digit1Val + digit2Val + carry;
            const digitResult = sum % base;
            const newCarry = Math.floor(sum / base);

            // 3. Show Calculation (Intermediate)
            // e.g., "7 + 5 + 1 (carry) = 13"
            steps.push({
                type: 'calculate',
                columnIndex: i,
                values: { dTop: digit1Val, dBottom: digit2Val, carry: carry },
                sum: sum,
                digitResult: digitResult.toString(base).toUpperCase(),
                newCarry: newCarry // The carry to move
            });

            // 4. Write Result Digit
            resultDigits.unshift(digitResult.toString(base).toUpperCase());
            steps.push({
                type: 'write_result',
                columnIndex: i,
                value: digitResult.toString(base).toUpperCase()
            });

            // 5. Animate Carry
            if (newCarry > 0) {
                steps.push({
                    type: 'carry',
                    fromColumn: i,
                    toColumn: i - 1,
                    value: newCarry
                });
            }

            carry = newCarry;
        }

        // If final carry remains
        if (carry > 0) {
            resultDigits.unshift(carry.toString(base).toUpperCase());
            steps.push({
                type: 'write_final_carry',
                columnIndex: -1, // Virtual column to the left
                value: carry.toString(base).toUpperCase()
            });
        }

        // 6. Finish
        steps.push({
            type: 'finish',
            result: resultDigits.join('')
        });

        return steps;
    }

    generateSubtractionSteps(op1, op2, base) {
        const val1 = parseInt(op1, base);
        const val2 = parseInt(op2, base);
        if (val1 < val2) throw new Error("Negative results not supported visually yet.");

        const len = Math.max(op1.length, op2.length);
        // Pad operands.
        let str1 = op1.padStart(len, '0'); // Pad with 0s for easier logic? Or spaces? 
        // Logic is easier with numbers array.
        let digits1 = str1.split('').map(d => parseInt(d, base));
        const str2 = op2.padStart(len, '0'); // Subtrahend
        const digits2 = str2.split('').map(d => parseInt(d, base));

        const steps = [];
        const resultDigits = [];

        // Track "current" value of digits1 as we borrow visually
        // Detailed Visual State
        let visualDigitsTop = [...digits1];

        steps.push({
            type: 'setup',
            operands: {
                top: op1.padStart(len, ' '),
                bottom: op2.padStart(len, ' '),
            },
            base: base,
            maxLength: len,
            operator: '-'
        });

        for (let i = len - 1; i >= 0; i--) {
            // Need to borrow?
            let d1 = visualDigitsTop[i]; // Current value (might have been borrowed from)
            const d2 = digits2[i];

            steps.push({ type: 'highlight', columnIndex: i });

            if (d1 < d2) {
                // BORROW SEQUENCE
                // Find lender
                let k = i - 1;
                while (k >= 0 && visualDigitsTop[k] === 0) {
                    k--;
                }
                if (k < 0) throw new Error("Should not happen if val1 >= val2");

                // Borrow from k
                // Visualize: Cross out k, write new val
                const oldValK = visualDigitsTop[k];
                visualDigitsTop[k] -= 1;
                const newValK = visualDigitsTop[k];

                steps.push({
                    type: 'borrow_action',
                    columnIndex: k,
                    oldValue: oldValK.toString(base).toUpperCase(),
                    newValue: newValK.toString(base).toUpperCase(),
                    isSource: true
                });

                // Ripple zeros
                for (let j = k + 1; j < i; j++) {
                    // 0 becomes base-1
                    const oldValJ = visualDigitsTop[j]; // 0
                    visualDigitsTop[j] = base - 1;
                    const newValJ = visualDigitsTop[j];

                    steps.push({
                        type: 'borrow_action',
                        columnIndex: j,
                        oldValue: oldValJ.toString(base).toUpperCase(),
                        // In visual, if it was already modified, we cross out the modified?
                        // Assuming standard ripple on 0s
                        newValue: newValJ.toString(base).toUpperCase(),
                        isRipple: true
                    });
                }

                // Add base to current col
                const oldValI = visualDigitsTop[i];
                visualDigitsTop[i] += base;
                const newValI = visualDigitsTop[i]; // This might be "10" or "11" etc.
                // We typically show the "1" superscript or the full value?
                // LaTeX shows "10" for binary 2. 

                steps.push({
                    type: 'borrow_receive',
                    columnIndex: i,
                    oldValue: oldValI.toString(base).toUpperCase(),
                    newValue: base === 2 && newValI === 2 ? "10" : newValI.toString(base).toUpperCase(), // Special case for binary 10
                    addedValue: base
                });

                // Update d1 for calculation
                d1 = visualDigitsTop[i];
            }

            // Calculate Difference
            const diff = d1 - d2;
            resultDigits.unshift(diff.toString(base).toUpperCase());

            steps.push({
                type: 'calculate_diff',
                columnIndex: i,
                values: { dTop: d1, dBottom: d2 },
                diff: diff.toString(base).toUpperCase()
            });

            steps.push({
                type: 'write_result',
                columnIndex: i,
                value: diff.toString(base).toUpperCase()
            });
        }

        steps.push({ type: 'finish', result: resultDigits.join('') });
        return steps;
    }
}
