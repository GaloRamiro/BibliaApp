// ======================================================
// DETECTOR DE REFERENCIAS BÍBLICAS
// ======================================================
//
// Su trabajo es convertir frases como:
//
// "Juan capítulo 3 versículo 16"
//
// en:
//
// {
//   libro: "Juan",
//   capitulo: 3,
//   versiculo: 16,
//   referencia: "Juan 3:16"
// }
//
// Este archivo NO busca el texto de la Biblia.
// Eso lo hace bibliaService.js.
// ======================================================

// ------------------------------------------------------
// NÚMEROS EN ESPAÑOL
// ------------------------------------------------------

const numerosSimples = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
};

const decenas = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};

const centenas = {
  cien: 100,
  ciento: 100,
};

// ------------------------------------------------------
// LIBROS SIN NÚMERO
// ------------------------------------------------------

const librosSimples = [
  "genesis",
  "exodo",
  "levitico",
  "numeros",
  "deuteronomio",
  "josue",
  "jueces",
  "rut",
  "esdras",
  "nehemias",
  "ester",
  "job",
  "salmos",
  "proverbios",
  "eclesiastes",
  "cantares",
  "isaias",
  "jeremias",
  "lamentaciones",
  "ezequiel",
  "daniel",
  "oseas",
  "joel",
  "amos",
  "abdias",
  "jonas",
  "miqueas",
  "nahum",
  "habacuc",
  "sofonias",
  "hageo",
  "zacarias",
  "malaquias",

  "mateo",
  "marcos",
  "lucas",
  "juan",
  "hechos",
  "romanos",
  "galatas",
  "efesios",
  "filipenses",
  "colosenses",
  "filemon",
  "hebreos",
  "santiago",
  "judas",
  "apocalipsis",
];

// ------------------------------------------------------
// LIBROS QUE PUEDEN LLEVAR NÚMERO
// ------------------------------------------------------

const librosNumerados = [
  "samuel",
  "reyes",
  "cronicas",
  "corintios",
  "tesalonicenses",
  "timoteo",
  "pedro",
  "juan",
];

// ------------------------------------------------------
// NORMALIZAR TEXTO
// ------------------------------------------------------

function normalizarTexto(texto) {
  return (
    texto
      .toLowerCase()

      // Quita tildes.
      // "capítulo" -> "capitulo"
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")

      // Convierte signos en espacios.
      // "Juan 3:16" -> "Juan 3 16"
      .replace(/[:.,;!?¿¡]/g, " ")

      // Elimina espacios repetidos.
      .replace(/\s+/g, " ")

      .trim()
  );
}

// ------------------------------------------------------
// CONVERTIR PALABRAS A NÚMERO
// ------------------------------------------------------

function obtenerNumero(palabras, posicion) {
  const palabra = palabras[posicion];

  // Si Chrome ya escribió un número:
  //
  // "16"
  //
  // lo convertimos directamente.
  if (/^\d+$/.test(palabra)) {
    return {
      numero: Number(palabra),
      consumidas: 1,
    };
  }

  // Números del 0 al 29.
  if (numerosSimples[palabra] !== undefined) {
    return {
      numero: numerosSimples[palabra],
      consumidas: 1,
    };
  }

  // Números como:
  //
  // treinta
  // treinta y uno
  // cuarenta y cinco
  if (decenas[palabra] !== undefined) {
    let numero = decenas[palabra];

    if (
      palabras[posicion + 1] === "y" &&
      numerosSimples[palabras[posicion + 2]] !== undefined
    ) {
      numero += numerosSimples[palabras[posicion + 2]];

      return {
        numero,
        consumidas: 3,
      };
    }

    return {
      numero,
      consumidas: 1,
    };
  }

  // Para números como:
  //
  // cien
  // ciento diecinueve
  if (centenas[palabra] !== undefined) {
    let numero = centenas[palabra];

    const siguiente = obtenerNumero(palabras, posicion + 1);

    if (siguiente) {
      numero += siguiente.numero;

      return {
        numero,
        consumidas: 1 + siguiente.consumidas,
      };
    }

    return {
      numero,
      consumidas: 1,
    };
  }

  return null;
}

