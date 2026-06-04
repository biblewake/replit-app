---
name: RevenueCat Replit Proxy Bridge
description: How to correctly bridge @replit/revenuecat-sdk through the Replit connectors proxy — two critical bugs and their fixes.
---

# RevenueCat Replit Proxy Bridge

## The two bugs

### Bug 1 — SDK passes a `Request` object as `input`, not a URL string
`@hey-api/client-fetch` (used by `@replit/revenuecat-sdk`) calls the custom `fetch` override with a `Request` object as the first argument rather than a plain URL string + init options.

If you naively read `init?.method`, it's `undefined` (the method is on the `Request` object), so every call defaults to GET.

**Fix:** Check `if (input instanceof Request)` and extract `.url`, `.method`, and `.text()` body from the `Request` directly.

### Bug 2 — SDK only parses 200 responses; RevenueCat API returns 201 for creates
The SDK was generated from an OpenAPI spec that maps 200 as the success status for mutations. When RevenueCat returns 201, `data` comes back as `undefined`.

**Fix:** In the custom `proxyFetch`, normalize all 2xx responses to status 200 before returning the `Response` object.

## Working implementation

See `scripts/src/revenueCatClient.ts` for the full bridge. Key pattern:

```ts
if (input instanceof Request) {
  url = input.url;
  method = init?.method ?? input.method ?? "GET";
  body = input.body ? await input.text() : undefined;
  for (const [k, v] of input.headers.entries()) headers[k] = v;
}
// normalize status
const status = raw.status >= 200 && raw.status < 300 ? 200 : raw.status;
return new Response(bodyText, { status, headers: { "content-type": "application/json" } });
```

**Why:** Without both fixes, every write API call silently GETs the list endpoint and returns undefined data.

**How to apply:** Any future usage of `@replit/revenuecat-sdk` through `ReplitConnectors.proxy()` must apply both fixes.
