# Eventa Search — Manual QA Run Sheet

**Post location stabilisation (Stages A–D)**  
Validate current Discover + `/api/search/events` behaviour. **Not** a feature spec; **no** code changes in this document.

---

## 1. Purpose

Confirm real-world search trust after canonical places (suggest/resolve), Post Event verify-then-select, submit persistence, and Discover URL-driven autocomplete. Record outcomes so failures can be triaged to parser, filtering, ranking, AI assist, data scarcity, or URL/state — **before** any redesign.

---

## 2. How to use this sheet

1. Open `/discover` in a browser with **DevTools → Network** open.
2. For each **Test ID**, apply **User input** and **Selected place** exactly as specified.
3. Open filters when you need PlaceAutocomplete (`filters.show`).
4. After the UI settles, fill the **Result** fields for that row.

**Distinguish “no results”:**

| Situation | How to tell | Failure type hint |
|-----------|-------------|-------------------|
| **Inventory absent** | API returns few/zero rows but `effectiveLocation` / scope looks right; other queries in same city return events | `inventory/data scarcity` |
| **Scoping or interpretation wrong** | Wrong city/country in response, or empty when URL/API clearly has `city`+`country`; or results from wrong continent | `filtering/location` or `parser` |

**Record:**

- **Browser URL** uses `q`; the listing often calls the API with **`query=`** — copy **both** if they differ.
- **Observed precedence** (query-implied place vs UI-selected place) whenever both are non-empty.

---

## 3. Failure type legend

| Code | Use when |
|------|----------|
| **parser** | Place/time/intent wrong from free text (parse, geocode merge, typos). |
| **filtering/location** | Wrong scope, `where` clause, suburb→metro, external client filter vs API. |
| **ranking** | Pool roughly right but order or emphasis wrong. |
| **AI assist** | `interpretSearchIntent` surprises (category/dates). |
| **inventory/data scarcity** | Logic OK; not enough events in DB / thin web results. |
| **stale state / URL sync** | URL ≠ UI state, reload/back-forward wrong, `q` vs `query` mismatch. |

---

## 4. Precedence rule (query vs UI place)

When **query text implies place A** and **PlaceAutocomplete sets place B**, note which behaviour you see:

- **Observed precedence:** `query` | `UI` | `merged` | `unclear`

**I1** is the anchor case — run it in every regression pass.

---

## 5. Test cases

### Scenario A — Suburb

#### A1

| Field | Content |
|--------|---------|
| **Test ID** | A1 |
| **Scenario** | Suburb |
| **User input** | `brunswick gigs this weekend` |
| **Selected place** | No |
| **Expected URL params** | `q` reflects text; typically no `city`/`country` unless added manually |
| **Expected interpretation** | Brunswick + AU bias; weekend may come from parser/AI |
| **Pass criteria** | Results plausibly AU/VIC; weekend sensible or explained |
| **Likely failure mode** | parser, AI assist, filtering |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

#### A2

| Field | Content |
|--------|---------|
| **Test ID** | A2 |
| **Scenario** | Suburb |
| **User input** | `brunswick gigs this weekend` |
| **Selected place** | Yes — **Brunswick, VIC, Australia** |
| **Expected URL params** | `q=...&city=Brunswick&country=Australia` |
| **Expected interpretation** | UI place in plan; possible suburb→metro widen if few internal hits |
| **Pass criteria** | Scoped to Brunswick or documented widen to Melbourne |
| **Likely failure mode** | filtering/location, inventory |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:** *(required — query + UI)*  
- **Notes:**  

---

#### A3

| Field | Content |
|--------|---------|
| **Test ID** | A3 |
| **Scenario** | Suburb |
| **User input** | `fitzroy market` |
| **Selected place** | No |
| **Expected URL params** | `q=fitzroy+market` |
| **Expected interpretation** | Local + “market” |
| **Pass criteria** | Melbourne-area or clear AU bias |
| **Likely failure mode** | parser, filtering |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

### Scenario B — City

#### B1

| Field | Content |
|--------|---------|
| **Test ID** | B1 |
| **Scenario** | City |
| **User input** | `concerts in melbourne` |
| **Selected place** | No |
| **Expected URL params** | `q=concerts+in+melbourne` |
| **Expected interpretation** | Melbourne from text + plan |
| **Pass criteria** | Execution city Melbourne; concert-relevant results |
| **Likely failure mode** | parser, filtering |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

#### B2

| Field | Content |
|--------|---------|
| **Test ID** | B2 |
| **Scenario** | City |
| **User input** | `what's on` |
| **Selected place** | Yes — **Melbourne, Victoria, Australia** |
| **Expected URL params** | `q` + `city=Melbourne&country=Australia` |
| **Expected interpretation** | Vague text + UI scope |
| **Pass criteria** | Results plausibly Melbourne |
| **Likely failure mode** | filtering, inventory |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

#### B3

