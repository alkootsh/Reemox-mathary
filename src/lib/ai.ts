import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export async function analyzeWithAI(prompt: string) {
  const result = await ai.models.generateContent({
    model: "gemini-3.7-flash",
    contents: prompt,
  });
  return result.text;
}

export async function forecastDemand(productName: string, recentSales: number[]) {
  const prompt = `Analyze sales data for ${productName}: ${recentSales.join(", ")}. Forecast demand for next month and suggest EOQ (Economic Order Quantity). Format: JSON { "forecast": number, "eoq": number, "reasoning": string }`;
  const response = await analyzeWithAI(prompt);
  return JSON.parse(response.replace(/```json/g, "").replace(/```/g, ""));
}

export async function analyzeSuppliers(productName: string, suppliers: { name: string; price: number; leadTimeDays: number }[]) {
  const prompt = `Analyze suppliers for ${productName}: ${JSON.stringify(suppliers)}. Suggest the best supplier based on price and lead time. Format: JSON { "bestSupplier": string, "reasoning": string }`;
  const response = await analyzeWithAI(prompt);
  return JSON.parse(response.replace(/```json/g, "").replace(/```/g, ""));
}
