/*  ═══════════════════════════════════════════════════════════════
    F1 ANALYTICS CONTROL CENTER — Futuristic Telemetry Theme
    Neon Blue + Dark + Glassmorphism
    ═══════════════════════════════════════════════════════════════ */

// ── Global Data Store ──────────────────────────────────────────
const DATA = {};

// ── Plotly Dark Neon Theme ─────────────────────────────────────
const PLOTLY_LAYOUT = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Rajdhani, Inter, sans-serif', color: '#9CA3AF', size: 12 },
    margin: { l: 55, r: 20, t: 30, b: 50 },
    xaxis: {
        gridcolor: 'rgba(0,229,255,0.05)',
        zerolinecolor: 'rgba(0,229,255,0.1)',
        linecolor: 'rgba(0,229,255,0.08)',
        tickfont: {
            family: 'Rajdhani', size: 11
        },
    },
    yaxis: {
        gridcolor: 'rgba(0,229,255,0.05)',
        zerolinecolor: 'rgba(0,229,255,0.1)',
        linecolor: 'rgba(0,229,255,0.08)',
        tickfont: { family: 'Rajdhani', size: 11 },
    },
    hoverlabel: {
        bgcolor: '#111827',
        bordercolor: '#00E5FF',
        font: { family: 'Rajdhani, sans-serif', size: 13, color: '#F5F5F5' },
    },
    legend: { bgcolor: 'rgba(0,0,0,0)', font: { size: 11, color: '#9CA3AF' } },
};
const PLOTLY_CONFIG = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] };

// ── Neon Blue Palette ──────────────────────────────────────────
const PALETTE = [
    '#00E5FF', '#7C3AED', '#06B6D4', '#3B82F6', '#8B5CF6',
    '#0EA5E9', '#6366F1', '#22D3EE', '#818CF8', '#38BDF8',
    '#A78BFA', '#67E8F9', '#C084FC', '#2DD4BF', '#34D399',
    '#60A5FA', '#A5B4FC', '#93C5FD', '#BAE6FD', '#4ADE80',
];

function getColor(name, idx) {
    if (DATA.metadata && DATA.metadata.teamColors && DATA.metadata.teamColors[name]) {
        const c = DATA.metadata.teamColors[name];
        // Remap some common colors to fit neon theme
        if (c === '#DC0000' || c === '#CC0000' || c === '#900000') return '#EC4899'; // pink for red teams
        if (c === '#FFFFFF') return '#94A3B8'; // muted gray for white teams
        if (c === '#000000') return '#64748B'; // slate for black teams
        if (c === '#FFF500') return '#FACC15'; // keep yellow
        return c;
    }
    return PALETTE[idx % PALETTE.length];
}

// ── Blue-toned Colorscales ─────────────────────────────────────
const BLUE_HEATMAP = [
    [0, '#0B0F14'], [0.15, '#0C1929'], [0.3, '#0D2847'],
    [0.5, '#0E3F6E'], [0.7, '#0891B2'], [0.85, '#22D3EE'], [1, '#00E5FF']
];

const DIVERGING_SCALE = [
    [0, '#7C3AED'], [0.5, '#1E293B'], [1, '#00E5FF']
];

// ── Data Loading ───────────────────────────────────────────────
async function loadAll() {
    const files = ['metadata', 'championship_battles', 'constructor_dominance', 'grid_vs_race', 'circuits', 'pit_stops'];
    const promises = files.map(f =>
        fetch(`data/${f}.json`).then(r => r.json()).then(d => { DATA[f.replace(/-/g, '_')] = d; })
    );
    await Promise.all(promises);
}

// ── Animated Counter ───────────────────────────────────────────
function animateCounter(el, target, duration = 1200) {
    const start = 0;
    const startTime = performance.now();
    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        el.textContent = Math.round(start + (target - start) * eased);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// ── Tab Switching ──────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
            tab.classList.add('active');
            const modId = 'mod-' + tab.dataset.tab;
            document.getElementById(modId).classList.add('active');
            setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
            if (tab.dataset.tab === 'circuits' && !window._mapInited) {
                initCircuitMap();
                window._mapInited = true;
            }
        });
    });
}

