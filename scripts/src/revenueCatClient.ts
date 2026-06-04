import { ReplitConnectors } from "@replit/connectors-sdk";
import { createClient, createConfig } from "@replit/revenuecat-sdk/client";

export async function getUncachableRevenueCatClient() {
  const connectors = new ReplitConnectors();

  const proxyFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    // The SDK may pass a Request object as `input`. Extract everything from it.
    let url: string;
    let method: string;
    let body: string | undefined;
    const headers: Record<string, string> = {};

    if (input instanceof Request) {
      url = input.url;
      method = init?.method ?? input.method ?? "GET";
      // Read body from Request; note: can only be read once
      try {
        body = input.body ? await input.text() : undefined;
      } catch {
        body = undefined;
      }
      input.headers.forEach((v, k) => { headers[k] = v; });
    } else {
      url = typeof input === "string" ? input : input.href;
      method = init?.method ?? "GET";
      body = init?.body as string | undefined;
    }

    // Merge any explicit init headers on top
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => { headers[k] = v; });
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers as [string, string][]) headers[k] = v;
      } else {
        Object.assign(headers, init.headers as Record<string, string>);
      }
    }

    if (body && !headers["content-type"] && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const parsed = new URL(url);
    const pathAndQuery = parsed.pathname + parsed.search;

    const raw = await connectors.proxy("revenuecat", pathAndQuery, {
      method,
      headers,
      body,
    });

    const bodyText = await raw.text();

    // Normalize 2xx → 200 so the SDK always parses the response body.
    // The SDK (based on @hey-api/client-fetch) may only associate a response
    // schema with 200, discarding bodies from 201/204 etc.
    const status = raw.status >= 200 && raw.status < 300 ? 200 : raw.status;

    return new Response(bodyText, {
      status,
      statusText: raw.statusText,
      headers: { "content-type": "application/json" },
    });
  };

  const client = createClient(
    createConfig({
      baseUrl: "https://api.revenuecat.com/v2",
      fetch: proxyFetch,
    }),
  );

  return client;
}
