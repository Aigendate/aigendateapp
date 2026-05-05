#!/usr/bin/env python3
"""
Pull, clean, and save public hospital/health-facility data for Paraguay.

Sources:
  1. OpenStreetMap (Overpass API) — individual facilities with coordinates
  2. healthsites.io API            — curated facility locations
  3. WHO Global Health Observatory  — national health indicators
  4. World Bank API                 — aggregate stats (beds, physicians, expenditure)

Output:
  data/osm_facilities.csv
  data/healthsites_facilities.csv
  data/who_indicators.csv
  data/worldbank_indicators.csv
  data/combined_facilities.csv   (merged OSM + healthsites, deduplicated)
"""

import csv
import json
import os
import sys
import time
import urllib.parse
from math import radians, cos, sin, asin, sqrt

import requests

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
HEADERS = {"User-Agent": "ParaguayHospitalDataCollector/1.0"}
OVERPASS_URL = "https://overpass-api.de/api/interpreter"


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def write_csv(filename, rows, fieldnames):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"  -> {path}  ({len(rows)} rows)")


def clean_text(value):
    if value is None:
        return ""
    return str(value).strip().replace("\n", " ").replace("\r", "")


def haversine(lon1, lat1, lon2, lat2):
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 6371 * 2 * asin(sqrt(a))


def fetch_json(url, params=None, retries=3, delay=5):
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, headers=HEADERS, timeout=60)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            print(f"  [attempt {attempt + 1}/{retries}] {e}")
            if attempt < retries - 1:
                time.sleep(delay)
    print(f"  FAILED to fetch {url}")
    return None


# ---------------------------------------------------------------------------
# 1. OpenStreetMap via Overpass
# ---------------------------------------------------------------------------

OVERPASS_QUERY = """
[out:json][timeout:120];
area["ISO3166-1"="PY"]->.py;
(
  nwr["amenity"="hospital"](area.py);
  nwr["amenity"="clinic"](area.py);
  nwr["amenity"="doctors"](area.py);
  nwr["healthcare"](area.py);
);
out center tags;
"""

OSM_FIELDS = [
    "osm_id", "osm_type", "name", "name_es", "facility_type", "healthcare",
    "operator", "operator_type", "beds", "emergency", "phone", "website",
    "addr_city", "addr_street", "lat", "lon", "source",
]


def fetch_osm():
    print("\n[1/4] Fetching OpenStreetMap data …")
    data = fetch_json(OVERPASS_URL, params={"data": OVERPASS_QUERY})
    if not data:
        return []

    elements = data.get("elements", [])
    print(f"  Raw elements: {len(elements)}")

    rows = []
    seen_ids = set()
    for el in elements:
        osm_id = el.get("id")
        if osm_id in seen_ids:
            continue
        seen_ids.add(osm_id)

        tags = el.get("tags", {})

        lat = el.get("lat") or (el.get("center", {}) or {}).get("lat")
        lon = el.get("lon") or (el.get("center", {}) or {}).get("lon")

        rows.append({
            "osm_id": osm_id,
            "osm_type": el.get("type", ""),
            "name": clean_text(tags.get("name", "")),
            "name_es": clean_text(tags.get("name:es", "")),
            "facility_type": tags.get("amenity", ""),
            "healthcare": tags.get("healthcare", ""),
            "operator": clean_text(tags.get("operator", "")),
            "operator_type": tags.get("operator:type", ""),
            "beds": tags.get("beds", ""),
            "emergency": tags.get("emergency", ""),
            "phone": clean_text(tags.get("phone", tags.get("contact:phone", ""))),
            "website": clean_text(tags.get("website", tags.get("contact:website", ""))),
            "addr_city": clean_text(tags.get("addr:city", "")),
            "addr_street": clean_text(tags.get("addr:street", "")),
            "lat": lat,
            "lon": lon,
            "source": "osm",
        })

    rows.sort(key=lambda r: (r["facility_type"], r["name"]))
    write_csv("osm_facilities.csv", rows, OSM_FIELDS)
    return rows


# ---------------------------------------------------------------------------
# 2. healthsites.io
# ---------------------------------------------------------------------------

HEALTHSITES_URL = "https://healthsites.io/api/v3/facilities/"