// ── Header Stats ───────────────────────────────────────────────
function renderHeaderStats() {
    const m = DATA.metadata;
    document.getElementById('headerStats').innerHTML = `
        <div class="stat-pill">
            <span class="stat-value counter-value" data-target="${m.years.length}">0</span> Seasons
        </div>
        <div class="stat-pill">
            <span class="stat-value counter-value" data-target="${m.drivers.length}">0</span> Drivers
        </div>
        <div class="stat-pill">
            <span class="stat-value counter-value" data-target="${m.constructors.length}">0</span> Teams
        </div>
        <div class="stat-pill">
            <span class="stat-value counter-value" data-target="${m.circuits.length}">0</span> Circuits
        </div>
    `;
    // Animate counters
    document.querySelectorAll('.counter-value').forEach(el => {
        animateCounter(el, parseInt(el.dataset.target));
    });
}


// ═══════════════════════════════════════════════════════════════
// MODULE 1: CHAMPIONSHIP BATTLES
// ═══════════════════════════════════════════════════════════════
let champSelectedDrivers = new Set();

function initChampionship() {
    const sel = document.getElementById('champSeason');
    const years = Object.keys(DATA.championship_battles).sort((a, b) => b - a);
    years.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
        champSelectedDrivers.clear();
        populateChampDrivers();
        selectTopNChamp(5);
        renderChampionship();
    });

    document.getElementById('champSelectTop5').addEventListener('click', () => { selectTopNChamp(5); renderChampionship(); });
    document.getElementById('champSelectAll').addEventListener('click', () => { selectAllChamp(); renderChampionship(); });

    document.getElementById('champDriverDisplay').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('champDriverDropdown').classList.toggle('open');
    });
    document.addEventListener('click', () => {
        document.getElementById('champDriverDropdown').classList.remove('open');
    });
    document.getElementById('champDriverDropdown').addEventListener('click', e => e.stopPropagation());

    populateChampDrivers();
    selectTopNChamp(5);
    renderChampionship();
}

function populateChampDrivers() {
    const season = document.getElementById('champSeason').value;
    const data = DATA.championship_battles[season];
    if (!data) return;
    const dropdown = document.getElementById('champDriverDropdown');
    dropdown.innerHTML = '';

    const sorted = Object.entries(data.drivers).sort((a, b) => {
        const lastRound = Math.max(...data.rounds).toString();
        return (b[1].points[lastRound] || 0) - (a[1].points[lastRound] || 0);
    });

    sorted.forEach(([name, d]) => {
        const lbl = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = name;
        cb.checked = champSelectedDrivers.has(name);
        cb.addEventListener('change', () => {
            if (cb.checked) champSelectedDrivers.add(name);
            else champSelectedDrivers.delete(name);
            updateChampDisplay();
            renderChampionship();
        });
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(` ${d.code} \u2014 ${name}`));
        dropdown.appendChild(lbl);
    });
    updateChampDisplay();
}

function updateChampDisplay() {
    const display = document.getElementById('champDriverDisplay');
    if (champSelectedDrivers.size === 0) {
        display.textContent = 'Select drivers...';
    } else {
        const season = document.getElementById('champSeason').value;
        const data = DATA.championship_battles[season];
        const codes = [...champSelectedDrivers].map(n => data.drivers[n]?.code || n.split(' ').pop().slice(0, 3).toUpperCase());
        display.textContent = codes.join(', ');
    }
}

function selectTopNChamp(n) {
    const season = document.getElementById('champSeason').value;
    const data = DATA.championship_battles[season];
    if (!data) return;
    const lastRound = Math.max(...data.rounds).toString();
    const sorted = Object.entries(data.drivers).sort((a, b) =>
        (b[1].points[lastRound] || 0) - (a[1].points[lastRound] || 0)
    );
    champSelectedDrivers.clear();
    sorted.slice(0, n).forEach(([name]) => champSelectedDrivers.add(name));
    document.querySelectorAll('#champDriverDropdown input[type="checkbox"]').forEach(cb => {
        cb.checked = champSelectedDrivers.has(cb.value);
    });
    updateChampDisplay();
}

function selectAllChamp() {
    const season = document.getElementById('champSeason').value;
    const data = DATA.championship_battles[season];
    if (!data) return;
    champSelectedDrivers.clear();
    Object.keys(data.drivers).forEach(n => champSelectedDrivers.add(n));
    document.querySelectorAll('#champDriverDropdown input[type="checkbox"]').forEach(cb => cb.checked = true);
    updateChampDisplay();
}

