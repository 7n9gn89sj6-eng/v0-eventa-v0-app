## Eventa Search Guardrails

### Core behaviour
- Internal events must rank #1 for clear named-event queries
- Search must never return HTTP 500
- Search must never return empty if relevant results exist

### Location integrity
- Query place override must remain stable
- City + country must always be consistent

### Internal data visibility
- Internal events must never be dropped silently
- Internal results must always be included in merge

### Ranking protection
- Exact matches must outrank generic pages
- Broad “what to do” pages must not outrank named events

### Fallback behaviour
- If strict match returns 0 → relax automatically
- Never over-filter into empty state

### Regression tests
These queries must always return HTTP 200 and rank #1:

- Lantern Festival Alpha (Melbourne)
- Jazz Night Gamma (Melbourne)
- Silent Disco Omega (Sydney)
- Theatre Delta (Sydney)
- Yoga Sigma (Paris)

### Implementation rule
- AI / intent logic must be additive, not replace deterministic core
- Must fall back safely
