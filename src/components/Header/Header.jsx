// Importamos los dos iconos para los temas.
import {
  Bell,
  Moon,
  Sun,
} from "lucide-react";

import "./Header.css";


// Header ahora recibe información desde Home.
//
// tema         → tema actualmente seleccionado.
// cambiarTema  → función creada en Home.
function Header({ tema, cambiarTema }) {

  return (
    <header className="app-header">

      <div className="header-text">

        <small>Versículo en Vivo</small>

        <h2>La Palabra contigo</h2>

      </div>


      {/* Acciones del encabezado */}
      <div className="header-actions">

        {/* Botón para cambiar el tema */}
        <button
          type="button"
          className="header-button"
          onClick={cambiarTema}
          aria-label="Cambiar tema"
        >

          {/* 
            Si estamos en dark mostramos Sun.
            Si estamos en light mostramos Moon.
          */}
          {tema === "dark"
            ? <Sun size={20} />
            : <Moon size={20} />
          }

        </button>


        {/* Notificaciones */}
        <button
          type="button"
          className="header-button"
          aria-label="Notificaciones"
        >
          <Bell size={20} />
        </button>

      </div>

    </header>
  );
}

export default Header;