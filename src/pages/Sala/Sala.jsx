import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  Radio,
  Copy,
  Users,
  Mic,
  BookOpen,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import "./Sala.css";


function Sala() {

  // useParams obtiene los datos variables de la URL.
  // Ejemplo:
  // /sala/12345
  //
  // id = "12345"
  const { id } = useParams();

  const navigate = useNavigate();


  // Aquí guardaremos la sala obtenida desde Supabase.
  const [sala, setSala] = useState(null);

  // Mientras Supabase responde mostramos "Cargando..."
  const [cargando, setCargando] = useState(true);

  // Aquí guardaremos cualquier error.
  const [error, setError] = useState("");


  // --------------------------------------------------
  // BUSCAR SALA EN SUPABASE
  // --------------------------------------------------

  useEffect(() => {

    async function cargarSala() {

      setCargando(true);
      setError("");


      // Buscamos en la tabla "salas".
      const { data, error: supabaseError } = await supabase
        .from("salas")
        .select("*")
        .eq("id", id)
        .single();


      // Si ocurre algún problema.
      if (supabaseError) {

        console.error(
          "Error al cargar la sala:",
          supabaseError
        );

        setError(
          "No se pudo encontrar la sala."
        );

        setCargando(false);

        return;
      }


      // Guardamos la sala encontrada.
      setSala(data);

      setCargando(false);
    }


    cargarSala();

  }, [id]);


  // --------------------------------------------------
  // COPIAR CÓDIGO
  // --------------------------------------------------

  async function copiarCodigo() {

    if (!sala?.codigo) {
      return;
    }

    await navigator.clipboard.writeText(
      sala.codigo
    );
  }


  // --------------------------------------------------
  // CARGANDO
  // --------------------------------------------------

  if (cargando) {

    return (
      <main className="sala-page">

        <div className="sala-loading">
          Cargando sala...
        </div>

      </main>
    );
  }


  // --------------------------------------------------
  // ERROR
  // --------------------------------------------------

  if (error) {

    return (
      <main className="sala-page">

        <div className="sala-error-page">

          <h2>
            Sala no encontrada
          </h2>

          <p>
            {error}
          </p>

          <button
            type="button"
            onClick={() => navigate("/")}
          >
            Volver al inicio
          </button>

        </div>

      </main>
    );
  }


  // --------------------------------------------------
  // PANTALLA DE LA SALA
  // --------------------------------------------------

  return (

    <main className="sala-page">

      {/* Encabezado */}
      <header className="sala-header">

        <button
          type="button"
          className="sala-back"
          onClick={() => navigate("/")}
          aria-label="Volver"
        >
          <ArrowLeft size={21} />
        </button>


        <div className="sala-header-title">

          <Radio size={18} />

          <span>
            Sala en vivo
          </span>

        </div>

      </header>


      <section className="sala-content">

        {/* Estado */}
        <div className="sala-status">

          <span className="sala-status-dot"></span>

          {sala.estado}

        </div>


        {/* Nombre de la sala */}
        <h1>
          {sala.nombre}
        </h1>


        <p className="sala-description">
          Comparte el código para que otras personas
          puedan unirse a esta sala.
        </p>


        {/* Código de la sala */}
        <div className="sala-code-card">

          <div>

            <span>
              Código de la sala
            </span>

            <strong>
              {sala.codigo}
            </strong>

          </div>


          <button
            type="button"
            onClick={copiarCodigo}
            aria-label="Copiar código"
          >
            <Copy size={20} />
          </button>

        </div>


        {/* Participantes */}
        <div className="sala-info-card">

          <div className="sala-info-icon">
            <Users size={22} />
          </div>

          <div>

            <span>
              Dispositivos conectados
            </span>

            <strong>
              1
            </strong>

          </div>

        </div>


        {/* Escucha */}
        <div className="sala-listening-card">

          <div className="sala-listening-icon">
            <Mic size={27} />
          </div>

          <h2>
            Esperando el culto
          </h2>

          <p>
            Cuando estés listo podremos comenzar
            a escuchar la predicación.
          </p>


          <button
            type="button"
            className="sala-start-button"
          >
            <Mic size={19} />

            Iniciar escucha
          </button>

        </div>


        {/* Versículo */}
        <div className="sala-verse-section">

          <div className="sala-section-title">

            <BookOpen size={19} />

            <h3>
              Último versículo detectado
            </h3>

          </div>


          <div className="sala-empty-verse">

            <BookOpen size={25} />

            <p>
              Todavía no se ha detectado
              ningún versículo.
            </p>

          </div>

        </div>

      </section>

    </main>

  );
}


export default Sala;