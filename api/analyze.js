export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const CLAUDE_KEY = process.env.VITE_CLAUDE_API_KEY;
  const { name, bizNo, addr, email } = req.body;

  try {
    // 1단계: 웹서치로 정보 수집
    const searchRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: "한국 브랜드 리서처입니다. 주어진 업체를 웹서치해서 정보를 수집하세요.",
        messages: [{ role: "user", content: `"${name}" 업체를 검색해서 어떤 제품/서비스를 판매하는지, 인스타그램, 스마트스토어, 와디즈 링크를 찾아주세요. 사업자번호: ${bizNo}, 주소: ${addr}` }],
      }),
    });

    const searchData = await searchRes.json();
    const searchText = searchData.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "";

    // 2단계: 수집된 정보로 JSON 생성
    const jsonRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: "JSON만 출력하세요. 다른 텍스트 금지.",
        messages: [{
          role: "user",
          content: `아래 리서치 결과를 바탕으로 JSON만 출력하세요:

리서치 결과:
${searchText}

업체명: ${name}

출력 형식 (이것만 출력, 다른 텍스트 없이):
{"item":"취급 아이템","category":"F&B 또는 뷰티 또는 기타","instagram":"@계정 또는 null","website":"URL 또는 null","smartstore":"URL 또는 null","wadiz":"URL 또는 null","followers":"팔로워수 또는 미확인","brandTone":"감성 2-3단어","popupScore":7,"popupReason":"팝업 제안 이유","summary":"한줄 요약"}`
        }],
      }),
    });

    const jsonData = await jsonRes.json();
    const rawText = jsonData.content?.find(b => b.type === "text")?.text || "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 추출 실패");
    const parsed = JSON.parse(jsonMatch[0]);
    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
