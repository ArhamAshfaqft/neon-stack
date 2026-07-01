(function () {
  "use strict";
  window.NS = window.NS || {};

  var ctx = null;
  var masterGain = null;
  var muted = false;
  var started = false;

  function ensure() {
    if (started) {
      if (ctx && ctx.state === "suspended") ctx.resume();
      return;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.4;
      masterGain.connect(ctx.destination);
      started = true;
    } catch (e) {
      ctx = null;
    }
  }

  function tone(freq, dur, type, gain, attack, slideTo) {
    if (!ctx || muted) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, gain, filterFreq) {
    if (!ctx || muted) return;
    var t = ctx.currentTime;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = filterFreq || 1200;
    var g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filt); filt.connect(g); g.connect(masterGain);
    src.start(t);
  }

  var mergePitches = [220, 277, 330, 392, 440, 523, 587, 659, 784];

  NS.audio = {
    init: ensure,
    setMuted: function (m) { muted = !!m; },
    isMuted: function () { return muted; },
    resume: ensure,
    drop: function () {
      tone(200, 0.08, "triangle", 0.2, 0.002, 120);
    },
    merge: function (type) {
      var idx = Math.min(type, mergePitches.length - 1);
      var base = mergePitches[idx];
      tone(base, 0.12, "sine", 0.25, 0.002);
      tone(base * 1.5, 0.1, "sine", 0.15, 0.004);
      noise(0.06, 0.1, 2000);
    },
    gameOver: function () {
      tone(300, 0.5, "sawtooth", 0.25, 0.002, 60);
      noise(0.4, 0.1, 500);
    },
    click: function () { tone(440, 0.06, "square", 0.12, 0.002); },
    start: function () {
      tone(330, 0.1, "triangle", 0.2, 0.002);
      tone(495, 0.12, "triangle", 0.18, 0.05);
      tone(660, 0.16, "triangle", 0.16, 0.1);
    }
  };
})();
