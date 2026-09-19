import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tavilySearch, tavilyExtract } from '../src/lib/tavily.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runTest() {
  console.log('================================================================');
  console.log('🔍 Golden Rail Pipeline — Tavily Wrapper Integration Test');
  console.log('================================================================\n');

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'placeholder') {
    console.error('❌ Error: TAVILY_API_KEY is not configured in backend/.env');
    console.error('Please define TAVILY_API_KEY in your environment or backend/.env file to run this test.');
    process.exit(1);
  }

  const sampleQuery = 'Jack Daniels VDOT running formula 10k training methodology';
  console.log(`[1/2] Calling Tavily search endpoint for query: "${sampleQuery}"...\n`);

  const searchStartTime = Date.now();
  const searchResponse = await tavilySearch(sampleQuery, {
    maxResults: 3,
    searchDepth: 'basic',
  });
  const searchDurationMs = Date.now() - searchStartTime;

  console.log(`✅ Search completed in ${searchDurationMs}ms (API response_time: ${searchResponse.response_time}s)`);
  console.log('\n--- RAW TAVILY SEARCH RESULT SHAPE ---');
  console.log(JSON.stringify(searchResponse, null, 2));

  if (!searchResponse.results || searchResponse.results.length === 0) {
    console.warn('⚠️ No search results returned to test extract endpoint.');
    return;
  }

  const targetUrl = searchResponse.results[0].url;
  console.log(`\n[2/2] Calling Tavily extract endpoint for top URL: ${targetUrl}...\n`);

  const extractStartTime = Date.now();
  const extractResponse = await tavilyExtract([targetUrl]);
  const extractDurationMs = Date.now() - extractStartTime;

  console.log(`✅ Extract completed in ${extractDurationMs}ms (API response_time: ${extractResponse.response_time}s)`);
  console.log('\n--- RAW TAVILY EXTRACT RESULT SHAPE ---');
  // Truncate raw_content slightly in preview if very long to avoid terminal buffer overflow while preserving shape
  const previewExtract = {
    ...extractResponse,
    results: extractResponse.results?.map((r) => ({
      url: r.url,
      raw_content_preview:
        r.raw_content && r.raw_content.length > 500
          ? `${r.raw_content.substring(0, 500)}... [truncated, total length: ${r.raw_content.length} chars]`
          : r.raw_content,
      raw_content_length: r.raw_content ? r.raw_content.length : 0,
    })),
  };
  console.log(JSON.stringify(previewExtract, null, 2));

  console.log('\n================================================================');
  console.log('🎉 Tavily search + extract verified successfully!');
  console.log('================================================================');
}

runTest().catch((err) => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
