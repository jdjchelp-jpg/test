
export class MathEngine {
    constructor() {
    }

    parseInput(expression) {
        // Remove spaces
        expression = expression.trim().replace(/\s+/g, '');
        // Match "Number+Number"
        // Supports alphanumeric for bases > 10 if needed, technically.
        const match = expression.match(/^([0-9A-Za-z]+)\+([0-9A-Za-z]+)$/);
        if (!match) {
            throw new Error("Invalid format. Expected 'Num + Num'");
        }
        return {
            op1: match[1],
            op2: match[2],
            operator: '+'
        };
    }

    generateSteps(expression, base = 10) {
        const { op1, op2 } = this.parseInput(expression);

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
}
