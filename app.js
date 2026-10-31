import {
  planFieldGroups,
  planScenarios,
  planEconomics,
  quarterlyRows,
} from "./model.js";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const segments = {
  hvac: {
    title: "Heating & cooling",
    status: "Provisional leader · medium confidence",
    description:
      "Start with service and maintenance firms with enough repeatable office work to justify the fee.",
    customer:
      "5–20 technicians, one location, one time zone, existing field-service software.",
    offer:
      "Managed intake and scheduling support, consented estimate follow-up, and job-document and invoice preparation for client approval.",
    why: "A recurring customer base and seasonal workload can make reliable follow-through valuable.",
    risk: "Seasonal peaks can overwhelm a shared team. Safety calls need immediate client escalation.",
    test: "Secure paid pilots, measure task minutes, and compare value against the existing office process.",
  },
  plumbing: {
    title: "Residential plumbing",
    status: "Third choice: keep urgent dispatch with the client",
    description:
      "Pair a local service contractor with dependable intake and dispatch support, without transferring field judgment.",
    customer:
      "5–20 technicians, established service area and written emergency dispatch rules.",
    offer:
      "Inbound triage, approved schedule coordination, customer updates, and invoice preparation for client approval.",
    why: "Time-sensitive calls and dispatch gaps create clear operating pain.",
    risk: "Urgent water, gas, and safety issues raise escalation stakes. Routing authority must stay explicit.",
    test: "Review urgent-call scenarios with the client and verify that every critical exception reaches a decision-maker.",
  },
  pest: {
    title: "Recurring pest control",
    status: "Second choice: test recurring-service demand",
    description:
      "Use scheduled routes and recurring service work as a more predictable operating starting point.",
    customer:
      "An established recurring-service business with a documented route schedule and customer records.",
    offer:
      "Route reminders, rescheduling, renewal outreach with consent, and billing support.",
    why: "Recurring visits and memberships support repeatable tasks and workload forecasting.",
    risk: "Existing route software and seasonal changes may reduce willingness to pay. Treatment advice stays with licensed staff.",
    test: "Compare the paid value of renewal and scheduling support with the existing automation.",
  },
};
function renderSegment(key) {
  const s = segments[key];
  document.querySelector("#segment-detail").innerHTML =
    `<p class="recommendation-label">${s.status}</p><h3>${s.title}</h3><p>${s.description}</p><dl class="segment-facts"><div><dt>Ideal customer</dt><dd>${s.customer}</dd></div><div><dt>Initial offer</dt><dd>${s.offer}</dd></div><div><dt>Why it could win</dt><dd>${s.why}</dd></div><div><dt>What could break it</dt><dd>${s.risk}</dd></div><div><dt>Next evidence</dt><dd>${s.test}</dd></div></dl>`;
  document
    .querySelector("#segment-detail")
    .setAttribute("aria-labelledby", `segment-${key}`);
}

