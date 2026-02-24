/*  ═══════════════════════════════════════════════════════════════
    F1 Analytics Dashboard — Main Application
    ═══════════════════════════════════════════════════════════════ */

// ── Global Data Store ──────────────────────────────────────────
const DATA = {};
const PLOTLY_LAYOUT = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, sans-serif', color: '#9999b3', size: 12 },
    margin: { l: 50, r: 20, t: 30, b: 50 },
    xaxis: { gridcolor: 'rgba(255,255,255,0.04)', zerolinecolor: 'rgba(255,255,255,0.06)' },
    yaxis: { gridcolor: 'rgba(255,255,255,0.04)', zerolinecolor: 'rgba(255,255,255,0.06)' },
    hoverlabel: { bgcolor: '#1a1a35', bordercolor: '#e10600', font: { family: 'Inter', size: 12, color: '#f0f0f5' } },
    legend: { bgcolor: 'rgba(0,0,0,0)', font: { size: 11 } },
};
const PLOTLY_CONFIG = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] };

// ── Color Helpers ──────────────────────────────────────────────
const PALETTE = [
    '#e10600', '#00D2BE', '#0600EF', '#FF8700', '#FFC107',
    '#4caf50', '#00bcd4', '#f596c8', '#FF5722', '#9C27B0',
    '#3F51B5', '#009688', '#795548', '#607D8B', '#E91E63',
    '#CDDC39', '#FF9800', '#8BC34A', '#03A9F4', '#673AB7',
];

function getColor(name, idx) {
    if (DATA.metadata && DATA.metadata.teamColors && DATA.metadata.teamColors[name]) {
        const c = DATA.metadata.teamColors[name];
        if (c !== '#FFFFFF' && c !== '#000000') return c;
    }
    return PALETTE[idx % PALETTE.length];
}

