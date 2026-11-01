/* Jump Ship: spin the wheel for a random career.
   No framework. The only network call reads data/wildcards.json. */
(function () {
  "use strict";

  function addRow(list, term, build) {
    var row = document.createElement("div");
    var dt = document.createElement("dt");
    var dd = document.createElement("dd");
    dt.textContent = term;
    build(dd);
    row.appendChild(dt);
    row.appendChild(dd);
    list.appendChild(row);
  }

  function buildCharacter(id) {
    var art = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    art.setAttribute("class", "wild-char");
    art.setAttribute("viewBox", "0 0 120 130");
    art.setAttribute("aria-hidden", "true");
    art.setAttribute("focusable", "false");
    use.setAttribute("href", "#ch-" + id);
    art.appendChild(use);
    return art;
  }

  /* ---------- Wheel ---------- */

  var wheelButton = document.getElementById("wheel-button");
  var wheelSpin = document.getElementById("wheel-spin");
  var wheelBox = document.querySelector(".wheel-box");
  var wheelStatus = document.getElementById("wheel-status");
  var wheelResult = document.getElementById("wheel-result");
  var resultSection = document.getElementById("result");
  var wildcards = null;
  var wheelTurn = 0;
  var wheelBusy = false;
  var lastWildcard = -1;

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function buildWildcardCard(wild) {
    var item = document.createElement("li");
    var card = document.createElement("article");
    var heading = document.createElement("h3");
    var hook = document.createElement("p");
    var details = document.createElement("dl");

    card.className = "match";
    card.setAttribute("aria-labelledby", "wild-" + wild.id);
    heading.id = "wild-" + wild.id;
    heading.textContent = wild.name;
    hook.className = "match-why";
    hook.textContent = wild.hook;

    addRow(details, "Typical pay", function (dd) {
      dd.appendChild(document.createTextNode(wild.pay + ". This is an estimate."));
      var source = document.createElement("span");
      source.className = "pay-source";
      var link = document.createElement("a");
      link.href = wild.sourceUrl;
      link.rel = "noopener";
      link.textContent = "Check the source: " + wild.sourceLabel;
      source.appendChild(link);
      dd.appendChild(source);
    });

    card.appendChild(heading);
    card.appendChild(hook);
    card.appendChild(details);

    var flags = document.createElement("ul");
    flags.className = "flags";
    flags.setAttribute("aria-label", "About this pick");
    var flag = document.createElement("li");
    flag.textContent = "Picked at random. It is not matched to your skills, pay or hours, and we have not checked how it fits them.";
    flags.appendChild(flag);
    card.appendChild(flags);

    if (wild.aiRisk) {
      var risk = document.createElement("div");
      var big = document.createElement("p");
      var basis = document.createElement("p");
      var src = document.createElement("p");
      risk.className = "ai-risk";
      risk.setAttribute("role", "group");
      risk.setAttribute("aria-label", "AI risk estimate");
      var robot = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      robot.setAttribute("class", "ai-robot");
      robot.setAttribute("aria-hidden", "true");
      robot.setAttribute("focusable", "false");
      var robotUse = document.createElementNS("http://www.w3.org/2000/svg", "use");
      robotUse.setAttribute("href", "#ic-robot");
      robot.appendChild(robotUse);
      risk.appendChild(robot);
      var riskText = document.createElement("div");
      riskText.className = "ai-risk-text";
      risk.appendChild(riskText);
      big.className = "ai-risk-figure";
      var hasPct = typeof wild.aiRisk.percent === "number";
      big.textContent = hasPct
        ? "About " + wild.aiRisk.percent + "% risk that AI eliminates this role within 5 years"
        : "No estimate of the risk that AI eliminates this role";
      basis.className = "ai-risk-basis";
      basis.textContent = hasPct
        ? "Our rough guess, not a forecast. " + wild.aiRisk.basis + " None of these sites measure a five year job loss, so we blended them into one cautious number."
        : wild.aiRisk.basis;
      src.className = "ai-risk-basis";
      if (wild.aiRisk.sources.length) src.appendChild(document.createTextNode("Sources: "));
      wild.aiRisk.sources.forEach(function (x, i) {
        var a = document.createElement("a");
        a.href = x.url;
        a.rel = "noopener";
        a.textContent = x.label;
        if (i) src.appendChild(document.createTextNode(", "));
        src.appendChild(a);
      });
      riskText.appendChild(big);
      riskText.appendChild(basis);
      if (wild.aiRisk.sources.length) riskText.appendChild(src);
      card.appendChild(risk);
    }

    item.className = "wild-item";
    item.appendChild(card);
    card.classList.add("has-char");
    card.appendChild(buildCharacter(wild.id));
    return item;
  }

  /* Gently scroll so the result is on screen and the button stays in view. */
  function revealWheelResult() {
    var margin = 16;
    var viewH = window.innerHeight || document.documentElement.clientHeight;
    var buttonTop = wheelButton.getBoundingClientRect().top;
    var resultBottom = wheelResult.getBoundingClientRect().bottom;
    var needed = resultBottom - viewH + margin;
    var allowed = buttonTop - margin;
    var by = Math.min(needed, allowed);
    if (by <= 4) return;
    window.scrollBy({ top: by, behavior: reducedMotion() ? "auto" : "smooth" });
  }

  function wheelShow() {
    var index;
    do { index = Math.floor(Math.random() * wildcards.length); } while (wildcards.length > 1 && index === lastWildcard);
    lastWildcard = index;
    var wild = wildcards[index];
    wheelResult.textContent = "";
    resultSection.hidden = false;
    wheelResult.appendChild(buildWildcardCard(wild));
    wheelStatus.textContent = "The wheel chose " + wild.name + ".";
    wheelBusy = false;
    wheelBox.classList.remove("is-spinning");
    revealWheelResult();
    wheelButton.disabled = false;
    wheelButton.textContent = "Spin again";
  }

  function spinWheel() {
    if (wheelBusy) return;
    if (!wildcards || !wildcards.length) {
      wheelStatus.textContent = "The wheel could not load its careers. Refresh the page and try again.";
      return;
    }
    if (reducedMotion()) { wheelShow(); return; }
    wheelBusy = true;
    wheelButton.disabled = true;
    wheelStatus.textContent = "Spinning.";
    wheelBox.classList.add("is-spinning");
    wheelTurn += 1440 + Math.floor(Math.random() * 360);
    wheelSpin.style.transform = "rotate(" + wheelTurn + "deg)";
    window.setTimeout(wheelShow, 5000);
  }

  wheelButton.addEventListener("click", spinWheel);

  /* ---------- Menu: hamburger on small screens ---------- */

  (function () {
    var header = document.querySelector(".site-header");
    var toggle = document.getElementById("nav-toggle");
    var nav = document.getElementById("site-nav");
    if (!header || !toggle || !nav) return;
    var small = window.matchMedia ? window.matchMedia("(max-width: 63.99rem)") : null;

    header.classList.add("nav-js");
    toggle.hidden = false;

    function setOpen(open, refocus) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      nav.classList.toggle("is-open", open);
      if (!open && refocus) { toggle.focus(); }
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest && event.target.closest("a")) { setOpen(false); }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { setOpen(false, true); }
    });
    if (small && small.addEventListener) {
      small.addEventListener("change", function () { setOpen(false); });
    }
  })();

  /* ---------- Background: small, subtle ocean bubbles. Bigger bubbles move faster as you scroll ---------- */

  (function oceanBubbles() {
    var canvas = document.createElement("canvas");
    canvas.className = "dust";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var bubbles = [];
    var width = 0, height = 0, ratio = 1;
    var queued = false;
    var startTime = Date.now();

    function build() {
      bubbles = [];
      var count = Math.max(24, Math.min(60, Math.round(width * height / 26000)));
      for (var i = 0; i < count; i += 1) {
        var r = 2 + Math.pow(Math.random(), 1.5) * 5;   // 2px to 7px across, mostly small
        bubbles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: r,
          speed: 0.1 + r * 0.07,                          // larger means faster
          rise: 2 + r * 1.2,                              // slow rise, pixels a second
          phase: Math.random() * Math.PI * 2,
          sway: 3 + Math.random() * 7,
          alpha: 0.07 + Math.random() * 0.06
        });
      }
    }

    function size() {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      build();
      draw();
    }

    function colour() {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      return dark ? "232,243,246" : "12,42,69";
    }

    function draw() {
      queued = false;
      var calm = reducedMotion();
      var scroll = calm ? 0 : (window.pageYOffset || 0);
      var t = calm ? 0 : (Date.now() - startTime) / 1000;
      var rgb = colour();
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      for (var i = 0; i < bubbles.length; i += 1) {
        var d = bubbles[i];
        var span = height + d.r * 4;
        // Rising slowly on their own, and pushed up faster by scrolling when they are bigger
        var y = ((d.y - scroll * d.speed - t * d.rise) % span + span) % span - d.r * 2;
        var x = d.x + Math.sin(t * 0.3 + d.phase) * d.sway;
        // A faint film, a thin rim and a small highlight, like a real bubble
        ctx.beginPath();
        ctx.arc(x, y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + rgb + "," + (d.alpha * 0.25).toFixed(3) + ")";
        ctx.fill();
        ctx.strokeStyle = "rgba(" + rgb + "," + d.alpha.toFixed(3) + ")";
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, d.r * 0.62, Math.PI * 1.15, Math.PI * 1.55);
        ctx.strokeStyle = "rgba(" + rgb + "," + (d.alpha * 1.2).toFixed(3) + ")";
        ctx.stroke();
      }
    }

    function queue() {
      if (!queued) { queued = true; window.requestAnimationFrame(draw); }
    }

    // Keep the slow rise going between scrolls
    var idle = null;
    function startIdle() {
      if (idle || reducedMotion()) return;
      idle = window.setInterval(function () { if (!document.hidden) queue(); }, 66);
    }

    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", size);
    new MutationObserver(queue).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    size();
    startIdle();
  })();

  // Sea creatures near the wheel drift at their own random speeds as the page scrolls (parallax).
  (function creatureParallax() {
    var creatures = Array.prototype.slice.call(document.querySelectorAll(".creature"));
    var box = document.querySelector(".wheel-box");
    if (!creatures.length || !box) return;
    var motion = creatures.map(function () {
      var sign = Math.random() < 0.5 ? -1 : 1;
      return { y: sign * (0.12 + Math.random() * 0.28), x: (Math.random() - 0.5) * 0.2 };
    });
    var queued = false;
    function update() {
      queued = false;
      if (reducedMotion()) {
        creatures.forEach(function (el) { el.style.translate = ""; });
        return;
      }
      var rect = box.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
      var offset = rect.top + rect.height / 2 - window.innerHeight / 2;
      creatures.forEach(function (el, i) {
        el.style.translate = (offset * motion[i].x).toFixed(1) + "px " + (offset * motion[i].y).toFixed(1) + "px";
      });
    }
    function queue() {
      if (!queued) { queued = true; window.requestAnimationFrame(update); }
    }
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    update();
  })();
  // Dark and light switch in the header. The head script has already set data-theme.
  (function themeSwitch() {
    var button = document.getElementById("theme-toggle");
    if (!button) return;
    var root = document.documentElement;
    function current() { return root.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
    function label() {
      button.setAttribute("aria-label", current() === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
    button.hidden = false;
    label();
    button.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { window.localStorage.setItem("jumpship.theme", next); } catch (error) { /* saving is optional */ }
      label();
    });
  })();

  // Back to top link in the footer: smooth scroll, then move focus to the skip link area at the top.
  (function backToTop() {
    var link = document.getElementById("back-to-top");
    if (!link) return;
    link.addEventListener("click", function (event) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
      var brand = document.querySelector(".brand");
      if (brand) brand.focus({ preventScroll: true });
    });
  })();

  fetch("data/wildcards.json")
    .then(function (response) {
      if (!response.ok) throw new Error("Request failed");
      return response.json();
    })
    .then(function (list) { wildcards = Array.isArray(list) ? list : []; })
    .catch(function () { wildcards = []; });
})();
