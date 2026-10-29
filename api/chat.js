
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Gemini API key belum dikonfigurasi."
    });
  }

  const {
    character = "Raras",
    message,
    history = []
  } = req.body || {};

  if (
    typeof message !== "string" ||
    !message.trim()
  ) {
    return res.status(400).json({
      error: "Pesan tidak boleh kosong."
    });
  }

  const allowedCharacters = [
    "Raras",
    "Arya",
    "Diajeng",
    "Anindya",
    "Sekar",
    "Rangga",
    "Rakha"
  ];

  const selectedCharacter =
    allowedCharacters.includes(character)
      ? character
      : "Raras";

  const safeHistory = Array.isArray(history)
    ? history
        .filter(
          item =>
            item &&
            ["user", "model"].includes(item.role) &&
            typeof item.text === "string"
        )
        .slice(-12)
        .map(item => ({
          role: item.role,
          parts: [{
            text: item.text.slice(0, 2000)
          }]
        }))
    : [];

  const characterProfiles = {
    Raras: "Hangat, perhatian, peka terhadap suasana, dan berbicara natural.",
    Arya: "Santai, sedikit jahil, percaya diri, dan suka bercanda.",
    Diajeng: "Ekspresif, ceria, spontan, dan peduli pada teman.",
    Anindya: "Tenang, cerdas, observatif, dan berbicara dengan teratur.",
    Sekar: "Ramah, lembut, humoris, dan mudah menunjukkan perhatian.",
    Rangga: "Usil, blak-blakan, santai, dan suka menggoda teman.",
    Rakha: "Kalem, suportif, responsif, dan tidak banyak basa-basi."
  };

  const systemPrompt = `
Kamu memerankan karakter fiksi bernama ${selectedCharacter}
dalam website simulasi HP AU milik Raka.

Kepribadian:
${characterProfiles[selectedCharacter]}

Aturan percakapan:
- Gunakan bahasa Indonesia sehari-hari yang natural.
- Sesuaikan balasan dengan pesan dan riwayat percakapan.
- Jangan mengulang jawaban yang sama terus-menerus.
- Boleh bertanya balik, bercanda, menunjukkan emosi,
  atau melanjutkan topik secara wajar.
- Jangan mengaku sebagai manusia sungguhan.
- Balas seperti pesan chat, singkat tetapi tetap bermakna.
- Jangan mengendalikan ucapan atau tindakan Raka.
- Semua nama dan interaksi merupakan karakter fiksi.
`;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: systemPrompt
            }]
          },
          contents: [
            ...safeHistory,
            {
              role: "user",
              parts: [{
                text: message.trim().slice(0, 2000)
              }]
            }
          ],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 250
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini API error:",
        response.status,
        data.error?.message
      );

      return res.status(502).json({
        error: "Gemini gagal membalas. Periksa kuota atau konfigurasi API."
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "Gemini tidak menghasilkan balasan teks."
      });
    }

    return res.status(200).json({
      character: selectedCharacter,
      reply
    });
  } catch (error) {
    console.error("Chat backend error:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan pada server chat."
    });
  }
};

