import { Crawler } from "./crawler.js";
import { Fetcher } from "./fetcher.js";
import { ExportService } from "./services/exportService.js";
import { MaritimeExcelService } from "./services/maritimeExcelService.js";
import { promises as fs } from "fs";

function parseArgs(): string[] {
  const args = process.argv.slice(2);
  if (args.length) return args;
  const env = process.env.START_URLS as string | undefined;
  if (env) return env.split(",").map((s: string) => s.trim()).filter(Boolean);
  return ["https://training.gov.au/training/details/MARH013/unitdetails"];
}

async function main() {
  const urls = parseArgs();

  // DEBUG: Save rendered HTML to file
  if (process.env.DEBUG_HTML) {
    console.log("DEBUG MODE: Saving rendered HTML to debug-rendered.html");
    const fetcher = new Fetcher({
      minDelayMs: 2000,
      headless: true,
      timeout: 30000
    });
    const html = await fetcher.get(urls[0]);
    await fetcher.close();
    await fs.writeFile("debug-rendered.html", html, "utf-8");
    console.log(`✅ Saved ${html.length} bytes to debug-rendered.html`);
    console.log("First 1000 chars:");
    console.log(html.substring(0, 1000));
    return;
  }

  console.log(`Starting scrape of ${urls.length} URL(s)...`);
  console.log(`URLs: ${urls.join(', ')}\n`);

  const fetcher = new Fetcher({
    minDelayMs: 3000,
    headless: true,
    timeout: 30000
  });

  const exporter = new ExportService("data");
  const crawler = new Crawler(fetcher, exporter, {
    concurrency: 1,
    onItem: (item) => {
      console.log("\n" + "=".repeat(80));
      console.log(`📋 UNIT: ${item.code} - ${item.title}`);
      console.log("=".repeat(80));
      
      // Basic Info
      console.log(`\n📌 Status: ${item.status || 'N/A'} | Release: ${item.release || 'N/A'}`);
      console.log(`🔗 URL: ${item.url}`);
      
      // Supersession
      if (item.supersedes) {
        console.log(`⬅️  Supersedes: ${item.supersedes.code}`);
      }
      if (item.supersededBy) {
        console.log(`➡️  Superseded by: ${item.supersededBy.code}`);
      }
      
      // Prerequisites
      if (item.prerequisites && item.prerequisites.length > 0) {
        console.log(`\n📚 Prerequisites: ${item.prerequisites.join(', ')}`);
      }
      
      // Elements
      if (item.elements && item.elements.length > 0) {
        console.log(`\n🎯 Elements (${item.elements.length}):`);
        item.elements.forEach((el, idx) => {
          console.log(`  ${idx + 1}. ${el.element}`);
          console.log(`     → ${el.performanceCriteria.length} performance criteria`);
        });
      }
      
      // Performance Evidence
      if (item.performanceEvidence) {
        const lines = item.performanceEvidence.split('\n');
        console.log(`\n✅ Performance Evidence (${lines.length} items):`);
        console.log(lines.slice(0, 5).map(l => `  ${l}`).join('\n'));
        if (lines.length > 5) {
          console.log(`  ... and ${lines.length - 5} more items`);
        }
      }
      
      // Knowledge Evidence
      if (item.knowledgeEvidence) {
        const lines = item.knowledgeEvidence.split('\n');
        console.log(`\n📖 Knowledge Evidence (${lines.length} items):`);
        console.log(lines.slice(0, 5).map(l => `  ${l}`).join('\n'));
        if (lines.length > 5) {
          console.log(`  ... and ${lines.length - 5} more items`);
        }
      }
      
      // Assessment Conditions
      if (item.assessmentConditions) {
        const preview = item.assessmentConditions.substring(0, 150);
        console.log(`\n📋 Assessment Conditions: ${preview}${item.assessmentConditions.length > 150 ? '...' : ''}`);
      }
      
      // Foundation Skills
      if (item.foundationSkills) {
        const preview = item.foundationSkills.substring(0, 150);
        console.log(`\n🔧 Foundation Skills: ${preview}${item.foundationSkills.length > 150 ? '...' : ''}`);
      }
      
      console.log("\n" + "=".repeat(80) + "\n");
    }
  });

  await crawler.crawlUocUrls(urls);
  console.log("\n✅ Done. Check data/uoc.jsonl");

  // Export to Excel
  const excelExporter = new MaritimeExcelService("data", "UnitsData.xlsx");
  await excelExporter.generateExcel();
}

main().catch((e) => {
  console.error("\n❌ Fatal error:", e);
  process.exit(1);
});