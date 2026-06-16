// portals.js — Playwright-based scrapers for authenticated procurement portals
import { chromium } from 'playwright';

function parseDeadline(str) {
  if (!str) return null;
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00Z`;
}

function ittToRelease(itt, baseUrl) {
  return {
    ocid: itt.ittCode,
    id:   itt.ittCode,
    date: new Date().toISOString(),
    tag:  ['tender'],
    _url: `${baseUrl}/esop/toolkit/negotiation/joinRfq/list.si`,
    tender: {
      id:          itt.ittCode,
      title:       itt.title,
      description: `ITT code: ${itt.ittCode}. Project: ${itt.projectCode}.`,
      status:      'active',
      tenderPeriod: { endDate: parseDeadline(itt.deadline) },
    },
    parties: [{ name: itt.buyer || 'Government Commercial Agency', roles: ['buyer'] }],
    buyer:   { name: itt.buyer },
  };
}

// ── BravoSolution / JAGGAER ───────────────────────────────────────────────────
export async function* fetchBravoSolution(src) {
  const user = process.env.BRAVO_USER ?? '';
  const pass = process.env.BRAVO_PASS ?? '';
  if (!src.enabled || !user || !pass) return;

  const browser = await chromium.launch({ headless: true, args: ['--window-size=1280,900'] });
  try {
    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();

    // Login
    await page.goto(`${src.baseUrl}/web/login.html`);
    await page.fill('input[name="login"]', user);
    await page.fill('input[name="password"]', pass);
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 20000 }).catch(() => {}),
      page.click('input[name="submit"]'),
    ]);
    await page.waitForLoadState('networkidle');

    // Navigate to My ITTs via JS click (bypasses CSRF + viewport constraints)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {}),
      page.evaluate(() => {
        const l = [...document.querySelectorAll('a')].find(a => a.href.includes('joinRfq'));
        if (l) l.click();
      }),
    ]);
    await page.waitForTimeout(2000);

    // Paginate — list is ordered newest-first so stop when no running ITTs visible
    for (let pg = 0; pg < 10; pg++) {
      const itts = await page.$$eval('table tr', rows =>
        rows
          .map(r => {
            const cells = [...r.querySelectorAll('td')].map(td =>
              td.textContent.replace(/\s+/g, ' ').trim()
            );
            // Row structure (no row-number <td>): ittCode|title|projectCode|timeToClose|deadline|status|responseStatus|buyer
            if (cells.length < 7 || !cells[0]?.startsWith('itt_')) return null;
            return {
              ittCode:        cells[0],
              title:          cells[1],
              projectCode:    cells[2],
              deadline:       cells[4],
              status:         cells[5],
              responseStatus: cells[6],
              buyer:          cells[7] ?? '',
            };
          })
          .filter(Boolean)
      );

      for (const itt of itts) {
        if (itt.status === 'Running' && itt.responseStatus === 'Response Not Submitted To Buyer') {
          yield { release: ittToRelease(itt, src.baseUrl), source: src.label };
        }
      }

      // No running ITTs on this page → done
      if (!itts.some(i => i.status === 'Running')) break;

      const nextLink = await page.$('a[title="Next Page"]');
      if (!nextLink) break;
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
        nextLink.click(),
      ]);
      await page.waitForTimeout(1500);
    }
  } finally {
    await browser.close();
  }
}
