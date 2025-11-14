import * as cheerio from "cheerio";
import { Uoc, UocElement, UocSection } from "../models/uoc.js";

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

function readDlByLabel($: cheerio.CheerioAPI, label: string): string | undefined {
  const dt = $(`dt`).filter((_: number, el: any) => $(el).text().trim().toLowerCase() === label.toLowerCase()).first();
  if (!dt.length) return undefined;
  const dd = dt.next("dd");
  const text = dd.text().trim();
  return text || undefined;
}

function extractCodeAndTitle($: cheerio.CheerioAPI): { code: string; title: string } {
  // Look for the hero subtitle div that contains code and title
  const heroSubheading = $(".heroSubheading .title");
  
  if (heroSubheading.length) {
    const strongText = heroSubheading.find("strong").first().text().trim();
    const fullText = heroSubheading.text().trim();
    
    if (strongText && fullText) {
      const title = fullText.replace(strongText, "").trim();
      return { code: strongText, title };
    }
  }

  // Fallback: check h1
  const h1 = $("h1").first().text().trim();

  // Handle pages that use the text "Unit of Competency: CODE" in h1
  const uocMatch = /Unit of Competency:\s*([A-Z]{2,}\w*\d{2,})/i.exec(h1);
  if (uocMatch) {
    const code = uocMatch[1];
    // Try to read a title from an H2 like "Title: ..."
    const h2 = $("h2").first().text().trim();
    const titleMatch = h2.match(/Title:\s*(.+)$/i);
    const title = titleMatch ? titleMatch[1].trim() : "";
    return { code, title };
  }

  const match = /^([A-Z]{2,}\w*\d{2,})\s*[-–—]?\s*(.+)$/.exec(h1);
  if (match) return { code: match[1], title: match[2] };

  return { code: "Unknown", title: "Unknown" };
}

function extractStatus($: cheerio.CheerioAPI): { status?: string; release?: string } {
  let status: string | undefined;
  $(".mint-pill").each((_: number, el: any) => {
    const text = $(el).text().trim().toLowerCase();
    if (text === "current" || text === "superseded" || text === "deleted") {
      status = text.charAt(0).toUpperCase() + text.slice(1);
    }
  });

  // Extract release number with proper spacing
  const releaseText = $(".release-label").parent().text();
  const releaseMatch = releaseText.match(/Release\s*(\d+)/i);
  const release = releaseMatch ? `Release ${releaseMatch[1]}` : undefined;

  return { status, release };
}

