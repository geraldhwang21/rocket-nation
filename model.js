export const scenarios = {
  downside: {
    price: 1995,
    hours: 85,
    labor: 14,
    technology: 250,
    quality: 365,
    clientSupport: 180,
    support: 100,
    cac: 6000,
    fixed: 45000,
    setup: 1000,
    onboarding: 1500,
    churn: 0.04,
    commercialFloor: 10000,
  },
  base: {
    price: 2495,
    hours: 60,
    labor: 11,
    technology: 180,
    quality: 365,
    clientSupport: 120,
    support: 100,
    cac: 4500,
    fixed: 45000,
    setup: 1500,
    onboarding: 1200,
    churn: 0.02,
    commercialFloor: 10000,
  },
  upside: {
    price: 2995,
    hours: 50,
    labor: 10,
    technology: 200,
    quality: 365,
    clientSupport: 100,
    support: 120,
    cac: 3500,
    fixed: 45000,
    setup: 1800,
    onboarding: 1000,
    churn: 0.01,
    commercialFloor: 10000,
  },
};
export function calculate(inputs) {
  for (const name of Object.keys(scenarios.base)) {
    if (
      typeof inputs[name] !== "number" ||
      !Number.isFinite(inputs[name]) ||
      inputs[name] < 0
    )
      throw new RangeError(`Invalid ${name}`);
  }
  if (inputs.price <= 0 || inputs.hours <= 0 || inputs.labor <= 0)
    throw new RangeError("Fee, workload and labor cost must be positive.");
  if (inputs.churn > 1)
    throw new RangeError("Monthly churn must be between zero and one.");
  const directCost =
    inputs.hours * inputs.labor +
    inputs.technology +
    inputs.quality +
    inputs.clientSupport;
  const grossProfit = inputs.price - directCost;
  const contribution = grossProfit - inputs.support;
  const replacementContribution =
    contribution -
    inputs.churn * (inputs.cac + inputs.onboarding - inputs.setup);
  const benefitBeforeAcquisition =
    contribution + inputs.churn * (inputs.setup - inputs.onboarding);
  const replacementAcquisition = inputs.churn * inputs.cac;
  let cashBreakEven = null;
  if (replacementContribution > 0) {
    const floorCandidate = Math.ceil(
      (inputs.fixed + inputs.commercialFloor) / benefitBeforeAcquisition,
    );
    cashBreakEven =
      floorCandidate * replacementAcquisition <= inputs.commercialFloor
        ? floorCandidate
        : Math.ceil(inputs.fixed / replacementContribution);
  }
  return {
    directCost,
    grossProfit,
    grossMargin: grossProfit / inputs.price,
    contribution,
    contributionMargin: contribution / inputs.price,
    payback:
      contribution > 0
        ? (inputs.cac + Math.max(0, inputs.onboarding - inputs.setup)) /
          contribution
        : null,
    breakEven: contribution > 0 ? Math.ceil(inputs.fixed / contribution) : null,
    replacementContribution,
    cashBreakEven,
    annualRetention: (1 - inputs.churn) ** 12,
  };
}

export function cohortCost(inputs, clients) {
  calculate(inputs);
  if (!Number.isFinite(clients) || clients < 0)
    throw new RangeError("Invalid client count.");
  if (clients === 0)
    return {
      frontlineFTE: 0,
      frontlineCost: 0,
      qualityCost: 0,
      directCost: 0,
      contribution: 0,
    };
  const productiveCapacity = 110.5;
  const frontlineFTE = Math.max(
    2.5,
    Math.ceil((clients * inputs.hours) / productiveCapacity),
  );
  const frontlineCost = frontlineFTE * productiveCapacity * inputs.labor;
  const minimumOversightFTE = clients <= 3 ? 0.75 : clients <= 10 ? 1.5 : 0;
  const supervisorAndReviewHours =
    clients <= 10
      ? 0
      : Math.ceil(frontlineFTE / 10) * productiveCapacity +
        clients * ((70 * 4) / 60);
  const qualityCost = Math.max(
    clients * inputs.quality,
    minimumOversightFTE * productiveCapacity * 22,
    supervisorAndReviewHours * 22,
  );
  const directCost =
    frontlineCost +
    qualityCost +
    clients * (inputs.technology + inputs.clientSupport);
  return {
    frontlineFTE,
    frontlineCost,
    qualityCost,
    directCost,
    contribution:
      clients * inputs.price - directCost - clients * inputs.support,
  };
}

