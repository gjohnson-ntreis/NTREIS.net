/*
 * NTREIS live stats
 * Loads /data/stats.json (published nightly from the Jarvis glance snapshot)
 * and fills in any element tagged with data-stat="<field>".
 *
 *   <span data-stat="mlsSubscribers">55,424</span>         -> text replaced with the live number
 *   <span data-stat="activeMembers" data-format="k">59K+</span>
 *   <div class="stat-num" data-target="59040" data-stat="activeMembers">  -> data-target updated
 *       (the home page counter animation then counts up to the live number)
 *
 * data-format: (none) = 59,040   "k" = 59K+   "plus" = 59,000+
 * data-scale:  divides the value before it's used, e.g. data-scale="1000000000"
 *              turns 3859092835 into 3.859 for a "$3.9B" counter
 *
 * Month-over-month indicators:
 *   <div class="stat-trend" data-trend="allDollarVolume30d" hidden></div>
 *   compares allDollarVolume30d with allDollarVolumePrev30d (or data-trend-prev="field")
 *   and shows e.g. "▼ 25.9% vs prior 30 days". Stays hidden if either value is missing.
 *   Changes under 0.5% show as a dash. Classes: .up / .down / .flat
 *
 * If the file can't be loaded, the numbers written in the HTML stay as they are.
 * window.ntreisStats is a promise that resolves once the numbers are in place
 * (or after 2.5 seconds at most), so other scripts can wait for it.
 */
(function () {
  function format(value, fmt) {
    if (fmt === 'k') return Math.floor(value / 1000) + 'K+';
    if (fmt === 'plus') return (Math.floor(value / 1000) * 1000).toLocaleString('en-US') + '+';
    return value.toLocaleString('en-US');
  }

  function apply(data) {
    if (!data) return null;
    var els = document.querySelectorAll('[data-stat]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var value = data[el.getAttribute('data-stat')];
      if (typeof value !== 'number' || !isFinite(value) || value <= 0) continue;
      var scale = parseFloat(el.getAttribute('data-scale')) || 1;
      if (el.hasAttribute('data-target')) {
        el.setAttribute('data-target', String(value / scale));
      } else {
        el.textContent = format(value, el.getAttribute('data-format'));
      }
    }
    applyTrends(data);
    return data;
  }

  function shortDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) return '';
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(m[2], 10) - 1] + ' ' + parseInt(m[3], 10);
  }

  function applyTrends(data) {
    var els = document.querySelectorAll('[data-trend]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var field = el.getAttribute('data-trend');
      var prevField = el.getAttribute('data-trend-prev') || field.replace(/30d$/, 'Prev30d');
      var cur = data[field], prev = data[prevField];
      if (typeof cur !== 'number' || typeof prev !== 'number' || !isFinite(cur) || !isFinite(prev) || prev <= 0) continue;
      var pct = (cur - prev) / prev * 100;
      var dir = Math.abs(pct) < 0.5 ? 'flat' : (pct > 0 ? 'up' : 'down');
      var arrow = dir === 'up' ? '\u25B2' : (dir === 'down' ? '\u25BC' : '\u2014');
      el.textContent = arrow + ' ' + Math.abs(pct).toFixed(1) + '%';
      el.className = el.className.replace(/\b(up|down|flat)\b/g, '').trim() + ' ' + dir;
      if (data.priorFrom && data.priorTo) {
        el.title = 'vs prior 30 days (' + shortDate(data.priorFrom) + ' \u2013 ' + shortDate(data.priorTo) + ')';
      }
      if (!el.title) el.title = 'vs prior 30 days';
      el.setAttribute('aria-label', (dir === 'up' ? 'Up ' : dir === 'down' ? 'Down ' : 'Unchanged, ') + Math.abs(pct).toFixed(1) + '% ' + el.title);
      el.hidden = false;
    }
  }

  var load = fetch('/data/stats.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .catch(function () { return null; });

  var timeout = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 2500); });

  window.ntreisStats = Promise.race([load, timeout]).then(apply);
})();
