-- Steps are built from typed work blocks (action, output, proof), not one drill with a dose.
ALTER TABLE "goals" RENAME COLUMN "drills" TO "workBlocks";
