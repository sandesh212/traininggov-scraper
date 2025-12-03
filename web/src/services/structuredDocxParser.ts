import AdmZip from 'adm-zip';

export class StructuredDocxParser {
    /**
     * Parse DOCX to find black→red→black→red patterns.
     * Uses stream-based parsing of runs to handle inline or multi-paragraph structures.
     */
    parseStructuredQA(buffer: Buffer): Array<{ question: string; answer: string; isSubQuestion: boolean }> {
        const zip = new AdmZip(buffer);
        const documentXml = zip.readAsText('word/document.xml');

        const pairs: Array<{ question: string; answer: string; isSubQuestion: boolean }> = [];

        let currentQuestion = '';
        let currentAnswer = '';
        let state: 'QUESTION' | 'ANSWER' = 'QUESTION';

        // Parse XML to get a stream of text runs with color info
        const runs = this.extractRuns(documentXml);

        for (const run of runs) {
            const text = run.text;
            // Don't skip empty text yet, as newline is empty text but significant

            const isRed = run.isRed;
            const isWhitespace = !text.trim();

            if (state === 'QUESTION') {
                if (isRed && !isWhitespace) {
                    // Found visible red text -> Switch to ANSWER state
                    state = 'ANSWER';
                    currentAnswer = text;
                } else {
                    // Black text (or whitespace) -> Append to Question
                    currentQuestion += text;
                }
            } else { // state === 'ANSWER'
                if (!isRed && !isWhitespace) {
                    // Found visible black text -> End of Answer -> Switch to QUESTION state

                    // Save previous pair
                    if (currentQuestion.trim() && currentAnswer.trim()) {
                        pairs.push({
                            question: currentQuestion.trim(),
                            answer: currentAnswer.trim(),
                            isSubQuestion: !this.isMainQuestion(currentQuestion)
                        });
                    }

                    // Start new question
                    currentQuestion = text;
                    currentAnswer = '';
                    state = 'QUESTION';
                } else {
                    // Red text (or whitespace) -> Append to Answer
                    currentAnswer += text;
                }
            }
        }

        // Handle last pair
        if (state === 'ANSWER' && currentQuestion.trim() && currentAnswer.trim()) {
            pairs.push({
                question: currentQuestion.trim(),
                answer: currentAnswer.trim(),
                isSubQuestion: !this.isMainQuestion(currentQuestion)
            });
        }

        return pairs;
    }

    private isMainQuestion(text: string): boolean {
        const clean = text.trim();
        // Check for "Q1", "1.", "1)", "Question 1"
        return !!(clean.match(/^\d+[\.\)]/) || clean.match(/^Q\d+/i) || clean.match(/^Question\s+\d+/i));
    }

    private extractRuns(xml: string): Array<{ text: string; isRed: boolean; isBold: boolean; isItalic: boolean; size: number; font: string }> {
        const runs: Array<{ text: string; isRed: boolean; isBold: boolean; isItalic: boolean; size: number; font: string }> = [];
        const pRegex = /<w:p(?: [^>]*)?>([\s\S]*?)<\/w:p>/g;
        let pMatch;

        while ((pMatch = pRegex.exec(xml)) !== null) {
            const pContent = pMatch[1];
            const rRegex = /<w:r(?: [^>]*)?>([\s\S]*?)<\/w:r>/g;
            let rMatch;

            while ((rMatch = rRegex.exec(pContent)) !== null) {
                const rContent = rMatch[1];
                const text = this.extractText(rContent);
                if (!text) continue;

                const isRed = this.checkRed(rContent);
                const isBold = /<w:b(?:\/| [^>]*\/?)>/i.test(rContent);
                const isItalic = /<w:i(?:\/| [^>]*\/?)>/i.test(rContent);

                let size = 0;
                const sizeMatch = /<w:sz w:val="(\d+)"/i.exec(rContent);
                if (sizeMatch) size = parseInt(sizeMatch[1], 10) / 2; // w:sz is in half-points

                let font = "";
                const fontMatch = /<w:rFonts w:ascii="([^"]+)"/i.exec(rContent);
                if (fontMatch) font = fontMatch[1];

                runs.push({ text, isRed, isBold, isItalic, size, font });
            }

            // Add newline at end of paragraph
            runs.push({ text: '\n', isRed: false, isBold: false, isItalic: false, size: 0, font: "" });
        }
        return runs;
    }

    private extractText(runXml: string): string {
        // Pre-process breaks and tabs to treat them as text
        const processed = runXml
            .replace(/<w:br(?: [^>]*)?\/?>/g, '<w:t>\n</w:t>')
            .replace(/<w:tab(?: [^>]*)?\/?>/g, '<w:t>\t</w:t>');

        const textMatch = /<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g;
        let text = "";
        let tMatch;
        while ((tMatch = textMatch.exec(processed)) !== null) {
            text += tMatch[1];
        }
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
    }

    private checkRed(runXml: string): boolean {
        // Check w:rPr for color
        const colorMatch = /<w:color w:val="([0-9A-Fa-f]{6}|red)"/i.exec(runXml);
        return !!(colorMatch && this.isRedColor(colorMatch[1]));
    }

    private isRedColor(colorVal: string): boolean {
        if (colorVal.toLowerCase() === 'red') return true;
        if (colorVal === 'auto') return false;

        if (colorVal.length === 6) {
            const r = parseInt(colorVal.substring(0, 2), 16);
            const g = parseInt(colorVal.substring(2, 4), 16);
            const b = parseInt(colorVal.substring(4, 6), 16);
            // Red > 100 and Red > 1.2 * Green and Red > 1.2 * Blue
            return r > 100 && r > g * 1.2 && r > b * 1.2;
        }
        return false;
    }
}
