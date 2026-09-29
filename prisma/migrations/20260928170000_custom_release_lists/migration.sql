CREATE TABLE "release_lists" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "release_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "release_list_items" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "release_list_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "release_lists_name_key" ON "release_lists"("name");
CREATE UNIQUE INDEX "release_list_items_list_id_entity_id_key" ON "release_list_items"("list_id", "entity_id");
CREATE INDEX "release_list_items_entity_id_idx" ON "release_list_items"("entity_id");

ALTER TABLE "release_list_items" ADD CONSTRAINT "release_list_items_list_id_fkey"
    FOREIGN KEY ("list_id") REFERENCES "release_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "release_list_items" ADD CONSTRAINT "release_list_items_entity_id_fkey"
    FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
