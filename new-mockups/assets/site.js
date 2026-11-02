/* TITAN117 website mockups (1 Nov 2026): every page's scripts. Needs data.js (content) and led.js (helpers and the
   LED engine) first. Each module checks for its own markup, so one file serves every page. */
window.ROOT = window.ROOT || '';
/* ═════════ how it works: you and Titan, reaching for each other ═════════
   A 20 s loop in four beats: you ask (laptop, Titan), you approve (phone, Titan), the team works
   (phone, the folder of finished work), it lands on your disk (laptop, folder). Each side drifts,
   breathes and rolls in counter-phase; a row of pulses runs between them. */
(function(){
  var cv = $('[data-wall]'); if(!cv) return;
  var LOOP = 20, BEATS = [0, 4, 9, 14], stepsEl = $$('#steps .step'), tags = $$('.wall__tag'), lastBeat = -1, wall;
  var L = ['laptop', 'phone'], Rr = ['titan', 'folder'], TAGL = ['your laptop', 'your phone'], TAGR = ['titan', 'the work, done'];
  var geo = {};
  function place(W, H){
    var port = H > W*1.1, S = port ? Math.min(W*.34, H*.2) : Math.min(H*.4, W*.21);
    geo = {S:S, cy:port ? H*.66 : H*.65, lx:W*(port ? .27 : .26), rx:W*(port ? .73 : .74)};
  }
  function side(x, W, H, t, which, pose, left){
    var a = 2*Math.PI*t/LOOP, ph = left ? 0 : Math.PI;
    var reach = (.012*Math.sin(a + ph) + .005*Math.sin(2*a + 1.3 + ph))*W, sc = 1 + .05*Math.sin(a + .9 + ph), rot = (left ? 1 : -1)*.05*Math.sin(a + 2.1 + ph);
    x.save(); x.translate((left ? geo.lx + reach : geo.rx - reach), geo.cy + 6*Math.sin(t*.8 + ph)); x.rotate(rot); x.scale(sc, sc);
    SHAPE[which[pose]](x, geo.S, t); x.restore();
  }
  wall = led(Object.assign({canvas:cv, groups:2, quiet:[$('[data-wquiet]')], feather:80, still:2, hover:110,
    pitch:function(W){ return Math.max(3, W/430); },
    draw:function(x, W, H, t, poses){
      place(W, H);
      /* the link between them: a dotted wire with a few heavier pulses travelling both ways, each with a short tail */
      var x0 = geo.lx + geo.S*.85, x1 = geo.rx - geo.S*.85, y = geo.cy;
      x.fillStyle = '#bdbdbd';
      for(var u=0; u<=1; u+=.025){ x.beginPath(); x.arc(x0 + (x1 - x0)*u, y, 2.6, 0, 6.2832); x.fill(); }
      for(var k=0; k<3; k++){
        var p = (t*.22 + k/3) % 1, q = 1 - ((t*.17 + k/3 + .15) % 1);
        for(var s=0; s<5; s++){
          x.fillStyle = s ? 'rgba(26,26,26,' + (.5 - s*.09) + ')' : '#1a1a1a';
          x.beginPath(); x.arc(x0 + (x1 - x0)*p - s*7, y, 6 - s*.7, 0, 6.2832); x.fill();
          x.fillStyle = s ? 'rgba(90,90,90,' + (.45 - s*.08) + ')' : '#5a5a5a';
          x.beginPath(); x.arc(x0 + (x1 - x0)*q + s*7, y, 5 - s*.6, 0, 6.2832); x.fill();
        }
      }
      side(x, W, H, t, L, poses[0], true);
      side(x, W, H, t, Rr, poses[1], false);
    },
    script:function(t, go){
      var u = t % LOOP;
      go(0, (u >= 4 && u < 14) ? 1 : 0);
      go(1, (u >= 9 && u < 18.2) ? 1 : 0);
      var b = u >= 14 ? 3 : u >= 9 ? 2 : u >= 4 ? 1 : 0;
      if(b !== lastBeat){
        lastBeat = b;
        stepsEl.forEach(function(s, i){
          s.classList.remove('is-on'); void s.offsetWidth;
          if(i === b){ s.style.setProperty('--d', ((BEATS[i + 1] || LOOP) - BEATS[i]) + 's'); s.classList.add('is-on'); }
        });
      }
    },
    after:function(){
      if(!geo.S) return;
      var l = tags[0], r = tags[1], top = geo.cy + geo.S*.72;
      l.textContent = TAGL[wall ? wall.pose(0) : 0]; r.textContent = TAGR[wall ? wall.pose(1) : 0];
      l.style.left = geo.lx + 'px'; r.style.left = geo.rx + 'px'; l.style.top = r.style.top = top + 'px';
    }
  }, HD, {grid:null}));  /* no unlit-LED grid behind this scene */
  stepsEl.forEach(function(s, i){
    s.addEventListener('click', function(){
      wall.time(BEATS[i] + .01);
      if(reduce){ wall.go(0, i === 1 || i === 2 ? 1 : 0); wall.go(1, i >= 2 ? 1 : 0); stepsEl.forEach(function(e, k){ e.classList.toggle('is-on', k === i); }); }
    });
  });
  if(reduce) stepsEl[0].classList.add('is-on');
})();


(function(){
  var list = $('#indList'), text = $('#indText'), flow = $('#indFlow'); if(!list) return;
  var icons = INDUSTRIES.map(function(d){ return iconPath(IND_ICON[d.id]); }), cur = 0, auto = true, timer = 0, panel;
  list.innerHTML = INDUSTRIES.map(function(d, i){
    return '<button class="ind__item" role="tab" data-i="' + i + '"><span class="n">' + String(i + 1).padStart(2, '0') + '</span><b>' + esc(d.name) + '</b><small>' + esc(d.d) + '</small></button>';
  }).join('');
  function render(i){
    var d = INDUSTRIES[i];
    text.innerHTML = '<h3>' + esc(d.h) + '</h3><p>' + esc(d.s) + '</p><ul class="uses">' + d.uses.map(function(u){
      var a = AGENT_BY[u.agent] || AGENT_BY.titan; return '<li><span>' + esc(u.t) + '</span><span><i style="--c:' + a.c + '"></i>' + esc(a.name) + '</span></li>';
    }).join('') + '</ul><a class="ind__more" href="' + ROOT + 'industries/' + d.id + '.html">See ' + esc(d.name.toLowerCase()) + ' in detail <span aria-hidden="true">→</span></a>';
    flow.innerHTML = d.flow.map(function(f){ return '<div><b>' + esc(f[0]) + '</b><span>' + esc(f[1]) + '</span></div>'; }).join('<i>──▶</i>');
    $('#indCorner').textContent = String(i + 1).padStart(2, '0') + ' / ' + String(INDUSTRIES.length).padStart(2, '0');
    $('#indName').textContent = d.id;
  }
  function select(i, user){
    if(user) auto = false;
    cur = i;
    $$('.ind__item', list).forEach(function(b, k){ b.classList.toggle('is-on', k === i); b.setAttribute('aria-selected', k === i); });
    if(panel) panel.go(0, i);
    [text, flow].forEach(function(el){ el.classList.add('is-out'); });
    setTimeout(function(){ render(i); [text, flow].forEach(function(el){ el.classList.remove('is-out'); }); }, reduce ? 0 : 260);
  }
  list.addEventListener('click', function(e){ var b = e.target.closest('.ind__item'); if(b) select(+b.dataset.i, true); });
  panel = led(Object.assign({canvas:$('[data-indled]'), dur:1.3, still:1,
    pitch:function(W){ return Math.max(3, W/210); },
    draw:function(x, W, H, t, poses){
      var m = Math.min(W, H);
      /* a halo of pinpoints and one ring, then the icon in heavy strokes */
      var g = x.createRadialGradient(W/2, H/2, 0, W/2, H/2, m*.48); g.addColorStop(0, '#a6a6a6'); g.addColorStop(.75, '#cfcfcf'); g.addColorStop(1, '#fff');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.strokeStyle = '#8a8a8a'; x.lineWidth = m*.012; x.beginPath(); x.arc(W/2, H/2, m*(.43 + .01*Math.sin(t*.9)), 0, 6.2832); x.stroke();
      var S = m*.56/24*(1 + .03*Math.sin(t*.8));
      x.save(); x.translate(W/2, H/2); x.rotate(.05*Math.sin(t*.45)); x.scale(S, S); x.translate(-12, -12);
      x.strokeStyle = '#0e0e0e'; x.lineWidth = 1.9; x.lineCap = 'round'; x.lineJoin = 'round';
      x.stroke(icons[poses[0]]); x.restore();
    }
  }, HD));
  select(0);
  visible(list, function(on){
    clearInterval(timer);
    if(on && !reduce) timer = setInterval(function(){ if(auto) select((cur + 1) % INDUSTRIES.length); }, 6500);
  });
})();

