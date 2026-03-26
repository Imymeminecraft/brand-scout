export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const CLAUDE_KEY = process.env.VITE_CLAUDE_API_KEY;
  const { name, bizNo, addr, email } = req.body;

  const prompt = `다음 업체 정보로 웹서치해서 어떤 아이템을 판매하는지 분석해주세요:

업체명: ${name}
사업자번호: ${bizNo}
주소: ${addr}
이메일: ${email}

검색 방법:
1. "${name}" 으로 구글/네이버 검색
2. "${name} 인스타그램" 검색
3. "${name} 와디즈" 검색
4. "${name} 스마트스토어" 검색

반드시 순수 JSON만 출력하세요:
{
  "item": "주요 취급 아이템",
  "category": "F&B 또는 뷰티 또는 기타",
  "instagram": "@계정명 또는 null",
  "website": "URL 또는 null",
  "smartstore": "스마트스토어 URL 또는 null",
  "wadiz": "와디즈 URL 또는 null",
  "followers": "팔로워 수 또는 미확인",
  "brandTone": "브랜드 감성 2-3단어",
  "popupScore": 7,
  "popupReason": "팝업 제안 이유 2-3문장",
  "summary": "업체 한줄 요약"
}`;

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
        system: "당신은 한국 브랜드 분석 전문가입니다. 웹서치로 업체 정보를 찾아 JSON으로만 응답하세요.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const textBlock = data.content?.find(b => b.type === "text");
    if (!textBlock) { res.status(500).json({ error: "응답 없음" }); return; }

    const raw = textBlock.text.trim().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);
    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