HS_FIELDS = [
    "hs_id", "name", "facility_type", "nature", "operator", "operator_type",
    "beds", "emergency", "phone", "addr_city", "lat", "lon", "source",
]


def fetch_healthsites():
    print("\n[2/4] Fetching healthsites.io data …")
    rows = []
    page = 1

    while True:
        data = fetch_json(HEALTHSITES_URL, params={
            "country": "Paraguay",
            "output": "json",
            "page": page,
            "page_size": 100,
        })
        if data is None:
            print("  Skipped (API may require an API key — see https://healthsites.io/api/v3/)")
            break
        if not isinstance(data, list) or len(data) == 0:
            break

        for feat in data:
            props = feat if isinstance(feat, dict) else {}
            geom = props.get("geometry", {}) or {}
            attributes = props.get("attributes", {}) or props.get("properties", {}) or {}
            coords = geom.get("coordinates", [None, None])

            lon = coords[0] if len(coords) > 0 else None
            lat = coords[1] if len(coords) > 1 else None

            rows.append({
                "hs_id": props.get("uuid", props.get("id", "")),
                "name": clean_text(attributes.get("name", "")),
                "facility_type": attributes.get("amenity", attributes.get("type", "")),
                "nature": attributes.get("nature", ""),
                "operator": clean_text(attributes.get("operator", "")),
                "operator_type": attributes.get("operator_type", ""),
                "beds": attributes.get("beds", ""),
                "emergency": attributes.get("emergency", ""),
                "phone": clean_text(attributes.get("phone", "")),
                "addr_city": clean_text(attributes.get("addr_city", attributes.get("address", ""))),
                "lat": lat,
                "lon": lon,
                "source": "healthsites",
            })

        if len(data) < 100:
            break
        page += 1
        time.sleep(1)

    print(f"  Raw records: {len(rows)}")
    rows.sort(key=lambda r: (r["facility_type"], r["name"]))
    write_csv("healthsites_facilities.csv", rows, HS_FIELDS)
    return rows


# ---------------------------------------------------------------------------
# 3. WHO Global Health Observatory
# ---------------------------------------------------------------------------

WHO_INDICATORS = {
    "HWF_0001": "Medical doctors (per 10,000)",
    "HWF_0006": "Nursing and midwifery (per 10,000)",
    "WHS6_102":  "Hospital beds (per 10,000)",
    "UHC_INDEX_REPORTED": "UHC service coverage index",
    "WHOSIS_000001": "Life expectancy at birth (both sexes)",
    "MDG_0000000001": "Infant mortality rate (per 1,000 live births)",
    "WHS7_104": "Current health expenditure (% of GDP)",
}

WHO_FIELDS = ["indicator_code", "indicator_name", "year", "value", "source"]


def fetch_who():
    print("\n[3/4] Fetching WHO GHO indicators …")
    rows = []

    for code, label in WHO_INDICATORS.items():
        url = f"https://ghoapi.azureedge.net/api/{code}?$filter=SpatialDim eq 'PRY'"
        data = fetch_json(url)
        if not data:
            continue

        for rec in data.get("value", []):
            val = rec.get("NumericValue")
            if val is None:
                continue
            rows.append({
                "indicator_code": code,
                "indicator_name": label,
                "year": rec.get("TimeDim", ""),
                "value": val,
                "source": "who_gho",
            })

    rows.sort(key=lambda r: (r["indicator_code"], str(r["year"])))
    write_csv("who_indicators.csv", rows, WHO_FIELDS)
    return rows


# ---------------------------------------------------------------------------
# 4. World Bank
# ---------------------------------------------------------------------------

WB_INDICATORS = {
    "SH.MED.BEDS.ZS": "Hospital beds (per 1,000 people)",
    "SH.MED.PHYS.ZS": "Physicians (per 1,000 people)",
    "SH.MED.NUMW.P3": "Nurses and midwives (per 1,000 people)",
    "SH.XPD.CHEX.GD.ZS": "Current health expenditure (% of GDP)",
    "SH.XPD.CHEX.PC.CD": "Current health expenditure per capita (USD)",
    "SP.DYN.LE00.IN": "Life expectancy at birth (years)",
    "SH.DYN.MORT": "Under-5 mortality rate (per 1,000)",
}

WB_FIELDS = ["indicator_code", "indicator_name", "year", "value", "source"]


