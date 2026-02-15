import { ai, MODEL } from "../lib/gemini";

export const suggestFix = async ({
  errorDetails,
}: {
  errorDetails: {
    errorFound: boolean;
    errors: {
      errorMessage: string;
      rootCause: string;
      errorType: string;
      needsRestart: boolean;
      needsRedeploy: boolean;
    }[];
  };
}) => {
  console.log("Received errorDetails in suggestFix:", errorDetails);

  const prompt = `You are a DevOps SRE expert. You will receive an object called "errorDetails" that contains one or more detected errors. For EACH error inside errorDetails.errors, generate a fix recommendation.

For each error, extract:
- errorMessage
- errorType
- rootCause (if available)

Then generate:
- fix: a short, actionable fix written for engineers
- commands: an array of terminal commands (only if applicable)

Return ONLY valid raw JSON. 
Do NOT wrap the output in triple backticks json or any code block.
Do NOT include explanations, text, or commentary outside the JSON.

Return JSON in EXACTLY this format:

{
  "fixes": [
    {
      "errorMessage": "...",
      "fix": "...",
      "commands": ["...", "..."]
    }
  ]
}

Rules:          
- If multiple errors exist, return one object per error inside "fixes".
- If no commands apply, return an empty array for "commands".
- If errorDetails.errorFound is false, return: 
  { "fixes": [] }

Here is the errorDetails object:
${JSON.stringify(errorDetails)}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });
    let text: string | undefined = response.text;
    console.log("Raw AI Response:", text);
    if (!text) throw new Error("No response from AI");

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    return JSON.parse(text);
  } catch (err) {
    console.error("Error in suggestFix", err);
    return { fixes: [] };
  }
};