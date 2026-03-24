-- Canonical EventCategory enum + optional subcategory / custom label / original language
--
-- Old -> new (data migration):
--   ARTS_CULTURE -> ART
--   MUSIC_NIGHTLIFE -> MUSIC
--   FOOD_DRINK -> FOOD_DRINK
--   FAMILY_KIDS -> FAMILY
--   SPORTS_OUTDOORS -> SPORTS
--   COMMUNITY_CAUSES -> COMMUNITY
--   LEARNING_TALKS -> TALKS
--   MARKETS_FAIRS -> MARKETS
--   ONLINE_VIRTUAL -> OTHER (with legacy label below; avoids misclassifying as TALKS)

CREATE TYPE "EventCategory_new" AS ENUM (
  'MUSIC',
  'THEATRE',
  'COMEDY',
  'ART',
  'FILM',
  'FOOD_DRINK',
  'FAMILY',
  'COMMUNITY',
  'MARKETS',
  'NIGHTLIFE',
  'WORKSHOPS',
  'SPORTS',
  'WELLNESS',
  'FESTIVALS',
  'TALKS',
  'OTHER'
);

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "subcategory" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "customCategoryLabel" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "originalLanguage" TEXT;

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "_mig_prev_category" TEXT;
UPDATE "Event" SET "_mig_prev_category" = "category"::text WHERE "category" IS NOT NULL;

ALTER TABLE "Event" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Event" ALTER COLUMN "category" TYPE "EventCategory_new" USING (
  CASE "category"::text
    WHEN 'ARTS_CULTURE' THEN 'ART'::"EventCategory_new"
    WHEN 'MUSIC_NIGHTLIFE' THEN 'MUSIC'::"EventCategory_new"
    WHEN 'FOOD_DRINK' THEN 'FOOD_DRINK'::"EventCategory_new"
    WHEN 'FAMILY_KIDS' THEN 'FAMILY'::"EventCategory_new"
    WHEN 'SPORTS_OUTDOORS' THEN 'SPORTS'::"EventCategory_new"
    WHEN 'COMMUNITY_CAUSES' THEN 'COMMUNITY'::"EventCategory_new"
    WHEN 'LEARNING_TALKS' THEN 'TALKS'::"EventCategory_new"
    WHEN 'MARKETS_FAIRS' THEN 'MARKETS'::"EventCategory_new"
    WHEN 'ONLINE_VIRTUAL' THEN 'OTHER'::"EventCategory_new"
    ELSE NULL
  END
)::"EventCategory_new";

UPDATE "Event"
SET
  "customCategoryLabel" = LEFT(
    BTRIM(COALESCE(NULLIF(TRIM("customCategoryLabel"), ''), 'Online or virtual (legacy)')),
    40
  )
WHERE "_mig_prev_category" = 'ONLINE_VIRTUAL';

ALTER TABLE "Event" DROP COLUMN IF EXISTS "_mig_prev_category";

DROP TYPE "EventCategory";
ALTER TYPE "EventCategory_new" RENAME TO "EventCategory";

UPDATE "Event"
SET
  "category" = 'OTHER',
  "customCategoryLabel" = LEFT(
    BTRIM(COALESCE(NULLIF(TRIM("customCategoryLabel"), ''), 'Uncategorized (legacy)')),
    40
  )
WHERE "category" IS NULL;

ALTER TABLE "Event" ALTER COLUMN "category" SET NOT NULL;
