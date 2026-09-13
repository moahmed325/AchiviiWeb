import { prisma } from '../src/lib/prisma.js';

async function testCommit() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@achivii.com', password: 'Password123!' }),
  });
  console.log('LOGIN STATUS:', loginRes.status);
  const loginText = await loginRes.text();
  console.log('LOGIN TEXT:', loginText.slice(0, 300));
  const { token, user } = JSON.parse(loginText);
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const catRes = await fetch('http://localhost:5000/api/catalog', { headers });
  const catData = await catRes.json();
  const catalog = catData.goals || [];
  const bp = catalog.find((g: any) => g.title?.includes('SaaS MVP')) || catalog[0];
  console.log('SELECTED BLUEPRINT:', bp.title, bp.id);

  const commitRes = await fetch('http://localhost:5000/api/adaptive/goal/commit', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      goalCatalogId: bp.id,
      outcomeStatement: 'Build and Launch SaaS MVP',
      questionnaireAnswers: { exp: 'intermediate' },
      sustainableWeeklyHours: 8.0,
      targetDeadline: new Date(Date.now() + 90 * 86400000).toISOString(),
    }),
  });

  console.log('STATUS:', commitRes.status);
  const text = await commitRes.text();
  console.log('RESPONSE TEXT:', text);
}

testCommit().catch(console.error);
