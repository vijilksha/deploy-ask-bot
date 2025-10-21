import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, schemaDefinition, mode, includeRAG = false } = await req.json();
    
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    let ragContext = "";
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("AI API key is not configured");
    }

    // Build system prompt based on mode
    let systemPrompt = "";
    
    if (mode === "generate") {
      systemPrompt = `You are an expert SQL assistant. Generate SQL queries based on natural language requests.

Database Schema:
${JSON.stringify(schemaDefinition, null, 2)}

Rules:
- Generate syntactically correct SQL
- Use the exact table and column names from the schema
- Include comments explaining complex parts
- Consider performance optimization
- Return ONLY the SQL query, no explanations unless asked
- If the request is unclear, ask clarifying questions`;
    } else if (mode === "explain") {
      systemPrompt = `You are an expert SQL teacher. Explain SQL queries in clear, simple terms.

Break down:
- What the query does
- Each clause's purpose
- Any joins or subqueries
- Performance considerations
- Potential improvements`;
    } else if (mode === "optimize") {
      systemPrompt = `You are a database optimization expert.

Analyze the SQL query and provide:
- Performance issues
- Index suggestions
- Query rewrite recommendations
- Execution plan insights
- Best practices violations`;
    } else {
      systemPrompt = `You are a helpful SQL assistant. Help users understand and work with their database.

Database Schema:
${JSON.stringify(schemaDefinition, null, 2)}

You can:
- Generate SQL queries from natural language
- Explain existing queries
- Suggest optimizations
- Diagnose errors
- Provide data insights`;
    }

    // RAG: Fetch similar queries and documentation
    if (includeRAG && authHeader && supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          const lastUserMessage = messages[messages.length - 1]?.content || "";
          
          // Find similar past queries
          const { data: similarQueries } = await supabase.functions.invoke("find-similar", {
            body: { query: lastUserMessage, type: "query", matchCount: 3 },
          });
          
          // Find relevant documentation
          const { data: similarDocs } = await supabase.functions.invoke("find-similar", {
            body: { query: lastUserMessage, type: "documentation", matchCount: 2 },
          });
          
          if (similarQueries?.results?.length > 0) {
            ragContext += "\n\nSimilar past queries:\n";
            similarQueries.results.forEach((q: any) => {
              ragContext += `- ${q.query_text} (used ${q.usage_count} times)\n`;
            });
          }
          
          if (similarDocs?.results?.length > 0) {
            ragContext += "\n\nRelevant documentation:\n";
            similarDocs.results.forEach((d: any) => {
              ragContext += `- ${d.title}: ${d.content.substring(0, 200)}...\n`;
            });
          }
        }
      } catch (e) {
        console.error("RAG fetch error:", e);
      }
    }

    console.log("Calling AI with mode:", mode, "RAG enabled:", includeRAG);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt + ragContext },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Error in sql-ai-chat function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
