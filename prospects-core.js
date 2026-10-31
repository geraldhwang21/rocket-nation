const text = (value, max=300) => typeof value === 'string' ? value.trim().slice(0,max) : '';
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function phoneLink(value) {
  if (typeof value !== 'string' || !/^\+?[\d() .-]+$/.test(value.trim())) return null;
  let digits=value.replace(/\D/g,'');
  if (digits.length===10) digits='1'+digits;
  return /^1\d{10}$/.test(digits) ? 'tel:+'+digits : null;
}
// One display format for every dialable North American number: (512) 360-3532.
export function formatPhone(value) {
  const link=phoneLink(value);
  if (!link) return typeof value==='string' ? value.trim() : '';
  const d=link.slice(6);
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
}
// Source spellings such as "AUSTIN" or "Austin TX" become "Austin" so one city
// is shown, filtered and grouped once. Mixed-case names are left as written.
export function displayCity(value, state='') {
  let city=text(value).replace(/\s+/g,' ');
  if (state && city.toUpperCase().endsWith(' '+state.toUpperCase())) city=city.slice(0,-(state.length+1)).replace(/,$/,'').trim();
  if (city && (city===city.toUpperCase() || city===city.toLowerCase())) city=city.toLowerCase().replace(/(^|[\s-])(\p{L})/gu,(m,p,c)=>p+c.toUpperCase());
  return city;
}
export function normalizeDataset(value) {
  if (!value || value.schemaVersion!==1 || !Array.isArray(value.records) || value.records.length>100000) throw Error('Use a version 1 prospect export with at most 100,000 companies.');
  const ids=new Set();
  const records=value.records.map(row=>{
    if (!row || typeof row!=='object' || !text(row.id) || !text(row.name)) throw Error('A company is missing its identity or name.');
    const id=text(row.id);
    if (ids.has(id) || ['__proto__','constructor','prototype'].includes(id)) throw Error('Duplicate or invalid company identity: '+id);
    ids.add(id);
    const number=v=>typeof v==='number' && Number.isFinite(v) && v>=0 ? v : null;
    const state=text(row.state,2).toUpperCase();
    return {id,name:text(row.name),state:state || 'Unknown',city:displayCity(row.city,state)||'Unknown',msa:text(row.msa)||'Unknown',
      industries:Array.isArray(row.industries)?[...new Set(row.industries.map(x=>text(x,100)).filter(Boolean))]:[],
      employees:number(row.employees),annualRevenue:number(row.annualRevenue),phone:phoneLink(row.phone)?text(row.phone,40):null,
      website:safeUrl(row.website),verified:row.verified===true,active:row.active===true,shortlistEligible:row.shortlistEligible!==false,
      locationCount:number(row.locationCount),evidenceCount:number(row.evidenceCount),
      sources:Array.isArray(row.sources)?row.sources.filter(s=>s&&safeUrl(s.url)).slice(0,30).map(s=>({url:safeUrl(s.url),observedAt:text(s.observedAt,40),sha256:text(s.sha256,64)})):[],
      gaps:Array.isArray(row.gaps)?row.gaps.map(x=>text(x)):[],
      // Separate review facts; missing values stay explicit instead of implying acceptance.
      independentReview:{status:text(row.independentReview?.status,40)||'Not reviewed',reason:text(row.independentReview?.reason,1000)},
      followUpReview:{status:text(row.followUpReview?.status,40)||'Not reviewed',reason:text(row.followUpReview?.reason,1000)},
      commercialSuitability:text(row.commercialSuitability?.status,40)||'not_established'};
  });
  return {schemaVersion:1,generatedAt:text(value.generatedAt,40),source:value.source&&typeof value.source==='object'?value.source:{},records};
}
export function geographyOptions(records, state='all') {
  const selected = !state || state === 'all' ? records : records.filter(row => row.state === state);
  const values = field => [...new Set(selected.map(row => row[field]))].sort((a,b) => a.localeCompare(b));
  return {cities: values('city'), metros: values('msa')};
}
export function mergeRestoredActivity(existing, restored) {
  const merged={...existing,...restored};
  for(const [id,row] of Object.entries(existing)) {
    if(row.outcome==='do-not-call')merged[id]=row;
  }
  return merged;
}
export function filterProspects(records, filters={}, activity={}) {
  const q=text(filters.q).toLocaleLowerCase();
  let rows=records.filter(row=>{
    const state=activity[row.id]?.outcome || 'uncontacted';
    if (filters.queue && (!row.verified || !row.active || !row.shortlistEligible || !phoneLink(row.phone) || state==='do-not-call')) return false;
    for (const key of ['state','city','msa']) if (filters[key] && filters[key]!=='all' && row[key]!==filters[key]) return false;
    if (filters.industry && filters.industry!=='all' && !row.industries.includes(filters.industry)) return false;
    if (filters.status && filters.status!=='all' && state!==filters.status) return false;
    if (filters.contact==='phone' && !phoneLink(row.phone)) return false;
    if (filters.contact==='website' && !row.website) return false;
    if (filters.size && filters.size!=='all') {
      if (filters.size==='unknown') { if(row.employees!==null) return false; }
      else {
        if (row.employees===null) return false;
        const [min,max]=filters.size.split('-').map(Number);
        if (row.employees<min || (Number.isFinite(max) && row.employees>max)) return false;
      }
    }
    return !q || [row.name,row.city,row.state,row.msa,...row.industries].join(' ').toLocaleLowerCase().includes(q);
  });
  return rows.sort((a,b)=>{
    if (['state','city'].includes(filters.sort)) {const d=a[filters.sort].localeCompare(b[filters.sort]);if(d)return d;}
    if (filters.sort==='phone') {const d=Number(!!phoneLink(b.phone))-Number(!!phoneLink(a.phone));if(d)return d;}
    if (filters.sort==='size') {const d=(b.employees??-1)-(a.employees??-1);if(d)return d;}
    if (filters.sort==='follow-up') {const d=(activity[a.id]?.followUp||'9999').localeCompare(activity[b.id]?.followUp||'9999');if(d)return d;}
    return a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
  });
}
export function groupTerritories(records, key='state') {
  if (!['state','city','msa'].includes(key)) throw Error('Unknown territory level');
  const groups=new Map();
  for (const row of records) {
    const name=key==='city' && row.city!=='Unknown' ? row.city+', '+row.state : row[key];
    const group=groups.get(name)||{name,count:0,phones:0,ids:[]};
    group.count++; group.phones+=Number(!!phoneLink(row.phone));group.ids.push(row.id);groups.set(name,group);
  }
  return [...groups.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
}
export function csvExport(rows, fields) {
  const cell=value=>{
    let s=Array.isArray(value)?value.join('; '):String(value??'');
    if (/^[\s]*[=+@-]/.test(s)) s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  };
  return '\uFEFF'+[fields.map(cell).join(','),...rows.map(row=>fields.map(key=>cell(row[key])).join(','))].join('\r\n');
}
export function readActivity(raw, ids) {
  const output={};
  try {
    const input=JSON.parse(raw);
    if (!input || typeof input!=='object' || Array.isArray(input)) return output;
    for (const [id,row] of Object.entries(input)) {
      if ((ids && !ids.has(id)) || !id || id.length>300 || ['__proto__','constructor','prototype'].includes(id) || !row || !['uncontacted','contacted','follow-up','do-not-call'].includes(row.outcome)) continue;
      const followUp=text(row.followUp,40);
      output[id]={outcome:row.outcome,note:text(row.note,2000),followUp:followUp && !Number.isNaN(Date.parse(followUp))?followUp:'',updatedAt:text(row.updatedAt,40)};
    }
  } catch { /* An invalid saved value must not prevent loading the prospect list. */ }
  return output;
}
