"""
F1 Historical Analytics Dashboard - Data Pipeline
Reads all CSV files, joins on foreign keys, computes derived metrics,
and exports pre-aggregated JSON files for the web dashboard.
"""

import pandas as pd
import numpy as np
import json
import os

DATA_DIR = os.path.expanduser(
    r"~\.cache\kagglehub\datasets\rohanrao\formula-1-world-championship-1950-2020\versions\24"
)
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(OUT_DIR, exist_ok=True)

# ── Consistent team colors ──────────────────────────────────────────────────
TEAM_COLORS = {
    "Mercedes": "#00D2BE", "Ferrari": "#DC0000", "Red Bull": "#0600EF",
    "McLaren": "#FF8700", "Alpine F1 Team": "#0090FF", "Aston Martin": "#006F62",
    "AlphaTauri": "#2B4562", "Alfa Romeo": "#900000", "Haas F1 Team": "#FFFFFF",
    "Williams": "#005AFF", "Racing Point": "#F596C8", "Renault": "#FFF500",
    "Toro Rosso": "#469BFF", "Force India": "#F596C8", "Sauber": "#006F62",
    "Lotus F1": "#000000", "Caterham": "#005030", "Marussia": "#6E0000",
    "Manor Marussia": "#6E0000", "Brawn": "#B5F500", "Toyota": "#CC0000",
    "BMW Sauber": "#0063FF", "Honda": "#FFFFFF", "Super Aguri": "#CC0000",
    "Spyker": "#FF6600", "Spyker MF1": "#FF6600", "MF1": "#FF6600",
    "Jordan": "#FFC904", "Minardi": "#000000", "BAR": "#FFFFFF",
    "Jaguar": "#005030", "Prost": "#0030FF", "Arrows": "#FF8000",
    "Benetton": "#00B000", "Stewart": "#FFFFFF", "Tyrrell": "#0030FF",
    "Ligier": "#006FFF", "Lola": "#000000", "Forti": "#FFFF00",
    "Pacific": "#0000CC", "Simtek": "#6600CC", "Larrousse": "#3366CC",
    "Footwork": "#FF8000", "Fondmetal": "#FFFFFF", "Andrea Moda": "#FFFFFF",
    "Brabham": "#006F00", "March": "#FF6600", "Dallara": "#CC0000",
    "AGS": "#0030FF", "Coloni": "#FF6600", "EuroBrun": "#CC0000",
    "Rial": "#0060FF", "Osella": "#FF0000", "Zakspeed": "#F5F500",
    "Lotus": "#006600", "Team Lotus": "#006600", "Spirit": "#663399",
    "ATS": "#F5F500", "Theodore": "#663399", "Toleman": "#0030AF",
    "RAM": "#0060CC", "Alfa Romeo Racing": "#900000",
    "RB F1 Team": "#2B4562", "Kick Sauber": "#006F62",
}


def load_csv(name):
    path = os.path.join(DATA_DIR, name)
    df = pd.read_csv(path, na_values=["\\N", ""])
    return df


def save_json(data, name):
    path = os.path.join(OUT_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"  [OK] {name} ({os.path.getsize(path) / 1024:.1f} KB)")


# ═══════════════════════════════════════════════════════════════════════════════
# LOAD ALL TABLES
# ═══════════════════════════════════════════════════════════════════════════════
print("Loading CSV files...")
drivers = load_csv("drivers.csv")
races = load_csv("races.csv")
results = load_csv("results.csv")
constructors = load_csv("constructors.csv")
circuits = load_csv("circuits.csv")
driver_standings = load_csv("driver_standings.csv")
constructor_standings = load_csv("constructor_standings.csv")
constructor_results = load_csv("constructor_results.csv")
status = load_csv("status.csv")
seasons = load_csv("seasons.csv")
qualifying = load_csv("qualifying.csv")
pit_stops = load_csv("pit_stops.csv")
lap_times = load_csv("lap_times.csv")
sprint_results = load_csv("sprint_results.csv")

# Clean driver name
drivers["fullName"] = drivers["forename"] + " " + drivers["surname"]

# Add year + round to races
races = races.sort_values(["year", "round"])

