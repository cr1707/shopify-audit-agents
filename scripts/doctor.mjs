#!/usr/bin/env node
// Checks that this machine can run the collector: Node 22+ and a local Chromium-based browser.
import { findChrome } from './lib/cdp.mjs';

const problems = [];
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) problems.push(`Node ${process.versions.node} found; Node 22 or newer is needed (global fetch and WebSocket). Install it from https://nodejs.org`);
const chrome = findChrome();
if (!chrome) problems.push('No Chrome, Chromium, Edge or Brave found. Install Google Chrome, or set CHROME_PATH to a Chromium-based browser.');
if (problems.length) { console.error('Not ready:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log(`Ready: Node ${process.versions.node}, browser ${chrome}${process.env.PSI_API_KEY ? ', PageSpeed API key set' : ' (optional: set PSI_API_KEY for reliable PageSpeed runs)'}`);
