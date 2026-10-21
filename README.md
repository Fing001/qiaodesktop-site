# 巧桌面 QiaoDesktop · 官网

[qiaodesktop.com](https://qiaodesktop.com) 的静态站点源码。纯 HTML/CSS/JS 单文件页面，无构建步骤、无外部依赖。

## 页面

| 文件 | 说明 |
| --- | --- |
| `index.html` | **英文首页（默认）**：`/` 即英文版，产品介绍、在线演示、功能、VIP 与下载入口 |
| `zh/index.html` | **中文首页**：`/zh/`，内容与英文版一一对应，仅文案与 meta 不同 |
| `demo.css` / `demo.js` | 交互演示（作用域 `#qdDemo`）的样式与脚本，**两页共用一份** |
| `demo-assets/` | 演示素材：壁纸、界面图、盒子图（全部 WebP），分享卡 `og-en.jpg`（英）/ `og.jpg`（中） |
| `_headers` | Cloudflare Pages 响应头：素材长缓存、HTML 每次重验证 |

## 双语结构

- **默认英文**：根路径就是英文页，爬虫与社交抓取拿到的都是英文 meta。
- **中文在 `/zh/`**：两页互相 `hreflang`（`en` / `zh-Hans` / `x-default=英文`），各自 canonical 指向自己。
- **语言切换**：导航右侧 `EN | 中文` 胶囊，纯链接跳转、不刷新不记 cookie（`index.html` ↔ `zh/index.html`）。
  之所以写死 `index.html` 而不是目录形式，是为了双击本地文件时也能跳转。
- **演示模块的双语**：`demo.js` 读 `<html lang>` 决定文案（盒子气泡、壁纸档位名、按钮开关文案），
  并读 `<body data-base="../">` 拼素材路径 —— 中文页在子目录里，素材仍在根 `demo-assets/`。
- **改文案要改两处**：英文 `index.html` 与中文 `zh/index.html` 是两份静态 HTML（SEO 最优），
  不是 JS 切词；改完记得同步。`demo.js` 里的双语文案集中在顶部 `L` 对象，只改那一处。
- **已知限制**：演示截图是客户端真实界面（中文界面），英文页里这部分图仍是中文 —— 要英文截图需重截素材。

## 本地预览

直接双击 `index.html` 即可；或用任意静态服务器：

```bash
python -m http.server 8000
# 打开 http://localhost:8000
```

## 部署

推送到 `main` 分支后由 Cloudflare Pages 自动构建发布：

- Framework preset：`None`
- Build command：留空
- Build output directory：`/`

## 素材规范

- 图片一律用 **WebP**（文件名即缓存键，不带哈希，改图请同时改名或加 `?v=`）。
- 转码按「可见像素误差」挑选：误差 >5 的用无损，其余用 `quality=90`。当前 15 张图 404KB → 155KB。
- 设置窗与「任意窗口」两张截图只在交互后才用得到，分别走 `data-src` 按需加载与 6 秒空闲预取，不占首屏带宽。
- 分享卡 1200×630，只被社交平台抓取，正常访问不会下载：英文页 `og-en.jpg`、中文页 `og.jpg`。
  生成脚本 `D:/tmp/temp/og_card.js`（`node og_card.js en|zh`），输出 2400×1260 后需缩到 1200×630。

## 说明

本仓库仅包含官网静态页面源码，巧桌面客户端的源代码不在本仓库。

「巧桌面 / QiaoDesktop」名称、图标与演示素材版权归 夜书工作室 所有。