const workflows = {
  intake: {
    title: "Answer & qualify",
    summary:
      "Capture a clean record and route the right work. A human specialist owns the conversation and the exception.",
    chain: [
      "Client telephony",
      "AI assistance",
      "Human specialist",
      "Client escalation",
    ],
    automatic:
      "Transcribe permitted recordings, summarize the request, and retrieve an approved script. A specialist checks the result before using it with the customer.",
    human:
      "Confirm caller details, service area, issue category, and next action. Follow approved safety routing without diagnosing the equipment.",
    client:
      "Own emergency instructions, safety judgment, approved scripts, recording rules, and dispatch authority.",
    control:
      "Pause this workflow for an unresolved critical safety or privacy error. Record the call source, action, escalation recipient, and acknowledgment in the client's system.",
  },
  schedule: {
    title: "Schedule & coordinate",
    summary:
      "Work inside the existing field-service system and the rules the contractor approves.",
    chain: [
      "Client calendar",
      "Rules check",
      "Human approval",
      "Customer confirmation",
    ],
    automatic:
      "Read approved availability, flag missing details, draft confirmations, and detect duplicate records where permissions allow.",
    human:
      "Choose from authorized time windows, confirm access details, and record the commitment. Handle changes and uncertainty.",
    client:
      "Own technician skill matching, travel policy, route priorities, safety and final dispatch authority.",
    control:
      "Use minimum access. Log calendar changes. Escalate conflicts; never invent available appointments.",
  },
  followup: {
    title: "Follow up estimates",
    summary:
      "Make approved follow-through consistent while respecting consent and the contractor’s commercial decisions.",
    chain: [
      "Approved estimate",
      "Consent check",
      "Specialist outreach",
      "Client approval",
    ],
    automatic:
      "Build a follow-up queue, suggest approved wording, and summarize customer responses.",
    human:
      "Verify consent and suppression status, contact the customer through authorized channels, and record objections.",
    client:
      "Own estimate accuracy, technical questions, price changes, discounts and contractual commitments.",
    control:
      "Stop on opt-out. No purchased-list blast or autonomous outbound AI campaign. Review calling and messaging rules before the pilot.",
  },
  invoice: {
    title: "Invoices & payment reminders",
    summary:
      "Finish the administrative record and support payment through the contractor’s existing approved tools.",
    chain: [
      "Job completion",
      "Record check",
      "Invoice support",
      "Client payment tools",
    ],
    automatic:
      "Flag missing job details, prepare an invoice draft, and create a permitted reminder queue.",
    human:
      "Check the invoice against approved job records, route discrepancies, and send approved reminders.",
    client:
      "Approve charges, refunds, adjustments, payment disputes, legal collections and customer account policy.",
    control:
      "No raw payment-card handling. No bank credential sharing. No autonomous changes to financial records outside granted authority.",
  },
  exception: {
    title: "Escalate exceptions",
    summary:
      "Pause work that needs a client decision. Contact the named decision-maker and record the answer.",
    chain: [
      "Risk signal",
      "Specialist hold",
      "Client decision",
      "Documented closure",
    ],
    automatic:
      "Flag mismatches, missing consent, low confidence, unusual account activity and integration failures.",
    human:
      "Pause the affected action, classify urgency, contact the named decision-maker, and document the result.",
    client:
      "Provide reachable primary and backup owners for urgent, commercial, technical and privacy decisions.",
    control:
      "If a required decision-maker cannot be reached, use the approved fallback. Never promise emergency field response.",
  },
};
// One worked example per trade and workflow, so the panel shows the
// workflow at a real kind of business rather than in general terms.
const trades = {
  hvac: {
    company: "Alder Creek Heating & Air",
    examples: {
      intake:
        "A homeowner calls at 7:40 p.m.: no heat, 52°F inside. AI transcribes the call and pulls up the no-heat script. The specialist confirms the address is in the service area, checks the service-agreement membership and books the priority slot Alder Creek's rules allow.",
      schedule:
        "A furnace install runs long. The specialist moves the next two tune-ups into Alder Creek's approved afternoon windows and texts both homeowners their new arrival times.",
      followup:
        "A $9,650 heat-pump replacement estimate is three days old. The specialist calls with Alder Creek's approved wording, answers financing questions from the script and books a second visit from the comfort advisor.",
      invoice:
        "A tune-up closes without the filter-size line. Software flags the gap; the specialist checks the technician's photos, adds the line for Alder Creek's approval and sends the member-discount invoice.",
      exception:
        "A caller mentions a gas smell. The specialist stops, gives Alder Creek's approved safety instruction (leave the house, call the gas utility) and reaches the on-call manager.",
    },
  },
  roofing: {
    company: "Saltbox Roofing & Restoration",
    examples: {
      intake:
        "After a hailstorm, forty calls arrive in one morning. AI separates storm-damage requests from routine repairs; the specialist records each insurer and claim number and books inspections by neighborhood.",
      schedule:
        "A tear-off needs the dumpster, the materials drop and the crew on the same day. The specialist confirms delivery with the supplier and driveway access with the homeowner the day before.",
      followup:
        "An $18,400 replacement estimate is waiting on the insurer. The specialist checks the claim status each week, sends the homeowner Saltbox's approved update and flags when the adjuster's scope differs from Saltbox's.",
      invoice:
        "The insurer's first check arrives. The specialist matches it to the claim, prepares the supplement request Saltbox approved for missing drip edge and reminds the homeowner the deductible is due.",
      exception:
        "Rain starts during an open tear-off and the homeowner reports a leak. The specialist reaches the project manager at once and records the decision.",
    },
  },
  homecare: {
    company: "Lanternwood Home Care",
    examples: {
      intake:
        "A daughter calls about care for her father after a hospital discharge. The specialist records his needs and preferred hours, checks the service area and books the care manager's home assessment. No care advice is given.",
      schedule:
        "A caregiver calls in sick at 6 a.m. The specialist finds a qualified caregiver the client already knows and confirms with the family before the 9 a.m. shift.",
      followup:
        "A family received a 20-hour-a-week care plan quote. The specialist follows up, answers questions about hourly rates and minimum shifts from approved wording and books the start date.",
      invoice:
        "Visit records show 71 hours this week. The specialist reconciles them against caregiver clock-ins, flags one missing clock-out and sends the family's invoice once Lanternwood approves it.",
      exception:
        "A caregiver reports that the client fell. The specialist follows Lanternwood's incident procedure, reaches the care manager and documents the call.",
    },
  },
  landscaping: {
    company: "Nueva Vista Landscaping",
    examples: {
      intake:
        "A homeowner asks for weekly mowing and a fall cleanup. The specialist checks that the property sits on an existing route day, records lot size and gate access and books the estimator's visit.",
      schedule:
        "Rain wipes out Tuesday. The specialist shifts that route's maintenance stops to Wednesday and Thursday under Nueva Vista's rules and texts each client the new day.",
      followup:
        "A $6,800 patio and planting estimate is a week old. The specialist calls with approved wording, offers the spring install dates the owner set and records that the client wants a less expensive stone.",
      invoice:
        "Monthly maintenance invoices go out on the 1st. The specialist checks the extra visits crews logged, adds the approved leaf-removal charges and reminds clients who are 15 days late.",
      exception:
        "A crew breaks a sprinkler head. The specialist logs the photos, tells the client and gets the owner's decision on a repair credit.",
    },
  },
};
let currentTrade = "hvac";
let currentWorkflow = "intake";
function renderWorkflow(key) {
  currentWorkflow = key;
  const w = workflows[key];
  const trade = trades[currentTrade];
  document.querySelector("#workflow-detail").innerHTML =
    `<h3>${w.title}</h3><p>${w.summary}</p><div class="workflow-example"><p class="workflow-example-label">In practice at ${trade.company}</p><p>${trade.examples[key]}</p></div><div class="ownership-flow">${w.chain.map((x) => `<span>${x}</span>`).join("")}</div><dl><div><dt>Software & AI</dt><dd>${w.automatic}</dd></div><div><dt>Human specialist</dt><dd>${w.human}</dd></div><div><dt>The contractor</dt><dd>${w.client}</dd></div><div><dt>Control that matters</dt><dd>${w.control}</dd></div></dl>`;
  document
    .querySelector("#workflow-detail")
    .setAttribute("aria-labelledby", `work-${key}`);
}
for (const button of document.querySelectorAll("[data-trade]")) {
  button.addEventListener("click", () => {
    for (const other of document.querySelectorAll("[data-trade]"))
      other.setAttribute("aria-pressed", String(other === button));
    currentTrade = button.dataset.trade;
    renderWorkflow(currentWorkflow);
    document.querySelector("#workflow-status").textContent =
      `${button.textContent}: ${workflows[currentWorkflow].title}`;
  });
}
function setupTabs(selector, attribute, render) {
  const buttons = [...document.querySelectorAll(selector)];
  function select(button, focus = false) {
    for (const b of buttons) {
      const selected = b === button;
      b.setAttribute("aria-selected", String(selected));
      b.tabIndex = selected ? 0 : -1;
    }
    render(button.dataset[attribute]);
    if (focus) button.focus();
  }
  for (const button of buttons) {
    button.addEventListener("click", () => select(button));
    button.addEventListener("keydown", (event) => {
      const i = buttons.indexOf(button);
      let next;
      if (event.key === "ArrowRight" || event.key === "ArrowDown")
        next = (i + 1) % buttons.length;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp")
        next = (i - 1 + buttons.length) % buttons.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = buttons.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        select(buttons[next], true);
      }
    });
  }
}
setupTabs("[data-segment]", "segment", renderSegment);
renderSegment("hvac");
setupTabs("[data-workflow]", "workflow", renderWorkflow);
renderWorkflow("intake");