/* ═════════ closing band: the wordmark on the LED wall, turning into Titan and back ═════════ */
(function(){
  var cv = $('[data-endled]'); if(!cv) return;
  led(Object.assign({canvas:cv, quiet:[$('[data-equiet]')], feather:60, still:1,
    pitch:function(W){ return Math.max(2.6, W/340); },
    draw:function(x, W, H, t, poses){
      var cy = H*.36;
      if(poses[0] === 0){
        var fs = Math.min(H*.36, W*.15);
        x.font = '600 ' + fs + 'px Unbounded, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        var w = x.measureText('TITAN117').width; if(w > W*.88){ fs *= W*.88/w; x.font = '600 ' + fs + 'px Unbounded, system-ui, sans-serif'; }
        x.fillStyle = lin(x, 0, cy - fs/2, 0, cy + fs/2, '#0e0e0e', '#5a5a5a');
        x.fillText('TITAN117', W/2 + 4*Math.sin(t*.6), cy);
      } else {
        x.save(); x.translate(W/2, cy); SHAPE.titan(x, Math.min(H*.5, W*.3), t); x.restore();
      }
    },
    script:function(t, go){ go(0, Math.floor(t/6) % 2); }
  }, HD));
})();

/* ═════════ hero: the agent terrain (kept from the old mockups) ═════════
   A wireframe landscape in perspective with one peak per specialist agent, each a cloud of particles
   in the agent's colour under a label, and a line from every summit into the valley under Titan, with
   pulses both ways. In the valley the agents' work gathers: a dense cloud spiralling slowly inward.
   The cursor lights the nearest agent; clicking Titan sends a pulse out along every line. */
