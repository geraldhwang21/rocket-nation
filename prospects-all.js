(() => {
  'use strict';

  const data = window.RN_CALLING_LIST;
  const resultNode = document.getElementById('results');
  const countNode = document.getElementById('result-count');
  if (!data || data.schemaVersion !== 1 || data.rows?.length !== 72405 ||
      data.columns?.join(',') !== 'phone,name,trade,address,city,website,email,website_source,status') {
    resultNode.innerHTML = '<p class="empty">The complete calling list could not be loaded. Reload the page and try again.</p>';
    countNode.textContent = 'Data unavailable';
    return;
  }

  const rows = data.rows;
  const pageSize = 50;
  const $ = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const lower = (value) => String(value ?? '').toLocaleLowerCase();
  const number = (value) => Number(value).toLocaleString('en-US');
  const quality = (value) => ({found: 'Found', needs_review: 'Needs review', unconfirmed: 'Unconfirmed', none: 'No website'}[value] || 'Unknown');
  const validPhone = (phone) => /^[2-9]\d{9}$/.test(phone);
  const formatPhone = (phone) => validPhone(phone) ? `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}` : phone;
  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }

  const searchable = rows.map((row) => lower([row[0], row[1], row[2], row[3], row[4]].join(' ')));
  const nameOrder = rows.map((_, index) => index).sort((a, b) =>
    rows[a][1].localeCompare(rows[b][1]) || rows[a][0].localeCompare(rows[b][0]));
  const state = {view: 'companies', page: 0, matches: []};
  let pilotRecords = null;
  let pilotError = null;
  let pilotRequest = null;
  const stateForCity = (label) => {
    const knownCity = String(label).match(/,\s*([A-Z]{2})$/);
    const unknownCity = String(label).match(/^([A-Z]{2}); BUSINESS CITY UNCONFIRMED$/);
    return knownCity?.[1] || unknownCity?.[1] || '';
  };
  const cityState = new Map(data.cities.map(([label]) => [label, stateForCity(label)]));
  const params = new URLSearchParams(location.search);
  if (['companies', 'trades', 'cities', 'pilot'].includes(params.get('view'))) state.view = params.get('view');
  for (const id of ['query', 'trade', 'website-status', 'contact', 'sort']) {
    const value = params.get(id);
    if (value !== null && value.length <= 200) {
      const field = $(id);
      if (field.tagName === 'SELECT') {
        if ([...field.options].some((option) => option.value === value)) field.value = value;
      } else field.value = value;
    }
  }

  function addOptions(id, entries) {
    const list = $(id);
    const fragment = document.createDocumentFragment();
    for (const [label] of entries) {
      if (!label) continue;
      const option = document.createElement('option');
      option.value = label;
      fragment.append(option);
    }
    list.append(fragment);
  }
  addOptions('trade-options', data.trades);
  const tradeLabels = new Set(data.trades.map(([label]) => lower(label)));
  for (const stateCode of [...new Set(cityState.values())].filter(Boolean).sort()) {
    $('state').add(new Option(stateCode, stateCode));
  }
  if ([...$('state').options].some((option) => option.value === params.get('state'))) {
    $('state').value = params.get('state');
  }
  function populateCities(preferred = $('city').value) {
    const selectedState = $('state').value;
    const entries = data.cities.map(([label]) => label)
      .filter((label) => !selectedState || cityState.get(label) === selectedState)
      .sort((a, b) => a.localeCompare(b));
    $('city').replaceChildren(new Option('All', ''),
      ...entries.map((label) => new Option(label, label)));
    $('city').value = entries.includes(preferred) ? preferred : '';
  }
  populateCities(params.get('city') || '');

  function currentFilters() {
    return {
      query: lower($('query').value.trim()),
      state: $('state').value,
      city: $('city').value,
      trade: lower($('trade').value.trim()),
      status: $('website-status').value,
      contact: $('contact').value,
      sort: $('sort').value,
    };
  }
  function matchRow(row, index, filters) {
    if (filters.query && !searchable[index].includes(filters.query)) return false;
    if (filters.state && cityState.get(row[4]) !== filters.state) return false;
    if (filters.city && row[4] !== filters.city) return false;
    if (filters.trade && !(tradeLabels.has(filters.trade)
      ? lower(row[2]) === filters.trade : lower(row[2]).includes(filters.trade))) return false;
    if (filters.status && row[8] !== filters.status) return false;
    if (filters.contact === 'website' && !row[5]) return false;
    if (filters.contact === 'email' && !row[6]) return false;
    if (filters.contact === 'both' && (!row[5] || !row[6])) return false;
    return true;
  }
  function findMatches(filters) {
    const order = filters.sort === 'name' ? nameOrder : rows.map((_, index) => index);
    const matches = [];
    for (const index of order) if (matchRow(rows[index], index, filters)) matches.push(index);
    if (filters.sort !== 'name') {
      const column = {city: 4, trade: 2, phone: 0}[filters.sort] ?? 1;
      matches.sort((a, b) => rows[a][column].localeCompare(rows[b][column]) || rows[a][1].localeCompare(rows[b][1]));
    }
    return matches;
  }
  function companyTable(indices) {
    if (!indices.length) return '<p class="empty">No companies match these filters. Change a filter or clear them to see the full list.</p>';
    return `<table class="data-table"><thead><tr><th class="company-col" scope="col">Company</th><th class="trade-col" scope="col">Trade</th><th class="city-col" scope="col">City</th><th class="phone-col" scope="col">Phone</th><th class="website-col" scope="col">Website</th><th class="status-col" scope="col">Evidence</th></tr></thead><tbody>${indices.map((index) => {
      const row = rows[index];
      const url = safeUrl(row[5]);
      return `<tr><td><button type="button" class="company-button" data-record="${index}">${escape(row[1])}</button><span class="subline">${escape(row[3] || 'Address unknown')}</span></td><td>${escape(row[2] || 'Trade unknown')}</td><td>${escape(row[4] || 'City unknown')}</td><td>${escape(formatPhone(row[0]))}</td><td>${url ? `<a class="inline-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">Open site ↗</a>` : row[5] ? 'Review URL' : '—'}</td><td><span class="quality ${escape(row[8])}">${escape(quality(row[8]))}</span></td></tr>`;
    }).join('')}</tbody></table>`;
  }
  function groupTable(indices, field) {
    const groups = new Map();
    for (const index of indices) {
      const row = rows[index];
      const label = row[field] || '(blank)';
      const item = groups.get(label) || {count: 0, websites: 0, emails: 0};
      item.count++;
      item.websites += Number(Boolean(row[5]));
      item.emails += Number(Boolean(row[6]));
      groups.set(label, item);
    }
    return [...groups].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));
  }
  function groupMarkup(groups, field) {
    if (!groups.length) return '<p class="empty">No groups match these filters. Clear filters to see all groups.</p>';
    const title = field === 'trade' ? 'Trade' : 'City';
    return `<table class="data-table group-table"><thead><tr><th class="company-col" scope="col">${title}</th><th scope="col" class="number">Companies</th><th scope="col" class="number">With website</th><th scope="col" class="number">With email</th></tr></thead><tbody>${groups.map(([label, item]) => `<tr><td><button type="button" class="group-button" data-group="${escape(field)}" data-label="${escape(label)}">${escape(label)}</button></td><td class="number">${number(item.count)}</td><td class="number">${number(item.websites)}</td><td class="number">${number(item.emails)}</td></tr>`).join('')}</tbody></table>`;
  }

  function loadPilot() {
    if (pilotRequest) return;
    pilotRequest = fetch('prospect-data.json')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (payload.schemaVersion !== 1 || !Array.isArray(payload.records) ||
            payload.records.length !== 100) throw new Error('Unexpected pilot data');
        pilotRecords = payload.records.sort((a, b) => a.name.localeCompare(b.name));
      })
      .catch(() => { pilotError = 'The reviewed pilot could not be loaded. Reload the page to try again.'; })
      .finally(() => { if (state.view === 'pilot') render(); });
  }

  function pilotTable(indices) {
    return `<table class="data-table pilot-table"><thead><tr><th scope="col">Company</th><th scope="col">Industry</th><th scope="col">Location</th><th scope="col">Phone</th><th scope="col">Second review</th><th scope="col">Duplicate check</th></tr></thead><tbody>${indices.map((index) => {
      const row = pilotRecords[index];
      const industry = (row.industries || []).map((value) => value.replaceAll('_', ' ')).join(', ');
      const place = [row.city, row.state].filter(Boolean).join(', ');
      const phone = String(row.phone || '').replace(/\D/g, '');
      const grouping = row.followUpReview?.status?.startsWith('Grouping resolved') ? 'Resolved' : 'Unknown';
      return `<tr><td><button type="button" class="company-button" data-pilot-record="${index}">${escape(row.name)}</button></td><td>${escape(industry || 'Not recorded')}</td><td>${escape(place || 'Not recorded')}</td><td>${escape(phone ? formatPhone(phone) : 'Not recorded')}</td><td><span class="pilot-mobile-label">Second review: </span>${escape(row.independentReview?.status || 'Not reviewed')}</td><td><span class="pilot-mobile-label">Duplicate check: </span>${escape(grouping)}</td></tr>`;
    }).join('')}</tbody></table>`;
  }

  function syncUrl(filters) {
    const url = new URL(location.href);
    url.search = '';
    if (state.view !== 'companies') url.searchParams.set('view', state.view);
    if (state.view === 'pilot') {
      history.replaceState(null, '', url);
      return;
    }
    for (const [key, value] of Object.entries(filters)) {
      if (!value || (key === 'sort' && value === 'name')) continue;
      url.searchParams.set(key === 'status' ? 'website-status' : key, value);
    }
    history.replaceState(null, '', url);
  }
  function render() {
    const filters = currentFilters();
    const pilotView = state.view === 'pilot';
    $('filters').hidden = pilotView;
    $('clear-filters').hidden = pilotView;
    $('data-note').hidden = pilotView;
    $('sort-control').hidden = pilotView;
    $('pilot-context').hidden = !pilotView;
    for (const button of document.querySelectorAll('[data-view]')) {
      button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
    }
    if (pilotView) {
      syncUrl(filters);
      if (!pilotRecords) {
        resultNode.innerHTML = pilotError
          ? `<p class="empty">${escape(pilotError)}</p>`
          : '<p class="loading">Loading the 100-company reviewed pilot…</p>';
        countNode.textContent = pilotError ? 'Pilot unavailable' : 'Loading reviewed pilot…';
        $('page-status').textContent = '';
        $('prev-page').disabled = true;
        $('next-page').disabled = true;
        if (!pilotError) loadPilot();
        return;
      }
      const pages = Math.ceil(pilotRecords.length / pageSize);
      state.page = Math.min(state.page, pages - 1);
      const start = state.page * pageSize;
      const visible = pilotRecords.map((_, index) => index).slice(start, start + pageSize);
      resultNode.innerHTML = pilotTable(visible);
      countNode.textContent = `${number(pilotRecords.length)} reviewed pilot companies · separate research sample`;
      $('page-status').textContent = `${number(start + 1)}–${number(start + visible.length)} of ${number(pilotRecords.length)}`;
      $('prev-page').disabled = state.page === 0;
      $('next-page').disabled = state.page >= pages - 1;
      return;
    }
    state.matches = findMatches(filters);
    const allCount = state.matches.length;
    const groups = state.view === 'companies' ? null : groupTable(state.matches, state.view === 'trades' ? 2 : 4);
    const total = groups ? groups.length : allCount;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    state.page = Math.min(state.page, pages - 1);
    const start = state.page * pageSize;
    const visible = groups ? groups.slice(start, start + pageSize) : state.matches.slice(start, start + pageSize);
    resultNode.innerHTML = groups ? groupMarkup(visible, state.view === 'trades' ? 'trade' : 'city') : companyTable(visible);
    countNode.textContent = groups ? `${number(total)} ${state.view} across ${number(allCount)} companies` : `${number(allCount)} of ${number(rows.length)} companies`;
    $('page-status').textContent = total ? `${number(start + 1)}–${number(Math.min(start + pageSize, total))} of ${number(total)}` : 'No results';
    $('prev-page').disabled = state.page === 0;
    $('next-page').disabled = state.page >= pages - 1;
    const active = [filters.query && `Search: ${filters.query}`, filters.state && `State: ${filters.state}`, filters.city && `City: ${filters.city}`, filters.trade && `Trade: ${filters.trade}`, filters.status && `Evidence: ${quality(filters.status)}`, filters.contact && `Contact: ${filters.contact}`].filter(Boolean);
    $('filter-summary').textContent = active.length ? active.join(' · ') : 'Showing the complete calling list.';
    syncUrl(filters);
  }

  const dialog = $('record-dialog');
  function showRecord(index) {
    const row = rows[index];
    if (!row) return;
    $('record-title').textContent = row[1];
    const values = [
      ['Phone', formatPhone(row[0])], ['Trade', row[2]], ['Address', row[3]], ['City', row[4]],
      ['Website', row[5]], ['Email', row[6]], ['Website source', row[7]], ['Website evidence', quality(row[8])],
    ];
    $('record-details').innerHTML = `<dl class="detail-grid">${values.map(([label, value]) => {
      let content = escape(value || 'Not recorded');
      if (label === 'Website' && safeUrl(value)) content = `<a href="${escape(safeUrl(value))}" target="_blank" rel="noopener noreferrer">${content}</a>`;
      if (label === 'Email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) content = `<a href="mailto:${encodeURIComponent(value)}">${content}</a>`;
      return `<div><dt>${label}</dt><dd>${content}</dd></div>`;
    }).join('')}</dl>`;
    dialog.showModal();
  }

  function showPilotRecord(index) {
    const row = pilotRecords?.[index];
    if (!row) return;
    $('record-title').textContent = row.name;
    const fields = [
      ['Phone', row.phone || 'Not recorded'],
      ['Location', [row.city, row.state].filter(Boolean).join(', ') || 'Not recorded'],
      ['Industries', (row.industries || []).map((value) => value.replaceAll('_', ' ')).join(', ') || 'Not recorded'],
      ['Metropolitan area', row.msa || 'Not recorded'],
      ['Employees', row.employees ?? 'Not recorded'],
      ['Annual revenue', row.annualRevenue ?? 'Not recorded'],
      ['Website', row.website || 'Not recorded'],
      ['Identity status', row.producerIdentity?.status || 'Not recorded'],
      ['Locations', row.locationCount ?? 'Not recorded'],
      ['Evidence items', row.evidenceCount ?? 'Not recorded'],
      ['Commercial fit', row.commercialSuitability?.status || 'Not established'],
    ];
    const fieldHtml = fields.map(([label, value]) => {
      const link = label === 'Website' ? safeUrl(value) : null;
      return `<div><dt>${escape(label)}</dt><dd>${link ? `<a href="${escape(link)}" target="_blank" rel="noopener noreferrer">${escape(value)}</a>` : escape(value)}</dd></div>`;
    }).join('');
    const reviews = [
      ['Independent review', row.independentReview],
      ['Duplicate follow-up', row.followUpReview],
    ].map(([label, review]) => `<section class="pilot-review"><h3>${escape(label)}: ${escape(review?.status || 'Not reviewed')}</h3><p>${escape(review?.reason || 'No reason recorded.')}</p></section>`).join('');
    const sources = (row.sources || []).map((source) => {
      const link = safeUrl(source.url);
      return `<li>${link ? `<a href="${escape(link)}" target="_blank" rel="noopener noreferrer">${escape(source.url)}</a>` : escape(source.url || 'Source URL unavailable')} · observed ${escape(source.observedAt || 'date unknown')}</li>`;
    }).join('');
    $('record-details').innerHTML = `<p class="pilot-detail-note">Research evidence does not establish sales readiness or call priority. Outreach notes are in the full pilot workspace.</p><dl class="detail-grid">${fieldHtml}</dl>${reviews}<section class="pilot-review"><h3>Recorded sources</h3>${sources ? `<ul>${sources}</ul>` : '<p>No sources recorded.</p>'}</section><p class="pilot-detail-link"><a href="prospects.html">Open full pilot workspace for notes ↗</a></p>`;
    dialog.showModal();
  }

  $('close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  let updateTimer;
  $('filters').addEventListener('input', () => { clearTimeout(updateTimer); updateTimer = setTimeout(() => { state.page = 0; render(); }, 100); });
  $('state').addEventListener('change', () => populateCities());
  $('filters').addEventListener('change', () => { clearTimeout(updateTimer); state.page = 0; render(); });
  $('filters').addEventListener('reset', () => setTimeout(() => { populateCities(''); state.page = 0; render(); }, 0));
  $('filters').addEventListener('submit', (event) => event.preventDefault());
  $('sort').addEventListener('change', () => { state.page = 0; render(); });
  $('prev-page').addEventListener('click', () => { state.page--; render(); resultNode.scrollTop = 0; });
  $('next-page').addEventListener('click', () => { state.page++; render(); resultNode.scrollTop = 0; });
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
    state.view = button.dataset.view;
    state.page = 0;
    render();
    resultNode.scrollTop = 0;
  }));
  resultNode.addEventListener('click', (event) => {
    const record = event.target.closest('[data-record]');
    if (record) return showRecord(Number(record.dataset.record));
    const pilotRecord = event.target.closest('[data-pilot-record]');
    if (pilotRecord) return showPilotRecord(Number(pilotRecord.dataset.pilotRecord));
    const group = event.target.closest('[data-group]');
    if (!group) return;
    const value = group.dataset.label === '(blank)' ? '' : group.dataset.label;
    $(group.dataset.group).value = value;
    state.view = 'companies';
    state.page = 0;
    render();
    resultNode.scrollTop = 0;
    $(group.dataset.group).focus();
  });
  render();
})();