function renderChampionship() {
    const season = document.getElementById('champSeason').value;
    const data = DATA.championship_battles[season];
    if (!data) return;

    const traces = [];
    let idx = 0;
    const driverConstructorMap = DATA.metadata.driverConstructorMap[season] || {};

    [...champSelectedDrivers].forEach(name => {
        const d = data.drivers[name];
        if (!d) return;
        const rounds = data.rounds.map(String);
        const pts = rounds.map(r => d.points[r] ?? null);
        const constructor = driverConstructorMap[name];
        const color = getColor(constructor, idx);
        traces.push({
            x: rounds.map(Number),
            y: pts,
            name: d.code,
            mode: 'lines+markers',
            line: { width: 2.5, color, shape: 'spline' },
            marker: { size: 5, color, line: { width: 1, color: 'rgba(0,229,255,0.2)' } },
            hovertemplate: `<b>${d.code}</b><br>Round %{x}<br>Points: %{y}<extra></extra>`,
        });
        idx++;
    });

    Plotly.react('champPointsChart', traces, {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: { text: 'ROUND', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } }, dtick: 1 },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: { text: 'CUMULATIVE POINTS', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
        showlegend: true,
        legend: { ...PLOTLY_LAYOUT.legend, orientation: 'h', y: -0.18 },
    }, PLOTLY_CONFIG);

    // ── Standings Table ──
    const lastRound = Math.max(...data.rounds).toString();
    const allDrivers = Object.entries(data.drivers)
        .map(([name, d]) => ({
            name, code: d.code,
            points: d.points[lastRound] || 0,
            position: d.positions[lastRound] || 99,
            wins: d.wins,
            constructor: driverConstructorMap[name] || '',
        }))
        .sort((a, b) => a.position - b.position);

    let html = `<table class="standings-table">
        <thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Pts</th><th>Wins</th></tr></thead><tbody>`;
    allDrivers.forEach((d, i) => {
        const cls = d.position <= 3 ? ` class="pos-${d.position}"` : '';
        const badge = d.position === 1 ? ` <span class="champion-badge"><span class="live-dot"></span>P1</span>` : '';
        html += `<tr${cls}>
            <td>${d.position}</td>
            <td><span class="driver-code">${d.code}</span> ${d.name}${badge}</td>
            <td>${d.constructor}</td>
            <td>${d.points}</td>
            <td>${d.wins}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    document.getElementById('champStandingsTable').innerHTML = html;
}


// ═══════════════════════════════════════════════════════════════
// MODULE 2: CONSTRUCTOR DOMINANCE
// ═══════════════════════════════════════════════════════════════
function initConstructors() {
    document.getElementById('constrEra').addEventListener('change', renderConstructors);
    document.getElementById('constrCount').addEventListener('change', renderConstructors);
    renderConstructors();
}

function renderConstructors() {
    const dom = DATA.constructor_dominance;
    const eraVal = document.getElementById('constrEra').value;
    const topN = parseInt(document.getElementById('constrCount').value);

    let years = dom.years.map(Number);
    if (eraVal !== 'all') {
        const [start, end] = eraVal.split('-').map(Number);
        years = years.filter(y => y >= start && y <= end);
    }
    const yearStrs = years.map(String);

    const totalShare = {};
    yearStrs.forEach(y => {
        const shares = dom.shares[y] || {};
        Object.entries(shares).forEach(([c, s]) => {
            totalShare[c] = (totalShare[c] || 0) + s;
        });
    });
    const topConstructors = Object.entries(totalShare)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(e => e[0]);

    // ── Heatmap ──
    const z = topConstructors.map(c =>
        yearStrs.map(y => (dom.shares[y] && dom.shares[y][c]) || 0)
    );

    Plotly.react('constrHeatmap', [{
        z, x: years, y: topConstructors,
        type: 'heatmap',
        colorscale: BLUE_HEATMAP,
        hovertemplate: '<b>%{y}</b><br>%{x}: %{z:.1f}%<extra></extra>',
        colorbar: {
            title: { text: 'SHARE %', font: { family: 'Rajdhani', size: 10, color: '#5B6478' } },
            tickfont: { size: 10, color: '#9CA3AF' },
            outlinewidth: 0,
        },
    }], {
        ...PLOTLY_LAYOUT,
        yaxis: { ...PLOTLY_LAYOUT.yaxis, automargin: true, tickfont: { family: 'Rajdhani', size: 11 } },
        margin: { ...PLOTLY_LAYOUT.margin, l: 130 },
    }, PLOTLY_CONFIG);

    // ── Trend Lines ──
    const trendTraces = [];
    topConstructors.slice(0, 8).forEach((c, i) => {
        const color = getColor(c, i);
        trendTraces.push({
            x: years,
            y: yearStrs.map(y => (dom.shares[y] && dom.shares[y][c]) || 0),
            name: c,
            mode: 'lines',
            line: { width: 2, color, shape: 'spline' },
            fill: 'tonexty',
            fillcolor: color + '08',
            hovertemplate: `<b>${c}</b><br>%{x}: %{y:.1f}%<extra></extra>`,
        });
    });

    Plotly.react('constrTrend', trendTraces, {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: { text: 'SEASON', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: { text: 'POINTS SHARE (%)', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
        showlegend: true,
        legend: { ...PLOTLY_LAYOUT.legend, orientation: 'h', y: -0.22 },
    }, PLOTLY_CONFIG);

    // ── Entropy ──
    const entropyYears = yearStrs.filter(y => dom.entropy[y] !== undefined);
    Plotly.react('constrEntropy', [{
        x: entropyYears.map(Number),
        y: entropyYears.map(y => dom.entropy[y]),
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#00E5FF', width: 2, shape: 'spline' },
        marker: { size: 4, color: '#00E5FF', line: { width: 1, color: 'rgba(0,229,255,0.5)' } },
        fill: 'tozeroy',
        fillcolor: 'rgba(0,229,255,0.04)',
        hovertemplate: '<b>%{x}</b><br>Entropy: %{y:.3f} bits<extra></extra>',
    }], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: { text: 'SEASON', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: { text: 'SHANNON ENTROPY (BITS)', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
    }, PLOTLY_CONFIG);
}


// ═══════════════════════════════════════════════════════════════
// MODULE 3: GRID VS RACE PERFORMANCE
// ═══════════════════════════════════════════════════════════════
function initOvertaking() {
    const sel = document.getElementById('gridSeason');
    const years = Object.keys(DATA.grid_vs_race.perSeason).sort((a, b) => b - a);
    years.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', renderOvertaking);
    renderOvertaking();
}

function renderOvertaking() {
    const season = document.getElementById('gridSeason').value;
    const seasonData = DATA.grid_vs_race.perSeason[season] || [];

    // ── Scatter ──
    const scatterTrace = {
        x: seasonData.map(d => d.g),
        y: seasonData.map(d => d.f),
        mode: 'markers',
        marker: {
            size: 8,
            color: seasonData.map(d => d.pg),
            colorscale: DIVERGING_SCALE,
            cmin: -10, cmax: 10,
            colorbar: {
                title: { text: 'POS GAINED', font: { family: 'Rajdhani', size: 10, color: '#5B6478' } },
                tickfont: { size: 9, color: '#9CA3AF' },
                outlinewidth: 0,
            },
            opacity: 0.75,
            line: { width: 1, color: 'rgba(0,229,255,0.15)' },
        },
        text: seasonData.map(d => `${d.d}<br>${d.c}<br>${d.ci}`),
        hovertemplate: '%{text}<br>Grid: %{x} \u2192 Finish: %{y}<br>Gained: %{marker.color}<extra></extra>',
    };

    const refLine = {
        x: [1, 22], y: [1, 22],
        mode: 'lines',
        line: { color: 'rgba(0,229,255,0.1)', dash: 'dash', width: 1 },
        showlegend: false, hoverinfo: 'skip',
    };

    Plotly.react('gridScatter', [refLine, scatterTrace], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: { text: 'GRID POSITION', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } }, range: [0.5, 22], dtick: 2 },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: { text: 'FINISH POSITION', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } }, range: [0.5, 22], dtick: 2, autorange: 'reversed' },
        showlegend: false,
    }, PLOTLY_CONFIG);

    // ── Histogram ──
    Plotly.react('gridHistogram', [{
        x: seasonData.map(d => d.pg),
        type: 'histogram',
        marker: {
            color: 'rgba(0,229,255,0.6)',
            line: { color: '#00E5FF', width: 0.5 },
        },
        opacity: 0.85,
        nbinsx: 30,
        hovertemplate: 'Positions Gained: %{x}<br>Count: %{y}<extra></extra>',
    }], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: { text: 'POSITIONS GAINED / LOST', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: { text: 'COUNT', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
    }, PLOTLY_CONFIG);

    // ── Bar Chart (all-time) ──
    const avgPG = DATA.grid_vs_race.avgPositionsGained;
    const names = Object.keys(avgPG);
    const vals = Object.values(avgPG);
    const colors = vals.map(v => v >= 0 ? '#00E5FF' : '#7C3AED');

    Plotly.react('gridBarChart', [{
        x: names, y: vals,
        type: 'bar',
        marker: {
            color: colors,
            line: { width: 0 },
            opacity: 0.85,
        },
        hovertemplate: '<b>%{x}</b><br>Avg Pos Gained: %{y:.2f}<extra></extra>',
    }], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, tickangle: -45, tickfont: { family: 'Rajdhani', size: 10 } },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: { text: 'AVG POSITIONS GAINED', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
        margin: { ...PLOTLY_LAYOUT.margin, b: 140 },
    }, PLOTLY_CONFIG);
}


// ═══════════════════════════════════════════════════════════════
// MODULE 4: CIRCUIT ANALYSIS
// ═══════════════════════════════════════════════════════════════
function initCircuits() {
    renderCircuitCharts();
}

function renderCircuitCharts() {
    const circuits = DATA.circuits;
    const names = Object.keys(circuits);

    // ── Scatter ──
    const withLap = names.filter(n => circuits[n].avgLapMs && circuits[n].lapVariance);
    Plotly.react('circuitScatter', [{
        x: withLap.map(n => circuits[n].avgLapMs / 1000),
        y: withLap.map(n => circuits[n].lapVariance / 1000),
        text: withLap.map(n => `${n}<br>${circuits[n].country}`),
        mode: 'markers',
        marker: {
            size: withLap.map(n => Math.min(20, Math.max(6, circuits[n].racesHosted))),
            color: withLap.map(n => circuits[n].dnfRate),
            colorscale: BLUE_HEATMAP,
            colorbar: {
                title: { text: 'DNF %', font: { family: 'Rajdhani', size: 10, color: '#5B6478' } },
                tickfont: { size: 9, color: '#9CA3AF' },
                outlinewidth: 0,
            },
            opacity: 0.8,
            line: { width: 1, color: 'rgba(0,229,255,0.2)' },
        },
        hovertemplate: '%{text}<br>Avg Lap: %{x:.1f}s<br>Std Dev: %{y:.1f}s<br>DNF: %{marker.color:.1f}%<extra></extra>',
    }], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: { text: 'AVERAGE LAP TIME (S)', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: { text: 'LAP TIME STD DEV (S)', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
    }, PLOTLY_CONFIG);

    // ── DNF Bar ──
    const byDNF = [...names].sort((a, b) => circuits[b].dnfRate - circuits[a].dnfRate).slice(0, 25);
    Plotly.react('circuitDNF', [{
        y: byDNF, x: byDNF.map(n => circuits[n].dnfRate),
        type: 'bar', orientation: 'h',
        marker: {
            color: byDNF.map(n => circuits[n].dnfRate),
            colorscale: BLUE_HEATMAP,
        },
        hovertemplate: '<b>%{y}</b><br>DNF Rate: %{x:.1f}%<extra></extra>',
    }], {
        ...PLOTLY_LAYOUT,
        yaxis: { ...PLOTLY_LAYOUT.yaxis, automargin: true, tickfont: { family: 'Rajdhani', size: 10 } },
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: { text: 'DNF RATE (%)', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
        margin: { ...PLOTLY_LAYOUT.margin, l: 180 },
    }, PLOTLY_CONFIG);
}

function initCircuitMap() {
    const mapEl = document.getElementById('circuitMap');
    const map = L.map(mapEl, {
        center: [20, 0], zoom: 2, minZoom: 2, maxZoom: 10, scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CartoDB',
        subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);

    const circuits = DATA.circuits;
    Object.entries(circuits).forEach(([name, c]) => {
        if (c.lat && c.lng) {
            const radius = Math.min(12, Math.max(4, c.racesHosted / 3));
            const marker = L.circleMarker([c.lat, c.lng], {
                radius,
                fillColor: '#00E5FF',
                color: '#00FFFF',
                weight: 1,
                fillOpacity: 0.6,
            });

            marker.bindPopup(`
                <div class="circuit-popup">
                    <h4>${name}</h4>
                    <div class="stat"><span class="stat-label">Location</span><span class="stat-val">${c.location}, ${c.country}</span></div>
                    <div class="stat"><span class="stat-label">Races</span><span class="stat-val">${c.racesHosted}</span></div>
                    <div class="stat"><span class="stat-label">DNF Rate</span><span class="stat-val">${c.dnfRate}%</span></div>
                    <div class="stat"><span class="stat-label">Years</span><span class="stat-val">${c.years[0]}\u2013${c.years[c.years.length - 1]}</span></div>
                    ${c.avgLapMs ? `<div class="stat"><span class="stat-label">Avg Lap</span><span class="stat-val">${(c.avgLapMs / 1000).toFixed(1)}s</span></div>` : ''}
                </div>
            `);
            marker.addTo(map);
        }
    });

    setTimeout(() => map.invalidateSize(), 200);
}


// ═══════════════════════════════════════════════════════════════
// MODULE 5: PIT STOP STRATEGY
// ═══════════════════════════════════════════════════════════════
function initPitStops() {
    const sel = document.getElementById('pitSeason');
    const years = Object.keys(DATA.pit_stops.distribution).sort((a, b) => b - a);
    years.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', renderPitStops);
    renderPitStops();
}

function renderPitStops() {
    const pitData = DATA.pit_stops;
    const selectedSeason = document.getElementById('pitSeason').value;

    // ── Trend Line ──
    const seasons = Object.keys(pitData.medianPerSeason).sort();
    Plotly.react('pitTrend', [{
        x: seasons.map(Number),
        y: seasons.map(s => pitData.medianPerSeason[s] / 1000),
        mode: 'lines+markers',
        line: { color: '#00E5FF', width: 2.5, shape: 'spline' },
        marker: { size: 6, color: '#00E5FF', line: { width: 1, color: 'rgba(0,229,255,0.5)' } },
        fill: 'tozeroy',
        fillcolor: 'rgba(0,229,255,0.04)',
        hovertemplate: '<b>%{x}</b><br>Median: %{y:.2f}s<extra></extra>',
    }], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: { text: 'SEASON', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } }, dtick: 1 },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: { text: 'MEDIAN DURATION (S)', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
    }, PLOTLY_CONFIG);

    // ── Histogram ──
    let distVals;
    if (selectedSeason === 'all') {
        distVals = [];
        Object.values(pitData.distribution).forEach(arr => distVals.push(...arr));
    } else {
        distVals = pitData.distribution[selectedSeason] || [];
    }

    Plotly.react('pitHistogram', [{
        x: distVals.map(v => v / 1000),
        type: 'histogram',
        nbinsx: 50,
        marker: { color: 'rgba(124,58,237,0.6)', line: { color: '#7C3AED', width: 0.5 } },
        opacity: 0.85,
        hovertemplate: 'Duration: %{x:.1f}s<br>Count: %{y}<extra></extra>',
    }], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: { text: 'PIT STOP DURATION (S)', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: { text: 'COUNT', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
    }, PLOTLY_CONFIG);

    // ── Constructor Box Plot ──
    const cStats = pitData.constructorStats;
    const constructors = Object.keys(cStats).sort((a, b) => cStats[a].median - cStats[b].median);
    const top30 = constructors.filter(c => cStats[c].count >= 50).slice(0, 30);

    const boxTraces = top30.map((c, i) => ({
        type: 'box',
        name: c,
        q1: [cStats[c].q1 / 1000],
        median: [cStats[c].median / 1000],
        q3: [cStats[c].q3 / 1000],
        lowerfence: [cStats[c].min / 1000],
        upperfence: [cStats[c].max / 1000],
        marker: { color: getColor(c, i) },
        line: { color: getColor(c, i) },
        fillcolor: getColor(c, i) + '18',
        hovertemplate: `<b>${c}</b><br>Median: ${(cStats[c].median / 1000).toFixed(2)}s<br>Count: ${cStats[c].count}<extra></extra>`,
    }));

    Plotly.react('pitConstructor', boxTraces, {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, tickangle: -45, tickfont: { family: 'Rajdhani', size: 10 } },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: { text: 'DURATION (S)', font: { family: 'Rajdhani', size: 11, color: '#5B6478' } } },
        margin: { ...PLOTLY_LAYOUT.margin, b: 120 },
        showlegend: false,
    }, PLOTLY_CONFIG);
}


// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
(async function main() {
    try {
        await loadAll();
        renderHeaderStats();
        initTabs();
        initChampionship();
        initConstructors();
        initOvertaking();
        initCircuits();
        initPitStops();
    } catch (err) {
        console.error('Failed to load telemetry data:', err);
        document.getElementById('loadingOverlay').innerHTML =
            `<div class="loader"><p style="color:#00E5FF">TELEMETRY ERROR: ${err.message}</p></div>`;
        return;
    }
    document.getElementById('loadingOverlay').classList.add('hidden');
})();
