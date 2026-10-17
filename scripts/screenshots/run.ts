/**
 * Screenshot runner (CLAUDE.md > Screenshots).
 *
 *   npm run screenshots              exports the web build and captures every route in screens.json
 *   npm run screenshots -- --no-export  reuses dist-screens/ from a previous export
 *
 * Signed-in routes (`auth: "host"`) need a running local Supabase stack plus SUPABASE_SERVICE_ROLE_KEY and
 * EXPO_PUBLIC_SUPABASE_URL in the environment: the runner asks the auth admin API for a one-time code for
 * a throwaway user and types it into the real sign-in flow. No auth bypass exists in the app.
 */
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';

type Size = { name: string; width: number; height: number };
type Screen = { slug: string; path: string; auth: 'none' | 'host'; waitFor: string };
type Config = { sizes: Size[]; screens: Screen[] };

const ROOT = resolve(__dirname, '..', '..');
const DIST = join(ROOT, 'dist-screens');
const OUT = join(ROOT, 'docs', 'screenshots');
const PORT = 8089;
const config: Config = JSON.parse(readFileSync(join(__dirname, 'screens.json'), 'utf8'));
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function exportWeb() {
  console.log('▶ expo export --platform web');
  execSync(`npx expo export --platform web --output-dir ${DIST}`, { cwd: ROOT, stdio: 'inherit' });
}

function serve() {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    let file = join(DIST, decodeURIComponent(url.pathname));
    if (!existsSync(file) || statSync(file).isDirectory()) {
      const html = join(DIST, `${url.pathname.replace(/\/$/, '') || '/index'}.html`);
      file = existsSync(html) ? html : join(DIST, 'index.html');
    }
    res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(res);
  }).listen(PORT);
}

async function emailOtpForHost(): Promise<{ email: string; otp: string }> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      'auth:"host" screens need EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    );
  const email = `screenshot-host-${Date.now()}@example.com`;
  const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  if (!res.ok) throw new Error(`generate_link failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { email_otp?: string };
  if (!data.email_otp) throw new Error('generate_link returned no email_otp');
  return { email, otp: data.email_otp };
}

async function signInAsHost(page: Page) {
  const { email, otp } = await emailOtpForHost();
  await page.goto(`http://localhost:${PORT}/sign-in`);
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('button-send-code').click();
  await page.getByTestId('input-code').fill(otp);
  await page.getByTestId('button-verify').click();
  await page.waitForSelector('[data-testid="screen-home"]', { timeout: 20_000 });
}

async function capture(browser: Browser, screen: Screen, size: Size, signedIn: boolean) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    storageState: signedIn ? join(DIST, 'host-state.json') : undefined,
  });
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}${screen.path}`);
  await page.waitForSelector(screen.waitFor, { timeout: 20_000 });
  await page.waitForTimeout(300);
  const file = join(OUT, `${screen.slug}.${size.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('  wrote', file);
  await context.close();
}

async function main() {
  const noExport = process.argv.includes('--no-export');
  if (!noExport || !existsSync(DIST)) exportWeb();
  mkdirSync(OUT, { recursive: true });
  const server = serve();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  let failed = 0;
  try {
    const needsHost = config.screens.some((s) => s.auth === 'host');
    let hostReady = false;
    if (needsHost && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      await signInAsHost(page);
      await ctx.storageState({ path: join(DIST, 'host-state.json') });
      await ctx.close();
      hostReady = true;
    }
    for (const screen of config.screens) {
      if (screen.auth === 'host' && !hostReady) {
        console.warn(
          `  skip ${screen.slug}: no local Supabase service role key (set SUPABASE_SERVICE_ROLE_KEY)`,
        );
        continue;
      }
      for (const size of config.sizes) {
        try {
          await capture(browser, screen, size, screen.auth === 'host');
        } catch (e) {
          failed++;
          console.error(
            `  FAILED ${screen.slug} @${size.name}:`,
            e instanceof Error ? e.message : e,
          );
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) process.exit(1);
}

void main();