export function cashBridge(
  inputs,
  { months = 24, grossWins = 45, learningCost = 30000 } = {},
) {
  calculate(inputs);
  if (
    !Number.isInteger(months) ||
    months < 1 ||
    months > 120 ||
    !Number.isFinite(grossWins) ||
    grossWins < 0 ||
    !Number.isFinite(learningCost) ||
    learningCost < 0
  )
    throw new RangeError("Invalid cash bridge inputs.");
  const winsPerMonth = grossWins / months;
  let clients = 0,
    cumulativeCash = -learningCost;
  const rows = [];
  for (let month = 1; month <= months; month++) {
    const openingClients = clients;
    const lostClients = openingClients * inputs.churn;
    clients = openingClients - lostClients + winsPerMonth;
    const cohort = cohortCost(inputs, clients);
    const commercialSpend = Math.max(
      inputs.commercialFloor,
      winsPerMonth * inputs.cac,
    );
    const setupCash = winsPerMonth * (inputs.setup - inputs.onboarding);
    const netCash =
      cohort.contribution - inputs.fixed - commercialSpend + setupCash;
    cumulativeCash += netCash;
    rows.push({
      month,
      openingClients,
      grossWins: winsPerMonth,
      lostClients,
      clients,
      directCost: cohort.directCost,
      contribution: cohort.contribution,
      fixedSpend: inputs.fixed,
      commercialSpend,
      setupCash,
      netCash,
      cumulativeCash,
    });
  }
  return {
    rows,
    learningCost,
    winsPerMonth,
    acquisitionCostAtModeledThroughput:
      winsPerMonth > 0
        ? Math.max(inputs.commercialFloor, winsPerMonth * inputs.cac) /
          winsPerMonth
        : null,
    peakCashNeed: Math.max(
      learningCost,
      ...rows.map((row) => -row.cumulativeCash),
    ),
  };
}

// ---------------------------------------------------------------------------
// Operating plan model used by the website Economics section.
// The functions above are the earlier per-client model. The plan chapter and
// tools/apply-reader-one-content.mjs still read them, so they stay unchanged.
//
// Every figure below is a planning assumption, not an observed result.
// All measures are undiscounted: no discount rate is applied anywhere.
// ---------------------------------------------------------------------------

