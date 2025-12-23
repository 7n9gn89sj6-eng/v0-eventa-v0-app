# Trip/Holiday Intent Implementation - Audit Report

**Date:** December 2024  
**Auditor:** Product-Aware Engineering Review  
**Status:** ⚠️ **VALIDATED WITH RECOMMENDATIONS**

---

## Executive Summary

The trip intent implementation is **functionally correct and additive**, but has **3 logic risks** that could cause unintended date filtering behavior. All issues are fixable with small, targeted adjustments. The ranking logic is sound and does not exclude events.

**Overall Assessment:** ✅ **Safe for deployment after addressing identified risks**

---

## ✅ What Is Correct and Should Be Kept

### 1. Intent Detection Schema
- ✅ **Additive:** `isTripIntent`, `duration`, and `interests` are all optional fields
- ✅ **Resilient:** Defaults to `false`, `undefined`, and `[]` respectively
- ✅ **Non-breaking:** Existing searches work identically without these fields
- ✅ **Location:** `app/api/search/intent/route.ts` (lines 29-32)

### 2. Ranking Bias Logic
- ✅ **Pure ranking only:** All trip intent logic is additive scoring (`score += X`)
- ✅ **No filtering:** No events are excluded based on trip intent
- ✅ **Appropriate boosts:** Multi-day (+3), markets/exhibitions/festivals (+2), interests (+3)
- ✅ **Gentle penalties:** -0.5 points for niche events (ranking-only, never zero-out)
- ✅ **Location:** `app/api/search/internal/route.ts` (lines 770-842)

### 3. Fallback Detection
- ✅ **Defensive:** Only activates if explicit trip intent fields aren't provided
- ✅ **Safe patterns:** Regex patterns are specific enough to avoid false positives
- ✅ **Location:** `app/api/search/internal/route.ts` (lines 19-64)

### 4. Search Integrity
- ✅ **Non-trip searches unchanged:** When `tripIntent === false`, behavior is identical to before
- ✅ **Location filters preserved:** City/country filtering works normally
- ✅ **Date overlap logic respected:** Uses `buildDateOverlapWhere` correctly
- ✅ **Event-first ordering:** Internal events still prioritize over web results

### 5. Philosophical Guardrails
- ✅ **No itinerary creation:** No UI or data model changes
- ✅ **No saved trips:** No persistence layer
- ✅ **No UI modes:** All logic backend-only
- ✅ **No user profiling:** Request-level only, not persisted
- ✅ **Reversible:** All changes are isolated and documented

---

## ⚠️ Logic Risks & Edge Cases

### Risk 1: Aggressive Duration Default on Explicit Dates

**Location:** `app/api/search/internal/route.ts` (line 123)

**Issue:**
```typescript
const durationDays = tripDuration || (tripIntent ? 7 : undefined) || 7
```

**Problem:**
If `tripIntent === true` and `date_iso` is provided (e.g., "Things on in Rome in April" → April 15), but NO duration is mentioned, it ALWAYS extends by 7 days (April 15 → April 22). This assumes a 7-day trip when the user may want to see ALL events in April.

**Example:**
- Query: "Things on in Rome in April"
- AI extracts: `date_iso: "2025-04-15"`, `isTripIntent: true`, `duration: undefined`
- Current behavior: Filters to April 15-22 (7-day window)
- Expected: Should use full month range OR only extend if duration explicitly mentioned

**Recommendation:**
```typescript
// Only extend if duration is explicitly provided, not inferred
const durationDays = tripDuration || 1  // Default to single day if no duration
// OR: Don't extend at all if tripDuration is undefined and only date_iso provided
```

**Impact:** Medium (could hide relevant events outside the 7-day window)

---

### Risk 2: Date Filter Creation Without Explicit Date

**Location:** `app/api/search/internal/route.ts` (lines 134-143)

