export default {
  async fetch(request, env) {
    const ua = (request.headers.get("user-agent") || "").toLowerCase();
    if ((ua.includes("curl") || ua.includes("wget") || ua.includes("httpie")) && new URL(request.url).pathname === "/") {
      const url = new URL(request.url);
      const q = url.searchParams.get("q") || url.searchParams.get("cron");
      if (q) {
        const parts = q.trim().split(/\s+/);
        if (parts.length >= 5) {
          let desc = "Runs: ";
          if (parts[0] === "*" && parts[1] === "*") desc += "every minute";
          else if (parts[0].startsWith("*/")) desc += `every ${parts[0].slice(2)} minutes`;
          else if (parts[1].startsWith("*/")) desc += `every ${parts[1].slice(2)} hours at minute ${parts[0]}`;
          else desc += `at minute ${parts[0]}, hour ${parts[1]}, day ${parts[2]}, month ${parts[3]}, weekday ${parts[4]}`;
          return new Response(`Expression: ${q}\nDescription: ${desc}\nZero Telemetry: Verified\n`, {
            headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
          });
        }
      }
      return new Response("Usage:\n  curl 'https://cronexplainer.othrys.be?q=*/15 * * * *'\n", {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
      });
    }
    return env.ASSETS.fetch(request);
  }
};