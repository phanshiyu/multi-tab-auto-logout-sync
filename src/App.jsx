import { useLocalStorage } from "usehooks-ts";
import "./App.css";
import { useCallback, useEffect, useState, useMemo } from "react";

const LOCAL_STORAGE_COUNT_DOWN_KEY = "countDown";
const LOCAL_STORAGE_KEY_LAST_ACTIVE = "lastActive";

const getCountDownFromLocalStorage = () => {
  const rawValueInStorage = localStorage.getItem(LOCAL_STORAGE_COUNT_DOWN_KEY);
  if (!rawValueInStorage) return;

  const sessionCountdown = JSON.parse(rawValueInStorage);

  return sessionCountdown;
};

const decrementCountdownInLocalStorage = () => {
  const sessionCountdown = getCountDownFromLocalStorage();

  if (!sessionCountdown) return;

  const timeSinceLastUpdate = Date.now() - sessionCountdown.lastUpdated;
  if (timeSinceLastUpdate >= 1000) {
    if (sessionCountdown.count === 0) return;

    let newCount = sessionCountdown.count - 1;

    localStorage.setItem(
      LOCAL_STORAGE_COUNT_DOWN_KEY,
      JSON.stringify({
        count: newCount,
        lastUpdated: sessionCountdown.lastUpdated + 1000,
      })
    );
  }
};

function useIsIdle(idleTime) {
  const [isIdle, setIdle] = useState(
    localStorage.getItem(LOCAL_STORAGE_KEY_LAST_ACTIVE)
      ? Date.now() - localStorage.getItem(LOCAL_STORAGE_KEY_LAST_ACTIVE) >
          idleTime
      : true
  );

  useEffect(() => {
    const updateActive = () => {
      localStorage.setItem(LOCAL_STORAGE_KEY_LAST_ACTIVE, Date.now());
      setIdle(false);
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
        localStorage.getItem(LOCAL_STORAGE_KEY_LAST_ACTIVE)
          ? Date.now() - localStorage.getItem(LOCAL_STORAGE_KEY_LAST_ACTIVE) >
              idleTime
          : true
      );
    }

    const interval = setInterval(updateIsIdle, 500);
    window.addEventListener("storage", updateIsIdle);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", updateIsIdle);
    };
  }, [idleTime]);

  return isIdle;
}

function useCountDown(seconds) {
  const [countDown, setCountDown] = useState(
    getCountDownFromLocalStorage()?.count
  );

  // effect to keep the countdown in sync with local storage
  useEffect(() => {
    const updateCountDownState = () => {
      const countDown = getCountDownFromLocalStorage();
      setCountDown(countDown?.count);
    };

    const updateCountDownStateInterval = setInterval(updateCountDownState, 500);

    window.addEventListener("storage", updateCountDownState);

    return () => {
      clearInterval(updateCountDownStateInterval);
      window.removeEventListener("storage", updateCountDownState);
    };
  }, []);

  const startCountDown = useCallback(() => {
    // check if there is already a countdown in progress
    const countDown = getCountDownFromLocalStorage();
    if (countDown) return;

    localStorage.setItem(
      LOCAL_STORAGE_COUNT_DOWN_KEY,
      JSON.stringify({
        count: seconds,
        lastUpdated: Date.now(),
      })
    );
  }, [seconds]);

  const clearCountDown = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_COUNT_DOWN_KEY);
  }, []);

  useEffect(() => {
    const decrementInterval = setInterval(
      decrementCountdownInLocalStorage,
      500
    );
    return () => clearInterval(decrementInterval);
  }, []);

  return {
    countDown,
    startCountDown,
    clearCountDown,
  };
}

function App() {
  const [loggedIn, setLoggedIn] = useLocalStorage("login", false);
  const [logoutType, setLogoutType] = useState();
  const logoutBroadcastChannel = useMemo(
    () => new BroadcastChannel("logout-channel"),
    []
  );
  const isIdle = useIsIdle(5000);
  const { countDown, clearCountDown, startCountDown } = useCountDown(5);

  useEffect(() => {
    if (loggedIn) setLogoutType(undefined);
  }, [loggedIn]);

  const handleLogoutClick = useCallback(
    (type) => {
      setLoggedIn(false);
      clearCountDown();
      setLogoutType(type);
      logoutBroadcastChannel.postMessage({ type });
    },
    [clearCountDown, setLoggedIn, logoutBroadcastChannel]
  );

  // listen for logout events from other tabs
  useEffect(() => {
    const logoutUser = (event) => {
      setLoggedIn(false);
      clearCountDown();
      setLogoutType(event.data.type);
    };

    logoutBroadcastChannel.onmessage = logoutUser;

    return () => {
      logoutBroadcastChannel.close();
    };
  }, [clearCountDown, setLoggedIn, logoutBroadcastChannel]);

  // start count down on idle + user is logged in
  useEffect(() => {
    if (isIdle && loggedIn) {
      startCountDown();
    }
  }, [isIdle, startCountDown, loggedIn]);

  // log user out when count down hits 0
  useEffect(() => {
    if (loggedIn && countDown === 0) {
      handleLogoutClick("session-expired");
    }
  }, [clearCountDown, loggedIn, countDown, setLoggedIn, handleLogoutClick]);

  const renderedIdleStatus = isIdle ? (
    <span style={{ color: "red" }}>idle</span>
  ) : (
    <span style={{ color: "green" }}>active</span>
  );

  const logoutMessage =
    logoutType === "session-expired" ? <p>Your session has expired</p> : null;

  return (
    <>
      {renderedIdleStatus}
      {logoutMessage}
      <dialog
        open={Boolean(countDown)}
        onClose={() => {
          clearCountDown();
        }}
      >
        <p>Logging you out in {countDown}</p>
          <button onClick={() => handleLogoutClick("explicit-logout")}>Logout</button>
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
          <button onClick={() => handleLogoutClick("explicit-logout")}>
            Logout
          </button>
        )}
      </div>
    </>
  );
}

export default App;