**Issue:**
```typescript
} else if (tripIntent && tripDuration && tripDuration > 0) {
  // Trip intent with duration but no explicit date: use current date as start
  const startDate = DateTime.now().startOf("day")
  const endDate = startDate.plus({ days: tripDuration }).endOf("day")
  dateFilter = { gte: startDate.toJSDate(), lte: endDate.toJSDate() }
}
```

**Problem:**
If someone says "I'm going to Berlin" (trip intent detected, duration parsed from query, but no date), it creates a date filter from "now" to "now + 7 days". This could exclude future events that are still relevant (e.g., "I'm going to Berlin" said in December for a March trip).

**Example:**
- Query: "I'm going to Berlin for a week" (said in December)
- Current behavior: Filters to next 7 days (December)
- Expected: Should NOT create date filter if no explicit date mentioned, or should be more lenient

**Recommendation:**
```typescript
// Only create date filter if explicit date is provided OR query contains time phrase
// OR: Make this conditional - only apply if the query mentions "this week" or similar
if (tripIntent && tripDuration && query && /(this|next)\s+(week|month)/i.test(query)) {
  // Apply date filter
}
```

**Impact:** Medium (could exclude future relevant events)

---

### Risk 3: Query Parser Date Extension

**Location:** `lib/search/query-parser.ts` (line 72)

**Issue:**
```typescript
if (isTripIntent && tripDuration && tripDuration > 0) {
  // For trip queries, extend the end date by duration
  endDay.setDate(endDay.getDate() + tripDuration - 1)
}
```

**Problem:**
This extends dates at the URL param level, which then flows into WHERE clause filtering (not just ranking). If someone says "Things on in Rome in April" and trip intent is detected, it could extend the month range unexpectedly.

**Recommendation:**
This is actually correct behavior IF duration is explicitly mentioned (e.g., "for a week"), but should NOT extend if duration wasn't mentioned. The query parser receives trip intent from the intent API, so this should be safe, but verify it's not too aggressive.

**Impact:** Low (depends on intent API accuracy)

---

### Edge Case 1: Month-Only Dates with Trip Intent

**Scenario:** "Things on in Paris in April"
- AI extracts: `date_iso: "2025-04-01"`, `isTripIntent: true`, `duration: undefined`
- Current: Could extend April 1 → April 8 (7 days) OR use full month
- **Status:** Query parser handles month-only dates correctly (lines 59-66), but internal search might still extend

**Recommendation:** Add check for month-only dates and use full month range

---

### Edge Case 2: Fallback Detection False Positives

**Location:** `app/api/search/internal/route.ts` (line 29)

**Pattern:** `/things\s+(?:on|happening)\s+in.*\s+in\s+(?:april|may...)/i`

**Risk:** Could match "Things on in London in the news" (not a trip query)

**Assessment:** Low risk - pattern requires a month name, unlikely false positive

---

### Edge Case 3: Interest Extraction from Non-Trip Queries

**Scenario:** "I like jazz" (regular local search, NOT a trip)
- Current: Fallback detection wouldn't trigger trip intent (no trip phrases)
- **Status:** ✅ Safe - interests only used if trip intent is true

---

## ❌ Scope Creep Check

### Intentional Scope Boundaries
✅ **No itinerary creation:** Confirmed - no UI or data model changes  
✅ **No saved trips:** Confirmed - request-level only  
✅ **No UI modes:** Confirmed - backend-only  
✅ **No user profiling:** Confirmed - not persisted  

### Potential Scope Risks
⚠️ **Date filtering with trip intent:** Could be seen as "planning" if too aggressive  
⚠️ **Duration assumptions:** 7-day default could feel prescriptive  
✅ **Ranking bias:** Appropriate - subtle, additive, reversible  

**Verdict:** ✅ **No scope creep detected** - all changes are additive ranking improvements

---

## 🔧 Recommended Refinements (Small Fixes Only)

### Fix 1: Conservative Duration Default