function terrain(o){
  var cv = o.canvas, host = o.host, anchor = o.anchor; if(!cv || !host) return;
  var ctx = cv.getContext('2d');
  var AG = GRID_AGENTS.slice(1).map(function(k){ return AGENT_BY[k]; });
  var SPOT = [[-13,6,7,2.4],[-7,13,8.4,2.6],[5,14,9,2.8],[12,7,6.8,2.4],[-20,1,5.4,2.2],[16,-1,5.6,2.2],[-8.5,-3.5,4,1.8],[7.5,-4,3.6,1.7],[-1,21,7.4,3]];
  var P = AG.slice(0, SPOT.length).map(function(a, i){
    var c = a.c, rgb = [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)];
    return {name:a.name, rgb:rgb, x:SPOT[i][0], z:SPOT[i][1], h:SPOT[i][2], s:SPOT[i][3], hb:SPOT[i][2], f:0, sx:0, sy:0};
  });
  var GREEN = [128,184,0], CORE = [104,160,0], VALLEY = [20,20,20], GRID = '20,20,20', INK = '20,20,20';
  var W, H, dpr, F, CAM = 9, ZV = 10, Z0 = 14, cx, hy, quiet = [], dots = [], crowd = [], ptr = null, theta = 0, tilt = 0, surge = -1e9, t0 = performance.now(), vis = true;
  function rnd(seed){ var x = Math.sin(seed*127.1)*43758.5453; return x - Math.floor(x); }
  function height(x, z){
    var y = -0.8*Math.exp(-(x*x + z*z)/(2*2.2*2.2));
    for(var i=0; i<P.length; i++){ var p = P[i], dx = x - p.x, dz = z - p.z; y += p.h*Math.exp(-(dx*dx + dz*dz)/(2*p.s*p.s)); }
    return y;
  }
  var out = {x:0, y:0, d:0, g:0};
  /* ── hover fx (trial, 1 Nov 2026: delete each "hover fx" block to revert) ──
     lens: the land bulges away from the cursor and lights up under it; ripples: a click sends a ring
     through the land; motes: faint particles drift in the empty sky and reach for the cursor */
  var FX = !reduce, lens = 0, lp = {x:-1e4, y:-1e4}, ripples = [], motes = [], LR = 150;
  function warp(){
    out.g = 0;
    if(lens > .01){
      var dx = out.x - lp.x, dy = out.y - lp.y, d2 = dx*dx + dy*dy;
      if(d2 < LR*LR*6){ var d = Math.sqrt(d2) || 1, e = Math.exp(-d2/(LR*LR)); out.g = lens*e; out.x += dx/d*lens*40*e; out.y += dy/d*lens*40*e; }
    }
    for(var i=0; i<ripples.length; i++){
      var rp = ripples[i], dx = out.x - rp.x, dy = out.y - rp.y, d = Math.sqrt(dx*dx + dy*dy) || 1, w = (d - rp.r)/34, e = Math.exp(-w*w)*rp.k;
      if(e > .01){ out.y -= 9*e; out.g = Math.max(out.g, e*.8); }
    }
  }
  /* ── end hover fx ── */
  function proj(x, y, z){
    var c = Math.cos(theta), s = Math.sin(theta), xr = x*c - z*s, zr = x*s + z*c, d = zr + ZV + Z0;
    if(d < 1.2) return false;
    out.x = cx + xr*F/d; out.y = hy + (CAM - y + tilt)*F/d; out.d = d; if(FX) warp(); return true;
  }
  /* no fade behind the copy (1 Nov 2026): the land runs under the text at full strength; the copy
     boxes (quiet) only keep the agent labels off the text */
  function calm(){ return 1; }
  function size(){
    var f = fit(cv, host); W = f.W; H = f.H; dpr = f.dpr;
    F = Math.max(260, Math.min(H*0.95, W*0.62));
    var ax = W*0.5, ay = H*0.72;
    if(anchor){ var b = anchor.getBoundingClientRect(); if(b.width){ ax = b.left - f.r.left + b.width/2; ay = b.top - f.r.top + b.height*0.9; } }
    cx = ax; hy = ay - (CAM + 0.8)*F/(ZV + Z0);
    quiet = (o.quiet || []).map(function(el){ var c = el.getBoundingClientRect(); return {x0:c.left - f.r.left - 20, x1:c.right - f.r.left + 20, y0:c.top - f.r.top - 20, y1:c.bottom - f.r.top + 20}; });
    dots = []; var k = 1;
    P.forEach(function(p, i){
      for(var j=0; j<380; j++, k++){
        var r = p.s*Math.min(3, Math.sqrt(-2*Math.log(1e-4 + rnd(k)*0.9999)))*0.8, a = rnd(k + 0.5)*Math.PI*2;
        dots.push({p:i, x:p.x + Math.cos(a)*r, z:p.z + Math.sin(a)*r, lift:Math.abs(rnd(k + 0.25) - 0.5)*0.5, top:Math.exp(-r*r/(p.s*p.s)), tw:rnd(k + 0.75)*6.28});
      }
    });
    for(var j=0; j<420; j++, k++) dots.push({p:-1, x:(rnd(k) - 0.5)*60, z:rnd(k + 0.5)*34 - 8, lift:0.05, top:0, tw:rnd(k + 0.75)*6.28});
    crowd = [];
    for(var j=0; j<1100; j++, k++){
      var u = rnd(k), r = Math.min(7, 2.6*Math.sqrt(-2*Math.log(1e-4 + rnd(k + 0.5)*0.9999)));
      crowd.push({r:r, a:rnd(k + 0.25)*6.2832, ph:u, lift:Math.abs(rnd(k + 0.75) - 0.5)*0.6, c:rnd(k + 0.33) < 0.16 ? Math.floor(rnd(k + 0.66)*P.length) : -1, tw:rnd(k + 0.9)*6.28});
    }
    /* hover fx: motes, about one per 9000 px² of sky */
    motes = [];
    for(var j=0, n=Math.round(W*H*.75/9000); j<n; j++, k++)
      motes.push({x:rnd(k)*W, y:rnd(k + .3)*H*.8, v:6 + rnd(k + .6)*14, s:1.2 + rnd(k + .8)*1.8, c:rnd(k + .9) < .45 ? Math.floor(rnd(k + .15)*P.length) : -1, ph:rnd(k + .45)*6.28});
  }
  /* hover fx: a click on the land (not on a button or link) sends a ring out and a pulse down every line */
  host.addEventListener('click', function(e){
    if(!FX || e.target.closest('a, button')) return;
    var r = host.getBoundingClientRect(); ripples.push({x:e.clientX - r.left, y:e.clientY - r.top, t:performance.now(), r:0, k:1});
    if(ripples.length > 3) ripples.shift(); surge = performance.now();
  });
  host.addEventListener('pointermove', function(e){ var r = host.getBoundingClientRect(); ptr = {x:e.clientX - r.left, y:e.clientY - r.top}; });
  host.addEventListener('pointerleave', function(){ ptr = null; });
  document.addEventListener('titan:surge', function(){ surge = performance.now(); });
  visible(host, function(on){ vis = on; });
  function grid(){
    var B = 6, paths = []; for(var b=0; b<B; b++) paths.push(new Path2D());
    function line(ax, az, bx, bz, n){
      var prev = false, px = 0, py = 0;
      for(var i=0; i<=n; i++){
        var x = ax + (bx - ax)*i/n, z = az + (bz - az)*i/n;
        if(!proj(x, height(x, z), z)){ prev = false; continue; }
        var a = Math.max(0, 1 - (out.d - 14)/38)*Math.min(1, Math.abs(x)/34 < 0.75 ? 1 : (1 - Math.abs(x)/34)*4)*calm(out.x, out.y);
        a = Math.min(1, a + out.g*3); /* hover fx: the wireframe lights up under the cursor */
        var bi = Math.min(B - 1, Math.floor(a*B));
        if(prev && a > 0.02){ paths[bi].moveTo(px, py); paths[bi].lineTo(out.x, out.y); }
        prev = true; px = out.x; py = out.y;
      }
    }
    for(var x=-34; x<=34.01; x+=1.6) line(x, -15, x, 27, 70);
    for(var z=-15; z<=27.01; z+=1.6) line(-34, z, 34, z, 90);
    ctx.lineWidth = 1;
    for(var b=1; b<B; b++){ ctx.strokeStyle = 'rgba('+GRID+','+(0.11*(b + 0.5)/B).toFixed(3)+')'; ctx.stroke(paths[b]); }
  }
  function curve(p, i){
    var mx = p.x/2 + (i % 2 ? 1 : -1)*p.z*0.18, mz = p.z/2 - (i % 2 ? 1 : -1)*p.x*0.18, pts = [];
    for(var j=0; j<=36; j++){
      var u = j/36, x = (1-u)*(1-u)*p.x + 2*(1-u)*u*mx, z = (1-u)*(1-u)*p.z + 2*(1-u)*u*mz;
      if(proj(x, height(x, z) + 0.06, z)) pts.push([out.x, out.y]);
    }
    return pts;
  }
  function at(pts, u){ var k = Math.min(pts.length - 1, Math.max(0, u*(pts.length - 1))), i = Math.floor(k), f = k - i, b = pts[Math.min(pts.length - 1, i + 1)]; return [pts[i][0] + (b[0] - pts[i][0])*f, pts[i][1] + (b[1] - pts[i][1])*f]; }
  function draw(now){
    var t = reduce ? 6 : (now - t0)/1000;
    theta += ((ptr && !reduce ? (ptr.x/W - 0.5)*0.22 : 0) + (reduce ? 0 : 0.1*Math.sin(t*0.07)) - theta)*0.04;
    tilt += ((ptr && !reduce ? (ptr.y/H - 0.5)*0.8 : 0) - tilt)*0.04;
    P.forEach(function(p, i){ p.h = p.hb*(1 + (reduce ? 0 : 0.07*Math.sin(t*0.45 + i*1.7))); });
    /* hover fx: ease the lens toward the cursor, age the ripples */
    if(FX){
      lens += ((ptr ? 1 : 0) - lens)*0.06;
      if(ptr){ if(lp.x < -1e3){ lp.x = ptr.x; lp.y = ptr.y; } lp.x += (ptr.x - lp.x)*0.14; lp.y += (ptr.y - lp.y)*0.14; }
      ripples = ripples.filter(function(rp){ var a = (now - rp.t)/1000; rp.r = a*520; rp.k = Math.max(0, 1 - a/1.6); return rp.k > 0; });
    }
    ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,cv.width,cv.height);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    grid();
    /* hover fx: motes drifting up through the sky; near the cursor they brighten and draw a thread to it */
    if(FX){
      var MR = 170;
      for(var j=0; j<motes.length; j++){
        var m = motes[j], my = ((m.y - t*m.v) % (H*.8) + H*.8) % (H*.8), mx = m.x + 10*Math.sin(t*.3 + m.ph);
        var edge = Math.min(1, my/(H*.12), (H*.8 - my)/(H*.12)), rgb = m.c >= 0 ? P[m.c].rgb : INK;
        var dd = ptr ? Math.hypot(mx - lp.x, my - lp.y) : 1e4, near = dd < MR ? 1 - dd/MR : 0;
        var al = (0.3 + 0.12*Math.sin(t*1.3 + m.ph) + 0.55*near*lens)*edge;
        if(near > 0 && lens > .05){
          ctx.strokeStyle = 'rgba('+rgb+','+(0.4*near*lens*edge).toFixed(3)+')'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(lp.x, lp.y); ctx.stroke();
        }
        ctx.fillStyle = 'rgba('+rgb+','+Math.max(0, al).toFixed(3)+')';
        var sz = m.s*(1 + near*lens*.8); ctx.fillRect(mx - sz/2, my - sz/2, sz, sz);
      }
      if(lens > .05){
        /* a soft spotlight and a thin ring that breathes around the cursor */
        var sg = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, LR*1.2); sg.addColorStop(0, 'rgba(196,240,18,'+(0.1*lens).toFixed(3)+')'); sg.addColorStop(1, 'rgba(196,240,18,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(lp.x, lp.y, LR*1.2, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba('+INK+','+(0.14*lens).toFixed(3)+')'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
        ctx.beginPath(); ctx.arc(lp.x, lp.y, LR*(0.62 + 0.04*Math.sin(t*2)), 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba('+INK+','+(0.6*lens).toFixed(3)+')'; ctx.beginPath(); ctx.arc(lp.x, lp.y, 2.4, 0, 6.2832); ctx.fill();
      }
    }
    var near = -1, best = 150;
    P.forEach(function(p, i){
      if(proj(p.x, height(p.x, p.z), p.z)){ p.sx = out.x; p.sy = out.y; p.d = out.d; } else p.d = 0;
      if(ptr && p.d){ var dd = Math.hypot(ptr.x - p.sx, ptr.y - p.sy); if(dd < best){ best = dd; near = i; } }
    });
    P.forEach(function(p, i){ p.f += ((i === near ? 1 : 0) - p.f)*0.1; });
    proj(0, height(0, 0), 0); var vx = out.x, vy = out.y;
    var se = (now - surge)/1000;
    P.forEach(function(p, i){
      if(!p.d) return;
      var pts = curve(p, i); if(pts.length < 2) return;
      var q = calm(p.sx, p.sy), g = ctx.createLinearGradient(p.sx, p.sy, vx, vy), al = (0.32 + 0.55*p.f)*q;
      g.addColorStop(0, 'rgba('+p.rgb+','+al.toFixed(3)+')'); g.addColorStop(1, 'rgba('+VALLEY+','+(al*0.8).toFixed(3)+')');
      ctx.strokeStyle = g; ctx.lineWidth = 1 + p.f*0.6; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for(var j=1; j<pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.stroke();
      if(reduce) return;
      var pulses = [(t*0.11 + i*0.37) % 1, 1 - ((t*0.09 + i*0.53) % 1)];
      if(se >= 0 && se < 1.6) pulses.push(1 - Math.min(1, se/1.1));
      pulses.forEach(function(u, k){
        var c = at(pts, u), hot = k === 2, r = hot ? 3.2 : 2;
        ctx.fillStyle = 'rgba('+(hot ? '120,170,0' : p.rgb)+','+((hot ? 0.95 : 0.75)*q).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 6.2832); ctx.fill();
        ctx.fillStyle = 'rgba('+(hot ? '196,240,18' : p.rgb)+','+(0.16*q).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(c[0], c[1], r*3, 0, 6.2832); ctx.fill();
      });
    });
    var buckets = {}, swell = se >= 0 && se < 2.5 ? 1 + 0.7*Math.exp(-se*2.2)*Math.min(1, se*8) : 1;
    for(var j=0; j<crowd.length; j++){
      var c = crowd[j], u = reduce ? c.ph : (t*0.035 + c.ph) % 1, rr = c.r*(1.7 - 1.3*u)*swell, ang = c.a + (reduce ? 0 : t*0.12/(0.6 + rr));
      var x = Math.cos(ang)*rr, z = Math.sin(ang)*rr*0.8;
      if(!proj(x, height(x, z) + c.lift*(0.4 + rr*0.15), z)) continue;
      var core = Math.exp(-rr*rr/2.4), fade = Math.min(1, u/0.12)*Math.min(1, (7.5 - rr)/2), tw = reduce ? 1 : 0.7 + 0.3*Math.sin(t*2.2 + c.tw);
      var a = (0.26 + 0.48*core)*fade*tw*calm(out.x, out.y);
      if(a < 0.04) continue;
      var key = (c.c >= 0 ? c.c : core > 0.55 ? 'k' : 'g') + ':' + Math.min(4, Math.floor(a*5)), sz = Math.min(2.6, Math.max(0.9, (1 + 1.2*core)*F/out.d*0.042));
      (buckets[key] = buckets[key] || []).push(out.x - sz/2, out.y - sz/2, sz);
    }
    for(var j=0; j<dots.length; j++){
      var d = dots[j], p = d.p >= 0 ? P[d.p] : null;
      if(!proj(d.x, height(d.x, d.z) + d.lift, d.z)) continue;
      var fog = Math.max(0, 1 - (out.d - 14)/38), tw = reduce ? 1 : 0.75 + 0.25*Math.sin(t*1.6 + d.tw);
      var a = (p ? (0.42 + 0.58*d.top + 0.3*p.f) : 0.24)*fog*tw*calm(out.x, out.y) + out.g*0.7; /* hover fx: + out.g */
      if(a < 0.03) continue;
      var key = (p ? d.p : 'x') + ':' + Math.min(4, Math.floor(a*5)), sz = Math.min(3.4, Math.max(0.9, (p ? 1 + 1.3*d.top : 0.7)*F/out.d*0.045)*(1 + out.g*0.7));
      (buckets[key] = buckets[key] || []).push(out.x - sz/2, out.y - sz/2, sz);
    }
    Object.keys(buckets).forEach(function(key){
      var parts = key.split(':'), id = parts[0], list = buckets[key];
      var rgb = id === 'x' ? INK : id === 'g' ? GREEN : id === 'k' ? CORE : P[+id].rgb;
      ctx.fillStyle = 'rgba('+rgb+','+((+parts[1] + 0.5)/5).toFixed(3)+')';
      for(var q=0; q<list.length; q+=3) ctx.fillRect(list[q], list[q+1], list[q+2], list[q+2]);
    });
    if(W < 700) return;
    ctx.font = '500 11px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    P.forEach(function(p){
      if(!p.d) return;
      var q = calm(p.sx, p.sy - 22); if(q < 0.6) return;
      var w = ctx.measureText(p.name).width + 14, x = p.sx, y = p.sy - 22 - p.f*4;
      if(quiet.some(function(r){ return x + w/2 > r.x0 && x - w/2 < r.x1 && y + 10 > r.y0 && y - 10 < r.y1; })) return;
      ctx.globalAlpha = Math.min(1, (q - 0.6)/0.3)*(0.8 + 0.2*p.f);
      ctx.fillStyle = p.f > 0.5 ? '#141414' : 'rgba(255,255,255,.94)';
      ctx.fillRect(x - w/2, y - 10, w, 20);
      if(p.f <= 0.5){ ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1; ctx.strokeRect(x - w/2 + 0.5, y - 9.5, w - 1, 19); }
      ctx.fillStyle = p.f > 0.5 ? '#fff' : '#3a3a3c';
      ctx.fillText(p.name, x, y + 0.5);
      ctx.globalAlpha = 1;
    });
  }
  function loop(now){ requestAnimationFrame(loop); if(vis) draw(now); }
  size();
  onResize(function(){ size(); if(reduce) draw(performance.now()); }, host);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ size(); if(reduce) draw(performance.now()); });
  if(reduce) draw(performance.now()); else requestAnimationFrame(loop);
}
terrain({canvas:$('[data-terrain]'), host:$('.hero__top'), anchor:$('#titan'), quiet:$$('#hero [data-quiet]')});

