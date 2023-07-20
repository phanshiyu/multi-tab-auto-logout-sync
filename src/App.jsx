import { useCallback, useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import "./App.css";

const LOCAL_STORAGE_COUNT_DOWN_END_TS_KEY = "countDownEndTs";
const LOCAL_STORAGE_KEY_LAST_ACTIVE = "lastActive";

const getCountDownFromLocalStorage = () => {
  const countDownEndTs = localStorage.getItem(
    LOCAL_STORAGE_COUNT_DOWN_END_TS_KEY
  );

  if (!countDownEndTs) return; // no countdown in progress

  const timeLeft = countDownEndTs - Date.now();
  if (timeLeft <= 0) return 0; // countdown has ended

  return parseInt(timeLeft / 1000);
};

function useIsIdle(idleTime) {
  const [isIdle, setIdle] = useState(false);
  const [idleTimeInMs, setIdleTimeInMs] = useState(
    Date.now() - (localStorage.getItem(LOCAL_STORAGE_KEY_LAST_ACTIVE) ?? 0) >
      idleTime
      ? Date.now() - (localStorage.getItem(LOCAL_STORAGE_KEY_LAST_ACTIVE) ?? 0)
      : 0
  );

  useEffect(() => {
    const updateActive = () => {
      localStorage.setItem(LOCAL_STORAGE_KEY_LAST_ACTIVE, Date.now());
      setIdle(false);
      setIdleTimeInMs(0);
    };

    // update active on mount
    updateActive();

    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
    ];
    events.forEach((event) => window.addEventListener(event, updateActive));

    return () =>
      events.forEach((event) =>
        window.removeEventListener(event, updateActive)
      );
  }, []);

  useEffect(() => {
    // keep is idle state in sync with local storage
    function updateIsIdle() {
      setIdle(
        Date.now() -
          (localStorage.getItem(LOCAL_STORAGE_KEY_LAST_ACTIVE) ?? 0) >
          idleTime
      );

      setIdleTimeInMs(
        Date.now() -
          (localStorage.getItem(LOCAL_STORAGE_KEY_LAST_ACTIVE) ?? 0) >
          idleTime
          ? Date.now() -
              (localStorage.getItem(LOCAL_STORAGE_KEY_LAST_ACTIVE) ?? 0)
          : 0
      );
    }

    const interval = setInterval(updateIsIdle, 500);
    window.addEventListener("storage", updateIsIdle);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", updateIsIdle);
    };
  }, [idleTime]);

  return { isIdle, idleTimeInMs };
}

function useCountDown(seconds) {
  const [countDown, setCountDown] = useState(getCountDownFromLocalStorage());

  useEffect(() => {
    // start counting down if there is a countdown in progress
    let timeout;
    if (countDown > 0) {
      timeout = setTimeout(() => {
        setCountDown(getCountDownFromLocalStorage());
      }, 1000);
    }

    () => clearTimeout(timeout);
  }, [countDown]);

  const startCountDown = useCallback(() => {
    // check if there is already a countdown in progress
    let countDown = getCountDownFromLocalStorage();
    if (!countDown) {
      countDown = seconds;
      localStorage.setItem(
        LOCAL_STORAGE_COUNT_DOWN_END_TS_KEY,
        Date.now() + seconds * 1000
      );
    }

    setCountDown(countDown);
  }, [seconds]);

  const clearCountDown = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_COUNT_DOWN_END_TS_KEY);
    setCountDown(undefined);
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === LOCAL_STORAGE_COUNT_DOWN_END_TS_KEY) {
        setCountDown(getCountDownFromLocalStorage());
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return {
    countDown,
    startCountDown,
    clearCountDown,
  };
}

const logoutBroadcastChannel = new BroadcastChannel("logout-channel");

function App() {
  const [loggedIn, setLoggedIn] = useLocalStorage("login", false);
  const [logoutType, setLogoutType] = useState();

  const { isIdle, idleTimeInMs } = useIsIdle(5000);
  const { countDown, clearCountDown, startCountDown } = useCountDown(5);

  const handleLogout = useCallback(
    (type) => {
      setLoggedIn(false);
      clearCountDown();
      setLogoutType(type);
      logoutBroadcastChannel.postMessage({ type });
    },
    [clearCountDown, setLoggedIn]
  );

  useEffect(() => {
    if (loggedIn) setLogoutType(undefined);
  }, [loggedIn]);

  // listen for logout events from other tabs
  useEffect(() => {
    const logoutUser = (event) => {
      setLoggedIn(false);
      clearCountDown();
      setLogoutType(event.data.type);
    };

    logoutBroadcastChannel.onmessage = logoutUser;

    return () => {
      logoutBroadcastChannel.onmessage = undefined;
    };
  }, [clearCountDown, setLoggedIn]);

  // start count down on idle + user is logged in
  useEffect(() => {
    if (isIdle && loggedIn) {
      startCountDown();
    }
  }, [isIdle, startCountDown, loggedIn]);

  // log user out when count down hits 0
  useEffect(() => {
    if (loggedIn && (countDown === 0 || idleTimeInMs > 10000)) {
      handleLogout("session-expired");
    }
  }, [countDown, handleLogout, loggedIn, idleTimeInMs]);

  const renderedIdleStatus = isIdle ? (
    <span style={{ color: "red" }}>idle</span>
  ) : (
    <span style={{ color: "green" }}>active</span>
  );

  const logoutMessage =
    logoutType === "session-expired" ? <p>Your session has expired</p> : null;

  return (
    <>
      <p>{renderedIdleStatus}</p>
      <p>idle time: {idleTimeInMs} ms</p>
      {logoutMessage}
      <dialog
        open={Boolean(countDown)}
        onClose={() => {
          clearCountDown();
        }}
      >
        <p>Logging you out in {countDown}</p>
        <button onClick={() => handleLogout("explicit-logout")}>Logout</button>
        <form method="dialog">
          <button type="submit">Stay logged in</button>
        </form>
      </dialog>
      <div className="card">
        {!loggedIn ? (
          <>
            <button
              onClick={() => {
                setLoggedIn(true);
                // reset logout type
                setLogoutType(undefined);
              }}
            >
              Login
            </button>
          </>
        ) : (
          <button onClick={() => handleLogout("explicit-logout")}>
            Logout
          </button>
        )}
      </div>
    </>
  );
}

export default App;
