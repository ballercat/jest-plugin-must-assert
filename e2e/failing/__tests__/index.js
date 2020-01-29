/**
 * All of the tests should fail, due to the plugin inserting hasAssertions()
 * before every test is executed
 */
const wait = require('wait-for-expect');

test('unhandled promise rejections fail tests', () => {
  Promise.resolve().then(() => {
    throw new Error('oops');
  });
  return wait(() => {
    expect(1).toBe(1);
  });
});

test('no assertions, no code', () => {});

test('synchronous failure', () => {
  expect(true).toBe(false);
});

test('missed runtime assertion', () => {
  const unused = () => expect(true).toBe(true);
});

test('missed rejected promise', () =>
  Promise.reject().then(() => {
    expect(true).toBe(true);
  }));

// https://github.com/facebook/jest/issues/8297
test('unreturned promise assertions', () => {
  Promise.resolve().then(() => {
    expect(true).toBe(false);
  });
});

test('assertions in missed macro-tasks', () => {
  // setTimeout(fn, 0) won't work by the way we want it to here, it'll still pass
  // the test
  setTimeout(() => {
    expect(1 + 1).toBe(2);
  }, 100);
});

test('assertions after done() callback', done => {
  setTimeout(() => {
    done();
    setTimeout(() => {
      expect(1 + 1).toBe(2);
    });
  });
});

test('assertions after done() callback (jest bugfix)', done => {
  setTimeout(() => {
    done();
    setTimeout(() => {
      expect(1 + 1).toBe(2);
    });
  });
});

test('assertions failing in setTimeout', done => {
  setTimeout(() => {
    expect(true).toBe(false);
    // done cannot be called here due to a throw just above it
    done();
  });
});

describe('it() blocks work as test()', () => {
  it('missed runtime assertion', () => {
    const unused = () => expect(true).toBe(true);
  });

  it('synchronous failure', () => {
    expect(true).toBe(false);
  });

  // https://github.com/facebook/jest/issues/8297
  it('unreturned promise assertions', () => {
    Promise.resolve().then(() => {
      expect(true).toBe(true);
    });
  });

  it('missed rejected promise', () =>
    Promise.reject().then(() => {
      expect(true).toBe(true);
    }));

  it('assertions in missed macro-tasks', () => {
    // setTimeout(fn, 0) won't work by the way we want it to here, it'll still pass
    // the test
    setTimeout(() => {
      expect(1 + 1).toBe(2);
    }, 100);
  });
});
