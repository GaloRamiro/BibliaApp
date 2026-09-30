// ======================================================
// DETECTOR DE REFERENCIAS BÍBLICAS
// ======================================================
//
// Convierte frases como:
//
// "Juan capítulo 3 versículo 16"
//
// en:
//
// {
//   libro: "Juan",
//   capitulo: 3,
//   versiculo: 16,
//   versiculoFin: null,
//   referencia: "Juan 3:16"
// }
//
// También soporta rangos:
//
// "Romanos capítulo 8 del versículo 1 al 4"
//
// en:
//
// {
//   libro: "Romanos",
//   capitulo: 8,
//   versiculo: 1,
//   versiculoFin: 4,
//   referencia: "Romanos 8:1-4"
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
  return texto
    .toLowerCase()

    // Quita tildes.
    // "capítulo" -> "capitulo"
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

    // Convertimos signos comunes en espacios.
    //
    // "Juan 3:16"
    //       ↓
    // "Juan 3 16"
    //
    // También convertimos el guion:
    //
    // "Romanos 8:1-4"
    //          ↓
    // "Romanos 8 1 4"
    .replace(/[:.,;!?¿¡\-–—]/g, " ")

    // Elimina espacios repetidos.
    .replace(/\s+/g, " ")

    .trim();
}


// ------------------------------------------------------
// CONVERTIR PALABRAS A NÚMERO
// ------------------------------------------------------

