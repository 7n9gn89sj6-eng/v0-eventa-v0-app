-- Assert canonical EventCategory after 20260322120000_canonical_event_categories.
-- Fails fast if deploy order was wrong, migration was skipped, or data drift remains.
-- Deploy: `npx prisma migrate deploy` (applies 20260322120000 first, then this).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    INNER JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'EventCategory'
      AND e.enumlabel::text = ANY (
        ARRAY[
          'ARTS_CULTURE',
          'MUSIC_NIGHTLIFE',
          'FAMILY_KIDS',
          'SPORTS_OUTDOORS',
          'COMMUNITY_CAUSES',
          'LEARNING_TALKS',
          'MARKETS_FAIRS',
          'ONLINE_VIRTUAL'
        ]
      )
  ) THEN
    RAISE EXCEPTION
      'EventCategory enum still has legacy labels; ensure 20260322120000_canonical_event_categories completed (check _prisma_migrations and DB logs)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Event" WHERE "category" IS NULL) THEN
    RAISE EXCEPTION
      'Event.category has NULL rows; backfill required (see 20260322120000_canonical_event_categories mapping)';
  END IF;
END $$;
