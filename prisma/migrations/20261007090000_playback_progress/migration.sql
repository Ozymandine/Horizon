CREATE TABLE "playback_progress" (
  "key" VARCHAR(100) NOT NULL,
  "type" VARCHAR(8) NOT NULL,
  "tmdb_id" INTEGER NOT NULL,
  "season" INTEGER NOT NULL DEFAULT 0,
  "episode" INTEGER NOT NULL DEFAULT 0,
  "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "duration" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "title" VARCHAR(240) NOT NULL,
  "poster_url" TEXT,
  "backdrop_url" TEXT,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "playback_id" VARCHAR(80) NOT NULL,
  "session_started_at" TIMESTAMPTZ(3) NOT NULL,
  "recorded_at" TIMESTAMPTZ(3) NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "playback_progress_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "playback_progress_type_check" CHECK ("type" IN ('movie', 'show')),
  CONSTRAINT "playback_progress_time_check" CHECK ("position" >= 0 AND "duration" >= 0)
);

CREATE INDEX "playback_progress_type_updated_at_idx" ON "playback_progress"("type", "updated_at" DESC);
CREATE INDEX "playback_progress_type_tmdb_id_updated_at_idx" ON "playback_progress"("type", "tmdb_id", "updated_at" DESC);
