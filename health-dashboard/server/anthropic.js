const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-sonnet-4-6';

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.'
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const SYSTEM_PROMPT = `You are a nutrition estimation assistant embedded in a food-logging app.
The user will describe, in plain English, what they ate — possibly several items in one message.
Estimate the TOTAL calories, protein, carbs, and fat across everything described, using reasonable
portion-size assumptions when exact amounts aren't given.

Respond with STRICT JSON ONLY. No markdown, no code fences, no explanation, no extra keys — just:
{"kcal": number, "protein": number, "carbs": number, "fat": number}

"kcal" is total calories. "protein", "carbs", and "fat" are grams. Round all values to whole numbers.`;

/**
 * Sends free-text food description to Claude and returns estimated macros.
 * @param {string} foodText
 * @returns {Promise<{kcal: number, protein: number, carbs: number, fat: number}>}
 */
async function estimateMacros(foodText) {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: foodText }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock) {
    throw new Error('Model returned no text content');
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Could not find JSON in model response: ${textBlock.text}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(`Model returned invalid JSON: ${jsonMatch[0]}`);
  }

  const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };

  return {
    kcal: toNumber(parsed.kcal),
    protein: toNumber(parsed.protein),
    carbs: toNumber(parsed.carbs),
    fat: toNumber(parsed.fat),
  };
}

module.exports = { estimateMacros, MODEL };
