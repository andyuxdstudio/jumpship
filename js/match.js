/* Jump Ship: matching rules.
   Pure functions with no page access, so they can be tested on their own.

   1. Hard filters. A career is dropped when its median advertised pay is below
      the dad's income floor, or when it needs more in-person hours than he can give.
      A fully remote dad (0 hours) still sees careers that typically need about a day
      in person, but they are flagged ("stretch") because fully remote roles are rarer.
   2. Skills. Each career lists the skills it draws on, weighted 2 (core) or 1 (supporting).
      A career's score is the total weight of the skills he picked. No overlap, no match.
   3. Beyond experience design. Each skill belongs to one to three themes (research, people,
      teaching, making, leading, technical, storytelling). Careers outside the field carry the same
      themes. A career scores when its themes overlap the picked skills' themes by at least three points,
      and counts for about a third as much as a direct skill match, so exact skills still lead.
      At most two of them appear in the top five. They are checked against the same pay and hours limits when they have the data.
   4. Ranking. Highest score first. When "prefer lower AI exposure" is on, each step of
      AI exposure costs half a point, so exposure nudges the order and never hides a career. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.JumpShipMatch = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LEVELS = { "Low": 0, "Low to medium": 1, "Medium": 2, "Medium to high": 3, "High": 4 };
  var AI_PENALTY = 0.5;
  var TOP = 5;
  var WILD_WEIGHT = 0.35;
  var MAX_BEYOND = 2;   /* at most two careers from outside the field in the top five */

  function exposureRank(career) {
    var value = LEVELS[career.ai && career.ai.level];
    return typeof value === "number" ? value : 2;
  }

  function hoursFit(minHours, maxHours) {
    if (minHours <= maxHours) return "fits";
    if (maxHours === 0 && minHours <= 8) return "stretch";
    return "no";
  }

  function wildExposureRank(percent) {
    if (typeof percent !== "number") return 2;
    if (percent <= 10) return 0;
    if (percent <= 25) return 1;
    if (percent <= 45) return 2;
    if (percent <= 65) return 3;
    return 4;
  }

  /* Careers outside experience design, matched on themes rather than exact skills. */
  function rankBeyond(wildcards, skillThemes, picked, answers) {
    var strength = {};
    Object.keys(picked).forEach(function (id) {
      (skillThemes[id] || []).forEach(function (theme) {
        strength[theme] = Math.min(3, (strength[theme] || 0) + 1);
      });
    });
    var entries = [];
    wildcards.forEach(function (wild) {
      if (!wild.themes) return;
      var hours = hoursFit(typeof wild.minHours === "number" ? wild.minHours : 40, answers.hours);
      if (hours === "no") return;
      if (typeof wild.payTop === "number" && answers.income > wild.payTop) return;
      var matchedThemes = wild.themes.filter(function (theme) { return strength[theme]; });
      var themeScore = matchedThemes.reduce(function (total, theme) { return total + strength[theme]; }, 0);
      if (themeScore < 3) return;
      var score = themeScore * WILD_WEIGHT;
      var viaSkills = Object.keys(picked).filter(function (id) {
        return (skillThemes[id] || []).some(function (theme) { return matchedThemes.indexOf(theme) !== -1; });
      });
      entries.push({
        kind: "wild",
        career: wild,
        score: score,
        adjusted: score - (answers.preferLowAi ? AI_PENALTY * wildExposureRank(wild.aiRisk && wild.aiRisk.percent) : 0),
        matchedIds: viaSkills,
        themes: matchedThemes,
        why: [],
        flags: {
          lowStart: typeof wild.payFrom === "number" && answers.income > wild.payFrom,
          limitedData: null,
          payUnknown: typeof wild.payTop !== "number",
          hoursStretch: hours === "stretch"
        }
      });
    });
    return entries;
  }

  function rank(careers, answers, options) {
    var picked = {};
    (answers.skills || []).forEach(function (id) { picked[id] = true; });

    var counts = { total: careers.length, income: 0, hours: 0, limits: 0, skills: 0 };
    var fitting = [];

    careers.forEach(function (career) {
      var incomeOk = answers.income <= career.pay.median;
      var hours = hoursFit(career.minHours, answers.hours);

      if (incomeOk) counts.income += 1;
      if (hours !== "no") counts.hours += 1;
      if (!incomeOk || hours === "no") return;
      counts.limits += 1;

      var matched = career.skills
        .filter(function (skill) { return picked[skill.id]; })
        .sort(function (a, b) { return b.weight - a.weight; });
      var score = matched.reduce(function (total, skill) { return total + skill.weight; }, 0);
      if (score === 0) return;
      counts.skills += 1;

      fitting.push({
        career: career,
        score: score,
        adjusted: score - (answers.preferLowAi ? AI_PENALTY * exposureRank(career) : 0),
        matchedIds: matched.map(function (skill) { return skill.id; }),
        why: matched.slice(0, 2).map(function (skill) { return skill.why; }),
        flags: {
          lowStart: answers.income > career.pay.p10,
          limitedData: career.limitedData || null,
          hoursStretch: hours === "stretch"
        }
      });
    });

    if (options && options.wildcards && options.skillThemes) {
      rankBeyond(options.wildcards, options.skillThemes, picked, answers).forEach(function (entry) {
        fitting.push(entry);
      });
    }

    fitting.sort(function (a, b) {
      var medianA = a.kind === "wild" ? 0 : a.career.pay.median;
      var medianB = b.kind === "wild" ? 0 : b.career.pay.median;
      return (b.adjusted - a.adjusted) ||
        (b.score - a.score) ||
        (medianB - medianA) ||
        a.career.name.localeCompare(b.career.name);
    });

    var shown = [];
    var beyond = 0;
    fitting.forEach(function (entry) {
      if (shown.length >= TOP) return;
      if (entry.kind === "wild") {
        if (beyond >= MAX_BEYOND) return;
        beyond += 1;
      }
      shown.push(entry);
    });

    return { shown: shown, fitting: fitting.length, counts: counts };
  }

  return { rank: rank, exposureRank: exposureRank, hoursFit: hoursFit, AI_PENALTY: AI_PENALTY, TOP: TOP };
});
