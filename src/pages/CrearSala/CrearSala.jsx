import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ArrowLeft, Radio, Hash, Church } from "lucide-react";

import { supabase } from "../../lib/supabase";

import "./CrearSala.css";

function CrearSala() {
  const navigate = useNavigate();

  // Nombre que escribe el usuario.
  const [nombre, setNombre] = useState("");

  // Nos dice si estamos guardando.
  const [cargando, setCargando] = useState(false);

  // Mensaje de error.
  const [error, setError] = useState("");

  // --------------------------------------------------
  // GENERAR CÓDIGO DE SALA
  // --------------------------------------------------

  function generarCodigo() {
    const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let codigo = "";

    // Generamos un código de 6 caracteres.
    for (let i = 0; i < 6; i++) {
      const posicion = Math.floor(Math.random() * caracteres.length);

      codigo += caracteres[posicion];
    }

    return codigo;
  }

  // --------------------------------------------------
  // CREAR SALA
  // --------------------------------------------------

  async function crearSala(event) {
    event.preventDefault();

    setError("");

    // Validamos que exista un nombre.
    if (!nombre.trim()) {
      setError("Escribe un nombre para la sala.");
      return;
    }

    setCargando(true);

    // Generamos el código.
    const codigo = generarCodigo();

    // Guardamos la sala en Supabase.
    const { data, error: supabaseError } = await supabase
      .from("salas")
      .insert({
        nombre: nombre.trim(),
        codigo: codigo,
        estado: "activa",
      })
      .select()
      .single();

    // Si Supabase devuelve un error.
    if (supabaseError) {
      console.error("Error al crear sala:", supabaseError);

      setError("No se pudo crear la sala. Inténtalo nuevamente.");

      setCargando(false);

      return;
    }

    // Todo salió correctamente.
    setCargando(false);

    // Entramos directamente a la sala que acabamos de crear.
    navigate(`/sala/${data.id}`);
  }

  return (
    <main className="crear-sala-page">
      {/* Encabezado */}
      <header className="crear-sala-header">
        <button
          type="button"
          className="crear-sala-back"
          onClick={() => navigate("/")}
          aria-label="Volver"
        >
          <ArrowLeft size={21} />
        </button>

        <span>Nueva sala</span>
      </header>

      <section className="crear-sala-content">
        {/* Icono */}
        <div className="crear-sala-icon">
          <Radio size={28} />
        </div>

        <p className="crear-sala-small">Transmisión en vivo</p>

        <h1>Crear una sala</h1>

        <p className="crear-sala-description">
          Crea una sala para comenzar a detectar y compartir los versículos
          mencionados durante el culto.
        </p>

        {/* Formulario */}
        <form className="crear-sala-form" onSubmit={crearSala}>
          <div className="crear-sala-field">
            <label htmlFor="nombreSala">Nombre de la sala</label>

            <div className="crear-sala-input">
              <Church size={19} />

              <input
                id="nombreSala"
                type="text"
                placeholder="Ej. Culto Dominical"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                maxLength={80}
              />
            </div>
          </div>

          {/* Explicación del código */}
          <div className="crear-sala-code-info">
            <Hash size={20} />

            <div>
              <strong>Código automático</strong>

              <p>
                Al crear la sala generaremos un código para que otras personas
                puedan unirse.
              </p>
            </div>
          </div>

          {/* Error */}
          {error && <p className="crear-sala-error">{error}</p>}

          <button
            type="submit"
            className="crear-sala-submit"
            disabled={cargando}
          >
            <Radio size={19} />

            {cargando ? "Creando sala..." : "Crear sala"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default CrearSala;
