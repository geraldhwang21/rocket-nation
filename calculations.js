// Calculation sheet: shows how the Economics inputs produce every output.
// All figures come from model.js, the same code the Economics section uses.
import {
  CASH_OUTLOOK_MONTHS,
  operatingMonth,
  planEconomics,
  planFieldGroups,
  planRows,
  planScenarios,
  validatePlanInputs,
} from "./model.js";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const cents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const percent = (value) => (value === null ? "not applicable" : `${(value * 100).toFixed(1)}%`);

const escape = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function formatInput(field, value) {
  if (field.unit === "usd") return money.format(value);
  if (field.unit === "percent") return `${number.format(value)}%`;
  return `${number.format(value)} ${field.unit}`;
}

// Inputs arrive from the Economics section as ?inputs=<JSON>. Without valid
// inputs the sheet shows the base scenario.
function readInputs() {
  const params = new URLSearchParams(location.search);
  const raw = params.get("inputs");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const inputs = {};
      for (const group of planFieldGroups)
        for (const field of group.fields) inputs[field.key] = Number(parsed[field.key]);
      validatePlanInputs(inputs);
      return { inputs, source: "the inputs currently entered in the Economics section" };
    } catch (error) {
      const message = document.querySelector("#calc-error");
      message.hidden = false;
      message.textContent = `The inputs passed to this page could not be used (${error.message}). The base scenario is shown instead.`;
    }
  }
  return { inputs: { ...planScenarios.base }, source: "the base scenario" };
}

const item = (html) => `<li>${html}</li>`;
const fill = (id, items) => {
  document.getElementById(id).innerHTML = items.join("");
};

