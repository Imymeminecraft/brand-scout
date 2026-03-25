export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { fromYmd, toYmd, ctpvNm, pageNo, numOfRows } = req.query;
  const API_KEY = process.env.VITE_FTC_API_KEY;

  const params = new URLSearchParams({
    serviceKey: API_KEY,
    pageNo: pageNo || "1",
    numOfRows: numOfRows || "50",
    resultType: "json",
    fromYmd,
    toYmd,
    ...(ctpvNm && ctpvNm !== "전체" && { ctpvNm }),
  });

  try {
    const response = await fetch(
      `https://apis.data.go.kr/1130000/MllBs_2Service/getMllBsInfo_2?${params}`
    );
    const text = await response.text();
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
