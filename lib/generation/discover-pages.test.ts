import assert from "node:assert/strict";
import { test } from "node:test";

import {
  extractInternalLinks,
  htmlToText,
  scorePath,
  selectPagesToRead,
} from "./discover-pages.ts";

test("positioning pages outrank deep and boilerplate pages", () => {
  assert.ok(scorePath("/about-us") > scorePath("/services"));
  assert.ok(scorePath("/services") > scorePath("/locations/miami/marina-3"));
  assert.equal(scorePath("/privacy-policy"), -1);
  assert.equal(scorePath("/terms"), -1);
  assert.equal(scorePath("/logo.png"), -1);
});

test("scoring is industry-agnostic", () => {
  // The same heuristic has to work for a med spa and an insurance broker as
  // well as a boat club — the old build hardcoded one client's paths.
  for (const p of ["/about", "/why-us", "/how-it-works", "/our-approach"]) {
    assert.ok(scorePath(p) >= 90, `${p} should score high`);
  }
});

test("only same-origin links are followed", () => {
  const html = `
    <a href="/about">About</a>
    <a href="https://other.com/about">Other</a>
    <a href="https://site.com/services">Services</a>
    <a href="mailto:a@b.com">Mail</a>
    <a href="#top">Top</a>
  `;
  const links = extractInternalLinks(html, "https://site.com");
  assert.deepEqual(links, ["https://site.com/about", "https://site.com/services"]);
});

test("links are deduped and query/hash stripped", () => {
  const html = `
    <a href="/about">a</a><a href="/about#team">b</a><a href="/about?utm=x">c</a>
  `;
  assert.deepEqual(extractInternalLinks(html, "https://site.com"), ["https://site.com/about"]);
});

test("homepage is always read first, then the best pages", () => {
  const html = `
    <a href="/privacy">Privacy</a>
    <a href="/services">Services</a>
    <a href="/about-us">About</a>
    <a href="/blog/post-1">Blog</a>
  `;
  const pages = selectPagesToRead(html, "https://site.com", 3);
  assert.equal(pages[0], "https://site.com");
  assert.ok(pages.includes("https://site.com/about-us"));
  assert.ok(!pages.some((p) => p.includes("privacy")));
  assert.equal(pages.length, 3);
});

test("a site with no internal links still yields the homepage", () => {
  assert.deepEqual(selectPagesToRead("<p>hi</p>", "https://site.com"), ["https://site.com"]);
});

test("htmlToText strips scripts, styles and entities", () => {
  const html = `
    <style>.a{color:red}</style>
    <script>var x = "hidden";</script>
    <h1>We&nbsp;make boating easy</h1>
    <p>All &amp; more</p>
  `;
  const text = htmlToText(html);
  assert.match(text, /We make boating easy/);
  assert.match(text, /All & more/);
  assert.doesNotMatch(text, /color:red/);
  assert.doesNotMatch(text, /var x/);
});

test("htmlToText truncates to the cap", () => {
  assert.equal(htmlToText("<p>" + "x".repeat(50000) + "</p>", 15000).length, 15000);
});