// Economics: every output below is recomputed from the form on each change.
const form = document.querySelector("#economics-form");
const percent = (value, digits = 1) =>
  value === null ? "Not applicable" : `${(value * 100).toFixed(digits)}%`;
const plainNumber = new Intl.NumberFormat("en-US");
const oneDecimal = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});
const unitSuffix = { usd: " (US dollars)", percent: " (%)" };
const costParts = [
  ["specialistCost", "Philippines specialists", "econ-swatch-specialists"],
  ["supervisionCost", "Supervision and quality review", "econ-swatch-supervision"],
  ["softwareAiCost", "Software and AI usage", "econ-swatch-software"],
  ["accountCost", "United States account and analysis", "econ-swatch-account"],
  ["integrationCost", "India integration upkeep", "econ-swatch-integration"],
];

function buildEconomicsInputs() {
  const holder = document.querySelector("#economics-inputs");
  holder.innerHTML = planFieldGroups
    .map(
      (group, index) =>
        `<details class="economics-advanced economics-group"${index === 0 ? " open" : ""}>` +
        `<summary>${group.title}</summary><div class="input-grid">` +
        group.fields
          .map(
            (field) =>
              `<label for="econ-${field.key}">${field.label}${unitSuffix[field.unit] ?? ""}` +
              `<input id="econ-${field.key}" name="${field.key}" type="number" inputmode="decimal" ` +
              `min="${field.min}" max="${field.max}" step="${field.whole ? 1 : "any"}" required /></label>`,
          )
          .join("") +
        `</div></details>`,
    )
    .join("");
}

