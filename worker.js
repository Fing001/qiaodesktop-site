// Cloudflare Worker — GET /api/version
// ════════════════════════════════════════════════════════════════════
// 用途：桌面程序「检查更新」的唯一端点。
//   请求：GET /api/version?v=<版本号>&ch=<official|store>
//   响应：{ latest, url, notes }（200）
//
// 🔴 隐私边界（与隐私政策 /zh/privacy 的 §2.1 一一对应，改这里必须同步改政策）：
//   • 只做计数：按 (日期, 版本, 渠道) 累加一行，看不到任何具体用户；
//   • **不读也不存** IP、User-Agent、Referer、Cookie 等任何请求头；
//   • 不写日志、不做指纹、不下发追踪标识（wrangler.json 里 observability 也显式关掉）；
//   • 计数失败不影响版本返回（catch 吞掉）。
//   因此数据口径 = "某天某个版本被查过几次"，不是 DAU/UV，也不是"人数"。
//
// 🔴 部署形态（2026-10-22 起）：本项目在 Cloudflare 上是 **Worker + 静态资产**，
//   不是 Pages —— 所以没有 functions/ 目录文件路由，本文件就是接口的唯一实现。
//   路由规则见 wrangler.json 的 assets.run_worker_first：只有 /api/* 会进本 Worker，
//   其余路径根本不进来（由静态资产直接响应）；env.ASSETS 那一行只是兜底。
// ════════════════════════════════════════════════════════════════════

// 🔴 每次发版只改这三行（改完 git push，Cloudflare 自动重新部署）
const LATEST = "1.0.44";
const DOWNLOAD_URL = "https://www.qiaodesktop.com/";
const NOTES = "";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // 容忍一个尾斜杠：/api/version 与 /api/version/ 等价
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path !== "/api/version") {
      // 兜底：非接口路径一律回给静态资产（正常走不到这里）
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET" } });
    }

    const rawV = (url.searchParams.get("v") || "").trim();
    const rawCh = (url.searchParams.get("ch") || "").trim();

    // 版本号只接受数字与点，其他一律拒绝（既防脏数据，也保证不把任意字符串存库）
    if (!/^\d{1,4}(\.\d{1,4}){0,3}$/.test(rawV)) {
      return json({ error: "bad version" }, 400);
    }
    const channel = /^[a-z]{1,16}$/.test(rawCh) ? rawCh : "unknown";
    const day = new Date().toISOString().slice(0, 10); // UTC 日期分桶

    // 计数（尽力而为；失败绝不影响更新检查本身）
    if (env.DB) {
      try {
        await env.DB.prepare(
          "INSERT INTO ping (day, version, channel, n) VALUES (?, ?, ?, 1) " +
            "ON CONFLICT(day, version, channel) DO UPDATE SET n = n + 1"
        )
          .bind(day, rawV, channel)
          .run();
      } catch (e) {
        // 静默：宁可丢一次计数，也不能让用户拿不到版本信息
      }
    }

    return json({ latest: LATEST, url: DOWNLOAD_URL, notes: NOTES }, 200);
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // 每次都要真实回源，不能被 CDN 缓存（否则计数失真）
      "cache-control": "no-store",
    },
  });
}
