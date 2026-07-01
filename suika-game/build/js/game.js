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

  Game.prototype.dropFruit = function () {
    if (this.state !== 'playing' || !this.canDrop) return;
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

    for (var step = 0; step < SUB_STEPS; step++) {
      for (var i = 0; i < fruits.length; i++) {
        var f = fruits[i];
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

    for (var i = 0; i < fruits.length; i++) {
      var f = fruits[i];
      if (Math.abs(f.vx) < 1) f.vx = 0;
      if (Math.abs(f.vy) < 1) f.vy = 0;
    }

    var merged = [];
    for (var i = 0; i < fruits.length; i++) {
      for (var j = i + 1; j < fruits.length; j++) {
        var a = fruits[i], b = fruits[j];
        if (a.merged || b.merged) continue;
        if (a.type !== b.type || a.type >= FRUITS.length - 1) continue;
        var dx = b.x - a.x, dy = b.y - a.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < (a.r + b.r) * 0.6) {
          a.merged = true;
          b.merged = true;
          merged.push({
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            vx: (a.vx + b.vx) / 2,
            vy: (a.vy + b.vy) / 2,
            type: a.type + 1
          });
          this.combo++;
          var pts = FRUITS[a.type + 1].score;
          this.score += pts;
          if (this.score > this.best) {
            this.best = this.score;
            try { localStorage.setItem('suikabest', String(this.best)); } catch (e) {}
          }
          this.hooks.onScore && this.hooks.onScore(this.score);
          this.hooks.onMerge && this.hooks.onMerge(a.type + 1, (a.x + b.x) / 2, (a.y + b.y) / 2);
          NS.audio && NS.audio.merge(a.type + 1);
          this.flash = 0.3;
        }
      }
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
    }
    this.fruits = filtered;

    if (this.combo >= 3) {
      this.combo = 0;
    }
  };

  Game.prototype.update = function (dt) {
    this.bgPhase += dt * 0.1;
    this.flash = Math.max(0, this.flash - dt * 2);

    if (this.state === 'playing') {
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
          this.gameOver();
          return;
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

  Game.prototype.setDropX = function (x) {
    this.dropX = clamp(x, 0, this.W);
  };

  Game.prototype.render = function () {
    var ctx = this.ctx;
    var W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);

    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0820');
    bg.addColorStop(0.5, '#0c0a26');
    bg.addColorStop(1, '#06050f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    this.renderGrid(ctx, W, H);

    ctx.save();
    var sx = 0, sy = 0;
    if (this.shake > 0.2) {
      sx = (Math.random() * 2 - 1) * this.shake;
      sy = (Math.random() * 2 - 1) * this.shake;
    }
    ctx.translate(sx, sy);
    this.renderPlayArea(ctx, W, H);

    for (var i = 0; i < this.fruits.length; i++) {
      this.drawFruit(ctx, this.fruits[i]);
    }

    if (this.state === 'playing' && this.canDrop) {
      var ft = FRUITS[this.nextType];
      var r = ft.r * this.scale;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(this.dropX, this.dangerY - r * 1.5, r, 0, Math.PI * 2);
      ctx.fillStyle = ft.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

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
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(255,255,255,0.5)';
      ctx.shadowBlur = 12;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    if (this.flash > 0.02) {
      ctx.fillStyle = 'rgba(255,255,255,' + (this.flash * 0.2) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    if (this.state !== 'title') {
      var dangerW = W * 0.02;
      var dashLen = 8 * this.scale;
      ctx.strokeStyle = 'rgba(255,60,60,0.5)';
      ctx.lineWidth = Math.max(2, dangerW);
      ctx.setLineDash([dashLen, dashLen]);
      ctx.beginPath();
      ctx.moveTo(0, this.dangerY);
      ctx.lineTo(W, this.dangerY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  };

  Game.prototype.renderPlayArea = function (ctx, W, H) {
    ctx.strokeStyle = 'rgba(120,180,255,0.12)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, W - 3, this.floorY - 1.5);

    var g = ctx.createLinearGradient(0, this.floorY, 0, H);
    g.addColorStop(0, 'rgba(120,180,255,0.08)');
    g.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, this.floorY, W, H - this.floorY);
  };

  Game.prototype.renderGrid = function (ctx, W, H) {
    var spacing = 40;
    var off = (this.bgPhase * spacing * 2) % spacing;
    ctx.strokeStyle = 'rgba(90,120,220,0.05)';
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
    ctx.shadowBlur = r * 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = ft.color;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x - r * 0.2, y - r * 0.25, r * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();

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
