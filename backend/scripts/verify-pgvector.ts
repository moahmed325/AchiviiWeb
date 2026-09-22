import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

/**
 * Confirms the pgvector pieces the Stage 1.5 resolver depends on actually exist in the
 * live database, rather than trusting that the migration reported success.
 */
async function main() {
  const extension = await prisma.$queryRaw<Array<{ extversion: string }>>`
    SELECT extversion FROM pg_extension WHERE extname = 'vector'
  `;
  console.log(
    extension.length
      ? `[ok] pgvector extension installed, version ${extension[0].extversion}`
      : '[FAIL] pgvector extension is NOT installed'
  );

  const column = await prisma.$queryRaw<Array<{ data_type: string; udt_name: string }>>`
    SELECT data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'research_cache' AND column_name = 'outcomeEmbedding'
  `;
  console.log(
    column.length && column[0].udt_name === 'vector'
      ? `[ok] outcomeEmbedding is a real vector column (udt_name=${column[0].udt_name})`
      : `[FAIL] outcomeEmbedding is ${JSON.stringify(column)}`
  );

  const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'research_cache'
  `;
  const hasHnsw = indexes.some((i) => i.indexdef.toLowerCase().includes('hnsw'));
  const hasGin = indexes.some((i) => i.indexdef.toLowerCase().includes('gin'));
  console.log(hasHnsw ? '[ok] HNSW vector index present' : '[FAIL] HNSW vector index missing');
  console.log(hasGin ? '[ok] GIN rawInputs index present' : '[FAIL] GIN rawInputs index missing');

  // Prove the <=> cosine operator works end to end on a 768-dim value.
  const probe = new Array(768).fill(0).map((_, i) => Math.sin(i * 0.05));
  const literal = `[${probe.join(',')}]`;
  const distance = await prisma.$queryRaw<Array<{ d: number }>>`
    SELECT ${literal}::vector <=> ${literal}::vector AS d
  `;
  console.log(
    Number(distance[0].d) < 1e-6
      ? '[ok] cosine operator <=> returns 0 distance for identical vectors'
      : `[FAIL] unexpected distance ${distance[0].d}`
  );

  // On a near-empty table a sequential scan is genuinely cheapest, so the planner's
  // *preference* says nothing useful. Disabling seqscan tests what actually matters:
  // whether each query shape is CAPABLE of using its index. Both queries below are
  // written to match their index expressions exactly — Postgres only applies an
  // expression index when the expression matches, which is easy to break by accident.
  await prisma.$executeRawUnsafe('SET enable_seqscan = off');

  const elide = (s: string) => s.replace(/'\[[-0-9.,e]+\]'/g, "'[...768 dims...]'");

  const plan = await prisma.$queryRaw<Array<{ 'QUERY PLAN': string }>>`
    EXPLAIN SELECT id FROM "research_cache"
    WHERE "outcomeEmbedding" IS NOT NULL
    ORDER BY "outcomeEmbedding" <=> ${literal}::vector
    LIMIT 1
  `;
  const planText = plan.map((r) => r['QUERY PLAN']).join('\n');
  console.log(
    planText.includes('research_cache_outcome_embedding_idx')
      ? '[ok] Tier 2 nearest-neighbour query can use the HNSW vector index'
      : '[FAIL] Tier 2 query cannot use the vector index:\n' + elide(planText)
  );

  // Guards against the resolver drifting back to Prisma's array_contains, which compiles
  // to a "#>...::jsonb" form that cannot use this index and silently scans every row.
  const tier0Plan = await prisma.$queryRaw<Array<{ 'QUERY PLAN': string }>>`
    EXPLAIN SELECT "id" FROM "research_cache"
    WHERE "canonicalMethod" -> 'rawInputs' @> '"probe"'::jsonb
    LIMIT 1
  `;
  const tier0Text = tier0Plan.map((r) => r['QUERY PLAN']).join('\n');
  console.log(
    tier0Text.includes('research_cache_raw_inputs_idx')
      ? '[ok] Tier 0 containment query can use the GIN index'
      : '[FAIL] Tier 0 query cannot use the GIN index:\n' + tier0Text
  );

  console.log('\n--- Tier 2 query plan (vector literal elided) ---');
  plan.forEach((r) => console.log('  ' + elide(r['QUERY PLAN'])));
}

main()
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
