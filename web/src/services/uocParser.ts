import { load } from "cheerio";
import { Uoc, UocElement, UocSection } from "../models/uoc";

export type SimpleUoc = {
    code: string;
    title: string | null;
    description: string | null;
};

// DOM-based parser for tests
export function parseUoc(document: Document): SimpleUoc {
    const h1Text = document.querySelector("h1")?.textContent?.trim() ?? "";
    let code: string | null = null;
    const codeMatch =
        h1Text.match(/Unit of Competency:\s*([A-Za-z0-9-]+)/i) ||
        h1Text.match(/\b([A-Z]{2,}\w*\d{2,})\b/);
    if (codeMatch) code = codeMatch[1];

    const h2Text = document.querySelector("h2")?.textContent?.trim() ?? "";
    let title: string | null = null;
    if (h2Text) {
        const titleMatch = h2Text.match(/Title:\s*(.+)$/i);
        title = titleMatch ? titleMatch[1].trim() : h2Text || null;
    }

    let description: string | null = null;
    const pTags = Array.from(document.querySelectorAll("p"));
    for (const p of pTags) {
        const t = p.textContent?.trim() ?? "";
        const m = t.match(/^\s*Description:\s*(.+)$/i);
        if (m) {
            description = m[1].trim();
            break;
        }
    }

    return {
        code: code ?? "",
        title,
        description
    };
}

// ============ Cheerio parser for Nuxt/Vue rendered pages ============

function readDlByLabel($: any, label: string): string | undefined {
    const dt = $(`dt`).filter((_: number, el: any) => $(el).text().trim().toLowerCase() === label.toLowerCase()).first();
    if (!dt.length) return undefined;
    const dd = dt.next("dd");
    const text = dd.text().trim();
    return text || undefined;
}

function extractCodeAndTitle($: any): { code: string; title: string } {
    // Strategy 1: strict class selector (if it exists, it's the most reliable)
    const heroSubheading = $(".heroSubheading .title");
    if (heroSubheading.length) {
        const strongText = heroSubheading.find("strong").first().text().trim();
        const fullText = heroSubheading.text().trim();
        if (strongText && fullText) {
            const title = fullText.replace(strongText, "").trim();
            return { code: strongText, title };
        }
    }

    // Strategy 2: Look for H1 or H2 that starts with a Unit Code pattern
    let bestCode = "Unknown";
    let bestTitle = "Unknown";

    $("h1, h2").each((_: any, el: any) => {
        const text = $(el).text().trim();
        const match = /^(?:Unit of Competency:)?\s*([A-Z]{3,}[0-9]+[A-Z]*)\s*[-–—:]?\s*(.+)$/i.exec(text);
        if (match) {
            bestCode = match[1];
            bestTitle = match[2].trim();
            return false; // break
        }
    });

    if (bestCode !== "Unknown") return { code: bestCode, title: bestTitle };

    // Strategy 3: Search for any text looking like a unit code in the document title or first H1
    const h1 = $("h1").first().text().trim();
    const codeMatch = /([A-Z]{3,}[0-9]+[A-Z]*)/.exec(h1);
    if (codeMatch) {
        return {
            code: codeMatch[1],
            title: h1.replace(codeMatch[1], "").replace(/[-–—]/, "").trim()
        };
    }

    return { code: "Unknown", title: "Unknown" };
}

function extractStatus($: any): { status?: string; release?: string } {
    let status: string | undefined;

    // Strategy 1: specific class (fastest)
    $(".mint-pill").each((_: number, el: any) => {
        const text = $(el).text().trim().toLowerCase();
        if (["current", "superseded", "deleted"].includes(text)) {
            status = text.charAt(0).toUpperCase() + text.slice(1);
        }
    });

    // Strategy 2: Scan for strong/spans/divs containing status words if class mapping failed
    if (!status) {
        $("div, span, strong, p").each((_: any, el: any) => {
            // Limit search to top of document roughly
            if ($(el).parents().length > 10) return;

            const text = $(el).text().trim().toLowerCase();
            if (text === "current" || text === "superseded" || text === "deleted") {
                status = text.charAt(0).toUpperCase() + text.slice(1);
                return false;
            }
        });
    }

    // Extract release number
    let release: string | undefined;
    const releaseLabel = $(".release-label").parent().text().trim();
    if (releaseLabel) {
        const m = releaseLabel.match(/Release\s*(\d+)/i);
        if (m) release = `Release ${m[1]}`;
    }

    if (!release) {
        const headerText = $("header, .hero, #main-content").first().text();
        const m = headerText.match(/Release\s*(\d+)/i);
        if (m) release = `Release ${m[1]}`;
    }

    return { status, release };
}

