/* LOTTO LAB — no dependencies. Historical records are descriptive, not predictive. */
(() => {
  'use strict';
  const STORAGE_KEY = 'lotto-lab.draws.v1';
  const META_KEY = 'lotto-lab.metadata.v1';
  const TRY_KEY = 'lotto-lab.lastAttempt.v1';
  const PICKS_KEY = 'lotto-lab.personal.v1';
  const PICK_LIMIT = 60;
  const ALL_COMBINATIONS = 8145060;
  const SEED = [
    {no:1246,date:'2026-10-17',nums:[16,22,23,24,27,28],bonus:6,winners:16,prize:1881025430},
    {no:1245,date:'2026-10-10',nums:[4,5,25,28,32,42],bonus:12,winners:10,prize:3006515775},
    {no:1244,date:'2026-10-03',nums:[1,13,18,26,34,38],bonus:25,winners:18,prize:1604686625},
    {no:1243,date:'2026-09-26',nums:[9,18,24,38,43,44],bonus:35,winners:12,prize:2592525282},
    {no:1242,date:'2026-09-19',nums:[2,4,10,16,31,41],bonus:9,winners:9,prize:3281029250}
  ];
  const SOURCES = [
    {name:'smok95 공개 미러',url:'https://smok95.github.io/lotto/results/all.json',kind:'json'},
    {name:'캐시로지 CSV',url:'https://cashlogy.kr/lotto/excel.csv',kind:'csv'}
  ];
  const state = {draws:SEED.slice(), source:'검증된 최근 5회 기본 데이터', isSeed:true, updated:'2026-10-18', range:'100', tab:'overview', selectedNumber:16, sort:'number', historyLimit:25, search:'', loading:false, selectedProbNumber:1, personalSelection:[], personalPicks:[]};
  const $ = id => document.getElementById(id);
  const fmt = n => Number(n).toLocaleString('ko-KR');
  const pct = n => `${(n*100).toFixed(1)}%`;
  const clean = s => String(s ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const ballClass = n => `ball-${Math.min(5,Math.ceil(n/10))}`;
  const ball = (n, cls='') => `<span class="lotto-ball ${ballClass(n)} ${cls}" aria-label="번호 ${n}">${n}</span>`;
  const balls = nums => `<div class="ball-row">${nums.map(n=>ball(n)).join('')}</div>`;
  const dateLabel = date => date ? date.replaceAll('-','.') : '추첨일 미확인';
  const year = n => n < 0 ? '—' : fmt(n);
  const safeStorage = {
    get(k){try{return localStorage.getItem(k)}catch(_){return null}},
    set(k,v){try{localStorage.setItem(k,v);return true}catch(_){return false}}
  };
  function normalize(item) {
    const no = Number(item.no ?? item.draw_no ?? item.drwNo);
    const rawNums = item.nums ?? item.numbers ?? [item.n1,item.n2,item.n3,item.n4,item.n5,item.n6];
    if (!Array.isArray(rawNums)) throw Error('당첨번호 배열이 없습니다.');
    const nums = rawNums.map(Number).sort((a,b)=>a-b);
    const bonus = Number(item.bonus ?? item.bonus_no ?? item.bnusNo);
    const date = String(item.date ?? item.drwNoDate ?? '').slice(0,10);
    if (!Number.isSafeInteger(no)||no<1||nums.length!==6||nums.some(n=>!Number.isInteger(n)||n<1||n>45)||new Set(nums).size!==6||!Number.isInteger(bonus)||bonus<1||bonus>45||nums.includes(bonus)) {
      throw Error(`회차 ${no||'?'}: 번호 또는 보너스가 올바르지 않습니다.`);
    }
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))) throw Error(`${no}회 날짜가 올바르지 않습니다.`);
    const division = Array.isArray(item.divisions) ? item.divisions[0] : undefined;
    const prizeRaw = item.prize ?? item.firstWinamnt ?? division?.prize;
    const winnersRaw = item.winners ?? item.firstPrzwnerCo ?? division?.winners;
    const prize = prizeRaw === '' || prizeRaw == null ? null : Number(String(prizeRaw).replace(/[^0-9]/g,''));
    const winners = winnersRaw === '' || winnersRaw == null ? null : Number(String(winnersRaw).replace(/[^0-9]/g,''));
    return {no,date,nums,bonus,prize:Number.isFinite(prize)?prize:null,winners:Number.isFinite(winners)?winners:null};
  }
  function validate(items, complete=false) {
    if (!Array.isArray(items)||!items.length) throw Error('회차 데이터가 비어 있습니다.');
    if (items.length>10000) throw Error('파일에 회차가 너무 많습니다.');
    const draws = items.map(normalize).sort((a,b)=>b.no-a.no);
    for(let i=1;i<draws.length;i++){
      if(draws[i-1].no-draws[i].no!==1) throw Error(`${draws[i-1].no}회와 ${draws[i].no}회 사이에 누락되거나 중복된 회차가 있습니다.`);
      if(draws[i-1].date && draws[i].date && draws[i-1].date<=draws[i].date) throw Error('추첨 날짜의 순서가 잘못되었습니다.');
    }
    if(complete && draws.at(-1).no !== 1) throw Error('1회부터 시작하는 전체 이력 데이터가 아닙니다.');
    return draws;
  }
  function parseCSV(text){
    const rows=[];let row=[],field='',quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(ch==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else{quoted=!quoted}}
      else if(ch===','&&!quoted){row.push(field.trim());field=''}
      else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field.trim());if(row.some(v=>v!==''))rows.push(row);row=[];field=''}
      else field+=ch;
    }
    if(quoted)throw Error('CSV 따옴표가 닫히지 않았습니다.');
    row.push(field.trim());if(row.some(v=>v!==''))rows.push(row);
    if(rows.length<2)throw Error('CSV에 데이터가 없습니다.');
    const names=rows[0].map(h=>h.replace(/^\ufeff/,'').trim().toLowerCase());
    const find=(...alternates)=>names.findIndex(name=>alternates.includes(name));
    const noIdx=find('drwno','draw_no','no','회차'),dateIdx=find('drwnodate','date','추첨일','날짜');
    const bonusIdx=find('bonus','bonus_no','보너스','보너스번호');
    const winIdx=find('firstprzwnerco','winners','당첨게임수');
    const prizeIdx=find('firstwinamnt','prize','당첨금액','1게임당 당첨금액');
    let numIdx=[1,2,3,4,5,6].map(n=>find(`n${n}`,`번호${n}`,`번호 ${n}`));
    const hasHeader = noIdx>=0 && (bonusIdx>=0||numIdx.every(i=>i>=0));
    if(!hasHeader){
      // Positional convention: 회차,추첨일?,번호1..6,보너스[, ...]
      const first=rows[0];
      if(/^\d+$/.test(first[0])&&first.length>=8){
        return rows.map(r=>normalize({no:r[0],date:/^\d{4}-/.test(r[1])?r[1]:'',nums:r.slice(/^\d{4}-/.test(r[1])?2:1,( /^\d{4}-/.test(r[1])?2:1)+6),bonus:r[/^\d{4}-/.test(r[1])?8:7]}));
      }
      throw Error('CSV 열 이름을 인식하지 못했습니다. 필요한 열: drwNo, drwNoDate, n1~n6, bonus');
    }
    if(numIdx.some(i=>i<0)){
      // Compatibility with 11-column Korean table: no, date, n1 ... n6, bonus
      const start=dateIdx>=0?dateIdx+1:noIdx+1;
      numIdx=[0,1,2,3,4,5].map(i=>start+i);
    }
    return rows.slice(1).filter(r=>r[noIdx]).map(r=>normalize({no:r[noIdx],date:dateIdx<0?'':r[dateIdx],nums:numIdx.map(i=>r[i]),bonus:r[bonusIdx<0?numIdx[5]+1:bonusIdx],winners:winIdx<0?null:r[winIdx],prize:prizeIdx<0?null:r[prizeIdx]}));
  }
  function loadStored(){
    const str=safeStorage.get(STORAGE_KEY);
    if(!str)return;
    try{
      const list=validate(JSON.parse(str));
      if(list[0].no<SEED[0].no)return;
      state.draws=list;state.isSeed=list.length===5&&list.at(-1).no===1242;
      const info=JSON.parse(safeStorage.get(META_KEY)||'{}');
      state.source=info.source||'이전에 저장한 데이터';state.updated=info.updated||'';
    }catch(err){console.warn('저장된 데이터가 올바르지 않습니다:',err.message)}
  }
  function saveData(draws,source){
    state.draws=draws;state.isSeed=draws.length===5&&draws[0].no===1246;
    state.source=source;state.updated=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Seoul'}).slice(0,16);
    const saved=safeStorage.set(STORAGE_KEY,JSON.stringify(draws));
    safeStorage.set(META_KEY,JSON.stringify({source,updated:state.updated}));
    return saved;
  }
  // Theoretical distributions enumerate equally likely six-number sets, not individual permutations.
  function choose(n,k) {
    if(k<0||k>n)return 0;
    k=Math.min(k,n-k);let result=1;
    for(let i=1;i<=k;i++)result=result*(n-k+i)/i;
    return Math.round(result);
  }
  const THEORETICAL_ODDS = Array.from({length:7},(_,odd)=>choose(23,odd)*choose(22,6-odd)/ALL_COMBINATIONS);
  function sumDistribution() {
    const dp=Array.from({length:7},()=>new Float64Array(256));
    dp[0][0]=1;
    for(let number=1;number<=45;number++){
      for(let picked=Math.min(number,6);picked>=1;picked--){
        for(let sum=255;sum>=number;sum--)dp[picked][sum]+=dp[picked-1][sum-number];
      }
    }
    return dp[6];
  }
  const SUM_COMBINATIONS = sumDistribution();
  const SUM_BUCKETS = [
    {name:'90 이하',low:21,high:90},
    {name:'91~120',low:91,high:120},
    {name:'121~150',low:121,high:150},
    {name:'151~180',low:151,high:180},
    {name:'181~210',low:181,high:210},
    {name:'211 이상',low:211,high:255}
  ];
  const THEORETICAL_SUMS = SUM_BUCKETS.map(b=>{
    let count=0;for(let sum=b.low;sum<=b.high;sum++)count+=SUM_COMBINATIONS[sum];
    return count/ALL_COMBINATIONS;
  });
  const numberSum = nums => nums.reduce((a,b)=>a+b,0);
  function sumBucketIndex(sum){return SUM_BUCKETS.findIndex(b=>sum>=b.low&&sum<=b.high)}
  function compareDistributions(labels,observed,theoretical,drawCount) {
    const max=Math.max(1,...observed,...theoretical.map(x=>x*drawCount));
    return `<div class="compare-legend"><span><i class="compare-key real"></i>실제</span><span><i class="compare-key expected"></i>이론적 기대</span></div><div class="compare-list">${labels.map((label,i)=>{
      const expectation=theoretical[i]*drawCount;
      return `<div class="compare-row"><div class="compare-row-label">${clean(label)}</div><div class="compare-bars"><div class="compare-track"><i class="real" style="width:${(observed[i]/max*100).toFixed(2)}%"></i></div><div class="compare-track"><i class="expected" style="width:${(expectation/max*100).toFixed(2)}%"></i></div></div><div class="compare-values"><strong>${fmt(observed[i])}</strong><small>${expectation.toFixed(1)}</small></div></div>`;
    }).join('')}</div>`;
  }
  function renderProbability(){
    const ds=selectedDraws(),n=ds.length,counts=countNumbers(ds);
    const expectation=n*6/45,sd=Math.sqrt(n*(6/45)*(39/45)),low=Math.max(0,expectation-1.96*sd),high=Math.min(n,expectation+1.96*sd);
    const outside=counts.slice(1).filter(count=>count<low||count>high).length;
    $('probSummary').innerHTML=`<div class="prob-stat"><span>번호 하나의 기대 출현</span><strong>${expectation.toFixed(1)}회</strong></div><div class="prob-stat"><span>약 95% 예상 구간</span><strong>${low.toFixed(1)}~${high.toFixed(1)}회</strong></div><div class="prob-stat"><span>구간 밖에 있는 번호</span><strong>${outside}개 / 45개</strong></div>`;
    $('probNumberGrid').innerHTML=Array.from({length:45},(_,i)=>{
      const number=i+1,actual=counts[number],delta=actual-expectation;
      return `<button class="prob-cell ${number===state.selectedProbNumber?'active':''}" type="button" data-prob-number="${number}" aria-pressed="${number===state.selectedProbNumber}" aria-label="${number}번 실제 ${actual}회, 기대 ${expectation.toFixed(1)}회"><span>${number}</span><strong>${actual}회</strong><small class="${delta>0?'above':'below'}">${delta>0?'+':''}${delta.toFixed(1)}</small></button>`;
    }).join('');
    const selected=state.selectedProbNumber,actual=counts[selected],difference=actual-expectation,z=sd?difference/sd:0;
    $('probNumberDetail').innerHTML=`<div>${ball(selected)}<div><strong>${selected}번: 실제 ${fmt(actual)}회</strong><span>기대 ${expectation.toFixed(1)}회 · 기대 대비 ${difference>0?'+':''}${difference.toFixed(1)}회 · 표준편차 기준 ${z>0?'+':''}${z.toFixed(2)}</span></div></div><p>${n<30?'회차가 적어 예상 구간의 근사가 불안정할 수 있습니다. ':'표준편차 차이는 관측된 기록의 흔들림을 보여주는 지표일 뿐입니다. '}과거 기록만으로 다음 회차의 공이 더 잘 뽑힌다고 판단할 수 없습니다.</p>`;
    const oddObserved=Array(7).fill(0),sumObserved=Array(SUM_BUCKETS.length).fill(0);
    ds.forEach(draw=>{
      oddObserved[draw.nums.filter(number=>number%2===1).length]++;
      sumObserved[sumBucketIndex(numberSum(draw.nums))]++;
    });
    $('probOddEven').innerHTML=compareDistributions(Array.from({length:7},(_,i)=>`홀 ${i} : 짝 ${6-i}`),oddObserved,THEORETICAL_ODDS,n);
    $('probSums').innerHTML=compareDistributions(SUM_BUCKETS.map(b=>b.name),sumObserved,THEORETICAL_SUMS,n);
  }
  function selectedDraws(){const n=state.range==='all'?state.draws.length:Number(state.range);return state.draws.slice(0,n)}
  function countNumbers(list){const arr=Array(46).fill(0);list.forEach(d=>d.nums.forEach(n=>arr[n]++));return arr}
  function gapFor(n){const pos=state.draws.findIndex(d=>d.nums.includes(n));return pos<0?null:pos}
  function periodLabel(ds){if(!ds.length)return '조회된 기록 없음';return `${fmt(ds.length)}회 · ${fmt(ds.at(-1).no)} ~ ${fmt(ds[0].no)}회`}
  function metricHTML(label,value,hint,accent=false){return `<div class="metric"><span class="small-label">${clean(label)}</span><strong class="${accent?'accent':''}">${value}</strong><small>${clean(hint)}</small></div>`}
  function rangeMessage(){const ds=selectedDraws();$('rangeText').textContent=periodLabel(ds)+(state.isSeed?' (기본 5회)':'')}
  function renderHeader(){
    const latest=state.draws[0];const isFull=state.draws.at(-1).no===1;
    const status=$('statusPill');status.classList.toggle('online',isFull);status.innerHTML=`<span class="status-dot"></span>${isFull?'전체 기록 '+fmt(state.draws.length)+'회':'일부 기록 '+fmt(state.draws.length)+'회'}`;
    $('dataStateBadge').textContent=isFull?'전체 기록':'일부 기록';
    $('rangeText').textContent=periodLabel(selectedDraws())+(state.isSeed?' (기본 5회)':'');
    $('overviewUpdated').textContent=latest.date?`최근 추첨 ${dateLabel(latest.date)}`:'';
    $('latestBadge').textContent=`제 ${fmt(latest.no)}회`;
    for(const btn of document.querySelectorAll('.range-btn')){const active=btn.dataset.range===state.range;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))}
    $('periodBar').hidden=state.tab==='history'||state.tab==='personal'||state.tab==='data';
  }
  function heatShade(v,min,max){return max<=min?'shade2':`shade${Math.min(4,Math.floor((v-min)/(max-min)*4.99))}`}
  function renderOverview(){
    const ds=selectedDraws(),counts=countNumbers(ds),latest=state.draws[0];
    const avg=ds.length*6/45;
    $('metricGrid').innerHTML=metricHTML('분석한 회차',fmt(ds.length),'보너스 번호 제외',true)+metricHTML('최신 기록',`${fmt(latest.no)}회`,dateLabel(latest.date))+metricHTML('번호당 평균 출현',`${avg.toFixed(1)}회`,'선택 기간, 총 출현 ÷ 45')+metricHTML('6개 번호 평균 합계',`${(ds.reduce((s,d)=>s+d.nums.reduce((a,b)=>a+b,0),0)/ds.length).toFixed(1)}`,'선택 기간 산술 평균');
    const latestPr=latest.prize==null?'기록 없음':`${(latest.prize/1e8).toFixed(2)}억원`;
    $('latestDraw').innerHTML=`<div class="draw-meta">${dateLabel(latest.date)} 토요일 추첨</div>${balls(latest.nums)}<div class="ball-row" style="margin-top:15px"><span class="panel-caption" style="min-width:48px">보너스</span>${ball(latest.bonus,'ball-extra')}</div><div class="latest-stats"><div><span>1등 당첨금 (1게임당)</span><strong>${latestPr}</strong></div><div class="right"><span>1등 당첨 게임 수</span><strong>${latest.winners==null?'—':fmt(latest.winners)+'게임'}</strong></div></div>`;
    const sorted=Array.from({length:45},(_,i)=>i+1).sort((a,b)=>counts[b]-counts[a]||a-b);
    const cold=Array.from({length:45},(_,i)=>i+1).sort((a,b)=>counts[a]-counts[b]||a-b);
    const grp=(label,sub,arr)=>`<div class="insight-group"><div><span class="insight-caption">${label}</span>${balls(arr)}<span class="context">${clean(sub)}</span></div></div>`;
    $('quickInsight').innerHTML=grp('가장 많이 출현',`${sorted.slice(0,5).map(n=>counts[n]+'회').join(' · ')} (각 번호 순서)`,sorted.slice(0,5))+grp('가장 적게 출현',`${cold.slice(0,5).map(n=>counts[n]+'회').join(' · ')} (각 번호 순서)`,cold.slice(0,5));
    const values=counts.slice(1),min=Math.min(...values),max=Math.max(...values);
    $('overviewHeatmap').innerHTML=Array.from({length:45},(_,i)=>{const n=i+1;return `<button type="button" data-number="${n}" class="heat-cell ${heatShade(counts[n],min,max)}" title="${n}번: ${counts[n]}회 출현" aria-label="${n}번 ${counts[n]}회 출현, 상세 보기">${n}</button>`}).join('');
  }
  function renderNumbers(){
    const ds=selectedDraws(),counts=countNumbers(ds),max=Math.max(...counts.slice(1),1),expect=(ds.length*6/45).toFixed(1);
    const sorter={number:(a,b)=>a-b,high:(a,b)=>counts[b]-counts[a]||a-b,low:(a,b)=>counts[a]-counts[b]||a-b,gap:(a,b)=>(gapFor(b)??Infinity)-(gapFor(a)??Infinity)||a-b};
    const nums=Array.from({length:45},(_,i)=>i+1).sort(sorter[state.sort]);
    $('sortSelect').value=state.sort;
    $('numberTable').innerHTML=nums.map(n=>`<button type="button" class="num-item ${n===state.selectedNumber?'selected':''}" data-pick="${n}" aria-pressed="${n===state.selectedNumber}">${ball(n)}<span class="num-label"><strong>${counts[n]}회</strong><small>${pct(counts[n]/ds.length)} 출현</small></span><span class="microbar"><i style="width:${counts[n]/max*100}%"></i></span></button>`).join('');
    const n=state.selectedNumber,lastGap=gapFor(n),hit=ds.filter(d=>d.nums.includes(n));
    const latestHit=state.draws.find(d=>d.nums.includes(n));
    const recent=state.draws.slice(0,16);
    $('numberDetail').innerHTML=`<div class="detail-header">${ball(n,'big-ball')}<div class="detail-stats"><div class="detail-stat"><strong>${counts[n]}회</strong><span>선택 기간 출현</span></div><div class="detail-stat"><strong>${pct(counts[n]/ds.length)}</strong><span>선택 기간 비율</span></div><div class="detail-stat"><strong>${lastGap==null?'미기록':lastGap===0?'최근':lastGap+'회'}</strong><span>최근 출현 후 간격</span></div></div></div><div class="detail-recent"><span>이 번호가 마지막으로 나온 회차: <strong>${latestHit?fmt(latestHit.no)+'회':'확인 불가'}</strong> · 기대 출현 횟수 ${expect}회 (단순 평균)</span><div class="recent-strip" aria-label="최근 16회 출현 표시">${recent.map(d=>`<span class="recent-mark ${d.nums.includes(n)?'hit':''}" title="${d.no}회 ${d.nums.includes(n)?'출현':'미출현'}">${d.no}</span>`).join('')}</div></div>`;
  }
  function barChart(items,tot,{summary='',raw=false}={}){
    if(!items.length)return '<div class="empty-state">계산 가능한 기록이 없습니다.</div>';
    const denom=tot||1,max=Math.max(1,...items.map(item=>item.value));
    return `<div class="chart-list">${items.map(item=>`<div class="chart-line"><span class="chart-label">${clean(item.name)}</span><span class="chart-track"><i style="width:${Math.max(0,item.value)/max*100}%"></i></span><span class="chart-value">${fmt(item.value)}<small>${raw?'':`·${(item.value/denom*100).toFixed(0)}%`}</small></span></div>`).join('')}</div>${summary?`<div class="chart-summary">${clean(summary)}</div>`:''}`;
  }
  function renderPatterns(){
    const ds=selectedDraws(),len=ds.length;
    const odd=Array(7).fill(0),low=Array(7).fill(0),consec=Array(6).fill(0),zone=Array(5).fill(0),sumBins=Array(6).fill(0),repeat=Array(7).fill(0);
    const pairCounts=new Map();let repeatsCompared=0,totSum=0;
    const lookup=new Map(state.draws.map(d=>[d.no,d]));
    for(const d of ds){
      const nums=d.nums,oc=nums.filter(x=>x%2===1).length,lc=nums.filter(x=>x<=22).length,sum=nums.reduce((a,b)=>a+b,0);
      odd[oc]++;low[lc]++;totSum+=sum;
      let cc=0;for(let i=1;i<6;i++)if(nums[i]===nums[i-1]+1)cc++;
      consec[cc]++;nums.forEach(n=>zone[Math.min(4,Math.floor((n-1)/10))]++);
      const bi=sum<=90?0:sum<=120?1:sum<=150?2:sum<=180?3:sum<=210?4:5;sumBins[bi]++;
      const previous=lookup.get(d.no-1);
      if(previous){repeat[nums.filter(n=>previous.nums.includes(n)).length]++;repeatsCompared++}
      for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){
        const key=`${nums[i]}-${nums[j]}`;pairCounts.set(key,(pairCounts.get(key)||0)+1);
      }
    }
    $('oddEvenChart').innerHTML=barChart(Array.from({length:7},(_,i)=>({name:`홀 ${i} : 짝 ${6-i}`,value:odd[i]})),len,{summary:`가장 많은 형태: 홀 ${odd.indexOf(Math.max(...odd))} : 짝 ${6-odd.indexOf(Math.max(...odd))}`});
    $('lowHighChart').innerHTML=barChart(Array.from({length:7},(_,i)=>({name:`저 ${i} : 고 ${6-i}`,value:low[i]})),len);
    $('sumChart').innerHTML=barChart(['≤ 90','91 ~ 120','121 ~ 150','151 ~ 180','181 ~ 210','211 이상'].map((name,i)=>({name,value:sumBins[i]})),len,{summary:`평균 합계: ${(totSum/len).toFixed(1)}`});
    $('consecutiveChart').innerHTML=barChart(Array.from({length:6},(_,i)=>({name:i===0?'연속 없음':`${i}쌍 연속`,value:consec[i]})),len,{summary:`연속되는 번호가 한 쌍 이상: ${consec.slice(1).reduce((a,b)=>a+b,0)}회`});
    $('zoneChart').innerHTML=barChart(['1 ~ 10','11 ~ 20','21 ~ 30','31 ~ 40','41 ~ 45'].map((name,i)=>({name,value:zone[i]})),6*len,{summary:'번호 개수의 비중 (전체 출현 6개 × 분석 회차)'});
    $('repeatChart').innerHTML=repeatsCompared?barChart(Array.from({length:7},(_,i)=>({name:`${i}개 일치`,value:repeat[i]})),repeatsCompared,{summary:`비교 가능한 ${fmt(repeatsCompared)}개 회차 기준`}):'<div class="empty-state">이전 회차와 비교할 데이터가 없습니다.</div>';
    const pairs=[...pairCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,8);
    $('pairChart').innerHTML=pairs.map(([key,count])=>`<div class="pair-item">${balls(key.split('-').map(Number))}<div class="pair-info">${fmt(count)}회<span>${pct(count/len)} 동반</span></div></div>`).join('');
  }
  function searchedDraws(){
    const q=state.search.trim().toLowerCase();if(!q)return state.draws;
    const tokens=q.replaceAll(',',' ').split(/\s+/).filter(Boolean);
    return state.draws.filter(d=>{
      if(tokens.length===1){const t=tokens[0];if(d.no.toString().includes(t)||d.date.includes(t))return true}
      return tokens.every(t=>{const n=Number(t);return Number.isInteger(n)&&n>=1&&n<=45&&d.nums.includes(n)});
    });
  }
  function renderHistory(){
    const records=searchedDraws(),visible=records.slice(0,state.historyLimit);
    $('historyList').innerHTML=visible.length?visible.map(d=>`<div class="history-card"><div><div class="history-heading"><strong>제 ${fmt(d.no)}회</strong><span>${dateLabel(d.date)}</span></div>${balls(d.nums)}</div><div class="history-side"><strong>+ 보너스 ${d.bonus}</strong><span>${d.winners!=null?'1등 '+fmt(d.winners)+'게임':'결과 기록'}</span></div></div>`).join(''):'<div class="empty-state">검색 조건에 맞는 회차가 없습니다.</div>';
    $('historyCount').textContent=`${fmt(records.length)}개 중 ${fmt(visible.length)}개 표시`;
    $('loadMore').hidden=visible.length>=records.length;
  }
  function normalizePick(value){
    if(!value||typeof value!=='object')throw Error('조합 형식이 올바르지 않습니다.');
    const nums=value.nums;
    if(!Array.isArray(nums)||nums.length!==6||nums.some(n=>!Number.isInteger(n)||n<1||n>45)||new Set(nums).size!==6){
      throw Error('각 조합에는 서로 다른 1~45번 숫자 6개가 있어야 합니다.');
    }
    if(typeof value.name!=='string'||value.name.length>40||typeof (value.memo??'')!=='string'||(value.memo??'').length>160){
      throw Error('조합 이름이나 메모가 너무 깁니다.');
    }
    const date=typeof value.savedAt==='string' && /^\d{4}-\d{2}-\d{2}/.test(value.savedAt)?value.savedAt.slice(0,10):'';
    const id=(typeof value.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value.id))?value.id:`pick-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    return {id,nums:[...nums].sort((a,b)=>a-b),name:value.name.trim()||'나만의 조합',memo:(value.memo||'').trim(),savedAt:date};
  }
  function loadPersonalPicks(){
    try{
      const raw=safeStorage.get(PICKS_KEY);
      if(!raw)return;
      const parsed=JSON.parse(raw);
      if(!Array.isArray(parsed)||parsed.length>PICK_LIMIT)throw Error('저장된 조합 형식이 올바르지 않습니다.');
      state.personalPicks=parsed.map(normalizePick);
    }catch(err){console.warn('내 번호 로드 실패:',err.message);state.personalPicks=[]}
  }
  function persistPicks(){return safeStorage.set(PICKS_KEY,JSON.stringify(state.personalPicks))}
  function renderPersonalPicker(){
    const picked=state.personalSelection;
    $('personalCount').textContent=`${picked.length} / 6`;
    $('personalSelected').innerHTML=picked.length?balls([...picked].sort((a,b)=>a-b)):'<span class="personal-placeholder">1부터 45까지, 마음이 이끄는 숫자 6개를 골라보세요.</span>';
    $('personalNumberGrid').innerHTML=Array.from({length:45},(_,i)=>{
      const n=i+1,active=picked.includes(n);
      return `<button class="personal-cell ${active?'active':''}" type="button" data-lucky-number="${n}" aria-label="${n}번 ${active?'선택됨':'선택'}" aria-pressed="${active}">${n}</button>`;
    }).join('');
    $('personalSave').disabled=picked.length!==6||state.personalPicks.length>=PICK_LIMIT;
  }
  function renderPersonalSaved(){
    $('personalTotal').textContent=`${state.personalPicks.length}개`;
    $('personalSaved').innerHTML=state.personalPicks.length?state.personalPicks.map((pick,index)=>`<div class="personal-card"><div class="personal-card-head"><div><strong>${clean(pick.name)}</strong><span>${clean(pick.savedAt||'날짜 미확인')}</span></div><button type="button" class="personal-remove" data-remove-index="${index}" aria-label="${clean(pick.name)} 조합 삭제">삭제</button></div>${balls(pick.nums)}${pick.memo?`<p class="personal-story">${clean(pick.memo)}</p>`:''}<div class="personal-card-actions"><button class="secondary-btn" type="button" data-copy-index="${index}">번호 복사</button><button class="secondary-btn" type="button" data-compare-index="${index}">과거 회차와 비교</button></div></div>`).join(''):'<div class="empty-state">아직 저장한 조합이 없습니다.<br>내게 의미 있는 숫자 6개부터 골라볼까요?</div>';
    $('personalExport').disabled=!state.personalPicks.length;
    $('personalSave').disabled=state.personalSelection.length!==6||state.personalPicks.length>=PICK_LIMIT;
  }
  function renderPersonal(){renderPersonalPicker();renderPersonalSaved()}
  function comparePersonalPick(pick){
    const matched=Array(7).fill(0),same=[];
    for(const d of state.draws){
      const count=pick.nums.filter(n=>d.nums.includes(n)).length;
      matched[count]++;
      if(count>=4&&same.length<8)same.push(`${d.no}회 (${count}개 일치)`);
    }
    const lines=matched.map((value,i)=>`<li>${i}개 일치: <strong>${fmt(value)}회</strong></li>`).join('');
    modal('내 조합의 과거 출현 비교',`<p><strong>${clean(pick.name)}</strong></p>${balls(pick.nums)}<p>저장된 <strong>${fmt(state.draws.length)}개</strong> 과거 회차의 일반 당첨번호 6개와 비교한 기록입니다.</p><ul>${lines}</ul><p>${same.length?`4개 이상 일치한 회차: ${clean(same.join(', '))}`:'확인된 자료에서는 4개 이상 일치한 회차가 없습니다.'}</p><p><small>과거에 몇 개가 일치했는지와 앞으로 당첨될 확률은 무관합니다.</small></p>`);
  }
  function downloadText(text,name,mime){
    const blob=new Blob([text],{type:mime}),link=document.createElement('a');
    const url=URL.createObjectURL(blob);
    link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function renderData(){
    const ds=state.draws,full=ds.at(-1).no===1;
    $('datasetSummary').innerHTML=`<div class="dataset-card"><span>저장 회차</span><strong>${fmt(ds.length)}개</strong></div><div class="dataset-card"><span>가장 오래된 회차</span><strong>${fmt(ds.at(-1).no)}회</strong></div><div class="dataset-card"><span>최근 회차</span><strong>${fmt(ds[0].no)}회</strong></div>`;
    $('dataFeedback').dataset.defaultMessage=`${full?'전체':'일부'} ${fmt(ds.length)}회 · ${state.source} · ${state.updated||'기본 포함'}`;
    if(!$('dataFeedback').dataset.manual){$('dataFeedback').textContent=$('dataFeedback').dataset.defaultMessage}
  }
  function render(){renderHeader();renderOverview();renderNumbers();renderProbability();renderPatterns();renderHistory();renderPersonal();renderData()}
  function notice(msg,error=false){const el=$('notice');el.textContent=msg;el.style.borderColor=error?'#aa6969':'#54738b';el.hidden=false;clearTimeout(notice.timer);notice.timer=setTimeout(()=>el.hidden=true,7000)}
  function feedback(msg,kind=''){const el=$('dataFeedback');el.textContent=msg;el.className=`callout ${kind}`;el.dataset.manual='1'}
  function setTab(name,updateHash=true){
    if(!['overview','numbers','patterns','history','personal','data'].includes(name))name='overview';
    state.tab=name;
    document.querySelectorAll('.view').forEach(el=>{const active=el.id===`view-${name}`;el.hidden=!active;el.classList.toggle('active',active)});
    document.querySelectorAll('[data-tab]').forEach(el=>{const active=el.dataset.tab===name;el.classList.toggle('active',active);if(el.matches('.mobile-tab')){if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')}else el.setAttribute('aria-selected',String(active))});
    $('periodBar').hidden=name==='history'||name==='personal'||name==='data';
    if(updateHash && location.hash!==`#${name}`)history.replaceState(null,'',`#${name}`);
    window.scrollTo({top:0,behavior:'instant'});
  }
  function modal(title,html){$('modalTitle').textContent=title;$('modalBody').innerHTML=html;if(typeof $('modal').showModal==='function')$('modal').showModal();else alert(`${title}\n${$('modalBody').textContent}`)}
  function initEvents(){
    document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.tab)));
    window.addEventListener('hashchange',()=>setTab(location.hash.slice(1),false));
    document.querySelectorAll('.range-btn').forEach(btn=>btn.addEventListener('click',()=>{state.range=btn.dataset.range;render()}));
    document.querySelectorAll('[data-goto]').forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.goto)));
    $('overviewHeatmap').addEventListener('click',event=>{const btn=event.target.closest('[data-number]');if(!btn)return;state.selectedNumber=Number(btn.dataset.number);setTab('numbers');renderNumbers()});
    $('numberTable').addEventListener('click',event=>{const btn=event.target.closest('[data-pick]');if(!btn)return;state.selectedNumber=Number(btn.dataset.pick);renderNumbers()});
    $('sortSelect').addEventListener('change',event=>{state.sort=event.target.value;renderNumbers()});
    $('historySearch').addEventListener('input',event=>{state.search=event.target.value;state.historyLimit=25;renderHistory()});
    $('clearSearch').addEventListener('click',()=>{state.search='';$('historySearch').value='';state.historyLimit=25;renderHistory()});
    $('loadMore').addEventListener('click',()=>{state.historyLimit+=25;renderHistory()});
    $('probNumberGrid').addEventListener('click',event=>{
      const button=event.target.closest('[data-prob-number]');if(!button)return;
      state.selectedProbNumber=Number(button.dataset.probNumber);renderProbability();
    });
    $('personalNumberGrid').addEventListener('click',event=>{
      const button=event.target.closest('[data-lucky-number]');if(!button)return;
      const n=Number(button.dataset.luckyNumber),index=state.personalSelection.indexOf(n);
      if(index>=0)state.personalSelection.splice(index,1);
      else if(state.personalSelection.length<6)state.personalSelection.push(n);
      else {notice('번호는 6개까지만 고를 수 있습니다. 선택한 번호를 해제해 주세요.',true);return}
      renderPersonalPicker();
    });
    $('personalClear').addEventListener('click',()=>{state.personalSelection=[];renderPersonalPicker()});
    $('personalSave').addEventListener('click',()=>{
      if(state.personalSelection.length!==6){notice('서로 다른 숫자 6개를 골라주세요.',true);return}
      if(state.personalPicks.length>=PICK_LIMIT){notice('저장 공간은 최대 60개 조합입니다. 기존 조합을 정리하거나 백업해 주세요.',true);return}
      const name=$('personalName').value.trim().slice(0,40)||'나만의 행운 번호';
      const memo=$('personalMemo').value.trim().slice(0,160);
      const pick=normalizePick({nums:[...state.personalSelection],name,memo,savedAt:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})});
      state.personalPicks.unshift(pick);
      const stored=persistPicks();
      state.personalSelection=[];$('personalName').value='';$('personalMemo').value='';renderPersonal();
      notice(stored?'나만의 번호 6개를 저장했습니다.':'번호를 임시로 보관했지만 브라우저 저장이 실패했습니다. JSON 백업을 내려받으세요.',!stored);
    });
    $('personalSaved').addEventListener('click',event=>{
      const del=event.target.closest('[data-remove-index]');
      if(del){
        const index=Number(del.dataset.removeIndex),pick=state.personalPicks[index];if(!pick)return;
        if(!confirm(`「${pick.name}」 조합을 삭제할까요?`))return;
        state.personalPicks.splice(index,1);const stored=persistPicks();renderPersonal();notice(stored?'조합을 삭제했습니다.':'화면에서는 삭제됐지만 브라우저 저장은 실패했습니다.',!stored);return;
      }
      const copy=event.target.closest('[data-copy-index]');
      if(copy){const pick=state.personalPicks[Number(copy.dataset.copyIndex)];if(!pick)return;
        const text=`${pick.name}: ${pick.nums.join(', ')}`;
        if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>notice('번호를 복사했습니다.')).catch(()=>modal('번호 복사',`<p>${clean(text)}</p>`));
        else modal('번호 복사',`<p>${clean(text)}</p>`);
        return;
      }
      const compare=event.target.closest('[data-compare-index]');
      if(compare){const pick=state.personalPicks[Number(compare.dataset.compareIndex)];if(pick)comparePersonalPick(pick)}
    });
    $('personalExport').addEventListener('click',()=>{
      if(!state.personalPicks.length)return;
      downloadText(JSON.stringify({kind:'lotto-lab-personal-picks',version:1,exportedAt:new Date().toISOString(),items:state.personalPicks},null,2),`lotto-lab-my-numbers-${new Date().toLocaleDateString('sv-SE')}.json`,'application/json;charset=utf-8');
      notice('내 번호 백업 JSON 다운로드를 시작했습니다.');
    });
    $('personalImport').addEventListener('click',()=>$('personalImportFile').click());
    $('personalImportFile').addEventListener('change',async event=>{
      const file=event.target.files?.[0];if(!file)return;
      try{
        if(file.size>200000)throw Error('백업 파일은 200KB 이하만 지원합니다.');
        const payload=JSON.parse(await file.text());
        if(payload?.kind!=='lotto-lab-personal-picks'||payload.version!==1||!Array.isArray(payload.items)||payload.items.length>PICK_LIMIT)throw Error('LOTTO LAB 내 번호 백업 파일이 아닙니다.');
        const incoming=payload.items.map(normalizePick);
        const existing=new Set(state.personalPicks.map(p=>`${p.name}::${p.nums.join('-')}::${p.memo}`));
        const additional=incoming.filter(p=>!existing.has(`${p.name}::${p.nums.join('-')}::${p.memo}`));
        if(state.personalPicks.length+additional.length>PICK_LIMIT)throw Error('중복을 제외한 저장 한도(60개)를 초과했습니다.');
        state.personalPicks=[...additional,...state.personalPicks];
        const stored=persistPicks();renderPersonal();notice(stored?`${additional.length}개 조합을 가져왔습니다. 기존 조합은 유지했습니다.`:'조합은 적용했지만 브라우저 저장이 실패했습니다.',!stored);
      }catch(err){notice(`내 번호 불러오기 실패: ${err.message}`,true)}finally{event.target.value=''}
    });
    $('refreshBtn').addEventListener('click',()=>refresh(true));
    $('uploadBtn').addEventListener('click',()=>$('fileInput').click());
    $('fileInput').addEventListener('change',async event=>{
      const file=event.target.files?.[0];if(!file)return;
      try{
        if(file.size>4_000_000)throw Error('파일 크기는 4MB 이하만 지원합니다.');
        const data=await file.text();const parsed=file.name.toLowerCase().endsWith('.json')?JSON.parse(data):parseCSV(data);
        const valid=validate(parsed);
        if(valid[0].no<state.draws[0].no)throw Error('가져온 파일이 현재 저장된 기록보다 오래되었습니다. 기존 기록을 보호하기 위해 교체하지 않았습니다.');
        const persisted=saveData(valid,`직접 불러온 파일 (${file.name})`);render();feedback(`${fmt(valid.length)}개 회차를 검증하고 ${persisted?'저장했습니다.':'적용했습니다. 브라우저 저장은 실패했습니다.'}`,persisted?'success':'error');notice('당첨 이력 파일을 반영했습니다.');
      }catch(err){feedback(`가져오기 실패: ${err.message}`,'error');notice('파일 내용을 확인해 주세요.',true)}finally{event.target.value=''}
    });
    $('exportBtn').addEventListener('click',()=>{
      const headers=['drwNo','drwNoDate','n1','n2','n3','n4','n5','n6','bonus','firstPrzwnerCo','firstWinamnt'];
      const lines=[headers.join(','),...state.draws.map(d=>[d.no,d.date,...d.nums,d.bonus,d.winners??'',d.prize??''].join(','))];
      const blob=new Blob(['\ufeff',lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
      const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`lotto-lab-${state.draws[0].no}회까지.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
      notice('CSV 저장을 시작했습니다.');
    });
    $('installHelpBtn').addEventListener('click',showInstallHelp);
    $('installBtn').addEventListener('click',async()=>{
      if(window.installPrompt){const prompt=window.installPrompt;window.installPrompt=null;prompt.prompt();await prompt.userChoice;return}
      showInstallHelp();
    });
    $('modalClose').addEventListener('click',()=>$('modal').close());$('modalDone').addEventListener('click',()=>$('modal').close());
    $('modal').addEventListener('click',e=>{if(e.target===$('modal'))$('modal').close()});
    window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();window.installPrompt=event});
    window.addEventListener('appinstalled',()=>notice('홈 화면에 설치되었습니다.'));
  }
  function showInstallHelp(){modal('갤럭시 홈 화면에 설치',`<p>웹 주소가 <strong>https://</strong>로 시작해야 설치 기능을 쓸 수 있습니다.</p><ol><li><strong>Chrome</strong>: 우측 상단 ⋮ → <strong>홈 화면에 추가</strong> 또는 <strong>앱 설치</strong></li><li><strong>삼성 인터넷</strong>: 하단 메뉴 → <strong>현재 페이지 추가</strong> → <strong>홈 화면</strong> (버전에 따라 명칭이 다를 수 있어요)</li><li>설치 후 앱을 열고 <strong>데이터 → 인터넷에서 전체 기록 갱신</strong>을 눌러 전체 회차를 저장하세요.</li></ol><p>파일 관리자에서 index.html을 바로 여는 경우 화면 확인은 가능하지만 PWA 설치·오프라인 캐시는 작동하지 않습니다.</p>`)}
  async function requestSource(source){
    const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),12000);
    try{
      const response=await fetch(source.url,{signal:ctl.signal,cache:'no-store'});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const raw=source.kind==='json'?await response.json():await response.text();
      const parsed=source.kind==='json'?raw:parseCSV(raw);
      const valid=validate(parsed,true);
      if(valid[0].no<state.draws[0].no)throw Error(`최신 회차 ${valid[0].no}가 저장된 ${state.draws[0].no}보다 과거입니다.`);
      return valid;
    }finally{clearTimeout(timer)}
  }
  async function refresh(manual=false){
    if(state.loading)return;
    if(!navigator.onLine){if(manual)feedback('인터넷 연결을 확인해 주세요. 저장된 기록은 계속 사용할 수 있습니다.','error');return}
    state.loading=true;$('refreshBtn').disabled=true;
    $('refreshBtn').textContent='전체 기록을 불러오는 중…';
    feedback('공개 데이터 원본을 확인 중입니다. 자료 검증 후 기존 기록을 교체합니다.');
    safeStorage.set(TRY_KEY,String(Date.now()));
    const errors=[];
    try{
      for(const source of SOURCES){
        try{
          const result=await requestSource(source);
          const persisted=saveData(result,source.name);render();
          feedback(`${fmt(result.length)}회 전체 데이터를 가져왔습니다. 최신 ${fmt(result[0].no)}회 (${dateLabel(result[0].date)}) · ${source.name}${persisted?' · 기기 저장 완료':' · 기기 저장 공간 부족으로 새로고침 시 사라질 수 있음'}`,persisted?'success':'error');
          if(manual)notice('당첨 이력이 갱신되었습니다.');return;
        }catch(err){errors.push(`${source.name}: ${err.message}`)}
      }
      const msg='자동 갱신이 차단되었거나 데이터 검증에 실패했습니다. 저장된 기록은 그대로 유지했습니다. 아래 출처에서 CSV를 내려받아 수동으로 불러올 수도 있습니다.';
      feedback(`${msg} (${errors.join(' / ')})`,'error');if(manual)notice('전체 기록 갱신에 실패했습니다. 데이터 메뉴를 확인해 주세요.',true);
    }finally{state.loading=false;$('refreshBtn').disabled=false;$('refreshBtn').innerHTML='<svg class="svg-icon"><use href="#i-refresh"></use></svg> 인터넷에서 전체 기록 갱신'}
  }
  function start(){
    loadStored();loadPersonalPicks();initEvents();render();setTab(location.hash.replace('#','')||'overview',false);
    if('serviceWorker'in navigator && location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('오프라인 등록 실패:',e));
    const last=Number(safeStorage.get(TRY_KEY)||0);
    if(Date.now()-last>8*60*60*1000 && navigator.onLine && location.protocol.startsWith('http'))refresh(false);
  }
  start();
  // Visible only to local automated smoke tests, no remote access or mutating effects.
  window.LottoLabTest={validate,parseCSV,countNumbers,selectedDraws,choose,sumDistribution,theoretical:{odds:THEORETICAL_ODDS,sums:THEORETICAL_SUMS,total:SUM_COMBINATIONS.reduce((a,b)=>a+b,0)},getState:()=>({...state,draws:state.draws.slice()})};
})();
