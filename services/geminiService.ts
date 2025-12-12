import { GoogleGenAI } from "@google/genai";
import { GeoPoint, DataProduct } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async analyzeRegion(
    points: GeoPoint[],
    product: DataProduct,
    city: string
  ): Promise<string> {
    if (!process.env.API_KEY) {
      return "API Key missing. Please provide a valid Gemini API Key to enable AI analysis.";
    }

    const avgValue = points.reduce((acc, p) => acc + p.value, 0) / (points.length || 1);
    const trend = points.reduce((acc, p) => acc + p.trend, 0) / (points.length || 1);

    const prompt = `
      You are an expert data analyst for Statistics Canada.
      Analyze the following aggregated data for ${city}.
      
      Dataset: ${product.title} (${product.category})
      Variable: ${product.variableName}
      Average Value: ${Math.round(avgValue)} ${product.units}
      Average Trend: ${trend.toFixed(2)} (Range -1 to 1, where 1 is sharp increase)
      
      Data sample size: ${points.length} points.

      Provide a concise, 2-sentence insight about what this means for the region. 
      Interpret the trend specific to this dataset (e.g. rising crime is bad, rising income is good).
      Do not format as markdown. plain text only.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text || "Analysis complete.";
    } catch (error) {
      console.error("Gemini analysis failed", error);
      return "AI analysis currently unavailable.";
    }
  }
}

export const geminiService = new GeminiService();