# Map statusId to identify DNFs (not Finished and not lapped)
lapped_keywords = ["Lap", "Finished"]
status["isDNF"] = ~status["status"].str.contains("|".join(lapped_keywords), case=False, na=False)

# Merge results with necessary lookup tables
results_full = results.merge(races[["raceId", "year", "round", "circuitId", "name"]], on="raceId")
results_full = results_full.merge(drivers[["driverId", "fullName", "code", "driverRef"]], on="driverId")
results_full = results_full.merge(constructors[["constructorId", "name"]].rename(
    columns={"name": "constructorName"}), on="constructorId")
results_full = results_full.merge(status[["statusId", "status", "isDNF"]], on="statusId")
results_full = results_full.merge(circuits[["circuitId", "name", "location", "country", "lat", "lng"]].rename(
    columns={"name": "circuitName"}), on="circuitId")

print(f"  Total result rows: {len(results_full)}")


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE 1: CHAMPIONSHIP BATTLE VIEWER
# ═══════════════════════════════════════════════════════════════════════════════
print("\nModule 1: Championship Battles...")

ds = driver_standings.merge(races[["raceId", "year", "round"]], on="raceId")
ds = ds.merge(drivers[["driverId", "fullName", "code", "driverRef"]], on="driverId")

championship_data = {}
for year, grp in ds.groupby("year"):
    year_data = {"drivers": {}, "rounds": sorted(grp["round"].unique().tolist())}
    for did, dgrp in grp.groupby("driverId"):
        dgrp_sorted = dgrp.sort_values("round")
        row = dgrp_sorted.iloc[0]
        driver_key = row["fullName"]
        year_data["drivers"][driver_key] = {
            "code": row["code"] if pd.notna(row["code"]) else row["driverRef"][:3].upper(),
            "ref": row["driverRef"],
            "points": dgrp_sorted.set_index("round")["points"].to_dict(),
            "positions": dgrp_sorted.set_index("round")["position"].to_dict(),
            "wins": int(dgrp_sorted["wins"].max()),
        }
    # Convert round keys to strings for JSON
    for d in year_data["drivers"].values():
        d["points"] = {str(k): float(v) for k, v in d["points"].items()}
        d["positions"] = {str(k): int(v) if pd.notna(v) else None for k, v in d["positions"].items()}
    championship_data[str(int(year))] = year_data

save_json(championship_data, "championship_battles.json")


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE 2: CONSTRUCTOR DOMINANCE & ERA ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════
print("\nModule 2: Constructor Dominance...")

# Get final standings per season (last race of each year)
last_race_per_year = races.groupby("year")["raceId"].max().reset_index()
cs_final = constructor_standings.merge(last_race_per_year, on="raceId")
cs_final = cs_final.merge(constructors[["constructorId", "name"]].rename(
    columns={"name": "constructorName"}), on="constructorId")

# Compute points share per season
constructor_dom = {}
entropy_data = {}
for year, grp in cs_final.groupby("year"):
    total_pts = grp["points"].sum()
    if total_pts == 0:
        total_pts = 1  # avoid division by zero for very early seasons
    shares = {}
    for _, row in grp.iterrows():
        shares[row["constructorName"]] = round(float(row["points"]) / total_pts * 100, 2)

    constructor_dom[str(int(year))] = shares

    # Competitive entropy: H = -Σ p_i * log(p_i)
    probs = grp["points"].values / total_pts
    probs = probs[probs > 0]  # filter zeros
    entropy = -np.sum(probs * np.log2(probs))
    entropy_data[str(int(year))] = round(float(entropy), 4)

# Build heatmap: top N constructors over time
all_constructors = set()
for shares in constructor_dom.values():
    for c, s in shares.items():
        if s > 2:  # only include constructors with >2% share in any season
            all_constructors.add(c)

years_sorted = sorted(constructor_dom.keys())
heatmap = {
    "years": years_sorted,
    "constructors": sorted(all_constructors),
    "shares": constructor_dom,
    "entropy": entropy_data,
}

