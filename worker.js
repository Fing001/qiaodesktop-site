// Cloudflare Worker — GET /api/version（客户端检查更新）+ GET /download（官网下载跳转）
// ════════════════════════════════════════════════════════════════════
// 用途：桌面程序「检查更新」的唯一端点。
//   请求：GET /api/version?v=<版本号>&ch=<official|store>
//   响应：{ latest, url, notes, pkg }（200）
//     pkg = { url, urls, sha256, size } | null（null = 只检查不提供下载，客户端不显示下载按钮）
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
//   路由规则见 wrangler.json 的 assets.run_worker_first：只有 /api/* 与 /download、/download/*
//   会进本 Worker，其余路径根本不进来（由静态资产直接响应）；env.ASSETS 那一行只是兜底。
// ════════════════════════════════════════════════════════════════════

// 🔴 每次发版只改这个常量区（改完 git push，Cloudflare 自动重新部署）
const LATEST = "1.0.45.16";
const DOWNLOAD_URL = "https://www.qiaodesktop.com/";
const NOTES = "";

// 更新包分发（2026-10-24 双源）：同一个包传两处，sha256/size 同一份。
//   [0] GitHub Releases —— 面向人的发布物料（exe/CHANGELOG/README）就在 GitHub，包同址；
//   [1] Cloudflare R2    —— 面向机器的下载通道（免费额度内恒零成本，国内期望速度更好）。
//   客户端对数组随机打乱后串行 fallback ⇒ 负载天然分散 + 一个失败自动换下一个。
//   ⚠️ 不做按地区/渠道的智能选源：读 CF-IPCountry 违反隐私政策 §2.1（不读任何请求头）。
//   ⚠️ 留空 = 该源未就绪；全部留空时不下发 pkg（客户端维持"只检查不下载"的旧行为）。
//   占位说明：URL 填好即开通，无需改客户端。
const PKG_URLS = [
  "https://github.com/Fing001/qiaodesktop-releases/releases/download/v1.0.45.16/QiaoDesktop-1.0.45.16.exe.lzma", // GitHub Releases
  "https://dl.qiaodesktop.com/QiaoDesktop-1.0.45.16.exe.lzma", // Cloudflare R2
];
const PKG_SHA256 = "4DCCF4766E459016A5B0C8468E0068986D3B6AF2EF0999369154C4D82A42DE9F"; // 包 sha256（大写十六进制）；空 = 跳过校验（仅调试用，正式发版必填）
const PKG_SIZE = 1128256;    // 包字节数；0 = 跳过 size 校验

// 官网下载入口的物料（2026-10-28 新增）—— 给「人」点的，与上面给客户端用的 PKG_URLS 分开维护。
//   [0] GitHub Releases —— 发布物料原址（exe 与 .lzma 同目录，附 README/CHANGELOG）
//   [1] Cloudflare R2    —— 官网通道（国内期望速度更好），/download 默认走这里
//   ⚠️ 两个数组的 URL 都带版本号 ⇒ 每次发版必须与 LATEST / PKG_URLS 一起改，漏改即发旧包。
//   ⚠️ 不做跨类型回退（exe 未上传时不悄悄塞给用户一个 .lzma）：宁可 302 到一个 404，
//      也不让用户下到与按钮描述不符的文件。
const EXE_URLS = [
  "https://github.com/Fing001/qiaodesktop-releases/releases/download/v1.0.45.16/QiaoDesktop-1.0.45.16.exe", // GitHub Releases
  "https://dl.qiaodesktop.com/QiaoDesktop-1.0.45.16.exe", // Cloudflare R2
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // 容忍一个尾斜杠：/api/version 与 /api/version/ 等价
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // 官网下载入口（2026-10-28）：/download = 未压缩 exe（下载即用）；/download/lzma = 压缩包（需解压工具）。
    //   默认跳官网 R2（国内更稳）；加 ?src=gh 换 GitHub 源。
    //   ⚠️ 用 302 而不是 Worker 代理文件：文件本身在 R2/GitHub 上，代理大文件既费流量也失去 CDN 直连优势。
    //   ⚠️ 必须带 no-store：URL 里写死了版本号，一旦 302 被浏览器/CDN 缓存，用户会永远停在旧版本。
    //   ⚠️ 这两个路径要能进本 Worker，靠 wrangler.json 的 run_worker_first 显式列出，漏加会被静态资产直接 404。
    if (path === "/download" || path === "/download/lzma") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
      }
      const dlSrc = (url.searchParams.get("src") || "").toLowerCase();
      const ghFirst = dlSrc === "gh" || dlSrc === "github";
      const ready = (path === "/download" ? EXE_URLS : PKG_URLS).filter(
        (u) => typeof u === "string" && u.length > 0
      );
      // 默认取末位（R2），?src=gh 取首位（GitHub）；某源留空时自动用另一个
      const target = ready.length === 0 ? "" : ghFirst ? ready[0] : ready[ready.length - 1];
      if (!target) {
        return new Response("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
      }
      return new Response(null, {
        status: 302,
        headers: { location: target, "cache-control": "no-store" },
      });
    }

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

    // 计数（后台执行：waitUntil 保住异步任务，但响应不再等 D1——D1 慢/抖时接口仍是毫秒级；
    // 实测 2026-10-25：阻塞式 await D1 时接口延迟 2.7~12s 且间歇超时，改后台后恢复）
    if (env.DB) {
      ctx.waitUntil(
        env.DB.prepare(
          "INSERT INTO ping (day, version, channel, n) VALUES (?, ?, ?, 1) " +
            "ON CONFLICT(day, version, channel) DO UPDATE SET n = n + 1"
        )
          .bind(day, rawV, channel)
          .run()
          .catch(() => {}) // 静默：宁可丢一次计数，也不能让用户拿不到版本信息
      );
    }

    // 更新包：过滤未就绪的源；一个都不剩 ⇒ pkg=null（客户端只检查、不显示下载按钮）
    const pkgUrls = PKG_URLS.filter((u) => typeof u === "string" && u.length > 0);
    const pkg =
      pkgUrls.length > 0
        ? { url: pkgUrls[0], urls: pkgUrls, sha256: PKG_SHA256, size: PKG_SIZE }
        : null;

    return json({ latest: LATEST, url: DOWNLOAD_URL, notes: NOTES, pkg }, 200);
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
