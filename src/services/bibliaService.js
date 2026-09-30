// ======================================================
// SERVICIO DE BIBLIA
// ======================================================
//
// Este servicio puede buscar:
//
// 1. UN SOLO VERSÍCULO
//
// buscarVersiculo("Juan", 3, 16)
//
// Devuelve:
//
// {
//   referencia: "Juan 3:16",
//   texto: "...",
//   versiculos: [...],
//   version: "rvr1909"
// }
//
// ------------------------------------------------------
//
// 2. UN RANGO DE VERSÍCULOS
//
// buscarVersiculo("Romanos", 8, 1, 4)
//
// Devuelve:
//
// {
//   referencia: "Romanos 8:1-4",
//   texto: "...",
//   versiculos: [
//     { numero: 1, texto: "..." },
//     { numero: 2, texto: "..." },
//     { numero: 3, texto: "..." },
//     { numero: 4, texto: "..." }
//   ],
//   version: "rvr1909"
// }
//
// ======================================================

// ------------------------------------------------------
// CONFIGURACIÓN DE LA API
// ------------------------------------------------------

const API_URL = "https://api.midvash.com/v1";

const VERSION_BIBLIA = "rvr1909";

// ======================================================
// BUSCAR UN VERSÍCULO EN LA API
// ======================================================
//
// Esta función es interna.
//
// Se encarga solamente de consultar UN versículo.
//
// Ejemplo:
//
// obtenerVersiculoApi("romanos", 8, 1)
//
// ======================================================

async function obtenerVersiculoApi(libroApi, capitulo, versiculo) {
  // Construimos la URL.
  //
  // Ejemplo:
  //
  // https://api.midvash.com/v1/rvr1909/romanos/8/1

  const url = `${API_URL}/${VERSION_BIBLIA}/${libroApi}/${capitulo}/${versiculo}`;

  console.log("Consultando API:");
  console.log(url);

  // Hacemos la petición.

  const respuesta = await fetch(url);

  // Si la API devuelve un error,
  // detenemos esta consulta.

  if (!respuesta.ok) {
    throw new Error(
      `Error al buscar el versículo ${capitulo}:${versiculo}: ${respuesta.status}`,
    );
  }

  // Convertimos la respuesta a JavaScript.

  const resultado = await respuesta.json();

  console.log("Respuesta de la API:");
  console.log(resultado);

  // Midvash devuelve la información
  // principal dentro de "data".

  return resultado.data;
}

// ======================================================
// FUNCIÓN PRINCIPAL
// ======================================================
//
// Puede recibir:
//
// buscarVersiculo(
//   libro,
//   capitulo,
//   versiculo,
//   versiculoFin
// )
//
// El cuarto parámetro es OPCIONAL.
//
// ======================================================

