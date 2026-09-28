import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  Radio,
  Copy,
  Users,
  Mic,
  MicOff,
  BookOpen,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import "./Sala.css";

function Sala() {
  // Obtenemos el ID de la sala desde la URL.
  const { id } = useParams();

  const navigate = useNavigate();

  // --------------------------------------------------
  // ESTADOS GENERALES
  // --------------------------------------------------

  const [sala, setSala] = useState(null);

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState("");

  const [conectados, setConectados] = useState(0);

  // --------------------------------------------------
  // ESTADOS DEL MICRÓFONO
  // --------------------------------------------------

  // Nos indica si actualmente estamos escuchando.
  const [escuchando, setEscuchando] = useState(false);

  // Aquí guardaremos todo lo que el navegador entienda.
  const [transcripcion, setTranscripcion] = useState("");

  // Mensaje relacionado con el micrófono.
  const [errorMicrofono, setErrorMicrofono] = useState("");

  // useRef nos permite guardar el objeto SpeechRecognition
  // sin perderlo cada vez que React actualiza la pantalla.
  const reconocimientoRef = useRef(null);

  // --------------------------------------------------
  // BUSCAR SALA EN SUPABASE
  // --------------------------------------------------

  useEffect(() => {
    async function cargarSala() {
      setCargando(true);

      setError("");

      const { data, error: supabaseError } = await supabase
        .from("salas")
        .select("*")
        .eq("id", id)
        .single();

      if (supabaseError) {
        console.error("Error al cargar la sala:", supabaseError);

        setError("No se pudo encontrar la sala.");

        setCargando(false);

        return;
      }

      setSala(data);

      setCargando(false);
    }

    cargarSala();
  }, [id]);

  // --------------------------------------------------
  // REALTIME PRESENCE
  // --------------------------------------------------

  useEffect(() => {
    let canal;

    async function conectarRealtime() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      // Cada pestaña/dispositivo tendrá su propio ID.
      const dispositivoId = crypto.randomUUID();

      // Creamos un canal diferente para cada sala.
      canal = supabase.channel(`sala:${id}`, {
        config: {
          presence: {
            key: dispositivoId,
          },
        },
      });

      // Cuando cambia la presencia,
      // volvemos a contar los dispositivos.
      canal.on(
        "presence",
        {
          event: "sync",
        },
        () => {
          const estado = canal.presenceState();

          const cantidad = Object.keys(estado).length;

          setConectados(cantidad);
        },
      );

      canal.subscribe(async (estado) => {
        if (estado === "SUBSCRIBED") {
          await canal.track({
            dispositivo_id: dispositivoId,

            usuario_id: user.id,

            conectado_en: new Date().toISOString(),
          });
        }
      });
    }

    conectarRealtime();

    // Cuando salimos de la página,
    // eliminamos nuestra conexión.
    return () => {
      if (canal) {
        supabase.removeChannel(canal);
      }
    };
  }, [id]);

  // --------------------------------------------------
  // PREPARAR RECONOCIMIENTO DE VOZ
  // --------------------------------------------------

  useEffect(() => {
    // Algunos navegadores usan SpeechRecognition.
    // Chrome normalmente utiliza webkitSpeechRecognition.
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    // Si el navegador no soporta esta tecnología.
    if (!SpeechRecognition) {
      setErrorMicrofono("Este navegador no soporta reconocimiento de voz.");

      return;
    }

    // Creamos nuestro reconocedor.
    const reconocimiento = new SpeechRecognition();

    // Queremos seguir escuchando.
    reconocimiento.continuous = true;

    // Queremos resultados parciales mientras hablamos.
    reconocimiento.interimResults = true;

    // Idioma del reconocimiento.
    reconocimiento.lang = "es-EC";

    // ------------------------------------------------
    // CUANDO EL NAVEGADOR RECONOCE PALABRAS
    // ------------------------------------------------

    reconocimiento.onresult = (event) => {
      let textoFinal = "";

      let textoTemporal = "";

      // event.results contiene todos los fragmentos
      // que el navegador ha reconocido.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const texto = event.results[i][0].transcript;

        // isFinal significa que el navegador
        // considera terminado ese fragmento.
        if (event.results[i].isFinal) {
          textoFinal += texto + " ";
        } else {
          textoTemporal += texto;
        }
      }

      // Guardamos solamente los fragmentos finales
      // en nuestro historial.
      if (textoFinal) {
        setTranscripcion((textoAnterior) => textoAnterior + textoFinal);
      }

      // El texto temporal lo mostramos en consola
      // por ahora para entender cómo funciona.
      if (textoTemporal) {
        console.log("Escuchando:", textoTemporal);
      }
    };

    // ------------------------------------------------
    // SI OCURRE UN ERROR
    // ------------------------------------------------

    reconocimiento.onerror = (event) => {
      console.error("Error de reconocimiento:", event.error);

      if (event.error === "not-allowed") {
        setErrorMicrofono("Debes permitir el acceso al micrófono.");
      } else if (event.error === "no-speech") {
        setErrorMicrofono("No se detectó voz. Intenta hablar nuevamente.");
      } else {
        setErrorMicrofono("Ocurrió un problema con el reconocimiento de voz.");
      }
    };

    // ------------------------------------------------
    // CUANDO TERMINA LA ESCUCHA
    // ------------------------------------------------

    reconocimiento.onend = () => {
      setEscuchando(false);
    };

    // Guardamos el reconocedor.
    reconocimientoRef.current = reconocimiento;

    // Si salimos de la pantalla,
    // detenemos el micrófono.
    return () => {
      reconocimiento.stop();
    };
  }, []);

  // --------------------------------------------------
  // INICIAR / DETENER ESCUCHA
  // --------------------------------------------------

  function cambiarEscucha() {
    const reconocimiento = reconocimientoRef.current;

    if (!reconocimiento) {
      return;
    }

    setErrorMicrofono("");

    // Si ya está escuchando,
    // lo detenemos.
    if (escuchando) {
      reconocimiento.stop();

      setEscuchando(false);

      return;
    }

    // Si está detenido,
    // comenzamos a escuchar.
    try {
      reconocimiento.start();

      setEscuchando(true);
    } catch (errorReconocimiento) {
      console.error("No se pudo iniciar el micrófono:", errorReconocimiento);
    }
  }

  // --------------------------------------------------
  // COPIAR CÓDIGO
  // --------------------------------------------------

  async function copiarCodigo() {
    if (!sala?.codigo) {
      return;
    }

    await navigator.clipboard.writeText(sala.codigo);
  }

  // --------------------------------------------------
  // CARGANDO
  // --------------------------------------------------

  if (cargando) {
    return (
      <main className="sala-page">
        <div className="sala-loading">Cargando sala...</div>
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
          <h2>Sala no encontrada</h2>

          <p>{error}</p>

          <button type="button" onClick={() => navigate("/")}>
            Volver al inicio
          </button>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // PANTALLA
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

          <span>Sala en vivo</span>
        </div>
      </header>

      <section className="sala-content">
        {/* Estado */}
        <div className="sala-status">
          <span className="sala-status-dot"></span>

          {sala.estado}
        </div>

        <h1>{sala.nombre}</h1>

        <p className="sala-description">
          Comparte el código para que otras personas puedan unirse a esta sala.
        </p>

        {/* Código */}
        <div className="sala-code-card">
          <div>
            <span>Código de la sala</span>

            <strong>{sala.codigo}</strong>
          </div>

          <button
            type="button"
            onClick={copiarCodigo}
            aria-label="Copiar código"
          >
            <Copy size={20} />
          </button>
        </div>

        {/* Dispositivos conectados */}
        <div className="sala-info-card">
          <div className="sala-info-icon">
            <Users size={22} />
          </div>

          <div>
            <span>Dispositivos conectados</span>

            <strong>{conectados}</strong>
          </div>
        </div>

        {/* Reconocimiento de voz */}
        <div className="sala-listening-card">
          <div
            className={
              escuchando
                ? "sala-listening-icon escuchando"
                : "sala-listening-icon"
            }
          >
            {/* Ondas que aparecen cuando el micrófono está activo */}
            {escuchando && (
              <>
                <span className="mic-wave mic-wave-1"></span>
                <span className="mic-wave mic-wave-2"></span>
                <span className="mic-wave mic-wave-3"></span>
              </>
            )}

            {escuchando ? <Mic size={27} /> : <MicOff size={27} />}
          </div>

          <h2>
            {escuchando ? "Escuchando predicación" : "Esperando el culto"}
          </h2>

          <p>
            {escuchando
              ? "Habla normalmente. Estamos convirtiendo la voz en texto."
              : "Cuando estés listo podremos comenzar a escuchar la predicación."}
          </p>

          <button
            type="button"
            className={
              escuchando ? "sala-start-button escuchando" : "sala-start-button"
            }
            onClick={cambiarEscucha}
          >
            {escuchando ? <MicOff size={19} /> : <Mic size={19} />}

            {escuchando ? "Detener escucha" : "Iniciar escucha"}
          </button>

          {/* Error del micrófono */}
          {errorMicrofono && (
            <p className="sala-microphone-error">{errorMicrofono}</p>
          )}
        </div>

        {/* Transcripción */}
        <div className="sala-transcription-section">
          <div className="sala-section-title">
            <Radio size={19} />

            <h3>Transcripción en vivo</h3>
          </div>

          <div className="sala-transcription-card">
            {transcripcion ? (
              <p>{transcripcion}</p>
            ) : (
              <p className="sala-transcription-empty">
                La predicación aparecerá aquí mientras hablamos.
              </p>
            )}
          </div>
        </div>

        {/* Versículo */}
        <div className="sala-verse-section">
          <div className="sala-section-title">
            <BookOpen size={19} />

            <h3>Último versículo detectado</h3>
          </div>

          <div className="sala-empty-verse">
            <BookOpen size={25} />

            <p>Todavía no se ha detectado ningún versículo.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Sala;
