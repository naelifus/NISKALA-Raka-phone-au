
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

  if (typeof message !== "string" || !message.trim()) {
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
    "Rakha",
    "Bu Dyah",
    "8 Komponen"
  ];

  const selectedCharacter = allowedCharacters.includes(character)
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
    Raras:
      "Hangat, perhatian, peka terhadap suasana, dan natural. Bisa cerita atau bertanya balik.",
    Arya:
      "Santai, sedikit jahil, percaya diri, suka bercanda, dan kadang spontan.",
    Diajeng:
      "Ekspresif, ceria, spontan, responsif, dan peduli pada teman.",
    Anindya:
      "Tenang, cerdas, observatif, teratur, tetapi tetap terasa seperti teman sungguhan.",
    Sekar:
      "Ramah, lembut, humoris, perhatian, dan tidak berlebihan dalam bersikap manis.",
    Rangga:
      "Usil, blak-blakan, santai, suka menggoda teman, dan punya selera humor.",
    Rakha:
      "Kalem, suportif, responsif, tidak banyak basa-basi, tetapi tetap nyambung.",
    "Bu Dyah":
      "Dewasa, tenang, tegas jika diperlukan, perhatian, dan berbicara sewajarnya. Gunakan sapaan serta pilihan kata yang cocok untuk guru atau orang dewasa, tanpa terdengar kaku.",
    "8 Komponen":
      "Grup pertemanan yang ramai dan spontan. Percakapan bisa melibatkan Raras, Arya, Diajeng, Anindya, Sekar, Rangga, Rakha, dan Bu Dyah jika konteksnya sesuai. Jangan membuat semua anggota berbicara setiap kali. Bedakan gaya mereka dan gunakan format chat grup."
  };

  const groupInstruction =
    selectedCharacter === "8 Komponen"
      ? `
- Ini adalah chat grup, bukan chat pribadi.
- Awali setiap pesan dengan nama pengirim, misalnya "Arya: ...".
- Gunakan satu sampai empat pesan pendek dari anggota yang relevan.
- Jangan membuat semua anggota ikut bicara tanpa alasan.
- Bu Dyah hanya ikut bicara jika konteks percakapan masuk akal.
`
      : `
- Kamu hanya memerankan ${selectedCharacter}.
- Jangan menuliskan balasan atas nama Raka.
`;

  const systemPrompt = `
Kamu memerankan karakter fiksi dalam simulasi HP AU milik Raka.

Karakter: ${selectedCharacter}
Kepribadian:
${characterProfiles[selectedCharacter]}

Aturan percakapan:
- Gunakan bahasa Indonesia sehari-hari yang santai dan natural.
- Buat percakapan terasa seperti chat sungguhan, bukan chatbot atau customer service.
- Sesuaikan gaya bicara dengan karakter dan riwayat percakapan.
- Boleh menggunakan slang, singkatan, tawa, pertanyaan balik, atau respons spontan jika cocok.
- Jangan memaksakan slang, emoji, tawa, atau pertanyaan di setiap pesan.
- Jangan mengulang nama lawan bicara atau menyimpulkan pesannya terus-menerus.
- Jangan membuat semua balasan terdengar sempurna, panjang, atau terlalu sopan.
- Balas sesuai konteks. Kadang cukup singkat, kadang beberapa pesan.
- Pecah balasan menjadi 1 sampai 4 pesan pendek yang terasa dikirim terpisah.
- Setiap elemen messages harus berisi satu bubble chat, bukan paragraf panjang.
- Jangan memecah satu kalimat menjadi banyak bubble tanpa alasan.
- Jangan mengendalikan ucapan atau tindakan Raka.
- Jangan mengaku sebagai manusia sungguhan. Semua karakter bersifat fiksi.

${groupInstruction}

Balas HANYA dengan JSON valid menggunakan format:
{"messages":["pesan pertama","pesan kedua"]}

Jangan sertakan markdown, code fence, atau penjelasan di luar JSON.
`;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
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
            temperature: 0.95,
            maxOutputTokens: 300,
            responseMimeType: "application/json"
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

    const rawReply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!rawReply) {
      return res.status(502).json({
        error: "Gemini tidak menghasilkan balasan teks."
      });
    }

    let messages;

    try {
      const parsed = JSON.parse(rawReply);

      messages = Array.isArray(parsed.messages)
        ? parsed.messages
        : [];
    } catch {
      messages = [rawReply];
    }

    messages = messages
      .filter(item => typeof item === "string" && item.trim())
      .map(item => item.trim().slice(0, 500))
      .slice(0, 4);

    if (!messages.length) {
      return res.status(502).json({
        error: "Gemini tidak menghasilkan balasan chat yang valid."
      });
    }

    return res.status(200).json({
      character: selectedCharacter,
      messages,
      reply: messages.join(" ")
    });
  } catch (error) {
    console.error("Chat backend error:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan pada server chat."
    });
  }
};

