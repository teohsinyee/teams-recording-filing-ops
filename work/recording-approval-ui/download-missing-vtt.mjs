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
  "C:\\Users\\sinyee\\Documents\\Codex\\2026-06-18\\c-users-sinyee-onedrive-avnet-recordings\\outputs\\recording-approval-ui\\data\\recordings.json";
const approvalsPath = args.approvals ?? "";
const profileDir =
  args.profile ??
  "C:\\Users\\sinyee\\Documents\\Codex\\2026-06-18\\c-users-sinyee-onedrive-avnet-recordings\\work\\recording-approval-ui\\playwright-profile";
const limit = Number(args.limit ?? "0");

const recordingsData = JSON.parse(fs.readFileSync(recordingsPath, "utf8"));
const approvalsData =
  approvalsPath && fs.existsSync(approvalsPath)
    ? JSON.parse(fs.readFileSync(approvalsPath, "utf8"))
    : null;

const approvalMap = new Map(
  (approvalsData?.approvals ?? []).map((item) => [item.name, item]),
);
const destinationMap = new Map(
  (recordingsData.destinations ?? []).map((item) => [item.id, item.path]),
);

const candidates = recordingsData.recordings
  .filter((item) => !item.vttFound && item.sourceUrl)
  .map((item) => ({ ...item, approval: approvalMap.get(item.name) ?? null }))
  .filter((item) => resolveTargetVttPath(item));

const queue = limit > 0 ? candidates.slice(0, limit) : candidates;

console.log(`Missing VTT candidates: ${candidates.length}`);
console.log(`Processing: ${queue.length}`);

fs.mkdirSync(profileDir, { recursive: true });

const context = await chromium.launchPersistentContext(profileDir, {
  channel: "msedge",
  headless: false,
  acceptDownloads: true,
});

const page = context.pages()[0] ?? (await context.newPage());
const results = [];

for (const item of queue) {
  const targetVttPath = resolveTargetVttPath(item);
  const targetDir = path.dirname(targetVttPath);
  fs.mkdirSync(targetDir, { recursive: true });

  if (fs.existsSync(targetVttPath)) {
    results.push(resultRow(item.name, "already-exists", targetVttPath));
    continue;
  }

  try {
    console.log(`Opening: ${item.name}`);
    await page.goto(item.sourceUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2500);
    await ensureSignedIn(page);
    await page.waitForTimeout(1500);

    await openTranscript(page);
    await page.waitForTimeout(1200);

    const downloadButton = page.getByRole("button", { name: /^Download$/i }).first();
    await downloadButton.click({ timeout: 15000 });

    const menuItem = page.getByText(/Download as \.vtt/i).first();
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30000 }),
      menuItem.click({ timeout: 15000 }),
    ]);

    await download.saveAs(targetVttPath);
    results.push(resultRow(item.name, "downloaded", targetVttPath));
  } catch (error) {
    results.push(resultRow(item.name, "failed", targetVttPath, String(error)));
  }
}

await context.close();

const summaryPath = path.join(
  path.dirname(recordingsPath),
  `vtt-download-results-${dateStamp()}.json`,
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

function resolveTargetVttPath(item) {
  const copiedMp4Path = item.copiedMp4?.path ?? "";
  if (copiedMp4Path) {
    return replacePathExtension(copiedMp4Path, ".vtt");
  }

  const approvalDestinationId =
    item.approval && item.approval.approved && !item.approval.skipCopy
      ? item.approval.destinationId
      : "";
  const fallbackDestinationId =
    approvalDestinationId || item.suggestedDestinationId || "";
  const destinationDir = destinationMap.get(fallbackDestinationId);
  if (!destinationDir) return "";
  return path.join(destinationDir, replaceFileExtension(item.suggestedNewName, ".vtt"));
}

async function openTranscript(page) {
  const transcriptRailButton = page.getByRole("button", { name: /^Transcript$/i }).first();
  if (await transcriptRailButton.isVisible().catch(() => false)) {
    await transcriptRailButton.click({ timeout: 10000 });
    return;
  }

  const transcriptReadButton = page.getByText(/Read transcript/i).first();
  if (await transcriptReadButton.isVisible().catch(() => false)) {
    await transcriptReadButton.click({ timeout: 10000 });
    return;
  }

  const panelDownloadButton = page.getByRole("button", { name: /^Download$/i }).first();
  if (await panelDownloadButton.isVisible().catch(() => false)) {
    return;
  }

  throw new Error("Transcript panel could not be opened");
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

function replaceFileExtension(fileName, nextExtension) {
  return `${path.basename(fileName, path.extname(fileName))}${nextExtension}`;
}

function replacePathExtension(fullPath, nextExtension) {
  const parsed = path.parse(fullPath);
  return path.join(parsed.dir, `${parsed.name}${nextExtension}`);
}

function resultRow(name, status, targetPath, error = "") {
  return { name, status, targetPath, error };
}

function dateStamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
}
