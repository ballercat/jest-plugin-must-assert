test("no assertions, no code", () => {});

test("assertions, but not within runtime path", () => {
  const unused = () => expect(true).toBe(true);
});

test("assertions within a promise", () => {
  Promise.resolve().then(() => {
    expect(true).toBe(true);
  });
});

test.only("assertions within a missed promise chain", () => {
  return Promise.reject().then(() => {
    expect(true).toBe(true);
  });
});
