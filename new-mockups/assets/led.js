/* TITAN117 mockups: shared helpers and the LED dot-matrix engine (website and desktop app). */
/* ═════════ helpers ═════════ */
var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function $(s, r){ return (r || document).querySelector(s); }
function $$(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function fit(cv, host){
  var r = host.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width*dpr)); cv.height = Math.max(1, Math.round(r.height*dpr));
  return {W:r.width, H:r.height, dpr:dpr, r:r};
}
function onResize(fn, host){
  var t = 0, go = function(){ clearTimeout(t); t = setTimeout(fn, 140); };
  addEventListener('resize', go);
  if(window.ResizeObserver && host) new ResizeObserver(go).observe(host);
}
function visible(el, fn){
  if(!('IntersectionObserver' in window)){ fn(true); return; }
  new IntersectionObserver(function(e){ fn(e[0].isIntersecting); }, {rootMargin:'120px'}).observe(el);
}
function hash(a, b){ var x = Math.sin(a*127.1 + b*311.7)*43758.5453; return x - Math.floor(x); }
function smooth(a, b, x){ x = Math.min(1, Math.max(0, (x - a)/(b - a))); return x*x*(3 - 2*x); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

/* ═════════ LED wall ═════════
   A scene drawn in code into a tiny offscreen "field" (one pixel per dot), then read back and shown as
   scanline rows of dots in five sizes. A pose change dissolves dot by dot in a scattered, row-streaked
   order, with a flickering front; now and then a row slips sideways for a beat. With two groups the
   left and right halves change pose on their own. */
function led(o){
  var cv = o.canvas, host = o.host || cv.parentNode, ctx = cv.getContext('2d');
  var fA = document.createElement('canvas'), fB = document.createElement('canvas');
  var xA = fA.getContext('2d', {willReadFrequently:true}), xB = fB.getContext('2d', {willReadFrequently:true});
  var G = o.groups || 1, DUR = o.dur || 1.6, ink = o.ink || '#0d0d0d';
  /* look: rowGap (row spacing in dot pitches; 2.05 reads as scanlines, ~1.2 as a fine halftone), levels (dot
     sizes), minDot (smallest dot, share of the full radius), tone (field darkness 0..1 to dot level 0..1),
     shimmer (per-dot flicker), glitch (share of rows that slip each tick), slip (how far, in dots), grid (colour of the unlit LEDs) */
  var RG = o.rowGap || 2.05, NL = o.levels || 4, MIN = o.minDot || .38, SHIM = o.shimmer == null ? .14 : o.shimmer, GLI = o.glitch == null ? .035 : o.glitch;
  var tone = o.tone || function(d){ return (d - .16)/.42; };
  var st = [], W, H, dpr, step, rs, cols, rows, R, seed, mask, grid = null, vis = true, t0 = performance.now(), api = {};
  for(var g=0; g<G; g++) st.push({cur:o.start ? o.start[g] : 0, next:o.start ? o.start[g] : 0, s:0});
  function size(){
    var f = fit(cv, host); W = f.W; H = f.H; dpr = f.dpr;
    step = o.pitch ? o.pitch(W, H) : Math.max(5, W/205); rs = step*RG;
    cols = Math.ceil(W/step); rows = Math.ceil(H/rs);
    fA.width = fB.width = cols; fA.height = fB.height = rows; R = step*.46;
    seed = new Float32Array(cols*rows); mask = new Float32Array(cols*rows);
    /* quiet zones: dots fade out around the copy so they never cross it */
    var boxes = (o.quiet || []).map(function(el){ var c = el.getBoundingClientRect(); return {x0:c.left - f.r.left, x1:c.right - f.r.left, y0:c.top - f.r.top, y1:c.bottom - f.r.top}; });
    var feather = o.feather || 70, pad = o.pad == null ? 18 : o.pad;
    for(var j=0; j<rows; j++) for(var i=0; i<cols; i++){
      var k = j*cols + i, x = (i + .5)*step, y = (j + .5)*rs, q = 1;
      seed[k] = .55*hash(i, j) + .45*hash(j*3.1, 7.7);
      for(var b=0; b<boxes.length; b++){
        var r = boxes[b], dx = Math.max(r.x0 - x, 0, x - r.x1), dy = Math.max(r.y0 - y, 0, y - r.y1);
        q = Math.min(q, smooth(pad, pad + feather, Math.sqrt(dx*dx + dy*dy)));
      }
      if(o.mask) q *= o.mask(x/W, y/H, W, H);
      mask[k] = q;
    }
    /* the unlit LEDs, drawn once per size: a pinpoint on every other cell, faded with the quiet zones */
    if(o.grid){
      grid = document.createElement('canvas'); grid.width = cv.width; grid.height = cv.height;
      var gx = grid.getContext('2d'); gx.setTransform(dpr, 0, 0, dpr, 0, 0); gx.fillStyle = o.grid;
      for(var j=0; j<rows; j+=2) for(var i=(j/2) % 2; i<cols; i+=2){
        var q = mask[j*cols + i]; if(q < .05) continue;
        gx.globalAlpha = q; gx.beginPath(); gx.arc((i + .5)*step, (j + .5)*rs, R*.3, 0, 6.2832); gx.fill();
      }
    }
  }
  api.go = function(g, p){
    var s = st[g]; if(p === s.next) return;
    if(s.cur !== s.next) s.cur = s.next;
    s.next = p; s.s = performance.now();
  };
  api.time = function(sec){ t0 = performance.now() - sec*1000; };
  api.pose = function(g){ return st[g].next; };
  function paint(x, poses, t){
    x.setTransform(1,0,0,1,0,0); x.fillStyle = '#fff'; x.fillRect(0, 0, cols, rows);
    x.setTransform(cols/W, 0, 0, rows/H, 0, 0);
    o.draw(x, W, H, t, poses);
  }
  /* hover fx (trial): o.hover is the halo radius in px; hp eases toward the pointer, hk fades in and out */
  var HR = o.hover || 0, hp = {x:0, y:0}, hptr = null, hk = 0;
  if(HR && !reduce){
    host.addEventListener('pointermove', function(e){ var r = host.getBoundingClientRect(); hptr = {x:e.clientX - r.left, y:e.clientY - r.top}; if(hk < .01){ hp.x = hptr.x; hp.y = hptr.y; } });
    host.addEventListener('pointerleave', function(){ hptr = null; });
  }
  function frame(now){
    if(!cols || !rows || W < 2 || H < 2) return;   /* not laid out yet (a hidden or collapsed panel) */
    var t = reduce ? (o.still || 0) : (now - t0)/1000;
    if(HR){ hk += ((hptr ? 1 : 0) - hk)*.08; if(hptr){ hp.x += (hptr.x - hp.x)*.18; hp.y += (hptr.y - hp.y)*.18; } }
    if(o.script) o.script(t, api.go);
    var ms = [], any = false;
    for(var g=0; g<G; g++){
      var s = st[g];
      if(s.cur === s.next || reduce){ s.cur = s.next; ms[g] = 0; continue; }
      var m = smooth(0, DUR, (now - s.s)/1000);
      if(m >= 1){ s.cur = s.next; ms[g] = 0; } else { ms[g] = m; any = true; }
    }
    paint(xA, st.map(function(s){ return s.cur; }), t);
    var dA = xA.getImageData(0, 0, cols, rows).data, dB = dA;
    if(any){ paint(xB, st.map(function(s){ return s.next; }), t); dB = xB.getImageData(0, 0, cols, rows).data; }
    ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0, 0, cv.width, cv.height);
    if(grid) ctx.drawImage(grid, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var P = [null], tick = Math.floor(t*7), half = cols/2, slip = o.slip || 8;
    for(var l=1; l<=NL; l++) P.push(new Path2D());
    for(var j=0; j<rows; j++){
      var sh = (!reduce && hash(j, tick) > 1 - GLI) ? Math.round((hash(tick, j) - .5)*slip) : 0, y = (j + .5)*rs;
      for(var i=0; i<cols; i++){
        var k = j*cols + i, q = mask[k]; if(q < .01) continue;
        var m = ms[G > 1 && i >= half ? 1 : 0], sd = seed[k];
        var si = Math.min(cols - 1, Math.max(0, i - sh)), d = (m > 0 && sd < m) ? dB : dA;
        var v = tone(1 - d[(j*cols + si)*4]/255), hv = 0;
        /* hover fx: the LEDs under the cursor light up in a soft halo, and lit shapes grow bolder there */
        if(hk > .01){ var hx = (i + .5)*step - hp.x, hy = y - hp.y, h2 = hx*hx + hy*hy; if(h2 < HR*HR*5) hv = hk*Math.exp(-h2/(HR*HR)); }
        if(hv > .02) v = Math.max(v, 0) + hv*.4;
        if(v <= 0) continue; if(v > 1) v = 1;
        if(m > .001 && m < .999){ var e = Math.abs(sd - m); if(e < .12){ v *= e/.12; if(hash(i + tick, j) <= .4) v *= .3; } }
        if(!reduce && SHIM) v *= 1 - SHIM + SHIM*Math.sin(t*3.2 + sd*40);
        v *= q;
        var L = Math.min(NL, Math.floor(v*NL + .52));
        if(L < 1) continue;
        var r = R*Math.max(MIN, L/NL), x = (i + .5)*step;
        P[L].moveTo(x + r, y); P[L].arc(x, y, r, 0, 6.2832);
      }
    }
    ctx.fillStyle = typeof ink === 'function' ? ink() : ink;   /* a function lets the ink follow a theme */
    for(var l=1; l<=NL; l++) ctx.fill(P[l]);
    if(o.after) o.after(t);
  }
  /* a panel whose canvas has left the page (the desktop app swaps views) stops for good */
  function loop(now){ if(!cv.isConnected) return; requestAnimationFrame(loop); if(vis) frame(now); }
  size();
  visible(host, function(on){ vis = on; });
  onResize(function(){ size(); if(reduce) frame(performance.now()); }, host);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ size(); if(reduce) frame(performance.now()); });
  if(reduce){ frame(performance.now()); api.go = function(g, p){ st[g].cur = st[g].next = p; frame(performance.now()); }; }
  else requestAnimationFrame(loop);
  return api;
}

