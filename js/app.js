/* Jump Ship, stage 2: limits, skills and local saving.
   No framework and no network calls apart from reading data/skills.json.
   Answers are stored only in this browser (localStorage). */
(function () {
  "use strict";

  var STORAGE_KEY = "jumpship.v1";
  var MAX_CUSTOM = 12;
  var MAX_CUSTOM_LENGTH = 60;
  var MAX_INCOME = 1000000;
  var VALID_HOURS = [0, 8, 16, 24, 40];

  var form = document.getElementById("course-form");
  if (!form) return;

  var incomeInput = document.getElementById("income");
  var incomeError = document.getElementById("income-error");
  var skillsList = document.getElementById("skills");
  var customInput = document.getElementById("custom-skill");
  var customButton = document.getElementById("add-skill");
  var customError = document.getElementById("custom-error");
  var statusEl = document.getElementById("status");
  var clearButton = document.getElementById("clear-answers");
  var sumIncome = document.getElementById("sum-income");
  var sumHours = document.getElementById("sum-hours");
  var sumSkillsCount = document.getElementById("sum-skills-count");
  var sumSkills = document.getElementById("sum-skills");
  var preferAi = document.getElementById("prefer-low-ai");
  var matchesStatus = document.getElementById("matches-status");
  var matchesList = document.getElementById("matches-list");
  var matchesNotes = document.getElementById("matches-notes");
  var matchesNotice = document.getElementById("matches-notice");

  var catalogue = [];
  var tasters = {};
  var feelings = {};
  var FEEL_KEY = "jumpship.feel.v1";
  var careers = null; /* null while loading, an array once loaded (empty if it failed) */
  var matchTimer = null;
  var storageWorks = true;
  var state = emptyState();

  function emptyState() {
    return { income: null, hours: null, skills: [], custom: [], preferLowAi: true };
  }

  /* ---------- Saving and loading ---------- */

  function sanitise(raw) {
    var clean = emptyState();
    if (!raw || typeof raw !== "object") return clean;

    if (typeof raw.income === "number" && isFinite(raw.income) && raw.income > 0 && raw.income <= MAX_INCOME) {
      clean.income = Math.round(raw.income);
    }
    if (VALID_HOURS.indexOf(raw.hours) !== -1) clean.hours = raw.hours;
    if (typeof raw.preferLowAi === "boolean") clean.preferLowAi = raw.preferLowAi;

    if (Array.isArray(raw.skills)) {
      clean.skills = raw.skills.filter(function (id) { return typeof id === "string"; }).slice(0, 100);
    }
    if (Array.isArray(raw.custom)) {
      clean.custom = raw.custom
        .filter(function (label) { return typeof label === "string"; })
        .map(function (label) { return label.trim().slice(0, MAX_CUSTOM_LENGTH); })
        .filter(Boolean)
        .slice(0, MAX_CUSTOM);
    }
    return clean;
  }

  function load() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? sanitise(JSON.parse(stored)) : emptyState();
    } catch (err) {
      storageWorks = false;
      return emptyState();
    }
  }

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageWorks = true;
    } catch (err) {
      storageWorks = false;
    }
    setStatus(storageWorks
      ? "Saved on this device."
      : "Your browser is blocking saving, so your answers will clear when you leave this page.");
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  /* ---------- Income ---------- */

  function parseIncome(text) {
    var digits = text.replace(/[^0-9]/g, "");
    return digits ? parseInt(digits, 10) : null;
  }

  function formatIncome(value) {
    return value === null ? "" : value.toLocaleString("en-GB");
  }

  function showIncomeError(message) {
    incomeError.textContent = message;
    incomeError.hidden = !message;
    if (message) {
      incomeInput.setAttribute("aria-invalid", "true");
    } else {
      incomeInput.removeAttribute("aria-invalid");
    }
  }

  function handleIncomeInput() {
    var text = incomeInput.value.trim();
    if (text === "") {
      state.income = null;
      showIncomeError("");
      save();
      renderSummary();
      return;
    }
    var value = parseIncome(text);
    if (value === null) {
      showIncomeError("Enter a number, for example 45000.");
      return;
    }
    if (value < 1) {
      showIncomeError("Enter an amount above 0.");
      return;
    }
    if (value > MAX_INCOME) {
      showIncomeError("Enter your yearly salary before tax, for example 45000.");
      return;
    }
    showIncomeError("");
    state.income = value;
    save();
    renderSummary();
  }

  function handleIncomeBlur() {
    if (state.income !== null && !incomeInput.hasAttribute("aria-invalid")) {
      incomeInput.value = formatIncome(state.income);
    }
  }

  /* ---------- Hours ---------- */

  function handleHoursChange(event) {
    var target = event.target;
    if (target && target.name === "hours") {
      state.hours = parseInt(target.value, 10);
      save();
      renderSummary();
    }
  }

  /* ---------- Skills ---------- */

  function createSkillItem(id, label, isCustom, checked) {
    var item = document.createElement("li");
    var wrapper = document.createElement("label");
    wrapper.className = "skill";

    var input = document.createElement("input");
    input.type = "checkbox";
    input.value = id;
    input.name = "skill";
    input.checked = checked;
    if (isCustom) input.setAttribute("data-custom", "true");

    var text = document.createElement("span");
    text.textContent = label;

    wrapper.appendChild(input);
    wrapper.appendChild(text);
    item.appendChild(wrapper);
    return item;
  }

  function renderSkills() {
    skillsList.textContent = "";
    catalogue.forEach(function (skill) {
      var checked = state.skills.indexOf(skill.id) !== -1;
      skillsList.appendChild(createSkillItem(skill.id, skill.label, false, checked));
    });
    state.custom.forEach(function (label) {
      skillsList.appendChild(createSkillItem("custom:" + label, label, true, true));
    });
  }

  function handleSkillChange(event) {
    var input = event.target;
    if (!input || input.name !== "skill") return;

    if (input.getAttribute("data-custom") === "true") {
      if (!input.checked) {
        var label = input.value.replace(/^custom:/, "");
        state.custom = state.custom.filter(function (entry) { return entry !== label; });
        var item = input.closest("li");
        if (item) item.remove();
        customInput.focus();
        save();
        setStatus("Removed " + label + ". " + (storageWorks ? "Saved on this device." : ""));
        renderSummary();
      }
      return;
    }

    var index = state.skills.indexOf(input.value);
    if (input.checked && index === -1) state.skills.push(input.value);
    if (!input.checked && index !== -1) state.skills.splice(index, 1);
    save();
    renderSummary();
  }

  function showCustomError(message) {
    customError.textContent = message;
    customError.hidden = !message;
    if (message) {
      customInput.setAttribute("aria-invalid", "true");
    } else {
      customInput.removeAttribute("aria-invalid");
    }
  }

  function allLabels() {
    return catalogue.map(function (skill) { return skill.label; }).concat(state.custom);
  }

  function addCustomSkill() {
    var label = customInput.value.trim().replace(/\s+/g, " ");
    if (!label) {
      showCustomError("Type a skill first, for example Design critique.");
      customInput.focus();
      return;
    }
    if (label.length > MAX_CUSTOM_LENGTH) {
      showCustomError("Keep it under " + MAX_CUSTOM_LENGTH + " characters.");
      return;
    }
    if (state.custom.length >= MAX_CUSTOM) {
      showCustomError("You can add up to " + MAX_CUSTOM + " of your own. Untick one to make room.");
      return;
    }
    var duplicate = allLabels().some(function (existing) {
      return existing.toLowerCase() === label.toLowerCase();
    });
    if (duplicate) {
      showCustomError("That skill is already in the list.");
      return;
    }

    showCustomError("");
    state.custom.push(label);
    skillsList.appendChild(createSkillItem("custom:" + label, label, true, true));
    customInput.value = "";
    customInput.focus();
    save();
    renderSummary();
  }

  /* ---------- Summary ---------- */

  function selectedSkillLabels() {
    var fromCatalogue = catalogue
      .filter(function (skill) { return state.skills.indexOf(skill.id) !== -1; })
      .map(function (skill) { return skill.label; });
    return fromCatalogue.concat(state.custom);
  }

  function hoursLabel() {
    if (state.hours === null) return "Not set";
    var radio = form.querySelector('input[name="hours"][value="' + state.hours + '"]');
    var text = radio && radio.parentElement ? radio.parentElement.querySelector("span") : null;
    return text ? text.textContent : "Not set";
  }

  function renderSummary() {
    sumIncome.textContent = state.income === null ? "Not set" : "£" + formatIncome(state.income) + " a year";
    sumHours.textContent = hoursLabel();

    var labels = selectedSkillLabels();
    sumSkillsCount.textContent = labels.length === 0
      ? "None picked yet"
      : labels.length === 1 ? "1 skill" : labels.length + " skills";

    sumSkills.textContent = "";
    labels.forEach(function (label) {
      var item = document.createElement("li");
      item.textContent = label;
      sumSkills.appendChild(item);
    });
    sumSkills.hidden = labels.length === 0;
    scheduleMatches();
  }

  /* ---------- Tasters ---------- */

  var FEEL = [
    { id: "absorbed", label: "I lost track of time", reading: "That kind of absorption is a good sign. Note what you were doing at that moment.", good: true },
    { id: "fine", label: "It was fine, nothing more", reading: "Fine is useful to know. Try one more taster before you decide.", good: false },
    { id: "stop", label: "I kept wanting to stop", reading: "That tells you something too. Write down what you wanted to stop, and you can cross this one off without regret.", good: false }
  ];

  try {
    feelings = JSON.parse(window.localStorage.getItem(FEEL_KEY)) || {};
  } catch (error) {
    feelings = {};
  }

  function saveFeeling(id, value) {
    feelings[id] = value;
    try { window.localStorage.setItem(FEEL_KEY, JSON.stringify(feelings)); } catch (error) { /* saving is optional */ }
  }

  function buildTaster(career) {
    var t = tasters && tasters[career.id];
    if (!t) return null;

    var box = document.createElement("details");
    var summary = document.createElement("summary");
    box.className = "taster";
    summary.textContent = "Try it for two hours: " + t.title;
    box.appendChild(summary);

    var need = document.createElement("p");
    var needLabel = document.createElement("strong");
    needLabel.textContent = "You will need: ";
    need.appendChild(needLabel);
    need.appendChild(document.createTextNode(t.need));
    box.appendChild(need);

    var steps = document.createElement("ol");
    steps.className = "taster-steps";
    t.steps.forEach(function (step) {
      var li = document.createElement("li");
      var mins = document.createElement("strong");
      mins.textContent = step.mins + " minutes. ";
      li.appendChild(mins);
      li.appendChild(document.createTextNode(step.text));
      steps.appendChild(li);
    });
    box.appendChild(steps);

    var good = document.createElement("p");
    var goodLabel = document.createElement("strong");
    goodLabel.textContent = "What good looks like: ";
    good.appendChild(goodLabel);
    good.appendChild(document.createTextNode(t.good));
    box.appendChild(good);

    var note = document.createElement("p");
    note.className = "next-step";
    note.textContent = "This task is our own suggestion. It is not taken from a source.";
    box.appendChild(note);

    var feel = document.createElement("fieldset");
    var legend = document.createElement("legend");
    var reply = document.createElement("p");
    feel.className = "taster-feel";
    legend.textContent = "How did that feel?";
    feel.appendChild(legend);
    reply.className = "taster-reply";
    reply.setAttribute("role", "status");

    function showReply(option) {
      reply.textContent = "";
      var reading = document.createElement("span");
      reading.textContent = option.reading + " ";
      var next = document.createElement("strong");
      next.textContent = "Next step: ";
      reply.appendChild(reading);
      reply.appendChild(next);
      reply.appendChild(document.createTextNode(option.good ? t.next : "Try the wheel, or pick another match and try its taster."));
    }

    FEEL.forEach(function (option) {
      var label = document.createElement("label");
      var input = document.createElement("input");
      var text = document.createElement("span");
      label.className = "choice";
      input.type = "radio";
      input.name = "feel-" + career.id;
      input.value = option.id;
      text.textContent = option.label;
      if (feelings[career.id] === option.id) { input.checked = true; showReply(option); }
      input.addEventListener("change", function () {
        saveFeeling(career.id, option.id);
        showReply(option);
      });
      label.appendChild(input);
      label.appendChild(text);
      feel.appendChild(label);
    });
    feel.appendChild(reply);
    box.appendChild(feel);

    var pause = document.createElement("p");
    pause.className = "taster-pause";
    pause.textContent = "Pause for a moment. Take one slow breath. Whatever you felt just now is information, not a verdict.";
    box.appendChild(pause);

    var talk = document.createElement("details");
    var talkSummary = document.createElement("summary");
    talk.className = "taster-talk";
    talkSummary.textContent = "Talk to someone who does this job";
    talk.appendChild(talkSummary);
    var tip = document.createElement("p");
    tip.textContent = "Ask a colleague, a professional network you already belong to or a local meetup who they know. Then send something like this.";
    talk.appendChild(tip);
    var quote = document.createElement("blockquote");
    quote.textContent = "Hi, I'm an experience designer thinking about moving into " + career.name.toLowerCase() + " work. Could I ask you three questions over about fifteen minutes? What does a normal week look like? What surprised you? What would you do differently if you were starting again?";
    talk.appendChild(quote);
    box.appendChild(talk);

    return box;
  }

  /* ---------- Matches ---------- */

  var DAYS = { 8: "about 1 day", 16: "about 2 days", 24: "about 3 days", 40: "full time" };
  var BASIS = { study: "A study ranks this job", related: "A study of a related job", estimate: "Our estimate" };

  function money(value) {
    return "£" + value.toLocaleString("en-GB");
  }

  function joinWithAnd(items) {
    if (items.length <= 1) return items.join("");
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  function skillLabel(id) {
    for (var i = 0; i < catalogue.length; i += 1) {
      if (catalogue[i].id === id) return catalogue[i].label;
    }
    return id;
  }

  function scheduleMatches() {
    window.clearTimeout(matchTimer);
    if (!hasJumped) return;
    matchTimer = window.setTimeout(function () { matchesStale.hidden = false; }, 250);
  }

  function addNote(text) {
    var note = document.createElement("p");
    note.textContent = text;
    matchesNotes.appendChild(note);
  }

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

  function addLine(parent, className, text) {
    var line = document.createElement("span");
    line.className = className;
    line.textContent = text;
    parent.appendChild(line);
    return line;
  }

  function buildCard(result) {
    var career = result.career;
    var item = document.createElement("li");
    var card = document.createElement("article");
    var heading = document.createElement("h3");
    var why = document.createElement("p");
    var whyLabel = document.createElement("strong");
    var uses = document.createElement("p");
    var details = document.createElement("dl");

    card.className = "match";
    card.setAttribute("aria-labelledby", "match-" + career.id);
    heading.id = "match-" + career.id;
    heading.textContent = career.name;

    why.className = "match-why";
    whyLabel.textContent = "Why it fits you: ";
    why.appendChild(whyLabel);
    why.appendChild(document.createTextNode(result.why.join(" ")));

    uses.className = "match-skills";
    uses.textContent = (result.matchedIds.length === 1 ? "Uses 1 of your skills: " : "Uses " + result.matchedIds.length + " of your skills: ") +
      result.matchedIds.map(skillLabel).join(", ") + ".";

    addRow(details, "Typical pay", function (dd) {
      var pay = career.pay;
      var range = pay.p90 === null
        ? "Advertised pay starts around " + money(pay.p10) + ". The upper end is not reported."
        : "Advertised pay usually runs from " + money(pay.p10) + " to " + money(pay.p90) + ".";
      dd.appendChild(document.createTextNode(money(pay.median) + " a year in the middle. " + range + " This is an estimate."));
      var source = document.createElement("span");
      source.className = "pay-source";
      source.appendChild(document.createTextNode("Based on " + pay.ads + ". "));
      var link = document.createElement("a");
      link.href = pay.sourceUrl;
      link.rel = "noopener";
      link.textContent = "Check the source on " + pay.sourceLabel;
      source.appendChild(link);
      dd.appendChild(source);
    });

    addRow(details, "Exposure to AI", function (dd) {
      dd.appendChild(document.createTextNode(career.ai.level + ". " + BASIS[career.ai.basis] + ": " + career.ai.reason));
      if (JumpShipMatch.exposureRank(career) >= 3) {
        addLine(dd, "next-step", "Exposure is not job loss. It measures how much of the work AI could do. Next step: read three live job ads for this role and note what employers ask for now.");
      }
    });

    addRow(details, "Time in person", function (dd) {
      dd.textContent = "Usually at least " + DAYS[career.minHours] + " a week in person. This is our estimate and it varies by employer.";
    });

    if (career.waysIn) {
      addRow(details, "Ways in", function (dd) {
        var wi = career.waysIn;
        var list = document.createElement("ul");
        list.className = "ways-in";
        wi.routes.forEach(function (text) {
          var li = document.createElement("li");
          li.textContent = text;
          list.appendChild(li);
        });
        dd.appendChild(list);
        var src = document.createElement("span");
        src.className = "pay-source";
        src.appendChild(document.createTextNode("Sources: "));
        wi.sources.forEach(function (s, i) {
          if (i) { src.appendChild(document.createTextNode(", ")); }
          var a = document.createElement("a");
          a.href = s.url;
          a.rel = "noopener";
          a.textContent = s.label;
          src.appendChild(a);
        });
        src.appendChild(document.createTextNode("."));
        dd.appendChild(src);
        if (wi.caveat) { addLine(dd, "next-step", wi.caveat); }
      });
    }

    card.appendChild(heading);
    if (result.why.length) { card.appendChild(why); }
    if (result.matchedIds.length) { card.appendChild(uses); }
    card.appendChild(details);

    var taster = buildTaster(career);
    if (taster) { card.appendChild(taster); }

    var flags = [];
    if (result.flags.lowStart) {
      flags.push("Starting offers may be lower than your floor. The low end of advertised pay is " + money(career.pay.p10) + ".");
    }
    if (result.flags.hoursStretch) {
      flags.push("Not fully remote: most employers ask for about a day a week in person.");
    }
    if (career.pay.median < 40000) {
      flags.push("Low pay: " + money(career.pay.median) + " in the middle is the lowest of the careers we cover. Check it carries your household before you invest time.");
    }
    (result.extraFlags || []).forEach(function (text) { flags.push(text); });
    if (result.flags.limitedData) {
      flags.push("Limited data: " + result.flags.limitedData);
    }
    if (flags.length) {
      var flagList = document.createElement("ul");
      flagList.className = "flags";
      flagList.setAttribute("aria-label", "Things to check about " + career.name);
      flags.forEach(function (text) {
        var flag = document.createElement("li");
        flag.textContent = text;
        flagList.appendChild(flag);
      });
      card.appendChild(flagList);
    }

    item.appendChild(card);
    return item;
  }

  /* ---------- Wheel ---------- */

  var wheelButton = document.getElementById("wheel-button");
  var wheelSpin = document.getElementById("wheel-spin");
  var wheelStatus = document.getElementById("wheel-status");
  var wheelResult = document.getElementById("wheel-result");
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
      big.className = "ai-risk-figure";
      big.textContent = "About " + wild.aiRisk.percent + "% risk that AI eliminates this role within 5 years";
      basis.className = "ai-risk-basis";
      basis.textContent = "Our rough guess, not a forecast. " + wild.aiRisk.basis + " None of these sites measure a five year job loss, so we blended them into one cautious number.";
      src.className = "ai-risk-basis";
      src.appendChild(document.createTextNode("Sources: "));
      wild.aiRisk.sources.forEach(function (x, i) {
        var a = document.createElement("a");
        a.href = x.url;
        a.rel = "noopener";
        a.textContent = x.label;
        if (i) src.appendChild(document.createTextNode(", "));
        src.appendChild(a);
      });
      risk.appendChild(big);
      risk.appendChild(basis);
      risk.appendChild(src);
      card.appendChild(risk);
    }

    item.className = "wild-item";
    item.appendChild(card);
    var art = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    art.setAttribute("class", "wild-char");
    art.setAttribute("viewBox", "0 0 120 130");
    art.setAttribute("aria-hidden", "true");
    art.setAttribute("focusable", "false");
    use.setAttribute("href", "#ch-" + wild.id);
    art.appendChild(use);
    card.appendChild(art);
    return item;
  }

  function wheelShow() {
    var index;
    do { index = Math.floor(Math.random() * wildcards.length); } while (wildcards.length > 1 && index === lastWildcard);
    lastWildcard = index;
    var wild = wildcards[index];
    wheelResult.textContent = "";
    wheelResult.appendChild(buildWildcardCard(wild));
    wheelStatus.textContent = "The wheel chose " + wild.name + ".";
    wheelBusy = false;
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
    wheelTurn += 1440 + Math.floor(Math.random() * 360);
    wheelSpin.style.transform = "rotate(" + wheelTurn + "deg)";
    window.setTimeout(wheelShow, 5000);
  }

  /* ---------- Jump ship ---------- */

  var jumpButton = document.getElementById("jump-button");
  var jumpAgain = document.getElementById("jump-again");
  var jumpOverlay = document.getElementById("jump-overlay");
  var jumpSkip = document.getElementById("jump-skip");
  var jumpTitle = document.getElementById("jump-title");
  var jumpFill = document.getElementById("jump-fill");
  var matchesSection = document.getElementById("matches");
  var matchesTitle = document.getElementById("matches-title");
  var matchesStale = document.getElementById("matches-stale");
  var navMatches = document.getElementById("nav-matches");
  var jumpTimer = null;
  var jumpOpener = null;
  var hasJumped = false;

  function finishJump() {
    if (jumpOverlay.hidden) return;
    window.clearTimeout(jumpTimer);
    jumpOverlay.hidden = true;
    jumpOverlay.classList.remove("is-running");
    document.body.classList.remove("no-scroll");
    hasJumped = true;
    matchesSection.hidden = false;
    navMatches.hidden = false;
    window.clearTimeout(matchTimer);
    renderMatches();
    matchesSection.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    matchesTitle.focus({ preventScroll: true });
  }

  function startJump() {
    if (!jumpOverlay.hidden) return;
    var reduce = reducedMotion();
    jumpOpener = document.activeElement;
    jumpTitle.textContent = reduce ? "Setting sail" : "Jumping ship";
    jumpFill.style.transitionDuration = reduce ? "0s" : "2.6s";
    jumpFill.style.width = "0%";
    jumpOverlay.hidden = false;
    document.body.classList.add("no-scroll");
    jumpSkip.focus();
    void jumpFill.offsetWidth;
    jumpOverlay.classList.add("is-running");
    jumpFill.style.width = "100%";
    jumpTimer = window.setTimeout(finishJump, reduce ? 1000 : 2800);
  }

  jumpButton.addEventListener("click", startJump);
  jumpAgain.addEventListener("click", startJump);
  jumpSkip.addEventListener("click", finishJump);
  wheelButton.addEventListener("click", spinWheel);
  jumpOverlay.addEventListener("keydown", function (event) {
    if (event.key === "Escape") { finishJump(); }
    if (event.key === "Tab") { event.preventDefault(); jumpSkip.focus(); }
  });

  function showRemoteNotice() {
    var paragraph = document.createElement("p");
    var title = document.createElement("strong");
    title.textContent = "No fully remote roles found. ";
    paragraph.appendChild(title);
    paragraph.appendChild(document.createTextNode(
      "None of the " + careers.length + " careers we cover is a fully remote role, so here is the next best thing: " +
      "careers where employers typically ask for about a day a week in person. " +
      "Our hours are estimates and vary by employer, so check each job ad for what it requires."
    ));
    matchesNotice.appendChild(paragraph);
    matchesNotice.hidden = false;
  }

  function renderMatches() {
    matchesStale.hidden = true;
    matchesList.textContent = "";
    matchesNotes.textContent = "";
    matchesNotice.textContent = "";
    matchesNotice.hidden = true;

    if (careers === null) return;
    if (!careers.length) {
      matchesStatus.textContent = "The careers list did not load. Refresh the page to try again.";
      return;
    }

    var missing = [];
    if (state.income === null) missing.push("your lowest salary");
    if (state.hours === null) missing.push("your in-person hours");
    if (state.skills.length === 0) missing.push("at least one skill from the list");
    if (missing.length) {
      matchesStatus.textContent = "Add " + joinWithAnd(missing) + " above to see your matches.";
      return;
    }

    var result = JumpShipMatch.rank(careers, {
      income: state.income,
      hours: state.hours,
      skills: state.skills,
      preferLowAi: state.preferLowAi
    });

    if (result.shown.length === 0) {
      if (result.counts.limits === 0) {
        matchesStatus.textContent = "None of the " + result.counts.total + " careers we cover clear both your limits.";
        addNote("Lowering your salary floor or allowing more hours in person would widen the list.");
      } else {
        matchesStatus.textContent = "Careers clear your limits, but none use the skills you picked.";
        addNote("Tick more of the experience design work you do above. Your matches are built from those skills.");
      }
    } else {
      matchesStatus.textContent = "Showing " + result.shown.length + " of " + result.fitting +
        (result.fitting === 1 ? " career that fits" : " careers that fit") + " your limits and skills.";
      if (state.hours === 0) showRemoteNotice();
      result.shown.forEach(function (entry) { matchesList.appendChild(buildCard(entry)); });
      if (result.fitting < JumpShipMatch.TOP) {
        addNote("Only " + result.fitting + " of the " + result.counts.total + " careers fit. Lowering your salary floor, allowing more hours in person or ticking more skills would widen the list.");
      }
    }

    if (state.custom.length) {
      addNote("Skills you added are kept in your summary but do not change your matches yet.");
    }
  }

  function handleAiToggle() {
    state.preferLowAi = preferAi.checked;
    save();
    window.clearTimeout(matchTimer);
    renderMatches();
  }

  /* ---------- Clearing ---------- */

  function clearAnswers() {
    state = emptyState();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      storageWorks = false;
    }
    incomeInput.value = "";
    showIncomeError("");
    showCustomError("");
    customInput.value = "";
    Array.prototype.forEach.call(form.querySelectorAll('input[name="hours"]'), function (radio) {
      radio.checked = false;
    });
    preferAi.checked = true;
    renderSkills();
    renderSummary();
    setStatus("Your answers are cleared.");
    incomeInput.focus();
  }

  /* ---------- Starting up ---------- */

  function applyStateToForm() {
    incomeInput.value = formatIncome(state.income);
    preferAi.checked = state.preferLowAi;
    if (state.hours !== null) {
      var radio = form.querySelector('input[name="hours"][value="' + state.hours + '"]');
      if (radio) radio.checked = true;
    }
  }

  function showSkillsLoadError() {
    skillsList.textContent = "";
    var item = document.createElement("li");
    item.className = "skills-error";
    item.textContent = "The skills list did not load. Refresh the page to try again.";
    skillsList.appendChild(item);
  }

  function start() {
    state = load();
    applyStateToForm();

    form.addEventListener("submit", function (event) { event.preventDefault(); });
    incomeInput.addEventListener("input", handleIncomeInput);
    incomeInput.addEventListener("blur", handleIncomeBlur);
    form.addEventListener("change", handleHoursChange);
    skillsList.addEventListener("change", handleSkillChange);
    customButton.addEventListener("click", addCustomSkill);
    customInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        addCustomSkill();
      }
    });
    customInput.addEventListener("input", function () { showCustomError(""); });
    clearButton.addEventListener("click", clearAnswers);
    preferAi.addEventListener("change", handleAiToggle);

    if (!storageWorks) {
      setStatus("Your browser is blocking saving, so your answers will clear when you leave this page.");
    }

    function getJson(path) {
      return fetch(path).then(function (response) {
        if (!response.ok) throw new Error("Request failed: " + path);
        return response.json();
      });
    }

    getJson("data/skills.json")
      .then(function (list) {
        catalogue = Array.isArray(list) ? list : [];
        renderSkills();
        renderSummary();
      })
      .catch(function () {
        showSkillsLoadError();
        renderSummary();
      });

    getJson("data/tasters.json")
      .then(function (data) { tasters = data && typeof data === "object" ? data : {}; scheduleMatches(); })
      .catch(function () { tasters = {}; });

    getJson("data/wildcards.json")
      .then(function (list) { wildcards = Array.isArray(list) ? list : []; })
      .catch(function () { wildcards = []; });

    getJson("data/careers.json")
      .then(function (list) {
        careers = Array.isArray(list) ? list : [];
        scheduleMatches();
      })
      .catch(function () {
        careers = [];
        scheduleMatches();
      });
  }

  /* ---------- Menu: hamburger on small screens ---------- */

  (function () {
    var header = document.querySelector(".site-header");
    var toggle = document.getElementById("nav-toggle");
    var nav = document.getElementById("site-nav");
    if (!header || !toggle || !nav) return;
    var small = window.matchMedia ? window.matchMedia("(max-width: 47.99rem)") : null;

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

  /* ---------- Background waves: slow parallax that eases to a stop ---------- */

  (function () {
    var root = document.documentElement;
    var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var SPEED = 0.8;     /* how far the waves are pushed back against the page */
    var EASE_MS = 450;   /* larger means a longer, softer stop */
    var current = 0;
    var running = false;
    var last = 0;

    function target() {
      return (window.pageYOffset || 0) * SPEED;
    }

    function set(value) {
      root.style.setProperty("--wave-a", value.toFixed(1) + "px");
    }

    function frame(now) {
      if (motionQuery && motionQuery.matches) {
        running = false;
        root.style.removeProperty("--wave-a");
        return;
      }
      var dt = Math.min(now - last, 64);
      last = now;
      var goal = target();
      current += (goal - current) * (1 - Math.exp(-dt / EASE_MS));
      if (Math.abs(goal - current) < 0.15) {
        current = goal;
        set(current);
        running = false;
        return;
      }
      set(current);
      window.requestAnimationFrame(frame);
    }

    function wake() {
      if (running) return;
      running = true;
      last = window.performance.now();
      window.requestAnimationFrame(frame);
    }

    current = target();
    set(current);
    window.addEventListener("scroll", wake, { passive: true });
    if (motionQuery && motionQuery.addEventListener) {
      motionQuery.addEventListener("change", function () {
        if (motionQuery.matches) { root.style.removeProperty("--wave-a"); } else { current = target(); set(current); }
      });
    }
  })();

  start();
})();