**File:** `app/api/search/internal/route.ts`  
**Line:** 123

**Change:**
```typescript
// BEFORE:
const durationDays = tripDuration || (tripIntent ? 7 : undefined) || 7

// AFTER:
// Only use 7-day default if duration is explicitly mentioned OR no date_iso (avoid extending explicit dates)
const durationDays = tripDuration || (tripIntent && !entities.date_iso ? 7 : undefined) || 1
```

**Rationale:** Don't extend explicit dates unless duration is mentioned. Default to 1 day if no duration.

---

### Fix 2: Conditional Date Filter for Trip-Only Queries

**File:** `app/api/search/internal/route.ts`  
**Lines:** 134-143

**Change:**
```typescript
// BEFORE:
} else if (tripIntent && tripDuration && tripDuration > 0) {
  const startDate = DateTime.now().startOf("day")
  const endDate = startDate.plus({ days: tripDuration }).endOf("day")
  dateFilter = { gte: startDate.toJSDate(), lte: endDate.toJSDate() }
}

// AFTER:
// Only create date filter if query mentions time context (e.g., "this week", "next month")
// OR if explicit date was provided in entities
} else if (tripIntent && tripDuration && tripDuration > 0 && 
           (query && /(this|next|soon|coming)\s+(week|month)/i.test(query))) {
  // User mentioned time context, safe to filter
  const startDate = DateTime.now().startOf("day")
  const endDate = startDate.plus({ days: tripDuration }).endOf("day")
  dateFilter = { gte: startDate.toJSDate(), lte: endDate.toJSDate() }
}
// Otherwise, don't create date filter - let ranking bias handle it
```

**Rationale:** Only filter by date if user explicitly mentioned time context. Otherwise, rely on ranking bias.

---

### Fix 3: Month-Only Date Handling

**File:** `lib/search/query-parser.ts`  
**Lines:** 59-79

**Current behavior is correct** - month-only dates use full month range. No change needed, but add comment:

```typescript
if (isMonthOnly) {
  // Month range: from first day to last day of the month
  // For trip queries with month-only dates, use full month (don't extend further)
  // Duration extension only applies to single-day dates
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
  // ... existing code
}
```

---

## 🧪 Test Queries to Validate Behavior

### Test Suite 1: Trip Intent Detection

1. **"I'm going to Berlin for a week and like music and food"**
   - ✅ Should detect: `isTripIntent: true`, `duration: 7`, `interests: ["music", "food"]`
   - ✅ Should boost: Multi-day events, music events, food events, markets
   - ⚠️ Should verify: Date range doesn't exclude future relevant events if no explicit date

2. **"Things on in Rome in April"**
   - ✅ Should detect: `isTripIntent: true`
   - ⚠️ Should verify: Uses full month range (April 1-30), NOT just 7 days
   - ✅ Should boost: Markets, exhibitions, festivals

3. **"Community events in Athens over summer"**
   - ✅ Should detect: `isTripIntent: true`
   - ⚠️ Should verify: Doesn't create restrictive date filter
   - ✅ Should boost: Community events, multi-day events

---

### Test Suite 2: Non-Trip Searches (Must Be Unchanged)

1. **"jazz this weekend"** (local search)
   - ✅ Should have: `isTripIntent: false`
   - ✅ Should behave: Exactly as before (no trip logic applied)
   - ✅ Should rank: By relevance, proximity, no traveler bias

2. **"What's on tonight near me"**
   - ✅ Should have: `isTripIntent: false`
   - ✅ Should filter: To tonight only
   - ✅ Should rank: By relevance, not traveler suitability

3. **"Berlin concerts"** (no trip phrase)
   - ✅ Should have: `isTripIntent: false` (no "going to", "visiting", etc.)
   - ✅ Should behave: Normal search, no date extension, no traveler bias

---

### Test Suite 3: Edge Cases

