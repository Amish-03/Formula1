# 🏎️ Formula 1 Historical Analytics Dashboard

An interactive web dashboard analyzing **70+ years** of Formula 1 racing data (1950–2024). Built with a Python data pipeline and a modern web frontend featuring 5 analytical modules.

![Dark Theme](https://img.shields.io/badge/Theme-Dark_F1-1a1a2e?style=flat-square&labelColor=e10600)
![Seasons](https://img.shields.io/badge/Seasons-75-00D2BE?style=flat-square)
![Plotly.js](https://img.shields.io/badge/Charts-Plotly.js-3F4F75?style=flat-square)
![Leaflet](https://img.shields.io/badge/Maps-Leaflet.js-199900?style=flat-square)

---

## 📊 Dashboard Modules

| # | Module | Description |
|---|--------|-------------|
| 🏆 | **Championship Battles** | Cumulative points progression, standings table, multi-driver selector |
| 🏭 | **Constructor Dominance** | Points share heatmap, trend lines, competitive entropy, era presets |
| ⚔️ | **Grid vs Race** | Grid→finish scatter, positions gained distribution, all-time rankings |
| 🏁 | **Circuit Analysis** | Interactive world map, avg lap time vs variance, DNF rate analysis |
| 🔧 | **Pit Stop Strategy** | Median duration trends, distribution histogram, constructor box plots |

## 🛠️ Tech Stack

- **Data Pipeline:** Python (pandas, numpy) → Pre-aggregated JSON
- **Frontend:** HTML5 / CSS3 / Vanilla JS
- **Charting:** [Plotly.js](https://plotly.com/javascript/) (2.27)
- **Mapping:** [Leaflet.js](https://leafletjs.com/) (1.9.4) with CartoDB dark tiles
- **Typography:** [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts
- **Design:** Dark F1 theme with red accent (`#e10600`), glassmorphism cards

## 📁 Project Structure

```
Formula1_Analysis/
├── data_pipeline.py        # Reads 14 CSVs, computes metrics, outputs JSON
├── download_data.py        # Downloads dataset via kagglehub
├── index.html              # Dashboard layout (5 tabbed modules)
├── styles.css              # Dark F1 theme CSS
├── app.js                  # All module rendering logic
└── data/                   # Pre-aggregated JSON files
    ├── championship_battles.json
    ├── constructor_dominance.json
    ├── grid_vs_race.json
    ├── circuits.json
    ├── pit_stops.json
    └── metadata.json
```

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- `pandas`, `numpy`, `kagglehub` packages

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/Amish-03/Formula1.git
cd Formula1

# 2. Install dependencies
pip install pandas numpy kagglehub

# 3. Download the dataset
python download_data.py

# 4. Run the data pipeline (generates JSON files)
python data_pipeline.py

# 5. Start local server
python -m http.server 8000
```

Then open **http://localhost:8000** in your browser.

> **Note:** The pre-aggregated JSON files are included in the repo, so steps 2–4 are only needed if you want to regenerate from source data.

### OR

Visit **[amish-03.github.io/Formula1](https://amish-03.github.io/Formula1/)**

## 📈 Data Source

[Kaggle: Formula 1 World Championship (1950–2020)](https://www.kaggle.com/datasets/rohanrao/formula-1-world-championship-1950-2020) — 14 CSV files covering races, results, standings, lap times, pit stops, qualifying, circuits, and more. The dataset has been updated through 2024.

## 🧮 Derived Metrics

| Metric | Formula | Used In |
|--------|---------|---------|
| Points Share | `constructor_points / season_total × 100` | Constructor Dominance |
| Shannon Entropy | `-Σ pᵢ log₂(pᵢ)` | Competitive entropy graph |
| Positions Gained | `grid_position - finish_position` | Grid vs Race module |
| DNF Rate | `dnf_count / total_entries × 100` | Circuit Analysis |

## 📋 Current Progress

- [x] Dataset acquisition & schema exploration (14 CSV files)
- [x] Data pipeline with derived metrics
- [x] Web dashboard with 5 interactive modules
- [x] Dark F1 theme with responsive design
- [x] Championship battle viewer with multi-driver selection
- [x] Constructor dominance heatmap with era presets
- [x] Grid vs race performance scatter analysis
- [x] Circuit world map with Leaflet.js
- [x] Pit stop evolution charts
- [ ] ML modeling layer (future)

---

<p align="center">Built with ❤️ and racing data</p>
