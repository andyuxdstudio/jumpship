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

  var catalogue = [];
  var storageWorks = true;
  var state = emptyState();

  function emptyState() {
    return { income: null, hours: null, skills: [], custom: [] };
  }

  /* ---------- Saving and loading ---------- */

  function sanitise(raw) {
    var clean = emptyState();
    if (!raw || typeof raw !== "object") return clean;

    if (typeof raw.income === "number" && isFinite(raw.income) && raw.income > 0 && raw.income <= MAX_INCOME) {
      clean.income = Math.round(raw.income);
    }
    if (VALID_HOURS.indexOf(raw.hours) !== -1) clean.hours = raw.hours;

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
    renderSkills();
    renderSummary();
    setStatus("Your answers are cleared.");
    incomeInput.focus();
  }

  /* ---------- Starting up ---------- */

  function applyStateToForm() {
    incomeInput.value = formatIncome(state.income);
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

    if (!storageWorks) {
      setStatus("Your browser is blocking saving, so your answers will clear when you leave this page.");
    }

    fetch("data/skills.json")
      .then(function (response) {
        if (!response.ok) throw new Error("Request failed");
        return response.json();
      })
      .then(function (list) {
        catalogue = Array.isArray(list) ? list : [];
        renderSkills();
        renderSummary();
      })
      .catch(function () {
        showSkillsLoadError();
        renderSummary();
      });
  }

  start();
})();