// Each field: key, label, unit, allowed range, and whether it must be whole.
export const planFieldGroups = [
  {
    id: "revenue",
    title: "Fees and client growth",
    fields: [
      { key: "monthlyFee", label: "Monthly service fee per client", unit: "usd", min: 500, max: 20000 },
      { key: "setupFee", label: "One-time setup fee per new client", unit: "usd", min: 0, max: 20000 },
      { key: "newClientsPerMonth", label: "New clients signed per month", unit: "clients", min: 0, max: 50 },
      { key: "clientLossPct", label: "Clients lost each month", unit: "percent", min: 0, max: 50 },
      { key: "horizonMonths", label: "Months to project", unit: "months", min: 12, max: 60, whole: true },
      { key: "launchCost", label: "One-time launch cost before the first client", unit: "usd", min: 0, max: 2000000 },
    ],
  },
  {
    id: "philippines",
    title: "Philippines delivery team (calls and office work)",
    fields: [
      { key: "phHoursPerClient", label: "Specialist hours per client per month", unit: "hours", min: 1, max: 400 },
      { key: "phTrainingHoursPerNewClient", label: "Specialist training hours per new client", unit: "hours", min: 0, max: 400 },
      { key: "phProductiveHours", label: "Productive hours per specialist per month", unit: "hours", min: 40, max: 200 },
      { key: "phCostPerPerson", label: "Monthly cost per specialist, fully loaded", unit: "usd", min: 100, max: 20000 },
      { key: "phMinSpecialists", label: "Minimum specialists once serving any client", unit: "people", min: 0, max: 50, whole: true },
      { key: "supervisorSpan", label: "Specialists per supervisor and quality reviewer", unit: "people", min: 1, max: 30, whole: true },
      { key: "supervisorCostPerPerson", label: "Monthly cost per supervisor, fully loaded", unit: "usd", min: 100, max: 30000 },
    ],
  },
  {
    id: "india",
    title: "India integration and automation team",
    fields: [
      { key: "indiaHoursPerClient", label: "Integration upkeep hours per client per month", unit: "hours", min: 0, max: 200 },
      { key: "indiaOnboardingHours", label: "Integration build hours per new client", unit: "hours", min: 0, max: 500 },
      { key: "indiaProductiveHours", label: "Productive hours per engineer per month", unit: "hours", min: 40, max: 200 },
      { key: "indiaCostPerPerson", label: "Monthly cost per engineer, fully loaded", unit: "usd", min: 100, max: 30000 },
      { key: "indiaMinEngineers", label: "Minimum engineers kept for the platform", unit: "people", min: 0, max: 50, whole: true },
    ],
  },
  {
    id: "us",
    title: "United States account, analysis and AI team",
    fields: [
      { key: "usHoursPerClient", label: "Account and analysis hours per client per month", unit: "hours", min: 0, max: 100 },
      { key: "usOnboardingHours", label: "Process review hours per new client", unit: "hours", min: 0, max: 300 },
      { key: "usProductiveHours", label: "Productive hours per account manager per month", unit: "hours", min: 40, max: 200 },
      { key: "usCostPerPerson", label: "Monthly cost per account manager, fully loaded", unit: "usd", min: 100, max: 50000 },
    ],
  },
  {
    id: "software",
    title: "Software and AI usage",
    fields: [
      { key: "softwarePerClient", label: "Software and telephony per client per month", unit: "usd", min: 0, max: 5000 },
      { key: "aiPerClient", label: "AI usage per client per month", unit: "usd", min: 0, max: 5000 },
    ],
  },
  {
    id: "sales",
    title: "Sales and marketing",
    fields: [
      { key: "salesPeople", label: "Salespeople", unit: "people", min: 0, max: 50, whole: true },
      { key: "salesCostPerPerson", label: "Monthly cost per salesperson, fully loaded", unit: "usd", min: 0, max: 50000 },
      { key: "marketingPerMonth", label: "Fixed marketing budget per month", unit: "usd", min: 0, max: 500000 },
      { key: "acquisitionPerNewClient", label: "Commission and campaign cost per new client", unit: "usd", min: 0, max: 50000 },
    ],
  },
  {
    id: "overhead",
    title: "Fixed overhead",
    fields: [
      { key: "leaders", label: "United States leaders (operations, process and AI)", unit: "people", min: 0, max: 50, whole: true },
      { key: "leaderCostPerPerson", label: "Monthly cost per leader, fully loaded", unit: "usd", min: 0, max: 60000 },
      { key: "toolingPerMonth", label: "Shared tools and platform per month", unit: "usd", min: 0, max: 500000 },
      { key: "adminPerMonth", label: "Administration, security, insurance and advice per month", unit: "usd", min: 0, max: 500000 },
    ],
  },
];

export const planFields = planFieldGroups.flatMap((group) => group.fields);

