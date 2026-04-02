import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

// Agent A: Security - Crisis Keywords
const CRISIS_KEYWORDS = /\b(suicide|kill myself|end it all|harm myself|crisis|die)\b/i;

const CRISIS_SOP = {
  ttp: "CRITICAL_SYSTEM_FAILURE",
  riskScore: 10,
  remediation: [
    "IMMEDIATE EMERGENCY OVERRIDE: Local Bogor Support (Kementerian Kesehatan): 119.",
    "International Resources: https://www.befrienders.org/",
    "DEPLOYMENT BLOCKED: Human intervention required immediately."
  ]
};

// Reasoning Engine System Instruction
const SYSTEM_INSTRUCTION = `
You are a Senior Cognitive Security Analyst working within the Psych-Sentinel SOAR platform.
Your mission is to perform deep-packet inspection on psychological distortions (thought packets).

OUTPUT REQUIREMENTS:
1. You must return VALID JSON ONLY. No markdown, no conversational text.
2. Identify the Cognitive TTP (e.g., Catastrophizing, Identity Spoofing, Fortune Telling).
3. Assign a Risk Score (1-10) based on emotional volatility.
4. Provide a 3-step Technical SOP (Standard Operating Procedure) for immediate remediation.

SCHEMA:
{
  "ttp": "string",
  "riskScore": number,
  "remediation": ["step 1", "step 2", "step 3"]
}
`;

export async function generateRemediation(payload, retries = 3) {
  // Agent A: Safety Sanitization
  if (CRISIS_KEYWORDS.test(payload)) {
    console.warn("Safety Filter Triggered: Crisis keywords detected.");
    return CRISIS_SOP;
  }

  // Agent B: Integration - Orchestrator
  // Attempting to resolve 404 by using the fully qualified model string
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash", 
  });

  for (let i = 0; i < retries; i++) {
    try {
      // Inlining system instructions to maximize compatibility across API versions
      const prompt = `${SYSTEM_INSTRUCTION}\n\nINPUT PAYLOAD: "${payload}"`;
      const result = await model.generateContent(prompt);
      
      const response = await result.response;
      const text = response.text();
      
      // Clean up potential markdown formatting
      const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error(`Reasoning Engine Error (Attempt ${i + 1}):`, error);
      
      // Fallback to heuristic if AI fails
      if (i === retries - 1) {
          console.warn("AI Engine Failed. Deploying Heuristic Remediation.");
          return {
              ttp: "Heuristic Search Result",
              riskScore: 5,
              remediation: ["Analyze thought for logical fallacies.", "Identify core emotional trigger.", "Apply 5-4-3-2-1 grounding technique."]
          };
      }
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}