# Points share trend lines for top constructors
top_constructors = cs_final.groupby("constructorName")["points"].sum().nlargest(20).index.tolist()
trend_lines = {}
for c in top_constructors:
    trend_lines[c] = {}
    for year_str, shares in constructor_dom.items():
        trend_lines[c][year_str] = shares.get(c, 0)

heatmap["trendLines"] = trend_lines
heatmap["topConstructors"] = top_constructors

save_json(heatmap, "constructor_dominance.json")


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE 3: GRID VS RACE PERFORMANCE
# ═══════════════════════════════════════════════════════════════════════════════
print("\nModule 3: Grid vs Race Performance...")

grid_race = results_full[["year", "fullName", "constructorName", "circuitName",
                           "grid", "positionOrder", "isDNF"]].copy()
grid_race = grid_race[grid_race["grid"] > 0]  # exclude pit lane starts (0)
grid_race["positionsGained"] = grid_race["grid"] - grid_race["positionOrder"]

# Per-season scatter data (sampled to keep size reasonable)
grid_race_data = {}
for year, grp in grid_race.groupby("year"):
    year_data = []
    for _, row in grp.iterrows():
        year_data.append({
            "d": row["fullName"],
            "c": row["constructorName"],
            "ci": row["circuitName"],
            "g": int(row["grid"]),
            "f": int(row["positionOrder"]),
            "pg": int(row["positionsGained"]),
        })
    grid_race_data[str(int(year))] = year_data

# Average positions gained per driver (all-time top 50 by appearances)
driver_counts = grid_race.groupby("fullName").size()
top_drivers = driver_counts.nlargest(100).index
avg_pg = grid_race[grid_race["fullName"].isin(top_drivers)].groupby("fullName")["positionsGained"].mean()
avg_pg = avg_pg.sort_values(ascending=False).head(30)
avg_positions_gained = {k: round(v, 2) for k, v in avg_pg.items()}

save_json({
    "perSeason": grid_race_data,
    "avgPositionsGained": avg_positions_gained,
}, "grid_vs_race.json")


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE 4: CIRCUIT & RACE CHARACTERISTICS
# ═══════════════════════════════════════════════════════════════════════════════
print("\nModule 4: Circuit Analysis...")

# DNF rate per circuit
circuit_stats = {}
for cid, grp in results_full.groupby("circuitId"):
    total = len(grp)
    dnfs = grp["isDNF"].sum()
    circuit_info = circuits[circuits["circuitId"] == cid].iloc[0]
    cname = circuit_info["name"]
    circuit_stats[cname] = {
        "circuitId": int(cid),
        "location": circuit_info["location"],
        "country": circuit_info["country"],
        "lat": float(circuit_info["lat"]) if pd.notna(circuit_info["lat"]) else None,
        "lng": float(circuit_info["lng"]) if pd.notna(circuit_info["lng"]) else None,
        "totalEntries": int(total),
        "dnfs": int(dnfs),
        "dnfRate": round(float(dnfs) / total * 100, 2),
        "racesHosted": int(grp["raceId"].nunique()),
        "years": sorted(grp["year"].unique().tolist()),
    }

# Lap time stats per circuit (from lap_times + races)
lap_times_with_race = lap_times.merge(races[["raceId", "circuitId", "year"]], on="raceId")
lap_times_with_race = lap_times_with_race.merge(
    circuits[["circuitId", "name"]].rename(columns={"name": "circuitName"}), on="circuitId"
)

for cname, grp in lap_times_with_race.groupby("circuitName"):
    if cname in circuit_stats:
        ms = grp["milliseconds"].dropna()
        if len(ms) > 0:
            circuit_stats[cname]["avgLapMs"] = round(float(ms.mean()), 0)
            circuit_stats[cname]["lapVariance"] = round(float(ms.std()), 0)
        else:
            circuit_stats[cname]["avgLapMs"] = None
            circuit_stats[cname]["lapVariance"] = None

save_json(circuit_stats, "circuits.json")


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE 5: PIT STOP & STRATEGY EVOLUTION
# ═══════════════════════════════════════════════════════════════════════════════
print("\nModule 5: Pit Stop Strategy...")