const sharedPlanInputs = {
  horizonMonths: 36,
  launchCost: 30000,
  phProductiveHours: 110.5,
  phMinSpecialists: 3,
  supervisorCostPerPerson: 2430,
  indiaProductiveHours: 130,
  indiaCostPerPerson: 5200,
  indiaMinEngineers: 2,
  usProductiveHours: 120,
  usCostPerPerson: 8500,
  salesPeople: 1,
  salesCostPerPerson: 6500,
  marketingPerMonth: 1500,
  leaders: 2,
  leaderCostPerPerson: 11000,
  toolingPerMonth: 3000,
  adminPerMonth: 8000,
};

// Specialist monthly cost = owner's $20 per productive hour times 110.5
// productive hours. Engineer monthly cost = owner's $40 per hour times 130.
export const planScenarios = {
  downside: {
    ...sharedPlanInputs,
    monthlyFee: 1995,
    setupFee: 1000,
    newClientsPerMonth: 1.5,
    clientLossPct: 4,
    phHoursPerClient: 85,
    phTrainingHoursPerNewClient: 30,
    phCostPerPerson: 2210,
    supervisorSpan: 5,
    indiaHoursPerClient: 6,
    indiaOnboardingHours: 30,
    usHoursPerClient: 3,
    usOnboardingHours: 12,
    softwarePerClient: 170,
    aiPerClient: 80,
    acquisitionPerNewClient: 2500,
  },
  base: {
    ...sharedPlanInputs,
    monthlyFee: 2495,
    setupFee: 1500,
    newClientsPerMonth: 2,
    clientLossPct: 2,
    phHoursPerClient: 60,
    phTrainingHoursPerNewClient: 20,
    phCostPerPerson: 2210,
    supervisorSpan: 6,
    indiaHoursPerClient: 4,
    indiaOnboardingHours: 20,
    usHoursPerClient: 2,
    usOnboardingHours: 8,
    softwarePerClient: 120,
    aiPerClient: 60,
    acquisitionPerNewClient: 1500,
  },
  upside: {
    ...sharedPlanInputs,
    monthlyFee: 2995,
    setupFee: 1800,
    newClientsPerMonth: 3,
    clientLossPct: 1,
    phHoursPerClient: 50,
    phTrainingHoursPerNewClient: 16,
    phCostPerPerson: 2210,
    supervisorSpan: 7,
    indiaHoursPerClient: 3,
    indiaOnboardingHours: 15,
    usHoursPerClient: 2,
    usOnboardingHours: 6,
    softwarePerClient: 140,
    aiPerClient: 60,
    acquisitionPerNewClient: 1000,
  },
};

export function validatePlanInputs(inputs) {
  if (inputs === null || typeof inputs !== "object")
    throw new RangeError("Inputs are missing.");
  for (const field of planFields) {
    const value = inputs[field.key];
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new RangeError(`${field.label}: enter a number.`);
    if (value < field.min || value > field.max)
      throw new RangeError(
        `${field.label}: enter a value from ${field.min} to ${field.max}.`,
      );
    if (field.whole && !Number.isInteger(value))
      throw new RangeError(`${field.label}: enter a whole number.`);
  }
}

// Whole people needed for a workload. The small tolerance stops a value such
// as 6.0000000001, caused by floating-point arithmetic, from adding a person.
function wholePeople(fullTimeEquivalents) {
  if (fullTimeEquivalents <= 0) return 0;
  return Math.ceil(fullTimeEquivalents - 1e-9);
}

