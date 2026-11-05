import { planFields, planEconomics, validatePlanInputs } from "./model.js";
import { printReport } from "./scenario-report.js";

export const MODEL_VERSION = "rocket-nation-economics-2026-11-05";
const STORAGE_KEY = "rocket-nation.economic-scenarios.v1";
const MAX_BYTES = 2000000;

function cleanInputs(inputs) {
  validatePlanInputs(inputs);
  return Object.fromEntries(planFields.map(({key}) => [key, inputs[key]]));
}
export function createSnapshot(name, notes, inputs) {
  return validateSnapshot({format:"rocket-nation-economic-scenario", schemaVersion:1,
    name, notes, savedAt:new Date().toISOString(), modelVersion:MODEL_VERSION,
    inputs:cleanInputs(inputs), results:planEconomics(inputs)});
}
export function validateSnapshot(value) {
  if (!value || value.format !== "rocket-nation-economic-scenario" || value.schemaVersion !== 1)
    throw new Error("This is not a supported Rocket Nation scenario file.");
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 100 ||
      typeof value.notes !== "string" || value.notes.length > 2000 ||
      typeof value.savedAt !== "string" || !Number.isFinite(Date.parse(value.savedAt)) ||
      typeof value.modelVersion !== "string" || !value.modelVersion || value.modelVersion.length > 100)
    throw new Error("The scenario name, notes, date or model version is invalid.");
  cleanInputs(value.inputs);
  const r=value.results;
  if (!r || typeof r !== "object" || !r.perClient || !r.projection ||
      !Array.isArray(r.projection.rows) || r.projection.rows.length !== value.inputs.horizonMonths)
    throw new Error("The saved analysis or monthly projection is missing.");
  const numeric = (x) => typeof x === "number" && Number.isFinite(x);
  for (const key of ["endingCash","totalRevenue","totalCost","endingClients","peakCashNeed"])
    if (!numeric(r.projection[key])) throw new Error("Invalid saved financial results.");
  for (const [i,row] of r.projection.rows.entries())
    if (row.month !== i+1 || ![row.revenue,row.totalCost,row.operatingProfit,row.cumulativeCash,row.closingClients].every(numeric))
      throw new Error("Invalid saved monthly projection.");
  const encoded=JSON.stringify(value);
  if (encoded.length > MAX_BYTES) throw new Error("The scenario file is too large.");
  return JSON.parse(encoded);
}

