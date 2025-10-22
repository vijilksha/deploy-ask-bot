import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as postgres from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, dbConnection } = await req.json();
    
    if (!dbConnection) {
      throw new Error("Database connection details required");
    }

    console.log("Connecting to database:", dbConnection.database);
    console.log("Executing query:", query);

    // Connect to PostgreSQL
    const pool = new postgres.Pool({
      hostname: dbConnection.host,
      port: dbConnection.port,
      database: dbConnection.database,
      user: dbConnection.username,
      password: dbConnection.password,
    }, 3);

    const connection = await pool.connect();

    try {
      // Execute the query
      const result = await connection.queryObject(query);
      
      console.log("Query executed successfully, rows:", result.rows.length);

      // Generate insights using AI
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      let insights = null;

      if (LOVABLE_API_KEY && result.rows && result.rows.length > 0) {
        try {
          const insightsPrompt = `Analyze this SQL query result and provide brief business insights:
          
Query: ${query}
Result: ${JSON.stringify(result.rows.slice(0, 10))} ${result.rows.length > 10 ? `... (${result.rows.length} total rows)` : ''}

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
          data: result.rows,
          rowCount: result.rows.length,
          status: "success",
          insights
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    } finally {
      connection.release();
      await pool.end();
    }
  } catch (error) {
    console.error("Error in execute-sql function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        status: "failed"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
