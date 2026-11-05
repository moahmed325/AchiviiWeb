-- ND-40: Achivii Coach. One conversation per plan, deleted with the plan or the account.
CREATE TABLE "coach_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coach_messages_goalId_created_at_idx" ON "coach_messages"("goalId", "created_at");
CREATE INDEX "coach_messages_userId_created_at_idx" ON "coach_messages"("userId", "created_at");

ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
