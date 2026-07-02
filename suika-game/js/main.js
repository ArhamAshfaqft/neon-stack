(function () {
  "use strict";
  window.NS = window.NS || {};

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("game");
  var muteBtn = $("mute-btn");
  var muteIcon = $("mute-icon");
  var sbPanel = $("sandbox-panel");
  var spawnCreatures = $("spawn-creatures");
  var spawnCountEl = $("spawn-count");
  var spawnDec = $("spawn-dec");
  var spawnInc = $("spawn-inc");
  var spawnDo = $("spawn-do");
  var sbBack = $("sb-back-btn");

  var fruitNames = ["cherry", "strawberry", "grape", "orange", "apple", "pear", "peach", "melon", "watermelon"];
  var selectedType = 4;
  var spawnCount = 1;

  var game = new NS.Game(canvas, {
    onScore: function (s) {},
    onMerge: function (type, x, y) {
      var ft = NS.FRUITS[type];
      game.spawnParticles(x, y, ft.color, Math.min(8 + type * 2, 24));
      if (type >= 5) {
        game.spawnPopup(x, y - 20, "+" + ft.score);
      }
    },
    onGameOver: function (score, best) {},
    onReturnToMenu: function () { sbPanel.classList.remove("show"); }
  });

  function startRun() {
    NS.audio.init();
    NS.audio.start();
    game.newRun();
  }

  function startSandbox() {
    NS.audio.init();
    NS.audio.start();
    game.startSandbox();
    sbPanel.classList.add("show");
    buildCreatureOpts();
  }

  function retry() {
    NS.audio.click();
    startRun();
  }

  function returnToMenu() {
    NS.audio.click();
    game.returnToMenu();
  }

  function buildCreatureOpts() {
    spawnCreatures.innerHTML = "";
    for (var i = 0; i < NS.FRUITS.length; i++) {
      var btn = document.createElement("button");
      btn.className = "creature-opt" + (i === selectedType ? " selected" : "");
      btn.style.background = NS.FRUITS[i].color;
      btn.style.borderColor = i === selectedType ? "#ff8a5c" : "rgba(255,255,255,.15)";
      btn.title = fruitNames[i];
      btn.textContent = fruitNames[i].charAt(0).toUpperCase();
      btn.dataset.idx = i;
      btn.addEventListener("click", function () {
        var prev = spawnCreatures.querySelector(".selected");
        if (prev) prev.classList.remove("selected");
        this.classList.add("selected");
        this.style.borderColor = "#ff8a5c";
        selectedType = parseInt(this.dataset.idx, 10);
      });
      spawnCreatures.appendChild(btn);
    }
  }

  spawnDec.addEventListener("click", function () { spawnCount = Math.max(1, spawnCount - 1); spawnCountEl.textContent = spawnCount; });
  spawnInc.addEventListener("click", function () { spawnCount = Math.min(50, spawnCount + 1); spawnCountEl.textContent = spawnCount; });
  spawnDo.addEventListener("click", function () { NS.audio.click(); game.spawnFruits(selectedType, spawnCount); });
  sbBack.addEventListener("click", function () { returnToMenu(); });

  canvas.addEventListener("pointerup", function (e) {
    var rect = canvas.getBoundingClientRect();
    var cx = (e.clientX - rect.left) / rect.width * game.W;
    var cy = (e.clientY - rect.top) / rect.height * game.H;

    if (game.state === "title") {
      var hit = game.hitTest(cx, cy);
      if (hit === "play") startRun();
      else if (hit === "sandbox") startSandbox();
      return;
    }
    if (game.state === "playing" || game.state === "sandbox") {
      game.setDropX(cx);
      game.dropFruit();
      return;
    }
    if (game.state === "gameover") {
      var hit = game.hitTest(cx, cy);
      if (hit === "retry") retry();
      else if (hit === "menu") returnToMenu();
      return;
    }
  });

  canvas.addEventListener("pointermove", function (e) {
    if (game.state === "playing" || game.state === "sandbox") {
      var rect = canvas.getBoundingClientRect();
      game.setDropX((e.clientX - rect.left) / rect.width * game.W);
    }
  });

  canvas.addEventListener("pointerdown", function (e) {
    if (game.state === "playing" || game.state === "sandbox") {
      var rect = canvas.getBoundingClientRect();
      game.setDropX((e.clientX - rect.left) / rect.width * game.W);
    }
  });

  window.addEventListener("keydown", function (e) {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (game.state === "title") { startRun(); return; }
      if (game.state === "playing" || game.state === "sandbox") { game.dropFruit(); return; }
      if (game.state === "gameover") { retry(); return; }
    } else if (e.key === "m" || e.key === "M") {
      toggleMute();
    }
  });

  var muted = false;
  try { muted = localStorage.getItem("tropicmerge_muted") === "true"; } catch (e) {}
  NS.audio.setMuted(muted);
  muteIcon.innerHTML = muted ? "&#128263;" : "&#128266;";

  function toggleMute() {
    muted = !muted;
    NS.audio.setMuted(muted);
    try { localStorage.setItem("tropicmerge_muted", muted ? "true" : "false"); } catch (e) {}
    muteIcon.innerHTML = muted ? "&#128263;" : "&#128266;";
  }
  muteBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleMute(); });

  (function boot() {
    game.startLoop();
  })();
})();
