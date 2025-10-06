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
            content: `You are a parser for NYT Spelling Bee hints. The hints are formatted as a TABLE:

STRUCTURE:
- First row: column headers are WORD LENGTHS (e.g., 4, 5, 6, 7, 8...)
- Each subsequent row: starts with a LETTER, followed by COUNTS for each word length
- The letter is the starting letter of words
- Each number in the row shows how many words start with that letter and have that length

EXAMPLE TABLE:
    4  5  6  7  8
A   2  4  1  1  -
B   5  3  1  4  3

This means:
- 2 words start with A and are 4 letters long
- 4 words start with A and are 5 letters long
- 5 words start with B and are 4 letters long
- etc.

Return ONLY a valid JSON object:
{
  "allowedLetters": ["A", "B", "C"],
  "pangrams": 2,
  "totalWords": 50,
  "hintsGrid": {
    "A": { "4": 2, "5": 4, "6": 1, "7": 1 },
    "B": { "4": 5, "5": 3, "6": 1, "7": 4, "8": 3 }
  },
  "twoLetterList": [
    { "combo": "AB", "count": 5 },
    { "combo": "AC", "count": 3 }
  ]
}

IMPORTANT:
- Parse the table structure: first row = lengths, subsequent rows = letter + counts
- Map each count to its corresponding length from the header row
- Skip any dashes or zeros (no words at that length)
- Calculate totalWords by summing all counts
- Return ONLY valid JSON, no markdown, no explanation`
          },
          {
            role: "user",
            content: `Parse this Spelling Bee hints table and extract the data:\n\n${text}`
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
