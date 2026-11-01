# PRD: Jump Ship

Oct 31, 2026 · @A

Jump Ship is a website that helps dads in experience design find careers that fit their skills and their family life, then try one in about 2 hours.

## User and problem

- **User:** a dad working in experience design who is worried that AI will reshape or remove his role. He knows his skills but not where to start, because the landscape moves so fast.
- **Problem:** existing tools give generic options and ignore the constraints of a working parent.
- **Source:** lived experience, treated as insight and not yet validated with testers.
- **Working name:** Jump Ship, with a maritime look and feel. Name and domain availability are unchecked.

## Goals

1. He sees realistic career options within a few minutes.
2. He completes a taster within a week of first use.
3. He finds the tone honest, considerate and motivating.

## Main journey

A first visit takes him from a clear promise to a two-hour taster, with no sign-up.

1. **Land:** a clear promise, with no sign-up.
2. **Hard filters:** minimum income and the most in-person hours he can do. Remote work counts as low friction.
3. **Skills:** he taps the experience design skills he actually uses, with space to add his own.
4. **Top 5 matches:** each card shows why it fits his skills, a reality check (pay range, entry routes, AI exposure) and flags for soft preferences.
5. **Surprise me:** a ship's-wheel spin that picks from any career passing his hard filters, including ones outside his top 5.
6. **Taster:** a guided 2-hour task that ends with "How did that feel?" (energised, neutral or drained), the reality check, one proactive next step and one mindful prompt.
7. **Return:** he saves his plan and tries another career.

## MVP scope

The smallest useful release is two filters, a skill picker, five matches, a wheel and a guided taster.

- **Hard filters:** income floor and in-person hours.
- **Soft preferences, flagged but never filtering:** location, retraining timeframe, retraining budget.
- **Fixed, curated careers:** each has a pre-written taster. AI writes the personalised "why this fits you" and the reality check.
- **Estimates:** pay and AI-risk figures are always shown as ranges, labelled as estimates, with a source link.
- **Tone rule:** every honest message is paired with an action or a reflective thought. Maritime imagery stays positive (charting a trajectory, open water, new horizons), with no storms or shipwrecks. Nautical labels always sit beside a plain one, for example "Ports: your matches".
- **Saving:** local save or a shareable link, instead of accounts.

**Draft career list (14), for review:** product manager, business analyst, content designer / experience writer, service designer, front-end developer, accessibility specialist, experience researcher (adjacent roles), technical writer, customer success manager, data analyst, learning experience designer, delivery / project manager, conversation designer, product marketing manager.

## Out of scope for MVP

- Accounts and sync across devices
- Job listings or applications
- CV builders
- A courses marketplace
- "Talk to someone in the role" (a later nice-to-have)
- Open-ended careers beyond the fixed list
- Community or forum features
- Tester recruitment

## Accessibility

The baseline is WCAG 2.2 AA, with a mobile-first layout. These are proposed and have not been discussed in detail.

- Fully keyboard and screen-reader usable
- Plain language, short sections, no timers or pressure
- The wheel respects reduced-motion settings and has a non-animated "pick for me" button
- Colour is never the only signal, and text is resizable

## Success tests

Success is measured through in-product feedback after launch, because no testers are recruited beforehand. The targets are agreed starting points to be tested.

| Measure | Target |
| --- | --- |
| Activation: visitors who start and reach their matches | 60% |
| Value: visitors who start a taster | 30% |
| Value: visitors who complete a taster | 15% |
| Trust: post-taster survey (5 questions) | Most users rate the reality check "honest" and "useful" |

**Failure signals:** abandonment during the filters, or feedback that matches ignored his constraints.

## Assumptions we can't yet prove

1. Dads will trust AI-generated pay and risk estimates when they are labelled and sourced.
2. Two hard filters are enough to make matches feel relevant.
3. A 2-hour taster tells him something meaningful about a career, not just a fun distraction.
4. The wheel increases engagement rather than being a gimmick.
5. Location, time and budget work as soft flags.
6. The tone stays honest without discouraging him.
7. The audience is large enough to reach, and no testers are recruited before launch.
8. "Dads in experience design" will feel inclusive of single dads, and the copy can carry the sole-provider reasoning without naming it.
9. The name "Jump Ship" and its domain are available. This is unverified.
10. Accessibility needs beyond the defaults above are unknown.

## Unresolved questions

Three questions remain open, and nothing is built until this PRD is agreed.

- Final career list, and who quality-checks each taster
- Where the pay and AI-risk sources come from
- What each success target is measured with (analytics tool, survey tool)

**Review request:** is the draft career list right, and are you happy with the assumptions above? Once the PRD is agreed, a build plan comes next for approval before any code is written.


## As built (November 2026)

- **Jump ship flow:** answering the form and pressing Jump ship plays a short boat-and-shark animation, then shows the top five matches, each with a character, pay, AI exposure, ways in and a two-hour taster. Fully remote work is flagged before the results.
- **Matching:** 14 experience design adjacent careers, ranked on hours, income, skills and an optional low-AI preference.
- **Spin the wheel:** a spin-the-wheel feature with 56 unrelated careers, each with sourced pay, a character and a rough AI-risk estimate. The estimate is our own guess blended from AI Exposure scores, labelled as such, and is not a forecast.
- **Saving:** answers save on the device. The copy-link feature was removed for now and can come back later.
- **Analytics:** none at launch. Feedback goes by an email link in the footer.
- **Accessibility:** automated checks for contrast, names, headings, targets and focus pass in light and dark at desktop and phone width.
