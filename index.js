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
    ? `trending topics redes sociales ${tema} hoy`
    : `trending topics redes sociales hoy`;

  const resultados = await exa.searchAndContents(query, {
    numResults: 5,
    text: { maxCharacters: 800 },
  });

  const resumen = resultados.results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.text?.slice(0, 400)}`)
    .join('\n\n');

  const respuesta = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `system: Eres un Analista de Datos Senior especializado en Marketing Digital. 
REGLAS CRÍTICAS DE RESPUESTA:
1. PROHIBIDO EL USO DE EMOJIS: No uses ni un solo emoji en tus respuestas. Tono profesional pero creativo. 
2. FOCO EN REDES: Prioriza audios virales, desafíos (challenges), bailes de TikTok, memes en ascenso y nuevos formatos de edición.
3. SÉ CONCISO: máximo 10 puntos con la información más relevante. 
4. INFORMACIÓN ACTUAL: las tendencias deben ser del mismo momento que la consulta. 
5. RIGOR INFORMATIVO: Si la búsqueda no arroja tendencias claras o actuales queda PROHIBIDO inventar tendencias o rellenar con temas genéricos.
6. ESTRUCTURA: usa puntos para listar y Bold para resaltar. 
7. FOCO: Solo reporta tendencias que tengan impacto directo en estrategia de contenidos o pauta digital.,. Resultados:\n\n${resumen}`
    }]
  });

  return respuesta.content[0].text;
}

// Responde cuando le mencionan (@TrendBot)
app.event('app_mention', async ({ event, say }) => {
  const texto = event.text.toLowerCase();
  const esTendencia = texto.includes('tendencia') || texto.includes('trending') || texto.includes('redes');
  const tema = texto.replace(/<@[^>]+>/g, '').replace(/tendencias?|trending|redes sociales/gi, '').trim();

  await say({ text: 'Bancame un cachito... 🔍' });

  try {
    const resultado = await buscarTendencias(esTendencia ? tema : null);
    await say({ text: resultado });
  } catch (err) {
    await say({ text: '❌ Hubo un error buscando tendencias. Intentá de nuevo.' });
  }
});

// Responde en DM directo
app.message(async ({ message, say }) => {
  if (message.bot_id) return;
  await say({ text: '🔍 Buscando tendencias actuales...' });
  try {
    const resultado = await buscarTendencias(message.text);
    await say({ text: resultado });
  } catch (err) {
    await say({ text: '❌ Error buscando tendencias.' });
  }
});

(async () => {
  await app.start();
  console.log('✅ TrendBot corriendo!');
})();


