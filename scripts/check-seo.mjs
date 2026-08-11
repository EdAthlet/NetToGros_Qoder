import { readFile } from 'node:fs/promises';

const origin = 'https://nettogross-eire.com';
const publicPages = [
  ['index.html', `${origin}/`],
  ['payroll/index.html', `${origin}/payroll/`],
  ['batch/index.html', `${origin}/batch/`],
  ['Pensions/index.html', `${origin}/pensions/`],
  ['tools/annualised-paye/index.html', `${origin}/tools/annualised-paye/`],
  ['tax-credits/index.html', `${origin}/tax-credits/`],
];

const errors = [];

for (const [file, canonical] of publicPages) {
  const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const visibleHtml = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const head = visibleHtml.match(/<head>[\s\S]*?<\/head>/i)?.[0] || '';
  const checks = [
    ['one title', (head.match(/<title>[^<]+<\/title>/gi) || []).length === 1],
    ['meta description', /<meta\s+name="description"\s+content="[^"]+"/i.test(html)],
    ['indexable robots tag', /<meta\s+name="robots"\s+content="index, follow"/i.test(html)],
    ['canonical URL', html.includes(`<link rel="canonical" href="${canonical}">`)],
    ['one visible H1', (visibleHtml.match(/<h1(?:\s[^>]*)?>/gi) || []).length === 1],
    ['Open Graph title', /<meta\s+property="og:title"/i.test(html)],
    ['Open Graph URL', html.includes(`<meta property="og:url" content="${canonical}">`)],
    ['JSON-LD', /<script\s+type="application\/ld\+json">/i.test(html)],
  ];

  for (const [label, passed] of checks) {
    if (!passed) errors.push(`${file}: missing or invalid ${label}`);
  }
}

const sitemap = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');
for (const [, canonical] of publicPages) {
  if (!sitemap.includes(`<loc>${canonical}</loc>`)) {
    errors.push(`sitemap.xml: missing ${canonical}`);
  }
}

if (sitemap.includes('/about.html')) errors.push('sitemap.xml: contains dead /about.html URL');
if (sitemap.includes('/Pensions/')) errors.push('sitemap.xml: contains non-canonical /Pensions/ URL');


const trackedSupportPages = ['contact.html', 'contact-success.html'];
for (const file of trackedSupportPages) {
  const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  if (!html.includes('/js/analytics.js') || !html.includes('G-PK9CJF6TF2')) {
    errors.push(`${file}: missing GA4 analytics loader`);
  }
}

const fakeRevenue = await readFile(
  new URL('../tools/fake-revenue/index.html', import.meta.url),
  'utf8'
);
if (fakeRevenue.includes('G-PK9CJF6TF2') || fakeRevenue.includes('/js/analytics.js')) {
  errors.push('tools/fake-revenue/index.html: internal test tool must remain untracked');
}

if (errors.length) {
  console.error(`SEO check failed:\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`SEO check passed for ${publicPages.length} indexable pages.`);
}
