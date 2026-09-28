-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('MOVIE', 'SHOW', 'GAME', 'MUSIC', 'EVENT');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('UPCOMING', 'RELEASED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('OFFICIAL', 'CREDIBLE_LEAK', 'INDUSTRY_RUMOR', 'SPECULATIVE');

-- CreateEnum
CREATE TYPE "ReleasePrecision" AS ENUM ('EXACT_TIMESTAMP', 'EXACT_DATE', 'MONTH', 'QUARTER', 'SEASON', 'YEAR', 'TBD');

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('CONCERT', 'TOUR_DATE', 'MERCH_DROP', 'OTHER');

-- CreateEnum
CREATE TYPE "PartKind" AS ENUM ('EPISODE', 'TRACK');

-- CreateEnum
CREATE TYPE "CreditRole" AS ENUM ('ACTOR', 'VOICE_ACTOR', 'DIRECTOR', 'WRITER', 'ARTIST', 'DEVELOPER', 'OTHER');

-- CreateEnum
CREATE TYPE "EntityMediaKind" AS ENUM ('TRAILER', 'CLIP', 'STREAMING_PROVIDER', 'OFFICIAL_SITE', 'OTHER');

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "type" "EntityType" NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'UPCOMING',
    "confidence_level" "ConfidenceLevel" NOT NULL DEFAULT 'OFFICIAL',
    "poster_url" TEXT,
    "backdrop_url" TEXT,
    "description" TEXT,
    "external_url" TEXT,
    "display_date" VARCHAR(120) NOT NULL DEFAULT 'TBA',
    "release_precision" "ReleasePrecision" NOT NULL DEFAULT 'TBD',
    "sort_timestamp" TIMESTAMPTZ(3),
    "date_end" TIMESTAMPTZ(3),
    "is_approximate" BOOLEAN NOT NULL DEFAULT false,
    "release_timezone" VARCHAR(64),
    "tmdb_id" INTEGER,
    "igdb_id" INTEGER,
    "event_kind" "EventKind",
    "is_tracked" BOOLEAN NOT NULL DEFAULT true,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodes_or_tracks" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "kind" "PartKind" NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "season_num" INTEGER,
    "episode_num" INTEGER,
    "track_num" INTEGER,
    "air_date" TIMESTAMPTZ(3),
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "episodes_or_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_details" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "venue" VARCHAR(240),
    "city" VARCHAR(160),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "drop_url" TEXT,
    "event_time" TIMESTAMPTZ(3),
    "timezone" VARCHAR(64),

    CONSTRAINT "event_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_credits" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "role" "CreditRole" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "character_name" VARCHAR(200),
    "image_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "entity_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_media" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "kind" "EntityMediaKind" NOT NULL,
    "title" VARCHAR(240),
    "provider" VARCHAR(120),
    "url" TEXT NOT NULL,
    "embed_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "entity_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entities_igdb_id_key" ON "entities"("igdb_id");

-- CreateIndex
CREATE INDEX "entities_is_tracked_status_sort_timestamp_idx" ON "entities"("is_tracked", "status", "sort_timestamp");

-- CreateIndex
CREATE INDEX "entities_type_status_sort_timestamp_idx" ON "entities"("type", "status", "sort_timestamp");

-- CreateIndex
CREATE INDEX "entities_is_completed_sort_timestamp_idx" ON "entities"("is_completed", "sort_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "entities_tmdb_id_type_key" ON "entities"("tmdb_id", "type");

-- CreateIndex
CREATE INDEX "episodes_or_tracks_entity_id_season_num_episode_num_idx" ON "episodes_or_tracks"("entity_id", "season_num", "episode_num");

-- CreateIndex
CREATE INDEX "episodes_or_tracks_entity_id_track_num_idx" ON "episodes_or_tracks"("entity_id", "track_num");

-- CreateIndex
CREATE INDEX "event_details_entity_id_event_time_idx" ON "event_details"("entity_id", "event_time");

-- CreateIndex
CREATE INDEX "event_details_city_idx" ON "event_details"("city");

-- CreateIndex
CREATE INDEX "entity_credits_entity_id_role_sort_order_idx" ON "entity_credits"("entity_id", "role", "sort_order");

-- CreateIndex
CREATE INDEX "entity_media_entity_id_kind_sort_order_idx" ON "entity_media"("entity_id", "kind", "sort_order");

-- AddForeignKey
ALTER TABLE "episodes_or_tracks" ADD CONSTRAINT "episodes_or_tracks_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_details" ADD CONSTRAINT "event_details_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_credits" ADD CONSTRAINT "entity_credits_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_media" ADD CONSTRAINT "entity_media_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
