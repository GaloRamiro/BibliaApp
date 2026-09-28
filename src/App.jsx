import "./App.css";

function App() {
  return (
    <main className="app">
      <section className="hero">
        <div className="hero-content">
          <span className="badge">✦ Versículo en Vivo</span>

          <h1>
            La Palabra de Dios,
            <br />
            <span>en el momento.</span>
          </h1>

          <p>
            Una nueva forma de vivir la predicación. Conecta tu celular,
            escucha el mensaje y recibe los versículos en tiempo real.
          </p>

          <div className="hero-actions">
            <button className="primary-button">
              Crear una sala
            </button>

            <button className="secondary-button">
              Unirme a una sala
            </button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="bible-card">
            <div className="bible-icon">📖</div>

            <span className="reference">JUAN 3:16</span>

            <p>
              Porque de tal manera amó Dios al mundo, que ha dado a su Hijo
              unigénito, para que todo aquel que en él cree, no se pierda,
              mas tenga vida eterna.
            </p>

            <div className="live-status">
              <span></span>
              EN VIVO
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;