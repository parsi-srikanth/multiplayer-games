// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import game from "./index";
describe("Connect Four client", () => {
  it("renders seven column controls and sends an authoritative drop", async () => {
    const sendCommand = vi.fn(() => Promise.resolve()); const View = game.View;
    render(<View roomId="ROOM1" gameId="connect-four" playerName="Ada" playerId="a" state={{ board: Array<null>(42).fill(null), players: [{ id: "a", displayName: "Ada" }, { id: "b", displayName: "Ben" }], currentPlayerId: "a", winnerId: null, complete: false }} sendCommand={sendCommand} onFinish={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(7);
    await userEvent.click(screen.getByRole("button", { name: "Drop in column 1" }));
    expect(sendCommand).toHaveBeenCalledWith({ type: "drop", column: 0 });
  });
});
