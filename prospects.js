import { normalizeDataset, filterProspects, groupTerritories, phoneLink, formatPhone, csvExport, readActivity, geographyOptions, mergeRestoredActivity } from './prospects-core.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=value=>String(value).replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const storeKey='rocket-nation-prospect-activity-v1';
let dataset, activity={}, view='list', page=0, callId=null, detailId=null, undo=null, territoryLevel='state';
const filters=$('filters');
const error=message=>{ $('load-error').hidden=!message;$('load-error').textContent=message; };
const getFilters=()=>Object.fromEntries(new FormData(filters));
const status=row=>activity[row.id]?.outcome||'uncontacted';
const callable=row=>row.verified&&row.active&&row.shortlistEligible&&status(row)!=='do-not-call'&&phoneLink(row.phone);
const link=(url,text,extra='')=>url?`<a class="inline-link" href="${esc(url)}" ${extra}>${esc(text)}</a>`:'';
const website=row=>link(row.website,'Website','target="_blank" rel="noopener noreferrer"');
const callLink=row=>callable(row)?link(phoneLink(row.phone),formatPhone(row.phone),'data-phone-company="'+esc(row.id)+'" aria-label="'+esc('Call '+row.name)+'"'):`<span class="muted">${status(row)==='do-not-call'?'Do not call':row.phone?'Review required':'No phone recorded'}</span>`;
function loadLedger() {
  const raw=localStorage.getItem(storeKey)||'{}';
  const parsed=JSON.parse(raw);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Invalid saved activity ledger');
  return readActivity(raw);
}
function download(name,body,type) {
  const url=URL.createObjectURL(new Blob([body],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function saveActivity(id,form) {
  const values=Object.fromEntries(new FormData(form));
  if(values.outcome==='follow-up'&&!values.followUp) {error('Choose a follow-up date and time before saving.');return;}
  const clean=readActivity(JSON.stringify({[id]:{...values,updatedAt:new Date().toISOString()}}),new Set([id]));
  if(!clean[id]) {error('Choose a valid outcome.');return;}
  const commit=()=>{
  let latest;
  try {latest=loadLedger();}catch{error('Saved notes cannot be read. No changes were saved.');return;}
  if(form.dataset.version!==JSON.stringify(latest[id]||null)) {activity=latest;error('This company changed in another tab. Copy your unsaved notes, then reopen the company before saving.');return;}
  const candidate={...latest,[id]:clean[id]};
  try {localStorage.setItem(storeKey,JSON.stringify(candidate));}
  catch {error('Your browser could not save this change. Export existing notes, then enable storage or free space. This change was not saved.');return;}
  undo={id,previous:latest[id],saved:clean[id]};activity=candidate;error('');
  $('save-status').textContent='Saved in this browser only. Export notes to keep a backup. Team sharing is not enabled.';
  render();if(detailId)fillDetail();
  };
  if(navigator.locks)await navigator.locks.request(storeKey,commit);else commit();
}
async function undoActivity() {
  if(!undo)return;
  const commit=()=>{
  let candidate;try{candidate=loadLedger();}catch{error('Saved notes could not be read. Undo was not saved.');return;}
  if(JSON.stringify(candidate[undo.id])!==JSON.stringify(undo.saved)){error('Another tab changed this record. Undo would overwrite that change and was not applied.');return;}
  if(undo.previous)candidate[undo.id]=undo.previous;else delete candidate[undo.id];
  try{localStorage.setItem(storeKey,JSON.stringify(candidate));}
  catch{error('The undo could not be saved. Your current notes remain unchanged.');return;}
  activity=candidate;undo=null;error('');render();if(detailId)fillDetail();
  };
  if(navigator.locks)await navigator.locks.request(storeKey,commit);else commit();
}
function options(name,values,title) {
  const select=filters.elements[name],old=select.value;
  const all=[...new Set(values)].sort((a,b)=>a.localeCompare(b));
  select.innerHTML=`<option value="all">${esc(title)}</option>`+all.map(v=>`<option value="${esc(v)}">${esc(label(v))}</option>`).join('');
  if(all.includes(old))select.value=old;
}
function populateFilters() {
  const r=dataset.records;
  options('state',r.map(x=>x.state),'All states');populateGeography();
  options('industry',r.flatMap(x=>x.industries),'All industries');
  filters.elements.size.innerHTML='<option value="all">Any size</option><option value="0-9">0–9 employees</option><option value="10-49">10–49 employees</option><option value="50-249">50–249 employees</option><option value="250">250+ employees</option><option value="unknown">Unknown employee count</option>';
}
function populateGeography() {
  const available=geographyOptions(dataset.records,filters.elements.state.value);
  options('city',available.cities,'All cities');
  options('msa',available.metros,'All metro areas');
}
function sourceMarkup(row) {
  if(!row.sources.length)return '<p class="muted">No row-level source metadata in this export. Review the company website before calling.</p>';
  return '<ul class="source-list">'+row.sources.map(s=>`<li>${link(s.url,new URL(s.url).hostname,'target="_blank" rel="noopener noreferrer"')} <span class="muted">${esc(s.observedAt||'Observation date unknown')}</span></li>`).join('')+'</ul>';
}
// Plain-language wording for the export's review statuses. A status this page
// does not recognise is shown exactly as exported rather than reinterpreted.
const secondReview={'Supported':['Yes','The listing matches the company’s own website.'],'Unknown':['Not confirmed','The listing could not be clearly tied to this local business.'],'Not reviewed':['Not yet','']};
const duplicateCheck={'Grouping resolved (exposed)':['No duplicate found',''],'Unknown (exposed)':['Not settled','It is not yet clear which local business this listing belongs to.'],'Not reviewed':['Not yet','']};
const plain=(map,value)=>map[value]||[value,''];
const fitLabel=value=>value==='not_established'?'Not yet assessed':label(value);
function facts(row) {
  const second=plain(secondReview,row.independentReview.status),duplicate=plain(duplicateCheck,row.followUpReview.status);
  const fact=(name,value)=>`<div class="fact"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`;
  const missing=[row.employees===null&&'employee count',row.msa==='Unknown'&&'metro area',row.locationCount===null&&'number of locations'].filter(Boolean);
  return `<p class="row-actions">${callLink(row)} ${website(row)}</p><div class="detail-grid">${[
    fact('Location',`${row.city}, ${row.state}`),
    fact('Industry',row.industries.map(label).join(', ')||'Unknown'),
    row.employees!==null&&fact('Employees',row.employees),
    row.msa!=='Unknown'&&fact('Metro area',row.msa),
    row.locationCount!==null&&fact('Locations',row.locationCount),
    fact('Outreach status',label(status(row))),
    fact('Company identity checked',row.verified?'Yes':'No'),
    fact('Checked by a second reviewer',second[0]),
    fact('Duplicate check',duplicate[0]),
    fact('Fit for our service',fitLabel(row.commercialSuitability)),
  ].filter(Boolean).join('')}</div>
    ${missing.length?`<p class="muted">Not recorded: ${esc(missing.join(', '))}.</p>`:''}<p class="muted">Phone number from public listings; not yet test-called.</p>${[['Second review',second[1]],['Duplicate check',duplicate[1]]].filter(([,r])=>r).map(([t,r])=>'<p class="muted"><strong>'+t+':</strong> '+esc(r)+'</p>').join('')}`;
}
function reviewNotes(row) {
  const notes=[['Second reviewer’s full note',row.independentReview.reason],['Duplicate check full note',row.followUpReview.reason]].filter(([,r])=>r);
  return notes.length?'<h4>Review notes</h4>'+notes.map(([t,r])=>'<p class="muted"><strong>'+t+':</strong> '+esc(r)+'</p>').join(''):'';
}
function activityFields(row,prefix) {
  const item=activity[row.id]||{};
  return `<label for="${prefix}-outcome">Call outcome<select id="${prefix}-outcome" name="outcome">${['uncontacted','contacted','follow-up','do-not-call'].map(s=>`<option value="${s}" ${s===(item.outcome||'uncontacted')?'selected':''}>${label(s)}</option>`).join('')}</select></label><label for="${prefix}-follow">Follow-up date and time<input id="${prefix}-follow" type="datetime-local" name="followUp" value="${esc(item.followUp||'')}"></label><label for="${prefix}-note">Notes<textarea id="${prefix}-note" name="note" maxlength="2000" rows="3">${esc(item.note||'')}</textarea></label><p class="muted">Dates use this device’s local time. Notes stay in this browser.</p><div class="row-actions"><button class="button primary" type="submit">Save activity</button><button class="button" type="button" data-undo ${undo?'':'disabled'}>Undo last save</button></div>`;
}
function fillDetail() {
  const row=dataset.records.find(x=>x.id===detailId);if(!row)return;
  $('detail-title').textContent=row.name;
  $('detail-body').innerHTML=facts(row)+'<h3>Sources</h3>'+sourceMarkup(row)+reviewNotes(row);
  const form=$('activity-form');
  form.dataset.version=JSON.stringify(activity[row.id]||null);
  form.elements.outcome.value=status(row);form.elements.note.value=activity[row.id]?.note||'';form.elements.followUp.value=activity[row.id]?.followUp||'';
  $('undo-activity').disabled=!undo;
}
function openDetail(id) { detailId=id;fillDetail();$('prospect-detail').showModal(); }
function table(rows) {
  const start=page*40,shown=rows.slice(start,start+40);
  // A column that would read "Unknown" or "Uncontacted" on every row is replaced by one note.
  const showEmployees=rows.some(row=>row.employees!==null);
  const showActivity=rows.some(row=>status(row)!=='uncontacted'||activity[row.id]?.followUp);
  const note=!showEmployees&&!showActivity?'No employee counts are recorded for these companies, and no outreach is logged yet.':!showEmployees?'No employee counts are recorded for these companies.':!showActivity?'No outreach is logged yet for these companies.':'';
  const cell=(name,className,body)=>`<td class="${className}" data-label="${name}">${body}</td>`;
  const head=['Company','Location','Industry',showEmployees&&'Employees','Public phone','Website',showActivity&&'Activity'].filter(Boolean).map(name=>`<th scope="col">${name}</th>`).join('');
  const body=shown.map(row=>'<tr>'+[
    cell('Company','cell-company',`<button class="company-button" data-detail="${esc(row.id)}">${esc(row.name)}</button>`),
    cell('Location','cell-location',`${esc(row.city)}, ${esc(row.state)}`),
    cell('Industry','cell-industry',esc(row.industries.map(label).join(', ')||'Unknown')),
    showEmployees&&cell('Employees','cell-employees',esc(row.employees??'Unknown')),
    cell('Public phone','cell-phone',callLink(row)),
    cell('Website','cell-website',website(row)||'<span class="muted">None recorded</span>'),
    showActivity&&cell('Activity','cell-activity',esc(label(status(row)))+(activity[row.id]?.followUp?'<div class="muted">'+esc(activity[row.id].followUp.replace('T',' '))+'</div>':'')),
  ].filter(Boolean).join('')+'</tr>').join('');
  return `${note?`<p class="muted table-note">${note}</p>`:''}<div class="table-wrap"><table class="prospect-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div><nav class="row-actions" aria-label="Result pages"><button class="button" data-page="prev" ${page===0?'disabled':''}>Previous</button><span>${start+1}–${Math.min(start+40,rows.length)} of ${rows.length}</span><button class="button" data-page="next" ${start+40>=rows.length?'disabled':''}>Next</button></nav>`;
}
function territory(rows) {
  const groups=groupTerritories(rows,territoryLevel),total=rows.length;
  const share=count=>Math.round(count/total*100);
  const levels=['state','city','msa'].map(k=>`<option value="${k}" ${territoryLevel===k?'selected':''}>${k==='msa'?'Metro area':label(k)}</option>`).join('');
  const cards=groups.map((g,i)=>`<button class="territory-card" data-territory="${i}"><strong>${esc(g.name)}</strong><span>${g.count} ${g.count===1?'company':'companies'} · ${g.phones} with public phone</span><span class="territory-bar" aria-hidden="true"><span style="width:${Math.max(1,g.count/total*100)}%"></span></span><span class="territory-share">${share(g.count)}% of companies listed</span><span class="territory-more">Show companies →</span></button>`).join('');
  return `<div class="territory-controls"><label for="territory-level">Group by</label><select id="territory-level">${levels}</select><p class="muted">Each bar shows the area’s share of the ${total} companies listed here, not of the whole market.${territoryLevel==='msa'?' Unknown metro areas are not guessed.':''}</p></div><div class="territory-grid">${cards}</div>`;
}
function calls(rows) {
  if(!rows.some(x=>x.id===callId))callId=rows[0]?.id;
  const row=rows.find(x=>x.id===callId);if(!row)return '';
  const pos=rows.indexOf(row);
  const start=Math.max(0,pos-5),nearby=rows.slice(start,pos+11);
  return `<p class="muted queue-note">Companies with a checked identity and a public phone, not yet qualified as sales leads. Do-not-call companies are left out.</p><div class="call-layout"><nav class="call-list" aria-label="Call queue"><p class="muted">Companies ${start+1}–${start+nearby.length} of ${rows.length}</p>${nearby.map((r,i)=>`<button class="company-button" data-call="${esc(r.id)}" aria-current="${r.id===callId}"><span>${start+i+1}. ${esc(r.name)}</span><small class="muted">${esc(r.city)}, ${esc(r.state)} · ${esc(label(status(r)))}</small></button>`).join('')}</nav><section class="call-card" aria-label="Selected call"><div class="row-actions"><button class="button" data-next="-1" ${pos===0?'disabled':''}>Previous company</button><span>${pos+1} / ${rows.length}</span><button class="button" data-next="1" ${pos===rows.length-1?'disabled':''}>Next company</button></div><h2>${esc(row.name)}</h2>${facts(row)}<details><summary>Sources and review notes</summary>${sourceMarkup(row)}${reviewNotes(row)}</details><form id="call-activity">${activityFields(row,'call')}</form></section></div>`;
}
function render() {
  if(!dataset)return;
  const selected=getFilters(),rows=filterProspects(dataset.records,{...selected,queue:view==='calls'},activity);
  if(page*40>=rows.length)page=0;
  $('result-count').textContent=`${rows.length} of ${dataset.records.length} companies${view==='calls'?' in call queue':''}`;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
  $('workspace').innerHTML=rows.length?(view==='list'?table(rows):view==='territory'?territory(rows):calls(rows)):'<div class="empty-state"><h2>No companies match these filters</h2><p>Try Unknown for missing size or metro data, or reset filters. No source records were deleted.</p><button class="button" data-reset>Reset filters</button></div>';
  const form=$('call-activity');if(form){form.dataset.version=JSON.stringify(activity[callId]||null);form.addEventListener('submit',e=>{e.preventDefault();saveActivity(callId,form);});}
}
function datasetSummary() {
  const source=dataset.source,records=dataset.records,count=test=>records.filter(test).length;
  const broad=Number.isSafeInteger(source.broadSourceIdentityCount)?`, drawn from ${source.broadSourceIdentityCount.toLocaleString('en-US')} source records`:'';
  const ready=source.salesReady===true&&source.phaseComplete===true;
  return `${records.length} companies with a checked identity${broad}. A second reviewer confirmed ${count(r=>r.independentReview.status==='Supported')}; the duplicate check found no duplicate for ${count(r=>r.followUpReview.status==='Grouping resolved (exposed)')}. ${ready?'The export marks this list sales-ready.':'Not yet sales-ready: fit for our service is not yet assessed.'}`;
}
function applyDataset(value) {
  dataset=normalizeDataset(value);populateFilters();
  $('field-coverage').textContent=`Employee counts known: ${dataset.records.filter(r=>r.employees!==null).length} of ${dataset.records.length}. Metro areas known: ${dataset.records.filter(r=>r.msa!=='Unknown').length} of ${dataset.records.length}. Filter by Unknown to find the rest.`;
  try{activity=loadLedger();}catch{$('save-status').textContent='Browser storage is unavailable or unreadable. Changes cannot be saved.';}
  $('dataset-summary').textContent=datasetSummary();
  $('dataset-status').textContent=`Saved export: ${dataset.generatedAt?new Date(dataset.generatedAt).toLocaleString():'date unknown'}. ${dataset.source.phaseComplete===true?'Pilot checking complete.':'Source checking is not finished.'}`;
  page=0;error('');render();
}
filters.addEventListener('submit',e=>e.preventDefault());
function showFilters(show){$('filter-panel').hidden=!show;$('toggle-filters').setAttribute('aria-expanded',String(show));$('toggle-filters').textContent=show?'Hide filters':'Show filters';}
$('toggle-filters').addEventListener('click',()=>showFilters($('filter-panel').hidden));
showFilters(!matchMedia('(max-width: 700px)').matches);
filters.addEventListener('input',event=>{if(event.target.name==='state')populateGeography();page=0;render();});
filters.addEventListener('reset',()=>setTimeout(()=>{populateGeography();page=0;render();},0));
window.addEventListener('storage',e=>{
  if(e.key!==storeKey)return;
  try {activity=loadLedger();}catch{error('Saved notes changed but could not be read. Reload before calling.');return;}
  if(document.activeElement?.closest('#call-activity, #activity-form')) {error('Activity changed in another tab. Your unsaved form remains open. Reopen the company before saving.');return;}
  render();if(detailId)fillDetail();
});
document.addEventListener('click',e=>{
  const phone=e.target.closest('[data-phone-company]');
  if(phone){
    try {activity=loadLedger();}catch{e.preventDefault();error('Saved call restrictions could not be checked. Reload before calling.');return;}
    if(activity[phone.dataset.phoneCompany]?.outcome==='do-not-call'){e.preventDefault();render();error('This company is marked Do not call. The call was not opened.');return;}
  }
  const b=e.target.closest('button');if(!b||!dataset)return;
  if(b.dataset.view){view=b.dataset.view;page=0;render();}
  if(b.dataset.detail)openDetail(b.dataset.detail);
  if(b.dataset.call){callId=b.dataset.call;render();}
  if(b.dataset.page){page+=b.dataset.page==='next'?1:-1;render();}
  if(b.hasAttribute('data-undo'))undoActivity();
  if(b.hasAttribute('data-reset'))filters.reset();
  if(b.hasAttribute('data-next')) {
    const rows=filterProspects(dataset.records,{...getFilters(),queue:true},activity),index=rows.findIndex(r=>r.id===callId);
    callId=rows[index+Number(b.dataset.next)]?.id||callId;render();
  }
  if(b.hasAttribute('data-territory')) {
    const rows=filterProspects(dataset.records,getFilters(),activity),group=groupTerritories(rows,territoryLevel)[Number(b.dataset.territory)];
    const row=rows.find(r=>r.id===group.ids[0]);
    filters.elements[territoryLevel].value=row[territoryLevel];
    if(territoryLevel==='city'&&row.city!=='Unknown')filters.elements.state.value=row.state;
    populateGeography();
    view='list';page=0;render();
  }
});
document.addEventListener('change',e=>{if(e.target.id==='territory-level'){territoryLevel=e.target.value;render();}});
$('close-detail').addEventListener('click',()=>$('prospect-detail').close());
$('prospect-detail').addEventListener('close',()=>detailId=null);
$('activity-form').addEventListener('submit',e=>{e.preventDefault();saveActivity(detailId,e.currentTarget);});
$('undo-activity').addEventListener('click',undoActivity);
$('export-results').addEventListener('click',()=>{
  if(!dataset)return;
  const rows=filterProspects(dataset.records,{...getFilters(),queue:view==='calls'},activity).map(r=>({...r,...activity[r.id],outcome:status(r)}));
  download('rocket-nation-filtered-prospects.csv',csvExport(rows,['id','name','state','city','msa','industries','employees','phone','website','outcome','followUp','note']),'text/csv;charset=utf-8');
});
$('export-activity').addEventListener('click',()=>download('rocket-nation-call-notes.json',JSON.stringify({kind:'rocket-nation-activity',version:1,exportedAt:new Date().toISOString(),activity},null,2),'application/json'));
$('import-data').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try {
    if(file.size>20_000_000)throw Error('Choose a JSON export smaller than 20 MB.');
    const value=JSON.parse(await file.text());
    if(value.kind==='rocket-nation-activity') {
      if(!dataset)throw Error('Load prospect data before restoring notes.');
      const restored=readActivity(JSON.stringify(value.activity));
      if(!Object.keys(restored).length)throw Error('No valid company notes found in this file.');
      if(!confirm('Restore all valid call notes? Notes for companies outside the loaded data are kept until those companies return. Imported entries replace matching notes in this browser, except existing do-not-call restrictions are kept.'))return;
      const commit=()=>{const candidate=mergeRestoredActivity(loadLedger(),restored);localStorage.setItem(storeKey,JSON.stringify(candidate));activity=candidate;undo=null;error('');render();};
      if(navigator.locks)await navigator.locks.request(storeKey,commit);else commit();
    } else applyDataset(value);
  } catch(err){error('Import failed: '+err.message+' Your current data and saved notes were not changed.');}
  finally{e.target.value='';}
});
try {
  const response=await fetch('prospect-data.json',{cache:'no-store'});
  if(!response.ok)throw Error('The prospect export could not be loaded.');
  applyDataset(await response.json());
  const entry=new URLSearchParams(location.search);
  if(['list','territory','calls'].includes(entry.get('view')))view=entry.get('view');
  for(const name of ['q','state','city','msa','industry','size','status','contact','sort']) {
    const value=entry.get(name),control=filters.elements[name];
    if(value===null)continue;
    if(name==='q')control.value=value.slice(0,300);
    else if([...control.options].some(option=>option.value===value))control.value=value;
    if(name==='state')populateGeography();
  }
  render();
} catch(err){error(err.message+' Open Data & notes to load a saved prospect export.');}
