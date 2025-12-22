# Search Priority System

## Overview
Eventa prioritizes **user-created, curated events** over external web search results to ensure user satisfaction with accurate, verified events.

## Priority Order

1. **Internal Events (Highest Priority)**
   - Events created by users in the Eventa database
   - Curated and verified through moderation
   - Always appear FIRST in search results
   - Marked with "Eventa Event" badge

2. **External Web Results (Lower Priority)**
   - Informational results from web search
   - May not be current events or may require verification
   - Only appear AFTER all internal events
   - Clearly marked with "Web Result" badge and warning message

## Implementation

### Backend (`/api/search/events`)
- Internal events are queried first from the database
- External web results are fetched separately
- Results are combined with internal events FIRST, then external events
- Sorting is applied within each group (internal first, then external)

### Frontend (`components/events/events-listing-content.tsx`)
- Results are displayed with internal events first
- Visual badges distinguish "Eventa Event" from "Web Result"
- Web results include a warning about verification

## User Input Understanding

The search system:
1. **Reads user input** via the intent API (`/api/search/intent`)
2. **Extracts entities** (city, category, date, etc.) from natural language
3. **Uses detected location** as default when no location is specified
4. **Prioritizes explicit locations** over detected location
5. **Filters results** by extracted entities
6. **Ranks results** with internal events first

## Example Flow

User searches: "jazz this weekend"

1. Intent API extracts: `{ type: "jazz", date: "this weekend", city: "Melbourne" }` (from detected location)
2. Database search finds 5 internal jazz events in Melbourne
3. Web search finds 10 external jazz events
4. Results displayed:
   - 5 Eventa Events (internal, curated)
   - 10 Web Results (external, informational)

User satisfaction is ensured by showing accurate, curated events first.

