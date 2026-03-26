export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const CLAUDE_KEY = process.env.VITE_CLAUDE_API_KEY;
  const { name, bizNo, addr, email } = req.body;

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
        tool_choice: { type: "auto" },
        system: `당신은 한국 브랜드 분석가입니다. 업체를 웹서치한 후 반드시 아래 JSON 형식으로만 최종 답변하세요. JSON 외 텍스트 절대 금지.

최종 답변 형식:
{"item":"취급아이템","category":"F&B또는뷰티또는기타","instagram":"@계정또는null","website":"URL또는null","smartstore":"URL또는null","wadiz":"URL또는null","followers":"팔로워수또는미확인","brandTone":"감성키워드","popupScore":7,"popupReason":"팝업제안이유","summary":"한줄요약"}`,
        messages: [{
          role: "user",
          content: `업체명: ${name}, 사업자번호: ${bizNo}, 주소: ${addr}\n\n이 업체를 검색해서 취급 아이템, SNS, 팝업 적합도를 분석 후 JSON으로만 답변하세요.`
        }],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "API 오류");

    const textBlock = data.content?.find(b => b.type === "text");
    if (!textBlock?.text) throw new Error("텍스트 응답 없음");

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 없음: " + textBlock.text.slice(0, 100));

    const parsed = JSON.parse(jsonMatch[0]);
    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
