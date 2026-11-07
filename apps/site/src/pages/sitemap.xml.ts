import { ARTICLES } from '../content/articles';

const PAGES = [
  '/',
  '/junior/',
  '/hotel-spil/',
  '/dansk-chatrum/',
  '/artikler/',
  ...ARTICLES.map((a) => `/artikler/${a.slug}/`),
  '/saadan-spiller-du/',
  '/nyheder/',
  '/spoergsmaal/',
  '/slet-konto/',
  '/vilkaar/',
  '/privatliv/',
  '/junior/privatliv/',
];

export function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((p) => `  <url><loc>https://lobbi.dk${p}</loc></url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
