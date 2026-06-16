// portals.js — Playwright-based scrapers for authenticated procurement portals
import { chromium } from 'playwright';

function parseDeadline(str) {
  if (!str) return null;
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00Z`;
}

// Content-based row parser — works across portal variants with 7 or 8 columns
function parseIttRow(cells) {
  const ittCode = cells.find(c => /^itt_/.test(c));
  if (!ittCode) return null;
  const ittIdx = cells.indexOf(ittCode);
  const title = cells[ittIdx + 1] ?? '';
  const projectCode = cells.find(c => /^project_/.test(c)) ?? '';
  const deadline = cells.find(c => /^\d{2}\/\d{2}\/\d{4}/.test(c)) ?? '';
  const STATUS_PREFIXES = ['Running', 'Closed', 'Pending', 'Suspended', 'Cancelled', 'Completed', 'Draft'];
  const status = cells.find(c => STATUS_PREFIXES.some(s => c.startsWith(s))) ?? '';
  const RESPONSE_PREFIXES = ['Response Not Submitted', 'Response Submitted', 'Invited', 'Declined', 'Qualified'];
  const responseStatus = cells.find(c => RESPONSE_PREFIXES.some(s => c.startsWith(s))) ?? '';
  const buyer = cells[cells.length - 1] ?? '';
  return { ittCode, title, projectCode, deadline, status, responseStatus, buyer };
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
    parties: [{ name: itt.buyer || 'Unknown', roles: ['buyer'] }],
    buyer:   { name: itt.buyer },
  };
}

// ── BravoSolution / JAGGAER ───────────────────────────────────────────────────
// Works for all *.bravosolution.co.uk and *.jaggaer.com supplier portals that
// share the same /web/login.html + joinRfq/list.si structure.
export async function* fetchBravoSolution(src) {
  const user = process.env[src.userEnv ?? 'BRAVO_USER'] ?? '';
  const pass = process.env[src.passEnv ?? 'BRAVO_PASS'] ?? '';
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
      // Some portals use name="submit", others have no name on the submit button
      page.click('input[type="submit"]'),
    ]);
    await page.waitForLoadState('networkidle');

    // Navigate to My ITTs — try joinRfq link first, then /rfq/my fallback
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {}),
      page.evaluate(() => {
        const byJoinRfq = [...document.querySelectorAll('a')].find(a => a.href.includes('joinRfq'));
        if (byJoinRfq) { byJoinRfq.click(); return; }
        const byRfqMy = [...document.querySelectorAll('a')].find(a => a.href.includes('/rfq/my'));
        if (byRfqMy) byRfqMy.click();
      }),
    ]);
    await page.waitForTimeout(2000);

    // Paginate through ITT list
    for (let pg = 0; pg < 10; pg++) {
      const rows = await page.$$eval('table tr', trs =>
        trs.map(r =>
          [...r.querySelectorAll('td')].map(td => td.textContent.replace(/\s+/g, ' ').trim())
        )
      );

      const itts = rows.map(parseIttRow).filter(Boolean);
      let foundRunning = false;

      for (const itt of itts) {
        if (itt.status === 'Running' && itt.responseStatus.startsWith('Response Not Submitted')) {
          foundRunning = true;
          yield { release: ittToRelease(itt, src.baseUrl), source: src.label };
        } else if (itt.status === 'Running') {
          foundRunning = true;
        }
      }

      if (!foundRunning) break;

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
