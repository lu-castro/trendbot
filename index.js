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
      content: `Basándote en estos resultados de búsqueda actuales, hacé una lista breve (máximo 6 puntos) de las temáticas y tendencias que la gente está hablando en redes sociales hoy. No uses emojis y sé conciso. Resultados:\n\n${resumen}`
    }]
  });

  return respuesta.content[0].text;
}

// Responde cuando le mencionan (@TrendBot)
app.event('app_mention', async ({ event, say }) => {
  const texto = event.text.toLowerCase();
  const esTendencia = texto.includes('tendencia') || texto.includes('trending') || texto.includes('redes');
  const tema = texto.replace(/<@[^>]+>/g, '').replace(/tendencias?|trending|redes sociales/gi, '').trim();

  await say({ text: '🔍 Buscando tendencias actuales...' });

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


// Este bloque hace que el bot responda en chats privados (DMs)
app.event('message', async ({ event, say }) => {
  // Solo respondemos si es un mensaje directo (channel_type === 'im') 
  // y si no es un mensaje del propio bot
  if (event.channel_type === 'im' && !event.bot_id) {
    await say(`¡Hola! Recibí tu mensaje por privado: "${event.text}". ¿En qué puedo ayudarte hoy?`);
    // Aquí podrías meter la lógica de Claude que ya tenemos
  }
});
