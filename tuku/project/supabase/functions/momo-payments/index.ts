import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MoMoConfig {
  apiUserId: string;
  apiKey: string;
  subscriptionKey: string;
  environment: string;
  baseUrl: string;
}

function getMoMoConfig(): MoMoConfig {
  const env = Deno.env.get("MOMO_ENVIRONMENT") ?? "sandbox";
  return {
    apiUserId: Deno.env.get("MOMO_API_USER_ID") ?? "",
    apiKey: Deno.env.get("MOMO_API_KEY") ?? "",
    subscriptionKey: Deno.env.get("MOMO_SUBSCRIPTION_KEY") ?? "",
    environment: env,
    baseUrl: env === "production"
      ? "https://momodeveloper.mtn.com"
      : "https://sandbox.momodeveloper.mtn.com",
  };
}

async function getMoMoAccessToken(config: MoMoConfig): Promise<string> {
  const credentials = btoa(`${config.apiUserId}:${config.apiKey}`);
  const url = `${config.baseUrl}/collection/token/`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MoMo token failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function requestPayment(
  config: MoMoConfig,
  token: string,
  amount: number,
  phone: string,
  externalId: string,
  payerMessage: string
): Promise<string> {
  const referenceId = crypto.randomUUID();
  const url = `${config.baseUrl}/collection/v1_0/requesttopay`;

  const body = {
    amount: String(amount),
    currency: "UGX",
    externalId,
    payer: phone,
    payerMessage,
    payeeNote: "Zitruckgo marketplace payment",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": config.environment,
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok && res.status !== 202) {
    const body2 = await res.text();
    throw new Error(`MoMo requesttopay failed (${res.status}): ${body2}`);
  }

  return referenceId;
}

async function checkPaymentStatus(
  config: MoMoConfig,
  token: string,
  referenceId: string
): Promise<{ status: string; financialTransactionId?: string }> {
  const url = `${config.baseUrl}/collection/v1_0/requesttopay/${referenceId}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "X-Target-Environment": config.environment,
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
    },
  });
  if (!res.ok) {
    return { status: "PENDING" };
  }
  const data = await res.json();
  return {
    status: data.status ?? "PENDING",
    financialTransactionId: data.financialTransactionId?.toString(),
  };
}

async function disburseToDriver(
  config: MoMoConfig,
  amount: number,
  phone: string,
  externalId: string,
  note: string
): Promise<string> {
  // Get disbursement token (separate from collection)
  const disbursementUserId = Deno.env.get("MOMO_DISBURSEMENT_API_USER_ID") ?? config.apiUserId;
  const disbursementApiKey = Deno.env.get("MOMO_DISBURSEMENT_API_KEY") ?? config.apiKey;
  const disbursementSubKey = Deno.env.get("MOMO_DISBURSEMENT_SUBSCRIPTION_KEY") ?? config.subscriptionKey;

  const credentials = btoa(`${disbursementUserId}:${disbursementApiKey}`);
  const tokenRes = await fetch(`${config.baseUrl}/disbursement/token/`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Ocp-Apim-Subscription-Key": disbursementSubKey,
    },
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`MoMo disbursement token failed (${tokenRes.status}): ${body}`);
  }
  const tokenData = await tokenRes.json();

  const referenceId = crypto.randomUUID();
  const body = {
    amount: String(amount),
    currency: "UGX",
    externalId,
    payee: phone,
    payerMessage: "Zitruckgo driver payout",
    payeeNote: note,
  };

  const res = await fetch(`${config.baseUrl}/disbursement/v1_0/transfer`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${tokenData.access_token}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": config.environment,
      "Ocp-Apim-Subscription-Key": disbursementSubKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok && res.status !== 202) {
    const body2 = await res.text();
    throw new Error(`MoMo disbursement failed (${res.status}): ${body2}`);
  }

  return referenceId;
}

async function sendEmailNotification(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.log("RESEND_API_KEY not configured, skipping email");
    return;
  }
  const fromEmail = Deno.env.get("FROM_EMAIL") ?? "noreply@zitruckgo.com";
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to,
        subject,
        html,
      }),
    });
  } catch (e) {
    console.error("Email send failed:", e.message);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const action = body.action;

    // ACTION 1: Request payment from shipper
    if (action === "request_payment") {
      const { loadId, shipperId, amount, phone } = body;
      if (!loadId || !shipperId || !amount || !phone) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const config = getMoMoConfig();
      const token = await getMoMoAccessToken(config);
      const referenceId = await requestPayment(
        config, token, amount, phone, loadId, "Zitruckgo load payment"
      );

      // Create transaction record
      const marketplaceFee = Math.round(amount * 0.10);
      const driverEarnings = amount - marketplaceFee;

      const { data: txn } = await supabase.from("transactions").insert({
        load_id: loadId,
        shipper_id: shipperId,
        amount_ugx: amount,
        marketplace_fee_ugx: marketplaceFee,
        driver_earnings_ugx: driverEarnings,
        type: "collection",
        status: "pending",
        momo_reference: referenceId,
      }).select().single();

      // Get shipper email
      const { data: shipper } = await supabase
        .from("profiles").select("email, full_name")
        .eq("id", shipperId).maybeSingle();

      if (shipper?.email) {
        await sendEmailNotification(
          shipper.email,
          "Payment Request - Zitruckgo",
          `<p>Hi ${shipper.full_name},</p><p>A mobile money payment request of UGX ${amount.toLocaleString()} has been sent to your phone ${phone}. Please approve the payment on your MTN MoMo account.</p><p>Load ID: ${loadId.slice(0, 8).toUpperCase()}</p>`
        );
      }

      return new Response(JSON.stringify({
        success: true,
        referenceId,
        transactionId: txn?.id,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ACTION 2: Check payment status
    if (action === "check_status") {
      const { transactionId } = body;
      if (!transactionId) {
        return new Response(JSON.stringify({ error: "Missing transactionId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: txn } = await supabase
        .from("transactions").select("*")
        .eq("id", transactionId).maybeSingle();

      if (!txn) {
        return new Response(JSON.stringify({ error: "Transaction not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const config = getMoMoConfig();
      const token = await getMoMoAccessToken(config);
      const statusResult = await checkPaymentStatus(config, token, txn.momo_reference);

      let newStatus = "pending";
      if (statusResult.status === "SUCCESSFUL") newStatus = "successful";
      else if (statusResult.status === "FAILED" || statusResult.status === "REJECTED") newStatus = "failed";

      if (newStatus !== txn.status) {
        await supabase.from("transactions").update({
          status: newStatus,
          momo_financial_id: statusResult.financialTransactionId ?? null,
          updated_at: new Date().toISOString(),
        }).eq("id", transactionId);

        if (newStatus === "successful") {
          // Mark the load as paid so drivers can see it
          await supabase.from("loads").update({ is_paid: true }).eq("id", txn.load_id);

          const { data: shipper } = await supabase
            .from("profiles").select("email, full_name")
            .eq("id", txn.shipper_id).maybeSingle();
          if (shipper?.email) {
            await sendEmailNotification(
              shipper.email,
              "Payment Confirmed - Zitruckgo",
              `<p>Hi ${shipper.full_name},</p>
               <p>Your payment of UGX ${txn.amount_ugx.toLocaleString()} has been confirmed. Your load is now visible to drivers.</p>
               <p><strong>Payment Breakdown:</strong></p>
               <ul>
                 <li>Total Paid: UGX ${txn.amount_ugx.toLocaleString()}</li>
                 <li>Platform Fee (10%): UGX ${txn.marketplace_fee_ugx.toLocaleString()}</li>
                 <li>Driver Earnings (90%): UGX ${txn.driver_earnings_ugx.toLocaleString()}</li>
               </ul>
               <p>The driver's 90% share is held securely and will be released automatically once delivery is confirmed.</p>`
            );
          }
        } else if (newStatus === "failed") {
          const { data: shipper } = await supabase
            .from("profiles").select("email, full_name")
            .eq("id", txn.shipper_id).maybeSingle();
          if (shipper?.email) {
            await sendEmailNotification(
              shipper.email,
              "Payment Failed - Zitruckgo",
              `<p>Hi ${shipper.full_name},</p><p>Your payment of UGX ${txn.amount_ugx.toLocaleString()} could not be processed. Please try again.</p>`
            );
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        status: newStatus,
        momoStatus: statusResult.status,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ACTION 3: Process payout to driver (auto on completion)
    if (action === "process_payout") {
      const { loadId } = body;
      if (!loadId) {
        return new Response(JSON.stringify({ error: "Missing loadId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get the collection transaction
      const { data: collectionTxn } = await supabase
        .from("transactions").select("*")
        .eq("load_id", loadId).eq("type", "collection")
        .eq("status", "successful").maybeSingle();

      if (!collectionTxn) {
        return new Response(JSON.stringify({ error: "No successful collection found for this load" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get load for driver info
      const { data: load } = await supabase
        .from("loads").select("awarded_rider_id, offer_price_ugx, title")
        .eq("id", loadId).maybeSingle();

      if (!load?.awarded_rider_id) {
        return new Response(JSON.stringify({ error: "No driver assigned" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get driver's MoMo phone
      const { data: driver } = await supabase
        .from("profiles").select("momo_phone, email, full_name, phone")
        .eq("id", load.awarded_rider_id).maybeSingle();

      if (!driver?.momo_phone) {
        // Create failed disbursement record
        await supabase.from("transactions").insert({
          load_id: loadId,
          shipper_id: collectionTxn.shipper_id,
          driver_id: load.awarded_rider_id,
          amount_ugx: collectionTxn.driver_earnings_ugx,
          marketplace_fee_ugx: collectionTxn.marketplace_fee_ugx,
          driver_earnings_ugx: collectionTxn.driver_earnings_ugx,
          type: "disbursement",
          status: "failed",
          failure_reason: "Driver has not set up MoMo payout phone number",
        });

        // Update earnings record
        await supabase.from("earnings").update({
          payout_status: "failed",
          failure_reason: "No MoMo phone number configured",
          updated_at: new Date().toISOString(),
        }).eq("load_id", loadId);

        if (driver?.email) {
          await sendEmailNotification(
            driver.email,
            "Payout Failed - MoMo Account Required",
            `<p>Hi ${driver.full_name},</p><p>A payout of UGX ${collectionTxn.driver_earnings_ugx.toLocaleString()} could not be processed because you have not set up your MTN MoMo payout phone number. Please add your MoMo number in your profile to receive payouts.</p>`
          );
        }

        return new Response(JSON.stringify({
          success: false,
          error: "Driver has not set up MoMo payout phone",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Disburse to driver
      const config = getMoMoConfig();
      let disbursementRef: string;
      try {
        disbursementRef = await disburseToDriver(
          config,
          collectionTxn.driver_earnings_ugx,
          driver.momo_phone,
          loadId,
          `Driver payout for load ${loadId.slice(0, 8)}`
        );
      } catch (e) {
        // Record failed disbursement
        await supabase.from("transactions").insert({
          load_id: loadId,
          shipper_id: collectionTxn.shipper_id,
          driver_id: load.awarded_rider_id,
          amount_ugx: collectionTxn.driver_earnings_ugx,
          marketplace_fee_ugx: collectionTxn.marketplace_fee_ugx,
          driver_earnings_ugx: collectionTxn.driver_earnings_ugx,
          type: "disbursement",
          status: "failed",
          failure_reason: e.message,
        });

        await supabase.from("earnings").update({
          payout_status: "failed",
          failure_reason: e.message,
          updated_at: new Date().toISOString(),
        }).eq("load_id", loadId);

        if (driver?.email) {
          await sendEmailNotification(
            driver.email,
            "Payout Failed - Zitruckgo",
            `<p>Hi ${driver.full_name},</p><p>A payout of UGX ${collectionTxn.driver_earnings_ugx.toLocaleString()} failed: ${e.message}. We will retry automatically.</p>`
          );
        }

        return new Response(JSON.stringify({
          success: false,
          error: e.message,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Record commission transaction
      await supabase.from("transactions").insert({
        load_id: loadId,
        shipper_id: collectionTxn.shipper_id,
        amount_ugx: collectionTxn.marketplace_fee_ugx,
        marketplace_fee_ugx: collectionTxn.marketplace_fee_ugx,
        driver_earnings_ugx: 0,
        type: "commission",
        status: "successful",
        momo_reference: disbursementRef,
      });

      // Record disbursement transaction
      const { data: disbursementTxn } = await supabase.from("transactions").insert({
        load_id: loadId,
        shipper_id: collectionTxn.shipper_id,
        driver_id: load.awarded_rider_id,
        amount_ugx: collectionTxn.driver_earnings_ugx,
        marketplace_fee_ugx: 0,
        driver_earnings_ugx: collectionTxn.driver_earnings_ugx,
        type: "disbursement",
        status: "successful",
        momo_reference: disbursementRef,
      }).select().single();

      // Update earnings record
      await supabase.from("earnings").update({
        payout_status: "paid",
        transaction_id: disbursementTxn?.id,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("load_id", loadId);

      // Fetch shipper profile for receipt email
      const { data: shipper } = await supabase
        .from("profiles").select("email, full_name")
        .eq("id", collectionTxn.shipper_id).maybeSingle();

      // Email driver about successful payout with receipt
      if (driver?.email) {
        await sendEmailNotification(
          driver.email,
          "Payout Received - Zitruckgo",
          `<p>Hi ${driver.full_name},</p>
           <p>A payout of UGX ${collectionTxn.driver_earnings_ugx.toLocaleString()} has been sent to your MTN MoMo account (${driver.momo_phone}).</p>
           <p><strong>Payment Receipt:</strong></p>
           <ul>
             <li>Load: ${load.title ?? loadId}</li>
             <li>Total Collected from Shipper: UGX ${collectionTxn.amount_ugx.toLocaleString()}</li>
             <li>Platform Fee (10%): UGX ${collectionTxn.marketplace_fee_ugx.toLocaleString()}</li>
             <li>Your Earnings (90%): UGX ${collectionTxn.driver_earnings_ugx.toLocaleString()}</li>
           </ul>
           <p>Please confirm receipt on your phone.</p>`
        );
      }

      // Email shipper with delivery receipt
      if (shipper?.email) {
        await sendEmailNotification(
          shipper.email,
          "Delivery Confirmed & Payment Released - Zitruckgo",
          `<p>Hi ${shipper.full_name},</p>
           <p>Your delivery <strong>${load.title ?? loadId}</strong> has been confirmed and payment has been released to the driver.</p>
           <p><strong>Payment Receipt:</strong></p>
           <ul>
             <li>Total Paid: UGX ${collectionTxn.amount_ugx.toLocaleString()}</li>
             <li>Platform Fee (10%): UGX ${collectionTxn.marketplace_fee_ugx.toLocaleString()}</li>
             <li>Driver Payout (90%): UGX ${collectionTxn.driver_earnings_ugx.toLocaleString()}</li>
           </ul>
           <p>Thank you for using Zitruckgo!</p>`
        );
      }

      return new Response(JSON.stringify({
        success: true,
        referenceId: disbursementRef,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ACTION 4: Process refund
    if (action === "refund") {
      const { loadId, reason } = body;
      if (!loadId) {
        return new Response(JSON.stringify({ error: "Missing loadId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: collectionTxn } = await supabase
        .from("transactions").select("*")
        .eq("load_id", loadId).eq("type", "collection")
        .eq("status", "successful").maybeSingle();

      if (!collectionTxn) {
        return new Response(JSON.stringify({ error: "No successful payment to refund" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Record refund transaction
      await supabase.from("transactions").insert({
        load_id: loadId,
        shipper_id: collectionTxn.shipper_id,
        amount_ugx: collectionTxn.amount_ugx,
        marketplace_fee_ugx: 0,
        driver_earnings_ugx: 0,
        type: "refund",
        status: "successful",
        failure_reason: reason ?? null,
      });

      // Mark original collection as refunded
      await supabase.from("transactions").update({
        status: "refunded",
        updated_at: new Date().toISOString(),
      }).eq("id", collectionTxn.id);

      // Update earnings
      await supabase.from("earnings").update({
        payout_status: "refunded",
        updated_at: new Date().toISOString(),
      }).eq("load_id", loadId);

      // Email shipper about refund
      const { data: shipper } = await supabase
        .from("profiles").select("email, full_name")
        .eq("id", collectionTxn.shipper_id).maybeSingle();
      if (shipper?.email) {
        await sendEmailNotification(
          shipper.email,
          "Refund Processed - Zitruckgo",
          `<p>Hi ${shipper.full_name},</p><p>A refund of UGX ${collectionTxn.amount_ugx.toLocaleString()} has been processed for your cancelled load. Reason: ${reason ?? "N/A"}</p>`
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});