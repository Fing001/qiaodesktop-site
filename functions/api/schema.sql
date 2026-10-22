-- qd 更新检查计数表（Cloudflare D1）
-- 用法：Cloudflare 控制台 → Workers & Pages → D1 → 选库 → Console，粘贴执行一次即可。
-- ⚠️ 本文件只作留档，不会被访问（functions/ 目录不参与静态托管）。

CREATE TABLE IF NOT EXISTS ping (
  day     TEXT    NOT NULL,   -- UTC 日期 YYYY-MM-DD
  version TEXT    NOT NULL,   -- 上报的程序版本号，如 1.0.43
  channel TEXT    NOT NULL,   -- official / store / unknown
  n       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (day, version, channel)
);

-- ── 常用查询 ──────────────────────────────────────────────
-- 1) 某天有多少次检查（粗略活跃量）
--    SELECT SUM(n) FROM ping WHERE day = date('now');
--
-- 2) 最近 30 天每日趋势
--    SELECT day, SUM(n) AS checks FROM ping
--    WHERE day >= date('now','-30 days') GROUP BY day ORDER BY day;
--
-- 3) 版本分布（看还有多少人在老版本 → 决定要不要催更）
--    SELECT version, SUM(n) AS checks, MIN(day) AS first_seen, MAX(day) AS last_seen
--    FROM ping GROUP BY version ORDER BY checks DESC;
--
-- 4) 累计总量
--    SELECT SUM(n) FROM ping;
--
-- ⚠️ 口径提醒：这里是「检查次数」，不是「用户数」。同一个人每天重装/清配置
--    或一天内多台机器都会各计一次；反过来，关掉「每天检查一次新版本」的用户
--    完全不产生记录（低估）。只用于看趋势与版本分布，不要当 UV 用。