// One month of operations. Billing clients pay the monthly fee and receive
// delivery. New clients pay the setup fee, are onboarded this month and start
// paying the monthly fee next month.
export function operatingMonth(inputs, billingClients, newClients) {
  const phWorkHours =
    billingClients * inputs.phHoursPerClient +
    newClients * inputs.phTrainingHoursPerNewClient;
  const specialists =
    phWorkHours > 0
      ? Math.max(
          inputs.phMinSpecialists,
          wholePeople(phWorkHours / inputs.phProductiveHours),
        )
      : 0;
  const supervisors =
    specialists > 0 ? wholePeople(specialists / inputs.supervisorSpan) : 0;
  const indiaWorkHours =
    billingClients * inputs.indiaHoursPerClient +
    newClients * inputs.indiaOnboardingHours;
  const engineers = Math.max(
    inputs.indiaMinEngineers,
    wholePeople(indiaWorkHours / inputs.indiaProductiveHours),
  );
  const usWorkHours =
    billingClients * inputs.usHoursPerClient +
    newClients * inputs.usOnboardingHours;
  const accountManagers = wholePeople(usWorkHours / inputs.usProductiveHours);

  const feeRevenue = billingClients * inputs.monthlyFee;
  const setupRevenue = newClients * inputs.setupFee;
  const revenue = feeRevenue + setupRevenue;

  const philippinesCost =
    specialists * inputs.phCostPerPerson +
    supervisors * inputs.supervisorCostPerPerson;
  const indiaCost = engineers * inputs.indiaCostPerPerson;
  const usAccountCost = accountManagers * inputs.usCostPerPerson;
  const softwareAiCost =
    billingClients * (inputs.softwarePerClient + inputs.aiPerClient);
  const salesCost =
    inputs.salesPeople * inputs.salesCostPerPerson +
    inputs.marketingPerMonth +
    newClients * inputs.acquisitionPerNewClient;
  const overheadCost =
    inputs.leaders * inputs.leaderCostPerPerson +
    inputs.toolingPerMonth +
    inputs.adminPerMonth;
  const totalCost =
    philippinesCost +
    indiaCost +
    usAccountCost +
    softwareAiCost +
    salesCost +
    overheadCost;

  return {
    billingClients,
    newClients,
    specialists,
    supervisors,
    engineers,
    accountManagers,
    headcount:
      specialists +
      supervisors +
      engineers +
      accountManagers +
      inputs.salesPeople +
      inputs.leaders,
    feeRevenue,
    setupRevenue,
    revenue,
    philippinesCost,
    indiaCost,
    usAccountCost,
    softwareAiCost,
    salesCost,
    overheadCost,
    totalCost,
    operatingProfit: revenue - totalCost,
  };
}

// Per-client figures at a scale where people are fully shared, so a fraction
// of a person is costed. The projection uses whole people instead.
export function perClientEconomics(inputs) {
  validatePlanInputs(inputs);
  const lossRate = inputs.clientLossPct / 100;
  const phHourlyCost = inputs.phCostPerPerson / inputs.phProductiveHours;
  const indiaHourlyCost =
    inputs.indiaCostPerPerson / inputs.indiaProductiveHours;
  const usHourlyCost = inputs.usCostPerPerson / inputs.usProductiveHours;

  const specialistCost = inputs.phHoursPerClient * phHourlyCost;
  const supervisionCost =
    (inputs.phHoursPerClient /
      inputs.phProductiveHours /
      inputs.supervisorSpan) *
    inputs.supervisorCostPerPerson;
  const softwareAiCost = inputs.softwarePerClient + inputs.aiPerClient;
  const deliveryCost = specialistCost + supervisionCost + softwareAiCost;
  const grossProfit = inputs.monthlyFee - deliveryCost;

  const accountCost = inputs.usHoursPerClient * usHourlyCost;
  const integrationCost = inputs.indiaHoursPerClient * indiaHourlyCost;
  const contribution = grossProfit - accountCost - integrationCost;

  const onboardingCost =
    inputs.phTrainingHoursPerNewClient * phHourlyCost +
    inputs.indiaOnboardingHours * indiaHourlyCost +
    inputs.usOnboardingHours * usHourlyCost;
  const fixedSalesPerMonth =
    inputs.salesPeople * inputs.salesCostPerPerson + inputs.marketingPerMonth;
  const acquisitionCost =
    inputs.newClientsPerMonth > 0
      ? inputs.acquisitionPerNewClient +
        fixedSalesPerMonth / inputs.newClientsPerMonth
      : null;
  // A setup fee above onboarding cost does not shorten payback; a shortfall
  // lengthens it.
  const paybackMonths =
    acquisitionCost !== null && contribution > 0
      ? (acquisitionCost + Math.max(0, onboardingCost - inputs.setupFee)) /
        contribution
      : null;
  // Expected billed months for one client within the horizon, undiscounted:
  // the sum of (1 - loss rate)^k for k = 0 .. horizon - 1.
  const expectedBilledMonths =
    lossRate > 0
      ? (1 - (1 - lossRate) ** inputs.horizonMonths) / lossRate
      : inputs.horizonMonths;
  const lifetimeGrossProfit = grossProfit * expectedBilledMonths;
  const lifetimeToAcquisition =
    acquisitionCost !== null && acquisitionCost > 0
      ? lifetimeGrossProfit / acquisitionCost
      : null;

  return {
    fee: inputs.monthlyFee,
    specialistCost,
    supervisionCost,
    softwareAiCost,
    deliveryCost,
    grossProfit,
    grossMargin: grossProfit / inputs.monthlyFee,
    accountCost,
    integrationCost,
    contribution,
    contributionMargin: contribution / inputs.monthlyFee,
    onboardingCost,
    acquisitionCost,
    paybackMonths,
    expectedBilledMonths,
    lifetimeGrossProfit,
    lifetimeToAcquisition,
    annualClientRetention: (1 - lossRate) ** 12,
  };
}

