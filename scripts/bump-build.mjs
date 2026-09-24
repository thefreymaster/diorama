#!/usr/bin/env node
// npm run bump                      → next build number (ios.buildNumber + 1)
// npm run bump -- --version 1.1.0   → new version, build number back to 1
//
// App Store Connect rejects a build number it has already seen for a
// version, so bump before every upload. Only the changed values in
// app.json are rewritten; its formatting stays as it is.
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const APP_JSON = new URL('../app.json', import.meta.url);
const USAGE = 'Usage: npm run bump [-- --version x.y.z]';

function fail(message) {
  console.error(`bump failed: ${message}`);
  process.exit(1);
}

/** Apple's version format: one to three dot-separated integers. */
const VERSION_PATTERN = /^\d+(\.\d+){0,2}$/;

/** Compares 1.2 and 1.2.0 as equal, like App Store Connect. */
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function parseArgs(args) {
  if (args.length === 0) return { version: undefined };
  if (args.length === 2 && args[0] === '--version') return { version: args[1] };
  if (args.length === 1 && args[0].startsWith('--version=')) {
    return { version: args[0].slice('--version='.length) };
  }
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
  }
  return fail(`unexpected arguments: ${args.join(' ')}\n${USAGE}`);
}

/**
 * Rewrites one `"key": "value"` string in the JSON text, keeping every other
 * character. It tries each occurrence and keeps the one that turns the parsed
 * file into `expected`, so a same-named key elsewhere is never touched.
 */
function replaceString(text, key, from, to, expected) {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`("${key}"\\s*:\\s*)"${escaped}"`, 'g');
  for (const match of text.matchAll(pattern)) {
    const candidate =
      text.slice(0, match.index) + `${match[1]}"${to}"` + text.slice(match.index + match[0].length);
    if (isDeepStrictEqual(JSON.parse(candidate), expected)) return candidate;
  }
  return fail(`couldn't find "${key}": "${from}" in app.json to change.`);
}

const { version: newVersion } = parseArgs(process.argv.slice(2));
const text = readFileSync(APP_JSON, 'utf8');
const config = JSON.parse(text);
const expo = config.expo;
const oldVersion = expo?.version;
const oldBuild = expo?.ios?.buildNumber;

if (typeof oldVersion !== 'string') fail('app.json has no expo.version.');
if (typeof oldBuild !== 'string' || !/^\d+$/.test(oldBuild)) {
  fail(
    `expo.ios.buildNumber must be a whole number in quotes, like "1" (it's ${JSON.stringify(oldBuild)}).`,
  );
}

let nextText = text;
let nextBuild;
if (newVersion === undefined) {
  nextBuild = String(Number(oldBuild) + 1);
} else {
  if (!VERSION_PATTERN.test(newVersion)) {
    fail(`"${newVersion}" isn't a version Apple accepts. Use up to three numbers, like 1.1.0.`);
  }
  if (compareVersions(newVersion, oldVersion) <= 0) {
    fail(`${newVersion} isn't higher than the current version ${oldVersion}.`);
  }
  nextBuild = '1';
  const withVersion = structuredClone(config);
  withVersion.expo.version = newVersion;
  nextText = replaceString(nextText, 'version', oldVersion, newVersion, withVersion);
}

const expected = structuredClone(config);
expected.expo.version = newVersion ?? oldVersion;
expected.expo.ios.buildNumber = nextBuild;
nextText = replaceString(nextText, 'buildNumber', oldBuild, nextBuild, expected);
writeFileSync(APP_JSON, nextText);

const nextVersion = newVersion ?? oldVersion;
console.log(`app.json: ${oldVersion} (${oldBuild}) → ${nextVersion} (${nextBuild})`);
console.log('Next: npm run ios:archive, or npm run ios:xcode to archive in Xcode.');
