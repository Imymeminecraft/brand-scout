import { useState } from "react";

const CATEGORIES = ["전체", "디저트", "베이커리", "음료/카페", "식품", "전통식품"];
const SOURCES = ["인스타그램", "와디즈", "중소벤처기업부", "소상공인시장진흥공단"];
const sourceColors = { "인스타그램": "#E1306C", "와디즈": "#FF4F4F", "중소벤처기업부": "#2563EB", "소상공인시장진흥공단": "#059669" };
const REGIONS = ["전체","서울특별시","경기도","인천광역시","부산광역시","대구광역시","광주광역시","대전광역시","울산광역시","세종특별자치시","강원도","충청북도","충청남도","전라북도","전라남도","경상북도","경상남도","제주특별자치도"];
const CLAUDE_KEY = import.meta.env.VITE_CLAUDE_API_KEY || "";
const today = new Date();
const formatDate = (d) => d.toISOString().slice(0,10).replace(/-/g,"");
const nDaysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate()-n); return formatDate(d); };

const FNB_KEYWORDS = ["카페","커피","베이커리","빵","제과","파티쉐","디저트","케이크","쿠키","마카롱","푸드","식품","음료","라떼","티","차","주스","스무디","막걸리","와인","맥주","술","전통주","농장","농산물","유통","식당","맛집","치킨","피자","버거","파스타","샐러드","비건","채식","쌀","곡물","건강","영양","간식","스낵","떡","한과","김치","장류","소스","잼","꿀","초콜릿","아이스크림","젤라또","팝콘","견과","과일","채소"];
const BEAUTY_KEYWORDS = ["뷰티","화장품","코스메틱","스킨","로션","크림","세럼","앰플","마스크","팩","선크림","향수","퍼퓸","네일","립","아이","파운데이션","쿠션","헤어","샴푸","트리트먼트","바디","샤워","비누","클렌징"];
const classifyBiz = (name) => {
  const n = (name||"").toLowerCase();
  if (FNB_KEYWORDS.some(k => n.includes(k))) return "F&B";
  if (BEAUTY_KEYWORDS.some(k => n.includes(k))) return "뷰티";
  return "기타";
};
const categoryColors = { "F&B": "#10B981", "뷰티": "#E1306C", "기타": "#555" };

const CLAUDE_SYSTEM = `당신은 한국 F&B 브랜드 전문 리서처입니다. 팝업 스토어 제안에 적합한 브랜드를 분석해 반드시 아래 JSON 형식으로만 응답하세요. 마크다운이나 추가 텍스트 없이 순수 JSON만 출력하세요.\n{"brands":[{"name":"브랜드명","instagram":"@계정명 또는 null","followers":"팔로워 규모 또는 미확인","website":"URL 또는 null","category":"카테고리","sources":["출처"],"description":"한줄 설명","aesthetic":"감성 2-3단어","popupScore":7,"proposalPoint":"제안 이유"}],"summary":"요약"}\npopupScore는 1~10 사이 정수. 최소 4개, 최대 8개 반환.`;

