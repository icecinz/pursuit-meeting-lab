(() => {
'use strict';
const $ = id => document.getElementById(id);
const P = window.Physics, all = window.Presets.list;
// Fixed teaching examples share the verified motion model with editable scenarios.
const typicalCases = [
 {id:'p-10-fast-0-6',label:'后车加速追上匀速',A:{v:9,a:1.6},B:{x:15,v:5}},
 {id:'p-10-slow-0-6',label:'加速追匀速：先远离后追上',A:{v:7,a:1.6},B:{x:3.75,v:9}},
 {id:'p-20-fast-0-6',label:'后车减速追匀速：两次相遇',A:{v:9,a:-1.6},B:{x:3.2,v:5}},
 {id:'p-20-fast-0-8',label:'后车减速追匀速：恰好追上',A:{v:9,a:-1.6},B:{x:5,v:5}},
 {id:'p-20-fast-0-12',label:'后车减速追匀速：未追上',A:{v:9,a:-1.6},B:{x:7,v:5}},
 {id:'m-00-0-8',label:'两车匀速相向相遇'},
 {id:'m-02-0-72',label:'匀速与减速相向：停下后相遇',A:{v:6},B:{x:24,v:-6,a:3}},
 {id:'m-22-0-36',label:'两车减速相向：停下未相遇',A:{v:10,a:-4},B:{x:30,v:-10,a:4}}
];
const themes = {
 accelerate: { variants: [['一直靠近并追上','p-10-fast-0-6'],['先远离后追上','p-10-slow-0-6']] },
 decelerate: { variants: [['未追上','p-20-fast-0-12'],['恰好追上','p-20-fast-0-8'],['两次相遇','p-20-fast-0-6']] },
 'opposite-uniform': { variants: [['','m-00-0-8']] },
 'opposite-mixed': { variants: [['一方停下后相遇','m-02-0-72']] },
 'opposite-slow': { variants: [['双方停下仍未相遇','m-22-0-36']] }
};
const isComparison = () => state.mode === 'typical' && !!state.demoId;
const physicalScope = () => isComparison() ? (window.MotionComparison.cases[0]?.scope || 'pursuit') : state.scope==='typical' ? (all.find(p=>p.id===state.presetId)?.scope || 'pursuit') : state.scope;
let showUniform = false;
try { showUniform = localStorage.getItem('motion-show-uniform') === 'true'; } catch (_) {}
let state = {mode:'typical',scope:'typical',theme:'accelerate',demoId:'slow-start',category:'',resultFilter:'',presetId:'', A:{x:0,v:8,a:0,stop:false}, B:{x:6,v:4,a:1,stop:false}, duration:5, time:0, playing:false, last:null};
function baseList(){return all.filter(p=>p.scope===state.scope && (showUniform || !(p.scope==='pursuit' && p.group==='匀速追匀速')));}
function options(select,items,value,display=x=>x){select.replaceChildren(...items.map(x=>{const op=document.createElement('option');op.value=x;op.textContent=display(x);return op;}));select.value=items.includes(value)?value:(items[0]||'');return select.value;}
function shortLabel(p){
 if(p.scope==='meeting')return ({'相遇前都在运动':'运动中相遇','一方停下后相遇':'一方停后相遇','双方停下仍未相遇':'双方停下未相遇','恰好停下时相遇':'停下时相遇','展示时间内未相遇':'未相遇'})[p.phase]||p.result;
 if(p.result==='相遇两次')return '两次相遇';
 if(p.result==='恰好相遇')return '恰好追上';
 if(p.result==='相遇后保持同位置')return '相遇后保持同位置';
 if(p.result==='相遇一次')return p.process==='先远离后靠近'?'先远离后追上':'追上一次';
 return ({'先靠近后远离':'靠近后远离，未追上','先远离后靠近':'先远离后靠近，未追上','一直远离':'一直远离，未追上','一直靠近':'一直靠近，未追上','间距保持不变':'间距不变'})[p.process]||'未追上';
}
function exampleNames(items){
 const bases=items.map(shortLabel), counts={};for(const label of bases)counts[label]=(counts[label]||0)+1;
 const names=items.map((p,i)=>counts[bases[i]]===1?bases[i]:`${bases[i]} · ${p.scope==='pursuit'?p.initial:p.advantage}`);
 const duplicates={};for(const name of names)duplicates[name]=(duplicates[name]||0)+1;
 for(let i=0;i<items.length;i++)if(duplicates[names[i]]>1)names[i]+=` · ${items[i].scope==='pursuit'?items[i].advantage:items[i].phase}`;
 const finalCounts={};for(const name of names)finalCounts[name]=(finalCounts[name]||0)+1;
 const seen={};return names.map(name=>finalCounts[name]>1?`${name}（${seen[name]=(seen[name]||0)+1}）`:name);
}
function populateGroups(){
 const list=baseList(), groups=[...new Set(list.map(p=>p.group))];
 state.category=options($('category'),groups,state.category);
 document.querySelectorAll('button[data-scope]').forEach(b=>{const active=b.dataset.scope===state.scope;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 populateMoreExamples();
}
function populateMoreExamples(){
 const list=baseList().filter(p=>p.group===state.category), results=[...new Set(list.map(p=>p.result))];
 const allowed=['',...results]; state.resultFilter=options($('result-filter'),allowed,state.resultFilter,v=>v||'全部结果');
 const visible=list.filter(p=>!state.resultFilter||p.result===state.resultFilter), names=exampleNames(visible);
 state.presetId=options($('preset'),visible.map(p=>p.id),state.presetId,id=>names[visible.findIndex(p=>p.id===id)]);
 const root=$('preset-examples');root.replaceChildren();
 visible.forEach((p,i)=>{const button=document.createElement('button');button.type='button';button.className='preset-example';button.textContent=names[i];button.classList.toggle('selected',p.id===state.presetId);button.setAttribute('aria-pressed',String(p.id===state.presetId));button.addEventListener('click',()=>{state.presetId=p.id;$('preset').value=p.id;root.querySelectorAll('button').forEach(b=>{const active=b===button;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});loadPreset();});root.append(button);});
 if(state.presetId)loadPreset();
}
function presetExplanation(p){
 const process={'一直靠近':'运动时一直靠近','一直远离':'运动时一直远离','先靠近后远离':'先靠近后远离','先远离后靠近':'先远离后靠近','间距保持不变':'间距保持不变','间距多次变化':'间距多次变化'}[p.process]||p.process;
 if(p.scope==='pursuit')return `预设初速：${p.initial}；${p.advantage}。${p.result==='没有相遇'?'展示时间内':'首次相遇前'}，${process}。`;
 return `预设：${p.advantage}；${p.phase}。`;
}
function loadPreset(){const p=all.find(p=>p.id===state.presetId);if(!p)return;const example=state.scope==='typical'?typicalCases.find(c=>c.id===p.id):null;state.A={...p.A,...example?.A};state.B={...p.B,...example?.B};state.duration=p.duration;state.time=0;state.playing=false;state.last=null;if(state.mode==='more'){$('preset-selected').textContent=$('preset').selectedOptions[0]?.textContent||p.title;$('preset-description').textContent=presetExplanation(p);}$('model-note').textContent='说明对应预设；调整后结果可能改变。减速物体到零后停住。';renderParams();refresh();}
function resetGeneral(){state.A={x:0,v:8,a:0,stop:false};state.B={x:30,v:-4,a:0,stop:false};state.duration=5;state.time=0;state.playing=false;state.last=null;$('model-note').textContent='自由设置持续按匀变速直线运动计算：速度经过零后可反向，不会自动停车。';renderParams();refresh();}
function showTheme(theme,id){
 state.scope='typical';state.demoId='';state.theme=theme;const def=themes[theme]; if(!def)return;
 updateModeUI();
 state.presetId=id&&def.variants.some(v=>v[1]===id)?id:def.variants[0][1];
 document.querySelectorAll('button[data-theme]').forEach(b=>{const active=b.dataset.theme===theme;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 document.querySelectorAll('[data-variants]').forEach(el=>{const active=el.dataset.variants===theme&&(def.variants.length>1||!!def.variants[0][0]);el.hidden=!active;el.replaceChildren();if(active&&def.variants.length===1){const note=document.createElement('span');note.className='theme-example';note.textContent=def.variants[0][0];el.append(note);}else if(active)for(const [label,value] of def.variants){const b=document.createElement('button');b.type='button';b.className='variant-button';b.textContent=label;b.classList.toggle('selected',value===state.presetId);b.setAttribute('aria-pressed',String(value===state.presetId));b.addEventListener('click',()=>showTheme(theme,value));el.append(b);}});
 loadPreset();
}
function syncControlHeight() {
 const layout = document.querySelector('.layout');
 const origin = Math.ceil(layout.getBoundingClientRect().top + window.scrollY);
 layout.style.setProperty('--controls-origin', `${origin}px`);
}
function updateModeUI() {
 const comparison = isComparison();
 document.querySelectorAll('button[data-mode]').forEach(button => {
  const active = button.dataset.mode === state.mode;
  button.classList.toggle('selected', active);
  button.setAttribute('aria-pressed', String(active));
 });
 document.querySelectorAll('button[data-demo]').forEach(button => {
  const active = comparison && button.dataset.demo === state.demoId;
  button.classList.toggle('selected', active);
  button.setAttribute('aria-pressed', String(active));
 });
 $('classification').hidden = state.mode !== 'more';
 $('typical-selection').hidden = state.mode !== 'typical';
 $('general-note').hidden = state.mode !== 'general';
 $('parameter-section').hidden = state.mode === 'typical';
 $('comparison-view').hidden = !comparison;
 $('single-view').hidden = comparison;
 document.querySelector('.layout').classList.toggle('is-comparison', comparison);
 document.body.dataset.motionMode = state.mode;
 $('comparison-note').hidden = !comparison;
 syncControlHeight();
}
function showComparison(id) {
 const demo = window.MotionComparison;
 if (!demo.select(id)) return;
 state.mode = 'typical';
 state.scope = 'typical';
 state.demoId = id;
 state.presetId = '';
 state.duration = demo.duration;
 $('comparison-title').textContent = demo.title;
 const summary = $('comparison-summary');
 summary.replaceChildren();
 demo.summary.split(/\s*·\s*/).forEach((part, index) => {
  if (index) summary.append(document.createTextNode(' · '));
  const span = document.createElement('span');
  span.textContent = part;
  summary.append(span);
 });
 $('comparison-scale-note').textContent = `${demo.cases.length === 4 ? '四' : '三'}组同刻度 · 向右为正 →`;
 document.querySelector('.comparison-heading .chart-legend').setAttribute('aria-label', `${demo.cases.length}图共用图例`);
 $('comparison-note').textContent = demo.description;
 $('comparison-view').dataset.activeDemo = demo.id;
 state.time = 0;
 state.playing = false;
 state.last = null;
 document.querySelectorAll('button[data-theme]').forEach(button => {
  button.classList.remove('selected');
  button.setAttribute('aria-pressed', 'false');
 });
 document.querySelectorAll('[data-variants]').forEach(element => { element.hidden = true; });
 updateModeUI();
 renderParams();
 refresh();
}
function selectMode(mode) {
 state.mode = mode;
 state.time = 0;
 state.playing = false;
 state.last = null;
 if (mode === 'typical') { showComparison('slow-start'); return; }
 state.demoId = '';
 updateModeUI();
 if (mode === 'general') { state.scope = 'general'; resetGeneral(); }
 else {
  state.scope = 'pursuit';
  state.category = '';
  state.presetId = '';
  state.resultFilter = '';
  populateGroups();
 }
}
window.motionNavigate=({scope,group,presetId,field,value}={})=>{
 if(scope==='general'){selectMode('general');return;}
 const allowed=all.filter(p=>p.scope===scope&&(showUniform||!(p.scope==='pursuit'&&p.group==='匀速追匀速')));
 const p=allowed.find(p=>p.id===presetId)||allowed.find(p=>group&&p.group===group)||allowed.find(p=>field&&p[field]===value)||allowed[0];
 if(!p)return;state.mode='more';state.scope=scope;state.category=p.group;state.presetId=p.id;state.resultFilter='';
 state.demoId='';updateModeUI();populateGroups();
};
window.motionCurrent=()=>({scope:physicalScope(),field:'group',value:state.category,presetId:state.presetId,mode:state.mode});
function fmt(n,d=1){const value=Number(n).toFixed(d);return Number(value)===0?Number(0).toFixed(d):value;}
function signed(n){const value=fmt(n);return Number(value)===0?fmt(0):(n>0?'+':'')+value;}
function nice(n){return Number(n.toFixed(2)).toString();}
function paramRow(container,obj,key,label,lo,hi,step,allowBeyondSlider=false){
 const row=document.createElement('div');row.className='param-row';const id=`p-${obj}-${key}`;
 const text=document.createElement('label');text.htmlFor=id;text.textContent=label;
 const num=document.createElement('input');num.type='number';num.id=id;num.step=step;num.value=state[obj][key];num.min=allowBeyondSlider?-10000:lo;num.max=allowBeyondSlider?10000:hi;num.setAttribute('aria-label',label);
 const range=document.createElement('input');range.type='range';range.min=lo;range.max=hi;range.step=step;range.value=state[obj][key];range.setAttribute('aria-label',label+'滑杆');
 row.append(text,num,range);container.append(row);
 function update(value,commit=true){if(value===''||!Number.isFinite(Number(value)))return;const low=allowBeyondSlider?-10000:lo,high=allowBeyondSlider?10000:hi;const v=Math.max(low,Math.min(high,Number(value)));state[obj][key]=v;if(state.scope!=='general')state[obj].stop=state[obj].v*state[obj].a<0;if(commit)num.value=v;range.value=v;state.time=0;state.playing=false;state.last=null;refresh();}
 range.addEventListener('input',()=>update(range.value));num.addEventListener('input',()=>{if(num.value!==''&&num.validity.valid)update(num.value,false);});const commit=()=>{update(num.value);num.value=state[obj][key];};num.addEventListener('change',commit);num.addEventListener('blur',commit);
}
function renderParams(){
 const root=$('params');root.replaceChildren();if(state.mode==='typical')return;const general=state.scope==='general';
 const preset=all.find(p=>p.id===state.presetId);
 const kinds=!general&&preset?preset.group.replace(/相向$/,'').split(physicalScope()==='pursuit'?'追':'与'):[];
 if(!general){const box=document.createElement('div');box.className='param-group';const heading=document.createElement('div');heading.className='param-title';heading.textContent='初始位置';box.append(heading);paramRow(box,'B','x','两物体初始间距 d（m）',0,200,.1);root.append(box);}
 for(const [id,name,color,i] of [['A','A 物体','purple',0],['B','B 物体','green',1]]){
  const group=document.createElement('div');group.className='param-group';const heading=document.createElement('div');heading.className='param-title';const role=physicalScope()==='pursuit'?(id==='A'?' · 追赶者':' · 被追赶者'):'';heading.innerHTML=`<i class="dot ${color}"></i>${name}${role}`;group.append(heading);
  if(general){paramRow(group,id,'x','初始位置 x₀（m）',-100,100,1,true);paramRow(group,id,'v','初速度 v₀（m/s）',-30,30,.5,true);paramRow(group,id,'a','加速度 a（m/s²）',-5,5,.1,true);}
  else{
   const direction=physicalScope()==='meeting'&&id==='B'?-1:1;const kind=kinds[i];
   paramRow(group,id,'v',`初速度 v₀（m/s）${direction<0?' · 向左':' · 向右'}`,direction<0?-50:.1,direction<0?-.1:50,.1);
   if(kind==='匀速'){const fixed=document.createElement('p');fixed.className='model-note';fixed.textContent='匀速运动：加速度固定为 0 m/s²';group.append(fixed);}
   else{const sign=(kind==='匀加速'?1:-1)*direction;paramRow(group,id,'a',`${kind==='匀加速'?'加速度':'减速时的加速度'} a（m/s²）`,sign<0?-25:.1,sign<0?-.1:25,.05);}
  }
  root.append(group);
 }
 const row = document.createElement('div');
 row.className = 'param-row';
 row.innerHTML = '<label for="duration-input">展示时间（s）</label><input id="duration-input" type="number" min="1" max="120" step="1" aria-label="展示时间">';
 root.append(row);
 const input = $('duration-input');
 input.value = state.duration;
 function updateDuration(commit) {
  const value = Number(input.value);
  if (input.value.trim() !== '' && Number.isFinite(value) && (commit || (value >= 1 && value <= 120))) {
   state.duration = Math.max(1, Math.min(120, value));
  }
  if (commit) input.value = state.duration;
  state.time = Math.min(state.time, state.duration);
  state.playing = false;
  state.last = null;
  refresh();
 }
 input.addEventListener('input', () => updateDuration(false));
 input.addEventListener('change', () => updateDuration(true));
 input.addEventListener('blur', () => updateDuration(true));
}
let analysisKey = '', analysisEvents = null, resultsKey = '';
function currentAnalysis() {
 const key = JSON.stringify([state.A, state.B, state.duration]);
 if (key !== analysisKey) {
  analysisKey = key;
  analysisEvents = P.events(state.A, state.B, state.duration);
 }
 return analysisEvents;
}
function formatTime(t){const ev=currentAnalysis();return preciseTime(t,[...ev.meetings,...ev.equalTimes]);}
function formatTimes(arr){return arr.map(t=>`${formatTime(t)} s`).join('、');}
// Distinguish genuine distance turns from a stretch of equal velocities.
function timelineEvents(){
 const T=state.duration, ev=currentAnalysis(), points=[];
 const add=(t,label)=>{if(Number.isFinite(t)&&t>=0&&t<=T)points.push({t,label});};
 if(!ev.coincident)for(const t of ev.meetings)add(t,t===0?'初始同位':'相遇');
 for(const t of ev.equalTimes){
  if(t<=0||t>=T)continue;
  const nearby=ev.meetings.concat(['A','B'].map(id=>{
   const o=state[id];return o.v*o.a<0?-o.v/o.a:Infinity;
  })).map(x=>Math.abs(x-t)).filter(d=>d>64*Number.EPSILON*Math.max(1,Math.abs(t)));
  // Do not sample across a nearby encounter or stopping/reversal time.
  const dt=Math.min(T*1e-4,t/2,(T-t)/2,...nearby.map(d=>d/3));
  const rate=q=>(P.position(state.B,q)-P.position(state.A,q))*(P.velocity(state.B,q)-P.velocity(state.A,q));
  const left=rate(t-dt),right=rate(t+dt);
  if(left < 0 && right >= 0)add(t,'间距极小');
  else if(left > 0 && right <= 0)add(t,'间距极大');
 }
 for(const id of ['A','B']){
  const o=state[id];if(o.v*o.a<0){const t=-o.v/o.a;add(t,`${id} ${o.stop?'停下':'转向'}`);}
 }
 points.sort((a,b)=>a.t-b.t);
 const merged=[];
 for(const p of points){const prev=merged[merged.length-1];if(prev&&Math.abs(prev.t-p.t)<=64*Number.EPSILON*Math.max(1,Math.abs(prev.t),Math.abs(p.t))){if(!prev.labels.includes(p.label))prev.labels.push(p.label);}else merged.push({t:p.t,labels:[p.label]});}
 return merged;
}
let timelineCache='', timelinePoints=[], timelineDragging=false;
function preciseTime(t,times){
 let digits=3;
 while(digits<12){
  const rounded=Number(t.toFixed(digits));
  if((t===0||rounded!==0)&&!times.some(other=>other!==t&&Number(other.toFixed(digits))===rounded))break;
  digits++;
 }
 const value=Number(t.toFixed(digits));
 return value===0&&t!==0?Number(t.toPrecision(3)).toString():value.toString();
}
function timelineTime(t){return preciseTime(t,timelinePoints.map(point=>point.t));}
function renderTimeline(){
 const enabled=$('timeline-enabled').checked;
 const key=JSON.stringify([state.demoId,state.A,state.B,state.duration,enabled]);
 if(key!==timelineCache){
  timelineCache=key; timelinePoints=enabled?(isComparison()?window.MotionComparison.events():timelineEvents()):[];
  const marks=$('timeline-marks'), list=$('timeline-events');marks.replaceChildren();list.replaceChildren();
  for(const point of timelinePoints){
   const fraction=point.t/state.duration, marker=document.createElement('i');
   marker.className='timeline-mark';marker.style.left=`calc(${fraction*100}% + ${10-20*fraction}px)`;marks.append(marker);
   const button=document.createElement('button');button.type='button';button.className='timeline-event';
   button.textContent=`${timelineTime(point.t)}s ${point.labels.join(' · ')}`;
   button.setAttribute('aria-label',`${timelineTime(point.t)} 秒，${point.labels.join('，')}`);
   button.addEventListener('click',()=>{state.time=point.t;state.playing=false;state.last=null;refresh();});list.append(button);
  }
  list.hidden=!enabled||!timelinePoints.length;
 }
 const at=timelinePoints.find(p=>p.t===state.time);
 $('timeline').setAttribute('aria-valuetext',`${timelineTime(state.time)} 秒${at?'，'+at.labels.join('，'):''}`);
}
function renderResults(){
 const ev=currentAnalysis(),EPS=1e-8;
 const initialSame=Math.abs(P.position(state.A,0)-P.position(state.B,0))<EPS;
 const laterMeetings=ev.meetings.filter(t=>t>EPS);
 const joinedAt=t=>{
  const dt=Math.min(.01,(state.duration-t)/2);
  return dt>EPS&&Math.abs(P.position(state.A,t+dt)-P.position(state.B,t+dt))<EPS&&Math.abs(P.velocity(state.A,t+dt)-P.velocity(state.B,t+dt))<EPS;
 };
 const joined=ev.meetings.find(joinedAt);
 let meetTitle,meetDetail;
 if(ev.coincident){
  meetTitle='始终处于同一位置';meetDetail='展示时间内两者位置始终相同。';
 }else if(initialSame){
  if(laterMeetings.length){
   const laterJoined=laterMeetings.find(joinedAt);
   meetTitle=`之后相遇 ${laterMeetings.length} 次`;
   meetDetail=`初始位于同一位置；之后相遇时刻：${formatTimes(laterMeetings)}。`;
   if(laterJoined!==undefined)meetDetail+=`${formatTime(laterJoined)} s 起有一段时间重合。`;
  }else{
   meetTitle='同一位置出发';
   meetDetail=joined===0?'初始位于同一位置，并有一段时间重合；之后没有再次相遇。':'初始位于同一位置；展示时间内没有再次相遇。';
  }
 }else if(joined!==undefined){
  meetTitle='相遇后有一段时间重合';meetDetail=`${formatTime(joined)} s 起，两者有一段时间处在同一位置。`;
 }else if(ev.meetings.length){
  meetTitle=`${ev.meetings.length} 次相遇`;meetDetail=`相遇时刻：${formatTimes(ev.meetings)}。`;
 }else{
  meetTitle='尚未相遇';meetDetail='在当前展示时间内没有相遇。';
 }
 $('meeting-result').textContent=meetTitle;$('meeting-detail').textContent=meetDetail;
 const eq=ev.equalTimes;
 if(eq.length){
  const t=eq[0],delta=Math.min(.01,Math.max(0,(state.duration-t)/2));
  const continues=delta>0&&Math.abs(P.velocity(state.A,t+delta)-P.velocity(state.B,t+delta))<1e-7;
  $('equal-result').textContent=continues?(t<1e-7?'有一段时间共速':`${formatTime(t)} s 起有一段共速`):formatTimes(eq);
  $('equal-detail').textContent='速度相同不代表位置相同；是否为距离极值还需看前后变化。';
 }else{
  $('equal-result').textContent='没有共速时刻';$('equal-detail').textContent='在当前展示时间内，两者速度没有相同。';
 }
 // An initial coincidence describes the starting condition, not a later
 // meeting. Use the next positive meeting as the boundary for distance extrema.
 const end=ev.coincident?state.duration:initialSame?(laterMeetings[0]??state.duration):(ev.meetings[0]??state.duration);
 const candidates=[0,end,...ev.equalTimes.filter(t=>t>0&&t<end)].map(t=>({t,d:Math.abs(P.position(state.B,t)-P.position(state.A,t))}));
 const smallest=candidates.reduce((a,b)=>b.d<a.d?b:a),largest=candidates.reduce((a,b)=>b.d>a.d?b:a);
 $('rule-title').textContent='间距的最大与最小';
 const interval=initialSame?(laterMeetings.length?'再次相遇前（含相遇）':'当前展示时间内'):(ev.meetings.length?'首次相遇前（含相遇）':'当前展示时间内');
 $('rule-detail').textContent=`${interval}：最大 ${nice(largest.d)} m（${formatTime(largest.t)} s），最小 ${nice(smallest.d)} m（${formatTime(smallest.t)} s）。`;
}
// Reserve each numeric slot from the entire trajectory, once per model.
// Playback only replaces the digits; units and neighbouring readings stay put.
let readoutKey = '';
function reserveNumber(id, values, formatter) {
 const characters = Math.max(...values.map(value => formatter(value).length));
 $(id).style.setProperty('--number-width', `${characters + .5}ch`);
 return characters;
}
function reserveReadouts() {
 currentAnalysis();
 if (readoutKey === analysisKey) return;
 readoutKey = analysisKey;
 const times = timelineEvents().map(point => point.t);
 const timeCharacters = reserveNumber('time-value', [0, state.duration, ...times], time => {
  const exact = preciseTime(time, times), ordinary = fmt(time);
  return exact.length > ordinary.length ? exact : ordinary;
 });
 let widestReading = timeCharacters;
 const bounds = P.bounds(state.A, state.B, state.duration);
 const distanceBound = bounds.max - bounds.min;
 widestReading = Math.max(widestReading, reserveNumber('distance-value', [0, distanceBound], fmt));
 widestReading = Math.max(widestReading, reserveNumber('relative-value', [-distanceBound, 0, distanceBound], signed));
 for (const key of ['A', 'B']) {
  const object = state[key], prefix = key.toLowerCase();
  const range = P.bounds(object, object, state.duration);
  widestReading = Math.max(widestReading, reserveNumber(prefix + '-position', [range.min, 0, range.max], signed));
  widestReading = Math.max(widestReading, reserveNumber(prefix + '-displacement', [range.min - object.x, 0, range.max - object.x], signed));
  widestReading = Math.max(widestReading, reserveNumber(prefix + '-velocity', [P.velocity(object, 0), 0, P.velocity(object, state.duration)], signed));
 }
 // Long signed values also need the full-width reading layout. The choice
 // stays fixed for the whole trajectory, so playback never moves the panels.
 $('single-stage').querySelector('.status-row').classList.toggle('wide-time', widestReading > 6);
 $('single-stage').classList.toggle('wide-readings', widestReading > 6);
}
function refresh() {
 renderTimeline();
 const time = state.time;
 $('play').innerHTML = state.playing ? 'Ⅱ &nbsp;暂停' : '▶ &nbsp;播放';
 const playbackTarget = isComparison() ? `全部${window.MotionComparison.cases.length === 4 ? '四' : '三'}组` : '演示';
 $('play').setAttribute('aria-label', `${state.playing ? '暂停' : '播放'}${playbackTarget}`);
 $('timeline').max = state.duration;
 $('timeline').value = time;
 $('duration-label').textContent = `${fmt(time)} / ${nice(state.duration)} s`;
 if (isComparison()) {
  window.MotionComparison.render(time);
  return;
 }
 reserveReadouts();
 const shownTime = timelinePoints.some(point => point.t === time) ? timelineTime(time) : fmt(time);
 $('time-value').textContent = shownTime;
 const relative = P.position(state.B, time) - P.position(state.A, time);
 $('distance-value').textContent = fmt(Math.abs(relative));
 $('relative-value').textContent = signed(relative);
 for (const key of ['A', 'B']) {
  const object = state[key], prefix = key.toLowerCase(), position = P.position(object, time);
  $(prefix + '-position').textContent = signed(position);
  $(prefix + '-displacement').textContent = signed(position - object.x);
  $(prefix + '-velocity').textContent = signed(P.velocity(object, time));
 }
 const scene = {...state, scope: physicalScope(), events: currentAnalysis()};
 window.MotionRenderer.track($('track'), scene);
 window.MotionRenderer.plot($('position-chart'), 'x', scene);
 window.MotionRenderer.plot($('velocity-chart'), 'v', scene);
 if (resultsKey !== analysisKey) { renderResults(); resultsKey = analysisKey; }
}

$('params-reset').addEventListener('click', () => {
 if (state.mode === 'typical') return;
 if (state.scope === 'general') resetGeneral(); else loadPreset();
});
document.querySelectorAll('button[data-mode]').forEach(button => {
 button.addEventListener('click', () => selectMode(button.dataset.mode));
});
document.querySelectorAll('button[data-theme]').forEach(button => {
 button.addEventListener('click', () => showTheme(button.dataset.theme));
});
document.querySelectorAll('button[data-demo]').forEach(button => {
 button.addEventListener('click', () => showComparison(button.dataset.demo));
});
document.querySelectorAll('button[data-scope]').forEach(button => {
 button.addEventListener('click', () => {
  state.scope = button.dataset.scope;
  state.category = '';
  state.presetId = '';
  state.resultFilter = '';
  populateGroups();
 });
});
$('category').addEventListener('change', event => {
 state.category = event.target.value;
 state.presetId = '';
 state.resultFilter = '';
 populateMoreExamples();
});
$('result-filter').addEventListener('change', event => {
 state.resultFilter = event.target.value;
 state.presetId = '';
 populateMoreExamples();
});
$('preset').addEventListener('change', event => { state.presetId = event.target.value; loadPreset(); });

// Request frames only while playing; pause when the page becomes hidden.
let animationFrame = null;
function requestTick() {
 if (state.playing && animationFrame === null) animationFrame = requestAnimationFrame(tick);
}
function tick(now) {
 animationFrame = null;
 if (!state.playing) return;
 if (state.last !== null) state.time = Math.min(state.duration, state.time + (now - state.last) / 1000);
 state.last = now;
 if (state.time >= state.duration) { state.playing = false; state.last = null; }
 refresh();
 requestTick();
}
$('play').addEventListener('click', () => {
 if (state.time >= state.duration) state.time = 0;
 state.playing = !state.playing;
 state.last = null;
 refresh();
 requestTick();
});
$('reset').addEventListener('click', () => {
 state.time = 0;
 state.playing = false;
 state.last = null;
 refresh();
});
$('timeline').addEventListener('pointerdown', () => { timelineDragging = true; });
window.addEventListener('pointerup', () => { timelineDragging = false; });
window.addEventListener('pointercancel', () => { timelineDragging = false; });
$('timeline').addEventListener('input', event => {
 let time = Number(event.target.value);
 if (timelineDragging && $('timeline-enabled').checked && timelinePoints.length) {
  const width = event.target.getBoundingClientRect().width;
  const threshold = state.duration * Math.min(.025, 12 / Math.max(width - 20, 1));
  const nearest = timelinePoints.reduce((a, b) => Math.abs(b.t - time) < Math.abs(a.t - time) ? b : a);
  if (Math.abs(nearest.t - time) <= threshold) time = nearest.t;
 }
 state.time = time;
 state.playing = false;
 state.last = null;
 refresh();
});
$('timeline-enabled').addEventListener('change', refresh);
$('show-uniform').checked = showUniform;
$('show-uniform').addEventListener('change', event => {
 showUniform = event.target.checked;
 try { localStorage.setItem('motion-show-uniform', String(showUniform)); } catch (_) {}
 if (state.mode !== 'more') return;
 const previous = {id: state.presetId, A: {...state.A}, B: {...state.B}, time: state.time, duration: state.duration, playing: state.playing};
 populateGroups();
 if (state.presetId === previous.id) {
  Object.assign(state, {A: previous.A, B: previous.B, time: previous.time, duration: previous.duration, playing: previous.playing, last: null});
  renderParams();
  refresh();
  requestTick();
 }
});
$('settings-open').addEventListener('click', () => $('settings-dialog').showModal());
$('settings-dialog').addEventListener('click', event => {
 if (event.target === $('settings-dialog')) $('settings-dialog').close();
});
document.addEventListener('visibilitychange', () => {
 if (document.hidden && state.playing) {
  state.playing = false;
  state.last = null;
  refresh();
 }
});
let resizeTimer;
window.addEventListener('resize', () => {
 clearTimeout(resizeTimer);
 resizeTimer = setTimeout(() => { syncControlHeight(); refresh(); }, 80);
});
window.MotionComparison.mount($('comparison-cards'));
selectMode('typical');
})();
