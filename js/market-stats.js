/*
 * NTREIS Market Stats page
 * Loads /data/market.json (published daily from the Jarvis market snapshot) and fills in:
 *   [data-market="label"]                  -> "August 2026 Snapshot"
 *   [data-market="caption"]                -> "Residential listings across NTREIS. August 2026 compared with August 2025."
 *   [data-market="current.medianPrice"]    -> the number, formatted by data-format
 *        data-format: (none) = 51,274   "money-k" = $365K   "decimal1" = 5.3
 *   [data-market-trend="medianPrice"]      -> year-over-year indicator from change.medianPricePct
 *   #market-chart                          -> trailing-12-month chart (SVG); the metric comes from its
 *        data-metric attribute: activeListings | closedSales | newListings | medianPrice
 * If the file can't load, everything written in the HTML stays as it is.
 */
(function () {
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var SVGNS = 'http://www.w3.org/2000/svg';

  function get(obj, path) {
    var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) { if (obj == null) return undefined; obj = obj[parts[i]]; }
    return obj;
  }

  function fmt(v, f) {
    if (f === 'money-k') return '$' + Math.round(v / 1000).toLocaleString('en-US') + 'K';
    if (f === 'decimal1') return v.toFixed(1);
    return Math.round(v).toLocaleString('en-US');
  }

  var FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function monthName(ym) {            // "2026-08-01" -> "August 2026"
    var m = /^(\d{4})-(\d{2})/.exec(ym || '');
    return m ? FULL[parseInt(m[2], 10) - 1] + ' ' + m[1] : '';
  }

  function fillText(d) {
    var els = document.querySelectorAll('[data-market]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], key = el.getAttribute('data-market');
      if (key === 'label') { if (d.label) el.textContent = d.label; continue; }
      if (key === 'caption') {
        var month = monthName(d.reportMonth);
        if (d.scope && month) el.textContent = d.scope + '. ' + month + (d.vsLabel ? ' compared with ' + d.vsLabel : '') + '.';
        continue;
      }
      var v = get(d, key);
      if (typeof v === 'number' && isFinite(v)) el.textContent = fmt(v, el.getAttribute('data-format'));
    }
  }

  function fillTrends(d) {
    var els = document.querySelectorAll('[data-market-trend]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], field = el.getAttribute('data-market-trend');
      var pct = get(d, 'change.' + field + 'Pct');
      if (typeof pct !== 'number' || !isFinite(pct)) { el.hidden = true; continue; }
      var dir = Math.abs(pct) < 0.5 ? 'flat' : (pct > 0 ? 'up' : 'down');
      var arrow = dir === 'up' ? '\u25B2' : (dir === 'down' ? '\u25BC' : '\u2014');
      el.textContent = arrow + ' ' + Math.abs(pct).toFixed(1) + '%';
      el.className = 'stat-trend ' + dir;
      el.title = 'vs ' + (d.vsLabel || 'same month last year');
      el.setAttribute('aria-label', (dir === 'up' ? 'Up ' : dir === 'down' ? 'Down ' : 'Unchanged, ') +
        Math.abs(pct).toFixed(1) + '% vs ' + (d.vsLabel || 'same month last year'));
      el.hidden = false;
    }
  }

  function node(name, attrs, text) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function drawChart(d) {
    var svg = document.getElementById('market-chart');
    var note = document.getElementById('market-chart-note');
    if (!svg) return;
    var metric = svg.getAttribute('data-metric') || 'activeListings';
    var NAMES = { activeListings: 'Active listings', closedSales: 'Closed sales', newListings: 'New listings', medianPrice: 'Median price' };
    function label(v) { return metric === 'medianPrice' ? '$' + Math.round(v / 1000) + 'K' : Math.round(v).toLocaleString('en-US'); }
    var pts = (d.trailing12 || []).filter(function (p) { return typeof p[metric] === 'number'; });
    if (pts.length < 2) {
      // Not enough history yet: hide the chart rather than show old or misleading data
      svg.style.display = 'none';
      if (note) {
        var first = pts.length ? pts[0].month : null;
        note.textContent = 'The 12-month trend builds as each month is added' +
          (first ? ', starting ' + MONTHS[parseInt(first.slice(5, 7), 10) - 1] + ' ' + first.slice(0, 4) : '') + '.';
        note.hidden = false;
      }
      return;
    }
    var L = 20, R = 540, T = 36, B = 250;
    var vals = pts.map(function (p) { return p[metric]; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var pad = (max - min) * 0.12 || max * 0.05;
    var lo = min - pad, hi = max + pad * 0.3;
    function x(i) { return L + (R - L) * i / (pts.length - 1); }
    function y(v) { return B - (B - T) * (v - lo) / (hi - lo); }
    var coords = pts.map(function (p, i) { return x(i).toFixed(1) + ',' + y(p[metric]).toFixed(1); });

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var defs = node('defs', {});
    var grad = node('linearGradient', { id: 'areaFill', x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(node('stop', { offset: '0%', 'stop-color': '#F47729', 'stop-opacity': 0.18 }));
    grad.appendChild(node('stop', { offset: '100%', 'stop-color': '#F47729', 'stop-opacity': 0 }));
    defs.appendChild(grad); svg.appendChild(defs);
    [[20, '#E2E2EA'], [135, '#E2E2EA'], [250, '#C8C8D8']].forEach(function (g) {
      svg.appendChild(node('line', { x1: L, y1: g[0], x2: R, y2: g[0], stroke: g[1], 'stroke-width': 1 }));
    });
    svg.appendChild(node('polygon', { points: coords.join(' ') + ' ' + R + ',' + B + ' ' + L + ',' + B, fill: 'url(#areaFill)' }));
    svg.appendChild(node('polyline', { points: coords.join(' '), fill: 'none', stroke: '#F47729', 'stroke-width': 2.5,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    var last = pts.length - 1;
    svg.appendChild(node('circle', { cx: x(last), cy: y(vals[last]), r: 4.5, fill: '#F47729' }));
    svg.appendChild(node('circle', { cx: x(0), cy: y(vals[0]), r: 3, fill: '#ffffff', stroke: '#F47729', 'stroke-width': 2 }));
    svg.appendChild(node('text', { x: R - 4, y: 24, 'text-anchor': 'end', 'font-family': 'Montserrat,sans-serif',
      'font-weight': 800, 'font-size': 15, fill: '#000744' }, label(vals[last])));
    svg.appendChild(node('text', { x: L + 4, y: Math.max(y(vals[0]) - 6, 34), 'text-anchor': 'start', 'font-family': 'Outfit,sans-serif',
      'font-size': 11, fill: '#8A8AA0' }, label(vals[0])));
    var g = node('g', { 'font-family': 'Outfit,sans-serif', 'font-size': 10, fill: '#8A8AA0' });
    pts.forEach(function (p, i) {
      g.appendChild(node('text', { x: x(i).toFixed(1), y: 272, 'text-anchor': 'middle' }, MONTHS[parseInt(p.month.slice(5, 7), 10) - 1]));
    });
    svg.appendChild(g);
    var a = pts[0].month, b = pts[last].month;
    svg.setAttribute('aria-label', NAMES[metric] + ' from ' + MONTHS[+a.slice(5, 7) - 1] + ' ' + a.slice(0, 4) + ' to ' +
      MONTHS[+b.slice(5, 7) - 1] + ' ' + b.slice(0, 4) + ', from ' + label(vals[0]) + ' to ' + label(vals[last]));
    svg.style.display = '';
    if (note) note.hidden = true;
  }

  fetch('/data/market.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { fillText(d); fillTrends(d); drawChart(d); })
    .catch(function () { /* keep the numbers written in the HTML */ });
})();
