// Focused unit tests for the ServiceDescription cleaning helpers.
// Run with: npm test   (uses the built-in Node test runner, no deps)
const test = require("node:test");
const assert = require("node:assert/strict");

const { stripHtml, stripServiceDescriptions } = require("../sql/qf-provider");

test("extracts body text and drops head/style noise", () => {
  const html =
    "<HTML><head><style>.rich p { font-size: small }</style></head>" +
    '<body class="rich"><p><strong>Site Name: </strong>Frisbie Memorial Hospital</p>' +
    "<p><strong>Bill To:</strong> HCA</p></body></HTML>";
  assert.equal(
    stripHtml(html),
    "Site Name: Frisbie Memorial Hospital\nBill To: HCA"
  );
});

test("decodes the entities that appear in the feed", () => {
  const html =
    "<body><p>Contact No. &amp; Email:&nbsp;&nbsp;603-602-5858&nbsp; // " +
    "&nbsp;a &lt;b&gt; c &quot;d&quot; &#39;e&#39; &#65;</p></body>";
  assert.equal(
    stripHtml(html),
    'Contact No. & Email: 603-602-5858 // a <b> c "d" \'e\' A'
  );
});

test("each block element becomes its own line, blanks dropped", () => {
  const html =
    "<body><p>6/13 - Abushanap : first visit</p><p></p>" +
    "<p>6/18 - Rumsey : second visit</p></body>";
  assert.equal(
    stripHtml(html),
    "6/13 - Abushanap : first visit\n6/18 - Rumsey : second visit"
  );
});

test("passes non-HTML strings through untouched", () => {
  assert.equal(stripHtml("just a plain service note"), "just a plain service note");
  assert.equal(stripHtml(""), "");
});

test("does NOT strip angle-bracket tokens in plain-text notes", () => {
  // Regression for the review finding: no <html>/<body> wrapper => leave as-is.
  assert.equal(stripHtml("Use <TBD> placeholder"), "Use <TBD> placeholder");
  assert.equal(stripHtml("swap model <X> for <Y>"), "swap model <X> for <Y>");
  assert.equal(stripHtml("if a < b and b > c"), "if a < b and b > c");
});

test("non-string values pass through unchanged", () => {
  assert.equal(stripHtml(null), null);
  assert.equal(stripHtml(undefined), undefined);
  assert.equal(stripHtml(42), 42);
});

test("stripServiceDescriptions only touches ServiceDescription keys", () => {
  const rows = [
    {
      OrderNbr: "SO123",
      Notes: "keep <this> exactly",
      ServiceDescription: "<body><p>cleaned</p></body>"
    }
  ];
  const cleaned = stripServiceDescriptions(rows);
  assert.equal(cleaned[0].ServiceDescription, "cleaned");
  assert.equal(cleaned[0].Notes, "keep <this> exactly");
  assert.equal(cleaned[0].OrderNbr, "SO123");
});

test("stripServiceDescriptions does not mutate its input", () => {
  const rows = [{ ServiceDescription: "<body><p>x</p></body>" }];
  const original = rows[0].ServiceDescription;
  stripServiceDescriptions(rows);
  assert.equal(rows[0].ServiceDescription, original);
});
