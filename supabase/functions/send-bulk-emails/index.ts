import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BulkEmailRequest {
  contactIds: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactIds }: BulkEmailRequest = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Fetch contacts
    const { data: contacts, error: fetchError } = await supabaseClient
      .from("contacts")
      .select("*")
      .in("id", contactIds);

    if (fetchError) throw fetchError;

    console.log(`Sending emails to ${contacts.length} contacts`);

    const emailPromises = contacts.map(async (contact) => {
      try {
        const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Deployment Status Update</h2>
            <p>Dear ${contact.fullname || contact.name},</p>
            <p>We would like to get an update on your deployment status.</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Your Details:</strong><br/>
              Employee ID: ${contact.empid || 'N/A'}<br/>
              Project: ${contact.project || 'N/A'}<br/>
              Role: ${contact.role_assigned || 'N/A'}<br/>
              EID: ${contact.eid || 'N/A'}
            </div>
            
            <p>Please reply to this email with your current deployment status and any updates.</p>
            
            <p>Best regards,<br/>Deployment Team</p>
          </div>
        `;

        const { data, error } = await resend.emails.send({
          from: "Deployment Team <onboarding@resend.dev>",
          to: [contact.email],
          subject: "Deployment Status Update Request",
          html: emailContent,
          replyTo: "deployment@company.com",
        });

        if (error) {
          console.error(`Failed to send email to ${contact.email}:`, error);
          return { success: false, contactId: contact.id, error: error.message };
        }

        // Update contact with email sent timestamp
        await supabaseClient
          .from("contacts")
          .update({
            email_sent_at: new Date().toISOString(),
            deployment_status: "email_sent",
          })
          .eq("id", contact.id);

        console.log(`Email sent successfully to ${contact.email}`);
        return { success: true, contactId: contact.id };
      } catch (error: any) {
        console.error(`Error processing ${contact.email}:`, error);
        return { success: false, contactId: contact.id, error: error.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        message: `Sent ${successCount} emails successfully, ${failCount} failed`,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-bulk-emails function:", error);
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
