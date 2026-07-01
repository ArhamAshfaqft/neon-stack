(function () {
  "use strict";
  window.NS = window.NS || {};

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("game");
  var muteBtn = $("mute-btn");
  var muteIcon = $("mute-icon");

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
    onReturnToMenu: function () {}
  });

  function startRun() {
    NS.audio.init();
    NS.audio.start();
    game.newRun();
  }

  function retry() {
    NS.audio.click();
    startRun();
  }

  function returnToMenu() {
    NS.audio.click();
    game.returnToMenu();
  }

  canvas.addEventListener("pointerup", function (e) {
    var rect = canvas.getBoundingClientRect();
    var cx = (e.clientX - rect.left) / rect.width * game.W;
    var cy = (e.clientY - rect.top) / rect.height * game.H;

    if (game.state === "title") {
      var hit = game.hitTest(cx, cy);
      if (hit === "play") startRun();
      return;
    }
    if (game.state === "playing") {
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
    if (game.state === "playing") {
      var rect = canvas.getBoundingClientRect();
      game.setDropX((e.clientX - rect.left) / rect.width * game.W);
    }
  });

  canvas.addEventListener("pointerdown", function (e) {
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
