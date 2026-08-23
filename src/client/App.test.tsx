// @vitest-environment jsdom
import axe from "axe-core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { clientGames } from "./game-framework/catalog";
import { MockRoomTransport } from "./room/transport";

function open(path: string) {
  window.history.replaceState({}, "", path);
}

beforeEach(() => {
  localStorage.clear();
  open("/");
});

describe("Parsi Games product shell", () => {
  it("presents all ten games and the three primary ways to play", () => {
    render(<App transport={new MockRoomTransport()} />);

    expect(screen.getByRole("heading", { level: 1, name: /game night/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a room" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Join a room" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Play solo" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(10);
    for (const game of clientGames) {
      expect(screen.getByRole("heading", { name: game.metadata.name })).toBeInTheDocument();
    }
  });

  it("has no detectable axe violations on the home screen", async () => {
    const { container } = render(<App transport={new MockRoomTransport()} />);
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  it("creates a room and exposes host lobby controls", async () => {
    const user = userEvent.setup();
    render(<App transport={new MockRoomTransport()} />);

    await user.click(screen.getByRole("link", { name: "Create a room" }));
    await user.type(screen.getByLabelText("Display name"), "Ari");
    await user.click(screen.getByRole("button", { name: "Create room" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Gather your players." })).toBeInTheDocument());
    expect(screen.getByText("Host controls")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start game" })).toBeInTheDocument();
    expect(screen.getByDisplayValue(/\/join\/PLAY-42$/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Connected");
  });

  it("joins from a shared room URL with a temporary display name", async () => {
    open("/join/FRIENDS-7");
    const user = userEvent.setup();
    render(<App transport={new MockRoomTransport()} />);

    await user.type(screen.getByLabelText("Display name"), "Sam");
    await user.click(screen.getByRole("button", { name: "Join game" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Gather your players." })).toBeInTheDocument());
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(localStorage.getItem("parsi-games-display-name")).toBe("Sam");
  });

  it("moves through game and results screens with rematch controls", async () => {
    const transport = new MockRoomTransport();
    await transport.createRoom({ displayName: "Ari", gameId: "tic-tac-toe-plus" });
    open("/lobby/PLAY-42");
    const user = userEvent.setup();
    render(<App transport={transport} />);

    await user.click(screen.getByRole("button", { name: "Start game" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /your turn/i })).toBeInTheDocument());
    expect(within(screen.getByLabelText("Game board preview")).getAllByRole("button")).toHaveLength(9);
    await user.click(screen.getByRole("button", { name: "Finish demo round" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /takes it/i })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Play again" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return home" })).toBeInTheDocument();
  });

  it("keeps the shell within a simulated 320px viewport", () => {
    Object.defineProperty(window, "innerWidth", { value: 320, configurable: true });
    const { container } = render(<App transport={new MockRoomTransport()} />);
    const shell = container.querySelector<HTMLElement>(".app-shell");
    expect(shell).not.toBeNull();
    expect(document.body.style.minWidth).not.toBe("321px");
    expect(screen.getByRole("link", { name: "Create a room" })).toBeVisible();
  });
});
