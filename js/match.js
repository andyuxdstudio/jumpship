/* Jump Ship: matching rules.
   Pure functions with no page access, so they can be tested on their own.

   1. Hard filters. A career is dropped when its median advertised pay is below
      the dad's income floor, or when it needs more in-person hours than he can give.
      A fully remote dad (0 hours) still sees careers that typically need about a day
      in person, but they are flagged ("stretch") because fully remote roles are rarer.
   2. Skills. Each career lists the skills it draws on, weighted 2 (core) or 1 (supporting).
      A career's score is the total weight of the skills he picked. No overlap, no match.
   3. Ranking. Highest score first. When "prefer lower AI exposure" is on, each step of
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

  function exposureRank(career) {
    var value = LEVELS[career.ai && career.ai.level];
    return typeof value === "number" ? value : 2;
  }

  function hoursFit(minHours, maxHours) {
    if (minHours <= maxHours) return "fits";
    if (maxHours === 0 && minHours <= 8) return "stretch";
    return "no";
  }

  function rank(careers, answers) {
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

    fitting.sort(function (a, b) {
      return (b.adjusted - a.adjusted) ||
        (b.score - a.score) ||
        (b.career.pay.median - a.career.pay.median) ||
        a.career.name.localeCompare(b.career.name);
    });

    return { shown: fitting.slice(0, TOP), fitting: fitting.length, counts: counts };
  }

  return { rank: rank, exposureRank: exposureRank, hoursFit: hoursFit, AI_PENALTY: AI_PENALTY, TOP: TOP };
});
