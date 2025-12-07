import * as fs from 'fs';
import AdmZip from 'adm-zip';
import * as path from 'path';

const buffer = fs.readFileSync(path.join('..', 'Knowledge Coxswain Deck Marking Sheet.docx'));
const zip = new AdmZip(buffer);
const xml = zip.readAsText('word/document.xml');

console.log(xml.substring(0, 2000)); // Print first 2000 chars

// Also search for "<w:drawing"
const idx = xml.indexOf('<w:drawing');
if (idx !== -1) {
    console.log('\nFound drawing at index', idx);
    console.log(xml.substring(idx - 100, idx + 500));
} else {
    console.log('\nNo drawing found');
}
