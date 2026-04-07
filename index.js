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
    ? `trending viral social media ${tema} today 2026`
    : `trending viral social media topics today 2026`;

  const resultados = await exa.searchAndContents(query, {
    numResults: 6,
    text: { maxCharacters: 600 },
    startPublishedDate: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  });

  const filtrados = resultados.results.filter(r => {
    const texto = (r.title + ' ' + (r.text || '')).toLowerCase();
    const palabrasPolicy = ['politic', 'election', 'president', 'congress', 'senate', 'gobierno', 'elecciones', 'partido', 'diputad', 'senad', 'trump', 'biden', 'milei', 'guerra', 'war', 'conflict'];
    return !palabrasPolicy.some(p => texto.includes(p));
  });

  // Guardamos las URLs para incluirlas en la respuesta
  const fuentesConURL = filtrados
    .map((r, i) => `[${i + 1}] ${r.title} — ${r.url}`)
    .join('\n');

  const resumen = filtrados
    .map((r, i) => `[${i + 1}] ${r.title} (URL: ${r.url})\n${r.text?.slice(0, 400)}`)
    .join('\n\n');

  const respuesta = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 700,
    system: `Eres un Analista de Tendencias Senior para una agencia de marketing.
REGLAS CRÍTICAS:
1. CERO POLÍTICA: Ignorá cualquier resultado que mencione política, elecciones o gobiernos.
2. SIN FORMATO MARKDOWN: Prohibido usar asteriscos (**), guiones como bullets, o cualquier markdown. Solo texto plano con números.
3. MÁXIMO 5 TENDENCIAS: Una por línea numerada. Sin introducción ni cierre.
4. ULTRA-CONCRETO: Especificá el formato exacto (ej: Video 15s jump-cut, audio X, meme formato Y).
5. LINKS OBLIGATORIOS: Al final de cada tendencia, en una línea nueva, escribí "Link: " seguido de la URL exacta que aparece en los resultados. No inventes URLs.
6. BREVEDAD: Cada tendencia en máximo 2 líneas de descripción + 1 línea de link.`,
    messages: [{
      role: 'user',
      content: `Analizá estas tendencias en tiempo real y listá las 5 más virales ahora. Para cada una incluí la URL exacta del resultado en que te basaste.\n\nResultados:\n${resumen}\n\nURLs disponibles:\n${fuentesConURL}`
    }]
  });

  return respuesta.content[0].text;
}

// Responde en el hilo del mensaje original — menciones (@TrendBot)
app.event('app_mention', async ({ event, say }) => {
  // Si el mensaje ya está en un hilo, respondemos en ese hilo. Si no, creamos uno nuevo.
  const threadTs = event.thread_ts || event.ts;

  const tema = event.text
    .replace(/<@[^>]+>/g, '')
    .replace(/tendencias?|trending|redes sociales/gi, '')
    .trim();

  await say({
    text: 'Bancame un cachito...',
    thread_ts: threadTs,
  });

  try {
    const resultado = await buscarTendencias(tema || null);
    await say({
      text: resultado,
      thread_ts: threadTs,
    });
  } catch (err) {
    console.error(err);
    await say({
      text: 'Error buscando tendencias. Intentá de nuevo.',
      thread_ts: threadTs,
    });
  }
});

// Responde en DM directo — también en hilo
app.message(async ({ message, say }) => {
  if (message.bot_id) return;

  const threadTs = message.thread_ts || message.ts;

  await say({
    text: 'Bancame un cachito...',
    thread_ts: threadTs,
  });

  try {
    const resultado = await buscarTendencias(message.text);
    await say({
      text: resultado,
      thread_ts: threadTs,
    });
  } catch (err) {
    console.error(err);
    await say({
      text: 'Error buscando tendencias. Intentá de nuevo.',
      thread_ts: threadTs,
    });
  }
});

(async () => {
  await app.start();
  console.log('✅ TrendBot corriendo!');
})();
