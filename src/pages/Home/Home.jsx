// useState nos permite guardar información que puede cambiar.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
// Componentes de nuestra aplicación.
import Header from "../../components/Header/Header";
import BottomNav from "../../components/BottomNav/BottomNav";
import VerseCard from "../../components/VerseCard/VerseCard";

// Estilos del Home.
import "./Home.css";

function Home() {
  const navigate = useNavigate();
  // --------------------------------------------------
  // TEMA CLARO / OSCURO
  // --------------------------------------------------

  // La aplicación comienza en modo claro.
  const [tema, setTema] = useState("light");

  // Cambia entre modo claro y oscuro.
  function cambiarTema() {
    if (tema === "light") {
      setTema("dark");
    } else {
      setTema("light");
    }
  }

  // --------------------------------------------------
  // PANTALLA HOME
  // --------------------------------------------------

  return (
    <main className="home" data-theme={tema}>
      {/* ==========================================
          ENCABEZADO
          ========================================== */}

      <Header tema={tema} cambiarTema={cambiarTema} />

      {/* ==========================================
          CONTENIDO PRINCIPAL
          ========================================== */}

      <section className="home-content">
        {/* Bienvenida */}
        <p className="home-welcome">Bienvenido</p>

        {/* Título principal */}
        <h1 className="home-title">
          Vive la Palabra
          <br />
          en tiempo real.
        </h1>

        {/* Descripción */}
        <p className="home-description">
          Escucha la predicación y recibe los versículos mencionados durante el
          culto.
        </p>

        {/* ========================================
            VERSÍCULO EN VIVO
            ======================================== */}

        <VerseCard
          referencia="Juan 3:16"
          texto="Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito."
        />

        {/* ========================================
            ACCIONES
            ======================================== */}

        <div className="home-actions">
          <button
            type="button"
            className="home-primary-button"
            onClick={() => navigate("/crear-sala")}
          >
            Crear sala
          </button>

          <button
            type="button"
            className="home-secondary-button"
            onClick={() => navigate("/unirse-sala")}
          >
            Unirme a una sala
          </button>
        </div>
      </section>

      {/* ==========================================
          MENÚ INFERIOR
          ========================================== */}

      <BottomNav />
    </main>
  );
}

export default Home;