function obtenerNumero(palabras, posicion) {
  const palabra = palabras[posicion];

  if (!palabra) {
    return null;
  }

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
// DETECTAR PRIMERA / SEGUNDA / TERCERA
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

  if (
    palabra === "segunda" ||
    palabra === "segundo" ||
    palabra === "2"
  ) {
    return 2;
  }

  if (
    palabra === "tercera" ||
    palabra === "tercero" ||
    palabra === "3"
  ) {
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
    // LIBROS SIMPLES
    // --------------------------------------------
    //
    // Juan
    // Mateo
    // Salmos
    // Romanos

    if (librosSimples.includes(palabra)) {
      // Antes de aceptar "Juan" como libro simple,
      // revisamos si realmente dice:
      //
      // primera de Juan
      // segunda de Juan
      // 1 Juan

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
    // LIBROS NUMERADOS
    // --------------------------------------------
    //
    // primera de Corintios
    // 1 Corintios

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
  //       ↓
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
// SABER SI EXISTE UN RANGO
// ------------------------------------------------------

function buscarFinRango(palabras, posicionVersiculoInicio) {
  // Esta función busca expresiones como:
  //
  // versículo 1 al 4
  // versículos 1 al 4
  // del 1 al 4
  // 1 hasta 4
  //
  // Importante:
  // NO tomamos cualquier tercer número como fin.
  //
  // Debe existir una palabra que indique rango:
  //
  // al
  // hasta
  //
  // De esta forma evitamos convertir números posteriores
  // de una conversación en parte de la referencia.

  let indice = posicionVersiculoInicio + 1;

  while (indice < palabras.length) {
    const palabra = palabras[indice];

    // --------------------------------------------------
    // ENCONTRAMOS "AL" O "HASTA"
    // --------------------------------------------------

    if (palabra === "al" || palabra === "hasta") {
      const resultado = obtenerNumero(palabras, indice + 1);

      if (resultado) {
        return resultado.numero;
      }

      return null;
    }

    // --------------------------------------------------
    // Si aparece otra palabra importante antes de "al",
    // dejamos de buscar para evitar falsos positivos.
    // --------------------------------------------------

    if (
      palabra === "capitulo" ||
      palabra === "capitulos" ||
      palabra === "versiculo" ||
      palabra === "versiculos"
    ) {
      return null;
    }

    indice++;
  }

  return null;
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

  // Primero buscamos el libro bíblico.

  const libroEncontrado = buscarLibro(palabras);

  if (!libroEncontrado) {
    return null;
  }

  const { libro, posicion } = libroEncontrado;

  let capitulo = null;

  let versiculo = null;

  // NUEVO:
  //
  // Si existe un rango:
  //
  // Romanos 8:1-4
  //
  // aquí guardaremos el 4.
  let versiculoFin = null;

  // También guardamos la posición exacta del
  // versículo inicial.
  //
  // Esto nos permitirá buscar después:
  //
  // "al 4"
  let posicionVersiculo = null;


  // ==================================================
  // BUSCAR NÚMEROS DESPUÉS DEL LIBRO
  // ==================================================
  //
  // Ejemplos:
  //
  // Juan 3 16
  //
  // Romanos capitulo 8 versiculo 28
  //
  // Romanos capitulo 8 versiculo 1 al 4
  //
  // IMPORTANTE:
  //
  // Ahora NO nos detenemos inmediatamente después
  // de encontrar dos números.
  //
  // Necesitamos conservar la posición del segundo
  // número para comprobar si después dice "al 4".
  // ==================================================

  const numerosEncontrados = [];

  let indice = posicion + 1;

  while (indice < palabras.length) {
    const resultado = obtenerNumero(palabras, indice);

    if (resultado) {
      numerosEncontrados.push({
        numero: resultado.numero,
        posicion: indice,
        consumidas: resultado.consumidas,
      });

      indice += resultado.consumidas;
    } else {
      indice++;
    }

    // Para capítulo + versículo + posible fin
    // necesitamos como máximo tres números.
    if (numerosEncontrados.length >= 3) {
      break;
    }
  }


  // ==================================================
  // CAPÍTULO Y VERSÍCULO NORMAL
  // ==================================================
  //
  // Primer número  = capítulo
  // Segundo número = versículo
  //
  // Juan 3 16
  //
  // 3  = capítulo
  // 16 = versículo
  // ==================================================

  if (numerosEncontrados.length >= 2) {
    capitulo = numerosEncontrados[0].numero;

    versiculo = numerosEncontrados[1].numero;

    posicionVersiculo = numerosEncontrados[1].posicion;
  }


  // ==================================================
  // RESPALDO: BUSCAR "CAPÍTULO"
  // ==================================================

  if (capitulo === null) {
    for (let i = posicion + 1; i < palabras.length; i++) {
      if (
        (palabras[i] === "capitulo" ||
          palabras[i] === "capitulos") &&
        palabras[i + 1]
      ) {
        const resultado = obtenerNumero(palabras, i + 1);

        if (resultado) {
          capitulo = resultado.numero;

          break;
        }
      }
    }
  }


  // ==================================================
  // RESPALDO: BUSCAR "VERSÍCULO"
  // ==================================================

  if (versiculo === null) {
    for (let i = posicion + 1; i < palabras.length; i++) {
      if (
        (palabras[i] === "versiculo" ||
          palabras[i] === "versiculos") &&
        palabras[i + 1]
      ) {
        const resultado = obtenerNumero(palabras, i + 1);

        if (resultado) {
          versiculo = resultado.numero;

          posicionVersiculo = i + 1;

          break;
        }
      }
    }
  }


  // ==================================================
  // NECESITAMOS CAPÍTULO Y VERSÍCULO
  // ==================================================

  if (capitulo === null || versiculo === null) {
    return null;
  }


  // ==================================================
  // BUSCAR SI EXISTE UN RANGO
  // ==================================================
  //
  // Ejemplo:
  //
  // Romanos capítulo 8 del versículo 1 al 4
  //
  // Ya sabemos:
  //
  // capítulo = 8
  // versículo = 1
  //
  // Ahora buscamos:
  //
  // "al 4"
  // ==================================================

  if (posicionVersiculo !== null) {
    const posibleFin = buscarFinRango(
      palabras,
      posicionVersiculo
    );

    if (
      posibleFin !== null &&
      posibleFin >= versiculo
    ) {
      versiculoFin = posibleFin;
    }
  }


  // ==================================================
  // FORMATEAR LIBRO
  // ==================================================

  const nombreLibro = formatearLibro(libro);


  // ==================================================
  // CREAR REFERENCIA
  // ==================================================
  //
  // Sin rango:
  //
  // Juan 3:16
  //
  // Con rango:
  //
  // Romanos 8:1-4
  // ==================================================

  let referencia = `${nombreLibro} ${capitulo}:${versiculo}`;

  if (
    versiculoFin !== null &&
    versiculoFin !== versiculo
  ) {
    referencia += `-${versiculoFin}`;
  }


  // ==================================================
  // RESULTADO
  // ==================================================

  return {
    libro: nombreLibro,

    capitulo,

    // Mantenemos "versiculo" para no romper
    // nuestro código actual.
    versiculo,

    // NUEVO.
    //
    // null = solamente un versículo.
    //
    // número = existe un rango.
    versiculoFin,

    referencia,
  };
}


// ======================================================
// DETECTAR VARIAS REFERENCIAS
// ======================================================
//
// Ejemplo:
//
// "Juan capítulo 3 versículo 16,
// Romanos capítulo 8 del versículo 1 al 4"
//
// devuelve:
//
// [
//   {
//     libro: "Juan",
//     capitulo: 3,
//     versiculo: 16,
//     versiculoFin: null,
//     referencia: "Juan 3:16"
//   },
//
//   {
//     libro: "Romanos",
//     capitulo: 8,
//     versiculo: 1,
//     versiculoFin: 4,
//     referencia: "Romanos 8:1-4"
//   }
// ]
// ======================================================

export function detectarVersiculos(texto) {
  if (!texto) {
    return [];
  }

  const textoNormalizado = normalizarTexto(texto);

  const palabras = textoNormalizado.split(" ");

  const referencias = [];


  // ==================================================
  // BUSCAR TODOS LOS LIBROS EN EL TEXTO
  // ==================================================

  const posicionesLibros = [];


  for (let i = 0; i < palabras.length; i++) {
    const palabra = palabras[i];


    // ==================================================
    // LIBROS SIMPLES
    // ==================================================

    if (librosSimples.includes(palabra)) {
      // Juan también puede aparecer como:
      //
      // primera de Juan
      // segunda de Juan
      // tercera de Juan

      if (librosNumerados.includes(palabra)) {
        const anterior = palabras[i - 1];

        const dosAntes = palabras[i - 2];


        // Caso:
        //
        // 1 Juan
        // primera Juan

        if (obtenerNumeroLibro(anterior)) {
          posicionesLibros.push(i - 1);

          continue;
        }


        // Caso:
        //
        // primera de Juan
        // segunda de Juan

        if (
          anterior === "de" &&
          obtenerNumeroLibro(dosAntes)
        ) {
          posicionesLibros.push(i - 2);

          continue;
        }
      }


      // Libro normal.

      posicionesLibros.push(i);

      continue;
    }


    // ==================================================
    // LIBROS NUMERADOS
    // ==================================================
    //
    // Corintios
    // Timoteo
    // Pedro
    // Samuel
    // Reyes

    if (librosNumerados.includes(palabra)) {
      const anterior = palabras[i - 1];

      const dosAntes = palabras[i - 2];


      // Caso:
      //
      // 1 Corintios
      // primera Corintios

      if (obtenerNumeroLibro(anterior)) {
        posicionesLibros.push(i - 1);

        continue;
      }


      // Caso:
      //
      // primera de Corintios

      if (
        anterior === "de" &&
        obtenerNumeroLibro(dosAntes)
      ) {
        posicionesLibros.push(i - 2);
      }
    }
  }


  // ==================================================
  // QUITAR POSICIONES DUPLICADAS
  // ==================================================

  const posicionesUnicas = [
    ...new Set(posicionesLibros),
  ];


  // Si no encontramos ningún libro,
  // no hay referencias.

  if (posicionesUnicas.length === 0) {
    return [];
  }


  // ==================================================
  // ANALIZAR CADA REFERENCIA
  // ==================================================

  for (
    let i = 0;
    i < posicionesUnicas.length;
    i++
  ) {
    const inicio = posicionesUnicas[i];


    // El final será el comienzo
    // del siguiente libro.
    //
    // Si no existe otro libro,
    // usamos el final del texto.

    const fin =
      posicionesUnicas[i + 1] ??
      palabras.length;


    const palabrasReferencia =
      palabras.slice(
        inicio,
        fin
      );


    const textoReferencia =
      palabrasReferencia.join(" ");


    console.log(
      "Analizando referencia:",
      textoReferencia
    );


    // Nuestro detector individual ahora sabe
    // reconocer tanto:
    //
    // Juan 3:16
    //
    // como:
    //
    // Romanos 8:1-4

    const referencia =
      detectarVersiculo(
        textoReferencia
      );


    if (!referencia) {
      continue;
    }


    // ==================================================
    // EVITAR DUPLICADOS CONSECUTIVOS
    // ==================================================

    const ultimaReferencia =
      referencias[
        referencias.length - 1
      ];


    if (
      ultimaReferencia?.referencia ===
      referencia.referencia
    ) {
      continue;
    }


    referencias.push(
      referencia
    );
  }


  return referencias;
}