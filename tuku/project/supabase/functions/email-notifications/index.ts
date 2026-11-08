import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Tuku ZitruckGo <onboarding@resend.dev>";
const APP_URL = Deno.env.get("APP_URL") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface EmailRequest {
  type: "welcome" | "delivery_completed";
  userId?: string;
  email?: string;
  fullName?: string;
  loadTitle?: string;
  loadId?: string;
  recipientName?: string;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
    return { success: false, error: err };
  }
  return { success: true };
}

function baseStyles() {
  return `
    <body style="margin:0;padding:0;background:#030F0D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#14b8a6;font-size:24px;margin:0;letter-spacing:-0.5px;">tuku<span style="color:#5eead4;">.zitruckgo</span></h1>
          <p style="color:#64748b;font-size:13px;margin:4px 0 0;">Uganda's #1 Tuktuk Network</p>
        </div>
  `;
}

function footer() {
  return `
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid #1e293b;text-align:center;">
          <p style="color:#475569;font-size:12px;margin:0;">Tuku ZitruckGo · Kampala, Uganda</p>
          <p style="color:#334155;font-size:11px;margin:8px 0 0;">You received this email because you have an account with Tuku ZitruckGo.</p>
        </div>
      </div>
    </body>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: EmailRequest = await req.json();

    // Resolve user info from DB if userId provided and email missing
    let toEmail = body.email ?? "";
    let fullName = body.fullName ?? "";
    if (body.userId && (!toEmail || !fullName)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", body.userId)
        .maybeSingle();
      if (profile?.full_name) fullName = profile.full_name;

      const { data: authUser } = await supabase.auth.admin.getUserById(body.userId);
      if (authUser?.user?.email) toEmail = authUser.user.email;
    }

    if (!toEmail) {
      return new Response(JSON.stringify({ error: "No email address found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject = "";
    let html = "";

    if (body.type === "welcome") {
      subject = "Welcome to Tuku ZitruckGo!";
      html = baseStyles() + `
        <div style="background:#0a2420;border:1px solid #134e4a;border-radius:16px;padding:32px;">
          <h2 style="color:#f1f5f9;font-size:20px;margin:0 0 16px;">Hello${fullName ? `, ${fullName}` : ""}!</h2>
          <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Your Tuku ZitruckGo account has been created successfully. You can now start posting loads, bidding on deliveries, and tracking your hauls in real-time.
          </p>
          <div style="background:#04120f;border-radius:12px;padding:20px;margin:20px 0;">
            <p style="color:#5eead4;font-size:13px;margin:0 0 8px;font-weight:600;">What you can do now:</p>
            <ul style="color:#94a3b8;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
              <li>Post urgent deliveries across Uganda</li>
              <li>Browse and bid on available loads</li>
              <li>Track deliveries with live GPS</li>
              <li>Receive digital proof of delivery</li>
            </ul>
          </div>
          ${APP_URL ? `<a href="${APP_URL}" style="display:inline-block;background:#14b8a6;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:12px;margin-top:8px;">Go to Dashboard</a>` : ""}
        </div>
      ` + footer();
    } else if (body.type === "delivery_completed") {
      subject = `Delivery Completed: ${body.loadTitle ?? "Your Load"}`;
      html = baseStyles() + `
        <div style="background:#0a2420;border:1px solid #134e4a;border-radius:16px;padding:32px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="width:56px;height:56px;background:#16a34a;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">✓</div>
          </div>
          <h2 style="color:#f1f5f9;font-size:20px;margin:0 0 16px;text-align:center;">Delivery Completed!</h2>
          <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Hello${fullName ? `, ${fullName}` : ""},
          </p>
          <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Your delivery <strong style="color:#5eead4;">${body.loadTitle ?? "Load"}</strong> has been marked as delivered${body.recipientName ? ` and received by <strong style="color:#f1f5f9;">${body.recipientName}</strong>` : ""}.
          </p>
          <div style="background:#04120f;border-radius:12px;padding:20px;margin:20px 0;">
            <p style="color:#64748b;font-size:13px;margin:0 0 4px;">Load Reference</p>
            <p style="color:#5eead4;font-size:14px;font-family:monospace;margin:0;">#${body.loadId?.slice(0, 8).toUpperCase() ?? "N/A"}</p>
          </div>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:16px 0 0;">
            You can review the delivery details and proof of delivery in your dashboard.
          </p>
        </div>
      ` + footer();
    } else {
      return new Response(JSON.stringify({ error: "Unknown notification type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await sendEmail(toEmail, subject, html);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