// ------------------------------------------------------
// DETECTAR PRIMERA / SEGUNDA
// ------------------------------------------------------

function obtenerNumeroLibro(palabra) {
  if (
    palabra === "primera" ||
    palabra === "primero" ||
    palabra === "primer" ||
    palabra === "1"
  ) {
    return 1;
  }

  if (palabra === "segunda" || palabra === "segundo" || palabra === "2") {
    return 2;
  }

  if (palabra === "tercera" || palabra === "tercero" || palabra === "3") {
    return 3;
  }

  return null;
}

// ------------------------------------------------------
// BUSCAR EL LIBRO
// ------------------------------------------------------

function buscarLibro(palabras) {
  for (let i = 0; i < palabras.length; i++) {
    const palabra = palabras[i];

    // --------------------------------------------
    // CASO:
    //
    // Juan
    // Mateo
    // Salmos
    // --------------------------------------------

    if (librosSimples.includes(palabra)) {
      // Antes de aceptar "Juan" como libro simple,
      // revisamos si dice:
      //
      // primera de Juan
      // segunda de Juan
      //
      const palabraAnterior = palabras[i - 1];

      const dosAntes = palabras[i - 2];

      let numeroLibro = obtenerNumeroLibro(palabraAnterior);

      // Caso:
      //
      // primera DE Juan
      if (palabraAnterior === "de") {
        numeroLibro = obtenerNumeroLibro(dosAntes);
      }

      if (numeroLibro && librosNumerados.includes(palabra)) {
        return {
          libro: `${numeroLibro} ${palabra}`,
          posicion: i,
        };
      }

      return {
        libro: palabra,
        posicion: i,
      };
    }

    // --------------------------------------------
    // CASO:
    //
    // primera de Corintios
    // 1 Corintios
    // --------------------------------------------

    if (librosNumerados.includes(palabra)) {
      const anterior = palabras[i - 1];

      const dosAntes = palabras[i - 2];

      let numeroLibro = obtenerNumeroLibro(anterior);

      if (anterior === "de") {
        numeroLibro = obtenerNumeroLibro(dosAntes);
      }

      if (numeroLibro) {
        return {
          libro: `${numeroLibro} ${palabra}`,
          posicion: i,
        };
      }
    }
  }

  return null;
}

// ------------------------------------------------------
// FORMATEAR LIBRO
// ------------------------------------------------------

function formatearLibro(libro) {
  // Ejemplo:
  //
  // "1 corintios"
  //        ↓
  // "1 Corintios"

  const partes = libro.split(" ");

  return partes
    .map((parte) => {
      if (/^\d+$/.test(parte)) {
        return parte;
      }

      return parte.charAt(0).toUpperCase() + parte.slice(1);
    })
    .join(" ");
}

// ------------------------------------------------------
// FUNCIÓN PRINCIPAL
// ------------------------------------------------------

