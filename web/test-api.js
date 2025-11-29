// Simple test script for the /api/analyze endpoint
// Requires node-fetch and form-data (already installed)
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

(async () => {
    try {
        const apiUrl = 'http://localhost:3001/api/analyze'; // dev server runs on 3001
        const docxPath = '/Users/sandeshkumar/Downloads/traininggov-scraper/Knowledge Coxswain Deck Marking Sheet.docx';
        if (!fs.existsSync(docxPath)) {
            console.error('DOCX file not found at', docxPath);
            process.exit(1);
        }
        const form = new FormData();
        form.append('assessmentFile', fs.createReadStream(docxPath));
        // No unitsFile for this test

        const response = await fetch(apiUrl, {
            method: 'POST',
            body: form,
            headers: form.getHeaders(),
        });

        const json = await response.json();
        console.log('Status:', response.status);
        console.log('Response keys:', Object.keys(json));
        if (json.questionsCount !== undefined) {
            console.log('✅ Questions extracted:', json.questionsCount);
        }
        if (json.results) {
            console.log('✅ AI analysis results count:', json.results.length);
        }
        if (json.redTextSegments) {
            console.log('✅ Red text segments count:', json.redTextSegments.length);
        }
        // pretty‑print a few questions
        if (json.questionsCount && json.questionsCount > 0) {
            console.log('\n--- Sample extracted questions ---');
            // The API currently returns only counts; to see actual questions you may need to modify the route.
        }
    } catch (err) {
        console.error('Error during test:', err);
    }
})();