def fetch_worldbank():
    print("\n[4/4] Fetching World Bank indicators …")
    rows = []

    for code, label in WB_INDICATORS.items():
        url = f"https://api.worldbank.org/v2/country/PRY/indicator/{code}"
        data = fetch_json(url, params={"format": "json", "per_page": 100})
        if not data or len(data) < 2:
            continue

        for rec in data[1] or []:
            val = rec.get("value")
            if val is None:
                continue
            rows.append({
                "indicator_code": code,
                "indicator_name": label,
                "year": rec.get("date", ""),
                "value": val,
                "source": "worldbank",
            })

    rows.sort(key=lambda r: (r["indicator_code"], str(r["year"])))
    write_csv("worldbank_indicators.csv", rows, WB_FIELDS)
    return rows


# ---------------------------------------------------------------------------
# Combine & deduplicate facility data
# ---------------------------------------------------------------------------

COMBINED_FIELDS = [
    "name", "facility_type", "operator", "beds", "emergency",
    "phone", "lat", "lon", "addr_city", "source", "source_id",
]

DUPLICATE_RADIUS_KM = 0.15  # ~150 m


def combine_facilities(osm_rows, hs_rows):
    print("\n[Combining] Merging OSM + healthsites …")

    combined = []
    for r in osm_rows:
        combined.append({
            "name": r["name"] or r["name_es"],
            "facility_type": r["facility_type"] or r["healthcare"],
            "operator": r["operator"],
            "beds": r["beds"],
            "emergency": r["emergency"],
            "phone": r["phone"],
            "lat": r["lat"],
            "lon": r["lon"],
            "addr_city": r["addr_city"],
            "source": "osm",
            "source_id": str(r["osm_id"]),
        })

    osm_coords = [
        (float(r["lat"]), float(r["lon"]))
        for r in combined
        if r["lat"] and r["lon"]
    ]

    added = 0
    skipped = 0
    for r in hs_rows:
        if not r["lat"] or not r["lon"]:
            combined.append({
                "name": r["name"],
                "facility_type": r["facility_type"],
                "operator": r["operator"],
                "beds": r["beds"],
                "emergency": r["emergency"],
                "phone": r["phone"],
                "lat": r["lat"],
                "lon": r["lon"],
                "addr_city": r["addr_city"],
                "source": "healthsites",
                "source_id": str(r["hs_id"]),
            })
            added += 1
            continue

        hs_lat, hs_lon = float(r["lat"]), float(r["lon"])
        duplicate = False
        for olat, olon in osm_coords:
            if haversine(hs_lon, hs_lat, olon, olat) < DUPLICATE_RADIUS_KM:
                duplicate = True
                break

        if duplicate:
            skipped += 1
        else:
            combined.append({
                "name": r["name"],
                "facility_type": r["facility_type"],
                "operator": r["operator"],
                "beds": r["beds"],
                "emergency": r["emergency"],
                "phone": r["phone"],
                "lat": hs_lat,
                "lon": hs_lon,
                "addr_city": r["addr_city"],
                "source": "healthsites",
                "source_id": str(r["hs_id"]),
            })
            added += 1

    print(f"  healthsites added: {added}, duplicates skipped: {skipped}")

    # drop rows with no name and no coordinates
    combined = [r for r in combined if r["name"] or (r["lat"] and r["lon"])]
    combined.sort(key=lambda r: (r["facility_type"], r["name"]))

    write_csv("combined_facilities.csv", combined, COMBINED_FIELDS)
    return combined


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def print_summary(osm, hs, who, wb, combined):
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  OSM facilities:          {len(osm)}")
    print(f"  healthsites facilities:  {len(hs)}")
    print(f"  Combined (deduplicated): {len(combined)}")
    print(f"  WHO indicator records:   {len(who)}")
    print(f"  World Bank records:      {len(wb)}")
    print(f"\n  Files written to: {DATA_DIR}/")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Paraguay Hospital & Health Facility Data Collector")
    print("=" * 60)
    ensure_data_dir()

    osm_rows = fetch_osm()
    hs_rows = fetch_healthsites()
    who_rows = fetch_who()
    wb_rows = fetch_worldbank()
    combined = combine_facilities(osm_rows, hs_rows)

    print_summary(osm_rows, hs_rows, who_rows, wb_rows, combined)


if __name__ == "__main__":
    main()
