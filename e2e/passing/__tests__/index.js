/**
 * All of the tests below should pass
 */

function getPromise() {
  return Promise.resolve({});
}

test('basic tests should pass', () => {
  expect(1 + 2).toBe(3);
});

test('async tests should pass', async () => {
  const result = await getPromise();
  expect(typeof result !== 'undefined').toBe(true);
});

test('promise tests should pass', () => {
  return Promise.resolve()
    .then(() => {
      expect(1 + 1).toBe(2);
      throw new Error();
    })
    .catch(() => {
      expect(1 + 2).toBe(3);
    });
});

test('done callback tests should pass', done => {
  Promise.resolve().then(() => {
    expect(1 + 1).toBe(2);
    done();
  });
});

describe('it() should behave the same as test()', () => {
  it('basic tests should pass', () => {
    expect(1 + 2).toBe(3);
  });

  it('async tests should pass', async () => {
    const result = await getPromise();
    expect(typeof result !== 'undefined').toBe(true);
  });

  it('promise tests should pass', () => {
    return Promise.resolve()
      .then(() => {
        expect(1 + 1).toBe(2);
        throw new Error();
      })
      .catch(() => {
        expect(1 + 2).toBe(3);
      });
  });

  it('done callback tests should pass', done => {
    Promise.resolve().then(() => {
      expect(1 + 1).toBe(2);
      done();
    });
  });
});