function extractSupersession($: any): {
    supersededBy: Uoc["supersededBy"];
    supersedes: Uoc["supersedes"];
} {
    let supersededBy: Uoc["supersededBy"] = null;
    let supersedes: Uoc["supersedes"] = null;

    $("a[href^='/training/details/']").each((_: number, a: any) => {
        const $a = $(a);
        const href = $a.attr("href") || "";
        const text = $a.text().trim();
        const parentText = $a.parent().text().toLowerCase();

        const codeMatch = text.match(/\b([A-Z]{2,}\w*\d{2,})\b/);

        if (/superseded by/i.test(parentText)) {
            if (codeMatch) {
                supersededBy = {
                    code: codeMatch[1],
                    url: `https://training.gov.au${href}`
                };
            }
        }

        if (/supersedes/i.test(parentText) || /supersedes:/i.test(text)) {
            if (codeMatch) {
                supersedes = {
                    code: codeMatch[1],
                    url: `https://training.gov.au${href}`
                };
            }
        }
    });

    return { supersededBy, supersedes };
}

function extractElementsAndPC($: any): UocElement[] | undefined {
    const items: UocElement[] = [];
    const tables = $("table");

    tables.each((i: number, table: any) => {
        const $table = $(table);
        const tableText = $table.text().toLowerCase();
        // Identify Elements table loosely
        if (!tableText.includes("elements") || !tableText.includes("performance criteria")) return;

        let currentElement: UocElement | null = null;

        $table.find("tbody tr").each((rowIdx: number, tr: any) => {
            const $tr = $(tr);
            const $tds = $tr.find("td");
            if ($tds.length === 0) return;

            // Get clean text for all cells
            const cells = $tds.map((_: number, td: any) => $(td).text().trim()).get();
            const firstCell = cells[0] || "";

            // Skip Header Rows (heuristic)
            if (firstCell.toLowerCase().includes("elements describe") ||
                firstCell.toLowerCase() === "element" ||
                firstCell.toLowerCase().includes("performance criteria")) return;

            let potentialElement = "";
            let potentialPC = "";

            // --- Analyze Row Structure ---

            if ($tds.length >= 2) {
                // Standard 2+ Column Layout
                // Col 0: Element (or empty if continuation)
                // Col 1: PC (or ID) + Col 2 PC Text

                potentialElement = cells[0];

                if ($tds.length === 2) {
                    // [Element, PC+Text]
                    potentialPC = cells[1];
                } else if ($tds.length === 3) {
                    // [Element, ID, Text] or [Element, ID, Empty]
                    const id = cells[1];
                    const text = cells[2];
                    if (id.match(/^[\d\.]+$/)) {
                        potentialPC = `${id} ${text}`;
                    } else {
                        // Maybe col 1 is the PC text? Layouts vary.
                        potentialPC = id.length > text.length ? id : text;
                    }
                } else {
                    // >= 4 Cols. Assume Last strict col is PC, or 2nd col is PC.
                    // Usually doesn't happen for Elements table. 
                    // Fallback to cells[1] + cells[2] if needed
                    potentialPC = cells[1];
                }
            } else if ($tds.length === 1) {
                // Single cell row.
                // This typically happens when 'Rowspan' is used for the Element column.
                // The single cell is the PC column for subsequent criteria.
                if (currentElement) {
                    potentialPC = cells[0];
                }
            }

            // --- Logic to Create New Element ---
            // An Element cell is usually non-empty, and does NOT look like a PC ID (1.1)
            // It usually starts with a single number "1. Title" or just "Title"
            if ($tds.length >= 2 && potentialElement && potentialElement.length > 2) {
                // Heuristic: Elements rarely start with "X.Y" (those are PCs)
                // But they start with "X." or "X "
                if (!potentialElement.match(/^\d+\.\d+/)) {
                    currentElement = {
                        element: potentialElement,
                        performanceCriteria: []
                    };
                    items.push(currentElement);
                }
            }

            // --- Logic to Add PC ---
            if (currentElement && potentialPC) {
                // Normalize newlines in PC text (sometimes multiple PCs in one cell)
                const lines = potentialPC.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);

                lines.forEach(rawLine => {
                    // Split by lookahead for "Digit.Digit" to catch "1.1 text 1.2 text" on one line
                    // Improved regex: removed \b at start to handle "learning3.2" (missing space) scenarios
                    // Added \s check after number to ensure it's likely an ID (e.g. "3.2 ")
                    const splitLines = rawLine.split(/(?=\d+\.\d+\s)/);

                    splitLines.forEach(l => {
                        const line = l.trim();
                        if (!line) return;

                        // We want to capture valid PCs (e.g. "1.1 text")
                        const match = line.match(/^(\d+\.\d+)\s+(.+)$/);
                        if (match) {
                            currentElement!.performanceCriteria.push({
                                id: match[1],
                                text: match[2].trim()
                            });
                        } else if (line.match(/^\d+\.\d+/)) {
                            // Fallback if regex didn't catch text part cleanly but starts with ID
                            // Try to split manually
                            const parts = line.split(" ");
                            const id = parts[0];
                            const text = parts.slice(1).join(" ");
                            currentElement!.performanceCriteria.push({
                                id,
                                text
                            });
                        }
                    });
                });
            }
        });
    });

    return items.length > 0 ? items : undefined;
}