export async function buscarVersiculo(
  libro,
  capitulo,
  versiculo,
  versiculoFin = null,
) {
  try {
    // --------------------------------------------------
    // PREPARAR NOMBRE DEL LIBRO
    // --------------------------------------------------
    //
    // "Juan"
    //    ↓
    // "juan"
    //
    // "1 Corintios"
    //    ↓
    // "1-corintios"

    const libroApi = libro.toLowerCase().replace(/\s+/g, "-");

    // ==================================================
    // CASO 1
    // UN SOLO VERSÍCULO
    // ==================================================
    //
    // Ejemplo:
    //
    // Juan 3:16
    //
    // Si NO existe versiculoFin,
    // hacemos exactamente lo que hacía nuestro
    // servicio anteriormente.
    // ==================================================

    if (
      versiculoFin === null ||
      versiculoFin === undefined ||
      versiculoFin === versiculo
    ) {
      const datos = await obtenerVersiculoApi(libroApi, capitulo, versiculo);

      const referencia = `${libro} ${capitulo}:${versiculo}`;

      const resultado = {
        referencia,

        // Mantenemos "texto" porque Sala.jsx
        // actualmente utiliza esta propiedad.
        texto: datos.text,

        // También devolvemos un arreglo.
        //
        // Esto nos servirá después para que la
        // interfaz pueda trabajar igual con uno
        // o con varios versículos.
        versiculos: [
          {
            numero: versiculo,
            texto: datos.text,
          },
        ],

        version: datos.version,
      };

      console.log("Texto bíblico recibido:", resultado);

      return resultado;
    }

    // ==================================================
    // CASO 2
    // RANGO DE VERSÍCULOS
    // ==================================================
    //
    // Ejemplo:
    //
    // Romanos 8:1-4
    //
    // Tenemos:
    //
    // versiculo    = 1
    // versiculoFin = 4
    //
    // Debemos consultar:
    //
    // Romanos 8:1
    // Romanos 8:2
    // Romanos 8:3
    // Romanos 8:4
    //
    // ==================================================

    // --------------------------------------------------
    // VALIDACIÓN DEL RANGO
    // --------------------------------------------------

    if (versiculoFin < versiculo) {
      console.error("El versículo final no puede ser menor al inicial.");

      return null;
    }

    // Para proteger la API de una detección extraña,
    // limitamos temporalmente los rangos.
    //
    // Por ejemplo:
    //
    // Romanos 8:1-500
    //
    // no debería generar 500 peticiones.

    const cantidadVersiculos = versiculoFin - versiculo + 1;

    if (cantidadVersiculos > 50) {
      console.error("El rango detectado es demasiado grande.");

      return null;
    }

    console.log(
      "Buscando rango bíblico:",
      `${libro} ${capitulo}:${versiculo}-${versiculoFin}`,
    );

    // ==================================================
    // CREAR TODAS LAS CONSULTAS
    // ==================================================
    //
    // Si tenemos:
    //
    // 1 al 4
    //
    // crearemos:
    //
    // consulta 1
    // consulta 2
    // consulta 3
    // consulta 4
    //
    // ==================================================

    const consultas = [];

    for (let numero = versiculo; numero <= versiculoFin; numero++) {
      consultas.push(obtenerVersiculoApi(libroApi, capitulo, numero));
    }

    // ==================================================
    // EJECUTAR CONSULTAS
    // ==================================================
    //
    // Promise.all permite hacer las consultas
    // juntas en lugar de esperar una por una.
    // ==================================================

    const respuestas = await Promise.all(consultas);

    // ==================================================
    // ORGANIZAR LOS VERSÍCULOS
    // ==================================================

    const versiculos = respuestas.map((datos, indice) => {
      return {
        numero: versiculo + indice,

        texto: datos.text,
      };
    });

    // ==================================================
    // CREAR TEXTO COMPLETO
    // ==================================================
    //
    // También mantenemos la propiedad "texto"
    // para no romper Sala.jsx.
    //
    // Resultado aproximado:
    //
    // 1 AHORA pues...
    //
    // 2 Porque la ley...
    //
    // 3 Porque lo que era...
    //
    // 4 Para que...
    //
    // ==================================================

    const textoCompleto = versiculos
      .map((item) => {
        return `${item.numero}. ${item.texto}`;
      })
      .join("\n\n");

    // ==================================================
    // REFERENCIA COMPLETA
    // ==================================================

    const referencia = `${libro} ${capitulo}:${versiculo}-${versiculoFin}`;

    // ==================================================
    // VERSIÓN
    // ==================================================
    //
    // Tomamos la versión de la primera respuesta.

    const version = respuestas[0]?.version || VERSION_BIBLIA;

    // ==================================================
    // RESULTADO FINAL
    // ==================================================

    const resultadoFinal = {
      referencia,

      texto: textoCompleto,

      versiculos,

      version,
    };

    console.log("Rango bíblico recibido:", resultadoFinal);

    return resultadoFinal;
  } catch (error) {
    console.error("Error en buscarVersiculo:", error);

    return null;
  }
}
