import type { GameViewProps } from "./types";

export function PracticeGameView({ playerName, onFinish }: GameViewProps) {
  return (
    <section className="play-surface" aria-labelledby="play-title">
      <p className="eyebrow">Practice table</p>
      <h1 id="play-title">Your turn, {playerName}</h1>
      <div className="demo-board" aria-label="Game board preview">
        {Array.from({ length: 9 }, (_, index) => (
          <button key={index} type="button" aria-label={`Board space ${String(index + 1)}`}>
            {index === 4 ? "●" : ""}
          </button>
        ))}
      </div>
      <p className="supporting-text">
        This shared play surface is ready for the game module&apos;s interactive view.
      </p>
      <button className="button button-primary" type="button" onClick={onFinish}>
        Finish demo round
      </button>
    </section>
  );
}
