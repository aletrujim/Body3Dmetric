
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResponse } from "../types";

export const analyzeBodyImage = async (base64Image: string, userHeight: number, userAge: number): Promise<AnalysisResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
        {
          text: `Analyze this full-body photo for 3D reconstruction. 
          The user is ${userAge} years old and ${userHeight}cm tall.
          Calculate the following width ratios relative to the total height of the person in the image.
          Use the age and height as context for body fat distribution (biometrics).
          
          1. waistWidth / totalHeight
          2. hipWidth / totalHeight
          3. shoulderWidth / totalHeight
          4. chestWidth / totalHeight
          5. torsoHeight (from neck base to hips) / totalHeight
          
          Return only the JSON data.`
        }
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          measurements: {
            type: Type.OBJECT,
            properties: {
              waistRatio: { type: Type.NUMBER },
              hipRatio: { type: Type.NUMBER },
              shoulderRatio: { type: Type.NUMBER },
              chestRatio: { type: Type.NUMBER },
              torsoHeightRatio: { type: Type.NUMBER }
            },
            required: ["waistRatio", "hipRatio", "shoulderRatio", "chestRatio", "torsoHeightRatio"]
          },
          confidence: { type: Type.NUMBER }
        },
        required: ["measurements", "confidence"]
      },
    },
  });

  try {
    const data = JSON.parse(response.text || '{}');
    return data as AnalysisResponse;
  } catch (error) {
    console.error("Failed to parse analysis response", error);
    throw new Error("Could not analyze body proportions.");
  }
};
