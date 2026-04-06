require('dotenv').config();
const { App } = require('@slack/bolt');
const Anthropic = require('@anthropic-ai/sdk');
const Exa = require('exa-js').default;

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const exa = new Exa(process.env.EXA_API_KEY);

async function buscarTendencias(tema) {
  const query = tema 
    ? `latest viral tiktok trends, reels audios and video formats for ${tema}` 
    : `tendencias virales tiktok instagram reels twitter hoy`;

  const resultados = await exa.searchAndContents(query, {
    numResults: 5,
    type: "neural",
    text: { maxCharacters: 1000 },
  });

  const resumen = resultados.results
    .map((r, i) => `[Resultado ${i + 1}]: ${r.text}`)
    .join('\n\n');

  const respuesta = await claude.messages.create({
    model: 'claude-3-5-sonnet-20240620',
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

// Responde cuando le mencionan (@TrendBot)
app.event('app_mention', async ({ event, say }) => {
  const texto = event.text.toLowerCase();
  const tema = texto.replace(/<@[^>]+>/g, '').trim();

  await say({ text: 'Bancame un cachito... 🔍' });

  try {
    const resultado = await buscarTendencias(tema || null);
    await say({ text: resultado });
  } catch (err) {
    console.error('Error en app_mention:', err);
    await say({ text: '❌ Hubo un error buscando tendencias. Intentá de nuevo.' });
  }
});

// Responde en DM directo
app.message(async ({ message, say }) => {
  if (message.bot_id) return;
  
  await say({ text: 'Bancame un cachito... 🔍' });
  
  try {
    const resultado = await buscarTendencias(message.text);
    await say({ text: resultado });
  } catch (err) {
    console.error('Error en message:', err);
    await say({ text: '❌ Error buscando tendencias.' });
  }
});

(async () => {
  await app.start();
  console.log('✅ TrendBot corriendo!');
})();