function extractTextFromSection($: any, headerText: string): string | undefined {
    const header = $("h2, h3, h4").filter((_: number, el: any) => {
        const text = $(el).text().trim();
        return text.toLowerCase() === headerText.toLowerCase();
    }).first();

    if (!header.length) return undefined;

    const texts: string[] = [];
    let current = header.next();

    while (current.length && !current.is("h2, h3, h4")) {
        const text = current.text().trim();
        if (text && current.is("p")) {
            texts.push(text);
        }
        current = current.next();
    }

    return texts.length > 0 ? texts.join("\n\n") : undefined;
}

// Consolidated list extractor helper to ensure deep nesting is captured
function extractNestedList($: any, $el: any, depth: number = 0): string[] {
    const items: string[] = [];
    // Use explicit markers to avoid unicode ambiguity in frontend parsing
    // [L0] = Level 0 (Top), [L1] = Level 1+ (Sub)
    const bullet = depth === 0 ? "[L0]" : `[L${depth}]`;

    $el.children("li").each((_: number, li: any) => {
        const $li = $(li);

        // 1. Get direct text (ignore nested lists for now)
        const text = $li.clone().children("ul, ol").remove().end().text().trim();

        if (text && !text.toLowerCase().includes("evidence required to demonstrate")) {
            items.push(`${bullet} ${text}`);
        }

        // 2. Recursively handle children lists
        $li.children("ul, ol").each((_: number, nestedList: any) => {
            const nestedItems = extractNestedList($, $(nestedList), depth + 1);
            items.push(...nestedItems);
        });
    });

    return items;
}

function extractEvidenceSection(
    $: any,
    dlLabel: string,
    keywords: { primary: string[]; fallback?: string[] }
): string | undefined {
    const dlText = readDlByLabel($, dlLabel);
    if (dlText) return dlText;

    const header = $("h2, h3, .mt-6.mb-2, h4").filter((_: number, el: any) => {
        const text = $(el).text().trim().toLowerCase();
        return keywords.primary.every(kw => text.includes(kw));
    }).first();

    if (header.length) {
        const parts: string[] = [];
        let current = header.next();

        // Iterate siblings until next major header
        while (current.length && !current.is("h2, h3")) {
            // Paragraphs
            if (current.is("p")) {
                const text = current.text().trim();
                // Filter out common intro text garbage if present
                if (text && !text.toLowerCase().includes("evidence required to demonstrate")) {
                    parts.push(text);
                }
            }
            // Lists - Full Recursive Usage
            else if (current.is("ul, ol")) {
                const items = extractNestedList($, current);
                if (items.length > 0) {
                    parts.push(items.join("\n"));
                }
            }
            // Divs/Tables - Deep Search
            else if (current.is("div")) {
                // If it's a div, it might contain anything. 
                // We should probably just walk its children similar to top-level logic, or extract text + lists.
                // Simple approach: Extract all P and UL/OL in order of appearance?
                // The previous implementation separated them, losing order. Let's try to preserve order if possible.

                current.contents().each((_: number, child: any) => {
                    const $child = $(child);
                    if ($child.is("p")) {
                        const text = $child.text().trim();
                        if (text) parts.push(text);
                    } else if ($child.is("ul, ol")) {
                        const items = extractNestedList($, $child);
                        if (items.length) parts.push(items.join("\n"));
                    } else if ($child.is("div")) {
                        // Nested div? Just get text for now to be safe
                        const text = $child.text().trim();
                        if (text) parts.push(text);
                    }
                });
            }
            else if (current.is("table") || current.find("table").length) {
                const table = current.is("table") ? current : current.find("table").first();
                // Check for lists inside table cells (common in old TGA formats)
                const listsInTable = table.find("ul, ol");
                if (listsInTable.length > 0) {
                    listsInTable.each((_: number, lst: any) => {
                        const items = extractNestedList($, $(lst));
                        if (items.length) parts.push(items.join("\n"));
                    });
                } else {
                    // Just get paragraphs
                    const tableParagraphs = table.find("p");
                    tableParagraphs.each((_idx: number, pElem: any) => {
                        const $p = $(pElem);
                        const text = $p.text().trim();
                        if (text && !text.toLowerCase().includes("evidence required to demonstrate")) {
                            parts.push(text);
                        }
                    });
                }
            }
            current = current.next();
        }

        if (parts.length > 0) {
            return parts.join("\n\n");
        }
    }

    // Fallback: search anywhere in body for specific text matches if structured header fail
    if (keywords.fallback) {
        // ... (existing fallback logic kept for safety)
        const evidenceText = $("*").filter((_: number, el: any) => {
            const text = $(el).text().toLowerCase();
            return keywords.fallback!.some(kw => text.includes(kw));
        }).first();

        if (evidenceText.length) {
            // ... same extraction logic ...
            // For brevity in this replacement, we assume if header detection fails, fallback is less critical for "all bullets" 
            // but we will preserve the exact logic from before just cleaning up the List extraction calls.
            const parts: string[] = [];
            const parent = evidenceText.closest("div, section, article, td");

            // Capture P and Lists from parent container
            parent.children().each((_: number, child: any) => {
                const $c = $(child);
                if ($c.is("p")) parts.push($c.text().trim());
                if ($c.is("ul, ol")) parts.push(extractNestedList($, $c).join("\n"));
            });

            if (parts.length > 0) return parts.join("\n\n");
        }
    }

    return undefined;
}