export function detectarVersiculo(texto) {
  if (!texto) {
    return null;
  }

  const textoNormalizado = normalizarTexto(texto);

  const palabras = textoNormalizado.split(" ");

  // Primero buscamos el libro.
  const libroEncontrado = buscarLibro(palabras);

  if (!libroEncontrado) {
    return null;
  }

  const { libro, posicion } = libroEncontrado;

  let capitulo = null;

  let versiculo = null;

  // --------------------------------------------------
  // BUSCAR:
  //
  // capítulo X
  // versículo X
  // --------------------------------------------------

  for (let i = posicion + 1; i < palabras.length; i++) {
    if (palabras[i] === "capitulo" && palabras[i + 1]) {
      const resultado = obtenerNumero(palabras, i + 1);

      if (resultado) {
        capitulo = resultado.numero;
      }
    }

    if (
      (palabras[i] === "versiculo" || palabras[i] === "versiculos") &&
      palabras[i + 1]
    ) {
      const resultado = obtenerNumero(palabras, i + 1);

      if (resultado) {
        versiculo = resultado.numero;
      }
    }
  }

  // --------------------------------------------------
  // SI NO DIJO "CAPÍTULO" O "VERSÍCULO"
  //
  // Ejemplo:
  //
  // Juan 3 16
  // --------------------------------------------------

  if (capitulo === null || versiculo === null) {
    const numerosEncontrados = [];

    let i = posicion + 1;

    while (i < palabras.length) {
      const resultado = obtenerNumero(palabras, i);

      if (resultado) {
        numerosEncontrados.push(resultado.numero);

        i += resultado.consumidas;
      } else {
        i++;
      }

      if (numerosEncontrados.length >= 2) {
        break;
      }
    }

    if (capitulo === null && numerosEncontrados.length >= 1) {
      capitulo = numerosEncontrados[0];
    }

    if (versiculo === null && numerosEncontrados.length >= 2) {
      versiculo = numerosEncontrados[1];
    }
  }

  // Necesitamos ambos números.
  if (capitulo === null || versiculo === null) {
    return null;
  }

  const nombreLibro = formatearLibro(libro);

  return {
    libro: nombreLibro,

    capitulo,

    versiculo,

    referencia: `${nombreLibro} ${capitulo}:${versiculo}`,
  };
}
// ======================================================
// DETECTAR VARIAS REFERENCIAS
// ======================================================
//
// Ejemplo:
//
// "Juan capítulo 3 versículo 16,
//  Romanos capítulo 8 versículo 28"
//
// devuelve:
//
// [
//   { referencia: "Juan 3:16", ... },
//   { referencia: "Romanos 8:28", ... }
// ]
//
// ======================================================

export function detectarVersiculos(texto) {
  if (!texto) {
    return [];
  }

  const textoNormalizado = normalizarTexto(texto);

  const palabras = textoNormalizado.split(" ");

  const referencias = [];

  // Recorremos todas las palabras buscando libros.
  for (let i = 0; i < palabras.length; i++) {
    // Desde la posición actual intentamos encontrar
    // un libro bíblico.
    const fragmento = palabras.slice(i);

    const libroEncontrado = buscarLibro(fragmento);

    // Si no encontró ningún libro,
    // ya no tenemos nada más que analizar.
    if (!libroEncontrado) {
      break;
    }

    // Posición real del libro dentro del texto completo.
    const posicionLibro = i + libroEncontrado.posicion;

    // --------------------------------------------------
    // BUSCAMOS DÓNDE APARECE EL SIGUIENTE LIBRO
    // --------------------------------------------------

    let posicionSiguienteLibro = palabras.length;

    for (let j = posicionLibro + 1; j < palabras.length; j++) {
      const posibleFragmento = palabras.slice(j);

      const siguienteLibro = buscarLibro(posibleFragmento);

      if (siguienteLibro && siguienteLibro.posicion === 0) {
        posicionSiguienteLibro = j;

        break;
      }
    }

    // --------------------------------------------------
    // CREAMOS UN FRAGMENTO SOLO PARA ESTA REFERENCIA
    // --------------------------------------------------
    //
    // Ejemplo:
    //
    // Romanos capítulo 8 versículo 28
    //
    // y NO dejamos que llegue hasta:
    //
    // Mateo capítulo 5 versículo 14
    //
    // --------------------------------------------------

    const palabrasReferencia = palabras.slice(
      posicionLibro,
      posicionSiguienteLibro,
    );

    const textoReferencia = palabrasReferencia.join(" ");

    // Utilizamos nuestro detector individual.
    const referencia = detectarVersiculo(textoReferencia);

    if (referencia) {
      // Evitamos guardar exactamente la misma
      // referencia dos veces seguidas.
      const ultimaReferencia = referencias[referencias.length - 1];

      if (
        !ultimaReferencia ||
        ultimaReferencia.referencia !== referencia.referencia
      ) {
        referencias.push(referencia);
      }
    }

    // Continuamos desde el siguiente libro.
    i = posicionSiguienteLibro - 1;
  }

  return referencias;
}
