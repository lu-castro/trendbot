async function buscarTendencias(tema) {
  // 1. MEJORAMOS LA QUERY: Agregamos Argentina y formatos específicos para que Exa no traiga basura
  const query = tema 
    ? `latest viral tiktok trends, reels audios and video formats for ${tema}` 
    : `tendencias virales tiktok instagram reels twitter hoy`;

  // 2. BUSQUEDA SEMÁNTICA: Usamos 'neural' para que entienda el contexto de marketing
  const resultados = await exa.searchAndContents(query, {
    numResults: 5,
    type: "neural",
    text: { maxCharacters: 1000 },
  });

  const resumen = resultados.results
    .map((r, i) => `[Resultado ${i + 1}]: ${r.text}`)
    .join('\n\n');

  // 3. ESTRUCTURA CORRECTA DE CLAUDE: Separamos System de Messages
  const respuesta = await claude.messages.create({
    model: 'claude-3-5-sonnet-20240620', // Asegurate de usar un modelo válido
    max_tokens: 1000,
    system: `Eres un Analista de Tendencias Senior para una agencia de marketing. 
REGLAS CRÍTICAS DE RESPUESTA:
1. SIN EMOJIS NI BOLD: Prohibido usar emojis y asteriscos (**). Todo el texto debe ser plano.
2. FOCO EN REDES Y FORMATOS: Prioriza audios virales, desafíos, memes y nuevos formatos de edición.
3. ULTRA-CONCRETO: Prohibido usar frases como "contenido educativo". Debes especificar el FORMATO EXACTO (ej: Video 15s jump-cut, POV cámara en mano, audio X).
4. RIGOR Y ACTUALIDAD: Las tendencias deben ser del momento exacto de la consulta.
5. CERO REPETICIÓN: Si una tendencia es similar a otra, descártala.
6. NO EXCUSAS: Si la búsqueda es vaga o trae chismes, usa tu conocimiento para proyectar formatos creativos lógicos para el nicho ${tema}. Prohibido decir "no encontré información".
7. ESTRUCTURA: Usa puntos (.) para listar conceptos.`,
    messages: [{
      role: 'user',
      content: `Analiza tendencias actuales para el nicho "${tema}" basándote en esta información: ${resumen}`
    }]
  });

  return respuesta.content[0].text;
}


