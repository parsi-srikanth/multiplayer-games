// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import game from "./index";
describe("Sudoku Sprint client", () => {
  it("labels the grid and submits a selected value", async () => {
    const sendCommand = vi.fn(() => Promise.resolve()); const View = game.View;
    const puzzle = [1,0,0,4,0,4,1,0,2,0,4,0,0,3,0,1];
    render(<View roomId="ROOM1" gameId="sudoku-sprint" playerName="Ada" playerId="a" state={{ puzzle, board: puzzle, mistakes: 0, progress: { a: 8 }, players: [{ id: "a", displayName: "Ada" }], winnerId: null, complete: false }} sendCommand={sendCommand} onFinish={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Row 1, column 2, empty" }));
    await userEvent.click(screen.getByRole("button", { name: "2" }));
    expect(sendCommand).toHaveBeenCalledWith({ type: "place", row: 0, column: 1, value: 2 });
    expect(screen.getByRole("list", { name: "Player progress" }).textContent).toContain("Ada: 8/16");
  });
});
