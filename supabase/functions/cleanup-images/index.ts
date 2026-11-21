import { createClient } from "npm:@supabase/supabase-js@2";
// Deploy with --no-verify-jwt: user JWT or a dedicated scheduled-job secret is verified here.
Deno.serve(async (req: Request) => {
  const allowedOrigin = Deno.env.get("APP_ORIGIN") || "";
  const origin = req.headers.get("origin");
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    Vary: "Origin",
  };
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (origin && origin !== allowedOrigin)
    return respond({ error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, {
      status: 204,
      headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS" },
    });
  if (req.method !== "POST")
    return respond({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const authorization = req.headers.get("authorization") || "";
  const jobSecret = Deno.env.get("CLEANUP_JOB_SECRET");
  const provided = req.headers.get("x-cleanup-secret");
  let permitted = false;
  if (jobSecret && provided) {
    const hash = async (s: string) =>
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
      );
    const [a, b] = await Promise.all([hash(jobSecret), hash(provided)]);
    let difference = 0;
    for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
    permitted = difference === 0;
  }
  if (!permitted && authorization.startsWith("Bearer ")) {
    const jwt = authorization.slice(7);
    const { data, error } = await service.auth.getUser(jwt);
    if (!error && data.user) {
      const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false },
      });
      const { data: account, error: ae } = await client
        .from("user_accounts")
        .select("role")
        .eq("user_id", data.user.id)
        .single();
      const { data: active, error: ee } = await client.rpc("my_eligibility");
      permitted = !ae && !ee && account?.role === "ADMIN" && active === true;
    }
  }
  if (!permitted)
    return respond({ error: "Administrator access required" }, 403);
  try {
    const { data, error } = await service.rpc("cleanup_candidates");
    if (error) throw error;
    let removed = 0;
    for (const bucket of ["listing-images", "avatars"]) {
      const names = (data as { bucket_id: string; name: string }[])
        .filter((x) => x.bucket_id === bucket)
        .map((x) => x.name);
      if (names.length) {
        const { error } = await service.storage.from(bucket).remove(names);
        if (error) throw error;
        removed += names.length;
      }
    }
    return respond({ removed, hasMore: data.length === 500 });
  } catch {
    console.error("Image retention run failed");
    return respond(
      { error: "Image maintenance failed. Check server logs." },
      500,
    );
  }
});
