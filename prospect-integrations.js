import { normalizeDataset, filterProspects } from './prospects-core.js';

// The three proposals are opt-in; an ordinary visit keeps the current plan.
const variant = new URLSearchParams(location.search).get('prospect-integration');
const create = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const link = (text, view) => {
  const node = create('a', text);
  node.href = `prospects.html?view=${view}`;
  return node;
};
const heading = (panel, title, description) => {
  panel.append(create('h3', title), create('p', description));
};

function tocEntry() {
  const section = document.querySelector('#chapters');
  const top = section?.querySelector('.section-top');
  if (!top) return;
  section.classList.add('pi-toc');
  const panel = create('nav', '', 'pi-panel pi-entry');
  panel.setAttribute('aria-label', 'Prospect research tools');
  panel.append(create('strong', 'Prospect research'));
  const links = create('div', '', 'pi-entry-links');
  links.append(link('Company directory ↗', 'list'), link('Territory coverage ↗', 'territory'), link('Call workspace ↗', 'calls'));
  panel.append(links);
  top.after(panel);
}

function executionEntry() {
  const top = document.querySelector('#execution .section-top');
  if (!top) return;
  const panel = create('aside', '', 'pi-panel pi-launch');
  panel.setAttribute('aria-label', 'Prospect sales preparation');
  heading(panel, 'Prepare the first sales conversations', 'Move from the plan into company research, territory selection, and a call list.');
  const workflows = create('div', '', 'pi-workflows');
  for (const [step, title, description, view] of [
    ['01', 'Research companies', 'Search the source-backed directory and check each company’s evidence.', 'list'],
    ['02', 'Choose a territory', 'Compare the geographic coverage of the current prospect file.', 'territory'],
    ['03', 'Work the call list', 'Open eligible phone contacts and record the next action.', 'calls'],
  ]) {
    const item = link('', view);
    item.append(create('span', step, 'pi-step'), create('strong', `${title} ↗`), create('span', description));
    workflows.append(item);
  }
  panel.append(workflows);
  top.after(panel);
}

async function marketPreview() {
  const top = document.querySelector('#opportunity .section-top');
  if (!top) return;
  const panel = create('aside', '', 'pi-panel pi-market');
  panel.setAttribute('aria-label', 'Search current prospect research');
  heading(panel, 'Explore the companies behind the market', 'Search the current research file. Inclusion is evidence of a company, not proof of service fit or buying intent.');
  const status = create('p', 'Loading prospect research…', 'pi-status');
  status.setAttribute('role', 'status');
  panel.append(status);
  top.after(panel);
  try {
    const response = await fetch('prospect-data.json');
    if (!response.ok) throw Error('Prospect research could not be loaded.');
    const { records } = normalizeDataset(await response.json());
    const controls = create('div', '', 'pi-controls');
    const searchLabel = create('label', 'Company, city, or industry');
    const search = create('input');
    search.type = 'search';
    search.id = 'pi-search';
    search.maxLength = 300;
    search.placeholder = 'Search prospect research';
    searchLabel.htmlFor = search.id;
    searchLabel.append(search);
    const stateLabel = create('label', 'State');
    const state = create('select');
    state.id = 'pi-state';
    state.setAttribute('aria-label', 'State');
    stateLabel.htmlFor = state.id;
    const all = create('option', 'All states');
    all.value = 'all';
    state.append(all);
    for (const value of [...new Set(records.map(row => row.state))].sort()) {
      const option = create('option', value);
      option.value = value;
      state.append(option);
    }
    stateLabel.append(state);
    const open = link('Open matching companies ↗', 'list');
    open.className = 'pi-open';
    controls.append(searchLabel, stateLabel, open);
    const wrapper = create('div', '', 'pi-table-wrap');
    const table = create('table');
    const caption = create('caption', 'Preview of the current prospect research');
    const head = create('thead');
    const tr = create('tr');
    for (const title of ['Company', 'Location', 'Industry', 'Phone']) {
      const th = create('th', title);
      th.scope = 'col';
      tr.append(th);
    }
    head.append(tr);
    const body = create('tbody');
    table.append(caption, head, body);
    wrapper.append(table);
    panel.append(controls, wrapper);
    const render = () => {
      const rows = filterProspects(records, { q: search.value, state: state.value });
      status.textContent = `${rows.length} matching companies in the current ${records.length}-company file · showing ${Math.min(5, rows.length)}`;
      const params = new URLSearchParams({ view: 'list' });
      if (search.value.trim()) params.set('q', search.value.trim());
      if (state.value !== 'all') params.set('state', state.value);
      open.href = `prospects.html?${params}`;
      body.replaceChildren();
      for (const row of rows.slice(0, 5)) {
        const line = create('tr');
        const industryNames=row.industries.map(value=>value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())).join(', ');
        for (const value of [row.name, `${row.city}, ${row.state}`, industryNames || 'Not recorded', row.phone || 'Not recorded']) {
          line.append(create('td', value));
        }
        body.append(line);
      }
      if (!rows.length) {
        const line = create('tr');
        const cell = create('td', 'No matching companies. Try another search or state.');
        cell.colSpan = 4;
        line.append(cell);
        body.append(line);
      }
    };
    search.addEventListener('input', render);
    state.addEventListener('change', render);
    render();
  } catch {
    status.textContent = 'The prospect preview is unavailable. The business plan remains available; open the prospect workspace to check the file.';
    panel.append(link('Open prospect workspace ↗', 'list'));
  }
}

if (variant === 'toc') tocEntry();
if (variant === 'execution') executionEntry();
if (variant === 'market') marketPreview();
