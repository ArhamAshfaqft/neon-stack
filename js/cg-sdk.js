(function () {
  "use strict";
  window.NS = window.NS || {};

  const SDK_URL = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
  let sdk = null;
  let env = "disabled";
  let ready = false;
  let lastMidgame = 0;
  const MIDGAME_COOLDOWN = 180000;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("script load failed")); };
      document.head.appendChild(s);
    });
  }

  async function init() {
    if (typeof window === "undefined") return;
    try {
      await loadScript(SDK_URL);
    } catch (e) {
      env = "disabled";
      return;
    }
    try {
      if (window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.init) {
        await window.CrazyGames.SDK.init();
        sdk = window.CrazyGames.SDK;
        env = sdk.environment || "disabled";
      } else {
        env = "disabled";
      }
    } catch (e) {
      env = "disabled";
    }
    ready = true;
  }

  function call(fn, fallback) {
    if (!sdk || env === "disabled") return fallback;
    try { return fn(sdk); } catch (e) { return fallback; }
  }

  function gameplayStart() {
    call(function (s) { s.game.gameplayStart(); });
  }
  function gameplayStop() {
    call(function (s) { s.game.gameplayStop(); });
  }
  function loadingStart() {
    call(function (s) { s.game.loadingStart(); });
  }
  function loadingStop() {
    call(function (s) { s.game.loadingStop(); });
  }
  function happytime() {
    call(function (s) { s.game.happytime(); });
  }
  function setContext(obj) {
    call(function (s) { s.game.setGameContext(obj); });
  }

  function showMidgameAd() {
    return new Promise(function (resolve) {
      if (!sdk || env === "disabled") { resolve("skipped"); return; }
      const now = Date.now();
      if (now - lastMidgame < MIDGAME_COOLDOWN) { resolve("cooldown"); return; }
      NS.audio && NS.audio.setExternalMute(true);
      const cbs = {
        adStarted: function () { NS.audio && NS.audio.setExternalMute(true); },
        adFinished: function () { finish("finished"); },
        adError: function () { finish("error"); }
      };
      function finish(res) {
        lastMidgame = Date.now();
        NS.audio && NS.audio.setExternalMute(false);
        resolve(res);
      }
      try {
        sdk.ad.requestAd("midgame", cbs);
      } catch (e) { finish("error"); }
    });
  }

  function showRewardedAd() {
    return new Promise(function (resolve) {
      if (!sdk || env === "disabled") { resolve(false); return; }
      NS.audio && NS.audio.setExternalMute(true);
      let rewarded = false;
      const cbs = {
        adStarted: function () { NS.audio && NS.audio.setExternalMute(true); },
        adFinished: function () { rewarded = true; finish(); },
        adError: function () { finish(); }
      };
      function finish() {
        NS.audio && NS.audio.setExternalMute(false);
        resolve(rewarded);
      }
      try {
        sdk.ad.requestAd("rewarded", cbs);
      } catch (e) { finish(); }
    });
  }

  let bannerRequested = false;
  function requestBanner(containerId, w, h) {
    if (!sdk || env === "disabled") return Promise.resolve();
    return sdk.banner.requestBanner({ id: containerId, width: w, height: h })
      .catch(function () {});
  }
  function clearBanners() {
    if (!sdk || env === "disabled") return;
    try { sdk.banner.clearAllBanners(); } catch (e) {}
    bannerRequested = false;
  }

  NS.sdk = {
    init: init,
    get ready() { return ready; },
    get available() { return !!(sdk && env !== "disabled"); },
    get environment() { return env; },
    gameplayStart: gameplayStart,
    gameplayStop: gameplayStop,
    loadingStart: loadingStart,
    loadingStop: loadingStop,
    happytime: happytime,
    setContext: setContext,
    showMidgameAd: showMidgameAd,
    showRewardedAd: showRewardedAd,
    requestBanner: requestBanner,
    clearBanners: clearBanners
  };
})();