function readEconomicsInputs() {
  const problems = [];
  const values = {};
  for (const group of planFieldGroups) {
    for (const field of group.fields) {
      const input = form.elements[field.key];
      const value = input.value.trim() === "" ? NaN : Number(input.value);
      const fits =
        Number.isFinite(value) &&
        value >= field.min &&
        value <= field.max &&
        (!field.whole || Number.isInteger(value));
      input.setAttribute("aria-invalid", String(!fits));
      if (!fits)
        problems.push(
          `${field.label} (${group.title}): enter ${field.whole ? "a whole number" : "a value"} from ${plainNumber.format(field.min)} to ${plainNumber.format(field.max)}.`,
        );
      values[field.key] = value;
    }
  }
  return { values, problems };
}

const people = (count, one, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function renderCostStack(perClient) {
  const total = Math.max(
    perClient.fee,
    perClient.deliveryCost + perClient.accountCost + perClient.integrationCost,
  );
  const parts = [
    ...costParts.map(([key, label, swatch]) => [label, perClient[key], swatch]),
    ["Contribution left", Math.max(perClient.contribution, 0), "econ-swatch-contribution"],
  ];
  document.querySelector("#cost-stack").innerHTML = parts
    .map(
      ([, value, swatch]) =>
        `<span class="${swatch}" style="width:${((value / total) * 100).toFixed(2)}%"></span>`,
    )
    .join("");
  document.querySelector("#cost-stack-legend").innerHTML = parts
    .map(
      ([label, value, swatch]) =>
        `<li><span class="econ-swatch ${swatch}" aria-hidden="true"></span>${label}<strong>${money.format(value)}</strong></li>`,
    )
    .join("");
}

function renderCashCurve(projection) {
  const holder = document.querySelector("#cash-curve");
  const width = Math.max(300, Math.round(holder.clientWidth || 640));
  const height = width < 520 ? 220 : 240;
  const pad = { left: width < 520 ? 64 : 84, right: 16, top: 16, bottom: 34 };
  const points = [
    { month: 0, cash: projection.rows[0].cumulativeCash - projection.rows[0].operatingProfit },
    ...projection.rows.map((row) => ({ month: row.month, cash: row.cumulativeCash })),
  ];
  const lastMonth = points.at(-1).month;
  const low = Math.min(0, ...points.map((p) => p.cash));
  const high = Math.max(0, ...points.map((p) => p.cash));
  const span = high - low || 1;
  const x = (month) => pad.left + (month / lastMonth) * (width - pad.left - pad.right);
  const y = (cash) => pad.top + ((high - cash) / span) * (height - pad.top - pad.bottom);
  const line = points.map((p) => `${x(p.month).toFixed(1)},${y(p.cash).toFixed(1)}`).join(" ");
  const area = `${x(0).toFixed(1)},${y(0).toFixed(1)} ${line} ${x(lastMonth).toFixed(1)},${y(0).toFixed(1)}`;
  const lowest = points.reduce((a, b) => (b.cash < a.cash ? b : a));
  const short = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const yTicks = [...new Set([high, 0, low])];
  const xTicks = [0, Math.round(lastMonth / 2), lastMonth];
  const payback = projection.cashPaybackMonth;
  const showPayback = payback !== null && payback > 0 && payback <= lastMonth;
  // The caption names only the marks actually drawn.
  document.querySelector("#cash-curve-caption").textContent =
    "Cumulative cash, after the launch cost. The dot marks the lowest point in these months" +
    (showPayback ? "; the dashed line marks the month all cash is back." : ".");
  holder.innerHTML =
    `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="cash-curve-title cash-curve-desc">` +
    `<title id="cash-curve-title">Cumulative cash by month</title>` +
    `<desc id="cash-curve-desc">Starts at ${money.format(points[0].cash)}, lowest point ${money.format(lowest.cash)} in month ${lowest.month}, ends at ${money.format(projection.endingCash)} in month ${lastMonth}.</desc>` +
    yTicks
      .map(
        (tick) =>
          `<line class="econ-grid${tick === 0 ? " econ-zero" : ""}" x1="${pad.left}" x2="${width - pad.right}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}"/>` +
          `<text class="econ-axis" x="${pad.left - 8}" y="${(y(tick) + 4).toFixed(1)}" text-anchor="end">${short.format(tick)}</text>`,
      )
      .join("") +
    xTicks
      .map(
        (tick) =>
          `<text class="econ-axis" x="${x(tick).toFixed(1)}" y="${height - 10}" text-anchor="${tick === 0 ? "start" : tick === lastMonth ? "end" : "middle"}">Month ${tick}</text>`,
      )
      .join("") +
    `<polygon class="econ-area" points="${area}"/>` +
    `<polyline class="econ-line" points="${line}"/>` +
    `<circle class="econ-point" cx="${x(lowest.month).toFixed(1)}" cy="${y(lowest.cash).toFixed(1)}" r="5"/>` +
    (showPayback
      ? `<line class="econ-payback" x1="${x(payback).toFixed(1)}" x2="${x(payback).toFixed(1)}" y1="${pad.top}" y2="${height - pad.bottom}"/>`
      : "") +
    `</svg>`;
}

let lastProjection = null;
function updateEconomics() {
  const error = document.querySelector("#economics-error");
  const { values, problems } = readEconomicsInputs();
  if (problems.length > 0) {
    error.hidden = false;
    error.textContent = `Results below still show the last valid inputs. ${problems.join(" ")}`;
    return;
  }
  let result;
  try {
    result = planEconomics(values);
  } catch (e) {
    error.hidden = false;
    error.textContent = e.message;
    return;
  }
  error.hidden = true;
  document.querySelector("#calculation-sheet-link").href =
    `calculations.html?inputs=${encodeURIComponent(JSON.stringify(values))}`;
  const unit = result.perClient;
  const plan = result.projection;
  const horizon = values.horizonMonths;
  lastProjection = plan;

  const outlookEnd = plan.cashOutlookMonths;
  setText(
    "peak-cash",
    plan.peakCashFound
      ? money.format(plan.peakCashNeed)
      : `Over ${money.format(plan.peakCashNeed)}`,
  );
  setText(
    "peak-cash-note",
    plan.peakCashNeed === 0
      ? "No cash needed"
      : plan.peakCashFound
        ? `Lowest point, month ${plan.peakCashMonth}` +
          (plan.peakCashMonth > horizon ? `, after the ${horizon} months shown` : "")
        : `Still falling at month ${outlookEnd}`,
  );
  setText(
    "cash-payback",
    plan.cashPaybackMonth === null
      ? `After month ${outlookEnd}`
      : plan.cashPaybackMonth === 0
        ? "No cash needed"
        : `Month ${plan.cashPaybackMonth}`,
  );
  setText(
    "cash-payback-note",
    plan.cashPaybackMonth !== null && plan.cashPaybackMonth > horizon
      ? `After the ${horizon} months shown`
      : "",
  );
  setText(
    "cash-recovered",
    plan.peakCashNeed === 0 ? "No cash invested" : money.format(plan.cashRecoveredAtHorizon),
  );
  setText(
    "cash-recovered-note",
    plan.peakCashNeed === 0
      ? ""
      : `of ${money.format(plan.peakCashNeed)} (${percent(plan.cashRecoveredShare, 0)})`,
  );
  for (const node of document.querySelectorAll(".econ-horizon"))
    node.textContent = String(horizon);
  setText(
    "economics-summary",
    `At month ${horizon}: ${oneDecimal.format(plan.endingClients)} clients, ${plan.endingHeadcount} people, ` +
      `monthly operating ${plan.endingOperatingProfit >= 0 ? "profit" : "loss"} of ${money.format(Math.abs(plan.endingOperatingProfit))}, ` +
      `cumulative cash ${money.format(plan.endingCash)}. ` +
      (plan.cashPaybackMonth === null
        ? `The cash invested is not recovered within ${outlookEnd} months.`
        : plan.cashPaybackMonth === 0
          ? "No outside cash is needed."
          : `All cash invested is back by month ${plan.cashPaybackMonth}.`),
  );
  setText("annual-operating-profit", money.format(plan.annualOperatingProfitAtHorizon));

  renderCostStack(unit);
  setText("fee-per-client", money.format(unit.fee));
  setText("delivery-cost", money.format(unit.deliveryCost));
  setText("gross-profit", money.format(unit.grossProfit));
  setText("gross-margin", percent(unit.grossMargin));
  setText("contribution", money.format(unit.contribution));
  setText("contribution-margin", percent(unit.contributionMargin));
  setText(
    "onboarding-cost",
    `${money.format(unit.onboardingCost)} vs ${money.format(values.setupFee)} fee`,
  );
  setText(
    "acquisition-cost",
    unit.acquisitionCost === null ? "No new clients" : money.format(unit.acquisitionCost),
  );
  setText(
    "payback",
    unit.paybackMonths === null ? "No payback" : `${unit.paybackMonths.toFixed(1)} months`,
  );
  setText(
    "lifetime-ratio",
    unit.lifetimeToAcquisition === null
      ? "No acquisition cost"
      : `${unit.lifetimeToAcquisition.toFixed(1)} to 1`,
  );
  setText("annual-retention", percent(unit.annualClientRetention));

  setText(
    "break-even",
    result.breakEvenClients === null ? "Not attainable" : `${result.breakEvenClients} clients`,
  );
  setText(
    "first-profit-month",
    plan.firstProfitableMonth === null ? `Not by month ${horizon}` : `Month ${plan.firstProfitableMonth}`,
  );
  setText("ending-cash", money.format(plan.endingCash));
  setText("operating-margin", percent(plan.endingOperatingMargin));
  setText("pooled-margin", percent(plan.endingPooledGrossMargin));
  setText("annual-fees", money.format(plan.annualFeeRevenueAtHorizon));
  setText(
    "revenue-per-person",
    plan.annualRevenuePerPerson === null ? "No team" : money.format(plan.annualRevenuePerPerson),
  );
  const last = plan.rows.at(-1);
  setText(
    "team-at-horizon",
    `${last.headcount} people: ` +
      [
        people(last.specialists, "specialist"),
        people(last.supervisors, "supervisor"),
        people(last.engineers, "engineer"),
        people(last.accountManagers, "account manager"),
        people(values.salesPeople, "salesperson", "salespeople"),
        people(values.leaders, "leader"),
      ].join(", "),
  );

  document.querySelector("#projection-rows").innerHTML = quarterlyRows(plan.rows)
    .map(
      (q) =>
        `<tr><th scope="row">${q.firstMonth}–${q.lastMonth}</th><td>${oneDecimal.format(q.newClients)}</td>` +
        `<td>${oneDecimal.format(q.closingClients)}</td><td>${q.headcount}</td>` +
        `<td>${money.format(q.revenue)}</td><td>${money.format(q.totalCost)}</td>` +
        `<td>${money.format(q.operatingProfit)}</td><td>${money.format(q.cumulativeCash)}</td></tr>`,
    )
    .join("");
  renderCashCurve(plan);
}

function applyScenario(name) {
  for (const [key, value] of Object.entries(planScenarios[name]))
    form.elements[key].value = value;
  for (const button of document.querySelectorAll("[data-scenario]"))
    button.setAttribute("aria-pressed", String(button.dataset.scenario === name));
  updateEconomics();
}
buildEconomicsInputs();
form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", () => {
  for (const b of document.querySelectorAll("[data-scenario]"))
    b.setAttribute("aria-pressed", "false");
  updateEconomics();
});
for (const b of document.querySelectorAll("[data-scenario]"))
  b.addEventListener("click", () => applyScenario(b.dataset.scenario));