const labelStyle = { fontSize:10, letterSpacing:3, color:"#555", textTransform:"uppercase", fontFamily:"monospace", display:"block", marginBottom:8 };
const inputBase = { width:"100%", background:"#111", border:"1px solid #2A2A2A", borderRadius:4, padding:"11px 14px", color:"#F5F0E8", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
const primaryBtn = (d) => ({ background:d?"#222":"#F5F0E8", color:d?"#555":"#0A0A0A", border:"none", borderRadius:4, padding:"11px 24px", fontSize:12, fontFamily:"monospace", letterSpacing:2, cursor:d?"not-allowed":"pointer", textTransform:"uppercase", whiteSpace:"nowrap", transition:"all 0.2s" });

function Spinner({ text }) {
  return (
    <div style={{ textAlign:"center", padding:"30px 0" }}>
      <div style={{ display:"inline-block", width:22, height:22, border:"1px solid #333", borderTop:"1px solid #F5F0E8", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
      <p style={{ color:"#555", fontFamily:"monospace", fontSize:10, letterSpacing:2, marginTop:12, textTransform:"uppercase" }}>{text}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
function ErrBox({ msg }) {
  return <div style={{ background:"#1A0A0A", border:"1px solid #3A1A1A", borderRadius:4, padding:"14px 18px", color:"#EF4444", fontFamily:"monospace", fontSize:12, marginBottom:16 }}>{msg}</div>;
}
function ScoreBar({ score }) {
  const color = score>=8?"#10B981":score>=6?"#F59E0B":"#EF4444";
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:10, color:"#555", fontFamily:"monospace", letterSpacing:1, textTransform:"uppercase" }}>팝업 적합도</span>
        <span style={{ fontSize:14, fontFamily:"monospace", color, fontWeight:700 }}>{score}/10</span>
      </div>
      <div style={{ height:3, background:"#1A1A1A", borderRadius:2 }}>
        <div style={{ height:3, width:`${score*10}%`, background:color, borderRadius:2, transition:"width 0.5s" }} />
      </div>
    </div>
  );
}

export default function BrandScout() {
  const [tab, setTab] = useState("ftc");
  const [region, setRegion] = useState("서울특별시");
  const [days, setDays] = useState("30");
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [ftcResults, setFtcResults] = useState([]);
  const [ftcLoading, setFtcLoading] = useState(false);
  const [ftcError, setFtcError] = useState("");
  const [ftcTotal, setFtcTotal] = useState(0);
  const [selectedBiz, setSelectedBiz] = useState(null);
  const [classified, setClassified] = useState({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("전체");
  const [selectedSources, setSelectedSources] = useState(SOURCES);
  const [brands, setBrands] = useState([]);
  const [summary, setSummary] = useState("");
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [claudeError, setClaudeError] = useState("");
  const [claudeSearched, setClaudeSearched] = useState(false);

  const fetchFTC = async () => {
    setFtcLoading(true); setFtcError(""); setFtcResults([]); setSelectedBiz(null); setFtcTotal(0); setClassified({}); setAnalysis(null);
    const params = new URLSearchParams({
      fromYmd: nDaysAgo(parseInt(days)),
      toYmd: formatDate(today),
      ...(region !== "전체" && { ctpvNm: region }),
    });
    try {
      const res = await fetch(`/api/ftc?${params}`);
      const data = JSON.parse(await res.text());
      const total = data?.totalCount ?? data?.response?.body?.totalCount ?? 0;
      setFtcTotal(total);
      const items = data?.items ?? data?.response?.body?.items?.item ?? null;
      if (!items || (Array.isArray(items) && items.length === 0)) { setFtcError("조회 결과가 없습니다."); return; }
      const list = Array.isArray(items) ? items : [items];
      const init = {};
      list.forEach(item => { init[item.bzmnNm||""] = classifyBiz(item.bzmnNm||""); });
      setClassified(init);
      setFtcResults(list);
    } catch(e) { setFtcError("오류: " + e.message); }
    finally { setFtcLoading(false); }
  };

  const analyzeBiz = async (item) => {
    setSelectedBiz(item);
    setAnalysis(null);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.bzmnNm || "",
          bizNo: item.brno || "",
          addr: item.rnAddr || "",
          email: item.rprsvEmladr || "",
        }),
      });
      const parsed = await res.json();
      if (parsed.error) throw new Error(parsed.error);
      setAnalysis(parsed);
      setClassified(prev => ({ ...prev, [item.bzmnNm||""]: parsed.category || prev[item.bzmnNm||""] }));
    } catch(e) {
      setAnalysis({ error: "분석 실패: " + e.message });
    }
    setAnalyzing(false);
  };

  const filteredResults = categoryFilter === "전체" ? ftcResults : ftcResults.filter(item => (classified[item.bzmnNm]||"기타") === categoryFilter);
  const fnbCount = ftcResults.filter(i => (classified[i.bzmnNm]||"기타") === "F&B").length;
  const beautyCount = ftcResults.filter(i => (classified[i.bzmnNm]||"기타") === "뷰티").length;
  const etcCount = ftcResults.filter(i => (classified[i.bzmnNm]||"기타") === "기타").length;

  const toggleSource = (src) => setSelectedSources(prev => prev.includes(src) ? prev.filter(s=>s!==src) : [...prev,src]);

  const claudeSearch = async () => {
    setClaudeLoading(true); setClaudeError(""); setBrands([]); setSummary(""); setClaudeSearched(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json","x-api-key":CLAUDE_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-calls":"true" },
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:2000, tools:[{type:"web_search_20250305",name:"web_search"}], system:CLAUDE_SYSTEM, messages:[{role:"user",content:`다음 조건으로 팝업 스토어 제안에 적합한 한국 F&B 브랜드를 리서치해주세요:\n${keyword.trim()?`키워드: "${keyword}"`:"키워드: 없음"}\n카테고리: ${category}\n확인할 소스: ${selectedSources.join(", ")}`}] }),
      });
      const d = await res.json();
      const tb = d.content?.find(b=>b.type==="text");
      if (!tb) throw new Error("응답 없음");
      const p = JSON.parse(tb.text.trim().replace(/```json|```/g,"").trim());
      setBrands(p.brands||[]); setSummary(p.summary||"");
    } catch(e) { setClaudeError("검색 오류: "+e.message); }
    finally { setClaudeLoading(false); }
  };

  const scoreColor = (s) => s>=8?"#10B981":s>=6?"#F59E0B":"#EF4444";

  return (
    <div style={{ minHeight:"100vh", background:"#0A0A0A", color:"#F5F0E8", fontFamily:"'Georgia','Times New Roman',serif" }}>
      <div style={{ borderBottom:"1px solid #1A1A1A", padding:"28px 24px 0", background:"#0A0A0A", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ fontSize:10, letterSpacing:4, color:"#444", fontFamily:"monospace", textTransform:"uppercase", marginBottom:6 }}>Benjamin Universe · Brand Scout</div>
          <h1 style={{ fontSize:20, fontWeight:400, margin:"0 0 20px", letterSpacing:-0.3 }}>팝업 제안 브랜드 탐색기</h1>
          <div style={{ display:"flex" }}>
            {[["ftc","📋  통신판매업 신규조회"],["claude","🔍  브랜드 서치"]].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} style={{ padding:"10px 20px", border:"none", cursor:"pointer", transition:"all 0.15s", borderBottom:tab===k?"2px solid #F5F0E8":"2px solid transparent", background:"transparent", color:tab===k?"#F5F0E8":"#555", fontSize:13, fontFamily:"monospace" }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px 80px" }}>
        {tab==="ftc"&&(
          <div>
            <p style={{ color:"#555", fontSize:13, fontFamily:"monospace", marginBottom:24, lineHeight:1.7 }}>공정거래위원회 공식 DB에서 신규 통신판매업 신고 업체를 조회합니다. <span style={{ color:"#333" }}>업체 클릭 시 AI가 자동 분석합니다.</span></p>
            <div style={{ display:"flex", gap:12, marginBottom:24, flexWrap:"wrap", alignItems:"flex-end" }}>
              <div style={{ minWidth:160 }}>
                <label style={labelStyle}>지역</label>
                <select value={region} onChange={e=>setRegion(e.target.value)} style={inputBase}>{REGIONS.map(r=><option key={r}>{r}</option>)}</select>
              </div>
              <div style={{ minWidth:140 }}>
                <label style={labelStyle}>신고 기간</label>
                <select value={days} onChange={e=>setDays(e.target.value)} style={inputBase}>
                  {[["7","최근 7일"],["14","최근 14일"],["30","최근 30일"],["60","최근 60일"],["90","최근 90일"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <button onClick={fetchFTC} disabled={ftcLoading} style={primaryBtn(ftcLoading)}>{ftcLoading?"조회중...":"조회"}</button>
            </div>

            {ftcLoading&&<Spinner text="공정위 DB 조회 중..." />}
            {ftcError&&<ErrBox msg={ftcError} />}

            {ftcResults.length>0&&(
              <div>
                <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
                  {[["전체",ftcResults.length,"#888"],["F&B",fnbCount,"#10B981"],["뷰티",beautyCount,"#E1306C"],["기타",etcCount,"#555"]].map(([cat,count,color])=>(
                    <button key={cat} onClick={()=>setCategoryFilter(cat)} style={{ padding:"6px 14px", borderRadius:3, fontSize:12, fontFamily:"monospace", cursor:"pointer", transition:"all 0.15s", border:`1px solid ${categoryFilter===cat?color:"#2A2A2A"}`, background:categoryFilter===cat?`${color}22`:"transparent", color:categoryFilter===cat?color:"#555" }}>
                      {cat} <span style={{ opacity:0.6 }}>({count})</span>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:12, fontFamily:"monospace", color:"#555", marginBottom:14 }}>
                  총 <span style={{ color:"#CCC" }}>{ftcTotal.toLocaleString()}</span>건 중 {filteredResults.length}건 표시
                  <span style={{ color:"#333", marginLeft:10 }}>· 클릭하면 AI가 자동 분석</span>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:selectedBiz?"1fr 340px":"1fr", gap:16 }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {filteredResults.map((item,i)=>{
                      const name=item.bzmnNm||"상호명 없음";
                      const bizNo=item.brno;
                      const rd=item.dclrDate||"";
                      const date=rd.length===8?`${rd.slice(0,4)}.${rd.slice(4,6)}.${rd.slice(6)}`:rd;
                      const cat=classified[name]||"기타";
                      const catColor=categoryColors[cat];
                      const isSelected=selectedBiz?.brno===item.brno;
                      return (
                        <div key={i} onClick={()=>analyzeBiz(item)}
                          style={{ background:isSelected?"#151515":"#111", border:`1px solid ${isSelected?"#333":"#1E1E1E"}`, borderRadius:5, padding:"13px 16px", cursor:"pointer", transition:"all 0.15s" }}
                          onMouseEnter={e=>e.currentTarget.style.borderColor="#333"}
                          onMouseLeave={e=>e.currentTarget.style.borderColor=isSelected?"#333":"#1E1E1E"}
                        >
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                                <div style={{ fontSize:15, color:"#F5F0E8" }}>{name}</div>
                                <span style={{ fontSize:10, padding:"2px 7px", borderRadius:2, background:`${catColor}22`, color:catColor, fontFamily:"monospace" }}>{cat}</span>
                              </div>
                              <div style={{ fontSize:11, fontFamily:"monospace", color:"#555" }}>
                                {[item.ctpvNm,item.dclrInstNm].filter(Boolean).join(" · ")}
                                {bizNo&&<span style={{ marginLeft:10 }}>사업자: {bizNo}</span>}
                              </div>
                            </div>
                            <div style={{ fontSize:11, fontFamily:"monospace", color:"#444", whiteSpace:"nowrap", marginLeft:12 }}>{date}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedBiz&&(
                    <div style={{ background:"#111", border:"1px solid #2A2A2A", borderRadius:6, padding:"20px", height:"fit-content", position:"sticky", top:120 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, paddingBottom:14, borderBottom:"1px solid #1A1A1A" }}>
                        <div style={{ fontSize:16, color:"#F5F0E8" }}>{selectedBiz.bzmnNm}</div>
                        <button onClick={()=>{setSelectedBiz(null);setAnalysis(null);}} style={{ padding:"4px 10px", background:"transparent", border:"1px solid #2A2A2A", borderRadius:3, color:"#555", fontSize:11, fontFamily:"monospace", cursor:"pointer", flexShrink:0, marginLeft:8 }}>닫기</button>
                      </div>

                      {[["사업자번호",selectedBiz.brno],["대표자",selectedBiz.rprsvNm],["이메일",selectedBiz.rprsvEmladr],["주소",selectedBiz.rnAddr],["신고일",selectedBiz.dclrDate],["통신판매번호",selectedBiz.prmmiMnno]].filter(([,v])=>v&&v!=="N/A").map(([label,val])=>(
                        <div key={label} style={{ marginBottom:8 }}>
                          <div style={{ fontSize:9, color:"#444", fontFamily:"monospace", letterSpacing:1, textTransform:"uppercase", marginBottom:2 }}>{label}</div>
                          <div style={{ fontSize:12, color:"#AAA", lineHeight:1.5, wordBreak:"break-all" }}>{val}</div>
                        </div>
                      ))}

                      <div style={{ borderTop:"1px solid #1A1A1A", marginTop:16, paddingTop:16 }}>
                        {analyzing&&<Spinner text="AI 분석 중..." />}

                        {analysis&&!analysis.error&&(
                          <div>
                            <div style={{ fontSize:10, color:"#555", fontFamily:"monospace", letterSpacing:2, textTransform:"uppercase", marginBottom:12 }}>AI 분석 결과</div>

                            {analysis.item&&(
                              <div style={{ background:"#0A1A0A", border:"1px solid #1A2E1A", borderRadius:4, padding:"10px 14px", marginBottom:12 }}>
                                <div style={{ fontSize:9, color:"#3A6A3A", fontFamily:"monospace", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>취급 아이템</div>
                                <div style={{ fontSize:14, color:"#8FBE8F" }}>{analysis.item}</div>
                              </div>
                            )}

                            {analysis.summary&&<p style={{ fontSize:12, color:"#AAA", lineHeight:1.7, marginBottom:12 }}>{analysis.summary}</p>}
                            {analysis.popupScore&&<ScoreBar score={analysis.popupScore} />}

                            {analysis.popupReason&&(
                              <div style={{ background:"#0D1A0D", border:"1px solid #1A2E1A", borderRadius:4, padding:"10px 14px", marginBottom:12 }}>
                                <div style={{ fontSize:9, color:"#3A6A3A", fontFamily:"monospace", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>제안 포인트</div>
                                <p style={{ fontSize:12, color:"#7AAE7A", lineHeight:1.7, margin:0 }}>{analysis.popupReason}</p>
                              </div>
                            )}

                            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                              {analysis.instagram&&<a href={`https://instagram.com/${analysis.instagram.replace("@","")}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, fontFamily:"monospace", color:"#E1306C", textDecoration:"none", padding:"4px 10px", border:"1px solid #E1306C33", borderRadius:3 }}>📷 {analysis.instagram}</a>}
                              {analysis.website&&<a href={analysis.website} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, fontFamily:"monospace", color:"#4A9EFF", textDecoration:"none", padding:"4px 10px", border:"1px solid #4A9EFF33", borderRadius:3 }}>🌐 웹사이트</a>}
                              {analysis.smartstore&&<a href={analysis.smartstore} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, fontFamily:"monospace", color:"#03C75A", textDecoration:"none", padding:"4px 10px", border:"1px solid #03C75A33", borderRadius:3 }}>🛒 스마트스토어</a>}
                              {analysis.wadiz&&<a href={analysis.wadiz} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, fontFamily:"monospace", color:"#FF4F4F", textDecoration:"none", padding:"4px 10px", border:"1px solid #FF4F4F33", borderRadius:3 }}>🚀 와디즈</a>}
                            </div>

                            {analysis.brandTone&&<div style={{ fontSize:11, color:"#555", fontFamily:"monospace", fontStyle:"italic" }}>감성: {analysis.brandTone}</div>}
                          </div>
                        )}

                        {analysis?.error&&<ErrBox msg={analysis.error} />}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="claude"&&(
          <div>
            <p style={{ color:"#555", fontSize:13, fontFamily:"monospace", marginBottom:24, lineHeight:1.7 }}>Claude가 웹서치로 인스타그램·와디즈·중기부 등에서 팝업 적합 브랜드를 탐색합니다.</p>
            <div style={{ marginBottom:18 }}>
              <label style={labelStyle}>키워드 (선택)</label>
              <div style={{ display:"flex", gap:10 }}>
                <input value={keyword} onChange={e=>setKeyword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&claudeSearch()} placeholder="예: 건강 디저트, 전통 베이커리..." style={{ ...inputBase, flex:1 }} />
                <button onClick={claudeSearch} disabled={claudeLoading} style={primaryBtn(claudeLoading)}>{claudeLoading?"탐색중...":"탐색"}</button>
              </div>
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={labelStyle}>카테고리</label>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {CATEGORIES.map(cat=><button key={cat} onClick={()=>setCategory(cat)} style={{ padding:"7px 14px", borderRadius:3, fontSize:12, fontFamily:"monospace", cursor:"pointer", transition:"all 0.15s", border:`1px solid ${category===cat?"#F5F0E8":"#2A2A2A"}`, background:category===cat?"#F5F0E8":"transparent", color:category===cat?"#0A0A0A":"#666" }}>{cat}</button>)}
              </div>
            </div>
            <div style={{ marginBottom:28 }}>
              <label style={labelStyle}>탐색 소스</label>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {SOURCES.map(src=>{const active=selectedSources.includes(src);return <button key={src} onClick={()=>toggleSource(src)} style={{ padding:"7px 14px", borderRadius:3, fontSize:12, fontFamily:"monospace", cursor:"pointer", transition:"all 0.15s", border:`1px solid ${active?sourceColors[src]:"#2A2A2A"}`, background:active?`${sourceColors[src]}18`:"transparent", color:active?sourceColors[src]:"#555" }}>{src}</button>;})}
              </div>
            </div>
            <div style={{ borderTop:"1px solid #1A1A1A", marginBottom:28 }} />
            {claudeLoading&&<Spinner text="브랜드 탐색 중..." />}
            {claudeError&&<ErrBox msg={claudeError} />}
            {summary&&<div style={{ fontFamily:"monospace", fontSize:12, color:"#555", marginBottom:16 }}>↳ {summary}</div>}
            {brands.length>0&&(
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {brands.map((brand,i)=>(
                  <div key={i} style={{ background:"#111", border:"1px solid #1E1E1E", borderRadius:6, padding:"20px 24px", transition:"border-color 0.2s" }} onMouseEnter={e=>e.currentTarget.style.borderColor="#333"} onMouseLeave={e=>e.currentTarget.style.borderColor="#1E1E1E"}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                      <div>
                        <h2 style={{ margin:0, fontSize:17, fontWeight:400, color:"#F5F0E8" }}>{brand.name}</h2>
                        <div style={{ display:"flex", gap:12, marginTop:4, flexWrap:"wrap" }}>
                          {brand.instagram&&<span style={{ fontFamily:"monospace", fontSize:12, color:"#E1306C" }}>{brand.instagram}{brand.followers&&brand.followers!=="미확인"&&<span style={{ color:"#555" }}> · {brand.followers}</span>}</span>}
                          {brand.website&&<a href={brand.website} target="_blank" rel="noopener noreferrer" style={{ fontFamily:"monospace", fontSize:12, color:"#4A9EFF", textDecoration:"none" }}>{brand.website}</a>}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0, marginLeft:12 }}>
                        <div style={{ fontSize:20, fontFamily:"monospace", color:scoreColor(brand.popupScore), fontWeight:700 }}>{brand.popupScore}<span style={{ fontSize:11, color:"#333" }}>/10</span></div>
                        <div style={{ fontSize:10, color:"#444", letterSpacing:2, textTransform:"uppercase", fontFamily:"monospace" }}>팝업 적합도</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                      <span style={{ padding:"2px 9px", borderRadius:2, background:"#1A1A1A", color:"#666", fontSize:11, fontFamily:"monospace" }}>{brand.category}</span>
                      {brand.aesthetic&&<span style={{ padding:"2px 9px", borderRadius:2, background:"#1A1A1A", color:"#666", fontSize:11, fontFamily:"monospace", fontStyle:"italic" }}>{brand.aesthetic}</span>}
                      {(brand.sources||[]).map(src=><span key={src} style={{ padding:"2px 9px", borderRadius:2, background:`${sourceColors[src]||"#555"}18`, color:sourceColors[src]||"#888", fontSize:11, fontFamily:"monospace", border:`1px solid ${sourceColors[src]||"#555"}33` }}>{src}</span>)}
                    </div>
                    <p style={{ margin:"0 0 10px", color:"#999", fontSize:14, lineHeight:1.7 }}>{brand.description}</p>
                    <div style={{ background:"#0D1A0D", border:"1px solid #1A2E1A", borderRadius:4, padding:"10px 14px" }}>
                      <div style={{ fontSize:10, letterSpacing:2, color:"#3A6A3A", textTransform:"uppercase", fontFamily:"monospace", marginBottom:4 }}>제안 포인트</div>
                      <p style={{ margin:0, color:"#7AAE7A", fontSize:13, lineHeight:1.7 }}>{brand.proposalPoint}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {claudeSearched&&!claudeLoading&&brands.length===0&&!claudeError&&<div style={{ textAlign:"center", padding:"60px 0", color:"#2A2A2A", fontFamily:"monospace", fontSize:12, letterSpacing:2, textTransform:"uppercase" }}>결과 없음</div>}
          </div>
        )}
      </div>
    </div>
  );
}
