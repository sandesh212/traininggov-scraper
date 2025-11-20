/**
 * Ollama AI Service
 * 
 * Local AI service using Ollama for embeddings and text generation
 * FREE and runs completely offline on your computer
 */

import { Ollama } from 'ollama';

const ollama = new Ollama({ host: 'http://localhost:11434' });

export interface OllamaConfig {
  embeddingModel: string;
  chatModel: string;
  temperature: number;
}

const DEFAULT_CONFIG: OllamaConfig = {
  embeddingModel: 'nomic-embed-text',  // Best for embeddings
  chatModel: 'llama3.2',                // Fast and good quality
  temperature: 0.3,
};

/**
 * Check if Ollama is running and models are available
 */
export async function checkOllamaAvailability(): Promise<{
  available: boolean;
  models: string[];
  message: string;
}> {
  try {
    const response = await ollama.list();
    const modelNames = response.models.map(m => m.name);
    
    const hasEmbedding = modelNames.some(m => m.includes('nomic-embed-text'));
    const hasChat = modelNames.some(m => m.includes('llama'));
    
    if (!hasEmbedding || !hasChat) {
      return {
        available: false,
        models: modelNames,
        message: 'Ollama is running but required models are not installed',
      };
    }
    
    return {
      available: true,
      models: modelNames,
      message: 'Ollama is ready',
    };
  } catch (error) {
    return {
      available: false,
      models: [],
      message: 'Ollama is not running or not installed',
    };
  }
}

/**
 * Generate embedding using Ollama
 */
export async function generateOllamaEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ollama.embeddings({
      model: DEFAULT_CONFIG.embeddingModel,
      prompt: text,
    });
    
    return response.embedding;
  } catch (error) {
    throw new Error(`Failed to generate Ollama embedding: ${error}`);
  }
}

/**
 * Generate text completion using Ollama
 */
export async function generateOllamaCompletion(prompt: string): Promise<string> {
  try {
    const response = await ollama.generate({
      model: DEFAULT_CONFIG.chatModel,
      prompt,
      stream: false,
      options: {
        temperature: DEFAULT_CONFIG.temperature,
      },
    });
    
    return response.response;
  } catch (error) {
    throw new Error(`Failed to generate Ollama completion: ${error}`);
  }
}

/**
 * Generate match explanation using Ollama
 */
export async function generateOllamaMatchExplanation(
  question: string,
  performanceCriterion: string,
  similarity: number
): Promise<string> {
  const prompt = `You are an RTO assessment validator. Analyze how this assessment question aligns with the performance criterion.

Assessment Question: "${question}"

Performance Criterion: "${performanceCriterion}"

Similarity Score: ${(similarity * 100).toFixed(1)}%

Provide a brief explanation (2-3 sentences) of:
1. How the question addresses the performance criterion
2. What specific skills or knowledge it assesses
3. Whether the match is strong, moderate, or weak

Keep it professional and concise.`;

  return generateOllamaCompletion(prompt);
}

/**
 * Download required Ollama models
 */
export async function downloadOllamaModels(
  onProgress?: (status: string) => void
): Promise<void> {
  const models = [DEFAULT_CONFIG.embeddingModel, DEFAULT_CONFIG.chatModel];
  
  for (const model of models) {
    try {
      if (onProgress) onProgress(`Downloading ${model}...`);
      
      await ollama.pull({
        model,
        stream: false,
      });
      
      if (onProgress) onProgress(`✓ ${model} ready`);
    } catch (error) {
      throw new Error(`Failed to download ${model}: ${error}`);
    }
  }
}

/**
 * Get Ollama system info
 */
export async function getOllamaInfo(): Promise<{
  version: string;
  models: Array<{ name: string; size: number }>;
}> {
  try {
    const response = await ollama.list();
    return {
      version: 'unknown', // Ollama doesn't expose version in API
      models: response.models.map(m => ({
        name: m.name,
        size: m.size,
      })),
    };
  } catch (error) {
    throw new Error('Failed to get Ollama info');
  }
}
