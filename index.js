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
    // Búsqueda en tiempo real — últimas 72hs
    startPublishedDate: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  });

  // Filtramos resultados políticos antes de pasarlos a Claude
  const filtrados = resultados.results.filter(r => {
    const texto = (r.title + ' ' + r.text).toLowerCase();
    const palabrasPolicy = ['politic', 'election', 'president', 'congress', 'senate', 'gobierno', 'elecciones', 'partido', 'diputad', 'senad', 'trump', 'biden', 'milei', 'guerra', 'war', 'conflict'];
    return !palabrasPolicy.some(p => texto.includes(p));
  });

  const fuentes = filtrados.map(r => ({ titulo: r.title, url: r.url }));

  const resumen = filtrados
    .map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.text?.slice(0, 400)}`)
    .join('\n\n');

  const respuesta = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    system: `Eres un Analista de Tendencias Senior para una agencia de marketing. 
REGLAS CRÍTICAS:
1. CERO POLÍTICA: Si algún resultado menciona política, ignóralo completamente.
2. SIN FORMATO: Prohibido usar asteriscos (**), emojis, o markdown de cualquier tipo. Texto plano.
3. MÁXIMO 5 TENDENCIAS: Una por línea, numeradas. Sin introducción ni cierre.
4. ULTRA-CONCRETO: Especificá el formato exacto (ej: Video 15s jump-cut, audio X, meme formato Y).
5. LINKS OBLIGATORIOS: Cada tendencia debe terminar con la URL de la fuente entre paréntesis.
6. BREVEDAD: Cada tendencia en máximo 2 líneas.`,
    messages: [{
      role: 'user',
      content: `Analizá estas tendencias en tiempo real y listá las 5 más virales ahora. Incluí la URL de cada fuente al final de cada punto.\n\nResultados:\n${resumen}\n\nFuentes disponibles:\n${JSON.stringify(fuentes)}`
    }]
  });

  return respuesta.content[0].text;
}

// Responde cuando le mencionan (@TrendBot) — contesta en el hilo
app.event('app_mention', async ({ event, say }) => {
  const tema = event.text
    .replace(/<@[^>]+>/g, '')
    .replace(/tendencias?|trending|redes sociales/gi, '')
    .trim();

  // Mensaje de espera dentro del hilo
  await say({
    text: 'Bancame un cachito...',
    thread_ts: event.ts,
  });

  try {
    const resultado = await buscarTendencias(tema || null);
    // Respuesta dentro del mismo hilo
    await say({
      text: resultado,
      thread_ts: event.ts,
    });
  } catch (err) {
    console.error(err);
    await say({
      text: 'Error buscando tendencias. Intentá de nuevo.',
      thread_ts: event.ts,
    });
  }
});

// Responde en DM directo — también en hilo
app.message(async ({ message, say }) => {
  if (message.bot_id) return;

  await say({
    text: 'Bancame un cachito...',
    thread_ts: message.ts,
  });

  try {
    const resultado = await buscarTendencias(message.text);
    await say({
      text: resultado,
      thread_ts: message.ts,
    });
  } catch (err) {
    console.error(err);
    await say({
      text: 'Error buscando tendencias. Intentá de nuevo.',
      thread_ts: message.ts,
    });
  }
});

(async () => {
  await app.start();
  console.log('✅ TrendBot corriendo!');
})();
