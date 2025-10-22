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
    const { query } = await req.json();
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    console.log("Executing query on imported data:", query);

    // Parse the SQL query to extract table name
    const tableMatch = query.match(/FROM\s+(\w+)/i);
    if (!tableMatch) {
      throw new Error("Could not parse table name from query");
    }
    
    const tableName = tableMatch[1];

    // Get the table metadata
    const { data: tableData, error: tableError } = await supabase
      .from("imported_tables")
      .select("*")
      .eq("user_id", user.id)
      .eq("table_name", tableName)
      .single();

    if (tableError || !tableData) {
      throw new Error(`Table "${tableName}" not found. Please import it first in the Import tab.`);
    }

    // Get all data for this table
    const { data: rows, error: dataError } = await supabase
      .from("imported_data")
      .select("row_data")
      .eq("user_id", user.id)
      .eq("table_id", tableData.id);

    if (dataError) throw dataError;

    // Extract row_data from each row
    const results = rows.map(r => r.row_data);

    // Apply basic filtering based on query (simple WHERE clause support)
    let filteredResults = results;
    const whereMatch = query.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|$)/i);
    
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      // Simple equality filter: column = 'value' or column = value
      const conditionMatch = whereClause.match(/(\w+)\s*=\s*['"]?([^'";\s]+)['"]?/i);
      
      if (conditionMatch) {
        const [, column, value] = conditionMatch;
        filteredResults = results.filter(row => 
          String(row[column]) === value || row[column] === Number(value)
        );
      }
    }

    // Handle SELECT * or specific columns
    let finalResults = filteredResults;
    if (!query.includes("SELECT *")) {
      const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i);
      if (selectMatch) {
        const columns = selectMatch[1].split(',').map((c: string) => c.trim());
        finalResults = filteredResults.map(row => {
          const filtered: any = {};
          columns.forEach((col: string) => {
            if (row[col] !== undefined) {
              filtered[col] = row[col];
            }
          });
          return filtered;
        });
      }
    }

    console.log(`Query executed successfully, rows: ${finalResults.length}`);

    // Generate insights using AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let insights = null;

    if (LOVABLE_API_KEY && finalResults.length > 0) {
      try {
        const insightsPrompt = `Analyze this SQL query result and provide brief business insights:
        
Query: ${query}
Result: ${JSON.stringify(finalResults.slice(0, 10))} ${finalResults.length > 10 ? `... (${finalResults.length} total rows)` : ''}

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
        data: finalResults,
        rowCount: finalResults.length,
        status: "success",
        insights
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error in query-imported-data function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        status: "failed"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
