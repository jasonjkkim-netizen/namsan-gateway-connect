import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-internal-secret",
};

const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// Notion Database IDs (data source IDs from the created databases)
const NOTION_DB: Record<string, string> = {
  products: "24eb76602e9283c4aa9e8107005c164b",
  members: "4abbf3b7f7744ce8bbc33f09ada96674",
  commissionRates: "7d1048cf97a3417bb725860fe0a2a66c",
  investments: "efad2fe4ddb145f19d7f412fd44fb71e",
  distributions: "3aeb0f55ad2b41af8e35e5b84f4fa0f5",
  research: "b41515ca52114096b3c185864ae084b7",
  blog: "9dbbdfe27f9c45efaeeaa8eee1d4d3f8",
  videos: "0711cff500e04626aaa386dba6fccf91",
  viewpoints: "543d3b5c429145adbe7edc9fb9239fbe",
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
    let triggeredByUserId: string | null = null;
    if (cronSecret === expectedSecret || internalSecret === expectedSecret) {
      isAuthorized = true;
    } else if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token === expectedSecret) {
        isAuthorized = true;
      } else {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          triggeredByUserId = user.id;
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
    const direction = body.direction || "db_to_notion";
    const tables = body.tables || Object.keys(NOTION_DB);
    const filters: Record<string, string[]> = body.filters || {};
    const syncStartTime = Date.now();

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
      if (prop.type === "url") return prop.url || "";
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

    function getUrl(prop: any): string | null {
      if (!prop || prop.type !== "url") return null;
      return prop.url;
    }

    // Helper: Create Notion property values
    function richText(text: string) {
      return { rich_text: [{ text: { content: (text || "").slice(0, 2000) } }] };
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

    function urlProp(val: string | null) {
      return { url: val || null };
    }

    // ========== SYNC PRODUCTS ==========
    if (tables.includes("products")) {
      const result: SyncResult = { table: "products", created: 0, updated: 0, errors: [] };
      try {
        if (direction === "db_to_notion" || direction === "both") {
          let prodQuery = supabase.from("investment_products").select("*");
          if (filters.products?.length) prodQuery = prodQuery.in("id", filters.products);
          const { data: products } = await prodQuery;
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
          const VALID_TYPES = ["bond", "equity", "fund", "real_estate", "alternative"];
          const VALID_STATUSES = ["draft", "pending", "open", "closed", "coming_soon", "archived"];
          const STATUS_MAP: Record<string, string> = { upcoming: "coming_soon" };

          const notionPages = await queryNotionDb(NOTION_DB.products);
          for (const page of notionPages) {
            const p = page.properties;
            const nameKo = getText(p["Product Name (KO)"]);
            if (!nameKo) continue;

            const supabaseId = getText(p["Supabase ID"]);
            const rawType = getText(p["Type"]).toLowerCase();
            const rawStatus = getText(p["Status"]).toLowerCase();
            const mappedStatus = STATUS_MAP[rawStatus] || rawStatus;

            if (!VALID_TYPES.includes(rawType)) {
              result.errors.push(`Skipped "${nameKo}": invalid type "${rawType}"`);
              continue;
            }

            const productData = {
              name_ko: nameKo,
              name_en: getText(p["Product Name (EN)"]) || nameKo,
              type: rawType,
              status: VALID_STATUSES.includes(mappedStatus) ? mappedStatus : "open",
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
          let profQuery = supabase.from("profiles").select("*").eq("is_deleted", false);
          if (filters.members?.length) profQuery = profQuery.in("user_id", filters.members);
          const { data: profiles } = await profQuery;
          const notionPages = await queryNotionDb(NOTION_DB.members);
          const notionByUserId = new Map(
            notionPages.map(p => [getText(p.properties["Supabase ID"]), p.id])
          );

          for (const prof of profiles || []) {
            const props: any = {
              "Name": titleProp(prof.full_name),
              "Name (KO)": richText(prof.full_name_ko || ""),
              "Email": emailProp(prof.email),
              "Phone": phoneProp(prof.phone),
              "Sales Role": selectProp(prof.sales_role),
              "Sales Level": numberProp(prof.sales_level),
              "Is Approved": checkboxProp(prof.is_approved === true),
              "Is Admin": checkboxProp(prof.is_admin === true),
              "Supabase ID": richText(prof.user_id),
            };

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
            const userId = getText(p["Supabase ID"]);
            if (!userId) continue;

            const profileData: any = {
              full_name: getText(p["Name"]),
              full_name_ko: getText(p["Name (KO)"]) || null,
              phone: getText(p["Phone"]) || null,
            };

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
          let ratesQuery = supabase.from("commission_rates").select("*, investment_products(name_ko)");
          if (filters.commissionRates?.length) ratesQuery = ratesQuery.in("id", filters.commissionRates);
          const { data: rates } = await ratesQuery;
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
              "Min Rate (%)": numberProp(rate.min_rate),
              "Max Rate (%)": numberProp(rate.max_rate),
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
          let invQuery = supabase.from("client_investments").select("*");
          if (filters.investments?.length) invQuery = invQuery.in("id", filters.investments);
          const { data: investments } = await invQuery;
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
          const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

          const notionPages = await queryNotionDb(NOTION_DB.investments);
          const notionBySupabaseId = new Map(
            notionPages.map(p => [getText(p.properties["Supabase ID"]), p.id])
          );

          for (const inv of investments || []) {
            const clientName = nameMap.get(inv.user_id) || "Unknown";
            const props: any = {
              "Client Name": titleProp(clientName),
              "Product Name": richText(inv.product_name_ko),
              "Investment Amount": numberProp(inv.investment_amount),
              "Current Value": numberProp(inv.current_value),
              "Currency": selectProp(inv.invested_currency || "USD"),
              "Status": selectProp(inv.status || "active"),
              "Supabase ID": richText(inv.id),
            };
            if (inv.start_date) props["Start Date"] = dateProp(inv.start_date);

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
          let distQuery = supabase.from("commission_distributions").select("*");
          if (filters.distributions?.length) distQuery = distQuery.in("id", filters.distributions);
          const { data: dists } = await distQuery;
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
          const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

          const notionPages = await queryNotionDb(NOTION_DB.distributions);
          const notionBySupabaseId = new Map(
            notionPages.map(p => [getText(p.properties["Supabase ID"]), p.id])
          );

          const investmentIds = [...new Set((dists || []).map(d => d.investment_id))];
          const { data: invData } = await supabase.from("client_investments").select("id, product_name_ko").in("id", investmentIds);
          const invNameMap = new Map((invData || []).map(i => [i.id, i.product_name_ko]));

          for (const dist of dists || []) {
            const recipient = nameMap.get(dist.to_user_id) || "Unknown";
            const investmentLabel = invNameMap.get(dist.investment_id) || "";
            const props: any = {
              "Label": titleProp(`${recipient} - L${dist.layer}`),
              "To Member": richText(recipient),
              "Investment": richText(investmentLabel),
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

    // ========== SYNC RESEARCH ==========
    if (tables.includes("research")) {
      const result: SyncResult = { table: "research", created: 0, updated: 0, errors: [] };
      try {
        if (direction === "db_to_notion" || direction === "both") {
          let query = supabase.from("research_reports").select("*");
          if (filters.research?.length) query = query.in("id", filters.research);
          const { data: reports } = await query;
          const notionPages = await queryNotionDb(NOTION_DB.research);
          const notionBySupabaseId = new Map(
            notionPages.map(p => [getText(p.properties["Supabase ID"]), p.id])
          );

          for (const r of reports || []) {
            const props: any = {
              "Title (KO)": titleProp(r.title_ko),
              "Title (EN)": richText(r.title_en || ""),
              "Category": selectProp(r.category),
              "Publication Date": dateProp(r.publication_date),
              "Summary (KO)": richText(r.summary_ko || ""),
              "Summary (EN)": richText(r.summary_en || ""),
              "PDF URL": urlProp(r.pdf_url),
              "External URL": urlProp(r.external_url),
              "Admin Note": richText(r.admin_note || ""),
              "Is Active": checkboxProp(r.is_active !== false),
              "Supabase ID": richText(r.id),
            };

            const existingPageId = notionBySupabaseId.get(r.id);
            if (existingPageId) {
              await fetch(`${NOTION_API_URL}/pages/${existingPageId}`, {
                method: "PATCH", headers: notionHeaders,
                body: JSON.stringify({ properties: props }),
              });
              result.updated++;
            } else {
              await fetch(`${NOTION_API_URL}/pages`, {
                method: "POST", headers: notionHeaders,
                body: JSON.stringify({ parent: { database_id: NOTION_DB.research }, properties: props }),
              });
              result.created++;
            }
          }
        }

        if (direction === "notion_to_db" || direction === "both") {
          const VALID_CATEGORIES = ["macro", "equity", "fixed_income", "alternative", "industry", "strategy", "other"];
          const notionPages = await queryNotionDb(NOTION_DB.research);
          for (const page of notionPages) {
            const p = page.properties;
            const titleKo = getText(p["Title (KO)"]);
            if (!titleKo) continue;

            const supabaseId = getText(p["Supabase ID"]);
            const rawCategory = getText(p["Category"]).toLowerCase();

            const reportData: any = {
              title_ko: titleKo,
              title_en: getText(p["Title (EN)"]) || titleKo,
              category: VALID_CATEGORIES.includes(rawCategory) ? rawCategory : "other",
              publication_date: getText(p["Publication Date"]) || new Date().toISOString().split("T")[0],
              summary_ko: getText(p["Summary (KO)"]) || null,
              summary_en: getText(p["Summary (EN)"]) || null,
              pdf_url: getUrl(p["PDF URL"]),
              external_url: getUrl(p["External URL"]),
              admin_note: getText(p["Admin Note"]) || null,
              is_active: getCheckbox(p["Is Active"]),
            };

            if (supabaseId) {
              const { error } = await supabase.from("research_reports").update(reportData).eq("id", supabaseId);
              if (error) result.errors.push(`Update research ${supabaseId}: ${error.message}`);
              else result.updated++;
            } else {
              const { data: newReport, error } = await supabase.from("research_reports").insert(reportData).select().single();
              if (error) result.errors.push(`Insert research: ${error.message}`);
              else {
                result.created++;
                await fetch(`${NOTION_API_URL}/pages/${page.id}`, {
                  method: "PATCH", headers: notionHeaders,
                  body: JSON.stringify({ properties: { "Supabase ID": richText(newReport.id) } }),
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

    // ========== SYNC BLOG ==========
    if (tables.includes("blog")) {
      const result: SyncResult = { table: "blog", created: 0, updated: 0, errors: [] };
      try {
        if (direction === "db_to_notion" || direction === "both") {
          let query = supabase.from("blog_posts").select("*");
          if (filters.blog?.length) query = query.in("id", filters.blog);
          const { data: posts } = await query;
          const notionPages = await queryNotionDb(NOTION_DB.blog);
          const notionBySupabaseId = new Map(
            notionPages.map(p => [getText(p.properties["Supabase ID"]), p.id])
          );

          for (const post of posts || []) {
            const props: any = {
              "Title (KO)": titleProp(post.title_ko),
              "Title (EN)": richText(post.title_en || ""),
              "Author": richText(post.author || ""),
              "Published At": dateProp(post.published_at ? post.published_at.split("T")[0] : null),
              "Summary (KO)": richText(post.summary_ko || ""),
              "Summary (EN)": richText(post.summary_en || ""),
              "Thumbnail URL": urlProp(post.thumbnail_url),
              "Content (KO)": richText(post.content_ko || ""),
              "Content (EN)": richText(post.content_en || ""),
              "Is Active": checkboxProp(post.is_active !== false),
              "Supabase ID": richText(post.id),
            };

            const existingPageId = notionBySupabaseId.get(post.id);
            if (existingPageId) {
              await fetch(`${NOTION_API_URL}/pages/${existingPageId}`, {
                method: "PATCH", headers: notionHeaders,
                body: JSON.stringify({ properties: props }),
              });
              result.updated++;
            } else {
              await fetch(`${NOTION_API_URL}/pages`, {
                method: "POST", headers: notionHeaders,
                body: JSON.stringify({ parent: { database_id: NOTION_DB.blog }, properties: props }),
              });
              result.created++;
            }
          }
        }

        if (direction === "notion_to_db" || direction === "both") {
          const notionPages = await queryNotionDb(NOTION_DB.blog);
          for (const page of notionPages) {
            const p = page.properties;
            const titleKo = getText(p["Title (KO)"]);
            if (!titleKo) continue;

            const supabaseId = getText(p["Supabase ID"]);
            const postData: any = {
              title_ko: titleKo,
              title_en: getText(p["Title (EN)"]) || titleKo,
              author: getText(p["Author"]) || "Namsan Partners",
              summary_ko: getText(p["Summary (KO)"]) || null,
              summary_en: getText(p["Summary (EN)"]) || null,
              thumbnail_url: getUrl(p["Thumbnail URL"]),
              content_ko: getText(p["Content (KO)"]),
              content_en: getText(p["Content (EN)"]),
              is_active: getCheckbox(p["Is Active"]),
            };

            const pubDate = getText(p["Published At"]);
            if (pubDate) postData.published_at = pubDate;

            if (supabaseId) {
              const { error } = await supabase.from("blog_posts").update(postData).eq("id", supabaseId);
              if (error) result.errors.push(`Update blog ${supabaseId}: ${error.message}`);
              else result.updated++;
            } else {
              const { data: newPost, error } = await supabase.from("blog_posts").insert(postData).select().single();
              if (error) result.errors.push(`Insert blog: ${error.message}`);
              else {
                result.created++;
                await fetch(`${NOTION_API_URL}/pages/${page.id}`, {
                  method: "PATCH", headers: notionHeaders,
                  body: JSON.stringify({ properties: { "Supabase ID": richText(newPost.id) } }),
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

    // ========== SYNC VIDEOS ==========
    if (tables.includes("videos")) {
      const result: SyncResult = { table: "videos", created: 0, updated: 0, errors: [] };
      try {
        if (direction === "db_to_notion" || direction === "both") {
          let query = supabase.from("videos").select("*");
          if (filters.videos?.length) query = query.in("id", filters.videos);
          const { data: videos } = await query;
          const notionPages = await queryNotionDb(NOTION_DB.videos);
          const notionBySupabaseId = new Map(
            notionPages.map(p => [getText(p.properties["Supabase ID"]), p.id])
          );

          for (const vid of videos || []) {
            const props: any = {
              "Title (KO)": titleProp(vid.title_ko),
              "Title (EN)": richText(vid.title_en || ""),
              "Category": selectProp(vid.category),
              "YouTube URL": urlProp(vid.youtube_url),
              "Description (KO)": richText(vid.description_ko || ""),
              "Description (EN)": richText(vid.description_en || ""),
              "Thumbnail URL": urlProp(vid.thumbnail_url),
              "Is Active": checkboxProp(vid.is_active !== false),
              "Supabase ID": richText(vid.id),
            };

            const existingPageId = notionBySupabaseId.get(vid.id);
            if (existingPageId) {
              await fetch(`${NOTION_API_URL}/pages/${existingPageId}`, {
                method: "PATCH", headers: notionHeaders,
                body: JSON.stringify({ properties: props }),
              });
              result.updated++;
            } else {
              await fetch(`${NOTION_API_URL}/pages`, {
                method: "POST", headers: notionHeaders,
                body: JSON.stringify({ parent: { database_id: NOTION_DB.videos }, properties: props }),
              });
              result.created++;
            }
          }
        }

        if (direction === "notion_to_db" || direction === "both") {
          const notionPages = await queryNotionDb(NOTION_DB.videos);
          for (const page of notionPages) {
            const p = page.properties;
            const titleKo = getText(p["Title (KO)"]);
            if (!titleKo) continue;

            const supabaseId = getText(p["Supabase ID"]);
            const youtubeUrl = getUrl(p["YouTube URL"]);
            if (!youtubeUrl && !supabaseId) {
              result.errors.push(`Skipped "${titleKo}": no YouTube URL`);
              continue;
            }

            const videoData: any = {
              title_ko: titleKo,
              title_en: getText(p["Title (EN)"]) || titleKo,
              category: getText(p["Category"]) || "other",
              youtube_url: youtubeUrl || "",
              description_ko: getText(p["Description (KO)"]) || null,
              description_en: getText(p["Description (EN)"]) || null,
              thumbnail_url: getUrl(p["Thumbnail URL"]),
              is_active: getCheckbox(p["Is Active"]),
            };

            if (supabaseId) {
              const { error } = await supabase.from("videos").update(videoData).eq("id", supabaseId);
              if (error) result.errors.push(`Update video ${supabaseId}: ${error.message}`);
              else result.updated++;
            } else {
              const { data: newVid, error } = await supabase.from("videos").insert(videoData).select().single();
              if (error) result.errors.push(`Insert video: ${error.message}`);
              else {
                result.created++;
                await fetch(`${NOTION_API_URL}/pages/${page.id}`, {
                  method: "PATCH", headers: notionHeaders,
                  body: JSON.stringify({ properties: { "Supabase ID": richText(newVid.id) } }),
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

    // ========== SYNC VIEWPOINTS ==========
    if (tables.includes("viewpoints")) {
      const result: SyncResult = { table: "viewpoints", created: 0, updated: 0, errors: [] };
      try {
        if (direction === "db_to_notion" || direction === "both") {
          let query = supabase.from("namsan_viewpoints").select("*");
          if (filters.viewpoints?.length) query = query.in("id", filters.viewpoints);
          const { data: viewpoints } = await query;
          const notionPages = await queryNotionDb(NOTION_DB.viewpoints);
          const notionBySupabaseId = new Map(
            notionPages.map(p => [getText(p.properties["Supabase ID"]), p.id])
          );

          for (const vp of viewpoints || []) {
            const props: any = {
              "Title (KO)": titleProp(vp.title_ko),
              "Title (EN)": richText(vp.title_en || ""),
              "Content (KO)": richText(vp.content_ko || ""),
              "Content (EN)": richText(vp.content_en || ""),
              "Image URL": urlProp(vp.image_url),
              "Display Order": numberProp(vp.display_order),
              "Is Active": checkboxProp(vp.is_active !== false),
              "Supabase ID": richText(vp.id),
            };

            const existingPageId = notionBySupabaseId.get(vp.id);
            if (existingPageId) {
              await fetch(`${NOTION_API_URL}/pages/${existingPageId}`, {
                method: "PATCH", headers: notionHeaders,
                body: JSON.stringify({ properties: props }),
              });
              result.updated++;
            } else {
              await fetch(`${NOTION_API_URL}/pages`, {
                method: "POST", headers: notionHeaders,
                body: JSON.stringify({ parent: { database_id: NOTION_DB.viewpoints }, properties: props }),
              });
              result.created++;
            }
          }
        }

        if (direction === "notion_to_db" || direction === "both") {
          const notionPages = await queryNotionDb(NOTION_DB.viewpoints);
          for (const page of notionPages) {
            const p = page.properties;
            const titleKo = getText(p["Title (KO)"]);
            if (!titleKo) continue;

            const supabaseId = getText(p["Supabase ID"]);
            const vpData: any = {
              title_ko: titleKo,
              title_en: getText(p["Title (EN)"]) || titleKo,
              content_ko: getText(p["Content (KO)"]),
              content_en: getText(p["Content (EN)"]),
              image_url: getUrl(p["Image URL"]),
              display_order: getNumber(p["Display Order"]) || 0,
              is_active: getCheckbox(p["Is Active"]),
            };

            if (supabaseId) {
              const { error } = await supabase.from("namsan_viewpoints").update(vpData).eq("id", supabaseId);
              if (error) result.errors.push(`Update viewpoint ${supabaseId}: ${error.message}`);
              else result.updated++;
            } else {
              const { data: newVp, error } = await supabase.from("namsan_viewpoints").insert(vpData).select().single();
              if (error) result.errors.push(`Insert viewpoint: ${error.message}`);
              else {
                result.created++;
                await fetch(`${NOTION_API_URL}/pages/${page.id}`, {
                  method: "PATCH", headers: notionHeaders,
                  body: JSON.stringify({ properties: { "Supabase ID": richText(newVp.id) } }),
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

    // Log sync results to DB
    const totalCreated = results.reduce((s, r) => s + r.created, 0);
    const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
    const errorCount = results.reduce((s, r) => s + r.errors.length, 0);
    const durationMs = Date.now() - syncStartTime;

    await supabase.from("notion_sync_log").insert({
      direction,
      tables,
      results: JSON.parse(JSON.stringify(results)),
      total_created: totalCreated,
      total_updated: totalUpdated,
      error_count: errorCount,
      duration_ms: durationMs,
      triggered_by: triggeredByUserId,
    });

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
