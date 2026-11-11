(() => {
'use strict';
const $ = id => document.getElementById(id);
const P = window.Physics, all = window.Presets.list;
const fields = window.Presets.labels.fields;
// A short teaching pathway through the same verified motion presets.
const typicalCases = [
 {id:'p-10-fast-0-6',label:'后车加速追上匀速',A:{v:9,a:1.6},B:{x:15,v:5}},
 {id:'p-10-slow-0-6',label:'加速追匀速：先远离后追上',A:{v:5,a:2.4},B:{x:4.2,v:8}},
 {id:'p-20-fast-0-6',label:'后车减速追匀速：两次相遇',A:{v:9,a:-1.6},B:{x:3.2,v:5}},
 {id:'p-20-fast-0-8',label:'后车减速追匀速：恰好追上',A:{v:9,a:-1.6},B:{x:5,v:5}},
 {id:'p-20-fast-0-12',label:'后车减速追匀速：未追上',A:{v:9,a:-1.6},B:{x:7,v:5}},
 {id:'m-00-0-8',label:'两车匀速相向相遇'},
 {id:'m-02-0-72',label:'匀速与减速相向：停下后相遇',A:{v:6},B:{x:19.5,v:-6,a:4}},
 {id:'m-22-0-36',label:'两车减速相向：停下未相遇',A:{v:8,a:-4},B:{x:20,v:-8,a:4}}
];
const themes = {
 accelerate: { variants: [['一直靠近并追上','p-10-fast-0-6'],['先远离后追上','p-10-slow-0-6']] },
 decelerate: { variants: [['未追上','p-20-fast-0-12'],['恰好追上','p-20-fast-0-8'],['两次相遇','p-20-fast-0-6']] },
 'opposite-uniform': { variants: [['','m-00-0-8']] },
 'opposite-mixed': { variants: [['一方停下后相遇','m-02-0-72']] },
 'opposite-slow': { variants: [['双方停下仍未相遇','m-22-0-36']] }
};
const physicalScope = () => state.scope==='typical' ? (all.find(p=>p.id===state.presetId)?.scope || 'pursuit') : state.scope;
let showUniform = false;
try { showUniform = localStorage.getItem('motion-show-uniform') === 'true'; } catch (_) {}
let state = {mode:'typical',scope:'typical',theme:'accelerate',category:'',resultFilter:'',presetId:'', A:{x:0,v:8,a:0,stop:false}, B:{x:6,v:4,a:1,stop:false}, duration:18, time:0, playing:false, last:null};
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
 document.querySelectorAll('[data-scope]').forEach(b=>b.classList.toggle('selected',b.dataset.scope===state.scope));
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
function loadPreset(){const p=all.find(p=>p.id===state.presetId);if(!p)return;const example=state.scope==='typical'?typicalCases.find(c=>c.id===p.id):null;state.A={...p.A,...example?.A};state.B={...p.B,...example?.B};state.duration=p.duration;state.time=0;state.playing=false;state.last=null;if(state.mode==='more'){$('preset-selected').textContent=$('preset').selectedOptions[0]?.textContent||p.title;$('preset-description').textContent=presetExplanation(p);}$('model-note').textContent=state.scope==='typical'?'调整参数后，运动结果可能改变；减速物体到零后停住。':'以上说明对应预设；调整参数后结果可能改变。减速物体到零后停住。';renderParams();refresh();}
function resetGeneral(){state.A={x:0,v:8,a:0,stop:false};state.B={x:30,v:-4,a:0,stop:false};state.duration=5;state.time=0;state.playing=false;state.last=null;$('model-note').textContent='自由设置持续按匀变速直线运动计算：速度经过零后可反向，不会自动停车。';renderParams();refresh();}
function showTheme(theme,id){
 state.scope='typical';state.theme=theme;const def=themes[theme]; if(!def)return;
 state.presetId=id&&def.variants.some(v=>v[1]===id)?id:def.variants[0][1];
 document.querySelectorAll('[data-theme]').forEach(b=>{const active=b.dataset.theme===theme;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 document.querySelectorAll('[data-variants]').forEach(el=>{const active=el.dataset.variants===theme&&(def.variants.length>1||!!def.variants[0][0]);el.hidden=!active;el.replaceChildren();if(active&&def.variants.length===1){const note=document.createElement('span');note.className='theme-example';note.textContent=def.variants[0][0];el.append(note);}else if(active)for(const [label,value] of def.variants){const b=document.createElement('button');b.type='button';b.className='variant-button';b.textContent=label;b.classList.toggle('selected',value===state.presetId);b.setAttribute('aria-pressed',String(value===state.presetId));b.addEventListener('click',()=>showTheme(theme,value));el.append(b);}});
 loadPreset();
}
function selectMode(mode){
 state.mode=mode;state.time=0;state.playing=false;state.last=null;
 document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 $('classification').hidden=mode!=='more';$('typical-selection').hidden=mode!=='typical';$('general-note').hidden=mode!=='general';
 if(mode==='general'){state.scope='general';resetGeneral();}else if(mode==='typical')showTheme('accelerate');else{state.scope='pursuit';state.category='';state.presetId='';state.resultFilter='';populateGroups();}
}
window.motionNavigate=({scope,group,presetId,field,value}={})=>{
 if(scope==='general'){selectMode('general');return;}
 const allowed=all.filter(p=>p.scope===scope&&(showUniform||!(p.scope==='pursuit'&&p.group==='匀速追匀速')));
 const p=allowed.find(p=>p.id===presetId)||allowed.find(p=>group&&p.group===group)||allowed.find(p=>field&&p[field]===value)||allowed[0];
 if(!p)return;state.mode='more';state.scope=scope;state.category=p.group;state.presetId=p.id;state.resultFilter='';
 document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode==='more';b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 $('classification').hidden=false;$('typical-selection').hidden=true;$('general-note').hidden=true;populateGroups();
};
window.motionCurrent=()=>({scope:physicalScope(),field:'group',value:state.category,presetId:state.presetId,mode:state.mode});
function fmt(n,d=1){if(Math.abs(n)<0.00001)n=0;return Number(n).toFixed(d);}
function nice(n){return Number(n.toFixed(2)).toString();}
function paramRow(container,obj,key,label,lo,hi,step,allowBeyondSlider=false){
 const row=document.createElement('div');row.className='param-row';const id=`p-${obj}-${key}`;
 const text=document.createElement('label');text.htmlFor=id;text.textContent=label;
 const num=document.createElement('input');num.type='number';num.id=id;num.step=step;num.value=state[obj][key];num.min=allowBeyondSlider?-10000:lo;num.max=allowBeyondSlider?10000:hi;num.setAttribute('aria-label',label);
 const range=document.createElement('input');range.type='range';range.min=lo;range.max=hi;range.step=step;range.value=state[obj][key];range.setAttribute('aria-label',label+'滑杆');
 row.append(text,num,range);container.append(row);
 function update(value){if(value===''||!Number.isFinite(Number(value)))return;const low=allowBeyondSlider?-10000:lo,high=allowBeyondSlider?10000:hi;const v=Math.max(low,Math.min(high,Number(value)));state[obj][key]=v;if(state.scope!=='general')state[obj].stop=state[obj].v*state[obj].a<0;num.value=v;range.value=v;state.time=0;state.playing=false;state.last=null;refresh();}
 range.addEventListener('input',()=>update(range.value));num.addEventListener('change',()=>{update(num.value);num.value=state[obj][key];});
}
function renderParams(){
 const root=$('params');root.replaceChildren();const general=state.scope==='general';
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
 const row=document.createElement('div');row.className='param-row';row.innerHTML='<label for="duration-input">展示时间（s）</label><input id="duration-input" type="number" min="1" max="120" step="1" aria-label="展示时间">';root.append(row);const inp=$('duration-input');inp.value=state.duration;inp.addEventListener('change',()=>{state.duration=Math.max(1,Math.min(120,Number(inp.value)||18));inp.value=state.duration;state.time=Math.min(state.time,state.duration);state.playing=false;state.last=null;refresh();});
}
function canvasContext(canvas){const rect=canvas.getBoundingClientRect(), ratio=window.devicePixelRatio||1;const w=Math.max(rect.width,1),h=Math.max(rect.height,1);if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);return {ctx,w,h};}
function rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
// Pick intervals from 1, 2 and 5 times powers of ten, and expand the
// displayed domain to exact tick values. Physical values are never rounded.
function niceAxis(low,high,target=4){
  if(!Number.isFinite(low)||!Number.isFinite(high)){low=-1;high=1;}
  if(low>high)[low,high]=[high,low];
  if(low===high){const padding=Math.max(1,Math.abs(low)*.1);low-=padding;high+=padding;}
  const rough=(high-low)/Math.max(1,target),power=10**Math.floor(Math.log10(rough));
  const fraction=rough/power,unit=fraction<=1?1:fraction<=2?2:fraction<=5?5:10,step=unit*power;
  const eps=step*1e-10;
  let start=Math.floor((low+eps)/step)*step,end=Math.ceil((high-eps)/step)*step;
  if(start>low+eps)start-=step;
  if(end<high-eps)end+=step;
  // Floating point multiplication can produce -0 or 0.30000000000000004.
  const clean=n=>Math.abs(n)<eps?0:Number(n.toPrecision(14));
  start=clean(start);end=clean(end);
  const count=Math.round((end-start)/step),ticks=[];
  for(let i=0;i<=count&&i<=30;i++)ticks.push(clean(start+i*step));
  return {min:start,max:end,step,ticks};
}
function axisLabel(value,step){
  const digits=Math.max(0,Math.min(15,-Math.floor(Math.log10(step)+1e-10)));
  if(Math.abs(value)<step*1e-9)value=0;
  return value.toLocaleString('en-US',{maximumFractionDigits:digits});
}
function canvasFontScale(){return typeof window.motionFontScale==='function'?window.motionFontScale():1;}
function drawTrack(){
  const {ctx:c,w,h}=canvasContext($('track'));
  const bounds=P.bounds(state.A,state.B,state.duration), range=Math.max(15,bounds.max-bounds.min), pad=range*.11;
  // The reference point is the marked front edge, not the block's centre.
  const blockWidth=Math.min(116,Math.max(82,w*.2),Math.max(42,(w-32)/2)),margin=blockWidth+12;
  const axisWidth=Math.max(1,w-2*margin),scale=canvasFontScale();
  const min=bounds.min-pad,max=bounds.max+pad;
  const axis=niceAxis(min,max,Math.max(2,Math.min(6,Math.floor(axisWidth/(100*scale)))));
  const x=value=>margin+(value-min)/(max-min)*axisWidth;
  const xa=x(P.position(state.A,state.time)), xb=x(P.position(state.B,state.time));
  const frontDirection=o=>Math.sign(o.v)||Math.sign(o.a)||1;
  const labelA=physicalScope()==='pursuit'?'A 追':'A', labelB=physicalScope()==='pursuit'?'B 被追':'B';
  const blockHeight=Math.min(50,Math.max(38,h*.15));
  const topA=Math.max(20,14+4*scale);
  const axisY=h-Math.max(40,25+12*scale);
  const topB=Math.max(topA+blockHeight+36,axisY-blockHeight-Math.max(22,10+10*scale));
  const guideY=(topA+blockHeight+topB)/2;

  // One shared scale for both objects over the full time window: arrows can
  // be compared across objects and frames without changing the scale mid-play.
  const maxSpeed=Math.max(...[state.A,state.B].flatMap(o=>[Math.abs(P.velocity(o,0)),Math.abs(P.velocity(o,state.duration))]));
  // A and B occupy separate lanes even when their reference points coincide.
  car(c,xa,topA,blockWidth,blockHeight,labelA,'#477fa8',frontDirection(state.A),P.velocity(state.A,state.time),maxSpeed,w);
  car(c,xb,topB,blockWidth,blockHeight,labelB,'#795bb1',frontDirection(state.B),P.velocity(state.B,state.time),maxSpeed,w);

  c.save();
  c.setLineDash([3,4]);c.lineWidth=1;c.strokeStyle='#aab4a7';
  c.beginPath();c.moveTo(xa,topA+blockHeight+2);c.lineTo(xa,guideY);c.moveTo(xb,guideY);c.lineTo(xb,topB-2);c.stroke();
  c.setLineDash([]);c.strokeStyle='#869783';c.lineWidth=1.2;
  c.beginPath();c.moveTo(xa,guideY);c.lineTo(xb,guideY);c.stroke();
  for(const [point,color] of [[xa,'#477fa8'],[xb,'#795bb1']]){c.fillStyle=color;c.beginPath();c.arc(point,guideY,2.3,0,Math.PI*2);c.fill();}
  const text=`车头间距 ${nice(Math.abs(P.position(state.B,state.time)-P.position(state.A,state.time)))} m`;
  c.font=`600 ${13*scale}px -apple-system, BlinkMacSystemFont, sans-serif`;c.textAlign='center';
  const textWidth=Math.min(w-8,c.measureText(text).width+12),mid=Math.max(textWidth/2+3,Math.min(w-textWidth/2-3,(xa+xb)/2));
  c.fillStyle='#fbfaf5';c.fillRect(mid-textWidth/2,guideY-6-14*scale,textWidth,16*scale);
  c.fillStyle='#4d5c50';c.fillText(text,mid,guideY-6,Math.max(40,w-8));
  c.restore();

  c.strokeStyle='#c5d0c2';c.lineWidth=1;c.beginPath();c.moveTo(margin,axisY);c.lineTo(w-margin,axisY);c.stroke();
  c.fillStyle='#4d5c50';c.font=`600 ${12*scale}px -apple-system, sans-serif`;c.textAlign='center';
  for(const tick of axis.ticks){if(tick<min-1e-9||tick>max+1e-9)continue;const xx=x(tick);c.beginPath();c.moveTo(xx,axisY);c.lineTo(xx,axisY+5);c.stroke();c.fillText(axisLabel(tick,axis.step),xx,axisY+7+12*scale);}
  c.textAlign='right';c.fillText('位置 / m',w-8,axisY+20+12*scale);
}
function car(c,front,top,width,height,label,color,frontDirection,velocity,maxSpeed,canvasWidth){
  const left=frontDirection>0?front-width:front, right=left+width, bottom=top+height;
  c.save();c.fillStyle='#faf9f4';c.fillRect(left,top,width,height);
  // Regular fine hatching and slightly doubled edges evoke a hand-drawn block.
  c.save();c.beginPath();c.rect(left,top,width,height);c.clip();c.globalAlpha=.34;c.strokeStyle=color;c.lineWidth=.8;
  for(let i=-height;i<width+height;i+=8){c.beginPath();c.moveTo(left+i,bottom+1);c.lineTo(left+i+height+1,top-1);c.stroke();}c.restore();
  c.strokeStyle=color;c.lineWidth=1.8;c.lineJoin='round';
  c.beginPath();c.moveTo(left+.4,top+.3);c.lineTo(right-.4,top);c.lineTo(right, bottom-.3);c.lineTo(left,bottom);c.closePath();c.stroke();
  c.globalAlpha=.34;c.lineWidth=.65;c.beginPath();c.moveTo(left-1,top+1.4);c.lineTo(right+.5,top+.7);c.lineTo(right+1,bottom+.6);c.lineTo(left-.7,bottom-.4);c.closePath();c.stroke();c.globalAlpha=1;
  // The thicker end remains attached to the same material point if velocity reverses.
  c.lineWidth=5;c.beginPath();c.moveTo(front,top+1);c.lineTo(front,bottom-1);c.stroke();
  c.fillStyle=color;c.font=`600 ${Math.min(17*canvasFontScale(),height*.62)}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(label,(left+right)/2,top+height/2+1);
  // The shaft's actual length is proportional to |v|, with a shared maximum
  // of 54 px. Zero speed has no arrow; its direction is the sign of velocity.
  const arrowLength=maxSpeed>0 ? (Math.abs(velocity)/maxSpeed)*Math.min(54,width*.6,Math.max(0,canvasWidth-8)) : 0;
  if(arrowLength>0){
    const direction=Math.sign(velocity),center=(left+right)/2,y=top-8;
    // Translate the arrow when needed to keep both ends inside the canvas;
    // never shorten it, so the displayed length remains comparable.
    const start=direction>0?Math.max(4,Math.min(center,canvasWidth-4-arrowLength)):Math.max(4+arrowLength,Math.min(center,canvasWidth-4));
    const tip=start+direction*arrowLength,head=Math.min(6,arrowLength*.35),halfHead=head*.65;
    c.lineWidth=Math.min(1.8,Math.max(.15,arrowLength/2));c.beginPath();c.moveTo(start,y);c.lineTo(tip,y);
    c.moveTo(tip-direction*head,y-halfHead);c.lineTo(tip,y);c.lineTo(tip-direction*head,y+halfHead);c.stroke();
  }
  c.restore();
}
// Include zero in each vertical scale so the axes really intersect at (0, 0).
// Only pad on sides containing nonzero data, avoiding artificial negative space.
function plotLimits(type){
  let low,high;
  if(type==='x'){
    const b=P.bounds(state.A,state.B,state.duration);low=b.min;high=b.max;
  }else{
    const values=[P.velocity(state.A,0),P.velocity(state.A,state.duration),P.velocity(state.B,0),P.velocity(state.B,state.duration)];
    low=Math.min(...values);high=Math.max(...values);
  }
  low=Math.min(0,low);high=Math.max(0,high);
  if(low===high)return [0,1];
  const padding=(high-low)*.06;
  return [low<0?low-padding:0,high>0?high+padding:0];
}
function plot(canvas,type){
  const {ctx:c,w,h}=canvasContext(canvas),scale=canvasFontScale(),T=state.duration;
  const fontSize=10*scale,top=Math.ceil(18+fontSize*.8),bottom=h-Math.ceil(18+fontSize),r=Math.ceil(Math.max(17,fontSize*1.6));
  const [dataMin,dataMax]=plotLimits(type),ph=Math.max(1,bottom-top);
  // Generate tidy tick labels separately from the view limits. Expanding to
  // the next major tick can double unused space; data remain on a linear scale.
  const yAxis=niceAxis(dataMin,dataMax,Math.max(4,Math.min(6,Math.floor(ph/(27*scale))))*1.5);
  const visibleTicks=yAxis.ticks.filter(t=>t>=dataMin-yAxis.step*1e-9&&t<=dataMax+yAxis.step*1e-9);
  c.font=`600 ${fontSize}px -apple-system, sans-serif`;
  const labelWidth=Math.max(0,...visibleTicks.map(t=>c.measureText(axisLabel(t,yAxis.step)).width));
  const l=Math.max(36,Math.ceil(labelWidth+13)),pw=Math.max(1,w-l-r);
  const X=t=>l+t/T*pw,Y=v=>top+(dataMax-v)/(dataMax-dataMin)*ph;
  const at=(o,t)=>type==='x'?P.position(o,t):P.velocity(o,t);
  const zeroY=Y(0),axisColor='#68766a',tickLength=3;
  c.lineWidth=1;c.textAlign='right';c.textBaseline='middle';
  // Thin gridlines are guides; the zero line is the actual horizontal axis.
  for(const tick of visibleTicks){
    const yy=Y(tick);
    if(Math.abs(tick)>yAxis.step*1e-9){c.strokeStyle='#edf0e8';c.beginPath();c.moveTo(l,yy);c.lineTo(w-r,yy);c.stroke();}
    c.fillStyle='#4d5c50';c.fillText(axisLabel(tick,yAxis.step),l-6,yy);
    c.strokeStyle=axisColor;c.beginPath();c.moveTo(l-tickLength,yy);c.lineTo(l,yy);c.stroke();
  }
  const timeAxis=niceAxis(0,T,Math.max(3,Math.min(6,Math.floor(pw/(65*scale)))));
  c.textAlign='center';c.textBaseline='top';c.fillStyle='#4d5c50';
  for(const tick of timeAxis.ticks){
    if(tick<=0||tick>T+timeAxis.step*1e-9)continue;
    const xx=X(tick);
    c.strokeStyle=axisColor;c.beginPath();c.moveTo(xx,zeroY);c.lineTo(xx,zeroY+tickLength);c.stroke();
    c.fillText(axisLabel(tick,timeAxis.step),xx,zeroY+tickLength+2);
  }
  // Standard x/v versus t axes with positive direction indicated by arrows.
  c.strokeStyle=axisColor;c.lineWidth=1.1;c.setLineDash([]);c.beginPath();
  c.moveTo(l,bottom);c.lineTo(l,top-5);c.lineTo(l-3.5,top);
  c.moveTo(l,top-5);c.lineTo(l+3.5,top);
  c.moveTo(l,zeroY);c.lineTo(w-r+5,zeroY);c.lineTo(w-r,zeroY-3.5);
  c.moveTo(w-r+5,zeroY);c.lineTo(w-r,zeroY+3.5);c.stroke();
  c.fillStyle='#4d5c50';c.textBaseline='alphabetic';c.textAlign='left';
  c.fillText(type==='x'?'x / m':'v / (m/s)',l+5,top-10);
  c.textAlign='right';c.fillText('t / s',w-2,Math.max(fontSize+1,zeroY-6));
  for(const [obj,col,dashed] of [[state.A,'#477fa8',false],[state.B,'#795bb1',true]]){
    c.strokeStyle=col;c.lineWidth=2.1;c.setLineDash(dashed?[6,3.5]:[]);c.beginPath();
    for(let i=0;i<=160;i++){const t=T*i/160,px=X(t),py=Y(at(obj,t));if(i===0)c.moveTo(px,py);else c.lineTo(px,py);}c.stroke();
    c.setLineDash([]);const px=X(state.time),py=Y(at(obj,state.time));c.fillStyle='#fbfaf5';c.beginPath();c.arc(px,py,4,0,Math.PI*2);c.fill();c.strokeStyle=col;c.lineWidth=2;c.stroke();
  }
  if(state.time>1e-9){c.strokeStyle='#bfc8b9';c.lineWidth=1;c.setLineDash([3,4]);c.beginPath();c.moveTo(X(state.time),top);c.lineTo(X(state.time),bottom);c.stroke();c.setLineDash([]);}
  const ev=P.events(state.A,state.B,T);
  for(const t of type==='x'?ev.meetings:ev.equalTimes){if(t<0||t>T)continue;const py=Y(at(state.A,t));c.fillStyle='#c28a55';c.beginPath();c.arc(X(t),py,3.3,0,Math.PI*2);c.fill();}
  c.textBaseline='alphabetic';
}
function formatTimes(arr){return arr.map(t=>`${nice(t)} s`).join('、');}
// Distinguish genuine distance turns from a stretch of equal velocities.
function timelineEvents(){
 const T=state.duration, ev=P.events(state.A,state.B,T), points=[];
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
function timelineTime(t){
 let digits=3;
 while(digits<12){
  const rounded=Number(t.toFixed(digits));
  if((t===0||rounded!==0)&&!timelinePoints.some(p=>p.t!==t&&Number(p.t.toFixed(digits))===rounded))break;
  digits++;
 }
 const value=Number(t.toFixed(digits));
 return value===0&&t!==0?Number(t.toPrecision(3)).toString():value.toString();
}
function renderTimeline(){
 const enabled=$('timeline-enabled').checked;
 const key=JSON.stringify([state.A,state.B,state.duration,enabled]);
 if(key!==timelineCache){
  timelineCache=key; timelinePoints=enabled?timelineEvents():[];
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
 const ev=P.events(state.A,state.B,state.duration),EPS=1e-8;
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
   if(laterJoined!==undefined)meetDetail+=`${nice(laterJoined)} s 起有一段时间重合。`;
  }else{
   meetTitle='同一位置出发';
   meetDetail=joined===0?'初始位于同一位置，并有一段时间重合；之后没有再次相遇。':'初始位于同一位置；展示时间内没有再次相遇。';
  }
 }else if(joined!==undefined){
  meetTitle='相遇后有一段时间重合';meetDetail=`${nice(joined)} s 起，两者有一段时间处在同一位置。`;
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
  $('equal-result').textContent=continues?(t<1e-7?'有一段时间共速':`${nice(t)} s 起有一段共速`):formatTimes(eq);
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
 $('rule-detail').textContent=`${interval}：最大 ${nice(largest.d)} m（${nice(largest.t)} s），最小 ${nice(smallest.d)} m（${nice(smallest.t)} s）。`;
}
function refresh(){renderTimeline();const t=state.time,shownTime=timelinePoints.some(p=>p.t===t)?timelineTime(t):fmt(t); $('time-readout').innerHTML=`${shownTime} <em>s</em>`;const relative=P.position(state.B,t)-P.position(state.A,t);$('distance-readout').innerHTML=`${fmt(Math.abs(relative))} <em>m</em>`;$('relative-readout').textContent=`位置差 xB − xA = ${relative>0?'+':''}${fmt(relative)} m` ;for(const key of ['A','B']){const obj=state[key],prefix=key.toLowerCase(),position=P.position(obj,t);const signed=value=>Math.abs(value)<.00001?fmt(0):(value>0?'+':'')+fmt(value);$(prefix+'-position').textContent=signed(position);$(prefix+'-displacement').textContent=signed(position-obj.x);$(prefix+'-velocity').textContent=signed(P.velocity(obj,t));} $('play').innerHTML=state.playing?'Ⅱ &nbsp;暂停':'▶ &nbsp;播放';$('timeline').max=state.duration;$('timeline').value=t;$('duration-label').textContent=`${fmt(t)} / ${nice(state.duration)} s`;drawTrack();plot($('position-chart'),'x');plot($('velocity-chart'),'v');renderResults();}
$('params-reset').addEventListener('click',()=>{if(state.scope==='general')resetGeneral();else loadPreset();});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>selectMode(b.dataset.mode)));
document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>showTheme(b.dataset.theme)));
document.querySelectorAll('[data-scope]').forEach(b=>b.addEventListener('click',()=>{state.scope=b.dataset.scope;state.category='';state.presetId='';state.resultFilter='';populateGroups();}));
$('category').addEventListener('change',e=>{state.category=e.target.value;state.presetId='';state.resultFilter='';populateMoreExamples();});
$('result-filter').addEventListener('change',e=>{state.resultFilter=e.target.value;state.presetId='';populateMoreExamples();});
$('preset').addEventListener('change',e=>{state.presetId=e.target.value;loadPreset();});
$('play').addEventListener('click',()=>{if(state.time>=state.duration)state.time=0;state.playing=!state.playing;state.last=null;refresh();});$('reset').addEventListener('click',()=>{state.time=0;state.playing=false;state.last=null;refresh();});$('timeline').addEventListener('pointerdown',()=>{timelineDragging=true;});window.addEventListener('pointerup',()=>{timelineDragging=false;});window.addEventListener('pointercancel',()=>{timelineDragging=false;});$('timeline').addEventListener('input',e=>{let time=Number(e.target.value);if(timelineDragging&&$('timeline-enabled').checked&&timelinePoints.length){const width=e.target.getBoundingClientRect().width,threshold=state.duration*Math.min(.025,12/Math.max(width-20,1));const nearest=timelinePoints.reduce((a,b)=>Math.abs(b.t-time)<Math.abs(a.t-time)?b:a);if(Math.abs(nearest.t-time)<=threshold)time=nearest.t;}state.time=time;state.playing=false;state.last=null;refresh();});$('timeline-enabled').addEventListener('change',refresh);$('show-uniform').checked=showUniform;$('show-uniform').addEventListener('change',e=>{showUniform=e.target.checked;try{localStorage.setItem('motion-show-uniform',String(showUniform));}catch(_){}if(state.mode==='more'){const oldId=state.presetId,oldA={...state.A},oldB={...state.B},oldTime=state.time,oldDuration=state.duration,oldPlaying=state.playing;populateGroups();if(state.presetId===oldId){state.A=oldA;state.B=oldB;state.time=oldTime;state.duration=oldDuration;state.playing=oldPlaying;state.last=null;renderParams();refresh();}}});$('settings-open').addEventListener('click',()=>$('settings-dialog').showModal());$('settings-dialog').addEventListener('click',e=>{if(e.target===$('settings-dialog'))$('settings-dialog').close();});let timer;window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(refresh,80);});function tick(now){if(state.playing){if(state.last!==null)state.time=Math.min(state.duration,state.time+(now-state.last)/1000);state.last=now;if(state.time>=state.duration){state.playing=false;state.last=null;}refresh();}requestAnimationFrame(tick);}selectMode('typical');requestAnimationFrame(tick);
})();
