import { planFieldGroups } from "./model.js";

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const moneyFormatter = new Intl.NumberFormat("en-US", {style:"currency",currency:"USD",maximumFractionDigits:0});
const numberFormatter = new Intl.NumberFormat("en-US", {maximumFractionDigits:2});
const clientsFormatter = new Intl.NumberFormat("en-US", {minimumFractionDigits:2,maximumFractionDigits:2});
const money = (value) => finite(value) ? (value < 0 ? `(${moneyFormatter.format(-value)})` : moneyFormatter.format(value)) : "Not recorded";
const number = (value) => finite(value) ? numberFormatter.format(value) : "Not recorded";
const clients = (value) => finite(value) ? clientsFormatter.format(value) : "Not recorded";
const percent = (value) => finite(value) ? `${numberFormatter.format(value * 100)}%` : "Not recorded";
const date = (value) => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().replace("T"," · ").replace(/\.\d+Z$/," UTC") : "Not recorded";

// Display the snapshot's stored analysis, including earlier model versions.
// Never substitute results from recalculating old inputs with today's model.
export function printReport(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || !snapshot.inputs || !snapshot.results?.projection || !snapshot.results?.perClient || !Array.isArray(snapshot.results.projection.rows))
    throw new Error("The report needs a complete saved scenario and its original analysis.");
  const s = snapshot;
  const p = s.results.projection;
  const u = s.results.perClient;
  const rows = p.rows;
  if (!rows.length || rows.length > 240) throw new Error("The report supports 1–240 recorded monthly rows.");
  const win = window.open("", "_blank");
  if (!win) throw new Error("Allow the report window to open, then try Print report again.");
  const doc = win.document;
  doc.documentElement.lang = "en";
  doc.title = `Rocket Nation — ${String(s.name || "Current calculation")}`;
  const charset = doc.createElement("meta");charset.setAttribute("charset","utf-8");doc.head.append(charset);
  const viewport = doc.createElement("meta");viewport.name="viewport";viewport.content="width=device-width,initial-scale=1";doc.head.append(viewport);
  function text(tag, value, parent = doc.body, className) {
    const el = doc.createElement(tag);el.textContent = String(value ?? "");
    if (className) el.className = className;
    parent.append(el);return el;
  }
  const tools = text("div", "", doc.body, "report-tools");
  const toolsCopy = text("div", "", tools);
  text("p", "Scenario report · US Letter", toolsCopy);
  const status = text("p", "Loading print styles…", toolsCopy, "report-status");status.setAttribute("role","status");
  const actions = text("div", "", tools, "tool-actions");
  const print = text("button", "Print / Save as PDF", actions);print.type="button";print.disabled=true;print.onclick=()=>win.print();
  const close = text("button", "Close report", actions);close.type="button";close.onclick=()=>win.close();
  const css = doc.createElement("link");css.rel="stylesheet";css.href=new URL("./scenario-report.css", import.meta.url).href;
  css.onload=()=>{print.disabled=false;status.textContent="Choose Save as PDF in the print dialog. Use Letter paper, 100% scale, and turn browser headers and footers off.";};
  css.onerror=()=>{status.textContent="Print styles could not load. Close this report and try again before printing.";};
  doc.head.append(css);
  const pages=[];
  function page(section, title) {
    const sheet=text("section","",doc.body,"paper");pages.push(sheet);
    const header=text("header","",sheet,"running-header");text("span","Rocket Nation",header,"brand");text("span",s.name || "Current calculation",header);
    text("p",section,sheet,"eyebrow");text(pages.length===1?"h1":"h2",title,sheet);
    return sheet;
  }
  function table(parent, labels, className="") {
    const el=text("table","",parent,className);const head=el.createTHead().insertRow();
    for(const label of labels){const th=text("th",label,head);th.scope="col";}
    return el.createTBody();
  }
  function dataRow(body, values, className) {
    const row=body.insertRow();if(className)row.className=className;
    values.forEach((value,index)=>{const cell=row.insertCell();cell.textContent=String(value ?? "Not recorded");if(index && typeof value==="string" && value.startsWith("("))cell.className="negative";});
    return row;
  }
  function kpi(parent,label,value,note,negative=false) {
    const item=text("div","",parent,"kpi");text("div",label,item,"kpi-label");text("div",value,item,`kpi-value${negative?" negative":""}`);text("div",note,item,"kpi-note");
  }
  const end=rows.at(-1);const start=rows[0];
  const horizon=finite(end.month)?end.month:rows.length;
  const interval=finite(p.cashOutlookMonths)?p.cashOutlookMonths:null;
  const summary=page("Planning analysis / executive brief","Economics & capital exposure");
  text("p",s.name || "Current calculation",summary,"scenario-name");
  const meta=text("dl","",summary,"metadata");
  for(const [label,value] of [["Calculation snapshot (UTC)",date(s.savedAt)],["Report prepared (UTC)",date(new Date().toISOString())],["Stored model version",s.modelVersion || "Not recorded"],["Projection / cash search",`Months ${number(start.month)}–${number(horizon)} / ${interval?`months 1–${number(interval)}`:"interval not recorded"}`]]){const pair=text("div","",meta);text("dt",label,pair);text("dd",value,pair);}
  const metrics=text("div","",summary,"kpis");
  kpi(metrics,`Cumulative cash · month ${number(horizon)}`,money(p.endingCash),"After launch cost and modeled operating flows",p.endingCash<0);
  kpi(metrics,`Operating result · month ${number(horizon)}`,money(end.operatingProfit),"One month; before tax and financing",end.operatingProfit<0);
  kpi(metrics,`Largest cash deficit · ${interval?`${interval}-month search`:"stored search"}`,money(p.peakCashNeed),`Observed trough: month ${number(p.peakCashMonth)}; no lifetime ceiling`);
  text("h3","Cumulative cash position",summary);
  drawChart(summary,rows,doc,text);
  text("p",`US dollars · months ${number(start.month)}–${number(horizon)}. Parentheses indicate negative amounts. Dashed line marks zero.`,summary,"chart-note");
  const key=table(summary,["Operating measure","Stored result"],"assumptions");
  dataRow(key,[`Closing clients / team at month ${number(horizon)}`,`${clients(end.closingClients)} / ${number(end.headcount)} people`]);
  dataRow(key,["Pooled gross margin / contribution per client",`${percent(u.grossMargin)} / ${money(u.contribution)} per month`]);
  dataRow(key,["Acquisition + onboarding payback",finite(u.paybackMonths)?`${number(u.paybackMonths)} months; simple unit ratio`:"No recorded positive payback"]);
  dataRow(key,["First client count covering costs",finite(s.results.breakEvenClients)?`${number(s.results.breakEvenClients)}; first crossing only`:"Not found within the stored search"]);
  dataRow(key,["Full cash recovery",finite(p.cashPaybackMonth)?p.cashPaybackMonth===0?"No modeled outside cash required":`Month ${number(p.cashPaybackMonth)}; recovered through search end`:`Not recovered within ${interval?`${interval} modeled months`:"the recorded search"}`]);
  text("p","Planning assumptions, not operating evidence. Staffing steps can cause losses above the first profitable client count. A bounded search does not prove future recovery or a maximum lifetime funding need.",summary,"decision-note");

  const definitions=page("Interpretation / measurement basis","Read the economics consistently");
  const definitionsData=[
    ["Revenue and cash",`Recorded revenue across months ${number(start.month)}–${number(horizon)} is ${money(p.totalRevenue)}; recorded total cost including one-time launch is ${money(p.totalCost)}. Cash assumes immediate collection and treats operating profit as cash. This is an undiscounted planning model.`],
    ["Pooled unit economics",`Delivery gross profit ${money(u.grossProfit)} (${percent(u.grossMargin)}) subtracts frontline labor, supervision, software and artificial intelligence usage. Contribution ${money(u.contribution)} then subtracts account-management and integration labor, before shared overhead and acquisition spending. Fractional shared staffing differs from whole-person projection costs.`],
    ["Cash exposure and monthly burn",`The selected projection ends at month ${number(horizon)}. The stored cash search spans ${interval?`months 1–${interval}`:"an unrecorded interval"}. The final monthly operating ${end.operatingProfit<0?"cash burn":"surplus"} is ${money(Math.abs(end.operatingProfit))}. The lowest recorded point is not a lifetime funding ceiling.`],
    ["Payback and profitability",`Simple unit acquisition/onboarding payback excludes company overhead and does not adjust for customer survival or collection delays. The first client count covering costs is a crossing, not a sustained threshold. Full cash recovery is established only through the end of the stored search.`],
    ["What must be evidenced",`Prices, workload, staffing capacity, churn and acquisition rates require validation. Before expansion, reconcile paid demand, actual loaded roster costs, exceptions/rework, renewals and client contribution with agreed quality and safety gates. The report does not approve spending.`],
    ["Model boundaries",`Taxes, financing, bad debt, delayed collection, future wage/price changes and overage fees are excluded. Fractional client counts are expected values. Fixed long-term assumptions are stress calculations, not forecasts.`],
    ["Snapshot integrity",`This document displays the stored inputs and original results for ${s.modelVersion || "the recorded model"}; it does not recalculate them with the current website model. Earlier-model or imported results may require review before comparison. Missing or nonfinite values are shown as “Not recorded”.`]
  ];
  for(const [heading,copy] of definitionsData){text("h3",heading,definitions);text("p",copy,definitions,"definition");}

  if(s.notes){const noteParts=paginateNotes(String(s.notes));for(const [i,part] of noteParts.entries()){const notePage=page("Scenario context",`Analyst notes${noteParts.length>1?` / ${i+1}`:""}`);text("p",part,notePage,"notes-text");text("p","User-entered context. Notes are retained as text and have not been independently verified.",notePage,"disclosure");}}
  // Fixed chunks bound printed row height; every page owns its table header.
  const allFields=planFieldGroups.flatMap(group=>group.fields.map(field=>({...field,group:group.title})));
  for(let offset=0;offset<allFields.length;offset+=16){
    const chunk=allFields.slice(offset,offset+16);const sheet=page("Appendix A / recorded assumptions",`Inputs ${offset+1}–${offset+chunk.length} of ${allFields.length}`);
    text("p","All values below are the inputs stored with this scenario. Currency is US dollars; recurring costs and workload are monthly unless labeled otherwise.",sheet,"definition");
    const body=table(sheet,["Assumption / unit","Recorded value"],"assumptions");let current="";
    for(const field of chunk){if(current!==field.group){current=field.group;const row=dataRow(body,[current,""],"group");row.cells[0].colSpan=2;row.deleteCell(1);}
      const value=s.inputs[field.key];dataRow(body,[field.label,field.unit==="usd"?money(value):field.unit==="percent"?`${number(value)}%`:`${number(value)} ${value === 1 ? ({people:"person",hours:"hour",months:"month",clients:"client"}[field.unit] || field.unit) : field.unit}`]);}
  }
  for(let offset=0;offset<rows.length;offset+=24){
    const chunk=rows.slice(offset,offset+24);const sheet=page("Appendix B / monthly projection",`Months ${number(chunk[0].month)}–${number(chunk.at(-1).month)}`);
    text("p","US dollars, rounded to whole dollars. Clients are closing expected counts. Cost excludes one-time launch here; cumulative cash starts after launch cost. Totals retain unrounded values.",sheet,"definition");
    const body=table(sheet,["Month","Closing clients","Revenue","Operating cost","Operating result","Cumulative cash"],"monthly");
    for(const row of chunk)dataRow(body,[number(row.month),clients(row.closingClients),money(row.revenue),money(row.totalCost),money(row.operatingProfit),money(row.cumulativeCash)]);
    if(offset+24>=rows.length){text("p",`Selected-horizon totals: revenue ${money(p.totalRevenue)} · all modeled cost including launch ${money(p.totalCost)} · ending cash ${money(p.endingCash)}.`,sheet,"disclosure");}
  }
  pages.forEach((sheet,index)=>{const footer=text("footer","",sheet,"page-footer");text("span",`${s.name || "Current calculation"} · Planning assumptions`,footer,"foot-name");text("span",`${String(index+1).padStart(2,"0")} / ${String(pages.length).padStart(2,"0")}`,footer);});
  win.opener=null;
  return win;
}

