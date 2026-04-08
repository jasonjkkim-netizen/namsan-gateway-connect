import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-internal-secret",
};

const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// Notion Database IDs (data source IDs from the created databases)
const NOTION_DB = {
  products: "c4d49bd11991434dbef535c11d6d2a0c",
  members: "d905e2fe03904bebac6ff8b9071dff0e",
  commissionRates: "6dbd8b3359a24dde9610c19dc77c2001",
  investments: "930b6b89bd894297b792a2999cadff08",
  distributions: "daa96c7d3c9b4ef0b1883fc8da4c3d11",
};

interface SyncResult {
  table: string;
  created: number;
  updated: number;
  errors: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
    if (!NOTION_API_KEY) {
      return new Response(JSON.stringify({ error: "NOTION_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    const cronSecret = req.headers.get("x-cron-secret");
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let isAuthorized = false;
    if (cronSecret === expectedSecret || internalSecret === expectedSecret) {
      isAuthorized = true;
    } else if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token === expectedSecret) {
        isAuthorized = true;
      } else {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin");
          isAuthorized = roles && roles.length > 0;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const direction = body.direction || "db_to_notion"; // db_to_notion | notion_to_db | both
    const tables = body.tables || ["products", "members", "commissionRates", "investments", "distributions"];

    const notionHeaders = {
      "Authorization": `Bearer ${NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    };

    const results: SyncResult[] = [];

    // Helper: Query Notion database
    async function queryNotionDb(dbId: string): Promise<any[]> {
      const pages: any[] = [];
      let hasMore = true;
      let startCursor: string | undefined;

      while (hasMore) {
        const payload: any = { page_size: 100 };
        if (startCursor) payload.start_cursor = startCursor;

        const res = await fetch(`${NOTION_API_URL}/databases/${dbId}/query`, {
          method: "POST", headers: notionHeaders, body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(`Notion query failed: ${JSON.stringify(data)}`);
        pages.push(...data.results);
        hasMore = data.has_more;
        startCursor = data.next_cursor;
      }
      return pages;
    }

    // Helper: Get plain text from Notion rich text
    function getText(prop: any): string {
      if (!prop) return "";
      if (prop.type === "title") return prop.title?.map((t: any) => t.plain_text).join("") || "";
      if (prop.type === "rich_text") return prop.rich_text?.map((t: any) => t.plain_text).join("") || "";
      if (prop.type === "number") return prop.number?.toString() || "";
      if (prop.type === "select") return prop.select?.name || "";
      if (prop.type === "checkbox") return prop.checkbox ? "true" : "false";
      if (prop.type === "email") return prop.email || "";
      if (prop.type === "phone_number") return prop.phone_number || "";
      if (prop.type === "date") return prop.date?.start || "";
      return "";
    }

    function getNumber(prop: any): number | null {
      if (!prop || prop.type !== "number") return null;
      return prop.number;
    }

    function getCheckbox(prop: any): boolean {
      if (!prop || prop.type !== "checkbox") return false;
      return prop.checkbox;
    }

    // Helper: Create Notion rich text property
    function richText(text: string) {
      return { rich_text: [{ text: { content: text || "" } }] };
    }

    function titleProp(text: string) {
      return { title: [{ text: { content: text || "" } }] };
    }

    function numberProp(val: number | null) {
      return { number: val };
    }

    function selectProp(val: string | null) {
      if (!val) return { select: null };
      return { select: { name: val } };
    }

    function checkboxProp(val: boolean) {
      return { checkbox: val };
    }

    function dateProp(val: string | null) {
      if (!val) return { date: null };
      return { date: { start: val } };
    }

    function emailProp(val: string | null) {
      return { email: val || null };
    }

    function phoneProp(val: string | null) {
      return { phone_number: val || null };
    }

    // ========== SYNC PRODUCTS ==========
    if (tables.includes("products")) {
      const result: SyncResult = { table: "products", created: 0, updated: 0, errors: [] };
      try {
        if (direction === "db_to_notion" || direction === "both") {
          const { data: products } = await supabase.from("investment_products").select("*");
          const notionPages = await queryNotionDb(NOTION_DB.products);
          const notionBySupabaseId = new Map(
            notionPages.map(p => [getText(p.properties["Supabase ID"]), p.id])
          );

          for (const prod of products || []) {
            const props: any = {
              "Product Name (KO)": titleProp(prod.name_ko),
              "Product Name (EN)": richText(prod.name_en || ""),
              "Type": selectProp(prod.type),
              "Status": selectProp(prod.status),
              "Currency": selectProp(prod.currency),
              "Default Currency": selectProp(prod.default_currency),
              "Target Return (%)": numberProp(prod.target_return),
              "Minimum Investment": numberProp(prod.minimum_investment),
              "Management Fee (%)": numberProp(prod.management_fee_percent),
              "Performance Fee (%)": numberProp(prod.performance_fee_percent),
              "Upfront Commission (%)": numberProp(prod.upfront_commission_percent),
              "Fixed Return (%)": numberProp(prod.fixed_return_percent),
              "Target Return Rate (%)": numberProp(prod.target_return_percent),
              "Fundraising Amount": numberProp(prod.fundraising_amount),
              "Min Investment Amount": numberProp(prod.min_investment_amount),
              "Is Active": checkboxProp(prod.is_active !== false),
              "Description (KO)": richText(prod.description_ko || ""),
              "Description (EN)": richText(prod.description_en || ""),
              "Supabase ID": richText(prod.id),
            };

            const existingPageId = notionBySupabaseId.get(prod.id);
            if (existingPageId) {
              await fetch(`${NOTION_API_URL}/pages/${existingPageId}`, {
                method: "PATCH", headers: notionHeaders,
                body: JSON.stringify({ properties: props }),
              });
              result.updated++;
            } else {
              await fetch(`${NOTION_API_URL}/pages`, {
                method: "POST", headers: notionHeaders,
                body: JSON.stringify({ parent: { database_id: NOTION_DB.products }, properties: props }),
              });
              result.created++;
            }
          }
        }

        if (direction === "notion_to_db" || direction === "both") {
          const notionPages = await queryNotionDb(NOTION_DB.products);
          for (const page of notionPages) {
            const p = page.properties;
            const supabaseId = getText(p["Supabase ID"]);
            const productData = {
              name_ko: getText(p["Product Name (KO)"]),
              name_en: getText(p["Product Name (EN)"]) || getText(p["Product Name (KO)"]),
              type: getText(p["Type"]) || "other",
              status: getText(p["Status"]) || "open",
              currency: getText(p["Currency"]) || "KRW",
              default_currency: getText(p["Default Currency"]) || "USD",
              target_return: getNumber(p["Target Return (%)"]),
              minimum_investment: getNumber(p["Minimum Investment"]),
              management_fee_percent: getNumber(p["Management Fee (%)"]),
              performance_fee_percent: getNumber(p["Performance Fee (%)"]),
              upfront_commission_percent: getNumber(p["Upfront Commission (%)"]),
              fixed_return_percent: getNumber(p["Fixed Return (%)"]),
              target_return_percent: getNumber(p["Target Return Rate (%)"]),
              fundraising_amount: getNumber(p["Fundraising Amount"]),
              min_investment_amount: getNumber(p["Min Investment Amount"]),
              is_active: getCheckbox(p["Is Active"]),
              description_ko: getText(p["Description (KO)"]),
              description_en: getText(p["Description (EN)"]),
            };

            if (supabaseId) {
              const { error } = await supabase.from("investment_products").update(productData).eq("id", supabaseId);
              if (error) result.errors.push(`Update product ${supabaseId}: ${error.message}`);
              else result.updated++;
            } else {
              const { data: newProd, error } = await supabase.from("investment_products").insert(productData).select().single();
              if (error) result.errors.push(`Insert product: ${error.message}`);
              else {
                result.created++;
                // Update Notion page with Supabase ID
                await fetch(`${NOTION_API_URL}/pages/${page.id}`, {
                  method: "PATCH", headers: notionHeaders,
                  body: JSON.stringify({ properties: { "Supabase ID": richText(newProd.id) } }),
                });
              }
            }
          }
        }
      } catch (e) {
        result.errors.push(e.message);
      }
      results.push(result);
    }

    // ========== SYNC MEMBERS ==========
    if (tables.includes("members")) {
      const result: SyncResult = { table: "members", created: 0, updated: 0, errors: [] };
      try {
        if (direction === "db_to_notion" || direction === "both") {
          const { data: profiles } = await supabase.from("profiles").select("*").eq("is_deleted", false);
          const notionPages = await queryNotionDb(NOTION_DB.members);
          const notionByUserId = new Map(
            notionPages.map(p => [getText(p.properties["Supabase User ID"]), p.id])
          );

          // Build parent name map
          const parentMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

          for (const prof of profiles || []) {
            const props: any = {
              "Name": titleProp(prof.full_name),
              "Email": emailProp(prof.email),
              "Phone": phoneProp(prof.phone),
              "Sales Role": selectProp(prof.sales_role),
              "Sales Level": numberProp(prof.sales_level),
              "Is Approved": checkboxProp(prof.is_approved === true),
              "Is Admin": checkboxProp(prof.is_admin === true),
              "Address": richText(prof.address || ""),
              "Preferred Currency": selectProp(prof.preferred_currency || "USD"),
              "Parent Name": richText(prof.parent_id ? (parentMap.get(prof.parent_id) || "") : ""),
              "Supabase User ID": richText(prof.user_id),
            };
            if (prof.birthday) {
              props["Birthday"] = dateProp(prof.birthday);
            }

            const existingPageId = notionByUserId.get(prof.user_id);
            if (existingPageId) {
              await fetch(`${NOTION_API_URL}/pages/${existingPageId}`, {
                method: "PATCH", headers: notionHeaders,
                body: JSON.stringify({ properties: props }),
              });
              result.updated++;
            } else {
              await fetch(`${NOTION_API_URL}/pages`, {
                method: "POST", headers: notionHeaders,
                body: JSON.stringify({ parent: { database_id: NOTION_DB.members }, properties: props }),
              });
              result.created++;
            }
          }
        }

        if (direction === "notion_to_db" || direction === "both") {
          const notionPages = await queryNotionDb(NOTION_DB.members);
          for (const page of notionPages) {
            const p = page.properties;
            const userId = getText(p["Supabase User ID"]);
            if (!userId) continue; // Skip pages without a linked Supabase user

            const profileData: any = {
              full_name: getText(p["Name"]),
              phone: getText(p["Phone"]) || null,
              address: getText(p["Address"]) || null,
              preferred_currency: getText(p["Preferred Currency"]) || "USD",
            };
            const birthday = getText(p["Birthday"]);
            if (birthday) profileData.birthday = birthday;

            const { error } = await supabase.from("profiles").update(profileData).eq("user_id", userId);
            if (error) result.errors.push(`Update member ${userId}: ${error.message}`);
            else result.updated++;
          }
        }
      } catch (e) {
        result.errors.push(e.message);
      }
      results.push(result);
    }

    // ========== SYNC COMMISSION RATES ==========
    if (tables.includes("commissionRates")) {
      const result: SyncResult = { table: "commissionRates", created: 0, updated: 0, errors: [] };
      try {
        if (direction === "db_to_notion" || direction === "both") {
          const { data: rates } = await supabase.from("commission_rates").select("*, investment_products(name_ko)");
          const notionPages = await queryNotionDb(NOTION_DB.commissionRates);
          const notionBySupabaseId = new Map(
            notionPages.map(p => [getText(p.properties["Supabase ID"]), p.id])
          );

          for (const rate of rates || []) {
            const prodName = (rate as any).investment_products?.name_ko || "";
            const props: any = {
              "Label": titleProp(`${prodName} - ${rate.sales_role} - L${rate.sales_level}`),
              "Product Name": richText(prodName),
              "Sales Role": selectProp(rate.sales_role),
              "Sales Level": numberProp(rate.sales_level),
              "Upfront Rate (%)": numberProp(rate.upfront_rate),
              "Performance Rate (%)": numberProp(rate.performance_rate),
              "Min Rate": numberProp(rate.min_rate),
              "Max Rate": numberProp(rate.max_rate),
              "Is Override": checkboxProp(rate.is_override === true),
              "Supabase ID": richText(rate.id),
            };

            const existingPageId = notionBySupabaseId.get(rate.id);
            if (existingPageId) {
              await fetch(`${NOTION_API_URL}/pages/${existingPageId}`, {
                method: "PATCH", headers: notionHeaders,
                body: JSON.stringify({ properties: props }),
              });
              result.updated++;
            } else {
              await fetch(`${NOTION_API_URL}/pages`, {
                method: "POST", headers: notionHeaders,
                body: JSON.stringify({ parent: { database_id: NOTION_DB.commissionRates }, properties: props }),
              });
              result.created++;
            }
          }
        }
      } catch (e) {
        result.errors.push(e.message);
      }
      results.push(result);
    }

    // ========== SYNC INVESTMENTS ==========
    if (tables.includes("investments")) {
      const result: SyncResult = { table: "investments", created: 0, updated: 0, errors: [] };
      try {
        if (direction === "db_to_notion" || direction === "both") {
          const { data: investments } = await supabase.from("client_investments").select("*");
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
          const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

          const notionPages = await queryNotionDb(NOTION_DB.investments);
          const notionBySupabaseId = new Map(
            notionPages.map(p => [getText(p.properties["Supabase ID"]), p.id])
          );

          for (const inv of investments || []) {
            const clientName = nameMap.get(inv.user_id) || "Unknown";
            const props: any = {
              "Investment Label": titleProp(`${clientName} - ${inv.product_name_ko}`),
              "Client Name": richText(clientName),
              "Product Name (KO)": richText(inv.product_name_ko),
              "Product Name (EN)": richText(inv.product_name_en),
              "Investment Amount": numberProp(inv.investment_amount),
              "Current Value": numberProp(inv.current_value),
              "Currency": selectProp(inv.invested_currency || "USD"),
              "Status": selectProp(inv.status || "active"),
              "Expected Return (%)": numberProp(inv.expected_return),
              "Realized Return (%)": numberProp(inv.realized_return_percent),
              "Realized Return Amount": numberProp(inv.realized_return_amount),
              "Supabase ID": richText(inv.id),
            };
            if (inv.start_date) props["Start Date"] = dateProp(inv.start_date);
            if (inv.maturity_date) props["Maturity Date"] = dateProp(inv.maturity_date);

            const existingPageId = notionBySupabaseId.get(inv.id);
            if (existingPageId) {
              await fetch(`${NOTION_API_URL}/pages/${existingPageId}`, {
                method: "PATCH", headers: notionHeaders,
                body: JSON.stringify({ properties: props }),
              });
              result.updated++;
            } else {
              await fetch(`${NOTION_API_URL}/pages`, {
                method: "POST", headers: notionHeaders,
                body: JSON.stringify({ parent: { database_id: NOTION_DB.investments }, properties: props }),
              });
              result.created++;
            }
          }
        }
      } catch (e) {
        result.errors.push(e.message);
      }
      results.push(result);
    }

    // ========== SYNC DISTRIBUTIONS ==========
    if (tables.includes("distributions")) {
      const result: SyncResult = { table: "distributions", created: 0, updated: 0, errors: [] };
      try {
        if (direction === "db_to_notion" || direction === "both") {
          const { data: dists } = await supabase.from("commission_distributions").select("*");
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
          const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

          const notionPages = await queryNotionDb(NOTION_DB.distributions);
          const notionBySupabaseId = new Map(
            notionPages.map(p => [getText(p.properties["Supabase ID"]), p.id])
          );

          for (const dist of dists || []) {
            const recipient = nameMap.get(dist.to_user_id) || "Unknown";
            const props: any = {
              "Label": titleProp(`${recipient} - L${dist.layer}`),
              "Recipient": richText(recipient),
              "Layer": numberProp(dist.layer),
              "Upfront Amount": numberProp(dist.upfront_amount),
              "Performance Amount": numberProp(dist.performance_amount),
              "Rate Used (%)": numberProp(dist.rate_used),
              "Currency": selectProp(dist.currency || "USD"),
              "Status": selectProp(dist.status),
              "Supabase ID": richText(dist.id),
            };

            const existingPageId = notionBySupabaseId.get(dist.id);
            if (existingPageId) {
              await fetch(`${NOTION_API_URL}/pages/${existingPageId}`, {
                method: "PATCH", headers: notionHeaders,
                body: JSON.stringify({ properties: props }),
              });
              result.updated++;
            } else {
              await fetch(`${NOTION_API_URL}/pages`, {
                method: "POST", headers: notionHeaders,
                body: JSON.stringify({ parent: { database_id: NOTION_DB.distributions }, properties: props }),
              });
              result.created++;
            }
          }
        }
      } catch (e) {
        result.errors.push(e.message);
      }
      results.push(result);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Notion sync error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
