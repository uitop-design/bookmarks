-- DropIndex
DROP INDEX "bookmarks_search_idx";

-- AlterTable
ALTER TABLE "bookmarks" DROP COLUMN "search";
ALTER TABLE "bookmarks" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', "title"), 'A') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('simple', "url" || ' ' || regexp_replace("url", '[^[:alnum:]]+', ' ', 'g')), 'C')
) STORED;

-- CreateIndex
CREATE INDEX "bookmarks_search_idx" ON "bookmarks" USING GIN ("search");
