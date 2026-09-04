import assert from "node:assert/strict";
import { test } from "node:test";

import { extractAllPixelIds, extractFacebookPageRef, extractPixelId } from "./extract.ts";

test("pixel id is read from the standard fbq init call", () => {
  const html = `<script>!function(f,b,e,v,n,t,s){}(window,document);
    fbq('init', '1234567890123456');
    fbq('track', 'PageView');</script>`;
  assert.equal(extractPixelId(html), "1234567890123456");
});

test("double quotes and loose spacing are handled", () => {
  assert.equal(extractPixelId(`fbq( "init" , "9876543210987654" )`), "9876543210987654");
});

test("pixel id is read from the noscript tracking image", () => {
  const html = `<noscript><img src="https://www.facebook.com/tr?id=1112223334445556&ev=PageView"/></noscript>`;
  assert.equal(extractPixelId(html), "1112223334445556");
});

test("a page with no pixel returns null rather than a guess", () => {
  assert.equal(extractPixelId("<html><body>Nothing here</body></html>"), null);
  // A short number must not be mistaken for a pixel id.
  assert.equal(extractPixelId("fbq('init', '123')"), null);
});

test("every pixel is found when a page carries more than one", () => {
  const html = `fbq('init', '1111111111111111'); fbq('init', '2222222222222222');`;
  assert.deepEqual(extractAllPixelIds(html), ["1111111111111111", "2222222222222222"]);
});

test("a Facebook Page link yields its slug, ignoring tracking URLs", () => {
  assert.equal(
    extractFacebookPageRef('<a href="https://facebook.com/bowlinemarinas">Follow</a>'),
    "bowlinemarinas",
  );
  assert.equal(
    extractFacebookPageRef('<img src="https://www.facebook.com/tr?id=1234567890123456">'),
    null,
  );
});

test("a numeric profile link yields the id", () => {
  assert.equal(
    extractFacebookPageRef('<a href="https://facebook.com/profile.php?id=100088776655443">x</a>'),
    "100088776655443",
  );
});
