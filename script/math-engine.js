
export class MathEngine {
    constructor() {
    }

    parseInput(expression) {
        // Remove spaces
        expression = expression.trim().replace(/\s+/g, '');
        // Match "Number operator Number". Supports +, -, *, x, /
        const match = expression.match(/^([0-9A-Za-z]+)([\+\-\*x\/])([0-9A-Za-z]+)$/);
        if (!match) {
            throw new Error("Invalid format. Expected 'Num + Num', 'Num - Num', 'Num x Num', or 'Num / Num'");
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
        } else if (operator === '-') {
            return this.generateSubtractionSteps(op1, op2, base);
        } else if (operator === '*' || operator === 'x') {
            return this.generateMultiplicationSteps(op1, op2, base);
        } else if (operator === '/') {
            return this.generateDivisionSteps(op1, op2, base);
        }
    }

    // ... (Addition and Subtraction methods remain largely the same, included below for completeness if needed, but I will just assume they exist or you can paste the whole file if preferred. 
    // Wait, the tool instruction says "Replace the entire class content". I must provide the WHOLE content or careful chunks. 
    // Since I'm adding significantly, I'll provide the whole methods for clarity, or reuse if I can.
    // Let's reuse existing Add/Sub by reference if I can, but `replace_file_content` with chunks is risky for big logic.
    // I will replace valid chunks. Let's do the Dispatch and Parser first, then add the new methods.)

