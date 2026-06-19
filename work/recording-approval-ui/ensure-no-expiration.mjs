import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  }),
);

const recordingsPath =
  args.recordings ??
  path.resolve("outputs/recording-approval-ui/data/recordings.json");
const profileDir =
  args.profile ??
  path.resolve("work/recording-approval-ui/playwright-profile");
const limit = Number(args.limit ?? "0");

const recordingsData = JSON.parse(readJsonFile(recordingsPath));
const queue = (limit > 0 ? recordingsData.recordings.slice(0, limit) : recordingsData.recordings)
  .filter((item) => item.sourceUrl);

console.log(`Expiration candidates: ${queue.length}`);

fs.mkdirSync(profileDir, { recursive: true });

const context = await chromium.launchPersistentContext(profileDir, {
  channel: "msedge",
  headless: false,
});

const page = context.pages()[0] ?? (await context.newPage());
const results = [];

for (const item of queue) {
  try {
    if (!isAllowedStreamUrl(item.sourceUrl)) {
      results.push(resultRow(item.name, "invalid-source-url", "", "Source URL is not an allowed SharePoint Stream URL."));
      continue;
    }

    console.log(`Opening: ${item.name}`);
    await page.goto(item.sourceUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2500);
    await ensureSignedIn(page);
    await page.waitForTimeout(1500);

    const expiryState = await getExpiryState(page);
    if (expiryState.status === "no-expiration") {
      results.push(resultRow(item.name, "already-safe", expiryState.label));
      continue;
    }

    if (expiryState.status !== "expires") {
      results.push(resultRow(item.name, "unknown", "", "Expiration badge was not found."));
      continue;
    }

    await expiryState.locator.click({ timeout: 10000 });
    await page.waitForTimeout(800);

    const removeExpiration = page.getByRole("option", { name: /Remove expiration/i }).first();
    await removeExpiration.click({ timeout: 10000 });
    await page.waitForTimeout(1500);

    const nextState = await getExpiryState(page);
    if (nextState.status === "no-expiration") {
      results.push(resultRow(item.name, "removed-expiration", expiryState.label));
      continue;
    }

    results.push(resultRow(item.name, "failed", expiryState.label, "Remove expiration was clicked but No expiration did not appear."));
  } catch (error) {
    results.push(resultRow(item.name, "failed", "", String(error)));
  }
}

await context.close();

const summaryPath = path.join(
  path.dirname(recordingsPath),
  `expiration-results-${dateStamp()}.json`,
);
fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));

console.log(`Saved results: ${summaryPath}`);
console.log(
  JSON.stringify(
    results.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {}),
    null,
    2,
  ),
);

function resultRow(name, status, expiryLabel, error = "") {
  return { name, status, expiryLabel, error };
}

function dateStamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
}

function readJsonFile(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function isAllowedStreamUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      /sharepoint\.com$/i.test(url.hostname) &&
      /\/_layouts\/15\/stream\.aspx$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

async function getExpiryState(page) {
  const pageText = await page.locator("body").textContent().catch(() => "");
  if (/No expiration/i.test(pageText || "")) {
    return { status: "no-expiration", label: "No expiration", locator: null };
  }
  const expiresTextMatch = (pageText || "").match(/Expires in \d+ days/i);
  if (expiresTextMatch) {
    const expiresText = page.getByText(/Expires in \d+ days/i).first();
    if (await expiresText.isVisible().catch(() => false)) {
      const label =
        ((await expiresText.getAttribute("aria-label").catch(() => "")) ||
          (await expiresText.textContent().catch(() => "")) ||
          expiresTextMatch[0] ||
          "").trim();
      return { status: "expires", label, locator: expiresText };
    }
  }

  const noExpirationText = page.getByText(/^No expiration$/i).first();
  if (await noExpirationText.isVisible().catch(() => false)) {
    return { status: "no-expiration", label: "No expiration", locator: noExpirationText };
  }
  const noExpirationAria = page.locator('[aria-label*="No expiration"]').first();
  if (await noExpirationAria.isVisible().catch(() => false)) {
    return { status: "no-expiration", label: "No expiration", locator: noExpirationAria };
  }

  const expiresText = page.getByText(/Expires in \d+ days/i).first();
  if (await expiresText.isVisible().catch(() => false)) {
    const label =
      ((await expiresText.getAttribute("aria-label").catch(() => "")) ||
        (await expiresText.textContent().catch(() => "")) ||
        "").trim();
    return { status: "expires", label, locator: expiresText };
  }

  const expiresAria = page.locator('[aria-label*="Expires in "]').first();
  if (await expiresAria.isVisible().catch(() => false)) {
    const label =
      ((await expiresAria.getAttribute("aria-label").catch(() => "")) ||
        (await expiresAria.textContent().catch(() => "")) ||
        "").trim();
    return { status: "expires", label, locator: expiresAria };
  }

  return { status: "unknown", label: "", locator: null };
}

async function ensureSignedIn(page) {
  const signInButton = page.getByRole("button", { name: /sign in/i }).first();
  const signInLink = page.getByRole("link", { name: /sign in/i }).first();

  const needsSignIn =
    (await signInButton.isVisible().catch(() => false)) ||
    (await signInLink.isVisible().catch(() => false));

  if (!needsSignIn) return;

  console.log("Microsoft sign-in required in the automation browser. Please sign in there once; the script will continue automatically.");
  await page.waitForFunction(
    () => {
      const candidates = Array.from(document.querySelectorAll("button, a"));
      return !candidates.some((el) => /sign in/i.test((el.textContent || "").trim()));
    },
    { timeout: 0 },
  );
}
