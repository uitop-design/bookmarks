-- CreateEnum
CREATE TYPE "metadata_status" AS ENUM ('PENDING', 'OK', 'FAILED');

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "url" VARCHAR(2048) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "site_name" VARCHAR(200),
    "favicon_url" VARCHAR(2048),
    "metadata_status" "metadata_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "search" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', "title"), 'A') ||
        setweight(to_tsvector('simple', coalesce("description", '')), 'B') ||
        setweight(to_tsvector('simple', "url"), 'C')
    ) STORED,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(24) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmark_tags" (
    "bookmark_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "bookmark_tags_pkey" PRIMARY KEY ("bookmark_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_url_key" ON "bookmarks"("url");

-- CreateIndex
CREATE INDEX "bookmarks_created_at_id_idx" ON "bookmarks"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "bookmarks_search_idx" ON "bookmarks" USING GIN ("search");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "bookmark_tags_tag_id_idx" ON "bookmark_tags"("tag_id");

-- AddForeignKey
ALTER TABLE "bookmark_tags" ADD CONSTRAINT "bookmark_tags_bookmark_id_fkey" FOREIGN KEY ("bookmark_id") REFERENCES "bookmarks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmark_tags" ADD CONSTRAINT "bookmark_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