| Field | Content |
|--------|---------|
| **Test ID** | B3 |
| **Scenario** | City |
| **User input** | `events` |
| **Selected place** | Yes — **Sydney, NSW, Australia** |
| **Expected URL params** | `q=events&city=Sydney&country=Australia` |
| **Expected interpretation** | Broad keyword + Sydney |
| **Pass criteria** | Sydney-scoped listing |
| **Likely failure mode** | filtering, inventory |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

### Scenario C — Suburb + country (in text)

#### C1

| Field | Content |
|--------|---------|
| **Test ID** | C1 |
| **Scenario** | Suburb + country |
| **User input** | `yoga brunswick australia` |
| **Selected place** | No |
| **Expected URL params** | `q=yoga+brunswick+australia` |
| **Expected interpretation** | AU + Brunswick |
| **Pass criteria** | AU results; not Brunswick USA |
| **Likely failure mode** | parser, filtering |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

#### C2

| Field | Content |
|--------|---------|
| **Test ID** | C2 |
| **Scenario** | Suburb + country |
| **User input** | `cafes richmond vic` |
| **Selected place** | No |
| **Expected URL params** | `q=cafes+richmond+vic` |
| **Expected interpretation** | VIC + Richmond (Melbourne) |
| **Pass criteria** | Bias to AU VIC |
| **Likely failure mode** | parser, filtering |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

### Scenario D — Category + location

#### D1

| Field | Content |
|--------|---------|
| **Test ID** | D1 |
| **Scenario** | Category + location |
| **User input** | `live music` |
| **Selected place** | Yes — **Melbourne, Australia** |
| **Expected URL params** | `q=live+music&city=Melbourne&country=Australia` |
| **Expected interpretation** | Music + Melbourne |
| **Pass criteria** | Music-ish events in Melbourne first |
| **Likely failure mode** | ranking, filtering, inventory |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

#### D2

| Field | Content |
|--------|---------|
| **Test ID** | D2 |
| **Scenario** | Category + location |
| **User input** | `food festival` + filter **Music** |
| **Selected place** | Yes — **Melbourne** |
| **Expected URL params** | `q=food+festival&city=Melbourne&country=Australia&category=music` |
| **Expected interpretation** | UI category vs query “food” |
| **Pass criteria** | Behaviour **stable** run-to-run; product rule clear |
| **Likely failure mode** | ranking, parser |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

#### D3

| Field | Content |
|--------|---------|
| **Test ID** | D3 |
| **Scenario** | Category + location |
| **User input** | *(empty smart bar)* |
| **Selected place** | Yes — **Melbourne** |
| **Filters** | Category **Food** |
| **Expected URL params** | `city=Melbourne&country=Australia&category=food` (no `q` or empty) |
| **Expected interpretation** | Browse food + Melbourne |
| **Pass criteria** | Food events in Melbourne without requiring text query |
| **Likely failure mode** | filtering, inventory, stale state |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

### Scenario E — Date + location

#### E1

| Field | Content |
|--------|---------|
| **Test ID** | E1 |
| **Scenario** | Date + location |
| **User input** | `gigs saturday melbourne` |
| **Selected place** | No |
| **Expected URL params** | `q=gigs+saturday+melbourne` |
| **Expected interpretation** | Saturday + Melbourne |
| **Pass criteria** | Correct Saturday (timezone) + Melbourne |
| **Likely failure mode** | parser, AI assist, filtering |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

#### E2

| Field | Content |
|--------|---------|
| **Test ID** | E2 |
| **Scenario** | Date + location |
| **User input** | *(use marketing/deeplink with `date_from` & `date_to`)* |
| **Selected place** | Yes — **Melbourne** |
| **Expected URL params** | includes `date_from`, `date_to`, `city`, `country` |
| **Expected interpretation** | Date overlap + Melbourne |
| **Pass criteria** | Only events overlapping range |
| **Likely failure mode** | filtering, stale state |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

### Scenario F — Vague phrasing

#### F1

| Field | Content |
|--------|---------|
| **Test ID** | F1 |
| **Scenario** | Vague phrasing |
| **User input** | `something fun tonight` |
| **Selected place** | No |
| **Expected URL params** | `q=something+fun+tonight` |
| **Expected interpretation** | Broad + “tonight” |
| **Pass criteria** | Sensible default bias; no crash |
| **Likely failure mode** | parser, AI assist, inventory |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

#### F2

| Field | Content |
|--------|---------|
| **Test ID** | F2 |
| **Scenario** | Vague phrasing |
| **User input** | `near me` *(decline geolocation if prompted)* |
| **Selected place** | No |
| **Expected URL params** | `q=near+me` |
| **Expected interpretation** | No device coords |
| **Pass criteria** | Graceful degradation |
| **Likely failure mode** | parser, inventory |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

#### F3

| Field | Content |
|--------|---------|
| **Test ID** | F3 |
| **Scenario** | Vague phrasing |
| **User input** | `weekend stuff` |
| **Selected place** | Yes — **Melbourne** |
| **Expected URL params** | `q=weekend+stuff&city=Melbourne&country=Australia` |
| **Expected interpretation** | Weekend + Melbourne |
| **Pass criteria** | Both dimensions visible in behaviour |
| **Likely failure mode** | parser, AI assist, filtering |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

