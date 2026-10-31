export const cards = [
  {
    id: "RN-01",
    title: "Name our operating lead",
    owner: "Rocket Nation leadership",
    source: "Action 1",
    section: "9-phased-implementation-and-first-30-day-action-plan",
    depends: [],
    evidence:
      "Name the person accountable for service scope, operating cost, client obligations, and the next investment decision.",
  },
  {
    id: "RN-02",
    title: "Set the service boundary",
    owner: "Rocket Nation leadership",
    source: "Action 1",
    depends: ["RN-01"],
    evidence:
      "Write the included workflows and explicit exclusions. Keep licensed advice, safety, field supervision, and legal collections outside the offer.",
  },
  {
    id: "RN-03",
    title: "Commit the country teams",
    owner: "Country operations managers",
    source: "Action 2",
    depends: ["RN-01", "RN-02"],
    evidence:
      "Record named Philippines, India, and United States allocations, shifts, backup, and displaced work. Headcount cannot confirm availability.",
  },
  {
    id: "RN-04",
    title: "Cost coverage and handling",
    owner: "Finance and operations",
    source: "Action 2",
    depends: ["RN-03"],
    evidence:
      "Replace assumed labor and oversight rates with loaded costs. Include paid downtime, coverage floors, supervision, and absence cover.",
  },
  {
    id: "RN-05",
    title: "Choose one launch cohort",
    owner: "Rocket Nation leadership",
    source: "Action 3",
    depends: ["RN-02", "RN-03"],
    evidence:
      "Choose one trade, field-service platform, location profile, and time zone. Record why that group is reachable.",
  },
  {
    id: "RN-06",
    title: "Define a qualified buyer",
    owner: "Rocket Nation leadership",
    source: "Action 3",
    depends: ["RN-05"],
    evidence:
      "Use a qualification sheet covering trade, technician count, platform, economic buyer, field capacity, and repeated office work.",
  },
  {
    id: "RN-07",
    title: "Review the pilot agreement",
    owner: "Rocket Nation leadership with counsel",
    source: "Action 4",
    depends: ["RN-02", "RN-05"],
    evidence:
      "Resolve provider versus client management duties, volume limits, approvals, service targets, cancellation, and remedies.",
  },
  {
    id: "RN-08",
    title: "Approve data and contact rules",
    owner: "Security lead and counsel",
    source: "Action 4",
    depends: ["RN-05", "RN-07"],
    evidence:
      "Approve permitted access, countries, data handling, recording, customer contact, payment links, and critical escalation boundaries.",
  },
  {
    id: "RN-09",
    title: "Build the prospect list",
    owner: "Rocket Nation leadership",
    source: "Action 5",
    depends: ["RN-06"],
    evidence:
      "Produce distinct qualified accounts with a named buyer. Check permission before using current Rocket Station relationships.",
  },
  {
    id: "RN-10",
    title: "Complete buying conversations",
    owner: "Rocket Nation leadership",
    source: "Action 5",
    depends: ["RN-09"],
    evidence:
      "Complete 15 qualified conversations. Record current cost, failures, objections, price response, and reasons for rejection.",
  },
  {
    id: "RN-11",
    title: "Test the best alternative",
    owner: "Sales and operations",
    source: "Actions 5–6; buyer diagnostic",
    depends: ["RN-10"],
    evidence:
      "Record enabled software features, remaining human work, the least costly adequate alternative, and current Orbit overlap. Explain the paid reason to choose this offer.",
  },
  {
    id: "RN-12",
    title: "Obtain permissioned records",
    owner: "Operations lead",
    source: "Action 6",
    depends: ["RN-08", "RN-10"],
    evidence:
      "Obtain usable call, schedule, estimate, and invoice records from three willing firms under approved terms.",
  },
  {
    id: "RN-13",
    title: "Measure volume and peaks",
    owner: "Operations and quality leads",
    source: "Action 6",
    depends: ["RN-12"],
    evidence:
      "Measure calls, wrap time, task attempts, exceptions, and arrivals by 30-minute interval. Keep calls and tasks from being counted twice.",
  },
  {
    id: "RN-14",
    title: "Check value and field capacity",
    owner: "Client manager and finance",
    source: "Action 6",
    depends: ["RN-12"],
    evidence:
      "Confirm the client can fulfill recovered demand. Establish collected contribution per job and a comparable baseline, not ticket value alone.",
  },
  {
    id: "RN-15",
    title: "Reprice the actual workload",
    owner: "Finance and operations",
    source: "Action 7",
    depends: ["RN-04", "RN-11", "RN-13", "RN-14"],
    evidence:
      "Set the fee, call/task caps, overages, and exceptions from measured work. Test the margin threshold with roster costs included.",
  },
  {
    id: "RN-16",
    title: "Fund the roster and cash gap",
    owner: "Rocket Nation leadership",
    source: "Action 7; funding check",
    depends: ["RN-04", "RN-15"],
    evidence:
      "Cost the roster, retained sales budget, onboarding, churn, and remaining reserve. Approve spending in funded stages, including proof-of-concept work and the later operating cash gap.",
  },
  {
    id: "RN-17",
    title: "Sign three paid pilots",
    owner: "Rocket Nation leadership",
    source: "Action 8",
    depends: ["RN-07", "RN-08", "RN-15", "RN-16"],
    evidence:
      "Obtain three signed agreements near the intended price, with a named buyer, bounded scope, and the pilot scorecard.",
  },
  {
    id: "RN-18",
    title: "Confirm pilot payment",
    owner: "Rocket Nation leadership",
    source: "Action 8",
    depends: ["RN-17"],
    evidence:
      "Record real payment and any temporary credit separately. Free trials and polite interest do not establish willingness to pay.",
  },
  {
    id: "RN-19",
    title: "Version each client procedure",
    owner: "Philippines operations lead",
    source: "Action 9",
    depends: ["RN-12", "RN-17"],
    evidence:
      "Approve service area, released slots, fees, scripts, contact limits, escalation recipients, and prohibited promises for each client.",
  },
  {
    id: "RN-20",
    title: "Set individual system access",
    owner: "India engineer and security lead",
    source: "Action 9",
    depends: ["RN-08", "RN-17"],
    evidence:
      "Create least-privilege individual access, the secure queue, audit records, and client separation. Verify actual platform rights.",
  },
  {
    id: "RN-21",
    title: "Configure routing and fallback",
    owner: "Engineer and client manager",
    source: "Actions 9 and 11",
    depends: ["RN-19", "RN-20"],
    evidence:
      "Configure the agreed phone window, customer confirmations, route-back path, and a reachable primary and backup client decision-maker.",
  },
  {
    id: "RN-22",
    title: "Train the primary specialists",
    owner: "Training and quality leads",
    source: "Action 10",
    depends: ["RN-19", "RN-20"],
    evidence:
      "Grade approved booking, documentation, contact, payment-link, privacy, and escalation cases. Record corrections before certification.",
  },
  {
    id: "RN-23",
    title: "Certify absence coverage",
    owner: "Training and shift leads",
    source: "Action 10",
    depends: ["RN-19", "RN-20"],
    evidence:
      "Certify backup operators on each configuration. Confirm the roster still covers the service window during absence and handover.",
  },
  {
    id: "RN-24",
    title: "Pass the critical scenarios",
    owner: "Quality lead and trade advisor",
    source: "Action 10",
    depends: ["RN-21", "RN-22", "RN-23"],
    evidence:
      "Pass urgent-call, no-capacity, missing-consent, payment-dispute, and uncertain-write cases without an unresolved critical error.",
  },
  {
    id: "RN-25",
    title: "Drill recovery and response",
    owner: "Engineer, shift lead, client",
    source: "Action 11",
    depends: ["RN-21", "RN-24"],
    evidence:
      "Demonstrate routing recovery, committed-write reconciliation, acknowledged escalation, and interval capacity for the admitted call load.",
  },
  {
    id: "RN-26",
    title: "Admit bounded live traffic",
    owner: "Philippines shift lead",
    source: "Action 12",
    depends: ["RN-18", "RN-25"],
    evidence:
      "Start only the approved volume and window. Log every exception, handling minute, rework item, cost, and customer outcome.",
  },
  {
    id: "RN-27",
    title: "Close the pilot scorecard",
    owner: "Operations, finance, client",
    source: "Action 13; pilot scorecard",
    depends: ["RN-26"],
    evidence:
      "Close comparable observation windows. Test response, accuracy, critical errors, client value, roster cost, and management effort. Leave open periods pending.",
  },
  {
    id: "RN-28",
    title: "Renew, revise, or stop",
    owner: "Rocket Nation leadership",
    source: "Action 13; renewal check",
    depends: ["RN-27"],
    evidence:
      "Record two obtained standard-price renewals before expansion, plus passed quality, client-value, repeatability, and funding checks. A request or pending response does not pass. Otherwise record a bounded revise or stop decision.",
  },
];
export const columns = [
  { id: "backlog", label: "Pending dependencies" },
  { id: "ready", label: "Ready to start" },
  { id: "doing", label: "In progress" },
  { id: "done", label: "Evidence recorded" },
];
