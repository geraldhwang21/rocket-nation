(() => {
  'use strict';

  const data = window.RN_FLEET_DATA;
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const clockFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  });
  let cleanup = () => {};

  function element(tag, attributes = {}) {
    const node = document.createElementNS(svgNamespace, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  }

  function pointAt(route, distance) {
    const lengths = route.meters;
    let low = 0;
    let high = lengths.length - 1;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (lengths[middle] <= distance) low = middle;
      else high = middle;
    }
    const span = lengths[high] - lengths[low];
    const portion = span ? (distance - lengths[low]) / span : 0;
    const from = route.points[low];
    const to = route.points[high];
    return [from[0] + (to[0] - from[0]) * portion,
      from[1] + (to[1] - from[1]) * portion];
  }

  function markup() {
    return `<section class="fleet-panel" aria-labelledby="fleet-title">
      <div class="fleet-heading"><div><p class="fleet-kicker">Illustrative fleet view</p>
        <h2 id="fleet-title">San Francisco vehicle map</h2></div>
        <span class="fleet-demo-badge">SIMULATED · NOT LIVE GPS</span></div>
      <div class="fleet-layout">
        <div class="fleet-map-wrap">
          <div class="fleet-map-canvas">
            <img src="assets/sf-fleet-map.svg" alt="Street map of San Francisco mainland and Treasure Island" width="700" height="700">
            <svg class="fleet-overlay" viewBox="0 0 700 700" aria-hidden="true"></svg>
          </div>
          <p class="fleet-map-source">Map geography: City and County of San Francisco <a href="https://data.sfgov.org/d/3psu-pn9h" target="_blank" rel="noopener noreferrer">street centerlines</a> and <a href="https://data.sfgov.org/d/j2bu-swwd" target="_blank" rel="noopener noreferrer">neighborhoods</a>. Map works offline.</p>
        </div>
        <div class="fleet-sidebar">
          <p class="fleet-time-label">Current San Francisco time</p>
          <time class="fleet-clock" data-fleet-clock></time>
          <div class="fleet-counts"><div><strong>12</strong><span>parked near homes</span></div><div><strong>3</strong><span>driving in traffic</span></div></div>
          <h3>Vehicles in motion</h3>
          <ol class="fleet-moving-list">${data.routes.map((route) => `<li><span class="fleet-car-dot"></span><div><strong>${route.id}</strong><small>${route.label}</small></div><span data-fleet-speed="${route.id}"></span></li>`).join('')}</ol>
          <p class="fleet-disclaimer">These 15 vehicle positions are a shared demonstration for all four companies. Home markers are invented locations; moving cars follow mapped streets at simulated city-traffic speeds. This is not a dispatch or tracking feed. The clock is current; other dashboard records are the separate October 7 sample.</p>
        </div>
      </div>
    </section>`;
  }

  function mount(root) {
    cleanup();
    cleanup = () => {};
    if (!root || !data || data.homes.length !== 12 || data.routes.length !== 3) return;
    const overlay = root.querySelector('.fleet-overlay');
    const clock = root.querySelector('[data-fleet-clock]');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const states = data.routes.map((route, index) => ({
      route, distance: route.lengthMeters * (0.18 + index * 0.25),
      marker: null, speed: route.baseMph,
    }));
    for (const route of data.routes) {
      overlay.append(element('polyline', {
        points: route.points.map(([x, y]) => `${x},${y}`).join(' '),
        class: 'fleet-route',
      }));
    }
    for (const [index, [x, y]] of data.homes.entries()) {
      const marker = element('g', { class: 'fleet-home', transform: `translate(${x} ${y})` });
      const title = element('title');
      title.textContent = `Vehicle ${String(index + 1).padStart(2, '0')}: simulated home position`;
      marker.append(title, element('circle', { r: '10' }),
        element('path', { d: 'M-5 0 0-4 5 0v5h-10z', class: 'fleet-home-symbol' }));
      overlay.append(marker);
    }
    for (const state of states) {
      const marker = element('g', { class: 'fleet-car' });
      const title = element('title');
      title.textContent = `${state.route.id}: simulated moving vehicle`;
      marker.append(title, element('circle', { r: '14', class: 'fleet-car-halo' }),
        element('rect', { x: '-7', y: '-4', width: '14', height: '8', rx: '2', class: 'fleet-car-body' }),
        element('path', { d: 'M4-4 8 0 4 4', class: 'fleet-car-front' }));
      state.marker = marker;
      overlay.append(marker);
    }
    const updateClock = () => {
      clock.textContent = clockFormat.format(new Date());
      clock.dateTime = new Date().toISOString();
    };
    updateClock();
    const clockTimer = setInterval(updateClock, 1000);
    let frame = 0;
    let lastFrame;
    function tick(timestamp) {
      const seconds = lastFrame === undefined ? 0 : Math.min((timestamp - lastFrame) / 1000, 3);
      lastFrame = timestamp;
      states.forEach((state, index) => {
        const variation = 0.8 + 0.2 * Math.sin(timestamp / 9500 + index * 1.9);
        state.speed = Math.round(state.route.baseMph * variation);
        if (!reducedMotion.matches) {
          state.distance = (state.distance + state.speed * 0.44704 * seconds) % state.route.lengthMeters;
        }
        const [x, y] = pointAt(state.route, state.distance);
        const [aheadX, aheadY] = pointAt(state.route, (state.distance + 5) % state.route.lengthMeters);
        const angle = Math.atan2(aheadY - y, aheadX - x) * 180 / Math.PI;
        state.marker.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)})`);
        const speedLabel = root.querySelector(`[data-fleet-speed="${state.route.id}"]`);
        speedLabel.textContent = reducedMotion.matches ? 'motion paused' : `${state.speed} mph`;
      });
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    cleanup = () => {
      cancelAnimationFrame(frame);
      clearInterval(clockTimer);
    };
  }

  window.RNFleetMap = { markup, mount };
})();