### Scenario G — Typos / abbreviations

#### G1

| Field | Content |
|--------|---------|
| **Test ID** | G1 |
| **Scenario** | Typos / abbreviations |
| **User input** | `melbourn concerts` |
| **Selected place** | No |
| **Expected URL params** | `q=melbourn+concerts` |
| **Expected interpretation** | Melbourne recovery |
| **Pass criteria** | Melbourne-scoped or clear correction |
| **Likely failure mode** | parser |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

#### G2

| Field | Content |
|--------|---------|
| **Test ID** | G2 |
| **Scenario** | Typos / abbreviations |
| **User input** | `sydny events january` |
| **Selected place** | No |
| **Expected URL params** | `q=sydny+events+january` |
| **Expected interpretation** | Sydney + January |
| **Pass criteria** | Sydney + January window |
| **Likely failure mode** | parser, AI assist |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

#### G3

| Field | Content |
|--------|---------|
| **Test ID** | G3 |
| **Scenario** | Typos / abbreviations |
| **User input** | `bris gigs` |
| **Selected place** | No |
| **Expected URL params** | `q=bris+gigs` |
| **Expected interpretation** | Brisbane abbrev |
| **Pass criteria** | AU Brisbane bias |
| **Likely failure mode** | parser, filtering |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

### Scenario H — Empty query + place (URL SSOT)

#### H1

| Field | Content |
|--------|---------|
| **Test ID** | H1 |
| **Scenario** | Empty query + place |
| **User input** | *(empty)* |
| **Selected place** | Yes — **Carlton, VIC, Australia** |
| **Expected URL params** | `city=Carlton&country=Australia` |
| **Expected interpretation** | Browse Carlton |
| **Pass criteria** | API succeeds; scoped listing |
| **Likely failure mode** | filtering, inventory, stale state |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

#### H2

| Field | Content |
|--------|---------|
| **Test ID** | H2 |
| **Scenario** | Empty query + place |
| **User input** | *(empty)* |
| **Selected place** | Yes — **Perth, WA, Australia** |
| **Expected URL params** | `city=Perth&country=Australia` |
| **Expected interpretation** | Browse Perth |
| **Pass criteria** | Perth-scoped |
| **Likely failure mode** | filtering, inventory, stale state |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

#### H3

| Field | Content |
|--------|---------|
| **Test ID** | H3 |
| **Scenario** | Empty query + place |
| **User input** | *(none — open bookmark)* |
| **Selected place** | Hydrated: `/discover?city=Brunswick&country=Australia` |
| **Expected URL params** | As bookmarked |
| **Expected interpretation** | Reload/back-forward |
| **Pass criteria** | Filters + search match URL without extra steps |
| **Likely failure mode** | stale state / URL sync |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:**  
- **Notes:**  

---

### Scenario I — Query place vs UI place

#### I1 *(precedence anchor — highest-value regression)*

| Field | Content |
|--------|---------|
| **Test ID** | I1 |
| **Scenario** | Query vs UI place |
| **User input** | `sydney opera` |
| **Selected place** | Yes — **Melbourne, Australia** |
| **Expected URL params** | `q=sydney+opera&city=Melbourne&country=Australia` |
| **Expected interpretation** | **Record observed** — product precedence not assumed |
| **Pass criteria** | Same behaviour on repeat runs; geography is explicit in results |
| **Likely failure mode** | parser, filtering |

**Result**

- **Actual URL:**  
- **API request:**  
- **Effective location:**  
- **Top results:**  
- **Pass/Fail:**  
- **Failure type:**  
- **Observed precedence:** *(required)*  
- **Notes:**  

---

## 6. Regression shortlist (run every release)

**Must-include:**

1. **I1** — Query vs UI place precedence *(anchor)*  
2. **H3** — Bookmark URL hydration  
3. **H1** — Empty `q`, place only  
4. **D3** — Category + place, no text  
5. **B2** — Vague query + Melbourne  
6. **A2** — Suburb in text + matching UI place  
7. **E1** — Saturday + Melbourne in text  
8. **C2** — `richmond vic` disambiguation  
9. **G1** — `melbourn` typo  
10. **D2** — Query vs filter category tension  

---

## 7. Triage summary *(fill after runs)*

### Top parser issues  
*(Test IDs + one line)*  

### Top filtering / location issues  
*(Test IDs + one line)*  

### Top ranking issues  
*(Test IDs + one line)*  

### Top AI assist surprises  
*(Test IDs + one line)*  

### Top stale-state / URL issues  
*(Test IDs + one line)*  

### Inventory / data scarcity (not bugs)  
*(Test IDs + note)*  

### Recommended next engineering priority  
*(Single ordered bullet list — after analysis only)*  

---

*End of sheet.*
