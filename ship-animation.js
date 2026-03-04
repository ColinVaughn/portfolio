/* ========================================
   Ship Particle Animation
   3D dot-based rocket that assembles,
   launches with a big smoke poof, orbits
   the hero text, settles with a rubber-band
   pull-back, then becomes interactive.
   Ship always faces its direction of travel.
   ======================================== */

(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ---- Toggle persistence ---- */
  var STORAGE_KEY = 'shipAnimationDisabled';
  var isDisabled = localStorage.getItem(STORAGE_KEY) === '1';

  /* ---- Constants ---- */
  var PARTICLE_COUNT = 280;
  var DOT_RADIUS = 2.0;
  var SMOKE_DOT_RADIUS = 2.0;
  var SMOKE_MAX = 150;
  var ACCENT = { r: 196, g: 245, b: 74 };
  var DIM    = { r: 136, g: 136, b: 160 };

  /* ---- Timing ---- */
  var DELAY_BEFORE_ASSEMBLE = 0.6;
  var ASSEMBLE_DURATION = 1.8;
  var LAUNCH_DURATION = 0.7;
  var ORBIT_LAPS = 1.75;
  var ORBIT_DURATION = 6.0;
  var SETTLE_DURATION = 1.2;

  /* ---- Flight ---- */
  var BASE_SPEED = 75;
  var BOUNCE_SPEED_BOOST = 200;
  var BOUNCE_DECAY = 0.97;
  var EDGE_MARGIN = 60;

  /* ---- Easing ---- */
  function easeOutExpo(x) { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); }
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInQuad(x) { return x * x; }
  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
  /* Rubber-band: overshoots backward then snaps forward */
  function easeOutBack(x) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function hash(i) { return ((i * 2654435761) & 0xffff) / 0xffff; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Normalize angle to [-PI, PI] */
  function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  /* Shortest-path angle lerp */
  function lerpAngle(from, to, t) {
    var diff = normalizeAngle(to - from);
    return from + diff * t;
  }

  /* ---- Ship points (same wireframe design) ---- */
  function genShipPoints(count) {
    var pts = [];
    var bodyW = 0.35, bodyD = 0.3;
    var noseY = 1.2, tailY = -0.6;
    var edges = [];

    var topFront = [0, noseY, 0];
    var bodyTopFL = [-bodyW, 0.54, -bodyD], bodyTopFR = [bodyW, 0.54, -bodyD];
    var bodyTopBL = [-bodyW, 0.54, bodyD], bodyTopBR = [bodyW, 0.54, bodyD];
    edges.push([topFront, bodyTopFL], [topFront, bodyTopFR],
               [topFront, bodyTopBL], [topFront, bodyTopBR]);
    edges.push([bodyTopFL, bodyTopFR], [bodyTopFR, bodyTopBR],
               [bodyTopBR, bodyTopBL], [bodyTopBL, bodyTopFL]);

    var bodyBotFL = [-bodyW, tailY, -bodyD], bodyBotFR = [bodyW, tailY, -bodyD];
    var bodyBotBL = [-bodyW, tailY, bodyD], bodyBotBR = [bodyW, tailY, bodyD];
    edges.push([bodyTopFL, bodyBotFL], [bodyTopFR, bodyBotFR],
               [bodyTopBL, bodyBotBL], [bodyTopBR, bodyBotBR]);
    edges.push([bodyBotFL, bodyBotFR], [bodyBotFR, bodyBotBR],
               [bodyBotBR, bodyBotBL], [bodyBotBL, bodyBotFL]);

    var finSpan = 0.7, finSweep = -0.3, finH = 0.5;
    var finTips = [
      [-bodyW - finSpan, tailY + finSweep, 0], [bodyW + finSpan, tailY + finSweep, 0],
      [0, tailY + finSweep, -bodyD - finSpan], [0, tailY + finSweep, bodyD + finSpan]
    ];
    var finRoots = [
      [-bodyW, tailY + finH, 0], [bodyW, tailY + finH, 0],
      [0, tailY + finH, -bodyD], [0, tailY + finH, bodyD]
    ];
    var finBases = [
      [-bodyW, tailY, 0], [bodyW, tailY, 0],
      [0, tailY, -bodyD], [0, tailY, bodyD]
    ];
    for (var f = 0; f < 4; f++) {
      edges.push([finRoots[f], finTips[f]], [finTips[f], finBases[f]],
                 [finBases[f], finRoots[f]]);
    }

    var nozR = 0.2, nozY = tailY - 0.15, nozPts = [];
    for (var n = 0; n < 8; n++) {
      var a = (n / 8) * Math.PI * 2;
      nozPts.push([Math.cos(a) * nozR, nozY, Math.sin(a) * nozR]);
    }
    for (var n = 0; n < 8; n++) edges.push([nozPts[n], nozPts[(n + 1) % 8]]);
    edges.push([bodyBotFL, nozPts[6]], [bodyBotFR, nozPts[2]],
               [bodyBotBL, nozPts[4]], [bodyBotBR, nozPts[0]]);

    var midY = (0.54 + tailY) * 0.5;
    edges.push(
      [[-bodyW, midY, -bodyD], [bodyW, midY, -bodyD]],
      [[bodyW, midY, -bodyD], [bodyW, midY, bodyD]],
      [[bodyW, midY, bodyD], [-bodyW, midY, bodyD]],
      [[-bodyW, midY, bodyD], [-bodyW, midY, -bodyD]]
    );

    var ptsPerEdge = Math.ceil(count / edges.length);
    var idx = 0;
    for (var e = 0; e < edges.length && idx < count; e++) {
      var ea = edges[e][0], eb = edges[e][1];
      for (var j = 0; j < ptsPerEdge && idx < count; j++) {
        var t = ptsPerEdge <= 1 ? 0.5 : j / (ptsPerEdge - 1);
        pts.push({
          x: ea[0] + (eb[0] - ea[0]) * t,
          y: ea[1] + (eb[1] - ea[1]) * t,
          z: ea[2] + (eb[2] - ea[2]) * t
        });
        idx++;
      }
    }
    return pts;
  }

  function genScattered(count) {
    var pts = [];
    for (var i = 0; i < count; i++) {
      var r = 4 + hash(i) * 8;
      var theta = hash(i + 1000) * Math.PI * 2;
      var phi = Math.acos(2 * hash(i + 2000) - 1);
      pts.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi)
      });
    }
    return pts;
  }

  /* ---- 3D projection ---- */
  function project(p, rotY, rotX, rotZ, cx, cy, scale) {
    var cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);
    var xz = p.x * cosZ - p.y * sinZ;
    var yz = p.x * sinZ + p.y * cosZ;

    var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    var x1 = xz * cosY - p.z * sinY;
    var z1 = xz * sinY + p.z * cosY;

    var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    var y2 = yz * cosX - z1 * sinX;
    var z2 = yz * sinX + z1 * cosX;

    var fov = 5;
    var pScale = fov / (fov + z2);
    return {
      sx: cx + x1 * pScale * scale,
      sy: cy - y2 * pScale * scale,
      depth: z2,
      pScale: pScale
    };
  }

  /* ================================================================ */
  function initShipAnimation() {
    var hero = document.querySelector('.hero');
    if (!hero) return;

    var canvas = document.createElement('canvas');
    canvas.className = 'hero-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    hero.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var shipPts = genShipPoints(PARTICLE_COUNT);
    var scatterPts = genScattered(PARTICLE_COUNT);
    var current = [];
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      current.push({ x: scatterPts[i].x, y: scatterPts[i].y, z: scatterPts[i].z });
    }

    var smoke = [];

    /* ---- State ---- */
    /* waiting → assembling → launching → orbiting → settling → flying */
    var phase = 'waiting';
    var phaseTime = 0;
    var lastTime = null;

    /* Ship position & velocity */
    var shipX = 0, shipY = 0;
    var shipVX = 0, shipVY = 0;
    /* Previous frame position for heading calc during orbit/launch */
    var prevShipX = 0, prevShipY = 0;

    /* Rotation — heading-based */
    var rotX = 0.15, rotY = 0.4, rotZ = 0;
    var targetRotZ = 0;            /* Z tracks heading */
    var rotYSpeed = 0.3;           /* gentle Y spin */
    /* Extra spin from bounces (added on top) */
    var bonusRotVX = 0, bonusRotVY = 0, bonusRotVZ = 0;

    var shipScale = 1;
    var cw = 0, ch = 0;

    /* Key positions */
    var assembleX = 0, assembleY = 0;
    var launchStartX = 0, launchStartY = 0;

    /* Orbit */
    var orbitCX = 0, orbitCY = 0, orbitRX = 0, orbitRY = 0;

    /* Settle (rubber-band) */
    var settleStartX = 0, settleStartY = 0;
    var settleEndX = 0, settleEndY = 0;
    var settleEndVX = 0, settleEndVY = 0;

    function resize() {
      var rect = hero.getBoundingClientRect();
      cw = rect.width;
      ch = rect.height;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      shipScale = Math.min(cw, ch) * 0.11;

      assembleX = cw * 0.72;
      assembleY = ch * 0.48;

      var h1 = hero.querySelector('h1');
      if (h1) {
        var hRect = h1.getBoundingClientRect();
        var heroRect = hero.getBoundingClientRect();
        orbitCX = (hRect.left + hRect.width / 2) - heroRect.left;
        orbitCY = (hRect.top + hRect.height / 2) - heroRect.top;
        orbitRX = hRect.width * 0.55 + 140;
        orbitRY = hRect.height * 0.55 + 120;
      } else {
        orbitCX = cw * 0.35;
        orbitCY = ch * 0.45;
        orbitRX = cw * 0.25;
        orbitRY = ch * 0.2;
      }
    }
    resize();
    window.addEventListener('resize', resize);

    shipX = assembleX;
    shipY = assembleY;
    prevShipX = shipX;
    prevShipY = shipY;

    /* ---- Heading from velocity ---- */
    /* Ship nose = local +Y → screen up. We rotate Z so nose faces travel dir. */
    function headingFromVelocity(vx, vy) {
      /* Screen heading: atan2(-vy, vx) because screen Y is inverted */
      return Math.atan2(-vy, vx) - Math.PI / 2;
    }

    function headingFromDelta(dx, dy) {
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return targetRotZ;
      return Math.atan2(-dy, dx) - Math.PI / 2;
    }

    /* ---- Click ---- */
    function onCanvasClick(e) {
      if (phase !== 'flying') return;
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var dx = mx - shipX, dy = my - shipY;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < shipScale * 2.8) {
        var angle = Math.atan2(dy, dx) + Math.PI;
        angle += (Math.random() - 0.5) * 1.2;
        var boost = BOUNCE_SPEED_BOOST + Math.random() * 80;
        shipVX = Math.cos(angle) * boost;
        shipVY = Math.sin(angle) * boost;

        /* Extra tumble spin on top of heading */
        bonusRotVX += (Math.random() - 0.5) * 4;
        bonusRotVY += (Math.random() - 0.5) * 3;
        bonusRotVZ += (Math.random() - 0.5) * 2;

        for (var s = 0; s < 18; s++) spawnSmoke(shipX, shipY, true);
      }
    }
    canvas.style.pointerEvents = 'auto';
    canvas.style.cursor = 'default';
    canvas.addEventListener('click', onCanvasClick);

    /* ---- Draw ---- */
    function drawDot(sx, sy, r, alpha, color) {
      if (alpha < 0.01 || r < 0.3) return;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + alpha.toFixed(3) + ')';
      ctx.fill();
    }

    function spawnSmoke(x, y, burst) {
      if (smoke.length >= SMOKE_MAX) return;
      var spread = burst ? 50 : 15;
      var speed = burst ? 120 : 35;
      smoke.push({
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * (burst ? spread : 5),
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed + (burst ? 0 : 15),
        life: 1.0,
        decay: burst ? (0.4 + Math.random() * 0.4) : (0.6 + Math.random() * 0.8),
        r: SMOKE_DOT_RADIUS * (burst ? (0.8 + Math.random() * 1.2) : (0.4 + Math.random() * 0.6))
      });
    }

    function getEngineScreenPos() {
      var eng = { x: 0, y: -0.6, z: 0 };
      var p = project(eng, rotY, rotX, rotZ, shipX, shipY, shipScale);
      return { x: p.sx, y: p.sy };
    }

    /* ---- Frame ---- */
    function frame(ts) {
      if (lastTime === null) lastTime = ts;
      var dt = Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      phaseTime += dt;

      ctx.clearRect(0, 0, cw, ch);

      /* Save prev position for heading calc */
      prevShipX = shipX;
      prevShipY = shipY;

      /* ================ WAITING ================ */
      if (phase === 'waiting') {
        if (phaseTime >= DELAY_BEFORE_ASSEMBLE) {
          phase = 'assembling';
          phaseTime = 0;
        }
      }

      /* ================ ASSEMBLING ================ */
      if (phase === 'assembling') {
        var prog = Math.min(1, phaseTime / ASSEMBLE_DURATION);
        var ease = easeOutExpo(prog);

        shipX = assembleX;
        shipY = assembleY;

        for (var i = 0; i < PARTICLE_COUNT; i++) {
          current[i].x = scatterPts[i].x + (shipPts[i].x - scatterPts[i].x) * ease;
          current[i].y = scatterPts[i].y + (shipPts[i].y - scatterPts[i].y) * ease;
          current[i].z = scatterPts[i].z + (shipPts[i].z - scatterPts[i].z) * ease;
        }

        rotY += 0.3 * dt;
        targetRotZ = 0; /* nose up during assembly */
        rotZ = lerpAngle(rotZ, targetRotZ, 3 * dt);

        if (prog >= 1) {
          phase = 'launching';
          phaseTime = 0;
          launchStartX = shipX;
          launchStartY = shipY;
          /* BIG smoke poof */
          for (var s = 0; s < 45; s++) spawnSmoke(shipX, shipY + shipScale * 0.4, true);
          for (var i = 0; i < PARTICLE_COUNT; i++) {
            current[i].x = shipPts[i].x;
            current[i].y = shipPts[i].y;
            current[i].z = shipPts[i].z;
          }
        }
      }

      /* ================ LAUNCHING ================ */
      if (phase === 'launching') {
        var prog = Math.min(1, phaseTime / LAUNCH_DURATION);
        var ease = easeInQuad(prog);

        var launchTargetX = orbitCX + orbitRX;
        var launchTargetY = orbitCY;

        shipX = lerp(launchStartX, launchTargetX, ease);
        shipY = lerp(launchStartY, launchTargetY - orbitRY * 0.3, ease);

        /* Face direction of travel */
        var dx = shipX - prevShipX;
        var dy = shipY - prevShipY;
        targetRotZ = headingFromDelta(dx, dy);
        rotZ = lerpAngle(rotZ, targetRotZ, 6 * dt);

        rotY += (0.5 + ease * 2) * dt;

        /* Heavy exhaust */
        var eng = getEngineScreenPos();
        for (var s = 0; s < 4; s++) spawnSmoke(eng.x, eng.y, false);

        for (var i = 0; i < PARTICLE_COUNT; i++) {
          current[i].x = shipPts[i].x;
          current[i].y = shipPts[i].y;
          current[i].z = shipPts[i].z;
        }

        if (prog >= 1) {
          phase = 'orbiting';
          phaseTime = 0;
        }
      }

      /* ================ ORBITING ================ */
      if (phase === 'orbiting') {
        var prog = Math.min(1, phaseTime / ORBIT_DURATION);

        /* Linear progress = constant speed around orbit, no start/end stall */
        var angle = -prog * ORBIT_LAPS * Math.PI * 2;
        shipX = orbitCX + Math.cos(angle) * orbitRX;
        shipY = orbitCY + Math.sin(angle) * orbitRY;

        /* Heading from ellipse tangent (derivative), not position delta */
        var tangentX = Math.sin(angle) * orbitRX;   /* -dx/dAngle but angle is negative */
        var tangentY = -Math.cos(angle) * orbitRY;   /* dy/dAngle */
        targetRotZ = Math.atan2(-tangentY, tangentX) - Math.PI / 2;
        rotZ = lerpAngle(rotZ, targetRotZ, 8 * dt);

        rotY += 1.2 * dt;

        /* Smoke trail */
        if (Math.random() < (1 - prog * 0.5)) {
          var eng = getEngineScreenPos();
          spawnSmoke(eng.x, eng.y, false);
        }

        for (var i = 0; i < PARTICLE_COUNT; i++) {
          current[i].x = shipPts[i].x;
          current[i].y = shipPts[i].y;
          current[i].z = shipPts[i].z;
        }

        if (prog >= 1) {
          phase = 'settling';
          phaseTime = 0;
          settleStartX = shipX;
          settleStartY = shipY;

          var pullBackX = lerp(shipX, assembleX, 0.35);
          var pullBackY = lerp(shipY, assembleY, 0.35);
          settleEndX = pullBackX;
          settleEndY = pullBackY;

          /* Exit velocity tangent to orbit at exit point */
          settleEndVX = tangentX * 0.15;
          settleEndVY = tangentY * 0.15;
          var exitSpd = Math.sqrt(settleEndVX * settleEndVX + settleEndVY * settleEndVY);
          if (exitSpd > 0) {
            settleEndVX = (settleEndVX / exitSpd) * BASE_SPEED;
            settleEndVY = (settleEndVY / exitSpd) * BASE_SPEED;
          }
        }
      }

      /* ================ SETTLING (rubber-band) ================ */
      if (phase === 'settling') {
        var prog = Math.min(1, phaseTime / SETTLE_DURATION);
        /* easeOutBack overshoots (pulls past target then snaps back) */
        var ease = easeOutBack(prog);

        /* Ship drifts toward the pull-back point, overshoots, snaps back */
        shipX = lerp(settleStartX, settleEndX, ease);
        shipY = lerp(settleStartY, settleEndY, ease);

        /* Face direction of travel */
        var dx = shipX - prevShipX;
        var dy = shipY - prevShipY;
        targetRotZ = headingFromDelta(dx, dy);
        rotZ = lerpAngle(rotZ, targetRotZ, 5 * dt);

        /* Slow the Y spin down */
        rotY += lerp(1.2, 0.3, prog) * dt;

        /* Light smoke */
        if (Math.random() < 0.4) {
          var eng = getEngineScreenPos();
          spawnSmoke(eng.x, eng.y, false);
        }

        for (var i = 0; i < PARTICLE_COUNT; i++) {
          current[i].x = shipPts[i].x;
          current[i].y = shipPts[i].y;
          current[i].z = shipPts[i].z;
        }

        if (prog >= 1) {
          phase = 'flying';
          phaseTime = 0;
          shipVX = settleEndVX;
          shipVY = settleEndVY;
          canvas.style.cursor = 'pointer';
        }
      }

      /* ================ FLYING (interactive) ================ */
      if (phase === 'flying') {
        shipX += shipVX * dt;
        shipY += shipVY * dt;

        /* Decay speed to base */
        var spd = Math.sqrt(shipVX * shipVX + shipVY * shipVY);
        if (spd > BASE_SPEED) {
          shipVX *= BOUNCE_DECAY;
          shipVY *= BOUNCE_DECAY;
          spd = Math.sqrt(shipVX * shipVX + shipVY * shipVY);
          if (spd < BASE_SPEED) {
            var n = BASE_SPEED / spd;
            shipVX *= n;
            shipVY *= n;
          }
        }

        /* Bounce off edges */
        if (shipX < EDGE_MARGIN) { shipX = EDGE_MARGIN; shipVX = Math.abs(shipVX); }
        if (shipX > cw - EDGE_MARGIN) { shipX = cw - EDGE_MARGIN; shipVX = -Math.abs(shipVX); }
        if (shipY < EDGE_MARGIN) { shipY = EDGE_MARGIN; shipVY = Math.abs(shipVY); }
        if (shipY > ch - EDGE_MARGIN) { shipY = ch - EDGE_MARGIN; shipVY = -Math.abs(shipVY); }

        /* Nose faces velocity direction */
        targetRotZ = headingFromVelocity(shipVX, shipVY);
        rotZ = lerpAngle(rotZ, targetRotZ, 4 * dt);

        /* Gentle Y spin + bonus tumble decaying */
        rotY += (rotYSpeed + bonusRotVY) * dt;
        rotX += bonusRotVX * dt;
        /* rotZ gets bonus on top of heading */
        rotZ += bonusRotVZ * dt;

        /* Decay bonus spin */
        bonusRotVX *= 1 - 2.5 * dt;
        bonusRotVY *= 1 - 2.5 * dt;
        bonusRotVZ *= 1 - 2.5 * dt;
        if (Math.abs(bonusRotVX) < 0.01) bonusRotVX = 0;
        if (Math.abs(bonusRotVY) < 0.01) bonusRotVY = 0;
        if (Math.abs(bonusRotVZ) < 0.01) bonusRotVZ = 0;

        /* Decay rotX back to neutral */
        rotX += (0.15 - rotX) * 0.5 * dt;

        /* Engine smoke */
        if (Math.random() < 0.5) {
          var eng = getEngineScreenPos();
          spawnSmoke(eng.x, eng.y, false);
        }

        for (var i = 0; i < PARTICLE_COUNT; i++) {
          current[i].x = shipPts[i].x;
          current[i].y = shipPts[i].y;
          current[i].z = shipPts[i].z;
        }
      }

      /* ================ DRAW SHIP ================ */
      if (phase !== 'waiting') {
        var projected = [];
        for (var i = 0; i < PARTICLE_COUNT; i++) {
          var p = project(current[i], rotY, rotX, rotZ, shipX, shipY, shipScale);
          projected.push({ idx: i, sx: p.sx, sy: p.sy, depth: p.depth, pScale: p.pScale });
        }
        projected.sort(function (a, b) { return a.depth - b.depth; });

        for (var j = 0; j < projected.length; j++) {
          var pp = projected[j];
          var depthAlpha = 0.3 + 0.7 * ((pp.depth + 3) / 6);
          depthAlpha = Math.max(0.15, Math.min(1, depthAlpha));

          var alpha = depthAlpha;
          if (phase === 'assembling') {
            var prog = Math.min(1, phaseTime / ASSEMBLE_DURATION);
            alpha = depthAlpha * easeOutCubic(Math.min(1, prog * 2));
          }

          var isAccent = pp.idx % 5 === 0 || shipPts[pp.idx].y > 0.8;
          var col = isAccent ? ACCENT : DIM;
          var r = DOT_RADIUS * pp.pScale;
          drawDot(pp.sx, pp.sy, r, alpha, col);
        }
      }

      /* ================ SMOKE ================ */
      for (var s = smoke.length - 1; s >= 0; s--) {
        var sp = smoke[s];
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.vx *= 0.96;
        sp.vy *= 0.96;
        sp.life -= sp.decay * dt;

        if (sp.life <= 0) { smoke.splice(s, 1); continue; }

        var sa = sp.life * 0.45;
        var smokeCol = {
          r: Math.floor(DIM.r + (ACCENT.r - DIM.r) * sp.life * 0.3),
          g: Math.floor(DIM.g + (ACCENT.g - DIM.g) * sp.life * 0.3),
          b: Math.floor(DIM.b + (ACCENT.b - DIM.b) * sp.life * 0.3)
        };
        drawDot(sp.x, sp.y, sp.r * (1 + (1 - sp.life) * 1.2), sa, smokeCol);
      }

      requestAnimationFrame(frame);
    }

    /* Apply saved preference */
    if (isDisabled) {
      canvas.style.display = 'none';
    }

    requestAnimationFrame(frame);

    /* ---- Toggle button ---- */
    var toggleBtn = document.getElementById('shipToggle');
    if (toggleBtn) {
      if (isDisabled) toggleBtn.classList.add('off');

      toggleBtn.addEventListener('click', function () {
        var hidden = canvas.style.display === 'none';
        if (hidden) {
          canvas.style.display = '';
          toggleBtn.classList.remove('off');
          localStorage.removeItem(STORAGE_KEY);
        } else {
          canvas.style.display = 'none';
          toggleBtn.classList.add('off');
          localStorage.setItem(STORAGE_KEY, '1');
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShipAnimation);
  } else {
    initShipAnimation();
  }
})();