function render() {
  const { inputs: v, source } = readInputs();
  const result = planEconomics(v);
  const u = result.perClient;
  const p = result.projection;
  const horizon = v.horizonMonths;
  const last = p.rows.at(-1);

  document.querySelector("#calc-source").textContent =
    `Every figure below is calculated from ${source}, with the same code as the Economics section. ` +
    `Change an input there and open this sheet again to see the new calculation.`;

  fill(
    "calc-inputs",
    planFieldGroups.flatMap((group) => [
      `<tr><th scope="colgroup" colspan="2">${escape(group.title)}</th></tr>`,
      ...group.fields.map(
        (field) => `<tr><td>${escape(field.label)}</td><td>${formatInput(field, v[field.key])}</td></tr>`,
      ),
    ]),
  );

  const phHour = v.phCostPerPerson / v.phProductiveHours;
  const inHour = v.indiaCostPerPerson / v.indiaProductiveHours;
  const usHour = v.usCostPerPerson / v.usProductiveHours;
  const fixedSales = v.salesPeople * v.salesCostPerPerson + v.marketingPerMonth;
  fill("calc-per-client", [
    item(`Philippines cost per productive hour = ${money.format(v.phCostPerPerson)} ÷ ${number.format(v.phProductiveHours)} hours = <strong>${cents.format(phHour)}</strong>`),
    item(`India cost per productive hour = ${money.format(v.indiaCostPerPerson)} ÷ ${number.format(v.indiaProductiveHours)} hours = <strong>${cents.format(inHour)}</strong>`),
    item(`United States cost per productive hour = ${money.format(v.usCostPerPerson)} ÷ ${number.format(v.usProductiveHours)} hours = <strong>${cents.format(usHour)}</strong>`),
    item(`Philippines specialists = ${number.format(v.phHoursPerClient)} hours × ${cents.format(phHour)} = <strong>${cents.format(u.specialistCost)}</strong>`),
    item(`Supervision and quality review = ${number.format(v.phHoursPerClient)} hours ÷ ${number.format(v.phProductiveHours)} hours ÷ ${v.supervisorSpan} specialists per supervisor × ${money.format(v.supervisorCostPerPerson)} = <strong>${cents.format(u.supervisionCost)}</strong>`),
    item(`Software and AI usage = ${money.format(v.softwarePerClient)} + ${money.format(v.aiPerClient)} = <strong>${cents.format(u.softwareAiCost)}</strong>`),
    item(`Delivery cost = ${cents.format(u.specialistCost)} + ${cents.format(u.supervisionCost)} + ${cents.format(u.softwareAiCost)} = <strong>${cents.format(u.deliveryCost)}</strong>`),
    item(`Gross profit = fee ${money.format(v.monthlyFee)} − delivery ${cents.format(u.deliveryCost)} = <strong>${cents.format(u.grossProfit)}</strong> (gross margin ${percent(u.grossMargin)})`),
    item(`United States account and analysis = ${number.format(v.usHoursPerClient)} hours × ${cents.format(usHour)} = <strong>${cents.format(u.accountCost)}</strong>`),
    item(`India integration upkeep = ${number.format(v.indiaHoursPerClient)} hours × ${cents.format(inHour)} = <strong>${cents.format(u.integrationCost)}</strong>`),
    item(`Contribution = ${cents.format(u.grossProfit)} − ${cents.format(u.accountCost)} − ${cents.format(u.integrationCost)} = <strong>${cents.format(u.contribution)}</strong> (contribution margin ${percent(u.contributionMargin)})`),
    item(`Onboarding cost per new client = ${number.format(v.phTrainingHoursPerNewClient)} × ${cents.format(phHour)} + ${number.format(v.indiaOnboardingHours)} × ${cents.format(inHour)} + ${number.format(v.usOnboardingHours)} × ${cents.format(usHour)} = <strong>${cents.format(u.onboardingCost)}</strong>, against a ${money.format(v.setupFee)} setup fee`),
    item(
      u.acquisitionCost === null
        ? "Sales cost per new client: not applicable, because no new clients are signed."
        : `Sales cost per new client = ${money.format(v.acquisitionPerNewClient)} + (${money.format(fixedSales)} salespeople and marketing ÷ ${number.format(v.newClientsPerMonth)} new clients) = <strong>${cents.format(u.acquisitionCost)}</strong>`,
    ),
    item(
      u.paybackMonths === null
        ? "Months to earn back sales cost: none, because contribution per client is not positive or no clients are signed."
        : `Months to earn back sales cost = (${cents.format(u.acquisitionCost)} + ${cents.format(Math.max(0, u.onboardingCost - v.setupFee))} onboarding above the setup fee) ÷ ${cents.format(u.contribution)} = <strong>${u.paybackMonths.toFixed(1)} months</strong>`,
    ),
    item(`Expected billed months within ${horizon} months = (1 − (1 − ${number.format(v.clientLossPct)}%)^${horizon}) ÷ ${number.format(v.clientLossPct)}% = <strong>${number.format(u.expectedBilledMonths)}</strong>`),
    item(
      u.lifetimeToAcquisition === null
        ? "Client gross profit vs sales cost: not applicable."
        : `Client gross profit vs sales cost = ${cents.format(u.grossProfit)} × ${number.format(u.expectedBilledMonths)} ÷ ${cents.format(u.acquisitionCost)} = <strong>${u.lifetimeToAcquisition.toFixed(1)} to 1</strong>`,
    ),
    item(`Clients kept after a year = (1 − ${number.format(v.clientLossPct)}%)^12 = <strong>${percent(u.annualClientRetention)}</strong>`),
  ]);

  const lossRate = v.clientLossPct / 100;
  const be = result.breakEvenClients;
  const monthAt = (clients) => operatingMonth(v, clients, clients * lossRate);
  const describe = (clients) => {
    const m = monthAt(clients);
    return `${clients} clients: revenue ${money.format(m.revenue)} − costs ${money.format(m.totalCost)} = <strong>${money.format(m.operatingProfit)}</strong>`;
  };
  fill(
    "calc-break-even",
    be === null
      ? [
          item("Each steady client count from 1 to 5,000 is tested, replacing lost clients every month and keeping the sales team."),
          item(`No count covers all costs. At 5,000 clients: ${describe(5000)}.`),
          item("Result: <strong>Not attainable</strong>"),
        ]
      : [
          item(`Each steady client count is tested from 1 upward, with ${number.format(v.clientLossPct)}% of clients replaced each month (their setup fees count) and the sales team kept.`),
          ...(be > 1 ? [item(`${describe(be - 1)}, still a loss.`)] : []),
          item(`${describe(be)}, the first count with no loss.`),
          item(`Result: <strong>${be} clients</strong>`),
        ],
  );

  const phHours = last.billingClients * v.phHoursPerClient + last.newClients * v.phTrainingHoursPerNewClient;
  const inHours = last.billingClients * v.indiaHoursPerClient + last.newClients * v.indiaOnboardingHours;
  const usHours = last.billingClients * v.usHoursPerClient + last.newClients * v.usOnboardingHours;
  fill("calc-month", [
    item(`Month ${last.month}: ${number.format(last.billingClients)} clients billed (clients at the end of the previous month) and ${number.format(last.newClients)} new clients onboarded.`),
    item(`Philippines work = ${number.format(last.billingClients)} × ${number.format(v.phHoursPerClient)} + ${number.format(last.newClients)} × ${number.format(v.phTrainingHoursPerNewClient)} = ${number.format(phHours)} hours. Specialists = ${number.format(phHours)} ÷ ${number.format(v.phProductiveHours)}, rounded up, at least ${v.phMinSpecialists} = <strong>${last.specialists}</strong>`),
    item(`Supervisors = ${last.specialists} ÷ ${v.supervisorSpan}, rounded up = <strong>${last.supervisors}</strong>`),
    item(`India work = ${number.format(last.billingClients)} × ${number.format(v.indiaHoursPerClient)} + ${number.format(last.newClients)} × ${number.format(v.indiaOnboardingHours)} = ${number.format(inHours)} hours. Engineers = ${number.format(inHours)} ÷ ${number.format(v.indiaProductiveHours)}, rounded up, at least ${v.indiaMinEngineers} = <strong>${last.engineers}</strong>`),
    item(`United States work = ${number.format(last.billingClients)} × ${number.format(v.usHoursPerClient)} + ${number.format(last.newClients)} × ${number.format(v.usOnboardingHours)} = ${number.format(usHours)} hours. Account managers = ${number.format(usHours)} ÷ ${number.format(v.usProductiveHours)}, rounded up = <strong>${last.accountManagers}</strong>`),
    item(`Revenue = ${number.format(last.billingClients)} × ${money.format(v.monthlyFee)} + ${number.format(last.newClients)} × ${money.format(v.setupFee)} = <strong>${money.format(last.revenue)}</strong>`),
    item(`Philippines cost = ${last.specialists} × ${money.format(v.phCostPerPerson)} + ${last.supervisors} × ${money.format(v.supervisorCostPerPerson)} = <strong>${money.format(last.philippinesCost)}</strong>`),
    item(`India cost = ${last.engineers} × ${money.format(v.indiaCostPerPerson)} = <strong>${money.format(last.indiaCost)}</strong>`),
    item(`United States cost = ${last.accountManagers} × ${money.format(v.usCostPerPerson)} = <strong>${money.format(last.usAccountCost)}</strong>`),
    item(`Software and AI = ${number.format(last.billingClients)} × (${money.format(v.softwarePerClient)} + ${money.format(v.aiPerClient)}) = <strong>${money.format(last.softwareAiCost)}</strong>`),
    item(`Sales and marketing = ${v.salesPeople} × ${money.format(v.salesCostPerPerson)} + ${money.format(v.marketingPerMonth)} + ${number.format(last.newClients)} × ${money.format(v.acquisitionPerNewClient)} = <strong>${money.format(last.salesCost)}</strong>`),
    item(`Fixed overhead = ${v.leaders} × ${money.format(v.leaderCostPerPerson)} + ${money.format(v.toolingPerMonth)} + ${money.format(v.adminPerMonth)} = <strong>${money.format(last.overheadCost)}</strong>`),
    item(`Operating profit = ${money.format(last.revenue)} − ${money.format(last.totalCost)} = <strong>${money.format(last.operatingProfit)}</strong>`),
  ]);

  fill(
    "calc-rows",
    p.rows.map(
      (r) =>
        `<tr><th scope="row">${r.month}</th><td>${number.format(r.openingClients)}</td><td>${number.format(r.lostClients)}</td>` +
        `<td>${number.format(r.newClients)}</td><td>${number.format(r.closingClients)}</td><td>${r.specialists}</td>` +
        `<td>${r.supervisors}</td><td>${r.engineers}</td><td>${r.accountManagers}</td><td>${money.format(r.feeRevenue)}</td>` +
        `<td>${money.format(r.setupRevenue)}</td><td>${money.format(r.philippinesCost)}</td><td>${money.format(r.indiaCost)}</td>` +
        `<td>${money.format(r.usAccountCost)}</td><td>${money.format(r.softwareAiCost)}</td><td>${money.format(r.salesCost)}</td>` +
        `<td>${money.format(r.overheadCost)}</td><td>${money.format(r.totalCost)}</td><td>${money.format(r.operatingProfit)}</td>` +
        `<td>${money.format(r.cumulativeCash)}</td></tr>`,
    ),
  );

  // The lowest cash point and payback come from the same monthly steps run
  // forward to month CASH_OUTLOOK_MONTHS, as on the Economics section.
  const extended = planRows(v, Math.max(horizon, CASH_OUTLOOK_MONTHS));
  const trough = extended.find((r) => r.month === p.peakCashMonth);
  const troughText = trough ? money.format(trough.cumulativeCash) : money.format(-v.launchCost);
  const firstProfit = p.firstProfitableMonth;
  fill("calc-headline", [
    item(`Cumulative cash starts at −${money.format(v.launchCost)} (the launch cost). Each month adds that month's operating profit, as in the table above.`),
    item(
      p.peakCashNeed === 0
        ? "Most cash invested: <strong>no cash needed</strong>, because cumulative cash never falls below zero."
        : p.peakCashFound
          ? `Most cash invested = the lowest cumulative cash in a ${p.cashOutlookMonths}-month run of the same steps: ${troughText} in month ${p.peakCashMonth} = <strong>${money.format(p.peakCashNeed)}</strong>`
          : `Most cash invested: cumulative cash is still falling at month ${p.cashOutlookMonths}, so it is <strong>over ${money.format(p.peakCashNeed)}</strong>`,
    ),
    item(
      p.cashPaybackMonth === null
        ? `All cash back by: cumulative cash is still below zero at month ${p.cashOutlookMonths}, so <strong>after month ${p.cashOutlookMonths}</strong>`
        : `All cash back by = the month cumulative cash turns positive and stays positive = <strong>month ${p.cashPaybackMonth}</strong>`,
    ),
    item(
      p.peakCashNeed === 0
        ? "Cash recovered: no cash was invested."
        : `Cash recovered by month ${horizon} = cumulative cash at month ${horizon} ${money.format(p.endingCash)} − lowest point ${troughText}` +
            (p.peakCashMonth >= horizon ? ", counted as zero because the lowest point is not reached until month " + p.peakCashMonth : "") +
            `, capped at the most cash invested = <strong>${money.format(p.cashRecoveredAtHorizon)}</strong> (${percent(p.cashRecoveredShare)})`,
    ),
    item(`Annual operating profit at month-${horizon} pace = ${money.format(last.operatingProfit)} × 12 = <strong>${money.format(p.annualOperatingProfitAtHorizon)}</strong>`),
    item(
      firstProfit === null
        ? `First month with an operating profit: <strong>not by month ${horizon}</strong>`
        : `First month with an operating profit = <strong>month ${firstProfit}</strong>`,
    ),
    item(`Cumulative cash at month ${horizon} = <strong>${money.format(p.endingCash)}</strong>`),
    item(`Operating margin in the final month = ${money.format(last.operatingProfit)} ÷ ${money.format(last.revenue)} = <strong>${percent(p.endingOperatingMargin)}</strong>`),
    item(`Gross margin across all clients, final month = (${money.format(last.feeRevenue)} − ${money.format(last.philippinesCost)} − ${money.format(last.softwareAiCost)}) ÷ ${money.format(last.feeRevenue)} = <strong>${percent(p.endingPooledGrossMargin)}</strong>`),
    item(`Annual fee revenue at the final month's pace = ${money.format(last.feeRevenue)} × 12 = <strong>${money.format(p.annualFeeRevenueAtHorizon)}</strong>`),
    item(
      p.annualRevenuePerPerson === null
        ? "Annual revenue per team member: no team."
        : `Annual revenue per team member = ${money.format(last.revenue)} × 12 ÷ ${last.headcount} people = <strong>${money.format(p.annualRevenuePerPerson)}</strong>`,
    ),
  ]);
}

render();
