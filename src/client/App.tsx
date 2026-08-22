const principles = [
  "Authoritative room state at the edge",
  "A small, versioned multiplayer protocol",
  "Independent game modules with shared contracts",
] as const;

export function App() {
  return (
    <main>
      <nav aria-label="Primary navigation">
        <a className="brand" href="/">Parsi Games</a>
        <a href="https://github.com/parsi-srikanth/multiplayer-games">Source</a>
      </nav>

      <section className="hero">
        <p className="eyebrow">Multiplayer, without the waiting room</p>
        <h1>Friendly games.<br />Shared instantly.</h1>
        <p className="lede">
          A fast, lightweight home for browser games with friends. The platform is ready;
          the first game modules are coming next.
        </p>
        <span className="status">Foundation online</span>
      </section>

      <section className="principles" aria-labelledby="built-for-play">
        <h2 id="built-for-play">Built for play</h2>
        <ul>
          {principles.map((principle, index) => (
            <li key={principle}>
              <span>0{index + 1}</span>
              {principle}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
