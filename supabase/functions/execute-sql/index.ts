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
    const { query, schemaId, conversationId } = await req.json();
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user authentication
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    console.log("Executing query:", query);

    // Execute the query (read-only for safety)
    // Note: This is a simplified version. In production, you'd connect to the user's actual database
    const { data, error } = await supabase.rpc('execute_readonly_query', {
      query_text: query
    });

    if (error) {
      console.error("Query execution error:", error);
      
      // Save failed execution to history
      await supabase.from("query_history").insert({
        user_id: user.id,
        natural_language_query: "",
        generated_sql: query,
        execution_status: "failed",
        execution_result: { error: error.message },
        conversation_id: conversationId,
      });

      return new Response(
        JSON.stringify({ 
          error: error.message,
          status: "failed"
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Save successful execution
    const { data: historyRecord } = await supabase.from("query_history").insert({
      user_id: user.id,
      natural_language_query: "",
      generated_sql: query,
      execution_status: "success",
      execution_result: { data, rowCount: data?.length || 0 },
      conversation_id: conversationId,
    }).select().single();

    // Generate insights using AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let insights = null;

    if (LOVABLE_API_KEY && data && data.length > 0) {
      try {
        const insightsPrompt = `Analyze this SQL query result and provide brief business insights:
        
Query: ${query}
Result: ${JSON.stringify(data.slice(0, 10))} ${data.length > 10 ? `... (${data.length} total rows)` : ''}

Provide 2-3 key insights in plain English.`;

        const insightsResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a data analyst providing concise insights." },
              { role: "user", content: insightsPrompt }
            ],
          }),
        });

        if (insightsResponse.ok) {
          const insightsData = await insightsResponse.json();
          insights = insightsData.choices[0].message.content;
        }
      } catch (e) {
        console.error("Failed to generate insights:", e);
      }
    }

    return new Response(
      JSON.stringify({ 
        data,
        rowCount: data?.length || 0,
        status: "success",
        insights,
        historyId: historyRecord?.id
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error in execute-sql function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