function extractSupersession($: cheerio.CheerioAPI): {
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

function extractElementsAndPC($: cheerio.CheerioAPI): UocElement[] | undefined {
  const items: UocElement[] = [];
  
  // Find all tables
  const tables = $("table");
  
  tables.each((i: number, table: any) => {
    const $table = $(table);
    
    // Check if this table contains "Elements" and "Performance Criteria"
    const hasElements = $table.text().toLowerCase().includes("elements");
    const hasPC = $table.text().toLowerCase().includes("performance criteria");
    
    if (hasElements && hasPC) {
      let currentElement: UocElement | null = null;
      
      // Process each row in tbody
      $table.find("tbody tr").each((rowIdx: number, tr: any) => {
        const $tr = $(tr);
        const tds = $tr.find("td");
        
        // Skip header/description rows
        if (tds.length < 2) return;
        
        const cells = tds.map((_: number, td: any) => $(td).text().trim()).get();
        
        // Skip the description row
        if (cells[0].toLowerCase().includes("elements describe")) return;
        
        // Format 1: 2-column table (Element | Performance Criteria with list)
        // Common in BSB units - PCs are in a list within the second cell
        if (cells.length === 2 && cells[0] && cells[1]) {
          const elementText = cells[0];
          const pcText = cells[1];
          
          // Check if this looks like a new element (not empty, not just whitespace)
          if (elementText && !elementText.match(/^\s*$/)) {
            currentElement = {
              element: elementText,
              performanceCriteria: []
            };
            items.push(currentElement);
            
            // Extract PCs from the second cell - they might be in a list or numbered
            const $pcCell = $(tds[1]);
            
            // Try to find list items
            const listItems = $pcCell.find("li");
            if (listItems.length > 0) {
              listItems.each((_: number, li: any) => {
                const text = $(li).text().trim();
                if (text) currentElement!.performanceCriteria.push(text);
              });
            } else {
              // No list - try to split by newlines or numbers
              const lines = pcText.split(/\n+/).filter(l => l.trim());
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && trimmed.length > 5) {
                  currentElement.performanceCriteria.push(trimmed);
                }
              }
            }
          }
        }
        // Format 2: 3-column table (Element | PC Number | PC Text)
        // Common in MAR units
        else if (cells.length === 3 && cells[0] && cells[1] && cells[2]) {
          const elementText = cells[0];
          const pcNumber = cells[1];
          const pcText = cells[2];
          
          // If element text doesn't look like a PC number, it's a new element
          if (!elementText.match(/^\d+\.\d+$/)) {
            currentElement = {
              element: elementText,
              performanceCriteria: []
            };
            items.push(currentElement);
            
            // Add the first PC
            if (pcNumber.match(/^\d+\.\d+$/) && pcText) {
              currentElement.performanceCriteria.push(`${pcNumber} ${pcText}`);
            }
          }
        }
        // Format 3: Continuation row (4 cells: empty, empty, PC number, PC text)
        else if (cells.length === 4 && currentElement) {
          const pcNumber = cells[2];
          const pcText = cells[3];
          
          if (pcNumber && pcText && pcNumber.match(/^\d+\.\d+$/)) {
            currentElement.performanceCriteria.push(`${pcNumber} ${pcText}`);
          }
        }
      });
    }
  });

  return items.length > 0 ? items : undefined;
}

function extractListFromSection($: cheerio.CheerioAPI, headerContains: string): string[] | undefined {
  const header = $("h2, h3, h4").filter((_: number, el: any) =>
    $(el).text().toLowerCase().includes(headerContains.toLowerCase())
  ).first();

  if (!header.length) return undefined;

  const list = header.nextAll("ul, ol").first();
  if (!list.length) return undefined;

  return list.find("li").map((_: number, li: any) => $(li).text().trim()).get();
}

