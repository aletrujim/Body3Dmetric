
export interface BodyMeasurements {
  height: number; // in cm
  weight: number; // in kg
  waistWidth: number; // relative 0-1 (meters for ThreeJS)
  hipWidth: number; // relative 0-1 (meters for ThreeJS)
  shoulderWidth: number; // relative 0-1
  chestWidth: number; // relative 0-1
  waistCircumference: number; // in cm
  hipCircumference: number; // in cm
  bmi: number;
  whr: number; // Waist-to-Hip Ratio (ICC)
  whtr: number; // Waist-to-Height Ratio (ICT)
}

export interface AnalysisResponse {
  measurements: {
    waistRatio: number; // width relative to total height
    hipRatio: number;   // width relative to total height
    shoulderRatio: number;
    chestRatio: number;
    torsoHeightRatio: number;
  };
  confidence: number;
}
