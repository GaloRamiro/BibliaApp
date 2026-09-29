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
import { buscarVersiculo } from "../../services/bibliaService";
import { detectarVersiculos } from "../../utils/detectarVersiculo";
// ==================================================
// CONFIGURACIÓN DEL CONSENSO
// ==================================================

// Para esta primera prueba necesitamos
// 2 dispositivos diferentes.

const VOTOS_NECESARIOS = 2;

// Las detecciones deben ocurrir dentro
// de una ventana de 5 segundos.

const VENTANA_CONSENSO_MS = 5000;
import "./Sala.css";

function Sala() {
  // ==================================================
  // DATOS DE LA RUTA
  // ==================================================

  const { id } = useParams();

  const navigate = useNavigate();

  // ==================================================
  // ESTADOS GENERALES
  // ==================================================

  const [sala, setSala] = useState(null);

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState("");

  const [conectados, setConectados] = useState(0);

  // ==================================================
  // ESTADOS DEL MICRÓFONO
  // ==================================================

  const [escuchando, setEscuchando] = useState(false);

  const [transcripcion, setTranscripcion] = useState("");

  const [errorMicrofono, setErrorMicrofono] = useState("");

  // ==================================================
  // ESTADOS DE LOS VERSÍCULOS
  // ==================================================

  // Última referencia detectada.
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

  // Texto real obtenido desde la API bíblica.

  const [textoVersiculo, setTextoVersiculo] = useState(null);

  // Todos los versículos detectados
  // durante la predicación.

  const [historialVersiculos, setHistorialVersiculos] = useState([]);

  // ==================================================
  // ESTADOS DEL CONSENSO
  // ==================================================

  // Aquí iremos guardando las detecciones
  // que lleguen desde todos los dispositivos
  // mediante Supabase Realtime.

  const [deteccionesRecientes, setDeteccionesRecientes] = useState([]);

  // Más adelante aquí guardaremos algo como:
  //
  // {
  //   referencia: "Salmos 23:1",
  //   votos: 2
  // }

  const [consenso, setConsenso] = useState(null);

  // ==================================================
  // REFERENCIA AL RECONOCIMIENTO DE VOZ
  // ==================================================

  const reconocimientoRef = useRef(null);

  // ==================================================
  // IDENTIFICADOR DEL DISPOSITIVO
  // ==================================================
  //
  // Cada pestaña o dispositivo obtiene
  // un identificador diferente.
  //
  // Ese MISMO identificador se utilizará para:
  //
  // 1. Presence
  // 2. Guardar detecciones
  // 3. Calcular consenso
  //
  // useRef permite conservar el mismo ID
  // durante toda la vida de esta pantalla.
  // ==================================================

  const dispositivoIdRef = useRef(crypto.randomUUID());
  // ==================================================
  // ÚLTIMA CONFIRMACIÓN GUARDADA
  // ==================================================
  //
  // Evita que varios eventos Realtime provoquen
  // que este dispositivo intente guardar muchas veces
  // el mismo consenso seguido.

  const ultimaConfirmacionRef = useRef({
    referencia: null,
    tiempo: 0,
  });
  // ==================================================
  // CARGAR SALA DESDE SUPABASE
  // ==================================================

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

  // ==================================================
  // REALTIME PRESENCE
  // ==================================================
  //
  // Presence nos permite saber cuántos
  // dispositivos están actualmente
  // conectados a esta sala.
  // ==================================================

  useEffect(() => {
    let activo = true;

    let canal = null;

    async function conectarRealtime() {
      // Obtenemos al usuario conectado.

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // React pudo desmontar este efecto
      // mientras esperábamos la respuesta.

      if (!activo || !user) {
        return;
      }

      // Utilizamos el identificador
      // permanente de esta pestaña.

      const dispositivoId = dispositivoIdRef.current;

      // Todos los dispositivos de la misma sala
      // utilizan el mismo canal.

      canal = supabase.channel(`sala:${id}`, {
        config: {
          presence: {
            key: dispositivoId,
          },
        },
      });

      // ==================================================
      // PRESENCE SYNC
      // ==================================================

      canal.on(
        "presence",
        {
          event: "sync",
        },
        () => {
          if (!activo || !canal) {
            return;
          }

          const estado = canal.presenceState();

          // Cada key representa
          // un dispositivo conectado.

          const cantidad = Object.keys(estado).length;

          setConectados(cantidad);
        },
      );

      if (!activo) {
        return;
      }

      // ==================================================
      // CONECTARNOS
      // ==================================================

      canal.subscribe(async (estado) => {
        if (estado !== "SUBSCRIBED") {
          return;
        }

        if (!activo || !canal) {
          return;
        }

        try {
          await canal.track({
            dispositivo_id: dispositivoId,

            usuario_id: user.id,

            conectado_en: new Date().toISOString(),
          });
        } catch (errorPresence) {
          if (activo) {
            console.error("Error al registrar Presence:", errorPresence);
          }
        }
      });
    }

    conectarRealtime();

    // ==================================================
    // LIMPIEZA
    // ==================================================

    return () => {
      activo = false;

      if (canal) {
        supabase.removeChannel(canal);

        canal = null;
      }
    };
  }, [id]);

  // ==================================================
  // REALTIME - DETECCIONES DE LA SALA
  // ==================================================
  //
  // Este canal es diferente al de Presence.
  //
  // Presence:
  //
  // sala:ID
  //
  // Detecciones:
  //
  // detecciones:ID
  //
  // Cada vez que un dispositivo inserte
  // una nueva fila en la tabla detecciones,
  // Supabase nos avisará.
  // ==================================================

  useEffect(() => {
    let activo = true;

    const canalDetecciones = supabase
      .channel(`detecciones:${id}`)

      .on(
        "postgres_changes",
        {
          event: "INSERT",

          schema: "public",

          table: "detecciones",

          // Solo queremos detecciones
          // pertenecientes a ESTA sala.

          filter: `sala_id=eq.${id}`,
        },

        (payload) => {
          if (!activo) {
            return;
          }

          // payload.new contiene la nueva fila
          // insertada en Supabase.

          const nuevaDeteccion = payload.new;

          console.log("Detección recibida por Realtime:", nuevaDeteccion);

          // Guardamos temporalmente la detección
          // para después calcular el consenso.

          setDeteccionesRecientes((anteriores) => [
            ...anteriores,
            nuevaDeteccion,
          ]);
        },
      )

      .subscribe((estado) => {
        if (estado === "SUBSCRIBED") {
          console.log("Escuchando detecciones Realtime de la sala:", id);
        }
      });

    // ==================================================
    // LIMPIEZA DEL CANAL
    // ==================================================

    return () => {
      activo = false;

      supabase.removeChannel(canalDetecciones);
    };
  }, [id]);
  // ==================================================
  // CARGAR HISTORIAL GLOBAL DE LA SALA
  // ==================================================
  //
  // Cuando entramos o recargamos la sala,
  // recuperamos los versículos que ya fueron
  // confirmados anteriormente.
  //
  // Así el historial no depende del dispositivo.
  // ==================================================

  useEffect(() => {
    let activo = true;

    async function cargarHistorialGlobal() {
      const { data, error: errorHistorial } = await supabase
        .from("versiculos_confirmados")
        .select("*")
        .eq("sala_id", id)
        .order("created_at", { ascending: true });

      if (!activo) {
        return;
      }

      if (errorHistorial) {
        console.error("Error al cargar historial global:", errorHistorial);

        return;
      }

      console.log("Historial global cargado:", data);

      setHistorialVersiculos(data || []);
    }

    cargarHistorialGlobal();

    return () => {
      activo = false;
    };
  }, [id]);
  // ==================================================
  // REALTIME - VERSÍCULOS CONFIRMADOS
  // ==================================================
  //
  // Este canal escucha la confirmación oficial
  // de la sala.
  //
  // Cuando cualquier dispositivo consiga consenso
  // y guarde el versículo en Supabase,
  // TODOS los dispositivos conectados a la sala
  // recibirán esta fila.
  // ==================================================

  useEffect(() => {
    let activo = true;

    const canalConfirmados = supabase
      .channel(`confirmados:${id}`)

      .on(
        "postgres_changes",
        {
          event: "INSERT",

          schema: "public",

          table: "versiculos_confirmados",

          // Solo escuchamos confirmaciones
          // pertenecientes a esta sala.
          filter: `sala_id=eq.${id}`,
        },

        (payload) => {
          if (!activo) {
            return;
          }

          // La fila que acaba de insertarse
          // en versiculos_confirmados.
          const confirmado = payload.new;

          console.log(
            "Versículo confirmado recibido por Realtime:",
            confirmado,
          );

          // ==================================================
          // ACTUALIZAR CONSENSO GLOBAL
          // ==================================================
          //
          // Ya no importa qué teléfono calculó
          // originalmente el consenso.
          //
          // Todos reciben la confirmación oficial.
          // ==================================================

          setConsenso({
            referencia: confirmado.referencia,

            libro: confirmado.libro,

            capitulo: confirmado.capitulo,

            versiculo: confirmado.versiculo,

            votos: confirmado.votos,

            confirmadoEn: confirmado.created_at,
          });
          // ==================================================
          // MOSTRAR EL VERSÍCULO CONFIRMADO EN TODOS
          // ==================================================
          //
          // El consenso ya es oficial.
          //
          // Por eso este versículo se convierte ahora
          // en el versículo visible para toda la sala.
          // ==================================================

          const referenciaConfirmada = {
            libro: confirmado.libro,

            capitulo: confirmado.capitulo,

            versiculo: confirmado.versiculo,

            referencia: confirmado.referencia,
          };

          // Mostramos la referencia confirmada
          // en este dispositivo.

          setVersiculoDetectado(referenciaConfirmada);

          // Limpiamos el texto anterior mientras
          // consultamos el nuevo versículo.

          setTextoVersiculo(null);

          // ==================================================
          // CONSULTAR TEXTO BÍBLICO
          // ==================================================
          //
          // Cada dispositivo consulta el texto
          // correspondiente al versículo confirmado.
          // ==================================================

          buscarVersiculo(
            confirmado.libro,
            confirmado.capitulo,
            confirmado.versiculo,
          ).then((resultado) => {
            console.log("Texto del versículo confirmado:", resultado);

            if (resultado) {
              setTextoVersiculo(resultado);
            }
          });
        },
      )

      .subscribe((estado) => {
        if (estado === "SUBSCRIBED") {
          console.log("Escuchando versículos confirmados de la sala:", id);
        }
      });

    // ==================================================
    // LIMPIEZA
    // ==================================================

    return () => {
      activo = false;

      supabase.removeChannel(canalConfirmados);
    };
  }, [id]);
  // ==================================================
  // GUARDAR VERSÍCULO CONFIRMADO
  // ==================================================

  async function guardarVersiculoConfirmado(deteccion, votos) {
    try {
      const ahora = Date.now();

      const ultimaConfirmacion = ultimaConfirmacionRef.current;

      // ==================================================
      // EVITAR DUPLICADOS SEGUIDOS
      // ==================================================
      //
      // Si este mismo dispositivo ya confirmó
      // la misma referencia hace menos de 10 segundos,
      // no volvemos a insertarla.

      if (
        ultimaConfirmacion.referencia === deteccion.referencia &&
        ahora - ultimaConfirmacion.tiempo < 10000
      ) {
        console.log("Confirmación duplicada ignorada:", deteccion.referencia);

        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error("No existe un usuario autenticado.");

        return;
      }

      const nuevoConfirmado = {
        sala_id: id,

        libro: deteccion.libro,

        capitulo: deteccion.capitulo,

        versiculo: deteccion.versiculo,

        referencia: deteccion.referencia,

        votos,

        confirmado_por: user.id,
      };

      console.log("Guardando versículo confirmado:", nuevoConfirmado);

      const { data, error: errorConfirmacion } = await supabase
        .from("versiculos_confirmados")
        .insert(nuevoConfirmado)
        .select()
        .single();

      if (errorConfirmacion) {
        console.error(
          "Error al guardar versículo confirmado:",
          errorConfirmacion,
        );

        return;
      }

      // Solo marcamos el bloqueo después
      // de que Supabase confirme el INSERT.

      ultimaConfirmacionRef.current = {
        referencia: deteccion.referencia,

        tiempo: ahora,
      };

      console.log("Versículo confirmado guardado:", data);
    } catch (errorGuardar) {
      console.error("Error inesperado guardando consenso:", errorGuardar);
    }
  }
  // ==================================================
  // MOTOR DE CONSENSO
  // ==================================================
  //
  // Cada vez que llega una nueva detección,
  // revisamos las detecciones recientes.
  //
  // Para confirmar un versículo necesitamos:
  //
  // 1. Misma referencia.
  // 2. Misma sala.
  // 3. Detectada recientemente.
  // 4. Dispositivos diferentes.
  // ==================================================

  useEffect(() => {
    // Si todavía no tenemos detecciones,
    // no hay nada que analizar.

    if (deteccionesRecientes.length === 0) {
      return;
    }

    // ==================================================
    // OBTENER LA DETECCIÓN MÁS RECIENTE
    // ==================================================

    const ultimaDeteccion =
      deteccionesRecientes[deteccionesRecientes.length - 1];

    if (!ultimaDeteccion) {
      return;
    }

    // Momento en que Supabase registró
    // la última detección.

    const tiempoUltimaDeteccion = new Date(
      ultimaDeteccion.created_at,
    ).getTime();

    // ==================================================
    // BUSCAR DETECCIONES COMPATIBLES
    // ==================================================
    //
    // Queremos detecciones:
    //
    // - del mismo versículo
    // - ocurridas cerca de la última
    // ==================================================

    const deteccionesCompatibles = deteccionesRecientes.filter((deteccion) => {
      const tiempoDeteccion = new Date(deteccion.created_at).getTime();

      const diferenciaTiempo = Math.abs(
        tiempoUltimaDeteccion - tiempoDeteccion,
      );

      return (
        deteccion.referencia === ultimaDeteccion.referencia &&
        diferenciaTiempo <= VENTANA_CONSENSO_MS
      );
    });

    // ==================================================
    // CONTAR DISPOSITIVOS DIFERENTES
    // ==================================================
    //
    // Set elimina valores repetidos.
    //
    // Ejemplo:
    //
    // [A, A, A]
    //
    // se convierte en:
    //
    // [A]
    //
    // Por lo tanto un dispositivo no puede
    // votar varias veces.
    // ==================================================

    const dispositivosUnicos = new Set(
      deteccionesCompatibles.map((deteccion) => deteccion.dispositivo_id),
    );

    const cantidadVotos = dispositivosUnicos.size;

    console.log(
      "Analizando consenso:",
      ultimaDeteccion.referencia,
      "Votos:",
      cantidadVotos,
    );

    // ==================================================
    // ¿SE ALCANZÓ EL CONSENSO?
    // ==================================================

    if (cantidadVotos >= VOTOS_NECESARIOS) {
      const nuevoConsenso = {
        referencia: ultimaDeteccion.referencia,

        libro: ultimaDeteccion.libro,

        capitulo: ultimaDeteccion.capitulo,

        versiculo: ultimaDeteccion.versiculo,

        votos: cantidadVotos,

        confirmadoEn: new Date().toISOString(),
      };

      console.log("CONSENSO ALCANZADO:", nuevoConsenso);

      setConsenso(nuevoConsenso);

      // Además de mostrarlo localmente,
      // guardamos la confirmación oficial
      // de la sala en Supabase.

      guardarVersiculoConfirmado(ultimaDeteccion, cantidadVotos);
    }
  }, [deteccionesRecientes]);
  // ==================================================
  // GUARDAR DETECCIÓN EN SUPABASE
  // ==================================================
  //
  // Ejemplo recibido:
  //
  // {
  //   libro: "Salmos",
  //   capitulo: 23,
  //   versiculo: 1,
  //   referencia: "Salmos 23:1"
  // }
  //
  // Después guardamos:
  //
  // sala
  // dispositivo
  // usuario
  // libro
  // capítulo
  // versículo
  // referencia
  // ==================================================

  async function guardarDeteccion(referencia) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error(
          "No hay un usuario autenticado para guardar la detección.",
        );

        return;
      }

      const nuevaDeteccion = {
        sala_id: id,

        dispositivo_id: dispositivoIdRef.current,

        usuario_id: user.id,

        libro: referencia.libro,

        capitulo: referencia.capitulo,

        versiculo: referencia.versiculo,

        referencia: referencia.referencia,
      };

      console.log("Guardando detección en Supabase:", nuevaDeteccion);

      const { data, error: errorDeteccion } = await supabase
        .from("detecciones")
        .insert(nuevaDeteccion)
        .select()
        .single();

      if (errorDeteccion) {
        console.error("Error al guardar detección:", errorDeteccion);

        return;
      }

      console.log("Detección guardada correctamente:", data);
    } catch (errorGuardar) {
      console.error("Error inesperado al guardar detección:", errorGuardar);
    }
  }

  // ==================================================
  // RECONOCIMIENTO DE VOZ
  // ==================================================

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    // Revisamos si el navegador
    // soporta reconocimiento de voz.

    if (!SpeechRecognition) {
      setErrorMicrofono("Este navegador no soporta reconocimiento de voz.");

      return;
    }

    // Creamos el reconocedor.

    const reconocimiento = new SpeechRecognition();

    // Queremos que siga escuchando.

    reconocimiento.continuous = true;

    // También recibiremos
    // texto temporal.

    reconocimiento.interimResults = true;

    // Español de Ecuador.

    reconocimiento.lang = "es-EC";

    // ==================================================
    // CUANDO CHROME RECONOCE VOZ
    // ==================================================

    reconocimiento.onresult = (event) => {
      let textoFinal = "";

      let textoTemporal = "";

      // Recorremos todos los resultados
      // entregados por Chrome.

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const texto = event.results[i][0].transcript;

        // Chrome considera este fragmento
        // como definitivo.

        if (event.results[i].isFinal) {
          textoFinal += texto + " ";
        } else {
          textoTemporal += texto;
        }
      }

      // ==================================================
      // TEXTO FINAL
      // ==================================================

      if (textoFinal) {
        // Agregamos el texto
        // a la transcripción.

        setTranscripcion((textoAnterior) => textoAnterior + textoFinal);

        // Buscamos todas las referencias
        // bíblicas presentes en este fragmento.

        const referenciasEncontradas = detectarVersiculos(textoFinal);

        console.log("Referencias encontradas:", referenciasEncontradas);

        if (referenciasEncontradas.length > 0) {
          // ==================================================
          // GUARDAR EN HISTORIAL LOCAL
          // ==================================================

          setHistorialVersiculos((historialAnterior) => {
            const nuevoHistorial = [...historialAnterior];

            referenciasEncontradas.forEach((referencia) => {
              const ultimoGuardado = nuevoHistorial[nuevoHistorial.length - 1];

              // Evitamos duplicados consecutivos.

              if (ultimoGuardado?.referencia === referencia.referencia) {
                return;
              }

              nuevoHistorial.push({
                ...referencia,

                detectadoEn: new Date().toISOString(),
              });
            });

            return nuevoHistorial;
          });

          // ==================================================
          // ÚLTIMA REFERENCIA
          // ==================================================

          const ultimaReferencia =
            referenciasEncontradas[referenciasEncontradas.length - 1];

          console.log("Último versículo detectado:", ultimaReferencia);

          // ==================================================
          // GUARDAR DETECCIÓN EN SUPABASE
          // ==================================================
          //
          // Aquí este dispositivo está diciendo:
          //
          // "Yo escuché este versículo".
          //
          // Luego Realtime lo enviará
          // a los demás dispositivos.
          // ==================================================

          guardarDeteccion(ultimaReferencia);

          // Mostramos inmediatamente
          // la referencia detectada.

          setVersiculoDetectado(ultimaReferencia);

          // Limpiamos el texto anterior
          // mientras esperamos la API.

          setTextoVersiculo(null);

          // ==================================================
          // CONSULTAR API BÍBLICA
          // ==================================================

          buscarVersiculo(
            ultimaReferencia.libro,
            ultimaReferencia.capitulo,
            ultimaReferencia.versiculo,
          ).then((resultado) => {
            console.log("Texto bíblico recibido:", resultado);

            if (resultado) {
              setTextoVersiculo(resultado);
            }
          });
        }
      }

      // ==================================================
      // TEXTO TEMPORAL
      // ==================================================

      if (textoTemporal) {
        console.log("Escuchando:", textoTemporal);
      }
    };

    // ==================================================
    // ERRORES DEL MICRÓFONO
    // ==================================================

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

    // Cuando termina la escucha.

    reconocimiento.onend = () => {
      setEscuchando(false);
    };

    // Guardamos el reconocedor
    // para usarlo desde el botón.

    reconocimientoRef.current = reconocimiento;

    // Al abandonar la pantalla
    // detenemos el micrófono.

    return () => {
      reconocimiento.stop();
    };
  }, []);

  // ==================================================
  // INICIAR / DETENER ESCUCHA
  // ==================================================

  function cambiarEscucha() {
    const reconocimiento = reconocimientoRef.current;

    if (!reconocimiento) {
      return;
    }

    setErrorMicrofono("");

    // Si está escuchando,
    // lo detenemos.

    if (escuchando) {
      reconocimiento.stop();

      setEscuchando(false);

      return;
    }

    // Si está detenido,
    // comenzamos.

    try {
      reconocimiento.start();

      setEscuchando(true);
    } catch (errorReconocimiento) {
      console.error("No se pudo iniciar el micrófono:", errorReconocimiento);
    }
  }

  // ==================================================
  // COPIAR CÓDIGO
  // ==================================================

  async function copiarCodigo() {
    if (!sala?.codigo) {
      return;
    }

    await navigator.clipboard.writeText(sala.codigo);
  }

  // ==================================================
  // CARGANDO
  // ==================================================

  if (cargando) {
    return (
      <main className="sala-page">
        <div className="sala-loading">Cargando sala...</div>
      </main>
    );
  }

  // ==================================================
  // ERROR
  // ==================================================

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

  // ==================================================
  // PANTALLA PRINCIPAL
  // ==================================================

  return (
    <main className="sala-page">
      {/* ==============================================
          ENCABEZADO
          ============================================== */}

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
        {/* ==============================================
            ESTADO DE LA SALA
            ============================================== */}

        <div className="sala-status">
          <span className="sala-status-dot"></span>

          {sala.estado}
        </div>

        <h1>{sala.nombre}</h1>

        <p className="sala-description">
          Comparte el código para que otras personas puedan unirse a esta sala.
        </p>

        {/* ==============================================
            CÓDIGO DE LA SALA
            ============================================== */}

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

        {/* ==============================================
            DISPOSITIVOS CONECTADOS
            ============================================== */}

        <div className="sala-info-card">
          <div className="sala-info-icon">
            <Users size={22} />
          </div>

          <div>
            <span>Dispositivos conectados</span>

            <strong>{conectados}</strong>
          </div>
        </div>

        {/* ==============================================
            MICRÓFONO
            ============================================== */}

        <div className="sala-listening-card">
          <div
            className={
              escuchando
                ? "sala-listening-icon escuchando"
                : "sala-listening-icon"
            }
          >
            {/* Ondas */}

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

          {errorMicrofono && (
            <p className="sala-microphone-error">{errorMicrofono}</p>
          )}
        </div>
        {/* ==============================================
    CONSENSO
    ============================================== */}

        {consenso && (
          <div className="sala-info-card">
            <div className="sala-info-icon">
              <Users size={22} />
            </div>

            <div>
              <span>Versículo confirmado</span>

              <strong>{consenso.referencia}</strong>

              <small>{consenso.votos} dispositivos coincidieron</small>
            </div>
          </div>
        )}
        {/* ==============================================
            TRANSCRIPCIÓN
            ============================================== */}

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

        {/* ==============================================
            ÚLTIMO VERSÍCULO
            ============================================== */}

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

        {/* ==============================================
            HISTORIAL DE VERSÍCULOS
            ============================================== */}

        <div className="sala-history-section">
          <div className="sala-section-title">
            <BookOpen size={19} />

            <h3>Versículos del culto</h3>
          </div>

          {historialVersiculos.length > 0 ? (
            <div className="sala-history-list">
              {historialVersiculos.map((versiculo, index) => (
                <div
                  className="sala-history-item"
                  key={`${versiculo.referencia}-${index}`}
                >
                  <div className="sala-history-number">{index + 1}</div>

                  <div className="sala-history-info">
                    <strong>{versiculo.referencia}</strong>

                    <span>Detectado durante la predicación</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="sala-history-empty">
              <BookOpen size={23} />

              <p>Los versículos detectados aparecerán aquí.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default Sala;
