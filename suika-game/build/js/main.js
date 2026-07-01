(function () {
  "use strict";
  window.NS = window.NS || {};

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("game");
  var titleScreen = $("title-screen");
  var gameOverScreen = $("game-over");
  var hud = $("hud");
  var scoreEl = $("score");
  var bestEl = $("best");
  var finalScoreEl = $("final-score");
  var finalBestEl = $("final-best");
  var startBtn = $("start-btn");
  var retryBtn = $("retry-btn");
  var menuBtnGo = $("menu-btn-go");
  var muteBtn = $("mute-btn");
  var muteIcon = $("mute-icon");

  var game = new NS.Game(canvas, {
    onScore: function (s) { scoreEl.textContent = s; updateBest(); },
    onMerge: function (type, x, y) {
      var ft = NS.FRUITS[type];
      game.spawnParticles(x, y, ft.color, Math.min(8 + type * 2, 24));
      if (type >= 5) {
        game.spawnPopup(x, y - 20, "+" + ft.score);
      }
    },
    onGameOver: function (score, best) {
      finalScoreEl.textContent = score;
      finalBestEl.textContent = best;
      hud.classList.remove("show");
      gameOverScreen.classList.remove("hidden");
    },
    onReturnToMenu: function () {
      hideScreens();
      hud.classList.remove("show");
      titleScreen.classList.remove("hidden");
    }
  });

  function showHud() { hud.classList.add("show"); }
  function hideScreens() {
    titleScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
  }

  function startRun() {
    NS.audio.init();
    NS.audio.start();
    hideScreens();
    game.newRun();
    updateBest();
    showHud();
  }

  function retry() {
    NS.audio.click();
    startRun();
  }

  function returnToMenu() {
    NS.audio.click();
    game.returnToMenu();
  }

  startBtn.addEventListener("click", function (e) { e.stopPropagation(); startRun(); });
  retryBtn.addEventListener("click", function (e) { e.stopPropagation(); retry(); });
  menuBtnGo.addEventListener("click", function (e) { e.stopPropagation(); returnToMenu(); });

  canvas.addEventListener("pointerdown", function (e) {
    if (game.state === "title") { startRun(); return; }
    if (game.state === "playing") { game.dropFruit(); return; }
    if (game.state === "gameover") { retry(); return; }
  });

  canvas.addEventListener("pointermove", function (e) {
    if (game.state === "playing") {
      var rect = canvas.getBoundingClientRect();
      game.setDropX((e.clientX - rect.left) / rect.width * game.W);
    }
  });

  window.addEventListener("keydown", function (e) {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (game.state === "title") { startRun(); return; }
      if (game.state === "playing") { game.dropFruit(); return; }
      if (game.state === "gameover") { retry(); return; }
    } else if (e.key === "m" || e.key === "M") {
      toggleMute();
    }
  });

  var muted = false;
  try { muted = localStorage.getItem("neonfruit_muted") === "true"; } catch (e) {}
  NS.audio.setMuted(muted);
  muteIcon.innerHTML = muted ? "&#128263;" : "&#128266;";

  function toggleMute() {
    muted = !muted;
    NS.audio.setMuted(muted);
    try { localStorage.setItem("neonfruit_muted", muted ? "true" : "false"); } catch (e) {}
    muteIcon.innerHTML = muted ? "&#128263;" : "&#128266;";
  }
  muteBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleMute(); });

  function updateBest() {
    try { var best = parseInt(localStorage.getItem("suikabest") || "0", 10) || 0; } catch (e) { var best = 0; }
    bestEl.textContent = "BEST " + best;
  }

  (function boot() {
    game.startLoop();
    updateBest();
  })();
})();