/* ── hover fx (trial): from the foot of the hero's land down to the Agents band, motes in the agents' colours
   drift upward and reach for the cursor with fine threads, under a faint neon spotlight. Delete to revert. ── */
(function(){
  var cv = $('.fxfield'), from = $('.hero__top'), to = $('#agents'); if(!cv || !from || !to || reduce) return;
  var ctx = cv.getContext('2d'), W, H, dpr, top, motes = [], ptr = null, lp = {x:0, y:0}, lens = 0, vis = false, t0 = performance.now();
  var COL = GRID_AGENTS.slice(1).map(function(k){ return AGENT_BY[k]; }).map(function(a){ return [parseInt(a.c.slice(1,3),16), parseInt(a.c.slice(3,5),16), parseInt(a.c.slice(5,7),16)].join(','); });
  function rnd(k){ var x = Math.sin(k*91.7)*43758.5453; return x - Math.floor(x); }
  function size(){
    top = from.getBoundingClientRect().bottom + scrollY;
    var bottom = to.getBoundingClientRect().top + scrollY;
    W = document.documentElement.clientWidth; H = Math.max(1, bottom - top); dpr = Math.min(2, devicePixelRatio || 1);
    cv.style.top = top + 'px'; cv.style.height = H + 'px';
    cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
    motes = [];
    for(var k=1, n=Math.round(W*H/11000); k<=n; k++)
      motes.push({x:rnd(k)*W, y:rnd(k + .3)*H, v:5 + rnd(k + .6)*12, s:1.2 + rnd(k + .8)*1.8, c:rnd(k + .9) < .45 ? Math.floor(rnd(k + .15)*COL.length) : -1, ph:rnd(k + .45)*6.28});
  }
  addEventListener('pointermove', function(e){
    var y = e.clientY + scrollY - top;
    ptr = (y >= 0 && y <= H) ? {x:e.clientX, y:y} : null;
    if(ptr && lens < .01){ lp.x = ptr.x; lp.y = ptr.y; }
  });
  document.addEventListener('pointerleave', function(){ ptr = null; });
  function draw(now){
    var t = (now - t0)/1000, LR = 150, MR = 170;
    lens += ((ptr ? 1 : 0) - lens)*.06;
    if(ptr){ lp.x += (ptr.x - lp.x)*.14; lp.y += (ptr.y - lp.y)*.14; }
    ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(dpr,0,0,dpr,0,0);
    if(lens > .05){
      var sg = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, LR*1.2); sg.addColorStop(0, 'rgba(196,240,18,'+(0.1*lens).toFixed(3)+')'); sg.addColorStop(1, 'rgba(196,240,18,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(lp.x, lp.y, LR*1.2, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(20,20,20,'+(0.14*lens).toFixed(3)+')'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.arc(lp.x, lp.y, LR*(0.62 + 0.04*Math.sin(t*2)), 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
    }
    for(var j=0; j<motes.length; j++){
      var m = motes[j], my = ((m.y - t*m.v) % H + H) % H, mx = m.x + 10*Math.sin(t*.3 + m.ph), rgb = m.c >= 0 ? COL[m.c] : '20,20,20';
      var edge = Math.min(1, my/120, (H - my)/120), dd = ptr ? Math.hypot(mx - lp.x, my - lp.y) : 1e4, near = dd < MR ? 1 - dd/MR : 0;
      if(near > 0 && lens > .05){ ctx.strokeStyle = 'rgba('+rgb+','+(0.4*near*lens*edge).toFixed(3)+')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(lp.x, lp.y); ctx.stroke(); }
      ctx.fillStyle = 'rgba('+rgb+','+Math.max(0, (0.24 + 0.1*Math.sin(t*1.3 + m.ph) + 0.55*near*lens)*edge).toFixed(3)+')';
      var sz = m.s*(1 + near*lens*.8); ctx.fillRect(mx - sz/2, my - sz/2, sz, sz);
    }
    if(lens > .05){ ctx.fillStyle = 'rgba(20,20,20,'+(0.6*lens).toFixed(3)+')'; ctx.beginPath(); ctx.arc(lp.x, lp.y, 2.4, 0, 6.2832); ctx.fill(); }
  }
  function loop(now){ requestAnimationFrame(loop); if(vis) draw(now); }
  size();
  onResize(size, document.body);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(size);
  visible(cv, function(on){ vis = on; });
  requestAnimationFrame(loop);
})();
/* ── end hover fx ── */

/* Titan's eyes on the logos, from the old mockups' bot engine (assets/bot.js): ink and still, neon on hover */
(function(){
  if(!window.TitanBot) return;
  $$('svg[data-bot]').forEach(function(svg){
    var ink = svg.dataset.ink || '#141414';
    var bot = TitanBot.mount(svg, {expression:'colere', color:ink, follow:false, still:true});
    var host = svg.closest('a') || svg;
    var on = function(){ bot.setColor(null); }, off = function(){ bot.setColor(ink); };
    host.addEventListener('mouseenter', on); host.addEventListener('mouseleave', off);
    host.addEventListener('focusin', on); host.addEventListener('focusout', off);
  });
})();

/* ═════════ agents: a live ASCII field behind the cards, lit by a lantern under the cursor ═════════ */
(function(){
  var cv = $('[data-ascii]'); if(!cv) return;
  var host = cv.parentNode, ctx = cv.getContext('2d'), CH = ' .·:-=+*#%@', W, H, dpr, cw = 10, chh = 16, cols, rows, ptr = null, lamp = {x:-999, y:-999}, vis = true, frame = 0, t0 = performance.now();
  function size(){ var f = fit(cv, host); W = f.W; H = f.H; dpr = f.dpr; cols = Math.ceil(W/cw); rows = Math.ceil(H/chh); }
  host.addEventListener('pointermove', function(e){ var r = host.getBoundingClientRect(); ptr = {x:e.clientX - r.left, y:e.clientY - r.top}; });
  host.addEventListener('pointerleave', function(){ ptr = null; });
  visible(host, function(on){ vis = on; });
  function draw(now){
    var t = reduce ? 4 : (now - t0)/1000;
    if(ptr){ lamp.x += (ptr.x - lamp.x)*.12; lamp.y += (ptr.y - lamp.y)*.12; }
    ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '400 12px "Geist Mono", ui-monospace, monospace'; ctx.textBaseline = 'top';
    var B = [[], [], [], [], []];
    for(var j=0; j<rows; j++) for(var i=0; i<cols; i++){
      var x = i*cw, y = j*chh;
      /* two warped waves drifting against each other, as in caustics */
      var a = Math.sin(i*.09 + t*.5 + Math.sin(j*.21 - t*.3)*1.6), b = Math.cos(j*.17 - t*.4 + Math.sin(i*.05 + t*.2)*2);
      var v = Math.pow(Math.max(0, 1 - Math.abs(a + b)*.9), 3);
      var dx = x - lamp.x, dy = y - lamp.y, l = ptr ? Math.exp(-(dx*dx + dy*dy)/(2*150*150)) : 0;
      v = Math.min(1, v*.55 + l*.65*(.3 + v));
      if(v < .08) continue;
      var c = CH[Math.min(CH.length - 1, Math.floor(v*CH.length))], bi = Math.min(4, Math.floor(v*5));
      B[bi].push(c, x, y);
    }
    for(var k=0; k<5; k++){
      ctx.fillStyle = 'rgba(232,232,234,' + (.05 + k*.06).toFixed(3) + ')';
      var L = B[k]; for(var q=0; q<L.length; q+=3) ctx.fillText(L[q], L[q+1], L[q+2]);
    }
  }
  function loop(now){ requestAnimationFrame(loop); if(vis && ((frame++ & 1) === 0 || ptr)) draw(now); }
  size(); onResize(function(){ size(); if(reduce) draw(performance.now()); }, host);
  if(reduce) draw(performance.now()); else requestAnimationFrame(loop);
})();

/* ═════════ card icons: a small LED panel per card (agents, local-first, security, the agents page) ═════════
   The icon in dots (the agent's colour on the dark cards, ink on the light ones) with a dotted wire and a
   pulse running out to the right. It dissolves in when the card comes into view and lights up under the cursor. */
(function(){
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ io.unobserve(e.target); e.target._show(); } });
  }, {threshold:.6}) : null;
  $$('[data-led]').forEach(function(box, n){
    var id = box.dataset.led, dark = !!box.closest('.acard, .band--dark, .is-dark'), card = box.closest('.acard');
    var ink = box.dataset.ink || (card ? getComputedStyle(card).getPropertyValue('--c').trim() : '#0d0d0d');
    var src = LED_ICON[id] || IND_ICON[id], icon = src ? iconPath(src) : null, off = hash(n, 3);
    var api = led(Object.assign({canvas:$('canvas', box), host:box, start:[0], dur:1.1, ink:ink, hover:36,
      pitch:function(){ return 2.4; },
      draw:function(x, W, H, t, poses){
        if(!poses[0]) return;
        /* an activity meter: thin bars that rise and fall, fading out to the right, with a brighter sweep */
        var m = H*.86, ix = m/2 + 2, cy = H/2, x0 = ix + m*.75, x1 = W - 4, sw = x0 + ((t*.14 + off) % 1)*(x1 - x0 + 80) - 40;
        for(var k=0, bx=x0; bx<x1; k++, bx+=6){
          var u = (bx - x0)/(x1 - x0), env = Math.pow(1 - u, .7), hot = Math.exp(-Math.pow((bx - sw)/26, 2));
          var h = H*(.08 + .34*env*(.5 + .5*Math.sin(t*1.6 + k*.55 + off*9))*(.6 + .4*Math.sin(t*.7 + k*.21)) + .18*hot);
          var g = Math.round(150 - 70*env - 100*hot); x.fillStyle = 'rgb('+g+','+g+','+g+')';
          x.fillRect(bx, cy - h/2, 2.6, h);
        }
        x.save(); x.translate(ix, cy);
        if(id === 'titan') SHAPE.titan(x, m*1.05, t);
        else if(icon){
          var S = m/24*(1 + .03*Math.sin(t*1.1 + off*6)); x.scale(S, S); x.translate(-12, -12);
          x.strokeStyle = '#0e0e0e'; x.lineWidth = 2.1; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke(icon);
        }
        x.restore();
      }
    }, HD, {rowGap:1, grid:dark ? '#2a2a2e' : '#e2e2de'}));
    box._show = function(){ setTimeout(function(){ api.go(0, 1); }, 120 + (n % 3)*120); };
    if(reduce || !io) api.go(0, 1); else io.observe(box);
  });
})();

