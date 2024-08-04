import { ZalgoPromise } from "@krakenjs/zalgo-promise/src";
import { getBody, noop } from "@krakenjs/belter/src";
import { type CrossDomainWindowType } from "@krakenjs/cross-domain-utils/src";

(window as any).mockDomain = "mock://test-post-robot.com";

type WindowStore<T> = {|
  get: ((CrossDomainWindowType | WildCard, T) => T) &
    ((CrossDomainWindowType | WildCard, void) => T | void),
  set: (CrossDomainWindowType | WildCard, T) => T,
  has: (CrossDomainWindowType | WildCard) => boolean,
  del: (CrossDomainWindowType | WildCard) => void,
  getOrSet: (CrossDomainWindowType | WildCard, () => T) => T,
|};

type GlobalStore<T> = {|
  get: ((string, T) => T) & ((string, void) => T | void),
  set: (string, T) => T,
  has: (string) => boolean,
  del: (string) => void,
  getOrSet: GetOrSet<T>,
  reset: () => void,
  keys: () => $ReadOnlyArray<string>,
|};

export function globalStore<T: mixed>(
  key?: string = "store",
  defStore?: ObjectGetter = getObj
): GlobalStore<T> {
  return getOrSet(getGlobal(), key, () => {
    let store = defStore();

    return {
      has: (storeKey) => {
        return store.hasOwnProperty(storeKey);
      },
      get: (storeKey, defVal) => {
        // $FlowFixMe
        return store.hasOwnProperty(storeKey) ? store[storeKey] : defVal;
      },
      set: (storeKey, val) => {
        store[storeKey] = val;
        return val;
      },
      del: (storeKey) => {
        delete store[storeKey];
      },
      getOrSet: (storeKey, getter) => {
        // $FlowFixMe
        return getOrSet(store, storeKey, getter);
      },
      reset: () => {
        store = defStore();
      },
      keys: () => {
        return Object.keys(store);
      },
    };
  });
}

export function windowStore<T>(
  key?: string = "store",
  defStore: () => T = () => ({} as T)
): WindowStore<T> {
  return globalStore("windowStore").getOrSet(key, () => {
    const winStore = new WeakMap();

    const getStore = (win: CrossDomainWindowType | WildCard): ObjectGetter => {
      return winStore.getOrSet(win, defStore);
    };

    return {
      has: (win) => {
        const store = getStore(win);
        return store.hasOwnProperty(key);
      },
      get: (win, defVal) => {
        const store = getStore(win);
        // $FlowFixMe
        return store.hasOwnProperty(key) ? store[key] : defVal;
      },
      set: (win, val) => {
        const store = getStore(win);
        store[key] = val;
        return val;
      },
      del: (win) => {
        const store = getStore(win);
        delete store[key];
      },
      getOrSet: (win, getter) => {
        const store = getStore(win);
        return getOrSet(store, key, getter);
      },
    };
  });
}

function getHelloPromise(
  win: CrossDomainWindowType
): ZalgoPromise<{| domain: string |}> {
  const helloPromises = windowStore("helloPromises");
  return helloPromises.getOrSet(win, () => new ZalgoPromise());
}

function awaitWindowHello(
  win: CrossDomainWindowType,
  timeout: number = 5000,
  name: string = "Window"
): ZalgoPromise<{| domain: string |}> {
  let promise = getHelloPromise(win);

  if (timeout !== -1) {
    promise = promise.timeout(
      timeout,
      new Error(`${name} did not load after ${timeout}ms`)
    );
  }

  return promise;
}

window.console.karma = (...args) => {
  const karma =
    window.karma ||
    (window.top && window.top.karma) ||
    (window.opener && window.opener.karma);
  if (karma) {
    karma.log("debug", args);
  }
  // eslint-disable-next-line no-console
  console.log(...args);
};

const IE8_USER_AGENT =
  "Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0; Trident/4.0)";

export function enableIE8Mode(): {| cancel: () => void |} {
  window.navigator.mockUserAgent = IE8_USER_AGENT;

  return {
    cancel() {
      delete window.navigator.mockUserAgent;
    },
  };
}

export function createIframe(
  name: string,
  callback?: () => void
): CrossDomainWindowType {
  const frame = document.createElement("iframe");
  frame.src = `/base/test/${name}`;
  frame.id = "childframe";
  frame.name = `${Math.random().toString()}_${name.replace(
    /[^a-zA-Z0-9]+/g,
    "_"
  )}`;
  if (callback) {
    frame.addEventListener("load", callback);
  }
  getBody().appendChild(frame);
  return frame.contentWindow;
}

export function createPopup(name: string): CrossDomainWindowType {
  const popup = window.open(
    `mock://test-post-robot-child.com/base/test/${name}`,
    `${Math.random().toString()}_${name.replace(/[^a-zA-Z0-9]+/g, "_")}`
  );
  window.focus();
  return popup;
}

let childWindow;
let childFrame;
let otherChildFrame;

type Windows = {|
  childWindow: CrossDomainWindowType,
  childFrame: CrossDomainWindowType,
  otherChildFrame: CrossDomainWindowType,
|};

export function getWindows(): Windows {
  if (!childFrame || !childWindow || !otherChildFrame) {
    throw new Error(`Not all windows available`);
  }

  return {
    childWindow,
    childFrame,
    otherChildFrame,
  };
}

before((): ZalgoPromise<mixed> => {
  childWindow = createPopup("child.htm");
  childFrame = createIframe("child.htm");
  otherChildFrame = createIframe("child.htm");

  return ZalgoPromise.all([
    awaitWindowHello(childWindow),
    awaitWindowHello(childFrame),
    awaitWindowHello(otherChildFrame),
  ]).then(noop);
});

after(() => {
  if (!document.body) {
    throw new Error(`Expected document.body to be available`);
  }
  const body = document.body;
  // $FlowFixMe
  if (!childFrame.frameElement) {
    throw new Error(`Expected childFrame.frameElement to be available`);
  }
  body.removeChild(childFrame.frameElement);
  // $FlowFixMe
  if (!otherChildFrame.frameElement) {
    throw new Error(`Expected otherChildFrame.frameElement to be available`);
  }
  body.removeChild(otherChildFrame.frameElement);
  childWindow.close();
});