if (typeof document !== "undefined") initialize();
function initialize() {
  const form = document.querySelector("#economics-form");
  const panel = document.querySelector("#saved-scenarios");
  if (!form || !panel) return;
  const get = id => panel.querySelector(`#${id}`);
  const name = get("scenario-name");
  const notes = get("scenario-notes");
  const select = get("scenario-open");
  const status = get("scenario-status");
  const stateLabel = get("scenario-save-state");
  const preview = get("scenario-import-preview");
  const original = get("scenario-original");
  const duplicate = get("scenario-replace-choice");
  let saved = [], invalidEntries = [], active = null, pending = null, pendingSave = null;
  let cleanState = "", storageWritable = true, suppressDirty = false, activeStored = false;
  const say = message => { status.textContent = message; };
  const fieldsState = () => JSON.stringify({
    inputs: planFields.map(({key}) => form.elements[key].value),
    name: name.value, notes: notes.value,
  });
  const isDirty = () => fieldsState() !== cleanState;
  function updateDirty() {
    if (suppressDirty) return;
    const changed = isDirty();
    stateLabel.textContent = changed ? "Unsaved changes · not saved on this device" :
      active ? (activeStored ? `Saved on this device: ${active.name}` : `Opened file: ${active.name} · not saved on this device`) : "Current calculation · not saved on this device";
    stateLabel.dataset.state = changed ? "unsaved" : activeStored ? "saved" : "new";
    if (pendingSave) { pendingSave = null; duplicate.hidden = true; say("Save prompt closed because the calculation changed. Choose Save on this device again when ready."); }
  }
  function readInputs() {
    return cleanInputs(Object.fromEntries(planFields.map(({key}) => [key, Number(form.elements[key].value)])));
  }
  function loadCollection() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : {scenarios: [], lastOpened: null};
    if (!Array.isArray(stored.scenarios)) throw new Error("Saved calculations could not be read.");
    invalidEntries = [];
    const valid = [];
    for (const entry of stored.scenarios) {
      try { valid.push(validateSnapshot(entry)); }
      catch { invalidEntries.push(entry); }
    }
    stored.scenarios = valid;
    storageWritable = true;
    return stored;
  }
  function syncCollection() {
    try { saved = loadCollection().scenarios; }
    catch { storageWritable = false; throw new Error("Saved device data could not be read. It has been preserved. Download a file to keep this calculation."); }
  }
  function persist(lastOpened) {
    if (!storageWritable) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({scenarios: [...saved, ...invalidEntries], lastOpened}));
      return true;
    } catch {
      say("This browser cannot save on this device. Download a calculation file to keep your work.");
      return false;
    }
  }
  function refresh(selectedName = activeStored ? active?.name : null) {
    select.replaceChildren(new Option("Choose a calculation saved on this device", ""));
    saved.forEach((snapshot, index) => {
      const option = new Option(`${snapshot.name} — ${new Date(snapshot.savedAt).toLocaleString()}`, String(index));
      option.selected = snapshot.name === selectedName;
      select.add(option);
    });
    get("scenario-open-button").disabled = saved.length === 0;
    get("scenario-empty").hidden = saved.length !== 0;
  }
  function showOriginal() {
    original.hidden = !active;
    if (!active) return;
    const p = active.results.projection;
    get("scenario-original-summary").textContent =
      `${active.name}, saved ${new Date(active.savedAt).toLocaleString()} using ${active.modelVersion}. ` +
      `Recorded revenue: ${dollars(p.totalRevenue)}; cost: ${dollars(p.totalCost)}; ending cash: ${dollars(p.endingCash)}. ` +
      (active.modelVersion === MODEL_VERSION ? "These recorded results are preserved when you edit the current calculation." :
        "This file uses an earlier model version. Current inputs have been recalculated with the current model. The original results remain available below.");
  }
  function mayReplaceWorkingCalculation() {
    return !isDirty() || confirm("Discard the unsaved changes in the current calculation and open another calculation?");
  }
  function open(snapshot, remember = true, storedOnDevice = true) {
    const next = validateSnapshot(snapshot);
    suppressDirty = true;
    for (const {key} of planFields) form.elements[key].value = next.inputs[key];
    form.dispatchEvent(new Event("input", {bubbles:true}));
    name.value = next.name; notes.value = next.notes; active = next;
    suppressDirty = false;
    activeStored = storedOnDevice && (remember ? persist(next.name) : true);
    cleanState = fieldsState(); updateDirty(); showOriginal(); refresh();
    say(`Opened “${next.name}”. Inputs restored and current results recalculated; original saved results preserved.` +
      (activeStored ? "" : " This file is not saved on this device. Choose Save on this device to keep it here."));
  }
  function handle(action) { try { action(); } catch (error) { say(error.message); } }
  function snapshotForCurrent(requireName = false) {
    if (!form.reportValidity()) return null;
    if (requireName && !name.value.trim()) {
      say("Give this calculation a name before saving on this device."); name.focus(); return null;
    }
    return createSnapshot(name.value.trim() || "Current calculation", notes.value, readInputs());
  }
  function uniqueName(stem, suffix) {
    let index = 2;
    const short = stem.slice(0,80);
    while (saved.some(s => s.name === `${short} (${suffix} ${index})`)) index++;
    return `${short} (${suffix} ${index})`;
  }
  function saveSnapshot(snapshot, replace) {
    // Read again immediately before writing so another tab's saves are retained.
    syncCollection();
    const index = saved.findIndex(s => s.name === snapshot.name);
    if (index >= 0 && replace) saved[index] = snapshot;
    else {
      if (index >= 0) snapshot.name = uniqueName(snapshot.name, "copy");
      saved.push(snapshot);
    }
    if (!persist(snapshot.name)) return;
    active = snapshot; activeStored = true; name.value = snapshot.name;
    pendingSave = null; duplicate.hidden = true;
    cleanState = fieldsState(); updateDirty(); refresh(); showOriginal();
    say(`Saved “${snapshot.name}” on this device in this browser. Download a calculation file for a portable copy.`);
  }
  get("scenario-save").onclick = () => handle(() => {
    const snapshot = snapshotForCurrent(true); if (!snapshot) return;
    syncCollection(); refresh();
    if (saved.some(s => s.name === snapshot.name)) {
      pendingSave = snapshot; duplicate.hidden = false;
      get("scenario-replace-description").textContent = `“${snapshot.name}” is already saved on this device. Choose how to save these changes.`;
      get("scenario-replace").focus();
      return;
    }
    saveSnapshot(snapshot, false);
  });
  get("scenario-replace").onclick = () => handle(() => { if(pendingSave) saveSnapshot(pendingSave, true); });
  get("scenario-save-copy").onclick = () => handle(() => { if(pendingSave) saveSnapshot(pendingSave, false); });
  get("scenario-save-cancel").onclick = () => {
    pendingSave = null; duplicate.hidden = true;
    say("Save cancelled. Your calculation and previously saved versions are unchanged."); get("scenario-save").focus();
  };
  get("scenario-open-button").onclick = () => handle(() => {
    if (select.value === "") throw new Error("Choose a calculation saved on this device first.");
    const choice = saved[Number(select.value)];
    if (!mayReplaceWorkingCalculation()) return;
    syncCollection();
    const latest = saved.find(s => s.name === choice.name);
    if (!latest) throw new Error("That calculation changed in another tab. Choose it again from the refreshed list.");
    open(latest);
  });
  function download(snapshot) {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url;
    link.download = `Rocket Nation - ${snapshot.name.replace(/[^a-z0-9 _-]/gi,"-")}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  get("scenario-export").onclick = () => handle(() => {
    const snapshot = snapshotForCurrent(); if(!snapshot) return;
    download(snapshot);
    say("Calculation file downloaded (.json). Open it here or send it to someone using this calculator. Downloading does not save on this device.");
  });
  get("scenario-export-original").onclick = () => handle(() => { if(active) download(active); });
  get("scenario-print-original").onclick = () => handle(() => { if(active) printReport(active); });
  get("scenario-import-button").onclick = () => get("scenario-import").click();
  get("scenario-import").onchange = async event => {
    pending = null; preview.hidden = true;
    const file = event.target.files[0]; if(!file) return;
    try {
      if(file.size > MAX_BYTES) throw new Error("Choose a calculation file smaller than 2 MB.");
      pending = validateSnapshot(JSON.parse(await file.text()));
      get("scenario-import-description").textContent =
        `“${pending.name}” — saved ${new Date(pending.savedAt).toLocaleString()}, model ${pending.modelVersion}. Opening restores its inputs and keeps its original results. It does not save a copy on this device; use Save on this device afterward if you want one.`;
      preview.hidden = false;
      say("Calculation file checked. Review its name and date, then choose Open this calculation or Cancel.");
      get("scenario-import-open").focus();
    } catch(error) { say(`File not opened. Current inputs and saved calculations are unchanged. ${error.message}`); }
    event.target.value = "";
  };
  get("scenario-import-open").onclick = () => handle(() => {
    if(!pending || !mayReplaceWorkingCalculation()) return;
    const snapshot = validateSnapshot(pending);
    open(snapshot, false, false);
    pending = null; preview.hidden = true;
  });
  get("scenario-import-cancel").onclick = () => {
    pending = null; preview.hidden = true;
    say("File opening cancelled. Current inputs and saved calculations are unchanged."); get("scenario-import-button").focus();
  };
  get("scenario-print").onclick = () => handle(() => {
    const snapshot = snapshotForCurrent(); if(snapshot) printReport(snapshot);
  });
  form.addEventListener("input", event => {
    if(!suppressDirty && (event.target.closest("#economics-inputs") || event.target === form || event.target === name || event.target === notes)) updateDirty();
  });
  for(const button of document.querySelectorAll("[data-scenario]")) button.addEventListener("click", () => queueMicrotask(updateDirty));
  const reset = document.querySelector("#reset-economics");
  reset.addEventListener("click", event => {
    if(isDirty() && !confirm("Discard the unsaved changes and reset to Base assumptions?")) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
  }, true);
  reset.addEventListener("click", () => queueMicrotask(() => {
    active = null; activeStored = false; original.hidden = true; name.value = ""; notes.value = "";
    cleanState = fieldsState(); updateDirty();
    let storageMessage = "";
    try {
      syncCollection();
      if(!persist(null)) storageMessage = " Device storage could not be updated; download a calculation file to keep your work.";
    } catch(error) { storageMessage = " " + error.message; }
    say("Reset to Base. Previously saved calculations remain available." + storageMessage);
  }));
  window.addEventListener("storage", event => {
    if(event.key !== STORAGE_KEY) return;
    try {
      saved = loadCollection().scenarios; refresh();
      say("Saved calculations changed in another tab. The list is refreshed; your current inputs are unchanged." +
        (invalidEntries.length ? " Some unreadable entries are preserved but cannot be opened." : ""));
    } catch {storageWritable = false; say("Saved calculations changed in another tab and could not be read. Your current inputs are unchanged; download a file to keep them.");}
  });
  window.addEventListener("beforeunload", event => {
    if(isDirty()) {event.preventDefault(); event.returnValue = "";}
  });
  cleanState = fieldsState();
  try {
    const stored = loadCollection(); saved = stored.scenarios; refresh();
    const last = saved.find(s => s.name === stored.lastOpened);
    if(last) open(last, false); else updateDirty();
    if(invalidEntries.length) say("Some saved entries could not be opened. Valid calculations remain available; unreadable entries are preserved unchanged when you save.");
  } catch {
    storageWritable = false; updateDirty();
    say("Saved browser data could not be read and has been preserved. Download your current calculation or open a calculation file.");
  }
}
function dollars(value) {
  return new Intl.NumberFormat("en-US", {style:"currency",currency:"USD",maximumFractionDigits:0}).format(value);
}