function extractTextFromSection($: cheerio.CheerioAPI, headerText: string): string | undefined {
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

// Shared helper: Extract nested list items at any depth
function extractNestedList($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>, depth: number = 0): string[] {
  const items: string[] = [];
  const indent = "  ".repeat(depth);
  const bullet = depth === 0 ? "•" : "◦";
  
  $el.children("li").each((_: number, li: any) => {
    const $li = $(li);
    // Get text of this li, excluding nested ul/ol
    const text = $li.clone().children("ul, ol").remove().end().text().trim();
    
    if (text && !text.toLowerCase().includes("evidence required to demonstrate")) {
      items.push(`${indent}${bullet} ${text}`);
    }
    
    // Recursively extract nested lists
    $li.children("ul, ol").each((_: number, nestedList: any) => {
      const nestedItems = extractNestedList($, $(nestedList), depth + 1);
      items.push(...nestedItems);
    });
  });
  
  return items;
}

// Shared helper: Extract evidence sections (PE/KE) with multiple strategies
// Extracts ALL content: paragraphs, bullet points, nested lists, etc.
function extractEvidenceSection(
  $: cheerio.CheerioAPI, 
  dlLabel: string,
  keywords: { primary: string[]; fallback?: string[] }
): string | undefined {
  // Strategy 1: Check <dl> tags
  const dlText = readDlByLabel($, dlLabel);
  if (dlText) return dlText;
  
  // Strategy 2: Find heading containing keywords and extract ALL content until next heading
  const header = $("h2, h3, .mt-6.mb-2, h4").filter((_: number, el: any) => {
    const text = $(el).text().trim().toLowerCase();
    return keywords.primary.every(kw => text.includes(kw));
  }).first();

  if (header.length) {
    const parts: string[] = [];
    let current = header.next();
    
    // Extract everything until we hit another major heading (h2/h3) or run out of siblings
    while (current.length && !current.is("h2, h3")) {
      // Extract paragraph text
      if (current.is("p")) {
        const text = current.text().trim();
        if (text && !text.toLowerCase().includes("evidence required to demonstrate")) {
          parts.push(text);
        }
      }
      // Extract list items (with nesting)
      else if (current.is("ul, ol")) {
        const items = extractNestedList($, current);
        if (items.length > 0) {
          parts.push(items.join("\n"));
        }
      }
      // Check for content in divs or other containers
      else if (current.is("div")) {
        // Extract paragraphs within div
        const paragraphs = current.find("p");
        paragraphs.each((_idx: number, pElem: any) => {
          const $p = $(pElem);
          const text = $p.text().trim();
          if (text && !text.toLowerCase().includes("evidence required to demonstrate")) {
            parts.push(text);
          }
        });
        
        // Extract lists within div
        const lists = current.find("ul, ol");
        lists.each((_idx: number, listElem: any) => {
          const $list = $(listElem);
          const items = extractNestedList($, $list);
          if (items.length > 0) {
            parts.push(items.join("\n"));
          }
        });
      }
      // Try to find the table structure (some units use tables)
      else if (current.is("table") || current.find("table").length) {
        const table = current.is("table") ? current : current.find("table").first();
        
        // Extract text from table cells
        const tableParagraphs = table.find("p");
        tableParagraphs.each((_idx: number, pElem: any) => {
          const $p = $(pElem);
          const text = $p.text().trim();
          if (text && !text.toLowerCase().includes("evidence required to demonstrate")) {
            parts.push(text);
          }
        });
        
        // Extract lists from table
        const mainUl = table.find("tbody tr td > ul, tbody tr td > ol").first();
        if (mainUl.length) {
          const items = extractNestedList($, mainUl);
          if (items.length > 0) {
            parts.push(items.join("\n"));
          }
        }
      }
      
      current = current.next();
    }
    
    if (parts.length > 0) {
      return parts.join("\n\n");
    }
  }
  
  // Strategy 3: Search for fallback content keywords
  if (keywords.fallback) {
    const evidenceText = $("*").filter((_: number, el: any) => {
      const text = $(el).text().toLowerCase();
      return keywords.fallback!.some(kw => text.includes(kw));
    }).first();
    
    if (evidenceText.length) {
      const parts: string[] = [];
      const parent = evidenceText.closest("div, section, article, td");
      
      // Extract all paragraphs
      const paragraphs = parent.find("p");
      paragraphs.each((_idx: number, pElem: any) => {
        const $p = $(pElem);
        const text = $p.text().trim();
        if (text) parts.push(text);
      });
      
      // Extract all lists
      const lists = parent.find("ul, ol");
      lists.each((_idx: number, listElem: any) => {
        const $list = $(listElem);
        const items = extractNestedList($, $list);
        if (items.length > 0) {
          parts.push(items.join("\n"));
        }
      });
      
      if (parts.length > 0) {
        return parts.join("\n\n");
      }
    }
  }
  
  return undefined;
}

function extractPerformanceEvidence($: cheerio.CheerioAPI): string | undefined {
  return extractEvidenceSection($, "Performance Evidence", {
    primary: ["performance", "evidence"],
    fallback: ["evidence required to demonstrate competence"]
  });
}

function extractKnowledgeEvidence($: cheerio.CheerioAPI): string | undefined {
  return extractEvidenceSection($, "Knowledge Evidence", {
    primary: ["knowledge", "evidence"],
    fallback: ["evidence of the ability", "evidence of knowledge"]
  });
}

function extractAssessmentConditions($: cheerio.CheerioAPI): string | undefined {
  // Try multiple strategies to find assessment conditions
  
  // Strategy 1: Look in <dl> tags
  const dlText = readDlByLabel($, "Assessment Conditions");
  if (dlText) return dlText;
  
  // Strategy 2: Find h2/h3/h4 heading
  const header = $("h2, h3, h4").filter((_: number, el: any) => {
    return $(el).text().trim().toLowerCase() === "assessment conditions";
  }).first();

  if (header.length) {
    const parts: string[] = [];
    let current = header.next();
    
    while (current.length && !current.is("h2, h3")) {
      if (current.is("p")) {
        const text = current.text().trim();
        if (text) parts.push(text);
      } else if (current.is("ul, ol")) {
        const items = current.find("li").map((_: number, li: any) => 
          "• " + $(li).text().trim()
        ).get();
        if (items.length) parts.push(items.join("\n"));
      }
      current = current.next();
    }
    
    if (parts.length > 0) return parts.join("\n\n");
  }
  
  // Strategy 3: Search in all text for "Assessment conditions" section
  const allText = $("body").text();
  const acMatch = allText.match(/Assessment conditions\s+([\s\S]+?)(?=\n\s*(?:Performance evidence|Knowledge evidence|Range|$))/i);
  if (acMatch) {
    return acMatch[1].trim().replace(/\s+/g, ' ').substring(0, 2000);
  }
  
  return undefined;
}

function extractLicensingInfo($: cheerio.CheerioAPI): string | undefined {
  // Strategy 1: Look in <dl> tags
  const dlText = readDlByLabel($, "Licensing/Regulatory Information");
  if (dlText) return dlText;
  
  // Strategy 2: Find the heading
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
  
  // Strategy 3: Extract from text (fallback)
  const allText = $("body").text();
  const licMatch = allText.match(/Licensing\/Regulatory Information\s+([\s\S]+?)(?=\n\s*(?:Pre-requisite|Application|$))/i);
  if (licMatch) {
    return licMatch[1].trim().replace(/\s+/g, ' ').substring(0, 500);
  }
  
  return undefined;
}

function cleanApplication(text: string | undefined): string | undefined {
  if (!text) return undefined;
  
  // Remove the embedded Licensing/Regulatory Information section
  const cleaned = text
    .replace(/\n\s*Licensing\/Regulatory Information[\s\S]*?(?=\n|$)/i, '')
    .trim();
  
  return cleaned || undefined;
}

export function parseUocHtml(html: string, url: string): Uoc {
  const $ = cheerio.load(html);

  const { code, title } = extractCodeAndTitle($);
  // Extract a short description if present (paragraph with 'Description:')
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

  // Generic hierarchical section extraction (captures order & raw content)
  const sections: UocSection[] = [];
  $("h2, h3, h4").each((_: number, el: any) => {
    const $h = $(el);
    const headingText = $h.text().trim();
    if (!headingText) return;
    const tag = $h.get(0).tagName.toLowerCase();
    const level = tag === 'h2' ? 2 : tag === 'h3' ? 3 : 4;
    const paragraphs: string[] = [];
    const lists: string[][] = [];
    let cur = $h.next();
    while (cur.length && !cur.is('h2, h3, h4')) {
      if (cur.is('p')) {
        const t = cur.text().trim();
        if (t) paragraphs.push(t);
      } else if (cur.is('ul, ol')) {
        const items = cur.find('> li').map((i: number, li: any) => {
          const $li = $(li);
          // Remove nested lists for text capture
          const cloned = $li.clone();
          cloned.children('ul, ol').remove();
          return cloned.text().trim();
        }).get().filter(Boolean);
        if (items.length) lists.push(items);
      }
      cur = cur.next();
    }
    sections.push({ heading: headingText, level, paragraphs, lists });
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