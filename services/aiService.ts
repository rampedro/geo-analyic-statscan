import { GoogleGenAI } from "@google/genai";
import { GeoPoint, DataProduct, AIConfig } from "../types";

export class AIService {
  private ai: GoogleGenAI | null = null;
  private config: AIConfig = {
    provider: 'gemini',
    geminiKey: process.env.API_KEY || '',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3'
  };

  updateConfig(newConfig: Partial<AIConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (this.config.provider === 'gemini' && this.config.geminiKey) {
      this.ai = new GoogleGenAI({ apiKey: this.config.geminiKey });
    }
  }

  getConfig() {
    return this.config;
  }

  async analyzeRegion(
    points: GeoPoint[],
    product: DataProduct,
    city: string
  ): Promise<string> {
    const avgValue = points.reduce((acc, p) => acc + p.value, 0) / (points.length || 1);
    const trend = points.reduce((acc, p) => acc + p.trend, 0) / (points.length || 1);
    
    // Construct Prompt
    const prompt = `
      You are an expert data analyst for Statistics Canada.
      Analyze the following aggregated data for ${city}.
      
      Dataset: ${product.title} (${product.category})
      Variable: ${product.variableName}
      Average Value: ${Math.round(avgValue)} ${product.units}
      Average Trend: ${trend.toFixed(2)} (Range -1 to 1, where 1 is sharp increase)
      
      Data sample size: ${points.length} points.

      Provide a concise, 2-sentence insight about what this means for the region. 
      Interpret the trend specific to this dataset. Plain text only.
    `;

    try {
      if (this.config.provider === 'ollama') {
        return await this.callOllama(prompt);
      } else {
        return await this.callGemini(prompt);
      }
    } catch (error) {
      console.error("AI analysis failed", error);
      return `Analysis failed using ${this.config.provider}. Please check settings.`;
    }
  }

  private async callGemini(prompt: string): Promise<string> {
    if (!this.ai && process.env.API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    if (!this.ai) return "Gemini API Key missing.";

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No response from Gemini.";
  }

  private async callOllama(prompt: string): Promise<string> {
    const url = `${this.config.ollamaUrl}/api/generate`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.ollamaModel,
        prompt: prompt,
        stream: false
      })
    });
    
    if (!response.ok) throw new Error(`Ollama Error: ${response.statusText}`);
    
    const data = await response.json();
    return data.response || "No response from Ollama.";
  }
}

export const aiService = new AIService();