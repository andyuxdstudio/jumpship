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
  var overlay = document.getElementById("jump-overlay");
  var skipButton = document.getElementById("jump-skip");
  var sceneTitle = document.getElementById("jump-title");
  var overlayTimer = null;
  var wheelStatus = document.getElementById("wheel-status");
  var wheelResult = document.getElementById("wheel-result");
  var resultSection = document.getElementById("result");
  var wildcards = null;
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

  /* Scroll down so the wave divider above the result is out of view. */
  function revealWheelResult() {
    var top = resultSection.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop);
    window.scrollTo({ top: top + 20, behavior: reducedMotion() ? "auto" : "smooth" });
  }

  function closeOverlay() {
    window.clearTimeout(overlayTimer);
    overlay.hidden = true;
    overlay.classList.remove("is-running");
    document.body.classList.remove("no-scroll");
  }

  function wheelShow() {
    if (!wheelBusy) return;
    var index;
    do { index = Math.floor(Math.random() * wildcards.length); } while (wildcards.length > 1 && index === lastWildcard);
    lastWildcard = index;
    var wild = wildcards[index];
    wheelResult.textContent = "";
    resultSection.hidden = false;
    document.body.classList.add("has-result");
    wheelResult.appendChild(buildWildcardCard(wild));
    wheelStatus.textContent = "The wheel chose " + wild.name + ".";
    wheelBusy = false;
    closeOverlay();
    revealWheelResult();
    wheelButton.disabled = false;
    wheelButton.textContent = "Jump again";
    wheelButton.focus({ preventScroll: true });
  }

  function spinWheel() {
    if (wheelBusy) return;
    if (!wildcards || !wildcards.length) {
      wheelStatus.classList.remove("visually-hidden");
      wheelStatus.textContent = "The wheel could not load its careers. Refresh the page and try again.";
      return;
    }
    var reduce = reducedMotion();
    wheelBusy = true;
    wheelButton.disabled = true;
    sceneTitle.firstChild.nodeValue = reduce ? "Setting sail" : "Jumping ship";
    overlay.hidden = false;
    document.body.classList.add("no-scroll");
    skipButton.focus();
    overlay.classList.remove("is-running");
    void overlay.offsetWidth;
    overlay.classList.add("is-running");
    overlayTimer = window.setTimeout(wheelShow, reduce ? 1000 : 4400);
  }

  skipButton.addEventListener("click", wheelShow);
  overlay.addEventListener("keydown", function (event) {
    if (event.key === "Escape") { wheelShow(); }
    if (event.key === "Tab") { event.preventDefault(); skipButton.focus(); }
  });

  wheelButton.addEventListener("click", spinWheel);

  /* ---------- Background: a quiet night sky. Faint twinkling stars, and now and then a shooting star ---------- */

  (function nightSky() {
    var canvas = document.createElement("canvas");
    canvas.className = "dust";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var stars = [];
    var shots = [];
    var width = 0, height = 0, ratio = 1;
    var startTime = Date.now();
    var nextShot = 0;
    var last = 0;

    function build() {
      stars = [];
      var count = Math.max(50, Math.min(150, Math.round(width * height / 9000)));
      for (var i = 0; i < count; i += 1) {
        var big = Math.random() < 0.12;
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: big ? 1.2 + Math.random() * 0.6 : 0.5 + Math.random() * 0.6,
          alpha: big ? 0.6 : 0.25 + Math.random() * 0.3,
          speed: 0.02 + Math.random() * 0.05,            // a very slight drift with scrolling
          rate: 0.4 + Math.random() * 1.2,               // twinkle speed
          phase: Math.random() * Math.PI * 2
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
      draw(Date.now());
    }

    function colour() {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      return dark ? "232,243,246" : "12,42,69";
    }

    function launchShot() {
      var fromLeft = Math.random() < 0.5;
      var angle = (18 + Math.random() * 22) * Math.PI / 180;     // gentle downward slope
      var dir = fromLeft ? 1 : -1;
      shots.push({
        x: fromLeft ? Math.random() * width * 0.5 : width * 0.5 + Math.random() * width * 0.5,
        y: Math.random() * height * 0.45,
        vx: Math.cos(angle) * dir,
        vy: Math.sin(angle),
        len: 90 + Math.random() * 70,
        born: Date.now(),
        life: 900 + Math.random() * 400,
        travel: 260 + Math.random() * 200
      });
    }

    function draw(now) {
      var calm = reducedMotion();
      var scroll = calm ? 0 : (window.pageYOffset || 0);
      var t = calm ? 0 : (now - startTime) / 1000;
      var rgb = colour();
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // The first wave divider on the page is the horizon. Nothing is drawn below it.
      var horizon = height;
      var edges = [document.getElementById("result"), document.querySelector(".site-footer")];
      for (var e = 0; e < edges.length; e += 1) {
        if (edges[e] && !edges[e].hidden) { horizon = Math.min(height, edges[e].getBoundingClientRect().top); break; }
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, Math.max(0, horizon));
      ctx.clip();

      for (var i = 0; i < stars.length; i += 1) {
        var s = stars[i];
        var y = ((s.y - scroll * s.speed) % height + height) % height;
        var tw = calm ? 1 : 0.65 + 0.35 * Math.sin(t * s.rate + s.phase);
        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + rgb + "," + (s.alpha * tw).toFixed(3) + ")";
        ctx.fill();
      }

      if (calm) { ctx.restore(); return; }
      if (now >= nextShot) {
        launchShot();
        nextShot = now + 7000 + Math.random() * 9000;
      }
      ctx.lineCap = "round";
      for (var k = shots.length - 1; k >= 0; k -= 1) {
        var m = shots[k];
        var p = (now - m.born) / m.life;
        if (p >= 1) { shots.splice(k, 1); continue; }
        var head = p * m.travel;
        var hx = m.x + m.vx * head;
        var hy = m.y + m.vy * head;
        var tail = m.len * Math.sin(Math.PI * Math.min(p * 1.1, 1));   // grows, then shrinks away
        var fade = Math.sin(Math.PI * p);
        var grad = ctx.createLinearGradient(hx, hy, hx - m.vx * tail, hy - m.vy * tail);
        grad.addColorStop(0, "rgba(" + rgb + "," + (0.75 * fade).toFixed(3) + ")");
        grad.addColorStop(1, "rgba(" + rgb + ",0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - m.vx * tail, hy - m.vy * tail);
        ctx.stroke();
      }
      ctx.restore();
    }

    function loop(now) {
      window.requestAnimationFrame(loop);
      if (document.hidden) return;
      var wait = shots.length ? 33 : 90;     // smooth while a star is streaking, calm otherwise
      if (now - last < wait) return;
      last = now;
      draw(Date.now());
    }

    nextShot = Date.now() + 3500;
    window.addEventListener("scroll", function () { if (reducedMotion()) draw(Date.now()); }, { passive: true });
    window.addEventListener("resize", size);
    new MutationObserver(function () { draw(Date.now()); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    size();
    if (!reducedMotion()) window.requestAnimationFrame(loop);
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
