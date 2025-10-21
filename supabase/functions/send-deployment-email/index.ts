import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  name: string;
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email }: EmailRequest = await req.json();

    console.log("Sending deployment reminder to:", email);

    const emailResponse = await resend.emails.send({
      from: "Deployment Tracker <onboarding@resend.dev>",
      to: [email],
      subject: "Deployment Status Follow-up",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Deployment Status Inquiry</h2>
          <p>Hi ${name},</p>
          <p>We noticed that your deployment status is currently pending. We wanted to reach out and check in with you.</p>
          <p><strong>Could you please let us know why your deployment hasn't been completed yet?</strong></p>
          <p>Your feedback is important to us and will help us better understand any blockers or challenges you might be facing.</p>
          <p>Please reply to this email with your update.</p>
          <br>
          <p>Best regards,<br>The Deployment Team</p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-deployment-email function:", error);
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