function extractPerformanceEvidence($: any): string | undefined {
    return extractEvidenceSection($, "Performance Evidence", {
        primary: ["performance", "evidence"],
        fallback: ["evidence required to demonstrate competence"]
    });
}

function extractKnowledgeEvidence($: any): string | undefined {
    return extractEvidenceSection($, "Knowledge Evidence", {
        primary: ["knowledge", "evidence"],
        fallback: ["evidence of the ability", "evidence of knowledge"]
    });
}

function extractAssessmentConditions($: any): string | undefined {
    const dlText = readDlByLabel($, "Assessment Conditions");
    if (dlText) return dlText;

    const header = $("h2, h3, h4").filter((_: number, el: any) => {
        return $(el).text().trim().toLowerCase() === "assessment conditions";
    }).first();

    if (header.length) {
        const parts: string[] = [];
        let current = header.next();

        while (current.length && !current.is("h2, h3")) {
            if (current.is("p, div")) {
                const html = current.html() || '';
                let text = html
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<\/(p|div|li)>/gi, '\n')
                    .replace(/<li[^>]*>(.*?)<\/li>/gi, (_match: string, content: string) => {
                        return '\n- ' + content.trim();
                    })
                    .replace(/<[^>]+>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .split('\n')
                    .map((line: string) => line.trim())
                    .filter((line: string) => line.length > 0)
                    .join('\n');

                if (text) parts.push(text);
            } else if (current.is("ul, ol")) {
                // Use nested list extractor for AC if it's a list!
                // This matches USER REQUEST "unordered list for assessment conditions needs to be dynamic"
                const items = extractNestedList($, current);
                if (items.length) parts.push(items.join("\n"));
            }
            current = current.next();
        }

        if (parts.length > 0) return parts.join("\n\n");
    }

    const allText = $("body").text();
    const acMatch = allText.match(/Assessment conditions\s+([\s\S]+?)(?=\n\s*(?:Performance evidence|Knowledge evidence|Range|$))/i);
    if (acMatch) {
        return acMatch[1].trim().replace(/\s+/g, ' ').substring(0, 2000);
    }

    return undefined;
}

function extractLicensingInfo($: any): string | undefined {
    const dlText = readDlByLabel($, "Licensing/Regulatory Information");
    if (dlText) return dlText;

    const header = $("h2, h3, h4, strong").filter((_: number, el: any) => {
        const text = $(el).text().trim();
        return text.toLowerCase() === "licensing/regulatory information";
    }).first();

    if (header.length) {
        const texts: string[] = [];
        let current = header.next();

        while (current.length && !current.is("h2, h3, h4")) {
            const text = current.text().trim();
            if (text && current.is("p")) {
                texts.push(text);
            }
            current = current.next();
        }

        if (texts.length > 0) return texts.join("\n\n");
    }

    const allText = $("body").text();
    const licMatch = allText.match(/Licensing\/Regulatory Information\s+([\s\S]+?)(?=\n\s*(?:Pre-requisite|Application|$))/i);
    if (licMatch) {
        return licMatch[1].trim().replace(/\s+/g, ' ').substring(0, 500);
    }

    return undefined;
}

