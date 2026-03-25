import { useState } from "react";

const CLAUDE_KEY = import.meta.env.VITE_CLAUDE_API_KEY || "";
const CATEGORIES = ["전체", "디저트", "베이커리", "음료/카페", "식품", "전통식품"];
const SOURCES = ["인스타그램", "와디즈", "중소벤처기업부", "소상공인시장진흥공단"];
const sourceColors = { "인스타그램": "#E1306C", "와디즈": "#FF4F4F", "중소벤처기업부": "#2563EB", "소상공인시장진흥공단": "#059669" };
const REGIONS = ["전체","서울특별시","경기도","인천광역시","부산광역시","대구광역시","광주광역시","대전광역시","울산광역시","세종특별자치시","강원도","충청북도","충청남도","전라북도","전라남도","경상북도","경상남도","제주특별자치도"];
const today = new Date();
const formatDate = (d) => d.toISOString().slice(0,10).replace(/-/g,"");
const nDaysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate()-n); return formatDate(d); };
const CLAUDE_SYSTEM = `당신은 한국 F&B 브랜드 전문 리서처입니다. 팝업 스토어 제안에 적합한 브랜드를 분석해 반드시 아래 JSON 형식으로만 응답하세요. 마크다운이나 추가 텍스트 없이 순수 JSON만 출력하세요.\n{"brands":[{"name":"브랜드명","instagram":"@계정명 또는 null","followers":"팔로워 규모 또는 미확인","website":"URL 또는 null","category":"카테고리","sources":["출처"],"description":"한줄 설명","aesthetic":"감성 2-3단어","popupScore":7,"proposalPoint":"제안 이유"}],"summary":"요약"}\npopupScore는 1~10 사이 정수. 최소 4개, 최대 8개 반환.`;
const labelStyle = { fontSize:10, letterSpacing:3, color:"#555", textTransform:"uppercase", fontFamily:"monospace", display:"block", marginBottom:8 };
const inputBase = { width:"100%", background:"#111", border:"1px solid #2A2A2A", borderRadius:4, padding:"11px 14px", color:"#F5F0E8", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
const primaryBtn = (d) => ({ background:d?"#222":"#F5F0E8", color:d?"#555":"#0A0A0A", border:"none", borderRadius:4, padding:"11px 24px", fontSize:12, fontFamily:"monospace", letterSpacing:2, cursor:d?"not-allowed":"pointer", textTransform:"uppercase", whiteSpace:"nowrap", transition:"all 0.2s" });

function Spinner({ text }) {
  return (
    <div style={{ textAlign:"center", padding:"50px 0" }}>
      <div style={{ display:"inline-block", width:28, height:28, border:"1px solid #333", borderTop:"1px solid #F5F0E8", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
      <p style={{ color:"#555", fontFamily:"monospace", fontSize:11, letterSpacing:2, marginTop:16, textTransform:"uppercase" }}>{text}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
function ErrBox({ msg }) {
  return <div style={{ background:"#1A0A0A", border:"1px solid #3A1A1A", borderRadius:4, padding:"14px 18px", color:"#EF4444", fontFamily:"monospace", fontSize:12, marginBottom:16 }}>{msg}</div>;
}

export default function BrandScout() {
  const [tab, setTab] = useState("ftc");
  const [region, setRegion] = useState("서울특별시");
  const [days, setDays] = useState("30");
  const [ftcResults, setFtcResults] = useState([]);
  const [ftcLoading, setFtcLoading] = useState(false);
  const [ftcError, setFtcError] = useState("");
  const [ftcTotal, setFtcTotal] = useState(0);
  const [selectedBiz, setSelectedBiz] = useState(null);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("전체");
  const [selectedSources, setSelectedSources] = useState(SOURCES);
  const [brands, setBrands] = useState([]);
  const [summary, setSummary] = useState("");
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [claudeError, setClaudeError] = useState("");
  const [claudeSearched, setClaudeSearched] = useState(false);

  const fetchFTC = async () => {
    setFtcLoading(true); setFtcError(""); setFtcResults([]); setSelectedBiz(null); setFtcTotal(0);
    const params = new URLSearchParams({
      fromYmd: nDaysAgo(parseInt(days)),
      toYmd: formatDate(today),
      ...(region !== "전체" && { ctpvNm: region }),
    });
    try {
      const res = await fetch(`/api/ftc?${params}`);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch {
        const xml = new DOMParser().parseFromString(text, "text/xml");
        const code = xml.querySelector("resultCode")?.textContent;
        if (code !== "00") { setFtcError("API 오류: " + (xml.querySelector("resultMsg")?.textContent||"알 수 없는 오류")); return; }
        const total = parseInt(xml.querySelector("totalCount")?.textContent||"0");
        setFtcTotal(total);
        const items = xml.querySelectorAll("item");
        if (!items.length) { setFtcError("조회 결과가 없습니다. 기간이나 지역을 조정해보세요."); return; }
        setFtcResults(Array.from(items).map(item => ({
          pBizNm: item.querySelector("bzmnNm")?.textContent,
          pBizNo: item.querySelector("brno")?.textContent,
          pSidoNm: item.querySelector("ctpvNm")?.textContent,
          pSggNm: item.querySelector("dclrInstNm")?.textContent,
          pMllBsNo: item.querySelector("prmmiMnno")?.textContent,
          pRgstDe: item.querySelector("prmmiIssDt")?.textContent,
          pSlngMthdCd: item.querySelector("slngMthdCdNm")?.textContent,
          pBsStCd: item.querySelector("operSttusCdNm")?.textContent,
        })));
        return;
      }
      const body = data?.response?.body;
      setFtcTotal(body?.totalCount||0);
      const items = body?.items?.item;
      if (!items) { setFtcError("조회 결과가 없습니다. 기간이나 지역을 조정해보세요."); return; }
      setFtcResults(Array.isArray(items)?items:[items]);
    } catch(e) { setFtcError("오류: "+e.message); }
    finally { setFtcLoading(false); }
  };

  const toggleSource = (src) => setSelectedSources(prev => prev.includes(src)?prev.filter(s=>s!==src):[...prev,src]);

  const claudeSearch = async () => {
    setClaudeLoading(true); setClaudeError(""); setBrands([]); setSummary(""); setClaudeSearched(true);
    const userPrompt = `다음 조건으로 팝업 스토어 제안에 적합한 한국 F&B 브랜드를 리서치해주세요:\n${keyword.trim()?`키워드: "${keyword}"`:"키워드: 없음"}\n카테고리: ${category}\n확인할 소스: ${selectedSources.join(", ")}\n실제 존재하는 브랜드 위주로 분석해주세요.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json","x-api-key":CLAUDE_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-calls":"true" },
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:2000, tools:[{type:"web_search_20250305",name:"web_search"}], system:CLAUDE_SYSTEM, messages:[{role:"user",content:userPrompt}] }),
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
        <div style={{ maxWidth:960, margin:"0 auto" }}>
          <div style={{ fontSize:10, letterSpacing:4, color:"#444", fontFamily:"monospace", textTransform:"uppercase", marginBottom:6 }}>Benjamin Universe · Brand Scout</div>
          <h1 style={{ fontSize:20, fontWeight:400, margin:"0 0 20px", letterSpacing:-0.3 }}>팝업 제안 브랜드 탐색기</h1>
          <div style={{ display:"flex" }}>
            {[["ftc","📋  통신판매업 신규조회"],["claude","🔍  브랜드 서치"]].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} style={{ padding:"10px 20px", border:"none", cursor:"pointer", transition:"all 0.15s", borderBottom:tab===k?"2px solid #F5F0E8":"2px solid transparent", background:"transparent", color:tab===k?"#F5F0E8":"#555", fontSize:13, fontFamily:"monospace" }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ maxWidth:960, margin:"0 auto", padding:"32px 24px 80px" }}>
        {tab==="ftc"&&(
          <div>
            <p style={{ color:"#555", fontSize:13, fontFamily:"monospace", marginBottom:24, lineHeight:1.7 }}>공정거래위원회 공식 DB에서 신규 통신판매업 신고 업체를 조회합니다.</p>
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
                <div style={{ fontSize:12, fontFamily:"monospace", color:"#555", marginBottom:14 }}>총 <span style={{ color:"#CCC" }}>{ftcTotal.toLocaleString()}</span>건 중 {ftcResults.length}건 표시<span style={{ color:"#333", marginLeft:10 }}>· 업체명 클릭 → 상세정보</span></div>
                <div style={{ display:"grid", gridTemplateColumns:selectedBiz?"1fr 280px":"1fr", gap:12 }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {ftcResults.map((item,i)=>{
                      const name=item.pBizNm||item.bzmnNm||"상호명 없음";
                      const bizNo=item.pBizNo||item.brno;
                      const rd=item.pRgstDe||"";
                      const date=rd.length===8?`${rd.slice(0,4)}.${rd.slice(4,6)}.${rd.slice(6)}`:rd;
                      return (
                        <div key={i} onClick={()=>setSelectedBiz(item)} style={{ background:"#111", border:"1px solid #1E1E1E", borderRadius:5, padding:"13px 16px", cursor:"pointer", transition:"border-color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.borderColor="#333"} onMouseLeave={e=>e.currentTarget.style.borderColor="#1E1E1E"}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <div>
                              <div style={{ fontSize:15, color:"#F5F0E8", marginBottom:3 }}>{name}</div>
                              <div style={{ fontSize:11, fontFamily:"monospace", color:"#555" }}>{[item.pSidoNm,item.pSggNm].filter(Boolean).join(" ")}{bizNo&&<span style={{ marginLeft:10 }}>사업자: {bizNo}</span>}</div>
                            </div>
                            <div style={{ fontSize:11, fontFamily:"monospace", color:"#444", whiteSpace:"nowrap", marginLeft:12 }}>{date}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedBiz&&(
                    <div style={{ background:"#111", border:"1px solid #2A2A2A", borderRadius:6, padding:"18px", height:"fit-content", position:"sticky", top:120 }}>
                      <div style={{ fontSize:15, color:"#F5F0E8", marginBottom:14, paddingBottom:12, borderBottom:"1px solid #1A1A1A" }}>{selectedBiz.pBizNm||selectedBiz.bzmnNm}</div>
                      {[["통신판매업번호",selectedBiz.pMllBsNo],["사업자등록번호",selectedBiz.pBizNo||selectedBiz.brno],["대표자명",selectedBiz.pRprsntvNm],["사업장주소",selectedBiz.pBplcAddr],["신고일",selectedBiz.pRgstDe],["운영상태",selectedBiz.pBsStCd||selectedBiz.operSttus],["판매방식",selectedBiz.pSlngMthdCd],["취급품목",selectedBiz.pHndlItm]].filter(([,v])=>v).map(([label,val])=>(
                        <div key={label} style={{ marginBottom:10 }}>
                          <div style={{ fontSize:10, color:"#444", fontFamily:"monospace", letterSpacing:1, textTransform:"uppercase", marginBottom:2 }}>{label}</div>
                          <div style={{ fontSize:13, color:"#BBB", lineHeight:1.5 }}>{val}</div>
                        </div>
                      ))}
                      <button onClick={()=>setSelectedBiz(null)} style={{ marginTop:8, padding:"5px 12px", background:"transparent", border:"1px solid #2A2A2A", borderRadius:3, color:"#555", fontSize:11, fontFamily:"monospace", cursor:"pointer" }}>닫기</button>
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
