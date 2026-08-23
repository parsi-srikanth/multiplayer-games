/* eslint-disable react-refresh/only-export-components -- this tiny router intentionally colocates navigation helpers */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface Route {
  readonly name: "home" | "create" | "join" | "lobby" | "game" | "results" | "not-found";
  readonly roomId?: string;
  readonly search: URLSearchParams;
}

function parsePath(pathname: string, search: string): Route {
  const parts = pathname.split("/").filter(Boolean);
  const params = new URLSearchParams(search);
  if (parts.length === 0) return { name: "home", search: params };
  if (parts[0] === "create" && parts.length === 1) return { name: "create", search: params };
  if (parts[0] === "join" && parts.length <= 2) {
    const roomId = parts[1];
    return roomId === undefined
      ? { name: "join", search: params }
      : { name: "join", roomId, search: params };
  }
  if (["lobby", "game", "results"].includes(parts[0] ?? "") && parts[1] !== undefined) {
    return {
      name: parts[0] as "lobby" | "game" | "results",
      roomId: parts[1],
      search: params,
    };
  }
  return { name: "not-found", search: params };
}

export function navigate(to: string, options?: { replace?: boolean }): void {
  if (options?.replace === true) window.history.replaceState({}, "", to);
  else window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "auto" });
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parsePath(window.location.pathname, window.location.search));

  useEffect(() => {
    const onPopState = () => {
      setRoute(parsePath(window.location.pathname, window.location.search));
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return route;
}

export function AppLink({ to, className, children }: {
  readonly to: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
          event.preventDefault();
          navigate(to);
        }
      }}
    >
      {children}
    </a>
  );
}
