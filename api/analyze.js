export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const CLAUDE_KEY = process.env.VITE_CLAUDE_API_KEY;
  const { name, bizNo, addr, email } = req.body;

  const prompt = `업체명: ${name}
사업자번호: ${bizNo}
주소: ${addr}
이메일: ${email}

위 업체를 웹서치해서 분석해주세요. 다음 순서로 검색하세요:
1. "${name}" 검색
2. "${name} 인스타그램" 검색  
3. "${name} 스마트스토어" 검색
4. "${name} 와디즈" 검색

반드시 아래 JSON만 출력하세요. 다른 텍스트 절대 금지:
{"item":"취급아이템","category":"F&B또는뷰티또는기타","instagram":"@계정또는null","website":"URL또는null","smartstore":"URL또는null","wadiz":"URL또는null","followers":"팔로워수또는미확인","brandTone":"감성2-3단어","popupScore":7,"popupReason":"제안이유2-3문장","summary":"한줄요약"}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: "당신은 한국 브랜드 분석 전문가입니다. 웹서치 후 반드시 순수 JSON만 출력하세요. JSON 외 어떤 텍스트도 출력하지 마세요.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const textBlock = data.content?.find(b => b.type === "text");
    if (!textBlock) { res.status(500).json({ error: "응답 없음" }); return; }

    let raw = textBlock.text.trim();
    // JSON 블록만 추출
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { res.status(500).json({ error: "JSON 파싱 실패" }); return; }
    const parsed = JSON.parse(jsonMatch[0]);
    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
