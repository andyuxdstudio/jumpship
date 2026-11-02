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
  var titleTimer = null;
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
    var badge = document.createElement("span");
    badge.className = "career-badge";
    badge.setAttribute("aria-hidden", "true");
    var badgeText = document.createElement("span");
    badgeText.className = "career-badge-text";
    badgeText.textContent = "Your career alternative";
    badge.appendChild(badgeText);
    card.appendChild(badge);
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
    window.clearTimeout(titleTimer);
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
    document.dispatchEvent(new CustomEvent("jumpship:result"));
    wheelBusy = false;
    closeOverlay();
    revealWheelResult();
    wheelButton.disabled = false;
    document.getElementById("wheel-label").textContent = "Jump again";
    wheelButton.focus({ preventScroll: true });
  }

  var creatureBag = [];
  var creatureLast = "";
  var creatureFirstDone = false;
  function nextCreature() {
    /* the very first jump is always the shark, then the other three come up in a random order */
    if (!creatureFirstDone) { creatureFirstDone = true; return "shark"; }
    if (!creatureBag.length) {
      creatureBag = ["squid", "jelly", "crab"];
      for (var i = creatureBag.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = creatureBag[i]; creatureBag[i] = creatureBag[j]; creatureBag[j] = t;
      }
      /* never the same creature twice in a row across a reshuffle */
      if (creatureBag[creatureBag.length - 1] === creatureLast) { creatureBag.unshift(creatureBag.pop()); }
    }
    creatureLast = creatureBag.pop();
    return creatureLast;
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
    /* first jump is always the shark, then the other three creatures take turns */
    overlay.setAttribute("data-creature", nextCreature());
    overlay.hidden = false;
    document.body.classList.add("no-scroll");
    skipButton.focus();
    overlay.classList.remove("is-running");
    void overlay.offsetWidth;
    overlay.classList.add("is-running");
    window.clearTimeout(titleTimer);
    if (!reduce) {
      titleTimer = window.setTimeout(function () {
        sceneTitle.firstChild.nodeValue = "Searching";
      }, 3200);
    }
    overlayTimer = window.setTimeout(wheelShow, reduce ? 1000 : 5200);
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
    var clouds = [];
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

    function buildClouds() {
      clouds = [];
      // Each cloud keeps to its own horizontal lane, so clouds never overlap whatever speed they drift at
      var laneTop = 200;
      var laneBottom = Math.max(laneTop + 110, height * 0.75);
      var lanes = [];
      for (var ly = laneTop; ly <= laneBottom; ly += 115) lanes.push(ly);
      for (var s = lanes.length - 1; s > 0; s -= 1) {
        var pick = Math.floor(Math.random() * (s + 1));
        var swap = lanes[s]; lanes[s] = lanes[pick]; lanes[pick] = swap;
      }
      var count = Math.min(lanes.length, Math.max(3, Math.min(6, Math.round(width / 260))));
      for (var i = 0; i < count; i += 1) {
        var depth = 0.35 + Math.random() * 0.65;               // nearer clouds are bigger and faster
        var w = 70 + depth * 110;
        var bumps = [];
        var n = 4 + Math.floor(Math.random() * 3);
        for (var k = 0; k < n; k += 1) {
          var t = n === 1 ? 0.5 : k / (n - 1);
          var r = w * (0.13 + 0.11 * Math.sin(Math.PI * t) + Math.random() * 0.04);
          bumps.push({ dx: (t - 0.5) * w * 0.9, dy: -r * 0.45 - Math.random() * w * 0.04, r: r });
        }
        clouds.push({
          x: Math.random() * (width + 400),
          y: lanes[i] + (Math.random() * 16 - 8),
          w: w, depth: depth, bumps: bumps,
          drift: 5 + depth * 13,                               // pixels a second, right to left
          par: 0.04 + depth * 0.12,                            // scroll parallax
          alpha: 0.75 + depth * 0.2
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
      buildClouds();
      draw(Date.now());
    }

    function isDark() {
      return document.documentElement.getAttribute("data-theme") === "dark";
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

    function drawClouds(t, scroll) {
      for (var i = 0; i < clouds.length; i += 1) {
        var c = clouds[i];
        var span = width + c.w + 200;
        var x = ((c.x - t * c.drift) % span + span) % span - c.w * 0.5 - 100;
        var y = c.y - scroll * 0.08;
        // Soft white body with a faint blue-grey shadow beneath, no outline
        ctx.save();
        ctx.shadowColor = "rgba(90,140,160,0.30)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = "rgba(255,255,255," + c.alpha.toFixed(3) + ")";
        ctx.beginPath();
        for (var k = 0; k < c.bumps.length; k += 1) {
          var b = c.bumps[k];
          ctx.moveTo(x + b.dx + b.r, y + b.dy);
          ctx.arc(x + b.dx, y + b.dy, b.r, 0, Math.PI * 2);
        }
        ctx.rect(x - c.w * 0.42, y - c.w * 0.04, c.w * 0.84, c.w * 0.08);
        ctx.fill();
        ctx.restore();
      }
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

      if (!isDark()) {
        drawClouds(t, scroll);
        ctx.restore();
        return;
      }

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
      var wait = (shots.length || !isDark()) ? 33 : 90;     // smooth while a star is streaking, calm otherwise
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
  /* Return to boat: scroll back up to the Jump button, leaving the result in place */
  (function returnToBoat() {
    var button = document.getElementById("swim-back");
    if (!button) return;
    button.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
      wheelButton.focus({ preventScroll: true });
    });

    /* On mobile the button floats at the bottom of the screen once the reader scrolls
       into the career card and nears its end, then settles into place under the card. */
    var holder = button.parentNode;
    var narrow = window.matchMedia("(max-width: 55.99rem)");
    var ticking = false;
    var baseline = null;   /* scroll position once the automatic scroll to the result has settled */
    var armTimer = null;
    var autoUntil = 0;
    document.addEventListener("jumpship:result", function () {
      baseline = null;
      window.clearTimeout(leaveTimer);
      setClasses(false, false);
      window.clearTimeout(armTimer);
      autoUntil = Date.now() + 1100;
      armTimer = window.setTimeout(function () {
        baseline = window.pageYOffset || document.documentElement.scrollTop;
        queue();
      }, 1150);
    });
    var leaveTimer = null;
    function setClasses(on, leaving) {
      [button, holder].forEach(function (el) {
        el.classList.toggle("is-floating", on);
        el.classList.toggle("is-leaving", leaving);
      });
    }
    /* Slide in when scrolling down; slide out when scrolling back up; swap instantly
       when the normal button under the card comes into view. */
    function setFloating(on, handOff) {
      var floatingNow = button.classList.contains("is-floating");
      var leaving = button.classList.contains("is-leaving");
      if (on) {
        window.clearTimeout(leaveTimer);
        if (!floatingNow || leaving) setClasses(true, false);
      } else if (floatingNow && !leaving) {
        if (handOff) { window.clearTimeout(leaveTimer); setClasses(false, false); return; }
        setClasses(true, true);
        window.clearTimeout(leaveTimer);
        leaveTimer = window.setTimeout(function () { setClasses(false, false); }, reducedMotion() ? 0 : 400);
      } else if (leaving && handOff) {
        window.clearTimeout(leaveTimer);
        setClasses(false, false);
      }
      /* already leaving: further scroll events must not cut the exit animation short */
    }
    function update() {
      ticking = false;
      var floating = false;
      var spotVisible = false;
      if (narrow.matches && !resultSection.hidden) {
        var vh = window.innerHeight;
        var card = wheelResult.getBoundingClientRect();
        var spot = holder.getBoundingClientRect();
        var y = window.pageYOffset || document.documentElement.scrollTop;
        spotVisible = spot.top <= vh - 68;
        if (Date.now() < autoUntil) baseline = y;
        floating = baseline !== null && Date.now() >= autoUntil && y > baseline + 3 && card.top < vh * 0.5 && spot.top > vh - 68;
      }
      setFloating(floating, spotVisible);
    }
    function queue() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
  })();

  /* The sailor on the drifting boat occasionally speaks up */
  (function boatBubbles() {
    if (reducedMotion()) return;
    var lines = [
      "Let\u2019s jump!",
      "Hello?",
      "Hey, are we doing this?",
      "I\u2019m gonna do it...",
      "No sharks around here, right?",
      "It\u2019s gonna be OK, right?",
      "This is the life, ey?",
      "My arms hurt",
      "Definitely no sharks?",
      "I think I just saw a fin"
    ];
    var bag = [];
    /* after every jump, the very next bubble is this one (never shown before the first jump) */
    var jumpLine = "That last jump was nuts!";
    var jumpPending = false;
    var toeDone = false;
    var toeIn = 0;
    document.addEventListener("jumpship:result", function () { jumpPending = true; });
    function nextLine() {
      if (jumpPending) {
        jumpPending = false;
        if (!toeDone) { toeDone = true; toeIn = 1 + Math.floor(Math.random() * 2); }
        return jumpLine;
      }
      /* once, after the first jump: lands as the first or second bubble after "nuts" */
      if (toeIn > 0 && --toeIn === 0) return "I think that shark took my little toe";
      /* shuffle bag: every line is used once, in a random order, before any repeats */
      if (!bag.length) {
        bag = lines.slice();
        for (var i = bag.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
        }
      }
      return bag.pop();
    }
    function visibleBoat() {
      var boats = document.querySelectorAll(".drift-boat");
      for (var i = 0; i < boats.length; i++) {
        if (window.getComputedStyle(boats[i]).display === "none") continue;
        var r = boats[i].getBoundingClientRect();
        if (r.width && r.top > 40 && r.bottom < window.innerHeight && r.left > 0 && r.right < window.innerWidth) return boats[i];
      }
      return null;
    }
    function say(boat) {
      if (!boat || boat.querySelector(".boat-bubble") || document.hidden || !overlay.hidden) return;
      var bubble = document.createElement("span");
      bubble.className = "boat-bubble";
      bubble.setAttribute("aria-hidden", "true");
      bubble.textContent = nextLine();
      boat.appendChild(bubble);
      /* past the halfway point (or if it would run off the edge) the bubble speaks to the left */
      var br = boat.getBoundingClientRect();
      if (br.left + br.width / 2 > window.innerWidth / 2 || bubble.getBoundingClientRect().right > window.innerWidth - 8) {
        bubble.classList.add("is-left");
      }
      window.setTimeout(function () { if (bubble.parentNode) bubble.parentNode.removeChild(bubble); }, 4100);
    }
    /* now and then, whenever the boat happens to be fully in view */
    function occasionally() {
      say(visibleBoat());
      window.setTimeout(occasionally, 6000 + Math.random() * 7000);
    }
    window.setTimeout(occasionally, 4000 + Math.random() * 3000);
    /* and always 2 seconds after the boat sails in again from the left */
    document.querySelectorAll(".drift-boat").forEach(function (boat) {
      function entered(event) {
        if (event.target !== boat || event.animationName !== "drift-loop") return;
        window.setTimeout(function () {
          if (window.getComputedStyle(boat).display === "none") return;
          var r = boat.getBoundingClientRect();
          if (r.top > 40 && r.bottom < window.innerHeight) { boat.querySelector(".boat-bubble") || say(boat); }
        }, 2000);
      }
      boat.addEventListener("animationstart", entered);
      boat.addEventListener("animationiteration", entered);
    });
  })();

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