/* ═════════ glyph scramble, reveals and the nav ═════════ */
var NOISE = '▖▗▘▙▚▛▜▝▞▟░▒▓/\\<>_-=+*#';
function scramble(el, final, dur){
  if(reduce){ el.textContent = final; return; }
  var t0 = performance.now();
  (function stepF(now){
    var u = Math.min(1, (now - t0)/dur), n = Math.floor(u*final.length), s = '';
    for(var i=0; i<final.length; i++){ var ch = final[i]; s += (i < n || ch === ' ' || ch === '\n') ? ch : NOISE[(Math.random()*NOISE.length) | 0]; }
    el.textContent = s;
    if(u < 1) requestAnimationFrame(stepF);
  })(t0);
}
(function(){
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(!e.isIntersecting) return;
      var el = e.target; io.unobserve(el);
      el.classList.add('is-in');
      if(el.dataset.scramble != null) scramble(el, el.dataset.final, 700);
      $$('[data-glyph]', el).concat(el.dataset.glyph != null ? [el] : []).forEach(function(g){ scramble(g, g.dataset.glyph, 900); });
    });
  }, {threshold:.15}) : null;
  $$('[data-scramble]').forEach(function(el){ el.dataset.final = el.textContent; });
  $$('.rv, [data-scramble]').forEach(function(el){ if(io) io.observe(el); else { el.classList.add('is-in'); } });
  if(!io) $$('[data-glyph]').forEach(function(g){ g.textContent = g.dataset.glyph; });
  /* glyphs inside elements that are not .rv (none today) still get their text */
  $$('[data-glyph]').forEach(function(g){ if(!g.closest('.rv')) scramble(g, g.dataset.glyph, 900); });
  var nav = $('#nav'), onS = function(){ nav.classList.toggle('is-scrolled', scrollY > 24); };
  addEventListener('scroll', onS, {passive:true}); onS();
})();