document
  .querySelector("#reset-economics")
  .addEventListener("click", () => applyScenario("base"));
let cashCurveWidth = 0;
if ("ResizeObserver" in window)
  new ResizeObserver((entries) => {
    const width = Math.round(entries[0].contentRect.width);
    if (width === cashCurveWidth) return;
    cashCurveWidth = width;
    if (lastProjection) renderCashCurve(lastProjection);
  }).observe(document.querySelector("#cash-curve"));
applyScenario("base");

const gates = {
  demand: {
    title: "Confirm demand",
    owner: "United States business development",
    summary:
      "Interview operators and test the proposed price. Interest alone does not justify a launch.",
    evidence: [
      "Compare current office cost, enabled software, the best adequate alternative, and existing Orbit scope.",
      "Record qualified buyer interest and price objections. Obtain paid commitments only after the initial scope, data and contact rules are approved.",
      "Select one suitable field-service platform. Inspect baseline records only under approved data terms and client permission.",
    ],
    stop: "Revise the segment or offer if buyers will not pay enough to support the modeled cost.",
  },
  scope: {
    title: "Approve the paid pilot",
    owner: "Operations lead, client owner, security and legal reviewers",
    summary:
      "Agree the service boundary before connecting real customer records.",
    evidence: [
      "Sign scope, data handling terms, approvals and escalation rules.",
      "Verify least-privilege platform access, consent and recording rules.",
      "Train specialists on scripts and simulate critical exceptions.",
      "Obtain three signed, bounded paid pilots and record payment before live traffic.",
    ],
    stop: "Do not onboard live data until access, responsibilities and critical escalations are understood.",
  },
  pilot: {
    title: "Run the paid pilot",
    owner: "Philippines delivery lead with United States account owner",
    summary:
      "Measure the work at task level and compare outcomes with the client’s baseline.",
    evidence: [
      "Track minutes, call answer speed, unhandled calls, follow-up timeliness, errors and customer outcomes on the actual roster.",
      "Account for supervision, software and account support.",
      "Review quality and customer value with the buyer.",
    ],
    stop: "Pause the affected workflow for any unresolved critical safety or data error.",
  },
  repeat: {
    title: "Prove repeatability",
    owner: "Rocket Nation leadership",
    summary:
      "Use renewed customers and measured cost to decide whether the offer can repeat.",
    evidence: [
      "Meet the pilot quality and outcome scorecard.",
      "Demonstrate contribution after roster costs, and fund the cash bridge with the sales team retained.",
      "Secure renewal and show another trained specialist can deliver the same work.",
    ],
    stop: "Reprice or narrow scope if the workload breaks the margin or clients do not renew.",
  },
  scale: {
    title: "Release capital",
    owner: "Rocket Nation leadership",
    summary:
      "Expand in controlled cohorts, with staffing and technology justified by demand.",
    evidence: [
      "Confirm capacity, backup coverage, training and cash requirements.",
      "Use a repeatable onboarding and quality process.",
      "Build only automation whose benefit the pilot has measured.",
    ],
    stop: "Keep new trades, autonomous dispatch and a replacement field-service platform outside the first release.",
  },
};
function renderGate(key) {
  const g = gates[key];
  document.querySelector("#gate-detail").setAttribute("data-ui", "");
  document.querySelector("#gate-detail").innerHTML =
    `<div><h3>${g.title}</h3><p><strong>Responsible:</strong> ${g.owner}</p><p>${g.summary}</p></div><div><ul>${g.evidence.map((x) => `<li>${x}</li>`).join("")}</ul><p><strong>Decision rule:</strong> ${g.stop}</p></div>`;
  for (const b of document.querySelectorAll("[data-gate]"))
    b.setAttribute("aria-pressed", String(b.dataset.gate === key));
}
for (const b of document.querySelectorAll("[data-gate]"))
  b.addEventListener("click", () => renderGate(b.dataset.gate));
renderGate("demand");


// Wide tables: mark when they scroll sideways, so the page can show a fade
// at the cut-off edge and a "Swipe to see more" hint on small screens.
function watchTableScroll(scroller) {
  const frame = scroller.closest(".table-frame");
  if (!frame) return;
  const update = () => {
    const overflowing = scroller.scrollWidth > scroller.clientWidth + 1;
    const atEnd =
      scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2;
    frame.classList.toggle("is-overflowing", overflowing);
    frame.classList.toggle("is-at-end", atEnd);
  };
  scroller.addEventListener("scroll", update, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(update).observe(scroller);
  update();
}
for (const scroller of document.querySelectorAll(".table-scroll"))
  watchTableScroll(scroller);
