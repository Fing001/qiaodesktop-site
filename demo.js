/* ==========================================================================
   巧桌面 · 交互演示脚本（IIFE，无外部依赖）
   index.html 首页内嵌的交互演示模块专用，元素 id 全局唯一，请勿在此写页面级逻辑。
   ========================================================================== */

(function(){
  'use strict';

  var CW = 2158, CH = 1366;
  var wrap = document.getElementById('screenWrap');
  var stage = document.getElementById('stage');
  var boxLayer = document.getElementById('boxLayer');
  var bgA = document.getElementById('bgA'), bgB = document.getElementById('bgB');
  var lTopbar = document.getElementById('lTopbar');
  var lSidebar = document.getElementById('lSidebar');
  var lFlyout = document.getElementById('lFlyout');
  var lMappanel = document.getElementById('lMappanel');
  var lSettings = document.getElementById('lSettings');
  var winClose = document.getElementById('winClose');
  var tip = document.getElementById('tip');
  var btnBoxes = document.getElementById('btnBoxes');
  var btnSummon = document.getElementById('btnSummon');
  var btnSettings = document.getElementById('btnSettings');
  var btnWall = document.getElementById('btnWall');
  var btnReset = document.getElementById('btnReset');
  var wallName = document.getElementById('wallName');
  var btip = document.getElementById('btip');
  var bflyHit = document.getElementById('bflyHit');
  var lBfly = document.getElementById('lBfly');
  var bflyTip = document.getElementById('bflyTip');

  /* ---------- 资源根与语言 ---------- */
  /* 站点两套静态页：/ 为英文、/zh/ 为中文。中文页在子目录里，靠 <body data-base="../">
     把 demo-assets 的根指回上级；语言取自 <html lang>，默认（en）走英文文案。 */
  var BASE = (document.body && document.body.getAttribute('data-base')) || '';
  var ZH = /^zh/i.test(document.documentElement.lang || '');
  var L = {
    boxes:     ZH ? { on:'添加盒子', off:'移除盒子' } : { on:'Add boxes', off:'Remove boxes' },
    walls:     ZH ? ['默认', '花朵特写', '角落漫游', '冷调配色']
                  : ['Default', 'Bloom close-up', 'Corner roam', 'Cool grade'],
    anyWindow: ZH ? '任意窗口' : 'Any window',
    tipSummon: ZH ? '两条栏和所有盒子都能浮在任意窗口之上'
                  : 'Both bars and every box can float above any window',
    tipReset:  ZH ? '盒子可以直接拖动；鼠标移到画面顶部或左侧边缘唤出两条栏'
                  : 'Boxes can be dragged — move the cursor to the top or left edge to reveal both bars',
    tips: ZH ? {
      green:  { t:'快捷启动盒子', d:'把散落的软件启动方式分类放在这里，直接找到' },
      cyan:   { t:'映射盒子',     d:'把任意位置文件夹直接投影到桌面，直接管理' },
      cream:  { t:'便签盒子',     d:'简单而快速记录一些信息' },
      orange: { t:'图标化盒子',   d:'鼠标停上来即刻展开，移开自动还原' },
      pink:   { t:'标题条化盒子', d:'鼠标停上来即刻展开，移开自动还原' }
    } : {
      green:  { t:'Quick Launch Box',    d:'Group app shortcuts here and find them at once' },
      cyan:   { t:'Folder Mapping Box',  d:'Project a folder from anywhere straight onto the desktop' },
      cream:  { t:'Sticky Notes Box',    d:'Jot things down quickly and simply' },
      orange: { t:'Iconized Box',        d:'Expands the moment you hover, restores when you leave' },
      pink:   { t:'Title Bar Box',       d:'Expands the moment you hover, restores when you leave' }
    }
  };

  /* ---------- 盒子定义（设计画布坐标，来自真实截图测量） ---------- */
  var BOXES = [
    { k:'cyan',   x:1403, y:143, w:451, h:246 },
    { k:'cream',  x:1835, y:143, w:323, h:254 },
    { k:'pink',   x:1403, y:389, w:447, h:47  },
    { k:'green',  x:1835, y:382, w:323, h:255 },
    { k:'orange', x:1731, y:411, w:120, h:120 }
  ];

  /* 悬停展开态：图标化盒子向右展开、标题条化盒子向下展开（锚点按截图对齐） */
  var EXP = {
    orange: { src:'demo-assets/box-orange-exp.webp', w:306, h:239, dx:0, dy:0, grow:'right' },
    pink:   { src:'demo-assets/box-pink-exp.webp',   w:432, h:240, dx:8, dy:0, grow:'down'  }
  };

  /* 每个盒子一句话说明（文案在 L.tips，随页面语言） */
  var TIPS = L.tips;

  var zTop = 20;
  var els = {}, expEls = {}, expanded = {};
  var hoverKey = null, dragging = false;

  BOXES.forEach(function(b){
    var img = document.createElement('img');
    img.className = 'bx';
    img.src = BASE + 'demo-assets/box-' + b.k + '.webp';
    img.alt = '';
    img.draggable = false;
    img.dataset.x = b.x;
    img.dataset.y = b.y;
    img.style.left = b.x + 'px';
    img.style.top = b.y + 'px';
    img.style.width = b.w + 'px';
    img.style.height = b.h + 'px';
    boxLayer.appendChild(img);
    els[b.k] = img;
    img.addEventListener('pointerdown', onDragStart);

    /* 有展开态的盒子：预建一张展开图，悬停时替换显示 */
    var e = EXP[b.k];
    if (e){
      var im2 = document.createElement('img');
      im2.className = 'bx bx-exp' + (e.grow === 'down' ? ' down' : '');
      im2.src = BASE + e.src;
      im2.alt = '';
      im2.draggable = false;
      im2.style.width = e.w + 'px';
      im2.style.height = e.h + 'px';
      boxLayer.appendChild(im2);
      expEls[b.k] = im2;
    }
  });

  /* ---------- 缩放适配：宽不够按宽缩；视口太矮时连宽一起收，保证首屏看全 ---------- */
  var scale = 1;
  function fit(){
    var body = document.querySelector('#qdDemo .monitor-body');
    var mon = document.querySelector('#qdDemo .monitor');
    if (body.style.maxWidth) body.style.maxWidth = '';   // 先解除限制，量自然宽度
    var r = wrap.getBoundingClientRect();
    if (!r.width) return;
    var sw = r.width / CW;
    /* 净高：显示器文档顶部到视口底部（30 = 上边框 14 + 底部余量 16）。
       矮视口（含内嵌预览面板）时连宽一起收，避免首屏被切 */
    var mr = mon.getBoundingClientRect();
    var availH = window.innerHeight - (mr.top + window.scrollY) - 30;
    var s = Math.min(sw, availH / CH);
    scale = s;
    stage.style.transform = 'scale(' + s + ')';
    if (s < sw - 0.002){
      body.style.maxWidth = Math.round(CW * s + 28) + 'px';   // 28 = 显示器左右边框内边距
    }
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  fit();

  /* ---------- 拖动 ---------- */
  function onDragStart(e){
    e.preventDefault();
    var img = e.currentTarget;
    if (!img.classList.contains('on')) return;
    img.setPointerCapture(e.pointerId);
    img.classList.add('drag');
    img.style.zIndex = ++zTop;
    dragging = true;
    setHover(null);                     // 拖动时不显示提示、不保持展开
    var sx = e.clientX, sy = e.clientY;
    var ox = parseFloat(img.dataset.x), oy = parseFloat(img.dataset.y);
    function mv(ev){
      var nx = ox + (ev.clientX - sx) / scale;
      var ny = oy + (ev.clientY - sy) / scale;
      img.dataset.x = nx; img.dataset.y = ny;
      img.style.left = nx + 'px';
      img.style.top = ny + 'px';
    }
    function up(){
      img.classList.remove('drag');
      dragging = false;
      img.removeEventListener('pointermove', mv);
      img.removeEventListener('pointerup', up);
      img.removeEventListener('pointercancel', up);
    }
    img.addEventListener('pointermove', mv);
    img.addEventListener('pointerup', up);
    img.addEventListener('pointercancel', up);
  }

  /* ---------- 边缘唤出：收纳栏与映射栏一体联动，文件面板独立计时 ---------- */
  var BAR = 89;                               // 两条栏的厚度（设计像素）
  var FLY = { x:789, y:89,  w:310, h:242 };   // 收纳栏展开盒
  var MAP = { x:89,  y:1,   w:448, h:1365 };  // 文件面板（独立图层，不含映射栏）
  var DOCK_X = [812, 1060];                   // 收纳栏里那排图标的横向范围
  /* 提示气泡在蝴蝶左侧，所以"停住"的判定区要比蝴蝶本身宽：把气泡区域也算进来，
     鼠标移过去看字时气泡不消失、也不会误唤出顶部收纳栏。
     气泡实测（设计像素）：x1525 y38 w518 h71，判定区向左留 25px 余量 */
  var BFLY_HIT  = { x:2055, y:33,  w:91,  h:80 };   // 蝴蝶本体（悬停高亮用）
  var BFLY_KEEP = { x:1500, y:20,  w:660, h:93 };   // 蝴蝶 + 左侧气泡（保持显示用）

  var HIDE_BARS = 1500;                       // 鼠标移开两条栏后多久收起
  var HIDE_PANEL = 500;                       // 鼠标离开文件面板与映射栏后多久收起

  var cur = { bars:false, flyout:false, mappanel:false };
  var barsTimer = null, panelTimer = null;
  var pinBars = false;                        // 呼出演示期间：两条栏常驻，不随鼠标移开而收起

  /* 呼出演示的浮层态：两栏常驻 + 加投影区分层次；退出时连同投影一起摘掉 */
  function setPin(on){
    pinBars = on;
    lTopbar.classList.toggle('lift', on);
    lSidebar.classList.toggle('lift', on);
  }

  function apply(s){
    if (s.bars !== undefined && s.bars !== cur.bars){
      cur.bars = s.bars;
      lTopbar.classList.toggle('on', s.bars);
      lSidebar.classList.toggle('on', s.bars);   // 两条栏同进同出
    }
    if (s.flyout !== undefined && s.flyout !== cur.flyout){
      cur.flyout = s.flyout;
      lFlyout.classList.toggle('on', s.flyout);
    }
    if (s.mappanel !== undefined && s.mappanel !== cur.mappanel){
      cur.mappanel = s.mappanel;
      lMappanel.classList.toggle('on', s.mappanel);
    }
  }

  function killBars(){ if (barsTimer){ clearTimeout(barsTimer); barsTimer = null; } }
  function killPanel(){ if (panelTimer){ clearTimeout(panelTimer); panelTimer = null; } }

  function toCanvas(e){
    var r = wrap.getBoundingClientRect();
    var s = r.width / CW;
    return { x:(e.clientX - r.left)/s, y:(e.clientY - r.top)/s };
  }

  function inRect(p, r){ return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

  /* ---------- 盒子悬停：提示气泡 + 展开态 ---------- */
  function rectOf(k){
    var el = els[k], b = null, i;
    for (i = 0; i < BOXES.length; i++) if (BOXES[i].k === k) b = BOXES[i];
    var x = parseFloat(el.dataset.x), y = parseFloat(el.dataset.y);
    if (expanded[k] && EXP[k]) return { x:x + EXP[k].dx, y:y + EXP[k].dy, w:EXP[k].w, h:EXP[k].h };
    return { x:x, y:y, w:b.w, h:b.h };
  }

  function setExpand(k, on){
    var e = EXP[k], im = expEls[k];
    if (!e || !im) return;
    expanded[k] = on;
    if (on){
      im.style.left = (parseFloat(els[k].dataset.x) + e.dx) + 'px';
      im.style.top  = (parseFloat(els[k].dataset.y) + e.dy) + 'px';
      im.style.zIndex = ++zTop;            // 展开态压在最上层
      els[k].style.zIndex = ++zTop;
    }
    im.classList.toggle('on', on);
    els[k].classList.toggle('hid', on);    // 原来的小盒子先让位
  }

  function showTipFor(k){
    if (!k || !TIPS[k]){ btip.classList.remove('on'); return; }
    var info = TIPS[k];
    btip.style.left = '0px';                 // 先靠左量宽，免得被“右侧剩余空间”压窄
    btip.style.top = '0px';
    btip.innerHTML = '<b>' + info.t + '</b><i>' + info.d + '</i>';
    var w = btip.offsetWidth || 420, h = btip.offsetHeight || 100;
    var pos = placeTip(k, w, h);
    btip.style.left = pos.x + 'px';
    btip.style.top = pos.y + 'px';
    btip.classList.add('on');
  }

  /* 气泡优先放盒子下方，压到别的盒子就换上方 */
  function overlapAny(rc, skip){
    for (var i = 0; i < BOXES.length; i++){
      var k = BOXES[i].k;
      if (k === skip || !els[k].classList.contains('on')) continue;
      var o = rectOf(k);
      if (!(rc.x + rc.w <= o.x || rc.x >= o.x + o.w || rc.y + rc.h <= o.y || rc.y >= o.y + o.h)) return true;
    }
    return false;
  }

  function placeTip(k, w, h){
    var r = rectOf(k);
    var cand = [{ y:r.y + r.h + 16 }, { y:r.y - h - 16 }];
    for (var i = 0; i < cand.length; i++){
      var y = cand[i].y;
      if (y < 12 || y + h > CH - 12) continue;
      var x = Math.max(12, Math.min(r.x, CW - w - 12));
      if (!overlapAny({ x:x, y:y, w:w, h:h }, k)) return { x:x, y:y };
    }
    return {
      x: Math.max(12, Math.min(r.x, CW - w - 12)),
      y: Math.max(12, Math.min(r.y + r.h + 16, CH - h - 12))
    };
  }

  function setHover(k){
    if (k === hoverKey) return;
    var prev = hoverKey;
    hoverKey = k;
    if (prev && EXP[prev]) setExpand(prev, false);
    if (k && EXP[k]) setExpand(k, true);
    if (k) showTipFor(k);
    else btip.classList.remove('on');
  }

  /* 命中测试：按实际 z 序从上往下找 */
  function hitBox(p){
    /* 已经展开的盒子：鼠标移进展开区里继续算“停在它身上”，不会自己收起 */
    if (hoverKey && expanded[hoverKey] && inRect(p, rectOf(hoverKey))) return hoverKey;
    var list = [], i, k, z;
    for (i = 0; i < BOXES.length; i++){
      k = BOXES[i].k;
      if (!els[k].classList.contains('on')) continue;
      z = parseInt(els[k].style.zIndex || '0', 10) || 0;
      list.push({ k:k, z:z });
    }
    list.sort(function(a, b){ return b.z - a.z; });
    for (i = 0; i < list.length; i++){
      if (inRect(p, rectOf(list[i].k))) return list[i].k;
    }
    return null;
  }

  function tick(p){
    var onBfly = inRect(p, BFLY_KEEP);   // 蝴蝶 + 左侧气泡：这一片都不触发顶栏
    var inTop = p.y <= BAR && !onBfly;
    var inLeft = p.x <= BAR;
    var onFly = cur.flyout && inRect(p, FLY);
    var onPanel = cur.mappanel && inRect(p, MAP);

    /* 两条栏：碰到就显；彻底离开后 1.5s 收起（呼出演示期间常驻，不参与计时） */
    if (inTop || inLeft || onFly || onPanel){
      killBars();
      apply({ bars:true });
    } else if (cur.bars && !barsTimer && !pinBars){
      barsTimer = setTimeout(function(){ barsTimer = null; apply({ bars:false }); }, HIDE_BARS);
    }

    /* 展开盒：跟在收纳栏那排图标后面，离开即收 */
    apply({ flyout: (inTop && p.x >= DOCK_X[0] && p.x <= DOCK_X[1]) || onFly });

    /* 文件面板：鼠标在整个映射栏上（顶栏那一角不算，那里属于收纳栏）都会弹出；
       停在面板上不计时，离开栏与面板 0.5s 收起 */
    var onMapBar = inLeft && p.y > BAR;
    if (onMapBar){
      killPanel();
      apply({ mappanel:true });
    } else if (onPanel){
      killPanel();                       // 还在面板上，计时不启动
    } else if (cur.mappanel && !panelTimer){
      panelTimer = setTimeout(function(){ panelTimer = null; apply({ mappanel:false }); }, HIDE_PANEL);
    }

    /* 盒子悬停：浮出说明气泡，图标化 / 标题条化盒子顺势展开 */
    setHover(dragging ? null : hitBox(p));

    /* 蝴蝶：停在蝴蝶上才放大 + 出气泡；停在气泡上气泡不消失 */
    setBflyHot(inRect(p, BFLY_HIT) || inRect(p, BFLY_KEEP));
  }

  wrap.addEventListener('mousemove', function(e){
    var p = toCanvas(e);
    if (p.x < 0 || p.y < 0 || p.x > CW || p.y > CH) return;
    tick(p);
  });

  wrap.addEventListener('mouseleave', function(){
    killBars(); killPanel();
    setHover(null);
    setBflyHot(false);
    /* 整块离开画面：面板 0.5s、两条栏 1.5s，各走各的（呼出演示期间两栏不收起） */
    panelTimer = setTimeout(function(){ panelTimer = null; apply({ mappanel:false }); }, HIDE_PANEL);
    if (!pinBars) barsTimer = setTimeout(function(){ barsTimer = null; apply({ bars:false, flyout:false }); }, HIDE_BARS);
  });

  /* ---------- 盒子显隐 ---------- */
  var boxesOn = false;
  function setBoxes(on, slow){
    boxesOn = on;
    if (!on) setHover(null);                       // 收起前先撤掉气泡与展开态
    BOXES.forEach(function(b, i){
      var el = els[b.k];
      if (on){
        el.classList.toggle('slow', !!slow);
        el.style.transitionDelay = (slow ? i * 150 : i * 70) + 'ms';
        el.classList.remove('hid');
        el.classList.add('on');
        el.style.zIndex = 20 + i;
      } else {
        el.style.transitionDelay = ((BOXES.length - 1 - i) * 40) + 'ms';
        el.classList.remove('on');
        el.classList.remove('slow');
        el.classList.remove('hid');
      }
    });
    if (on) zTop = 20 + BOXES.length;          // 展开态要压在所有盒子之上
    btnBoxes.classList.toggle('on', on);
    btnBoxes.firstChild.nodeValue = on ? L.boxes.off : L.boxes.on;
  }
  btnBoxes.addEventListener('click', function(){ setPin(false); setBoxes(!boxesOn); });

  /* ---------- 设置窗 ---------- */
  var settingsOn = false;
  var lSettingsImg = lSettings.querySelector('img');
  /* 设置窗截图约 29KB，只在第一次打开时才下载，不占首屏带宽 */
  function ensureSettingsImg(){
    if (lSettingsImg && !lSettingsImg.getAttribute('src')){
      lSettingsImg.src = lSettingsImg.getAttribute('data-src');
    }
  }
  function setSettings(on){
    if (on) ensureSettingsImg();
    settingsOn = on;
    lSettings.classList.toggle('on', on);
    btnSettings.classList.toggle('on', on);
  }
  btnSettings.addEventListener('click', function(){ setSettings(!settingsOn); });
  winClose.addEventListener('click', function(){ setSettings(false); });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') setSettings(false);
  });

  /* ---------- 背景切换（桌面壁纸 / 任意窗口截图） ---------- */
  /* 壁纸档位不是多张图片，而是同一张图的不同呈现：
     局部放大（transform-origin + scale）改变构图，filter 改变色调，
     交叉淡入时看起来就像换了一张壁纸。 */
  var DESK_BG = BASE + 'demo-assets/desk-bg.webp';
  var WINDOW_BG = BASE + 'demo-assets/ui-anywindow.webp';
  var WALLS = [
    { origin:'50% 50%', scale:1,    filter:'none' },
    { origin:'40% 44%', scale:1.40, filter:'none' },
    { origin:'84% 78%', scale:1.22, filter:'none' },
    { origin:'50% 50%', scale:1.05, filter:'hue-rotate(-30deg) saturate(1.35) brightness(1.08)' }
  ];
  /* 档位名随页面语言（L.walls 顺序与上面一致） */
  WALLS.forEach(function(w, i){ w.name = L.walls[i]; });
  var wallIdx = 0, frontIsA = true, inWindow = false;
  var preloaded = {};
  (function(){ var im = new Image(); im.src = DESK_BG; preloaded[DESK_BG] = im; })();
  /* 「任意窗口」底图约 31KB，只有点「在任意界面呼出盒子」时才用：
     放到空闲时段再预取——既不占首屏带宽，也不会让演示中途现下载 */
  function preloadWindowBg(){
    if (preloaded[WINDOW_BG]) return;
    var im = new Image(); im.src = WINDOW_BG; preloaded[WINDOW_BG] = im;
  }
  /* 空闲 6 秒后才预取：首屏关键路径上完全没有它，用户点了也来得及（swapBg 会等 onload） */
  setTimeout(preloadWindowBg, 6000);

  function applyWall(el, w){
    el.style.transformOrigin = w.origin;
    el.style.transform = 'scale(' + w.scale + ')';
    el.style.filter = w.filter;
  }
  function clearWall(el){
    el.style.transformOrigin = '';
    el.style.transform = '';
    el.style.filter = '';
  }

  /* wall 为 null 时切原始截图（任意窗口），不带任何变换 */
  function swapBg(src, wall){
    var showEl = frontIsA ? bgB : bgA;
    var hideEl = frontIsA ? bgA : bgB;
    if (showEl.getAttribute('src') !== src) showEl.src = src;
    if (wall) applyWall(showEl, wall);
    else clearWall(showEl);
    function swap(){
      showEl.classList.remove('hide');
      hideEl.classList.add('hide');
      frontIsA = !frontIsA;
    }
    if (showEl.complete) swap();
    else showEl.onload = function(){ showEl.onload = null; swap(); };
  }

  function toWallpaper(idx){
    inWindow = false;
    setPin(false);                 // 回到桌面：两栏恢复“跟着鼠标走”
    setBfly(true);
    wallIdx = idx;
    swapBg(DESK_BG, WALLS[idx]);
    wallName.textContent = WALLS[idx].name;
  }

  function nextWall(){ toWallpaper((wallIdx + 1) % WALLS.length); }
  btnWall.addEventListener('click', nextWall);

  /* ---------- 右上角蝴蝶 = 换壁纸 ---------- */
  var bflyHot = false;

  function setBflyHot(on){
    if (on === bflyHot) return;
    bflyHot = on;
    lBfly.classList.toggle('hot', on);
    bflyTip.classList.toggle('on', on);
  }

  bflyHit.addEventListener('click', function(){ nextWall(); });

  /* ---------- 在任意界面呼出盒子 ---------- */
  var summonT1 = null, summonT2 = null;

  function setBfly(on){
    lBfly.classList.toggle('off', !on);
    bflyHit.classList.toggle('off', !on);
    if (!on){ bflyHot = false; lBfly.classList.remove('hot'); bflyTip.classList.remove('on'); }
  }

  function killSummon(){
    if (summonT1){ clearTimeout(summonT1); summonT1 = null; }
    if (summonT2){ clearTimeout(summonT2); summonT2 = null; }
  }

  function summonBoxes(){
    killSummon();
    killBars(); killPanel();
    setPin(false);
    apply({ bars:false, flyout:false, mappanel:false });
    setSettings(false);

    /* ① 先把桌面上的盒子全部收掉（两条栏也一起收） */
    setBoxes(false);

    /* ② 背景换成“任意窗口”（一张全屏资源管理器截图） */
    if (!inWindow){
      inWindow = true;
      swapBg(WINDOW_BG);
      setBfly(false);                 // 蝴蝶长在壁纸上，窗口上没有它
      wallName.textContent = L.anyWindow;
    }

    /* ③ 0.3 秒后：两条栏 + 所有盒子一起浮出来（两条栏也算被“呼出”的盒子） */
    summonT1 = setTimeout(function(){
      summonT1 = null;
      setPin(true);                  // 呼出期间常驻，鼠标移开也不会自己收起
      killBars();
      apply({ bars:true });
      setBoxes(true, true);
    }, 300);

    /* ④ 1.5 秒后全部就位 */
    summonT2 = setTimeout(function(){
      summonT2 = null;
      showTip(L.tipSummon);
    }, 1500);
  }
  btnSummon.addEventListener('click', summonBoxes);

  /* ---------- 重置 ---------- */
  btnReset.addEventListener('click', function(){
    killSummon();
    setPin(false);                       // 清呼出常驻态（连带摘掉两栏投影）
    setBoxes(true);                     // 恢复到“一进来”的样子：盒子都在桌面上
    setSettings(false);
    killBars(); killPanel();
    apply({ bars:false, flyout:false, mappanel:false });
    toWallpaper(0);
    BOXES.forEach(function(b){
      var el = els[b.k];
      el.dataset.x = b.x; el.dataset.y = b.y;
      el.style.left = b.x + 'px'; el.style.top = b.y + 'px';
    });
    showTip(L.tipReset);
  });

  /* ---------- 初始状态：五个盒子默认就摆在桌面上 ---------- */
  setTimeout(function(){ setBoxes(true); }, 260);

  /* ---------- 画面内提示条 ---------- */
  var tipT = null;
  function showTip(text){
    if (text) tip.textContent = text;
    tip.classList.add('on');
    if (tipT) clearTimeout(tipT);
    tipT = setTimeout(function(){ tip.classList.remove('on'); }, 4200);
  }
  setTimeout(showTip, 700);
})();
