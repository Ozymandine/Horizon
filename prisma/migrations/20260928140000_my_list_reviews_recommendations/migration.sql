-- AlterTable
ALTER TABLE "entities" ADD COLUMN     "genre_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "source" VARCHAR(40),
ADD COLUMN     "source_id" VARCHAR(160);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_entity_id_key" ON "reviews"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "entities_source_source_id_key" ON "entities"("source", "source_id");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