1. **"I like food"** (interest only, no trip)
   - ✅ Should have: `isTripIntent: false`
   - ✅ Should behave: Regular search, interests NOT extracted as trip context

2. **"visiting family in London"** (visiting ≠ trip planning)
   - ⚠️ Risk: Fallback might detect as trip intent
   - ✅ Should verify: Does NOT apply trip ranking (or apply very conservatively)

3. **"Things happening in Paris"** (no date, no trip phrase)
   - ✅ Should have: `isTripIntent: false`
   - ✅ Should behave: Normal search, no date filter created

---

### Test Suite 4: Date Range Validation

1. **"I'm going to Berlin"** (no date, no duration - said in Dec for March trip)
   - ⚠️ Risk: Creates date filter from "now" (Dec) excluding March events
   - ✅ Should verify: Does NOT create restrictive date filter OR is lenient

2. **"Markets in Rome in April"** (month-only date)
   - ✅ Should use: Full month range (April 1-30)
   - ⚠️ Should verify: NOT extended to April 1-8 (7 days)

3. **"Berlin next month"** (relative date)
   - ✅ Should detect: Trip intent + time context
   - ✅ Should filter: To next month range
   - ✅ Should boost: Traveler-appropriate events

---

## 📊 Validation Checklist

### Intent Detection
- [x] Additive - optional fields only
- [x] Resilient - defaults handle missing data
- [x] Explicit detection - AI extracts from query
- [x] Fallback detection - regex patterns as backup
- [x] No false positives - patterns are specific

### Date & Duration
- [ ] **Conservative defaults** - ⚠️ **Needs fix** (7-day default too aggressive)
- [x] No hard assumptions - uses overlap logic
- [x] Multi-day events eligible - overlap logic preserved
- [ ] **Conditional filtering** - ⚠️ **Needs fix** (creates filters when it shouldn't)

### Ranking Logic
- [x] Pure ranking - no filtering
- [x] Appropriate boosts - multi-day, markets, interests
- [x] Gentle penalties - -0.5 points only
- [x] Never zero-out - all events remain eligible

### Search Integrity
- [x] Non-trip searches unchanged
- [x] Location filters preserved
- [x] Date overlap logic respected
- [x] Event-first ordering maintained

### Philosophical Guardrails
- [x] No itinerary creation
- [x] No saved trips
- [x] No UI modes
- [x] No user profiling
- [x] Reversible - isolated changes

---

## 🎯 Final Recommendations

### Critical (Before Deployment)

1. **Fix duration default on explicit dates** (Risk 1)
   - Don't extend explicit dates by 7 days unless duration mentioned
   - Use full month range for month-only dates

2. **Fix date filter creation** (Risk 2)
   - Only create date filter if time context mentioned ("this week", "next month")
   - OR: Don't create filter, rely on ranking bias only

### Optional (Nice-to-Have)

3. **Add logging** for trip intent decisions
   - Log when trip intent detected and why
   - Log when date filters are created vs. not created

4. **Add tests** for edge cases above
   - Month-only dates
   - No explicit date queries
   - Non-trip queries with similar patterns

---

## ✅ Conclusion

**The implementation is fundamentally sound** and aligns with Eventa's philosophy. The ranking logic is appropriate, additive, and reversible. However, **2 date filtering behaviors are too aggressive** and could exclude relevant events:

1. Extending explicit dates by 7 days when duration isn't mentioned
2. Creating date filters for trip queries without time context

**Recommendation:** Apply the 2 critical fixes above, then proceed with deployment. The changes are small, targeted, and preserve the conservative ranking-only approach.

---

## Implementation Notes

- All trip intent logic is request-level only (not persisted)
- Ranking boosts are additive (never subtract below zero)
- Fallback detection only activates if explicit fields missing
- Non-trip searches are completely unaffected
- Changes are well-commented and reversible

**Bottom Line:** ✅ **Safe to deploy after addressing 2 date filtering risks**