    generateAdditionSteps(op1, op2, base) {
        // ... (Keep existing implementation logic)
        // I will re-output the existing logic here for safety + new logic.
        const val1 = parseInt(op1, base);
        const val2 = parseInt(op2, base);

        if (isNaN(val1) || isNaN(val2)) throw new Error(`Invalid numbers for base ${base}`);

        const len = Math.max(op1.length, op2.length);
        const str1 = op1.padStart(len, ' ');
        const str2 = op2.padStart(len, ' ');

        const steps = [];
        let carry = 0;
        const resultDigits = [];

        steps.push({
            type: 'setup',
            operands: { top: str1, bottom: str2, rawTop: op1, rawBottom: op2 },
            base: base,
            maxLength: len,
            operator: '+'
        });

        for (let i = len - 1; i >= 0; i--) {
            const digit1Char = str1[i];
            const digit2Char = str2[i];
            const digit1Val = digit1Char === ' ' ? 0 : parseInt(digit1Char, base);
            const digit2Val = digit2Char === ' ' ? 0 : parseInt(digit2Char, base);

            steps.push({
                type: 'highlight',
                columnIndex: i,
                digitTop: digit1Char,
                digitBottom: digit2Char,
                valTop: digit1Val,
                valBottom: digit2Val,
                carryIn: carry
            });

            const sum = digit1Val + digit2Val + carry;
            const digitResult = sum % base;
            const newCarry = Math.floor(sum / base);

            steps.push({
                type: 'calculate',
                columnIndex: i,
                values: { dTop: digit1Val, dBottom: digit2Val, carry: carry },
                sum: sum,
                digitResult: digitResult.toString(base).toUpperCase(),
                newCarry: newCarry
            });

            resultDigits.unshift(digitResult.toString(base).toUpperCase());
            steps.push({
                type: 'write_result',
                columnIndex: i,
                value: digitResult.toString(base).toUpperCase()
            });

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

        if (carry > 0) {
            resultDigits.unshift(carry.toString(base).toUpperCase());
            steps.push({
                type: 'write_final_carry',
                columnIndex: -1,
                value: carry.toString(base).toUpperCase()
            });
        }

        steps.push({ type: 'finish', result: resultDigits.join('') });
        return steps;
    }

    generateSubtractionSteps(op1, op2, base) {
        const val1 = parseInt(op1, base);
        const val2 = parseInt(op2, base);
        if (val1 < val2) throw new Error("Negative results not supported visually yet.");

        const len = Math.max(op1.length, op2.length);
        const steps = [];
        const resultDigits = [];

        let digits1 = op1.padStart(len, '0').split('').map(d => parseInt(d, base));
        let digits2 = op2.padStart(len, '0').split('').map(d => parseInt(d, base));
        let visualDigitsTop = [...digits1];

        steps.push({
            type: 'setup',
            operands: { top: op1.padStart(len, ' '), bottom: op2.padStart(len, ' '), rawTop: op1, rawBottom: op2 },
            base: base,
            maxLength: len,
            operator: '-'
        });

        for (let i = len - 1; i >= 0; i--) {
            let d1 = visualDigitsTop[i];
            const d2 = digits2[i];

            steps.push({ type: 'highlight', columnIndex: i });

            if (d1 < d2) {
                let k = i - 1;
                while (k >= 0 && visualDigitsTop[k] === 0) k--;

                // Borrow Action from K
                const oldValK = visualDigitsTop[k];
                visualDigitsTop[k] -= 1;
                steps.push({
                    type: 'borrow_action',
                    columnIndex: k,
                    oldValue: oldValK.toString(base).toUpperCase(),
                    newValue: visualDigitsTop[k].toString(base).toUpperCase(),
                    isSource: true
                });

                // Ripple
                for (let j = k + 1; j < i; j++) {
                    const oldValJ = visualDigitsTop[j];
                    visualDigitsTop[j] = base - 1;
                    steps.push({
                        type: 'borrow_action',
                        columnIndex: j, // This is technically a "receive then give" but visually we just cross out?
                        // For standard "cross out 0 make it 9", it acts like a borrow source for the next.
                        oldValue: oldValJ.toString(base).toUpperCase(),
                        newValue: visualDigitsTop[j].toString(base).toUpperCase(),
                        isRipple: true
                    });
                }

                // Receive at I
                const oldValI = visualDigitsTop[i];
                visualDigitsTop[i] += base;
                steps.push({
                    type: 'borrow_receive',
                    columnIndex: i,
                    oldValue: oldValI.toString(base).toUpperCase(),
                    newValue: base === 2 && visualDigitsTop[i] === 2 ? "10" : visualDigitsTop[i].toString(base).toUpperCase(),
                    addedValue: base
                });
                d1 = visualDigitsTop[i];
            }

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

    generateMultiplicationSteps(op1, op2, base) {
        const val1 = parseInt(op1, base);
        const val2 = parseInt(op2, base);
        const result = (val1 * val2).toString(base).toUpperCase();

        const steps = [];

        // Setup
        steps.push({
            type: 'setup_multiplication',
            operands: { top: op1, bottom: op2 },
            operator: 'x',
            base: base
        });

        // Loop through bottom digits (right to left)
        const digits2 = op2.split('').reverse();
        const topVal = parseInt(op1, base);

        for (let i = 0; i < digits2.length; i++) {
            const digit2 = parseInt(digits2[i], base);

            // Highlight current multiplier digit
            steps.push({
                type: 'highlight_multiplier',
                bottomIndex: op2.length - 1 - i,
                value: digit2
            });

            // Calculate Partial Product
            const partialProduct = topVal * digit2;
            const partialStr = partialProduct.toString(base).toUpperCase();

            steps.push({
                type: 'calculate_partial',
                term1: topVal,
                term2: digit2,
                result: partialStr,
                shift: i // Shift amount (0 for units, 1 for tens...)
            });

            steps.push({
                type: 'write_partial',
                value: partialStr,
                shift: i,
                rowLine: i // Which line to write to
            });
        }

        // Final Summation logic
        // We can just show the final line if we don't want to animate the full addition of partials
        // For simplicity in V1, let's just "Draw Line" and "Write Result"
        steps.push({
            type: 'draw_sum_line'
        });

        steps.push({
            type: 'write_mult_result',
            value: result
        });

        steps.push({ type: 'finish', result: result });
        return steps;
    }

    generateDivisionSteps(op1, op2, base) {
        // Op1 / Op2
        const dividend = parseInt(op1, base);
        const divisor = parseInt(op2, base);
        if (divisor === 0) throw new Error("Division by zero");

        const steps = [];

        steps.push({
            type: 'setup_division',
            dividend: op1,
            divisor: op2,
            base: base
        });

        let currentDividendStr = "";
        let currentDividendVal = 0;
        let resultStr = "";

        const dividendDigits = op1.split('');

        for (let i = 0; i < dividendDigits.length; i++) {
            // Bring down
            const digit = dividendDigits[i];
            currentDividendStr += digit;
            currentDividendVal = parseInt(currentDividendStr, base);

            steps.push({
                type: 'div_bring_down',
                digit: digit,
                currentStr: currentDividendStr,
                index: i // Position in dividend
            });

            // How many times does divisor fit?
            const quotientDigit = Math.floor(currentDividendVal / divisor);
            const product = quotientDigit * divisor;
            const remainder = currentDividendVal - product;

            // Step: Divide/Estimate
            steps.push({
                type: 'div_estimate',
                currentVal: currentDividendVal,
                divisor: divisor,
                quotient: quotientDigit
            });

            // Write Quotient
            resultStr += quotientDigit.toString(base).toUpperCase();
            steps.push({
                type: 'div_write_quotient',
                digit: quotientDigit.toString(base).toUpperCase(),
                index: i
            });

            // Multiply and write below
            steps.push({
                type: 'div_multiply',
                digit: quotientDigit,
                divisor: divisor,
                product: product.toString(base).toUpperCase(),
                rowIndex: i
            });

            // Subtract
            steps.push({
                type: 'div_subtract',
                minuend: currentDividendVal,
                subtrahend: product,
                remainder: remainder.toString(base).toUpperCase(),
                rowIndex: i
            });

            // Update for next loop
            currentDividendStr = remainder.toString(base).toUpperCase();
            // Careful with 0 handling
            if (currentDividendStr === "0") currentDividendStr = "";
        }

        steps.push({ type: 'finish', result: resultStr });
        return steps;
    }
}
