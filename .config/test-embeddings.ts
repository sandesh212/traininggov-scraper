/**
 * Test script to verify Ollama embeddings
 */

import { generateOllamaEmbedding } from './src/services/ollamaService.js';

async function test() {
  console.log('Testing Ollama embeddings...\n');
  
  // Generate two test embeddings
  const text1 = "This is a test question about maritime safety";
  const text2 = "Demonstrate knowledge of safety procedures";
  
  console.log(`Text 1: "${text1}"`);
  const embed1 = await generateOllamaEmbedding(text1);
  console.log(`Embedding 1 dimensions: ${embed1.length}`);
  console.log(`First 5 values: [${embed1.slice(0, 5).join(', ')}]`);
  
  console.log(`\nText 2: "${text2}"`);
  const embed2 = await generateOllamaEmbedding(text2);
  console.log(`Embedding 2 dimensions: ${embed2.length}`);
  console.log(`First 5 values: [${embed2.slice(0, 5).join(', ')}]`);
  
  console.log(`\n✅ Both embeddings have same dimensions: ${embed1.length === embed2.length}`);
}

test().catch(console.error);
