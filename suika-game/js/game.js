(function () {
  "use strict";
  window.NS = window.NS || {};

  const FRUITS = [
    { name: 'cherry', r: 10, color: '#ff2d55', glow: '#ff0055', score: 1 },
    { name: 'strawberry', r: 15, color: '#ff6b8a', glow: '#ff4080', score: 2 },
    { name: 'grape', r: 20, color: '#a855f7', glow: '#9333ea', score: 4 },
    { name: 'orange', r: 28, color: '#fb923c', glow: '#f97316', score: 8 },
    { name: 'apple', r: 38, color: '#ef4444', glow: '#dc2626', score: 16 },
    { name: 'pear', r: 48, color: '#a3e635', glow: '#84cc16', score: 32 },
    { name: 'peach', r: 60, color: '#fda4af', glow: '#fb7185', score: 64 },
    { name: 'melon', r: 76, color: '#4ade80', glow: '#22c55e', score: 128 },
    { name: 'watermelon', r: 95, color: '#15803d', glow: '#166534', score: 256 }
  ];

  const GRAVITY = 1200;
  const WALL_BOUNCE = 0.2;
  const FRICTION = 0.98;
  const SUB_STEPS = 6;
  const DANGER_Y_RATIO = 0.22;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  const Game = function (canvas, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks || {};
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = 0; this.H = 0;
    this.state = 'title';
    this.fruits = [];
    this.score = 0;
    this.best = 0;
    this.combo = 0;
    this.dropX = 0;
    this.nextType = 0;
    this.nextPreviewIdx = 0;
    this.dangerY = 0;
    this.floorY = 0;
    this.particles = [];
    this.popups = [];
    this.bgPhase = 0;
    this.flash = 0;
    this.lastT = 0;
    this.settledTimer = 0;
    this.canDrop = true;
    this.scale = 1;
    this.shake = 0;
    this.petals = [];

    this._bindResize();
    this.resize();
  };

  Game.prototype._bindResize = function () {
    var self = this;
    this._onResize = function () { self.resize(); };
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
  };

  Game.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    this.W = Math.max(1, Math.floor(rect.width));
    this.H = Math.max(1, Math.floor(rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.scale = this.W / 400;
    this.floorY = this.H - 20 * this.scale;
    this.dangerY = this.H * DANGER_Y_RATIO;
    this.dropX = this.W / 2;
    this.petals = [];
    var colors = ['#ff8a5c', '#ff5f6d', '#ffd6a0', '#ff6b8a', '#a855f7', '#fb923c'];
    for (var i = 0; i < 20; i++) {
      this.petals.push(this._makePetal(colors));
    }
  };

  Game.prototype._makePetal = function (colors) {
    return {
      x: Math.random() * this.W + 20,
      y: Math.random() * this.H,
      w: 4 + Math.random() * 8,
      h: 3 + Math.random() * 5,
      vx: -6 - Math.random() * 12,
      vy: 2 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.15 + Math.random() * 0.2
    };
  };

  Game.prototype.startLoop = function () {
    if (this._raf) return;
    var self = this;
    this.lastT = performance.now();
    this._raf = function (t) { self._frame(t); };
    requestAnimationFrame(this._raf);
  };

  Game.prototype._frame = function (t) {
    var dt = Math.min(0.05, (t - this.lastT) / 1000) || 0;
    this.lastT = t;
    this.update(dt);
    this.render();
    requestAnimationFrame(this._raf);
  };

  Game.prototype.pickFruit = function () {
    var maxType = Math.min(FRUITS.length - 1, 3 + Math.floor(this.score / 30));
    var weights = [];
    for (var i = 0; i <= maxType; i++) {
      weights.push(maxType - i + 1);
    }
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return 0;
  };

  Game.prototype.newRun = function () {
    this.fruits = [];
    this.particles = [];
    this.popups = [];
    this.score = 0;
    this.combo = 0;
    this.flash = 0;
    this.shake = 0;
    this.settledTimer = 0;
    this.canDrop = true;
    this.nextType = this.pickFruit();
    this.nextPreviewIdx = this.pickFruit();
    try { this.best = parseInt(localStorage.getItem('suikabest') || '0', 10) || 0; } catch (e) { this.best = 0; }
    this.state = 'playing';
    this.hooks.onScore && this.hooks.onScore(0);
    this.startLoop();
  };

  Game.prototype.startSandbox = function () {
    this.fruits = [];
    this.particles = [];
    this.popups = [];
    this.score = 0;
    this.combo = 0;
    this.flash = 0;
    this.shake = 0;
    this.settledTimer = 0;
    this.canDrop = true;
    this.nextType = 0;
    this.nextPreviewIdx = 0;
    this.state = 'sandbox';
    this.hooks.onScore && this.hooks.onScore(0);
    this.startLoop();
  };

  Game.prototype.spawnFruits = function (type, count) {
    if (this.state !== 'sandbox') return;
    if (type < 0 || type >= FRUITS.length) return;
    var ft = FRUITS[type];
    var r = ft.r * this.scale;
    count = Math.min(count || 1, 50);
    for (var i = 0; i < count; i++) {
      var x = r + Math.random() * (this.W - r * 2);
      this.fruits.push({
        x: x, y: -r * 2 - i * r * 3,
        vx: (Math.random() - 0.5) * 60,
        vy: -Math.random() * 100,
        r: r, type: type, merged: false,
        hue: 0
      });
    }
  };

  Game.prototype.dropFruit = function () {
    if ((this.state !== 'playing' && this.state !== 'sandbox') || !this.canDrop) return;
    var type = this.nextType;
    var f = FRUITS[type];
    var r = f.r * this.scale;
    var x = clamp(this.dropX, r, this.W - r);
    this.fruits.push({
      x: x, y: -r * 2, vx: 0, vy: 0,
      r: r, type: type, merged: false,
      hue: 0
    });
    this.nextType = this.nextPreviewIdx;
    this.nextPreviewIdx = this.pickFruit();
    this.canDrop = false;
    NS.audio && NS.audio.drop();
    var self = this;
    setTimeout(function () { self.canDrop = true; }, 200);
  };

  Game.prototype.physicsStep = function (dt) {
    var subDt = dt / SUB_STEPS;
    var fruits = this.fruits;
    var W = this.W, H = this.H;
    var floor = this.floorY;
    var merged = [];

    for (var step = 0; step < SUB_STEPS; step++) {
      for (var i = 0; i < fruits.length; i++) {
        var f = fruits[i];
        if (f.merged) continue;
        f.vy += GRAVITY * subDt;
        f.x += f.vx * subDt;
        f.y += f.vy * subDt;

        if (f.x - f.r < 0) { f.x = f.r; f.vx *= -WALL_BOUNCE; }
        if (f.x + f.r > W) { f.x = W - f.r; f.vx *= -WALL_BOUNCE; }
        if (f.y + f.r > floor) { f.y = floor - f.r; f.vy *= -WALL_BOUNCE; f.vx *= FRICTION; }
      }

      for (var i = 0; i < fruits.length; i++) {
        for (var j = i + 1; j < fruits.length; j++) {
          var a = fruits[i], b = fruits[j];
          if (a.merged || b.merged) continue;
          var dx = b.x - a.x, dy = b.y - a.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          var minDist = a.r + b.r;
          if (dist < minDist && dist > 0.001) {
            if (a.type === b.type && a.type < FRUITS.length - 1) {
              a.merged = true;
              b.merged = true;
              merged.push({
                x: (a.x + b.x) / 2,
                y: (a.y + b.y) / 2,
                vx: (a.vx + b.vx) / 2,
                vy: (a.vy + b.vy) / 2,
                type: a.type + 1
              });
            } else {
              var overlap = minDist - dist;
              var nx = dx / dist, ny = dy / dist;
              var ratio = a.r / (a.r + b.r);
              a.x -= nx * overlap * (1 - ratio);
              a.y -= ny * overlap * (1 - ratio);
              b.x += nx * overlap * ratio;
              b.y += ny * overlap * ratio;

              var relVx = a.vx - b.vx, relVy = a.vy - b.vy;
              var relVn = relVx * nx + relVy * ny;
              if (relVn > 0) {
                var impulse = relVn * 0.3;
                a.vx -= impulse * nx;
                a.vy -= impulse * ny;
                b.vx += impulse * nx;
                b.vy += impulse * ny;
              }
            }
          }
        }
      }
    }

    for (var i = 0; i < fruits.length; i++) {
      var f = fruits[i];
      if (Math.abs(f.vx) < 1) f.vx = 0;
      if (Math.abs(f.vy) < 1) f.vy = 0;
    }

    var filtered = this.fruits.filter(function (f) { return !f.merged; });
    for (var i = 0; i < merged.length; i++) {
      var m = merged[i];
      var ft = FRUITS[m.type];
      var r = ft.r * this.scale;
      m.r = r;
      m.merged = false;
      m.hue = 0;
      filtered.push(m);
      this.combo++;
      var pts = ft.score;
      this.score += pts;
      if (this.score > this.best) {
        this.best = this.score;
        try { localStorage.setItem('suikabest', String(this.best)); } catch (e) {}
      }
      this.hooks.onScore && this.hooks.onScore(this.score);
      this.hooks.onMerge && this.hooks.onMerge(m.type, m.x, m.y);
      NS.audio && NS.audio.merge(m.type);
      this.flash = 0.3;
    }
    this.fruits = filtered;

    if (this.combo >= 3) {
      this.combo = 0;
    }
  };

  Game.prototype.update = function (dt) {
    this.bgPhase += dt * 0.1;
    this.flash = Math.max(0, this.flash - dt * 2);

    for (var i = 0; i < this.petals.length; i++) {
      var p = this.petals[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.x < -30) { p.x = this.W + 20; p.y = Math.random() * this.H; }
      if (p.y > this.H + 30) { p.y = -20; p.x = Math.random() * this.W; }
    }

    if (this.state === 'playing' || this.state === 'sandbox') {
      this.shake = Math.max(0, this.shake - dt * 30);
      this.physicsStep(dt);

      var anyUnsettled = false;
      for (var i = 0; i < this.fruits.length; i++) {
        var f = this.fruits[i];
        if (Math.abs(f.vy) > 15 || Math.abs(f.vx) > 15) {
          anyUnsettled = true;
        }
      }

      if (!anyUnsettled && this.canDrop) {
        this.settledTimer += dt;
      } else {
        this.settledTimer = 0;
      }

      for (var i = 0; i < this.fruits.length; i++) {
        var f = this.fruits[i];
        if (f.y - f.r < this.dangerY && Math.abs(f.vy) < 10 && this.settledTimer > 0.8) {
          if (this.state !== 'sandbox') {
            this.gameOver();
            return;
          }
        }
      }

      for (var i = this.particles.length - 1; i >= 0; i--) {
        var p = this.particles[i];
        p.vy += 600 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
      for (var i = this.popups.length - 1; i >= 0; i--) {
        var p = this.popups[i];
        p.y -= 40 * dt;
        p.life -= dt;
        if (p.life <= 0) this.popups.splice(i, 1);
      }
    }
  };

  Game.prototype.gameOver = function () {
    this.state = 'gameover';
    this.shake = 10;
    NS.audio && NS.audio.gameOver();
    this.hooks.onGameOver && this.hooks.onGameOver(this.score, this.best);
  };

  Game.prototype.returnToMenu = function () {
    this.fruits = [];
    this.particles = [];
    this.popups = [];
    this.score = 0;
    this.state = 'title';
    this.flash = 0;
    this.hooks.onReturnToMenu && this.hooks.onReturnToMenu();
  };

  Game.prototype.spawnParticles = function (x, y, color, count) {
    for (var i = 0; i < (count || 12); i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 40 + Math.random() * 120;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        r: 2 + Math.random() * 4,
        life: 0.4 + Math.random() * 0.4,
        color: color
      });
    }
  };

  Game.prototype.spawnPopup = function (x, y, text) {
    this.popups.push({ x: x, y: y, text: text, life: 0.8 });
  };

  Game.prototype.hitTest = function (x, y) {
    var btns = { play: this._playBtn, retry: this._retryBtn, menu: this._menuBtn, sandbox: this._sandboxBtn };
    for (var key in btns) {
      var b = btns[key];
      if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return key;
    }
    return null;
  };

  Game.prototype.setDropX = function (x) {
    this.dropX = clamp(x, 0, this.W);
  };

  Game.prototype.render = function () {
    var ctx = this.ctx;
    var W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);

    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a0a2e');
    bg.addColorStop(0.35, '#2d1545');
    bg.addColorStop(0.7, '#4a1a3a');
    bg.addColorStop(1, '#1a0a14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    this.renderPetals(ctx, W, H);

    ctx.save();
    var sx = 0, sy = 0;
    if (this.shake > 0.2) {
      sx = (Math.random() * 2 - 1) * this.shake;
      sy = (Math.random() * 2 - 1) * this.shake;
    }
    ctx.translate(sx, sy);

    if (this.state === 'title') {
      this.renderTitle(ctx, W, H);
      ctx.restore();
      return;
    }

    if (this.state === 'playing' || this.state === 'sandbox') {
      this.renderPlayArea(ctx, W, H);
    }

    for (var i = 0; i < this.fruits.length; i++) {
      this.drawFruit(ctx, this.fruits[i]);
    }

    this.renderDropPreview(ctx, W, H);

    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      ctx.globalAlpha = Math.max(0, p.life / 0.8);
      ctx.fillStyle = p.color || '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (var i = 0; i < this.popups.length; i++) {
      var p = this.popups[i];
      ctx.globalAlpha = Math.max(0, p.life / 0.8);
      ctx.fillStyle = '#ffe8c0';
      ctx.font = 'bold ' + Math.round(16 * this.scale) + 'px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(255,200,100,0.5)';
      ctx.shadowBlur = 12;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    if (this.flash > 0.02) {
      ctx.fillStyle = 'rgba(255,220,180,' + (this.flash * 0.15) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    var dangerW = W * 0.02;
    var dashLen = 8 * this.scale;
    ctx.strokeStyle = 'rgba(255,120,60,0.5)';
    ctx.lineWidth = Math.max(2, dangerW);
    ctx.setLineDash([dashLen, dashLen]);
    ctx.beginPath();
    ctx.moveTo(0, this.dangerY);
    ctx.lineTo(W, this.dangerY);
    ctx.stroke();
    ctx.setLineDash([]);

    this.renderHUD(ctx, W, H);

    if (this.state === 'gameover') {
      this.renderGameOver(ctx, W, H);
    }

    ctx.restore();
  };

  Game.prototype.renderPetals = function (ctx, W, H) {
    for (var i = 0; i < this.petals.length; i++) {
      var p = this.petals[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  Game.prototype.renderTitle = function (ctx, W, H) {
    ctx.save();
    ctx.textAlign = 'center';

    ctx.shadowColor = 'rgba(255,150,80,0.3)';
    ctx.shadowBlur = 40;
    ctx.font = Math.round(Math.min(W * 0.14, 90)) + 'px "Titan One", sans-serif';
    ctx.fillStyle = '#ffd6a0';
    ctx.fillText('TROPIC', W / 2, H * 0.33);
    ctx.fillStyle = '#ff8a5c';
    ctx.fillText('MERGE', W / 2, H * 0.46);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,200,160,0.5)';
    ctx.font = Math.round(Math.min(W * 0.028, 14)) + 'px Outfit, sans-serif';
    ctx.fillText('move &middot; release &middot; merge', W / 2, H * 0.54);

    var bw = Math.min(W * 0.5, 200);
    var bh = Math.min(H * 0.065, 52);
    var bx = (W - bw) / 2;
    var by = H * 0.6;
    this._playBtn = { x: bx, y: by, w: bw, h: bh };

    ctx.shadowColor = 'rgba(255,138,92,0.4)';
    ctx.shadowBlur = 20;
    var grad = ctx.createLinearGradient(bx, by, bx, by + bh);
    grad.addColorStop(0, '#ff8a5c');
    grad.addColorStop(1, '#ff5f6d');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff5e6';
    ctx.font = 'bold ' + Math.round(Math.min(W * 0.045, 20)) + 'px Outfit, sans-serif';
    ctx.fillText('PLAY', W / 2, by + bh * 0.62);

    ctx.fillStyle = 'rgba(255,200,160,0.35)';
    ctx.font = Math.round(Math.min(W * 0.022, 11)) + 'px Outfit, sans-serif';
    ctx.fillText('cherry &rarr; strawberry &rarr; grape &rarr; orange &rarr; apple', W / 2, H * 0.72);
    ctx.fillText('pear &rarr; peach &rarr; melon &rarr; watermelon', W / 2, H * 0.76);

    var sbw = Math.min(W * 0.35, 140);
    var sbh = Math.min(H * 0.045, 36);
    var sbx = (W - sbw) / 2;
    var sby = H * 0.8;
    this._sandboxBtn = { x: sbx, y: sby, w: sbw, h: sbh };

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = 'rgba(255,138,92,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(sbx, sby, sbw, sbh, sbh / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d4a574';
    ctx.font = 'bold ' + Math.round(Math.min(W * 0.03, 13)) + 'px Outfit, sans-serif';
    ctx.fillText('SANDBOX', W / 2, sby + sbh * 0.62);

    ctx.restore();
  };

  Game.prototype.renderHUD = function (ctx, W, H) {
    var pad = 12 * this.scale;
    var barH = 40 * this.scale;
    var barY = H - barH;

    ctx.fillStyle = 'rgba(10,5,20,0.5)';
    ctx.fillRect(0, barY, W, barH);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe8c0';
    ctx.font = 'bold ' + Math.round(18 * this.scale) + 'px Outfit, sans-serif';
    ctx.shadowColor = 'rgba(255,180,80,0.3)';
    ctx.shadowBlur = 8;
    ctx.fillText(this.score, pad + 4, barY + barH * 0.68);
    ctx.shadowBlur = 0;

    ctx.textAlign = 'right';
    ctx.fillStyle = '#d4a574';
    ctx.font = Math.round(12 * this.scale) + 'px Outfit, sans-serif';
    ctx.fillText('BEST ' + this.best, W - pad, barY + barH * 0.68);
  };

  Game.prototype.renderGameOver = function (ctx, W, H) {
    ctx.fillStyle = 'rgba(10,5,20,0.65)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255,100,80,0.5)';
    ctx.shadowBlur = 30;
    ctx.font = Math.round(Math.min(W * 0.09, 56)) + 'px "Titan One", sans-serif';
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText('GAME OVER', W / 2, H * 0.35);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffe8c0';
    ctx.font = 'bold ' + Math.round(Math.min(W * 0.07, 40)) + 'px Outfit, sans-serif';
    ctx.shadowColor = 'rgba(255,180,80,0.4)';
    ctx.shadowBlur = 12;
    ctx.fillText(this.score, W / 2, H * 0.47);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d4a574';
    ctx.font = Math.round(Math.min(W * 0.028, 14)) + 'px Outfit, sans-serif';
    ctx.fillText('SCORE', W / 2, H * 0.5);

    ctx.fillStyle = '#d4a574';
    ctx.font = Math.round(Math.min(W * 0.04, 28)) + 'px Outfit, sans-serif';
    ctx.shadowColor = 'rgba(255,180,80,0.3)';
    ctx.shadowBlur = 10;
    ctx.fillText('BEST ' + this.best, W / 2, H * 0.58);
    ctx.shadowBlur = 0;

    var bw = Math.min(W * 0.5, 200);
    var bh = Math.min(H * 0.055, 44);
    var bx = (W - bw) / 2;
    var by = H * 0.64;
    this._retryBtn = { x: bx, y: by, w: bw, h: bh };

    ctx.shadowColor = 'rgba(255,138,92,0.3)';
    ctx.shadowBlur = 16;
    var grad = ctx.createLinearGradient(bx, by, bx, by + bh);
    grad.addColorStop(0, '#ff8a5c');
    grad.addColorStop(1, '#ff5f6d');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff5e6';
    ctx.font = 'bold ' + Math.round(Math.min(W * 0.04, 18)) + 'px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RETRY', W / 2, by + bh * 0.62);

    var mbw = Math.min(W * 0.4, 160);
    var mbh = Math.min(H * 0.045, 36);
    var mbx = (W - mbw) / 2;
    var mby = by + bh + 14 * this.scale;
    this._menuBtn = { x: mbx, y: mby, w: mbw, h: mbh };

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeStyle = 'rgba(255,138,92,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(mbx, mby, mbw, mbh, mbh / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d4a574';
    ctx.font = 'bold ' + Math.round(Math.min(W * 0.032, 14)) + 'px Outfit, sans-serif';
    ctx.fillText('MENU', W / 2, mby + mbh * 0.62);
  };

  Game.prototype.renderDropPreview = function (ctx, W, H) {
    if ((this.state !== 'playing' && this.state !== 'sandbox') || !this.canDrop) return;
    var ft = FRUITS[this.nextType];
    var r = ft.r * this.scale;
    var px = this.dropX;
    var py = this.dangerY - r * 1.5;

    var dashLen = 6 * this.scale;
    ctx.setLineDash([dashLen, dashLen]);
    ctx.strokeStyle = 'rgba(255,200,150,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, this.dangerY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 0.25 + 0.25 * Math.sin(this.bgPhase * 6);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = ft.color;
    ctx.shadowColor = ft.glow;
    ctx.shadowBlur = r * 1.5;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(255,200,150,0.35)';
    ctx.font = Math.round(11 * this.scale) + 'px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAP TO DROP', px, py + r + 18 * this.scale);
  };

  Game.prototype.renderPlayArea = function (ctx, W, H) {
    ctx.strokeStyle = 'rgba(255,180,120,0.18)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, W - 3, this.floorY - 1.5);

    var g = ctx.createLinearGradient(0, this.floorY, 0, H);
    g.addColorStop(0, 'rgba(255,150,100,0.08)');
    g.addColorStop(1, 'rgba(255,150,100,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, this.floorY, W, H - this.floorY);
  };

  Game.prototype.renderGrid = function (ctx, W, H) {
    var spacing = 40;
    var off = (this.bgPhase * spacing * 2) % spacing;
    ctx.strokeStyle = 'rgba(255,160,100,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = -off; x < W; x += spacing) {
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    for (var y = -off; y < H; y += spacing) {
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();
  };

  Game.prototype.drawFruit = function (ctx, f) {
    var ft = FRUITS[f.type];
    var r = f.r;
    var x = f.x, y = f.y;

    ctx.save();
    ctx.shadowColor = ft.glow;
    ctx.shadowBlur = r * 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = ft.color;
    ctx.fill();
    ctx.shadowBlur = 0;

    var grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.25)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(x - r * 0.22, y - r * 0.28, r * 0.14, 0, Math.PI * 2);
    ctx.fill();

    if (r > 18) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      var seedCount = 2 + Math.floor(r / 20);
      for (var s = 0; s < seedCount; s++) {
        var angle = s / seedCount * Math.PI * 2 + 0.3;
        var sd = r * 0.3;
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * sd, y + Math.sin(angle) * sd, r * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  };

  Game.prototype.destroy = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
  };

  NS.FRUITS = FRUITS;
  NS.Game = Game;
})();
