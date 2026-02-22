import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createServiceClient, enforceRateLimit, getAuthContext } from "../_shared/edgeSecurity.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-key-hash, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface JoinApplicationRequest {
  name: string;
  email: string;
  role: string;
  message: string;
  portfolio?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createServiceClient();
    const auth = await getAuthContext(supabase, req);
    const clientRateOk = await enforceRateLimit(supabase, auth.scopeBase, "edge_join_application_client", 5, 600);
    if (!clientRateOk) {
      return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { name, email, role, message, portfolio }: JoinApplicationRequest = await req.json();

    // Validate required fields
    if (!name || !email || !role || !message) {
      throw new Error("Missing required fields");
    }
    if (name.length > 100 || email.length > 254 || role.length > 80 || message.length > 4000) {
      throw new Error("Input too long");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }
    const emailBucket = `email:${email.toLowerCase().trim()}`;
    const emailRateOk = await enforceRateLimit(supabase, emailBucket, "edge_join_application_email", 2, 3600);
    if (!emailRateOk) {
      return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Sanitize inputs for HTML
    const sanitize = (str: string) => str.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Kloak Applications <noreply@kloak.app>",
        to: ["jim@kloak.app"],
        reply_to: email,
        subject: `[Kloak Application] ${sanitize(role)} - ${sanitize(name)}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1a1a1a; border-bottom: 2px solid #6366f1; padding-bottom: 16px;">New Team Application</h1>
            
            <div style="margin: 24px 0;">
              <h2 style="color: #4b5563; font-size: 14px; text-transform: uppercase; margin-bottom: 8px;">Applicant Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; width: 120px;">Name:</td>
                  <td style="padding: 8px 0; color: #1a1a1a; font-weight: 500;">${sanitize(name)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Email:</td>
                  <td style="padding: 8px 0; color: #1a1a1a;"><a href="mailto:${sanitize(email)}" style="color: #6366f1;">${sanitize(email)}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Role:</td>
                  <td style="padding: 8px 0; color: #1a1a1a; font-weight: 500;">${sanitize(role)}</td>
                </tr>
                ${portfolio ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Portfolio:</td>
                  <td style="padding: 8px 0;"><a href="${sanitize(portfolio)}" style="color: #6366f1;">${sanitize(portfolio)}</a></td>
                </tr>
                ` : ""}
              </table>
            </div>
            
            <div style="margin: 24px 0;">
              <h2 style="color: #4b5563; font-size: 14px; text-transform: uppercase; margin-bottom: 8px;">Message</h2>
              <div style="background: #f9fafb; border-left: 3px solid #6366f1; padding: 16px; color: #374151; line-height: 1.6;">
                ${sanitize(message).replace(/\n/g, "<br>")}
              </div>
            </div>
            
            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
              This application was submitted through the Kloak website.
            </div>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errorData = await res.text();
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send email: ${res.status}`);
    }

    const data = await res.json();
    console.log("Join application email sent successfully:", data);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    console.error("Error in send-join-application function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
