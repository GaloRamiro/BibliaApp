import { useEffect, useRef, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import { buscarVersiculo } from "../../services/bibliaService";

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

import { detectarVersiculos } from "../../utils/detectarVersiculo";

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

  // Aquí guardaremos la última referencia bíblica detectada.
  //
  // Ejemplo:
  //
  // {
  //   libro: "Juan",
  //   capitulo: 3,
  //   versiculo: 16,
  //   referencia: "Juan 3:16"
  // }
  const [versiculoDetectado, setVersiculoDetectado] = useState(null);

  // Aquí guardaremos el texto que devuelve la API bíblica.
  //
  // Ejemplo:
  //
  // {
  //   referencia: "Juan 3:16",
  //   texto: "...",
  //   version: "RVR1909"
  // }
  const [textoVersiculo, setTextoVersiculo] = useState(null);

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

      // Cada pestaña o dispositivo tendrá
      // su propio identificador.
      const dispositivoId = crypto.randomUUID();

      // Creamos un canal diferente
      // para cada sala.
      canal = supabase.channel(`sala:${id}`, {
        config: {
          presence: {
            key: dispositivoId,
          },
        },
      });

      // Cuando cambia la presencia,
      // contamos nuevamente los dispositivos.
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

      // Nos suscribimos al canal.
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
    // Algunos navegadores utilizan SpeechRecognition.
    // Chrome normalmente utiliza webkitSpeechRecognition.
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    // Si el navegador no soporta
    // reconocimiento de voz.
    if (!SpeechRecognition) {
      setErrorMicrofono("Este navegador no soporta reconocimiento de voz.");

      return;
    }

    // Creamos nuestro reconocedor.
    const reconocimiento = new SpeechRecognition();

    // Queremos seguir escuchando.
    reconocimiento.continuous = true;

    // También queremos resultados parciales.
    reconocimiento.interimResults = true;

    // Español de Ecuador.
    reconocimiento.lang = "es-EC";

    // ------------------------------------------------
    // CUANDO EL NAVEGADOR RECONOCE PALABRAS
    // ------------------------------------------------

    reconocimiento.onresult = (event) => {
      let textoFinal = "";

      let textoTemporal = "";

      // event.results contiene los fragmentos
      // que Chrome está reconociendo.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const texto = event.results[i][0].transcript;

        // Si Chrome considera terminado
        // el fragmento, pasa a textoFinal.
        if (event.results[i].isFinal) {
          textoFinal += texto + " ";
        } else {
          textoTemporal += texto;
        }
      }

      // ------------------------------------------------
      // CUANDO TENEMOS TEXTO FINAL
      // ------------------------------------------------

      if (textoFinal) {
        // Agregamos el texto reconocido
        // a la transcripción completa.
        setTranscripcion((textoAnterior) => textoAnterior + textoFinal);

        // ----------------------------------------------
        // BUSCAR TODAS LAS REFERENCIAS BÍBLICAS
        // ----------------------------------------------

        const referenciasEncontradas = detectarVersiculos(textoFinal);

        console.log("Referencias encontradas:", referenciasEncontradas);

        // Si encontramos una o varias referencias...
        if (referenciasEncontradas.length > 0) {
          // Tomamos la última.
          //
          // Ejemplo:
          //
          // [
          //   Juan 3:16,
          //   Romanos 8:28,
          //   Mateo 5:14
          // ]
          //
          // Resultado:
          // Mateo 5:14

          const ultimaReferencia =
            referenciasEncontradas[referenciasEncontradas.length - 1];

          console.log("Último versículo detectado:", ultimaReferencia);

          // Mostramos inmediatamente
          // la referencia encontrada.
          setVersiculoDetectado(ultimaReferencia);

          // Limpiamos el texto anterior
          // mientras esperamos la API.
          setTextoVersiculo(null);

          // --------------------------------------------
          // CONSULTAR EL TEXTO REAL DEL VERSÍCULO
          // --------------------------------------------

          buscarVersiculo(
            ultimaReferencia.libro,
            ultimaReferencia.capitulo,
            ultimaReferencia.versiculo,
          ).then((resultado) => {
            console.log("Texto bíblico recibido:", resultado);

            // Si la API respondió correctamente,
            // guardamos el texto.
            if (resultado) {
              setTextoVersiculo(resultado);
            }
          });
        }
      }

      // El texto temporal todavía no lo mostramos
      // en pantalla.
      // Lo dejamos en consola para observar
      // cómo trabaja Chrome.
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

    // Guardamos el reconocedor
    // para poder usarlo desde el botón.
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
            {/* Ondas del micrófono */}

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

        {/* Último versículo detectado */}

        <div className="sala-verse-section">
          <div className="sala-section-title">
            <BookOpen size={19} />

            <h3>Último versículo detectado</h3>
          </div>

          {versiculoDetectado ? (
            <div className="sala-detected-verse">
              <div className="sala-detected-icon">
                <BookOpen size={23} />
              </div>

              <div className="sala-detected-content">
                <span>Referencia detectada</span>

                <strong>{versiculoDetectado.referencia}</strong>

                {/* Texto recibido desde la API */}

                {textoVersiculo && (
                  <>
                    <p className="sala-verse-text">{textoVersiculo.texto}</p>

                    <small className="sala-verse-version">
                      {textoVersiculo.version}
                    </small>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="sala-empty-verse">
              <BookOpen size={25} />

              <p>Todavía no se ha detectado ningún versículo.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default Sala;