pit_with_race = pit_stops.merge(races[["raceId", "year"]], on="raceId")
pit_with_race = pit_with_race.merge(
    results[["raceId", "driverId", "constructorId"]].drop_duplicates(),
    on=["raceId", "driverId"]
)
pit_with_race = pit_with_race.merge(
    constructors[["constructorId", "name"]].rename(columns={"name": "constructorName"}),
    on="constructorId"
)

# Filter out outliers (pit stops > 60 seconds likely include penalties/issues)
pit_clean = pit_with_race[pit_with_race["milliseconds"] < 60000].copy()

# Median pit stop per season
median_per_season = pit_clean.groupby("year")["milliseconds"].median()
median_per_season_dict = {str(int(k)): round(float(v), 0) for k, v in median_per_season.items()}

# Distribution data per season
pit_dist = {}
for year, grp in pit_clean.groupby("year"):
    vals = grp["milliseconds"].tolist()
    # Sample if too many
    if len(vals) > 2000:
        vals = list(np.random.choice(vals, 2000, replace=False))
    pit_dist[str(int(year))] = [round(v, 0) for v in vals]

# Per constructor box plot data (recent era: 2011+)
constructor_pit = {}
for cname, grp in pit_clean.groupby("constructorName"):
    vals = grp["milliseconds"].values
    if len(vals) >= 10:
        constructor_pit[cname] = {
            "median": round(float(np.median(vals)), 0),
            "q1": round(float(np.percentile(vals, 25)), 0),
            "q3": round(float(np.percentile(vals, 75)), 0),
            "min": round(float(np.percentile(vals, 5)), 0),
            "max": round(float(np.percentile(vals, 95)), 0),
            "count": int(len(vals)),
        }

save_json({
    "medianPerSeason": median_per_season_dict,
    "distribution": pit_dist,
    "constructorStats": constructor_pit,
}, "pit_stops.json")


# ═══════════════════════════════════════════════════════════════════════════════
# METADATA
# ═══════════════════════════════════════════════════════════════════════════════
print("\nMetadata...")

all_years = sorted(races["year"].unique().tolist())
driver_list = results_full.groupby("fullName").agg(
    races=("raceId", "nunique"),
    firstYear=("year", "min"),
    lastYear=("year", "max"),
).reset_index().sort_values("races", ascending=False)

constructor_list = results_full.groupby("constructorName").agg(
    races=("raceId", "nunique"),
    firstYear=("year", "min"),
    lastYear=("year", "max"),
).reset_index().sort_values("races", ascending=False)

circuit_list = results_full.groupby("circuitName").agg(
    races=("raceId", "nunique"),
    firstYear=("year", "min"),
    lastYear=("year", "max"),
).reset_index().sort_values("races", ascending=False)

# Also build a constructor→color map
color_map = {}
for _, row in constructor_list.iterrows():
    name = row["constructorName"]
    color_map[name] = TEAM_COLORS.get(name, "#888888")

# Driver-to-constructor mapping per season
driver_constructor_map = {}
for year, grp in results_full.groupby("year"):
    year_map = {}
    for _, row in grp.drop_duplicates(subset=["fullName", "constructorName"]).iterrows():
        year_map[row["fullName"]] = row["constructorName"]
    driver_constructor_map[str(int(year))] = year_map

save_json({
    "years": [int(y) for y in all_years],
    "drivers": [{"name": row["fullName"], "races": int(row["races"]),
                 "firstYear": int(row["firstYear"]), "lastYear": int(row["lastYear"])}
                for _, row in driver_list.head(200).iterrows()],
    "constructors": [{"name": row["constructorName"], "races": int(row["races"]),
                      "firstYear": int(row["firstYear"]), "lastYear": int(row["lastYear"]),
                      "color": color_map.get(row["constructorName"], "#888888")}
                     for _, row in constructor_list.iterrows()],
    "circuits": [{"name": row["circuitName"], "races": int(row["races"]),
                  "firstYear": int(row["firstYear"]), "lastYear": int(row["lastYear"])}
                 for _, row in circuit_list.iterrows()],
    "teamColors": color_map,
    "driverConstructorMap": driver_constructor_map,
}, "metadata.json")

print("\n[DONE] Data pipeline complete! JSON files written to:", OUT_DIR)