// Smallest steady client count whose monthly operating profit covers every
// cost, with whole people, the fixed sales team kept, and lost clients
// replaced each month. Returns null when no count up to the limit works.
export function breakEvenClients(inputs, limit = 5000) {
  validatePlanInputs(inputs);
  const lossRate = inputs.clientLossPct / 100;
  for (let clients = 1; clients <= limit; clients++) {
    const month = operatingMonth(inputs, clients, clients * lossRate);
    if (month.operatingProfit >= 0) return clients;
  }
  return null;
}

// The cash outlook runs the same plan forward this many months, beyond the
// chosen horizon, to find the true lowest cash point and the payback month.
export const CASH_OUTLOOK_MONTHS = 240;

// Monthly rows for the plan, from month 1 to the given month.
export function planRows(inputs, months) {
  const lossRate = inputs.clientLossPct / 100;
  const rows = [];
  let closingClients = 0;
  let cumulativeCash = -inputs.launchCost;
  for (let month = 1; month <= months; month++) {
    const openingClients = closingClients;
    const lostClients = openingClients * lossRate;
    const newClients = inputs.newClientsPerMonth;
    closingClients = openingClients - lostClients + newClients;
    const operations = operatingMonth(inputs, openingClients, newClients);
    cumulativeCash += operations.operatingProfit;
    rows.push({
      month,
      openingClients,
      lostClients,
      closingClients,
      ...operations,
      cumulativeCash,
    });
  }
  return rows;
}

// Lowest cumulative cash point and payback month over the extended run.
// troughFound is false when cash is still falling at the last month run, so
// the lowest point lies even later. Payback is the month after the last month
// with negative cumulative cash, provided cash ends recovered; zero means no
// cash was ever needed.
function cashOutlook(inputs, rows) {
  let troughCash = -inputs.launchCost;
  let troughMonth = 0;
  let lastNegativeMonth = troughCash < 0 ? 0 : null;
  for (const row of rows) {
    if (row.cumulativeCash < troughCash) {
      troughCash = row.cumulativeCash;
      troughMonth = row.month;
    }
    if (row.cumulativeCash < 0) lastNegativeMonth = row.month;
  }
  const last = rows.at(-1);
  const endingCash = last ? last.cumulativeCash : -inputs.launchCost;
  let paybackMonth = null;
  if (endingCash >= 0)
    paybackMonth = lastNegativeMonth === null ? 0 : lastNegativeMonth + 1;
  return {
    troughCash,
    troughMonth,
    troughFound: !last || last.operatingProfit >= 0 || troughMonth < last.month,
    paybackMonth,
    monthsRun: rows.length,
  };
}

