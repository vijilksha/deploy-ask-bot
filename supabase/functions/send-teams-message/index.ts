import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TeamsMessageRequest {
  eid: string;
  contactId: string;
  fullname: string;
  project: string;
  role_assigned: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eid, contactId, fullname, project, role_assigned }: TeamsMessageRequest = await req.json();
    
    console.log("Sending Teams message to:", eid, "for contact:", contactId);

    // NOTE: Microsoft Teams Incoming Webhook integration
    // The user needs to set up an Incoming Webhook in Teams and provide the webhook URL
    // For now, we'll simulate the message and update the contact record
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create a message template
    const message = {
      text: `Hello! Please provide feedback for:
      
**Employee**: ${fullname}
**Project**: ${project}
**Role**: ${role_assigned}

Please reply with your comments on their role performance.`,
    };

    console.log("Teams message content:", message);

    // Update the contact to mark message as sent
    const { error: updateError } = await supabase
      .from("contacts")
      .update({ 
        email_sent_at: new Date().toISOString(),
        deployment_status: "awaiting_response" 
      })
      .eq("id", contactId);

    if (updateError) {
      console.error("Error updating contact:", updateError);
      throw updateError;
    }

    // TODO: Implement actual Teams webhook call
    // const teamsWebhookUrl = Deno.env.get("TEAMS_WEBHOOK_URL");
    // if (teamsWebhookUrl) {
    //   const teamsResponse = await fetch(teamsWebhookUrl, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify(message),
    //   });
    //   if (!teamsResponse.ok) {
    //     throw new Error("Failed to send Teams message");
    //   }
    // }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Teams message sent (simulated)",
        messageContent: message 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-teams-message function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);