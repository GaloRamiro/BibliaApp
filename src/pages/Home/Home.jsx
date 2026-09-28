import VerseCard from "../../components/VerseCard/VerseCard";

import "./Home.css";

function Home() {
  return (
    <main className="home">

      {/* Contenido principal de la página Home */}
      <section className="home-content">

        <p className="home-welcome">
          Bienvenido
        </p>

        <h1 className="home-title">
          Vive la Palabra
          <br />
          en tiempo real.
        </h1>

        <p className="home-description">
          Escucha la predicación y recibe los versículos mencionados durante
          el culto.
        </p>

        {/* Tarjeta que recibe los datos del versículo */}
        <VerseCard
          referencia="Juan 3:16"
          texto="Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito."
        />

        <div className="home-actions">

          <button
            type="button"
            className="home-primary-button"
          >
            Crear sala
          </button>

          <button
            type="button"
            className="home-secondary-button"
          >
            Unirme a una sala
          </button>

        </div>

      </section>

    </main>
  );
}

export default Home;