function cleanApplication(text: string | undefined): string | undefined {
    if (!text) return undefined;
    const cleaned = text
        .replace(/\n\s*Licensing\/Regulatory Information[\s\S]*?(?=\n|$)/i, '')
        .trim();
    return cleaned || undefined;
}

export function parseUocHtml(html: string, url: string): Uoc {
    const $: any = load(html);

    const { code, title } = extractCodeAndTitle($);
    let description: string | undefined;
    $("p").each((_: number, p: any) => {
        const t = $(p).text().trim();
        const m = t.match(/^\s*Description:\s*(.+)$/i);
        if (m) {
            description = m[1].trim();
            return false; // break
        }
    });
    const { status, release } = extractStatus($);

    const applicationRaw = readDlByLabel($, "Application") ?? extractTextFromSection($, "Application");
    const application = cleanApplication(applicationRaw);

    const unitSector = readDlByLabel($, "Unit Sector") ?? extractTextFromSection($, "Unit sector");
    const licensing = extractLicensingInfo($);

    const prerequisitesRaw =
        readDlByLabel($, "Prerequisite Unit") ??
        readDlByLabel($, "Prerequisites") ??
        readDlByLabel($, "Pre-requisite Unit") ??
        extractTextFromSection($, "Pre-requisite unit");

    const prerequisites = prerequisitesRaw
        ? [...new Set(prerequisitesRaw.match(/\b[A-Z]{2,}\w*\d{2,}\b/g) ?? [])]
        : undefined;

    const elements = extractElementsAndPC($);

    const foundationSkills =
        readDlByLabel($, "Foundation Skills") ??
        extractTextFromSection($, "Foundation skills");

    const assessmentConditions = extractAssessmentConditions($);
    const performanceEvidence = extractPerformanceEvidence($);
    const knowledgeEvidence = extractKnowledgeEvidence($);

    const { supersededBy, supersedes } = extractSupersession($);

    const sections: UocSection[] = [];
    $("h2, h3, h4").each((_: number, el: any) => {
        const $h = $(el);
        const headingText = $h.text().trim();
        if (!headingText) return;

        // EXCLUSION: Ignore footer data, links, and non-content headings
        const lowerHeading = headingText.toLowerCase();
        if (lowerHeading.match(/^(links|navigation|menu|footer|copyright|disclaimer|privacy|search|my profile|logout|login)$/)) return;

        const tag = $h.get(0).tagName.toLowerCase();
        const level = tag === 'h2' ? 2 : tag === 'h3' ? 3 : 4;
        const paragraphs: string[] = [];
        const lists: string[][] = [];
        let cur = $h.next();

        // Stop at next heading OR footer/div that marks end of content
        while (cur.length && !cur.is('h2, h3, h4') && !cur.is('footer') && !cur.hasClass('footer')) {
            if (cur.is('p')) {
                const t = cur.text().trim();
                // Ignore copyright-like text in paragraphs if somehow reached
                if (t && !t.toLowerCase().includes("© commonwealth of australia")) {
                    paragraphs.push(t);
                }
            } else if (cur.is('ul, ol')) {
                const items = cur.find('> li').map((i: number, li: any) => {
                    const $li = $(li);
                    const cloned = $li.clone();
                    cloned.children('ul, ol').remove();
                    return cloned.text().trim();
                }).get().filter(Boolean);
                if (items.length) lists.push(items);
            } else if (cur.is('table')) {
                // Formatting tables as text blocks for generic sections
                cur.find('tr').each((_: number, tr: any) => {
                    // Use $ from header closure, which is global here
                    // Ensure we use $(c) where $ is the load instance
                    const cells = $(tr).find('td, th').map((_: number, c: any) => $(c).text().trim()).get().join(' | ');
                    if (cells) paragraphs.push(cells);
                });
            }
            cur = cur.next();
        }

        // Only add if it has content
        if (paragraphs.length > 0 || lists.length > 0) {
            sections.push({ heading: headingText, level, paragraphs, lists });
        }
    });

    const uoc: Uoc = {
        url,
        code,
        title,
        description,
        status,
        release,
        application,
        unitSector,
        licensingOrRegulatoryInfo: licensing,
        prerequisites,
        elements,
        foundationSkills,
        assessmentConditions,
        performanceEvidence,
        knowledgeEvidence,
        supersededBy: supersededBy ?? null,
        supersedes: supersedes ?? null,
        sections: sections.length ? sections : undefined,
        lastFetchedAt: new Date().toISOString()
    };

    return uoc;
}
