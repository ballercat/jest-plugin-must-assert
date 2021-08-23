/**
 * Zoning helpers
 *
 * @author Arthur Buldauskas<arthurbuldauskas@gmail.com>
 */
const StackUtils = require('stack-utils');

const EXPOSE_ERROR = Symbol('EXPOSE_ERROR');

// Globals
// The current zone. Every time a test starts this changes
let currentZone = null;

// All zone ID should be unique
let uniqueIdentifier = 0;
const uuid = () => ++uniqueIdentifier;

const getZones = ({ onInvokeTask, logger, ignoreStack }) => {
  // Requiring Zone libraries here ensures that we allow for users of the
  // plugin to conditionally add this functionally per test suite module.

  // Zone will patch console for us, but we don't really want that
  const consoleMethods = Object.entries(global.console);

  require('zone.js');
  require('zone.js/dist/long-stack-trace-zone');

  // Restore default console
  consoleMethods.forEach(([key, value]) => {
    global.console[key] = value;
  });

  // We clean the stacks to make them easier to reason about in the console output
  const stack = new StackUtils({
    cwd: process.cwd(),
    // Stack utils API for what functions should be removed from the stack trace
    // We omit node_modules, Zone library and node internals by default
    internals: StackUtils.nodeInternals().concat(ignoreStack),
  });

  // Zone sets itself as a global, that's just how the library works
  const Zone = global.Zone;

  /**
   * Exit the current zone
   *
   * Only if it still matches the zone ID attempting to exit
   *
   */
  const exitZone = id => {
    if (id === currentZone) {
      currentZone = null;
    }
  };

  /**
   * Enter a new zone
   *
   */
  const enterZone = (callback, name, hasDoneCallback) => {
    const id = uuid();

    /**
     * Create a new zone using Zone.js API
     *
     * See https://github.com/angular/angular/blob/master/packages/zone.js/lib/zone.ts
     */
    const zone = Zone.root
      .fork({
        name,
        // Attach the id to the zone object
        properties: {
          id,
        },
        onHandleError(delegate, current, target, e) {
          if (e && e[EXPOSE_ERROR]) {
            logger.warn(`${e.message}\n\n${stack.clean(e.stack)}`);
            return false;
          }
          throw e;
        },
        onInvokeTask(delegate, current, target, task, applyThis, applyArgs) {
          let error;
          let result = true;

          // Exposes the stack trace associated with the task
          function getStackTrace() {
            let stack;
            try {
              throw new Error();
            } catch (e) {
              e.task = task;
              Zone.longStackTraceZoneSpec.onHandleError(
                delegate,
                current,
                target,
                e
              );
              stack = e.stack;
            }
            return stack;
          }

          try {
            result = onInvokeTask({
              originZoneId: current.get('id'),
              currentZoneId: currentZone,
              testName: name,
              task,
              logger: logger,
              getStackTrace,
            });
          } catch (e) {
            error = e;
          }

          if (error) {
            error[EXPOSE_ERROR] = true;
            error.task = task;
            throw error;
          }

          if (!result) {
            return;
          }

          return delegate.invokeTask(target, task, applyThis, applyArgs);
        },
      })
      // We fork from the special stack-trace zone so that there is a trail leading
      // back to the origin of the ignored tasks
      .fork(Zone.longStackTraceZoneSpec);

    const enter = () => (currentZone = id);

    return [
      zone.wrap(
        hasDoneCallback
          ? done => {
              enter();
              return callback(done);
            }
          : () => {
              enter();
              return callback();
            }
      ),
      id,
    ];
  };

  return { enterZone, exitZone };
};

module.exports = { getZones };