// ── Data Loading ───────────────────────────────────────────────
async function loadAll() {
    const files = ['metadata', 'championship_battles', 'constructor_dominance', 'grid_vs_race', 'circuits', 'pit_stops'];
    const promises = files.map(f =>
        fetch(`data/${f}.json`).then(r => r.json()).then(d => { DATA[f.replace(/-/g, '_')] = d; })
    );
    await Promise.all(promises);
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
            // Trigger resize for Plotly charts
            setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
            // Init map on first view
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
        <div class="stat-pill"><span class="stat-value">${m.years.length}</span> Seasons</div>
        <div class="stat-pill"><span class="stat-value">${m.drivers.length}+</span> Drivers</div>
        <div class="stat-pill"><span class="stat-value">${m.constructors.length}</span> Teams</div>
        <div class="stat-pill"><span class="stat-value">${m.circuits.length}</span> Circuits</div>
    `;
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

    // Multi-select toggle
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

    // Sort drivers by final points (descending)
    const sorted = Object.entries(data.drivers).sort((a, b) => {
        const lastRound = Math.max(...data.rounds).toString();
        const ptsA = a[1].points[lastRound] || 0;
        const ptsB = b[1].points[lastRound] || 0;
        return ptsB - ptsA;
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
        lbl.appendChild(document.createTextNode(` ${d.code} — ${name}`));
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
    const sorted = Object.entries(data.drivers).sort((a, b) => {
        return (b[1].points[lastRound] || 0) - (a[1].points[lastRound] || 0);
    });
    champSelectedDrivers.clear();
    sorted.slice(0, n).forEach(([name]) => champSelectedDrivers.add(name));
    // Update checkboxes
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

    // ── Points Chart ──
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
            line: { width: 2.5, color },
            marker: { size: 5, color },
            hovertemplate: `<b>${d.code}</b><br>Round %{x}<br>Points: %{y}<extra></extra>`,
        });
        idx++;
    });

    const layout = {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: 'Round', dtick: 1 },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: 'Cumulative Points' },
        showlegend: true,
        legend: { ...PLOTLY_LAYOUT.legend, orientation: 'h', y: -0.15 },
    };
    Plotly.react('champPointsChart', traces, layout, PLOTLY_CONFIG);

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
        <thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Points</th><th>Wins</th></tr></thead><tbody>`;
    allDrivers.forEach(d => {
        const cls = d.position <= 3 ? ` class="pos-${d.position}"` : '';
        html += `<tr${cls}>
            <td>${d.position}</td>
            <td><span class="driver-code">${d.code}</span> ${d.name}</td>
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

    // Filter years by era
    let years = dom.years.map(Number);
    if (eraVal !== 'all') {
        const [start, end] = eraVal.split('-').map(Number);
        years = years.filter(y => y >= start && y <= end);
    }
    const yearStrs = years.map(String);

    // Find top N constructors in this era by total share
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

    const heatmapTrace = {
        z, x: years, y: topConstructors,
        type: 'heatmap',
        colorscale: [
            [0, '#0d0d1a'], [0.1, '#1a0a30'], [0.3, '#4a0a60'],
            [0.5, '#8a1050'], [0.7, '#c82040'], [1, '#e10600']
        ],
        hovertemplate: '<b>%{y}</b><br>%{x}: %{z:.1f}%<extra></extra>',
        colorbar: { title: 'Share %', titlefont: { size: 11 }, tickfont: { size: 10 } },
    };

    Plotly.react('constrHeatmap', [heatmapTrace], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: '' },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: '', automargin: true },
        margin: { ...PLOTLY_LAYOUT.margin, l: 120 },
    }, PLOTLY_CONFIG);

    // ── Trend Lines ──
    const trendTraces = [];
    topConstructors.slice(0, 8).forEach((c, i) => {
        trendTraces.push({
            x: years,
            y: yearStrs.map(y => (dom.shares[y] && dom.shares[y][c]) || 0),
            name: c,
            mode: 'lines',
            line: { width: 2, color: getColor(c, i) },
            fill: 'tonexty',
            fillcolor: getColor(c, i) + '10',
            hovertemplate: `<b>${c}</b><br>%{x}: %{y:.1f}%<extra></extra>`,
        });
    });

    Plotly.react('constrTrend', trendTraces, {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: 'Season' },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: 'Points Share (%)' },
        showlegend: true,
        legend: { ...PLOTLY_LAYOUT.legend, orientation: 'h', y: -0.2 },
    }, PLOTLY_CONFIG);

    // ── Entropy ──
    const entropyYears = yearStrs.filter(y => dom.entropy[y] !== undefined);
    Plotly.react('constrEntropy', [{
        x: entropyYears.map(Number),
        y: entropyYears.map(y => dom.entropy[y]),
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#00bcd4', width: 2 },
        marker: { size: 4, color: '#00bcd4' },
        fill: 'tozeroy',
        fillcolor: 'rgba(0,188,212,0.08)',
        hovertemplate: '<b>%{x}</b><br>Entropy: %{y:.3f}<extra></extra>',
    }], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: 'Season' },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: 'Shannon Entropy (bits)' },
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
            size: 7,
            color: seasonData.map(d => d.pg),
            colorscale: [[0, '#e10600'], [0.5, '#ffc107'], [1, '#4caf50']],
            cmin: -10, cmax: 10,
            colorbar: { title: 'Pos Gained', titlefont: { size: 10 }, tickfont: { size: 9 } },
            opacity: 0.7,
            line: { width: 0.5, color: 'rgba(255,255,255,0.2)' },
        },
        text: seasonData.map(d => `${d.d}<br>${d.c}<br>${d.ci}`),
        hovertemplate: '%{text}<br>Grid: %{x} → Finish: %{y}<br>Gained: %{marker.color}<extra></extra>',
    };

    // Reference line (grid = finish)
    const refLine = {
        x: [1, 20], y: [1, 20],
        mode: 'lines',
        line: { color: 'rgba(255,255,255,0.15)', dash: 'dash', width: 1 },
        showlegend: false,
        hoverinfo: 'skip',
    };

    Plotly.react('gridScatter', [refLine, scatterTrace], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: 'Grid Position', range: [0.5, 22], dtick: 2 },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: 'Finish Position', range: [0.5, 22], dtick: 2, autorange: 'reversed' },
        showlegend: false,
    }, PLOTLY_CONFIG);

    // ── Histogram ──
    const pgValues = seasonData.map(d => d.pg);
    Plotly.react('gridHistogram', [{
        x: pgValues,
        type: 'histogram',
        marker: { color: '#e10600', line: { color: '#ff4040', width: 0.5 } },
        opacity: 0.8,
        nbinsx: 30,
        hovertemplate: 'Positions Gained: %{x}<br>Count: %{y}<extra></extra>',
    }], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: 'Positions Gained/Lost' },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: 'Count' },
    }, PLOTLY_CONFIG);

    // ── Bar Chart (all-time) ──
    const avgPG = DATA.grid_vs_race.avgPositionsGained;
    const names = Object.keys(avgPG);
    const vals = Object.values(avgPG);
    const colors = vals.map(v => v >= 0 ? '#4caf50' : '#e10600');

    Plotly.react('gridBarChart', [{
        x: names,
        y: vals,
        type: 'bar',
        marker: { color: colors, line: { width: 0 } },
        hovertemplate: '<b>%{x}</b><br>Avg Pos Gained: %{y:.2f}<extra></extra>',
    }], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: '', tickangle: -45 },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: 'Avg Positions Gained' },
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

    // ── Scatter: Avg Lap vs Variance ──
    const withLap = names.filter(n => circuits[n].avgLapMs && circuits[n].lapVariance);
    Plotly.react('circuitScatter', [{
        x: withLap.map(n => circuits[n].avgLapMs / 1000),
        y: withLap.map(n => circuits[n].lapVariance / 1000),
        text: withLap.map(n => `${n}<br>${circuits[n].country}`),
        mode: 'markers',
        marker: {
            size: withLap.map(n => Math.min(20, Math.max(6, circuits[n].racesHosted))),
            color: withLap.map(n => circuits[n].dnfRate),
            colorscale: [[0, '#4caf50'], [0.5, '#ffc107'], [1, '#e10600']],
            colorbar: { title: 'DNF %', titlefont: { size: 10 }, tickfont: { size: 9 } },
            opacity: 0.8,
            line: { width: 0.5, color: 'rgba(255,255,255,0.2)' },
        },
        hovertemplate: '%{text}<br>Avg Lap: %{x:.1f}s<br>Std Dev: %{y:.1f}s<br>DNF Rate: %{marker.color:.1f}%<extra></extra>',
    }], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: 'Average Lap Time (seconds)' },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: 'Lap Time Std Dev (seconds)' },
    }, PLOTLY_CONFIG);

    // ── DNF Bar Chart (top 25) ──
    const byDNF = names.sort((a, b) => circuits[b].dnfRate - circuits[a].dnfRate).slice(0, 25);
    Plotly.react('circuitDNF', [{
        y: byDNF,
        x: byDNF.map(n => circuits[n].dnfRate),
        type: 'bar',
        orientation: 'h',
        marker: {
            color: byDNF.map(n => circuits[n].dnfRate),
            colorscale: [[0, '#ffc107'], [1, '#e10600']],
        },
        hovertemplate: '<b>%{y}</b><br>DNF Rate: %{x:.1f}%<extra></extra>',
    }], {
        ...PLOTLY_LAYOUT,
        yaxis: { ...PLOTLY_LAYOUT.yaxis, automargin: true },
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: 'DNF Rate (%)' },
        margin: { ...PLOTLY_LAYOUT.margin, l: 180 },
    }, PLOTLY_CONFIG);
}

function initCircuitMap() {
    const mapEl = document.getElementById('circuitMap');
    const map = L.map(mapEl, {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 10,
        scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 19,
    }).addTo(map);

    const circuits = DATA.circuits;
    Object.entries(circuits).forEach(([name, c]) => {
        if (c.lat && c.lng) {
            const radius = Math.min(12, Math.max(4, c.racesHosted / 3));
            const marker = L.circleMarker([c.lat, c.lng], {
                radius,
                fillColor: '#e10600',
                color: '#ff4040',
                weight: 1,
                fillOpacity: 0.7,
            });

            marker.bindPopup(`
                <div class="circuit-popup">
                    <h4>${name}</h4>
                    <div class="stat"><span class="stat-label">Location</span><span class="stat-val">${c.location}, ${c.country}</span></div>
                    <div class="stat"><span class="stat-label">Races</span><span class="stat-val">${c.racesHosted}</span></div>
                    <div class="stat"><span class="stat-label">DNF Rate</span><span class="stat-val">${c.dnfRate}%</span></div>
                    <div class="stat"><span class="stat-label">Years</span><span class="stat-val">${c.years[0]}–${c.years[c.years.length - 1]}</span></div>
                    ${c.avgLapMs ? `<div class="stat"><span class="stat-label">Avg Lap</span><span class="stat-val">${(c.avgLapMs / 1000).toFixed(1)}s</span></div>` : ''}
                </div>
            `);

            marker.addTo(map);
        }
    });

    // Fix tile sizing after visibility change
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
        line: { color: '#e10600', width: 2.5 },
        marker: { size: 6, color: '#e10600' },
        fill: 'tozeroy',
        fillcolor: 'rgba(225,6,0,0.08)',
        hovertemplate: '<b>%{x}</b><br>Median: %{y:.2f}s<extra></extra>',
    }], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: 'Season', dtick: 1 },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: 'Median Duration (seconds)' },
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
        marker: { color: '#00bcd4', line: { color: '#00e5ff', width: 0.5 } },
        opacity: 0.8,
        hovertemplate: 'Duration: %{x:.1f}s<br>Count: %{y}<extra></extra>',
    }], {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: 'Pit Stop Duration (seconds)' },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: 'Count' },
    }, PLOTLY_CONFIG);

    // ── Constructor Box Plot ──
    const cStats = pitData.constructorStats;
    const constructors = Object.keys(cStats).sort((a, b) => cStats[a].median - cStats[b].median);
    // Take top 30 by count
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
        fillcolor: getColor(c, i) + '30',
        hovertemplate: `<b>${c}</b><br>Median: ${(cStats[c].median / 1000).toFixed(2)}s<br>Count: ${cStats[c].count}<extra></extra>`,
    }));

    Plotly.react('pitConstructor', boxTraces, {
        ...PLOTLY_LAYOUT,
        xaxis: { ...PLOTLY_LAYOUT.xaxis, title: '', tickangle: -45 },
        yaxis: { ...PLOTLY_LAYOUT.yaxis, title: 'Duration (seconds)' },
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
        console.error('Failed to load data:', err);
        document.getElementById('loadingOverlay').innerHTML =
            `<div class="loader"><p style="color:#e10600">Error loading data: ${err.message}</p></div>`;
        return;
    }
    // Hide loading
    document.getElementById('loadingOverlay').classList.add('hidden');
})();
