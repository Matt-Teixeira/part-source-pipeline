// Focused unit tests for the HCA OData cleaning helper.
// Run with: npm test   (uses the built-in Node test runner, no deps)
const test = require("node:test");
const assert = require("node:assert/strict");

const { trimStrings } = require("../sql/qf-provider");

test("trims padded string fields from the feed", () => {
  const row = {
    CustomerAccountNumber: "C000888                       ",
    Duration: "   300",
    TravelTime: "   230"
  };
  assert.deepEqual(trimStrings(row), {
    CustomerAccountNumber: "C000888",
    Duration: "300",
    TravelTime: "230"
  });
});

test("recurses through arrays and nested objects", () => {
  const rows = [
    { ServiceOrderNbr: " INS00051 ", Meta: { CustomerName: " HCA Florida " } }
  ];
  assert.deepEqual(trimStrings(rows), [
    { ServiceOrderNbr: "INS00051", Meta: { CustomerName: "HCA Florida" } }
  ]);
});

test("leaves non-string values unchanged", () => {
  assert.equal(trimStrings(null), null);
  assert.equal(trimStrings(undefined), undefined);
  assert.equal(trimStrings(42), 42);
  assert.equal(trimStrings(true), true);
  assert.deepEqual(trimStrings({ LineNbr: 2 }), { LineNbr: 2 });
});

test("does not mutate its input", () => {
  const rows = [{ ServiceOrderNbr: " INS00051 " }];
  const original = rows[0].ServiceOrderNbr;
  trimStrings(rows);
  assert.equal(rows[0].ServiceOrderNbr, original);
});
