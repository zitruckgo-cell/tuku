import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is authenticated and is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError(401, "Missing authorization header");
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return jsonError(401, "Unauthorized");

    const { data: profile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return jsonError(403, "Admin access required");
    }

    // Parse request body
    const body = await req.json();
    const {
      email,
      password,
      full_name,
      phone,
      role,
      account_type,
      business_name,
      vehicle_plate,
      vehicle_model,
      address_village,
      address_parish,
      address_subcounty,
      address_district,
      national_id_number,
      verification_status,
    } = body;

    if (!email || !password || !full_name || !phone || !role) {
      return jsonError(400, "Missing required fields: email, password, full_name, phone, role");
    }

    if (!["shipper", "driver", "dispatcher"].includes(role)) {
      return jsonError(400, "Invalid role. Must be shipper, driver, or dispatcher");
    }

    // Use service role client to create auth user
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      return jsonError(400, createErr.message);
    }

    const newUserId = authData.user.id;

    // Create the profile
    const { error: profileErr } = await adminClient.from("profiles").upsert({
      id: newUserId,
      full_name,
      phone,
      email,
      role,
      account_type: account_type || "individual",
      business_name: business_name || null,
      vehicle_plate: vehicle_plate || null,
      vehicle_model: vehicle_model || null,
      address_village: address_village || null,
      address_parish: address_parish || null,
      address_subcounty: address_subcounty || null,
      address_district: address_district || null,
      national_id_number: national_id_number || null,
      verification_status: verification_status || "approved",
    });

    if (profileErr) {
      // Try to clean up the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(newUserId);
      return jsonError(500, `Failed to create profile: ${profileErr.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, userId: newUserId, message: "User created successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return jsonError(500, e.message || "Internal server error");
  }
});

function jsonError(status: number, message: string) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
