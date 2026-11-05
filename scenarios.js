import { planFields, planEconomics, validatePlanInputs } from "./model.js";

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
  const form=document.querySelector("#economics-form");
  const panel=document.querySelector("#saved-scenarios");
  if (!form || !panel) return;
  const name=panel.querySelector("#scenario-name");
  const notes=panel.querySelector("#scenario-notes");
  const select=panel.querySelector("#scenario-open");
  const status=panel.querySelector("#scenario-status");
  const preview=panel.querySelector("#scenario-import-preview");
  const original=panel.querySelector("#scenario-original");
  let saved=[], active=null, pending=null, storageOK=true;
  const say=(message)=>{status.textContent=message;};
  function readInputs() {
    return cleanInputs(Object.fromEntries(planFields.map(({key})=>[key,Number(form.elements[key].value)])));
  }
  function persist(lastName) {
    try {localStorage.setItem(STORAGE_KEY,JSON.stringify({scenarios:saved,lastOpened:lastName}));}
    catch {storageOK=false;say("Browser saving is unavailable or full. Export a scenario file to keep a copy.");}
  }
  function refresh() {
    select.replaceChildren(new Option("Choose a saved scenario", ""));
    saved.forEach((s,i)=>select.add(new Option(`${s.name} — ${new Date(s.savedAt).toLocaleString()}`,String(i))));
  }
  function showOriginal() {
    original.hidden=!active;
    if (!active) return;
    const p=active.results.projection;
    panel.querySelector("#scenario-original-summary").textContent=
      `${active.name}, saved ${new Date(active.savedAt).toLocaleString()} using ${active.modelVersion}. `+
      `Recorded revenue: ${dollars(p.totalRevenue)}; cost: ${dollars(p.totalCost)}; ending cash: ${dollars(p.endingCash)}. `+
      (active.modelVersion===MODEL_VERSION ? "Current results above use the same model version." :
       "Model version differs. The calculator above has recalculated the inputs with the current model; the original analysis remains preserved here and in its export.");
  }
  function open(s) {
    const next=validateSnapshot(s);
    for (const {key} of planFields) form.elements[key].value=next.inputs[key];
    form.dispatchEvent(new Event("input",{bubbles:true}));
    name.value=next.name;notes.value=next.notes;active=next;showOriginal();
    persist(next.name);say(`Opened ${next.name}. All editable inputs restored; current results recalculated. Original saved results retained.`);
  }
  function handle(action) {try {action();}catch(error){say(error.message);}}
  panel.querySelector("#scenario-save").onclick=()=>handle(()=>{
    if (!form.reportValidity()) return;
    const snapshot=createSnapshot(name.value.trim(),notes.value,readInputs());
    const index=saved.findIndex(s=>s.name===snapshot.name);
    if (index>=0) {
      if (confirm(`Replace the saved scenario “${snapshot.name}”? Choose Cancel to create a separate copy.`)) saved[index]=snapshot;
      else {
        let n=2;const stem=snapshot.name.slice(0,85);
        while(saved.some(s=>s.name===`${stem} (copy ${n})`)) n++;
        snapshot.name=`${stem} (copy ${n})`;saved.push(snapshot);
      }
    } else saved.push(snapshot);
    active=snapshot;name.value=snapshot.name;refresh();showOriginal();persist(snapshot.name);
    if(storageOK)say(`Saved ${snapshot.name} in this browser. Export a file for backup or another device.`);
  });
  panel.querySelector("#scenario-open-button").onclick=()=>handle(()=>{
    if(select.value==="")throw new Error("Choose a saved scenario first.");open(saved[Number(select.value)]);
  });
  function exportFile(snapshot) {
    const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const link=document.createElement("a");
    link.href=url;link.download=`Rocket Nation - ${snapshot.name.replace(/[^a-z0-9 _-]/gi,"-")}.json`;
    link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  panel.querySelector("#scenario-export").onclick=()=>handle(()=>{
    if(!form.reportValidity())return;
    exportFile(createSnapshot(name.value.trim(),notes.value,readInputs()));
    say("Exported the current inputs and current calculated analysis.");
  });
  panel.querySelector("#scenario-export-original").onclick=()=>handle(()=>{if(active)exportFile(active);});
  panel.querySelector("#scenario-import").onchange=async(event)=>{
    pending=null;preview.hidden=true;const file=event.target.files[0];if(!file)return;
    try {
      if(file.size>MAX_BYTES)throw new Error("Choose a scenario file smaller than 2 MB.");
      pending=validateSnapshot(JSON.parse(await file.text()));
      panel.querySelector("#scenario-import-description").textContent=
        `${pending.name} — saved ${new Date(pending.savedAt).toLocaleString()}, model ${pending.modelVersion}. Open to restore these inputs and recalculate with the current model. Original results will be retained.`;
      preview.hidden=false;say("File validated. Review its name and date before opening.");
    }catch(error){say(`Import rejected. Current inputs and saved scenarios are unchanged. ${error.message}`);}
    event.target.value="";
  };
  panel.querySelector("#scenario-import-open").onclick=()=>handle(()=>{
    if(!pending)return;
    const snapshot=pending;
    if(saved.some(s=>s.name===snapshot.name)) {
      let n=2;const stem=snapshot.name.slice(0,80);
      while(saved.some(s=>s.name===`${stem} (import ${n})`))n++;
      snapshot.name=`${stem} (import ${n})`;
    }
    saved.push(snapshot);refresh();open(snapshot);pending=null;preview.hidden=true;
  });
  panel.querySelector("#scenario-import-cancel").onclick=()=>{
    pending=null;preview.hidden=true;say("Import cancelled. Current inputs and saved scenarios are unchanged.");
  };
  panel.querySelector("#scenario-print").onclick=()=>handle(()=>{
    if(!form.reportValidity())return;
    printReport(createSnapshot(name.value.trim(),notes.value,readInputs()));
  });
  document.querySelector("#reset-economics").addEventListener("click",()=>{
    active=null;original.hidden=true;name.value="";notes.value="";persist(null);say("Reset to Base. Your saved scenarios remain available.");
  });
  try {
    const state=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{"scenarios":[]}');
    if(!Array.isArray(state.scenarios))throw new Error("Invalid saved collection.");
    saved=state.scenarios.map(validateSnapshot);refresh();
    const last=saved.find(s=>s.name===state.lastOpened);if(last)open(last);
  }catch {say("Saved browser data could not be read. It has been left in place. You can import an exported backup.");}
}
function dollars(n){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);}
function printReport(s) {
  const win=window.open("", "_blank");
  if(!win)throw new Error("Allow the report window to open, then try Print report again.");
  const doc=win.document;
  doc.title=`Rocket Nation — ${s.name}`;
  const style=doc.createElement("style");style.textContent="body{font:15px system-ui;max-width:1000px;margin:32px auto;padding:16px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #bbb;padding:6px;text-align:right}th:first-child{text-align:left}svg{width:100%;height:220px}tr{break-inside:avoid}@media print{button{display:none}thead{display:table-header-group}}";doc.head.append(style);
  function text(tag,value,parent=doc.body){const el=doc.createElement(tag);el.textContent=value;parent.append(el);return el;}
  text("h1",s.name);text("p",`Rocket Nation planning analysis · ${s.savedAt} · ${s.modelVersion}`);
  text("p",s.notes);text("p","Planning assumptions, not observed results. Cash search is limited to 240 modeled months. Staffing steps can cause losses above the first profitable client count.");
  const p=s.results.projection;text("p",`Total revenue ${dollars(p.totalRevenue)} · Total cost ${dollars(p.totalCost)} · Ending cash ${dollars(p.endingCash)}`);
  text("h2","Assumptions");const assumptions=doc.createElement("table");doc.body.append(assumptions);
  for(const f of planFields){const row=assumptions.insertRow();row.insertCell().textContent=f.label;row.insertCell().textContent=String(s.inputs[f.key]);}
  text("h2","Cumulative cash (US dollars)");
  const svg=doc.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 900 220");svg.setAttribute("role","img");svg.setAttribute("aria-label","Cumulative cash over the selected monthly horizon");
  const values=p.rows.map(r=>r.cumulativeCash);const lo=Math.min(0,...values),hi=Math.max(0,...values),range=hi-lo||1;
  const line=doc.createElementNS(svg.namespaceURI,"polyline");line.setAttribute("points",values.map((v,i)=>`${20+i*860/Math.max(1,values.length-1)},${190-(v-lo)*170/range}`).join(" "));line.setAttribute("fill","none");line.setAttribute("stroke","#125b8e");line.setAttribute("stroke-width","3");svg.append(line);doc.body.append(svg);
  text("p",`Cash range ${dollars(lo)} to ${dollars(hi)}; month 1 to ${p.rows.length}. Exact values follow.`);
  text("h2","Monthly projection");const table=doc.createElement("table");doc.body.append(table);const head=table.createTHead().insertRow();
  for(const label of ["Month","Closing clients","Revenue","Total cost","Operating profit","Cumulative cash"]){const th=doc.createElement("th");th.textContent=label;head.append(th);}
  const body=table.createTBody();for(const row of p.rows){const tr=body.insertRow();for(const v of [row.month,row.closingClients.toFixed(2),dollars(row.revenue),dollars(row.totalCost),dollars(row.operatingProfit),dollars(row.cumulativeCash)])tr.insertCell().textContent=String(v);}
  const button=text("button","Print / Save as PDF");button.onclick=()=>win.print();
}