function paginateNotes(value) {
  // Budget visual lines, not raw characters. Keep ordinary 2,000-character
  // notes on one page; preserve words while safely paging newline-heavy text.
  const lines=value.replace(/\r\n?/g,"\n").replace(/\n{4,}/g,"\n\n\n").split("\n");
  const pages=[];let pending=[];let used=0;
  for(const line of lines){
    const cost=Math.max(1,Math.ceil(line.length/80));
    if(used+cost>36 && pending.length){pages.push(pending.join("\n"));pending=[];used=0;}
    pending.push(line);used+=cost;
  }
  if(pending.length)pages.push(pending.join("\n"));
  return pages;
}

function drawChart(parent,rows,doc,text) {
  const namespace="http://www.w3.org/2000/svg";
  const svg=doc.createElementNS(namespace,"svg");svg.setAttribute("viewBox","0 0 660 195");svg.setAttribute("class","chart");svg.setAttribute("role","img");svg.setAttribute("aria-label","Cumulative cash in US dollars across the selected monthly projection; exact amounts in the monthly appendix");parent.append(svg);
  const values=rows.filter(row=>finite(row.cumulativeCash)&&finite(row.month));if(!values.length){text("p","Cash series not recorded.",parent);return;}
  const rawLow=Math.min(0,...values.map(r=>r.cumulativeCash));const rawHigh=Math.max(0,...values.map(r=>r.cumulativeCash));
  const desired=(rawHigh-rawLow||1)/4;
  const power=10**Math.floor(Math.log10(desired));
  const step=([1,2,2.5,5,10].find(value=>value>=desired/power)||10)*power;
  const low=Math.floor(rawLow/step)*step;
  const high=rawHigh===rawLow?low+step*4:Math.ceil(rawHigh/step)*step;
  const range=high-low;
  const x=month=>78+(month-values[0].month)*566/Math.max(1,values.at(-1).month-values[0].month);
  const y=value=>159-(value-low)*140/range;
  function node(tag,attrs,content){const el=doc.createElementNS(namespace,tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));if(content!==undefined)el.textContent=content;svg.append(el);return el;}
  const short=value=>{const abs=Math.abs(value);const v=abs>=1e6?`${numberFormatter.format(abs/1e6)}m`:abs>=1000?`${numberFormatter.format(abs/1000)}k`:numberFormatter.format(abs);return value<0?`($${v})`:`$${v}`;};
  for(let value=low;value<=high+step*.001;value+=step){node("line",{x1:78,y1:y(value),x2:644,y2:y(value),stroke:"#dce4eb","stroke-width":1});node("text",{x:68,y:y(value)+4,"text-anchor":"end",class:"chart-label"},short(value));}
  node("line",{x1:78,y1:y(0),x2:644,y2:y(0),stroke:"#718495","stroke-width":1.1,"stroke-dasharray":"4 3"});
  node("polyline",{points:values.map(r=>`${x(r.month)},${y(r.cumulativeCash)}`).join(" "),fill:"none",stroke:"#216ca2","stroke-width":2.7});
  const first=values[0].month;const last=values.at(-1).month;
  for(const month of [...new Set([first,Math.round((first+last)/2),last])])node("text",{x:x(month),y:180,"text-anchor":month===first?"start":month===last?"end":"middle",class:"chart-label"},`Month ${month}`);
  node("circle",{cx:x(last),cy:y(values.at(-1).cumulativeCash),r:3,fill:"#216ca2"});
}
