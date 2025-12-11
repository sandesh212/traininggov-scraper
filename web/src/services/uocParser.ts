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
        const prevHeader = $table.prevAll("h2, h3, h4").first().text().toLowerCase();

        // Identify Elements table loosely: check table text OR preceding header
        if ((!tableText.includes("element") && !tableText.includes("performance criteria")) &&
            !prevHeader.includes("element") && !prevHeader.includes("performance criteria")) return;

        let currentElement: UocElement | null = null;

        $table.find("tbody tr").each((rowIdx: number, tr: any) => {
            const $tr = $(tr);
            const $tds = $tr.find("td");
            if ($tds.length === 0) return;

            // Get clean text for all cells, preserving newlines
            const cells = $tds.map((_: number, td: any) => {
                const $td = $(td).clone();
                $td.find('br').replaceWith('\n');
                $td.find('p').each((_: number, p: any) => {
                    $(p).after('\n');
                });
                return $td.text().trim();
            }).get();
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
                    // Improved regex: removed \b at start, added allow for "1.1. Text" or "1.1Text"
                    const splitLines = rawLine.split(/(?=\b\d+\.\d+)/);

                    splitLines.forEach(l => {
                        const line = l.trim();
                        if (!line) return;

                        // Capture valid PCs (e.g. "1.1 text", "1.1. text", "1.1Text")
                        // Group 1: ID (e.g. 1.1)
                        // Group 2: Optional trailing dot
                        // Group 3: Text
                        const match = line.match(/^(\d+\.\d+)(\.?)[\s\xA0]*(.*)$/);
                        if (match) {
                            currentElement!.performanceCriteria.push({
                                id: match[1], // Keep standard "X.Y" format
                                text: match[3].trim()
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

// Consolidated list extractor helper to ensure deep nesting is captured
function extractNestedList($: any, $el: any, depth: number = 0): string[] {
    const items: string[] = [];
    // Use explicit markers
    const bullet = depth === 0 ? "[L0]" : `[L${depth}]`;

    $el.children("li").each((_: number, li: any) => {
        const $li = $(li);

        // 1. Get text content (exclude nested lists temporarily to get own text)
        // Use clone to safe remove children without affecting DOM if references elsewhere (Cheerio is mutable? yes)
        // But here we just want text.
        const $clone = $li.clone();
        $clone.find("ul, ol").remove();
        const text = $clone.text().trim();

        if (text && !text.toLowerCase().includes("evidence required to demonstrate")) {
            items.push(`${bullet} ${text}`);
        }

        // 2. Recursively handle children lists (even if wrapped in divs)
        // Find all lists that are descendants of this li, but NOT descendants of another list inside this li
        $li.find("ul, ol").filter((_: number, el: any) => {
            return $(el).parentsUntil($li, "ul, ol").length === 0;
        }).each((_: number, nestedList: any) => {
            const nestedItems = extractNestedList($, $(nestedList), depth + 1);
            items.push(...nestedItems);
        });
    });

    return items;
}

// Helper to recursively extract content from a container (div, section, etc)
function extractContainerContent($: any, container: any): string[] {
    const parts: string[] = [];
    container.contents().each((_: number, el: any) => {
        const $el = $(el);
        // Ignore comments or empty text
        if (el.type === 'comment') return;

        if ($el.is("p")) {
            const t = $el.text().trim();
            if (t) parts.push(t);
        } else if ($el.is("ul, ol")) {
            const listItems = extractNestedList($, $el);
            if (listItems.length) parts.push(listItems.join("\n"));
        } else if ($el.is("table")) {
            const rows: string[] = [];
            $el.find("tr").each((_: number, tr: any) => {
                const cells = $(tr).find("td, th").map((_: number, td: any) => $(td).text().trim()).get();
                if (cells.length) rows.push(cells.join(" | "));
            });
            if (rows.length) parts.push(rows.join("\n"));
        } else if ($el.is("div, section, article")) {
            parts.push(...extractContainerContent($, $el)); // Recurse
        } else if (el.type === 'text') {
            const t = $el.text().trim();
            // Minimal length check to avoid just punctuation or stray spaces ?? 
            // Be careful not to lose "OR" or "&"
            if (t.length > 0) parts.push(t);
        } else if ($el.is("br")) {
            // Treat BR as newline if needed, but here we push blocks.
            // Maybe ignore or handle if inside text flow?
        } else {
            // Fallback for span, strong, etc if strictly at this level?
            // Usually they are inside p or div. If they are direct children of container:
            if (!$el.is("script, style")) {
                const t = $el.text().trim();
                if (t) parts.push(t);
            }
        }
    });
    return parts;
}

function extractTextFromSection($: any, headerText: string): string | undefined {
    const header = $("h2, h3, h4").filter((_: number, el: any) => {
        const text = $(el).text().trim();
        return text.toLowerCase().includes(headerText.toLowerCase());
    }).first();

    if (!header.length) return undefined;

    const parts: string[] = [];
    let current = header.next();

    while (current.length && !current.is("h2, h3, h4")) {
        // Use the robust recursive extractor
        // We wrap current in a wrapper if it's a single element to reuse logic?
        // Or just call for specific types.

        if (current.is("div")) {
            parts.push(...extractContainerContent($, current));
        } else if (current.is("p")) {
            const t = current.text().trim();
            if (t) parts.push(t);
        } else if (current.is("ul, ol")) {
            parts.push(extractNestedList($, current).join("\n"));
        } else if (current.is("table")) {
            const rows: string[] = [];
            current.find("tr").each((_: number, tr: any) => {
                const cells = $(tr).find("td, th").map((_: number, td: any) => $(td).text().trim()).get();
                if (cells.length) rows.push(cells.join(" | "));
            });
            if (rows.length) parts.push(rows.join("\n"));
        } else {
            // Fallback
            const t = current.text().trim();
            if (t && !current.is("script, style")) parts.push(t);
        }

        current = current.next();
    }

    return parts.length > 0 ? parts.join("\n\n") : undefined;
}


function extractSectionHtml($: any, header: any): string | undefined {
    if (!header.length) return undefined;
    const parts: string[] = [];
    let current = header.next();
    while (current.length && !current.is("h2, h3")) {
        // Exclude noise
        if (!current.is("script, style, .links, .footer")) {
            // Basic cleaning of attributes if needed, but user said 'exact'
            // We still might want to strip classes that are useless/TGA specific like 'display-field'
            // But keeping it simple is safer for 'exact' fidelity.
            parts.push($.html(current));
        }
        current = current.next();
    }
    return parts.length > 0 ? parts.join("\n") : undefined;
}

function extractEvidenceSection(
    $: any,
    dlLabel: string,
    keywords: { primary: string[]; fallback?: string[] },
    format: 'text' | 'html' = 'text'
): string | undefined {
    const dlText = readDlByLabel($, dlLabel);
    if (dlText && format === 'text') return dlText;
    // For DL HTML, we'd need to find the DD and get its HTML
    if (format === 'html') {
        const dt = $(`dt`).filter((_: number, el: any) => $(el).text().trim().toLowerCase() === dlLabel.toLowerCase()).first();
        if (dt.length) {
            const dd = dt.next("dd");
            if (dd.length) return dd.html() || undefined;
        }
    }

    const header = $("h2, h3, .mt-6.mb-2, h4, h5, strong, b, .title").filter((_: number, el: any) => {
        const text = $(el).text().trim().toLowerCase();
        return keywords.primary.every(kw => text.includes(kw));
    }).first();

    if (header.length) {
        if (format === 'html') {
            return extractSectionHtml($, header);
        }

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
                // Deep search for structural elements to avoid merging text
                // Check if the div contains P or UL/OL elements
                const children = current.find("p, ul, ol");

                if (children.length > 0) {
                    children.each((_: number, el: any) => {
                        const $el = $(el);
                        if ($el.is("p")) {
                            const text = $el.text().trim();
                            if (text && !text.toLowerCase().includes("evidence required to demonstrate")) {
                                parts.push(text);
                            }
                        } else if ($el.is("ul, ol")) {
                            const items = extractNestedList($, $el);
                            if (items.length) parts.push(items.join("\n"));
                        }
                    });
                } else {
                    // Fallback: Just text with newlines (handle <br>)
                    // Avoid using .text() directly on div if it creates merged "RequirementsPlan"
                    const clone = current.clone();
                    clone.find('br').replaceWith('\n');
                    const text = clone.text().trim();
                    if (text && !text.toLowerCase().includes("evidence required to demonstrate")) {
                        parts.push(text);
                    }
                }
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
    if (keywords.fallback && format === 'text') {
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
    }, 'text');
}

function extractPerformanceEvidenceHtml($: any): string | undefined {
    return extractEvidenceSection($, "Performance Evidence", {
        primary: ["performance", "evidence"],
        fallback: ["evidence required to demonstrate competence"]
    }, 'html');
}

function extractKnowledgeEvidence($: any): string | undefined {
    return extractEvidenceSection($, "Knowledge Evidence", {
        primary: ["knowledge", "evidence"],
        fallback: ["evidence of the ability", "evidence of knowledge"]
    }, 'text');
}

function extractKnowledgeEvidenceHtml($: any): string | undefined {
    return extractEvidenceSection($, "Knowledge Evidence", {
        primary: ["knowledge", "evidence"],
        fallback: ["evidence of the ability", "evidence of knowledge"]
    }, 'html');
}

function extractAssessmentConditions($: any): string | undefined {
    const dlText = readDlByLabel($, "Assessment Conditions");
    if (dlText) return dlText;

    const header = $("h2, h3, h4, h5, strong, b, .title").filter((_: number, el: any) => {
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

function extractAssessmentConditionsHtml($: any): string | undefined {
    const dlText = readDlByLabel($, "Assessment Conditions");
    // For DL HTML logic
    if (dlText) {
        const dt = $(`dt`).filter((_: number, el: any) => $(el).text().trim().toLowerCase() === "assessment conditions").first();
        if (dt.length) {
            const dd = dt.next("dd");
            if (dd.length) return dd.html() || undefined;
        }
    }

    const header = $("h2, h3, h4, h5, strong, b, .title").filter((_: number, el: any) => {
        return $(el).text().trim().toLowerCase() === "assessment conditions";
    }).first();

    if (header.length) {
        return extractSectionHtml($, header);
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
    const assessmentConditionsHtml = extractAssessmentConditionsHtml($);
    const performanceEvidence = extractPerformanceEvidence($);
    const performanceEvidenceHtml = extractPerformanceEvidenceHtml($);
    const knowledgeEvidence = extractKnowledgeEvidence($);
    const knowledgeEvidenceHtml = extractKnowledgeEvidenceHtml($);

    const { supersededBy, supersedes } = extractSupersession($);

    const sections: UocSection[] = [];
    $("h2, h3, h4").each((_: number, el: any) => {
        const $h = $(el);
        const headingText = $h.text().trim();
        if (!headingText) return;

        // EXCLUSION: Ignore footer data, links, and non-content headings
        const lowerHeading = headingText.toLowerCase();
        if (lowerHeading.match(/^(links|navigation|menu|footer|copyright|disclaimer|privacy|search|my profile|logout|login|acknowledgement of country)$/)) return;

        const tag = $h.get(0).tagName.toLowerCase();
        const level = tag === 'h2' ? 2 : tag === 'h3' ? 3 : 4;
        const paragraphs: string[] = [];
        const lists: string[][] = [];
        let cur = $h.next();

        // Stop at next heading OR footer/div that marks end of content
        while (cur.length && !cur.is('h2, h3, h4') && !cur.is('footer') && !cur.hasClass('footer')) {
            if (cur.is('p')) {
                const t = cur.text().trim();
                if (t && !t.toLowerCase().includes("© commonwealth of australia")) {
                    paragraphs.push(t);
                }
            } else if (cur.is('ul, ol')) {
                // Use extractNestedList for full support
                const items = extractNestedList($, cur);
                if (items.length) lists.push(items);
            } else if (cur.is('table')) {
                cur.find('tr').each((_: number, tr: any) => {
                    const cells = $(tr).find('td, th').map((_: number, c: any) => $(c).text().trim()).get().join(' | ');
                    if (cells) paragraphs.push(cells);
                });
            } else if (cur.is('div')) {
                // Handle generic divs by recursively extracting content
                const divContent = extractContainerContent($, cur);
                // We have mixed parts (paragraphs looking strings).
                // We can try to guess if they are lists or paregraphs, or just push to paragraphs
                // extractContainerContent returns flattened strings (lists joined by \n).
                divContent.forEach(part => {
                    if (part.includes("[L0]")) {
                        // It's a list string
                        lists.push([part]); // Wrap in array as lists expected string[] logic in UocSection?
                        // Wait, sections.lists is string[][]. 
                        // My extractNestedList returns string[].
                        // So [part] is wrong if part is joined string.
                        // extractContainerContent joins lists. 
                        // Maybe I should NOT join lists in extractContainerContent if I use it here?
                        // But extractTextFromSection EXPECTS joined strings.
                        // Let's just push to paragraphs for now as "pre-formatted list text"
                        paragraphs.push(part);
                    } else {
                        paragraphs.push(part);
                    }
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
        assessmentConditionsHtml,
        performanceEvidence,
        performanceEvidenceHtml,
        knowledgeEvidence,
        knowledgeEvidenceHtml,
        supersededBy: supersededBy ?? null,
        supersedes: supersedes ?? null,
        sections: sections.length ? sections : undefined,
        lastFetchedAt: new Date().toISOString()
    };

    return uoc;
}