export function projectPlan(inputs) {
  validatePlanInputs(inputs);
  const extended = planRows(
    inputs,
    Math.max(inputs.horizonMonths, CASH_OUTLOOK_MONTHS),
  );
  const rows = extended.slice(0, inputs.horizonMonths);
  const outlook = cashOutlook(inputs, extended);
  const cumulativeCash = rows.at(-1).cumulativeCash;
  let firstProfitableMonth = null;
  for (const row of rows) {
    if (row.operatingProfit >= 0) {
      firstProfitableMonth = row.month;
      break;
    }
  }
  const last = rows.at(-1);
  // Most cash invested is the lowest cumulative cash point of the extended
  // run, which can fall after the chosen horizon.
  const peakCashNeed = Math.max(0, -outlook.troughCash);
  const cashPaybackMonth = outlook.paybackMonth;
  // Cash recovered by the horizon: how far cumulative cash has climbed back
  // from its lowest point. Zero when the lowest point is at or after the
  // horizon.
  const cashRecoveredAtHorizon =
    outlook.troughMonth < inputs.horizonMonths
      ? Math.min(peakCashNeed, cumulativeCash - outlook.troughCash)
      : 0;
  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
  const totalRevenue = sum("revenue");
  const totalCost = sum("totalCost") + inputs.launchCost;
  // Cumulative operating profit includes the one-time launch cost, so it
  // equals the cumulative cash position at the horizon.
  const cumulativeOperatingProfit = totalRevenue - totalCost;
  const lastDeliveryCost = last.philippinesCost + last.softwareAiCost;

  return {
    rows,
    peakCashNeed,
    endingCash: cumulativeCash,
    cumulativeOperatingProfit,
    totalRevenue,
    totalCost,
    peakCashMonth: outlook.troughMonth,
    peakCashFound: outlook.troughFound,
    cashOutlookMonths: outlook.monthsRun,
    cashRecoveredAtHorizon,
    cashRecoveredShare:
      peakCashNeed > 0 ? cashRecoveredAtHorizon / peakCashNeed : null,
    annualOperatingProfitAtHorizon: last.operatingProfit * 12,
    cashPaybackMonth,
    firstProfitableMonth,
    endingClients: last.closingClients,
    endingHeadcount: last.headcount,
    endingMonthlyRevenue: last.revenue,
    endingOperatingProfit: last.operatingProfit,
    endingOperatingMargin:
      last.revenue > 0 ? last.operatingProfit / last.revenue : null,
    endingPooledGrossMargin:
      last.feeRevenue > 0
        ? (last.feeRevenue - lastDeliveryCost) / last.feeRevenue
        : null,
    annualFeeRevenueAtHorizon: last.feeRevenue * 12,
    annualRevenuePerPerson:
      last.headcount > 0 ? (last.revenue * 12) / last.headcount : null,
  };
}

// Groups monthly rows into quarters (the last group may be shorter).
export function quarterlyRows(rows) {
  const quarters = [];
  for (let start = 0; start < rows.length; start += 3) {
    const group = rows.slice(start, start + 3);
    const total = (key) => group.reduce((sum, row) => sum + row[key], 0);
    const end = group.at(-1);
    quarters.push({
      firstMonth: group[0].month,
      lastMonth: end.month,
      newClients: total("newClients"),
      closingClients: end.closingClients,
      headcount: end.headcount,
      revenue: total("revenue"),
      totalCost: total("totalCost"),
      operatingProfit: total("operatingProfit"),
      cumulativeCash: end.cumulativeCash,
    });
  }
  return quarters;
}

export function planEconomics(inputs) {
  return {
    perClient: perClientEconomics(inputs),
    breakEvenClients: breakEvenClients(inputs),
    projection: projectPlan(inputs),
  };
}
