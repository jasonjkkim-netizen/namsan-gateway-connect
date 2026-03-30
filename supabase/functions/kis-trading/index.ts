import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KIS_BASE = "https://openapi.koreainvestment.com:9443";

// In-memory token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const appKey = Deno.env.get("KIS_APP_KEY");
  const appSecret = Deno.env.get("KIS_APP_SECRET");
  if (!appKey || !appSecret) throw new Error("KIS API keys not configured");

  const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: appKey,
      appsecret: appSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  // Token valid for ~24h, cache for 23h
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  };
  return data.access_token;
}

function getAccountParts(): { cano: string; acntPrdtCd: string } {
  const acctNo = Deno.env.get("KIS_ACCOUNT_NO");
  if (!acctNo) throw new Error("KIS_ACCOUNT_NO not configured");
  // Account format: 12345678-01 or 1234567801
  const clean = acctNo.replace("-", "");
  return { cano: clean.slice(0, 8), acntPrdtCd: clean.slice(8, 10) || "01" };
}

async function kisRequest(
  path: string,
  trId: string,
  params: Record<string, string>,
  method: "GET" | "POST" = "GET"
) {
  const token = await getAccessToken();
  const appKey = Deno.env.get("KIS_APP_KEY")!;
  const appSecret = Deno.env.get("KIS_APP_SECRET")!;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: trId,
  };

  let url = `${KIS_BASE}${path}`;
  const options: RequestInit = { method, headers };

  if (method === "GET") {
    const qs = new URLSearchParams(params).toString();
    url = `${url}?${qs}`;
  } else {
    options.body = JSON.stringify(params);
  }

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`KIS API error [${res.status}]: ${JSON.stringify(data)}`);
  }

  return data;
}

// --- Handlers ---

async function getDomesticBalance() {
  const { cano, acntPrdtCd } = getAccountParts();
  return kisRequest("/uapi/domestic-stock/v1/trading/inquire-balance", "TTTC8434R", {
    CANO: cano,
    ACNT_PRDT_CD: acntPrdtCd,
    AFHR_FLPR_YN: "N",
    OFL_YN: "",
    INQR_DVSN: "02",
    UNPR_DVSN: "01",
    FUND_STTL_ICLD_YN: "N",
    FNCG_AMT_AUTO_RDPT_YN: "N",
    PRCS_DVSN: "01",
    CTX_AREA_FK100: "",
    CTX_AREA_NK100: "",
  });
}

async function getOverseasBalance() {
  const { cano, acntPrdtCd } = getAccountParts();
  return kisRequest(
    "/uapi/overseas-stock/v1/trading/inquire-present-balance",
    "CTRP6504R",
    {
      CANO: cano,
      ACNT_PRDT_CD: acntPrdtCd,
      WCRC_FRCR_DVSN_CD: "02",
      NATN_CD: "000",
      TR_MKET_CD: "00",
      INQR_DVSN_CD: "00",
    }
  );
}

async function getDomesticPrice(stockCode: string) {
  return kisRequest(
    "/uapi/domestic-stock/v1/quotations/inquire-price",
    "FHKST01010100",
    {
      FID_COND_MRKT_DIV_CODE: "J",
      FID_INPUT_ISCD: stockCode,
    }
  );
}

async function placeDomesticOrder(
  side: "buy" | "sell",
  stockCode: string,
  qty: string,
  price: string,
  orderType: string
) {
  const { cano, acntPrdtCd } = getAccountParts();
  const trId = side === "buy" ? "TTTC0802U" : "TTTC0801U";

  return kisRequest(
    "/uapi/domestic-stock/v1/trading/order-cash",
    trId,
    {
      CANO: cano,
      ACNT_PRDT_CD: acntPrdtCd,
      PDNO: stockCode,
      ORD_DVSN: orderType, // 00: 지정가, 01: 시장가
      ORD_QTY: qty,
      ORD_UNPR: price,
    },
    "POST"
  );
}

async function placeOverseasOrder(
  side: "buy" | "sell",
  exchangeCode: string,
  stockCode: string,
  qty: string,
  price: string,
  orderType: string
) {
  const { cano, acntPrdtCd } = getAccountParts();

  // TR IDs for overseas orders depend on exchange
  const trIdMap: Record<string, { buy: string; sell: string }> = {
    NASD: { buy: "TTTT1002U", sell: "TTTT1006U" },
    NYSE: { buy: "TTTT1002U", sell: "TTTT1006U" },
    AMEX: { buy: "TTTT1002U", sell: "TTTT1006U" },
    SEHK: { buy: "TTTS1002U", sell: "TTTS1001U" },
    TKSE: { buy: "TTTS0308U", sell: "TTTS0307U" },
  };

  const trIds = trIdMap[exchangeCode] || trIdMap["NASD"];
  const trId = side === "buy" ? trIds.buy : trIds.sell;

  return kisRequest(
    "/uapi/overseas-stock/v1/trading/order",
    trId,
    {
      CANO: cano,
      ACNT_PRDT_CD: acntPrdtCd,
      OVRS_EXCG_CD: exchangeCode,
      PDNO: stockCode,
      ORD_DVSN: orderType,
      ORD_QTY: qty,
      OVRS_ORD_UNPR: price,
      ORD_SVR_DVSN_CD: "0",
    },
    "POST"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check - admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    let result;
    switch (action) {
      case "domestic_balance":
        result = await getDomesticBalance();
        break;
      case "overseas_balance":
        result = await getOverseasBalance();
        break;
      case "domestic_price":
        if (!params.stockCode) throw new Error("stockCode required");
        result = await getDomesticPrice(params.stockCode);
        break;
      case "domestic_order":
        if (!params.side || !params.stockCode || !params.qty)
          throw new Error("side, stockCode, qty required");
        result = await placeDomesticOrder(
          params.side,
          params.stockCode,
          params.qty,
          params.price || "0",
          params.orderType || "01"
        );
        break;
      case "overseas_order":
        if (!params.side || !params.stockCode || !params.qty || !params.exchangeCode)
          throw new Error("side, stockCode, qty, exchangeCode required");
        result = await placeOverseasOrder(
          params.side,
          params.exchangeCode,
          params.stockCode,
          params.qty,
          params.price || "0",
          params.orderType || "00"
        );
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("KIS Trading error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
