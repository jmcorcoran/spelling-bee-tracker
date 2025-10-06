import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: "Invalid input: text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Parsing hints text with AI...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a parser for NYT Spelling Bee hints. The hints are formatted as a TABLE with this EXACT structure:

TABLE STRUCTURE:
Row 1 (Header): Column headers showing word lengths (e.g., 4, 5, 6, 7, 8...) and final column is Σ (sum - IGNORE THIS)
Rows 2-N: Each starts with a LETTER (A-Z), followed by counts for each word length, final column is total (IGNORE THIS)
Last Row: Σ (sum row - IGNORE THIS ENTIRE ROW)

PARSING RULES:
1. First row: Extract ONLY the numeric word lengths, IGNORE the final Σ column
2. Data rows: Extract the starting LETTER and the counts for each word length
3. SKIP the last column in each data row (it's a sum)
4. SKIP the last row entirely (it's a sum row with Σ)
5. Map each count to its corresponding word length from the header

EXAMPLE:
       4   5   6   7   Σ
   A   2   4   1   -   7
   B   5   3   1   4   13
   Σ   7   7   2   4   20

Parse as:
- Word lengths: [4, 5, 6, 7]
- Letter A: 2 words of length 4, 4 words of length 5, 1 word of length 6, 0 of length 7
- Letter B: 5 words of length 4, 3 words of length 5, 1 word of length 6, 4 of length 7
- Skip the Σ row
- Skip all Σ columns

Return ONLY valid JSON:
{
  "allowedLetters": ["A", "B"],
  "pangrams": 2,
  "totalWords": 20,
  "hintsGrid": {
    "A": { "4": 2, "5": 4, "6": 1 },
    "B": { "4": 5, "5": 3, "6": 1, "7": 4 }
  },
  "twoLetterList": [
    { "combo": "AB", "count": 5 }
  ]
}

CRITICAL:
- Use ONLY letters A-Z from data rows (before the Σ row)
- Map counts to correct word lengths from header row
- Dashes (-) or zeros mean no words at that length (skip them)
- Calculate totalWords by summing all non-zero counts
- NO markdown, NO explanation, ONLY JSON`
          },
          {
            role: "user",
            content: `Parse this Spelling Bee hints table. Remember to skip the sum row (Σ) and sum columns:\n\n${text}`
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI processing failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    console.log("AI response:", content);

    // Extract JSON from the response (in case it's wrapped in markdown)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(jsonStr);

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error parsing hints:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to parse hints" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
