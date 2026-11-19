/* Illustration only: made-up events, hash-linked entries, one entry missing from the export. */
(function () {
  var events = [
    ["09:14:02", "agent.start"],
    ["09:14:05", "tool.search"],
    ["09:14:09", "tool.read_file"],
    ["09:14:16", "refund.create"],
    ["09:14:21", "email.send"],
    ["09:14:30", "agent.stop"]
  ];
  var MISSING = 3; // zero-based: the refund entry is left out of the export
  var rowsEl = document.getElementById("rows");
  var verdict = document.getElementById("verdict");
  var run = document.getElementById("run");
  if (!rowsEl || !run) return;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canHash = window.crypto && window.crypto.subtle && window.TextEncoder;

  function sha(text) {
    if (!canHash) return Promise.resolve("--------");
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) {
        return ("0" + x.toString(16)).slice(-2);
      }).join("");
    });
  }

  var chain = []; // full chain: {seq,t,ev,prev,hash}
  var shown = []; // what the operator exports

  function build() {
    var p = Promise.resolve("0000");
    var prev = "0000";
    events.forEach(function (e, i) {
      p = p.then(function (prevHash) {
        return sha(prevHash + "|" + (i + 1) + "|" + e[0] + "|" + e[1]).then(function (h) {
          chain.push({ seq: i + 1, t: e[0], ev: e[1], prev: prevHash, hash: h.slice(0, 8) });
          return h.slice(0, 8);
        });
      });
    });
    return p.then(function () {
      shown = chain.filter(function (_, i) { return i !== MISSING; });
      render();
    });
  }

  function render() {
    rowsEl.innerHTML = "";
    shown.forEach(function (r, i) {
      var li = document.createElement("li");
      li.className = "row";
      li.id = "row-" + i;
      li.innerHTML =
        '<span class="seq">' + String(r.seq).padStart(2, "0") + "</span>" +
        '<span class="t">' + r.t + "</span>" +
        '<span class="ev">' + r.ev + "</span>" +
        '<span class="h">' + r.hash + "</span>";
      rowsEl.appendChild(li);
    });
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); });
  }

  function check() {
    run.disabled = true;
    verdict.className = "verdict";
    verdict.textContent = "Checking each entry against the one before it.";
    var rows = rowsEl.children;
    var i = 0, bad = null;
    function step() {
      if (i >= shown.length) return finish();
      var r = shown[i], el = rows[i];
      el.className = "row scanning";
      return sleep(380).then(function () {
        var seqOk = i === 0 || r.seq === shown[i - 1].seq + 1;
        var linkOk = i === 0 || !canHash || r.prev === shown[i - 1].hash;
        if (seqOk && linkOk) {
          el.className = "row ok";
        } else {
          el.className = "row bad";
          var n = document.createElement("span");
          n.className = "gapnote";
          n.textContent = "Expected entry " + String(shown[i - 1].seq + 1).padStart(2, "0") +
            ", found " + String(r.seq).padStart(2, "0") +
            (canHash ? ". The link to the previous entry does not match." : ".");
          el.appendChild(n);
          if (!bad) bad = r;
        }
        i++;
        return step();
      });
    }
    function finish() {
      if (bad) {
        verdict.className = "verdict bad";
        verdict.textContent = "Gap found. The export jumps from entry 03 to entry 05, so an entry is missing.";
      } else {
        verdict.textContent = "No gap found in this export.";
      }
      run.disabled = false;
      run.textContent = "Run again";
    }
    return step();
  }

  run.addEventListener("click", function () {
    render();
    check();
  });

  build();
})();
