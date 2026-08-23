// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import game from "./index";

const baseProps = {
  roomId: "ROOM1", gameId: "dots-boxes", playerName: "Ada", playerId: "a", connection: "connected" as const,
  state: { currentPlayerId: "a", edges: {}, boxes: {}, players: [{ id: "a", displayName: "Ada" }, { id: "b", displayName: "Ben" }], complete: false },
  sendCommand: vi.fn(() => Promise.resolve()), onFinish: vi.fn(), onExit: vi.fn(),
};

describe("Dots & Boxes client", () => {
  it("renders 24 accessible edge controls and sends a claim", async () => {
    const View = game.View;
    render(<View {...baseProps} />);
    expect(screen.getAllByRole("button")).toHaveLength(24);
    await userEvent.click(screen.getByRole("button", { name: "Open horizontal edge, row 1, column 1" }));
    expect(baseProps.sendCommand).toHaveBeenCalledWith({ type: "claim-edge", orientation: "h", row: 0, column: 0 });
  });
});
