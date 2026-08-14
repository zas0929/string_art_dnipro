import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const templateFiles = [
  "supabase/email-templates/confirm-signup.html",
  "supabase/email-templates/reset-password.html",
];

for (const templateFile of templateFiles) {
  test(`${templateFile} keeps a first-party action link and email-safe markup`, async () => {
    const html = await readFile(new URL(`../${templateFile}`, import.meta.url), "utf8");

    assert.match(html, /href="\{\{ \.SiteURL \}\}\/auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}/);
    assert.doesNotMatch(html, /\.ConfirmationURL/);
    assert.match(html, /\{\{ \.Email \}\}/);
    assert.match(html, /https:\/\/www\.stringartdnipro\.com\/logo-white-compact\.png/);
    assert.match(html, /<table role="presentation"/);
    assert.doesNotMatch(html, /<script\b/i);
    assert.doesNotMatch(html, /<form\b/i);
    assert.doesNotMatch(html, /src="\//);
  });
}
