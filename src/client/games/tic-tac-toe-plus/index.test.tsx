// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import game from "./index";

const state = {
  board: Array<null>(16).fill(null), currentPlayerId: "a", winnerId: null, draw: false,
  players: [{ id: "a", displayName: "Ada" }, { id: "b", displayName: "Ben" }],
};

describe("Tic-Tac-Toe+ client", () => {
  it("labels the grid and submits an authoritative place command", async () => {
    const sendCommand = vi.fn().mockResolvedValue(undefined);
    const View = game.View;
    render(<View gameId="tic-tac-toe-plus" roomId="ABCDE" playerId="a" playerName="Ada" state={state} sendCommand={sendCommand} onFinish={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("Your turn");
    await userEvent.click(screen.getByRole("gridcell", { name: "Row 1, column 1, empty" }));
    expect(sendCommand).toHaveBeenCalledWith({ type: "place", index: 0 });
  });

  it("prevents moves while waiting for the opponent", () => {
    const View = game.View;
    render(<View gameId="tic-tac-toe-plus" roomId="ABCDE" playerId="b" playerName="Ben" state={state} sendCommand={vi.fn()} onFinish={vi.fn()} />);
    expect((screen.getAllByRole("gridcell")[0] as HTMLButtonElement).disabled).toBe(true);
  });
});