/* high definition for every LED scene (1 Nov 2026): a fine, near-square halftone in six dot sizes over a faint
   grid of unlit LEDs, with a calm shimmer and rare, short row slips, so shapes read as drawings, not scanlines */
var HD = {rowGap:1.2, levels:6, minDot:.3, tone:function(d){ return (d - .04)/.78; }, shimmer:.04, glitch:.012, slip:6, grid:'#d9d9d5'};

/* shapes for the LED scenes, each centred on 0,0 with size S (about its height). Greys become dot
   sizes: near-black is the biggest dot, light grey a pinpoint, white nothing. */
function rr(x, X, Y, w, h, r){ x.beginPath(); if(x.roundRect) x.roundRect(X, Y, w, h, r); else x.rect(X, Y, w, h); }
function lin(x, x0, y0, x1, y1, a, b){ var g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
var SHAPE = {
  laptop: function(x, S, t){
    rr(x, -.66*S, -.52*S, 1.32*S, .82*S, .05*S); x.fillStyle = '#1a1a1a'; x.fill();
    rr(x, -.6*S, -.46*S, 1.2*S, .7*S, .02*S); x.fillStyle = lin(x, -.6*S, -.46*S, .6*S, .24*S, '#8a8a8a', '#d2d2d2'); x.fill();
    x.fillStyle = '#5c5c5c'; x.fillRect(-.6*S, -.46*S, .26*S, .7*S);
    x.fillStyle = '#2a2a2a'; for(var k=0; k<4; k++) x.fillRect(-.55*S, (-.38 + k*.09)*S, (.15 - (k % 2)*.04)*S, .035*S);
    /* a chat on the screen: your message right, Titan's plan left, a line typing in */
    x.fillStyle = '#262626'; rr(x, .02*S, -.36*S, .48*S, .1*S, .02*S); x.fill();
    x.fillStyle = '#3a3a3a'; rr(x, -.26*S, -.18*S, .56*S, .2*S, .02*S); x.fill();
    x.fillStyle = '#9c9c9c'; for(var k=0; k<3; k++) x.fillRect(-.22*S, (-.14 + k*.055)*S, (.42 - k*.08)*S, .025*S);
    var ty = (t*.5) % 1; x.fillStyle = '#1e1e1e'; x.fillRect(-.26*S, .1*S, (.12 + .5*ty)*S, .06*S);
    x.beginPath(); x.moveTo(-.76*S, .38*S); x.lineTo(.76*S, .38*S); x.lineTo(.68*S, .3*S); x.lineTo(-.68*S, .3*S); x.closePath();
    x.fillStyle = lin(x, 0, .3*S, 0, .38*S, '#3a3a3a', '#8a8a8a'); x.fill();
  },
  phone: function(x, S, t){
    rr(x, -.3*S, -.56*S, .6*S, 1.12*S, .09*S); x.fillStyle = '#1a1a1a'; x.fill();
    rr(x, -.26*S, -.51*S, .52*S, 1.02*S, .06*S); x.fillStyle = lin(x, 0, -.51*S, 0, .51*S, '#9a9a9a', '#d8d8d8'); x.fill();
    rr(x, -.22*S, -.36*S, .44*S, .34*S, .03*S); x.fillStyle = '#f2f2f2'; x.fill();
    x.fillStyle = '#2a2a2a'; x.fillRect(-.18*S, -.31*S, .2*S, .04*S);
    x.fillStyle = '#6a6a6a'; for(var k=0; k<3; k++) x.fillRect(-.18*S, (-.23 + k*.055)*S, (.34 - k*.07)*S, .025*S);
    var p = .5 + .5*Math.sin(t*2.4);
    rr(x, -.22*S, .2*S, .44*S, .14*S, .03*S); x.fillStyle = p > .5 ? '#0e0e0e' : '#262626'; x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = .025*S; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(-.05*S, .27*S); x.lineTo(-.01*S, .305*S); x.lineTo(.07*S, .235*S); x.stroke();
    rr(x, -.22*S, .04*S, .44*S, .12*S, .03*S); x.fillStyle = '#b4b4b4'; x.fill();
  },
  /* Titan's two angry eyes (the logo's blades), no frame; they blink now and then */
  titan: function(x, S, t){
    var u = S/22, blink = Math.max(.12, 1 - Math.max(0, Math.sin(t*1.3) - .985)*60);
    x.save(); x.scale(u, u*blink);
    x.fillStyle = lin(x, 0, -4, 0, 3, '#3a3a3a', '#0e0e0e'); x.strokeStyle = '#0e0e0e'; x.lineWidth = 1.1; x.lineJoin = 'round';
    [[1, 8], [-1, -8]].forEach(function(e){
      x.save(); x.translate(-6.3*e[0], 0); x.rotate(e[1]*Math.PI/180); x.translate(6.3*e[0], 0);
      x.beginPath(); x.moveTo(-10.6*e[0], -3.6); x.lineTo(-2*e[0], .3); x.lineTo(-2*e[0], 3); x.lineTo(-10.6*e[0], 3); x.closePath();
      x.fill(); x.stroke(); x.restore();
    });
    x.restore();
  },
  folder: function(x, S, t){
    x.beginPath(); x.moveTo(-.6*S, -.36*S); x.lineTo(-.22*S, -.36*S); x.lineTo(-.14*S, -.28*S); x.lineTo(.6*S, -.28*S); x.lineTo(.6*S, .42*S); x.lineTo(-.6*S, .42*S); x.closePath();
    x.fillStyle = '#2c2c2c'; x.fill();
    var lift = .04*Math.sin(t*1.2);
    rr(x, -.44*S, (-.5 + lift)*S, .88*S, .7*S, .02*S); x.fillStyle = '#f0f0f0'; x.fill();
    x.fillStyle = '#2a2a2a'; x.fillRect(-.36*S, (-.42 + lift)*S, .3*S, .045*S);
    x.fillStyle = '#7a7a7a'; for(var k=0; k<4; k++) x.fillRect(-.36*S, (-.32 + k*.065 + lift)*S, (.66 - (k % 3)*.12)*S, .025*S);
    x.beginPath(); x.moveTo(-.6*S, -.12*S); x.lineTo(.6*S, -.12*S); x.lineTo(.6*S, .42*S); x.lineTo(-.6*S, .42*S); x.closePath();
    x.fillStyle = lin(x, 0, -.12*S, 0, .42*S, '#5a5a5a', '#9e9e9e'); x.fill();
    x.beginPath(); x.arc(.42*S, .3*S, .17*S, 0, 6.2832); x.fillStyle = '#0e0e0e'; x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = .04*S; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(.35*S, .3*S); x.lineTo(.4*S, .35*S); x.lineTo(.5*S, .24*S); x.stroke();
  }
};


/* ═════════ industries: one LED panel per industry icon ═════════ */
function iconPath(svg){
  var p = new Path2D(), m;
  var re = /<(path|circle|rect)([^>]*)\/>/g;
  function at(s, n){ var r = new RegExp(n + '="([^"]*)"').exec(s); return r ? r[1] : null; }
  while((m = re.exec(svg))){
    if(m[1] === 'path') p.addPath(new Path2D(at(m[2], 'd')));
    else if(m[1] === 'circle'){ var cx = +at(m[2], 'cx'), cy = +at(m[2], 'cy'), r = +at(m[2], 'r'); p.moveTo(cx + r, cy); p.arc(cx, cy, r, 0, 6.2832); }
    else { var X = +at(m[2], 'x'), Y = +at(m[2], 'y'), w = +at(m[2], 'width'), h = +at(m[2], 'height'), rx = +(at(m[2], 'rx') || 0); if(p.roundRect) p.roundRect(X, Y, w, h, rx); else p.rect(X, Y, w, h); }
  }
  return p;
}
