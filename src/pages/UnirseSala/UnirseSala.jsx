import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ArrowLeft, LogIn, Hash, Users } from "lucide-react";

import { supabase } from "../../lib/supabase";

import "./UnirseSala.css";

function UnirseSala() {
  const navigate = useNavigate();

  // Código que escribe el usuario.
  const [codigo, setCodigo] = useState("");

  // Controla el estado del botón mientras buscamos.
  const [cargando, setCargando] = useState(false);

  // Aquí mostramos posibles errores.
  const [error, setError] = useState("");

  // --------------------------------------------------
  // UNIRSE A UNA SALA
  // --------------------------------------------------

  async function unirseSala(event) {
    event.preventDefault();

    setError("");

    // Quitamos espacios y convertimos a mayúsculas.
    const codigoLimpio = codigo.trim().toUpperCase();

    // Validamos que haya escrito algo.
    if (!codigoLimpio) {
      setError("Escribe el código de la sala.");

      return;
    }

    setCargando(true);

    // --------------------------------------------------
    // BUSCAR SALA POR CÓDIGO
    // --------------------------------------------------

    const { data, error: supabaseError } = await supabase
      .from("salas")
      .select("*")
      .eq("codigo", codigoLimpio)
      .maybeSingle();

    // Error de Supabase.
    if (supabaseError) {
      console.error("Error buscando la sala:", supabaseError);

      setError("Ocurrió un problema al buscar la sala.");

      setCargando(false);

      return;
    }

    // No encontramos ninguna sala.
    if (!data) {
      setError("No existe una sala con ese código.");

      setCargando(false);

      return;
    }

    // La sala existe pero ya no está activa.
    if (data.estado !== "activa") {
      setError("Esta sala ya no está activa.");

      setCargando(false);

      return;
    }

    // --------------------------------------------------
    // ENTRAR A LA SALA
    // --------------------------------------------------

    setCargando(false);

    navigate(`/sala/${data.id}`);
  }

  return (
    <main className="unirse-sala-page">
      {/* Encabezado */}
      <header className="unirse-sala-header">
        <button
          type="button"
          className="unirse-sala-back"
          onClick={() => navigate("/")}
          aria-label="Volver"
        >
          <ArrowLeft size={21} />
        </button>

        <span>Unirme a una sala</span>
      </header>

      <section className="unirse-sala-content">
        {/* Icono principal */}
        <div className="unirse-sala-icon">
          <Users size={29} />
        </div>

        <p className="unirse-sala-small">Participar en vivo</p>

        <h1>Ingresa a una sala</h1>

        <p className="unirse-sala-description">
          Escribe el código que aparece en la pantalla del culto para conectarte
          a la sala.
        </p>

        {/* Formulario */}
        <form className="unirse-sala-form" onSubmit={unirseSala}>
          <div className="unirse-sala-field">
            <label htmlFor="codigoSala">Código de la sala</label>

            <div className="unirse-sala-input">
              <Hash size={20} />

              <input
                id="codigoSala"
                type="text"
                placeholder="Ej. B6FWU8"
                value={codigo}
                onChange={(event) =>
                  setCodigo(event.target.value.toUpperCase())
                }
                maxLength={6}
                autoComplete="off"
              />
            </div>
          </div>

          <p className="unirse-sala-help">El código contiene 6 caracteres.</p>

          {/* Mensaje de error */}
          {error && <p className="unirse-sala-error">{error}</p>}

          <button
            type="submit"
            className="unirse-sala-submit"
            disabled={cargando}
          >
            <LogIn size={19} />

            {cargando ? "Buscando sala..." : "Unirme a la sala"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default UnirseSala;