/* ═════════ nav: the Industries dropdown and the phone menu ═════════ */
(function(){
  var nav = $('#nav'); if(!nav) return;
  var dd = $('.dd', nav), btn = dd && $('.dd__btn', dd), burger = $('.burger', nav), sheet = $('#sheet');
  if(dd){
    var t = 0;
    function open(on){ dd.classList.toggle('is-open', on); btn.setAttribute('aria-expanded', on); }
    dd.addEventListener('mouseenter', function(){ clearTimeout(t); open(true); });
    dd.addEventListener('mouseleave', function(){ t = setTimeout(function(){ open(false); }, 160); });
    btn.addEventListener('click', function(){ open(!dd.classList.contains('is-open')); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') open(false); });
    document.addEventListener('click', function(e){ if(!dd.contains(e.target)) open(false); });
  }
  if(burger && sheet){
    burger.addEventListener('click', function(){
      var on = !nav.classList.contains('is-menu');
      nav.classList.toggle('is-menu', on); burger.setAttribute('aria-expanded', on);
      burger.setAttribute('aria-label', on ? 'Close the menu' : 'Open the menu');
      document.documentElement.style.overflow = on ? 'hidden' : '';
    });
    $$('a', sheet).forEach(function(a){ a.addEventListener('click', function(){ nav.classList.remove('is-menu'); document.documentElement.style.overflow = ''; }); });
  }
})();

/* ═════════ page heads: a square LED panel that cycles through icons ═════════
   data-ledscene lists icon ids (industry icons, LED icons, or "titan" for the eyes). Each pose sits on a halo of
   pinpoints and one ring, like the home page's industries panel, and dissolves into the next every 4 s. */
(function(){
  $$('[data-ledscene]').forEach(function(cv){
    var ids = cv.dataset.ledscene.split(','), host = cv.parentNode, dark = !!cv.dataset.dark;
    var paths = ids.map(function(id){ var s = IND_ICON[id] || LED_ICON[id]; return s ? iconPath(s) : null; });
    var nEl = $('[data-scene-n]', host), nameEl = $('[data-scene-name]', host);
    var api = led(Object.assign({canvas:cv, host:host, dur:1.3, still:1, hover:70, ink:dark ? '#e8e8ea' : '#0d0d0d',
      pitch:function(W){ return Math.max(3, W/200); },
      draw:function(x, W, H, t, poses){
        var m = Math.min(W, H);
        var g = x.createRadialGradient(W/2, H/2, 0, W/2, H/2, m*.48); g.addColorStop(0, '#a6a6a6'); g.addColorStop(.75, '#cfcfcf'); g.addColorStop(1, '#fff');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.strokeStyle = '#8a8a8a'; x.lineWidth = m*.012; x.beginPath(); x.arc(W/2, H/2, m*(.43 + .01*Math.sin(t*.9)), 0, 6.2832); x.stroke();
        var k = poses[0], id = ids[k];
        x.save(); x.translate(W/2, H/2); x.rotate(.05*Math.sin(t*.45));
        if(id === 'titan') SHAPE.titan(x, m*.5, t);
        else if(paths[k]){
          var S = m*.54/24*(1 + .03*Math.sin(t*.8)); x.scale(S, S); x.translate(-12, -12);
          x.strokeStyle = '#0e0e0e'; x.lineWidth = 1.9; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke(paths[k]);
        }
        x.restore();
      },
      script:function(t, go){
        if(ids.length < 2) return;
        var k = Math.floor(t/4) % ids.length; go(0, k);
        if(nEl) nEl.textContent = String(k + 1).padStart(2, '0') + ' / ' + String(ids.length).padStart(2, '0');
        if(nameEl){ var a = AGENT_BY[ids[k]], d = INDUSTRIES.filter(function(z){ return z.id === ids[k]; })[0]; if(a || d) nameEl.textContent = (a ? a.name : d.id).toLowerCase(); }
      }
    }, HD, dark ? {grid:'#2a2a2e'} : {}));
  });
})();

/* ═════════ live demos ═════════
   [data-demo] holds one of: an agent id (the agents page, from AGENT_DEMO) or "ind:<industry>:<use>" (an industry
   page). A task runs its steps, stops at an approval you can allow or deny, then shows the result. */
function fmtText(s){
  return esc(s).replace(/\{del:(.*?)\}/g, '<del>$1</del>').replace(/\{ins:(.*?)\}/g, '<ins>$1</ins>').replace(/\[([^\]]+)\]/g, '<span class="cite">$1</span>');
}
function agentChip(a){ return '<span class="chipag" style="--c:' + a.c + '"><i></i>' + esc(a.name) + '</span>'; }
function resultHtml(m){
  var body = m.rows ? '<table class="rtbl"><tbody>' + m.rows.map(function(r){
      return '<tr>' + r.map(function(c, i){ return '<td' + (c === '✓' ? ' class="ok"' : (i === r.length - 1 && r.length > 2 ? ' class="end"' : '')) + '>' + esc(c) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table>' : '<p class="rtext">' + fmtText(m.text) + '</p>';
  return '<div class="mock__res"><span class="mock__rt">' + esc(m.rt) + '</span>' + body + '</div>';
}
function runTask(el, m, agent){
  var tok = (el._tok || 0) + 1; el._tok = tok;
  var a = AGENT_BY[agent] || AGENT_BY.titan, phone = el.dataset.kind === 'phone';
  el.innerHTML = '<div class="mock' + (phone ? ' mock--phone' : '') + '">' +
    '<div class="mock__bar">' + agentChip(a) + '<span class="mock__model">' + esc(m.model) + '</span></div>' +
    '<div class="mock__prompt"><span class="mono">You</span>' + esc(m.p) + '</div>' +
    '<ol class="mock__steps">' + m.steps.map(function(s){ return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
    '<div class="mock__ask" hidden><div><span class="mono">Needs your approval</span><b>' + esc(m.ask[0]) + '</b><small>' + esc(m.ask[1]) + '</small></div>' +
      '<div class="mock__btns"><button type="button" class="mbtn" data-act="deny">Deny</button><button type="button" class="mbtn mbtn--yes" data-act="allow">Allow</button></div></div>' +
    '<div class="mock__out" aria-live="polite"></div>' +
    '<button type="button" class="mock__again" hidden>Run again</button></div>';
  var lis = $$('.mock__steps li', el), ask = $('.mock__ask', el), out = $('.mock__out', el), again = $('.mock__again', el);
  function later(fn, ms){ setTimeout(function(){ if(el._tok === tok) fn(); }, reduce ? 0 : ms); }
  function step(i){
    if(i > 0) lis[i - 1].className = 'is-done';
    if(i < lis.length){ lis[i].className = 'is-run'; later(function(){ step(i + 1); }, 750); return; }
    ask.hidden = false; requestAnimationFrame(function(){ ask.classList.add('is-on'); });
  }
  ask.addEventListener('click', function(e){
    var b = e.target.closest('[data-act]'); if(!b) return;
    ask.classList.add('is-answered'); $$('button', ask).forEach(function(x){ x.disabled = true; });
    if(b.dataset.act === 'allow'){ b.textContent = 'Allowed'; out.innerHTML = resultHtml(m); }
    else { b.textContent = 'Denied'; out.innerHTML = '<div class="mock__res mock__res--no"><span class="mock__rt">Stopped</span><p class="rtext">Nothing was changed. Titan keeps the plan, so you can run it again later.</p></div>'; }
    later(function(){ out.firstChild && out.firstChild.classList.add('is-on'); again.hidden = false; }, 30);
  });
  again.addEventListener('click', function(){ runTask(el, m, agent); el._started = true; later(function(){ step(0); }, 200); });
  return function(){ step(0); };
}
function runApprovals(el){
  var list = APPROVALS.map(function(x){ return Object.assign({}, x); });
  function render(){
    var n = list.filter(function(x){ return !x.done; }).length;
    el.innerHTML = '<div class="mock mock--appr"><div class="mock__bar"><span class="chipag" style="--c:#c4f012"><i></i>Titan · approvals</span><span class="mock__model">' + (n ? n + ' waiting' : 'All clear') + '</span></div>' +
      list.map(function(x, i){
        var a = AGENT_BY[x.a];
        return '<div class="appr' + (x.done ? ' is-done' : '') + '" data-i="' + i + '"><span class="appr__dot" style="--c:' + a.c + '"></span><div class="appr__t"><b>' + esc(x.t) + '</b><small>' + esc(x.s) + '</small><small class="mono">' + esc(a.name) + ' · ' + esc(x.when) + '</small></div>' +
          (x.done ? '<span class="appr__st appr__st--' + x.done + '">' + {allow:'Allowed', deny:'Denied', rule:'Rule saved'}[x.done] + '</span>'
                  : '<div class="appr__btns"><button type="button" class="mbtn" data-act="deny">Deny</button><button type="button" class="mbtn" data-act="rule">Always</button><button type="button" class="mbtn mbtn--yes" data-act="allow">Allow</button></div>') + '</div>';
      }).join('') + (n ? '' : '<button type="button" class="mock__again" data-reset>Reset the demo</button>') + '</div>';
  }
  el.addEventListener('click', function(e){
    if(e.target.closest('[data-reset]')){ list.forEach(function(x){ delete x.done; }); render(); return; }
    var b = e.target.closest('[data-act]'), row = e.target.closest('.appr'); if(!b || !row) return;
    list[+row.dataset.i].done = b.dataset.act; render();
  });
  render();
}
function runModels(el, d){
  var pick = 2, own = false;
  function render(){
    el.innerHTML = '<div class="mock mock--models"><div class="mock__bar"><span class="chipag" style="--c:#a1a1a6"><i></i>Model router</span><span class="mock__model">per agent, per step</span></div>' +
      '<div class="mock__prompt"><span class="mono">You</span>' + esc(d.p) + '</div>' +
      '<div class="models" role="radiogroup" aria-label="Model for this task">' + MODELS.map(function(m, i){
        var cost = m[2] === 0 ? 'Free · offline' : own ? 'Billed by your provider' : 'est. ' + m[2] + ' credits';
        return '<button type="button" role="radio" aria-checked="' + (i === pick) + '" class="model' + (i === pick ? ' is-on' : '') + '" data-i="' + i + '"><b>' + esc(m[0]) + '</b><small>' + esc(m[1]) + '</small><span class="mono">' + cost + '</span></button>';
      }).join('') + '</div>' +
      '<label class="own"><input type="checkbox"' + (own ? ' checked' : '') + '> Use my own OpenRouter key</label>' +
      '<div class="mock__res is-on"><span class="mock__rt">Before it runs</span><p class="rtext">' + (MODELS[pick][2] === 0 ? 'Runs on this laptop with Llama 3.2 3B. Nothing leaves the machine and it costs nothing.' : own ? 'Runs on ' + esc(MODELS[pick][0]) + ' with your own key. No credits are used.' : 'Runs on ' + esc(MODELS[pick][0]) + ' for about <b>' + MODELS[pick][2] + ' credits</b> (€' + (MODELS[pick][2]/100).toFixed(2) + '). You can cap it before it starts.') + '</p></div></div>';
  }
  el.addEventListener('click', function(e){ var b = e.target.closest('.model'); if(b){ pick = +b.dataset.i; render(); } });
  el.addEventListener('change', function(e){ if(e.target.type === 'checkbox'){ own = e.target.checked; render(); } });
  render();
}
function mountDemo(el){
  var key = el.dataset.demo, start;
  if(key.indexOf('ind:') === 0){
    var p = key.split(':'), d = INDUSTRIES.filter(function(z){ return z.id === p[1]; })[0], u = d.uses[+p[2]];
    start = runTask(el, u.m, u.agent);
  } else {
    var demo = AGENT_DEMO[key];
    if(demo.kind === 'approvals') return runApprovals(el);
    if(demo.kind === 'models') return runModels(el, demo);
    if(demo.kind === 'phone') el.dataset.kind = 'phone';
    start = runTask(el, demo.m, key);
  }
  el._start = start;
  if(reduce || !('IntersectionObserver' in window)){ start(); return; }
  var io = new IntersectionObserver(function(es){ if(es[0].isIntersecting){ io.disconnect(); el._started = true; start(); } }, {threshold:.45});
  io.observe(el);
}
$$('[data-demo]').forEach(mountDemo);

/* ═════════ industry pages: the four tasks, one live demo ═════════ */
(function(){
  var box = $('.uses2'); if(!box) return;
  var demo = $('[data-demo]', box), id = box.dataset.ind, tabs = $$('.utab', box);
  box.addEventListener('click', function(e){
    var b = e.target.closest('.utab'); if(!b || b.classList.contains('is-on')) return;
    tabs.forEach(function(x){ var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on); });
    demo.dataset.demo = 'ind:' + id + ':' + b.dataset.use;
    var d = INDUSTRIES.filter(function(z){ return z.id === id; })[0], u = d.uses[+b.dataset.use];
    runTask(demo, u.m, u.agent)();
  });
})();

/* ═════════ agents page: the chip bar follows the section in view ═════════ */
(function(){
  var bar = $('.chips'); if(!bar) return;
  var links = $$('a', bar), secs = links.map(function(a){ return $(a.getAttribute('href')); });
  function onS(){
    var y = innerHeight*.4, cur = 0;
    secs.forEach(function(s, i){ if(s && s.getBoundingClientRect().top < y) cur = i; });
    links.forEach(function(a, i){ a.classList.toggle('is-on', i === cur); });
    var on = links[cur], sc = $('.chips__in', bar);
    if(on && sc.scrollWidth > sc.clientWidth){ var l = on.offsetLeft - sc.clientWidth/2 + on.offsetWidth/2; if(Math.abs(sc.scrollLeft - l) > 40) sc.scrollTo({left:l, behavior:'smooth'}); }
  }
  addEventListener('scroll', onS, {passive:true}); onS();
})();

/* ═════════ pricing: monthly or yearly, and the credit estimator ═════════ */
(function(){
  var bill = $('.billing');
  if(bill) bill.addEventListener('click', function(e){
    var b = e.target.closest('[data-bill]'); if(!b) return;
    $$('button', bill).forEach(function(x){ x.classList.toggle('is-on', x === b); });
    $$('#plans [data-m]').forEach(function(el){ el.textContent = el.dataset[b.dataset.bill]; });
  });
  var est = $('.est'); if(!est) return;
  function calc(){
    var n = 0; $$('output[data-cr]', est).forEach(function(o){ n += +o.dataset.cr * +o.value; });
    n = Math.round(n*4.3);
    var plan = PLANS.filter(function(p){ return p.cr && p.cr >= n; })[0];
    $('#estN').textContent = n.toLocaleString('en');
    $('#estBar').style.width = Math.min(100, n/3500*100).toFixed(1) + '%';
    $('#estPlan').innerHTML = plan ? '<b>' + plan.n + '</b> covers it, with ' + (plan.cr - n).toLocaleString('en') + ' credits to spare.' : '<b>Max</b> plus a top-up, or talk to us about Custom.';
  }
  est.addEventListener('click', function(e){
    var b = e.target.closest('[data-d]'); if(!b) return;
    var o = $('output', b.parentNode); o.value = o.textContent = Math.max(0, Math.min(40, +o.textContent + +b.dataset.d)); calc();
  });
  $$('output[data-cr]', est).forEach(function(o){ o.value = o.textContent; });
  calc();
})();
