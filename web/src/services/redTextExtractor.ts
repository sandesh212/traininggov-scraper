import AdmZip from 'adm-zip';

export class RedTextExtractor {
    public extractRedText(buffer: Buffer): string[] {
        try {
            const zip = new AdmZip(buffer);
            const zipEntries = zip.getEntries();
            const documentXml = zipEntries.find(entry => entry.entryName === 'word/document.xml');

            if (!documentXml) {
                console.error("Could not find word/document.xml");
                return [];
            }

            const xmlContent = documentXml.getData().toString('utf8');
            return this.parseRedTextFromXml(xmlContent);
        } catch (error) {
            console.error("Error extracting red text:", error);
            return [];
        }
    }

    private parseRedTextFromXml(xml: string): string[] {
        const segments: string[] = [];
        let currentBuffer = "";

        // Regex for p tags (paragraphs)
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

                if (isRed) {
                    currentBuffer += text;
                } else {
                    // Black text
                    if (text.trim().length > 0) {
                        // Visible black text -> Break segment
                        if (currentBuffer.trim().length > 0) {
                            segments.push(currentBuffer.trim());
                        }
                        currentBuffer = "";
                    } else {
                        // Whitespace black text (e.g. space between red words)
                        // If we are currently collecting red text, append this space
                        if (currentBuffer.length > 0) {
                            currentBuffer += text;
                        }
                    }
                }
            }

            // End of paragraph -> Newline
            // Only add newline if we have content in buffer
            if (currentBuffer.length > 0 && !currentBuffer.endsWith('\n')) {
                currentBuffer += "\n";
            }
        }

        if (currentBuffer.trim().length > 0) {
            segments.push(currentBuffer.trim());
        }

        return segments;
    }

    private extractText(runXml: string): string {
        const textMatch = /<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g;
        let text = "";
        let tMatch;
        while ((tMatch = textMatch.exec(runXml)) !== null) {
            text += tMatch[1];
        }
        // Decode XML entities
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
    }

    private checkRed(runXml: string): boolean {
        const colorMatch = /<w:color w:val="([0-9A-Fa-f]{6}|red)"/i.exec(runXml);
        return !!(colorMatch && this.isRed(colorMatch[1]));
    }

    private isRed(colorVal: string): boolean {
        if (colorVal.toLowerCase() === 'red') return true;

        // Parse RGB Hex
        if (colorVal.length === 6) {
            const r = parseInt(colorVal.substring(0, 2), 16);
            const g = parseInt(colorVal.substring(2, 4), 16);
            const b = parseInt(colorVal.substring(4, 6), 16);

            // Heuristic for Red:
            // 1. Red component is significant (> 100)
            // 2. Red is significantly larger than Green and Blue
            return r > 100 && r > g * 1.2 && r > b * 1.2;
        }

        return false;
    }
}
