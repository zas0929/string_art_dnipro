const COMMAND_PHRASES = {
  uk: {
    play: [
      "старт",
      "почати",
      "продовжити",
      "продовжуй",
      "запускай",
      "начать",
      "продолжить",
      "продолжай",
      "поехали",
    ],
    pause: [
      "пауза",
      "стоп",
      "зупини",
      "зупинити",
      "остановить",
      "бля",
      "блять",
      "блядь",
      "блят",
      "блин",
      "бляха",
      "бляха муха",
    ],
    next: ["далі", "наступна", "наступний", "вперед", "вперёд", "дальше", "далее", "следующий"],
    previous: ["назад", "обратно", "попередня", "попередній", "предыдущий"],
    repeat: ["повтори", "повторити", "ще раз", "еще раз"],
    faster: ["швидше", "прискорити", "быстрее", "ускорить"],
    slower: ["повільніше", "сповільнити", "медленнее", "замедлить"],
    lost: ["я загубився", "я загубилась", "я потерялся", "я потерялась"],
    voiceOn: ["увімкни звук", "увімкнути звук", "включи звук"],
    voiceOff: ["вимкни звук", "вимкнути звук", "выключи звук"],
  },
  en: {
    play: ["start", "play", "continue", "resume"],
    pause: ["pause", "stop", "hold"],
    next: ["next", "forward", "next step"],
    previous: ["back", "previous", "previous step"],
    repeat: ["repeat", "repeat point", "say again"],
    faster: ["faster", "speed up"],
    slower: ["slower", "slow down"],
    lost: ["i am lost", "im lost", "find my position"],
    voiceOn: ["sound on", "voice on", "turn on sound"],
    voiceOff: ["sound off", "voice off", "turn off sound"],
  },
};

export function parseBuildVoiceCommand(transcript, language = "uk") {
  const normalized = normalizeTranscript(transcript);
  if (!normalized) return null;

  const seekStep = parseSeekStep(normalized, language);
  if (seekStep !== null) return { type: "seek", step: seekStep };

  const phrases = COMMAND_PHRASES[language === "en" ? "en" : "uk"];
  if (includesPhrase(normalized, phrases.voiceOff)) return { type: "voice_off" };
  if (includesPhrase(normalized, phrases.voiceOn)) return { type: "voice_on" };
  if (includesPhrase(normalized, phrases.lost)) return { type: "lost" };
  if (includesPhrase(normalized, phrases.pause)) return { type: "pause" };
  if (includesPhrase(normalized, phrases.repeat)) return { type: "repeat" };
  if (includesPhrase(normalized, phrases.faster)) return { type: "faster" };
  if (includesPhrase(normalized, phrases.slower)) return { type: "slower" };
  if (includesPhrase(normalized, phrases.previous)) return { type: "previous" };
  if (includesPhrase(normalized, phrases.next)) return { type: "next" };
  if (includesPhrase(normalized, phrases.play)) return { type: "play" };
  return null;
}

function normalizeTranscript(value) {
  return String(value ?? "")
    .toLocaleLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesPhrase(transcript, phrases) {
  return phrases.some((phrase) => (
    transcript === phrase
    || transcript.startsWith(`${phrase} `)
    || transcript.endsWith(` ${phrase}`)
    || transcript.includes(` ${phrase} `)
  ));
}

function parseSeekStep(transcript, language) {
  const patterns = language === "en"
    ? [
      /(?:go|jump|move|rewind)\s+(?:to\s+)?(?:step\s+)?(\d{1,5})\b/,
      /\bstep\s+(\d{1,5})\b/,
    ]
    : [
      /(?:перейди|перейти|перемотай|перемотати)\s+(?:до|на)\s+(?:кроку?\s+|шаг\s+)?(\d{1,5})\b/,
      /(?:крок|кроку|шаг)\s+(\d{1,5})\b/,
    ];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) return Math.max(1, Number.parseInt(match[1], 10));
  }
  return null;
}
