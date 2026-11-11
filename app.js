(() => {
'use strict';
const $ = id => document.getElementById(id);
const P = window.Physics, all = window.Presets.list;
const fields = window.Presets.labels.fields;
let showUniform = true;
try { showUniform = localStorage.getItem('motion-show-uniform') !== 'false'; } catch (_) {}
let state = {scope:'pursuit', dimension:'group', category:'', presetId:'', A:{x:0,v:8,a:0,stop:false}, B:{x:6,v:4,a:1,stop:false}, duration:18, time:0, playing:false, last:null};
const ordered = (key,scope,values) => {
 const preferred = key==='group' ? [] : key==='process' || key==='result' ? (Presets.labels[key]||[]) : (Presets.labels[scope]||{})[key] || [];
 return [...preferred.filter(v=>values.includes(v)),...values.filter(v=>!preferred.includes(v))];
};
function baseList(){return all.filter(p=>p.scope===state.scope && (showUniform || !(p.scope==='pursuit' && p.group==='匀速追匀速')));}
function options(select,items,value,display=x=>x){select.replaceChildren(...items.map(x=>{const op=document.createElement('option');op.value=x;op.textContent=display(x);return op;}));select.value=items.includes(value)?value:(items[0]||'');return select.value;}
function populateDimensions(){const keys=state.scope==='meeting'?['group','advantage','phase','process','result']:['group','initial','advantage','process','result'];state.dimension=options($('dimension'),keys,state.dimension,k=>state.scope==='meeting'&&k==='advantage'?'按靠近速度变化分':fields[k]);populateCategories();}
function populateCategories(){const list=baseList(),vals=[...new Set(list.map(p=>p[state.dimension]))];state.category=options($('category'),ordered(state.dimension,state.scope,vals),state.category);populatePresets();}
function populatePresets(){const list=baseList().filter(p=>p[state.dimension]===state.category);const ids=list.map(p=>p.id);state.presetId=options($('preset'),ids,state.presetId,id=>{const p=list.find(v=>v.id===id); return state.scope==='pursuit' ? `${p.group} · ${p.initial} · ${p.process} · ${p.result}` : `${p.group} · ${p.phase} · ${p.result}`;});loadPreset();}
function loadPreset(){const p=all.find(p=>p.id===state.presetId);if(!p)return;$('preset-selected').textContent=$('preset').selectedOptions[0]?.textContent||p.title;state.A={...p.A};state.B={...p.B};state.duration=p.duration;state.time=0;state.playing=false;state.last=null;$('preset-description').textContent=state.scope==='pursuit'?'A 在后，B 在前；两者初始都向右运动。':'A 向右、B 向左；两者开始时相向运动。';$('model-note').textContent='分类是预设的观察入口；调整参数后，初速度比较、间距变化或相遇结果可能改变。减速物体到零后停住。';renderParams();refresh();}
function selectScope(scope){state.scope=scope;state.time=0;state.playing=false;state.last=null;state.category='';state.presetId='';document.querySelectorAll('[data-scope]').forEach(b=>b.classList.toggle('selected',b.dataset.scope===scope));$('classification').hidden=scope==='general';$('general-note').hidden=scope!=='general';if(scope==='general'){state.A={x:0,v:8,a:0,stop:false};state.B={x:30,v:-4,a:0,stop:false};state.duration=5;$('model-note').textContent='通用模式持续按匀变速直线运动计算：速度经过零后可反向，不会自动停车。';renderParams();refresh();}else{state.dimension='group';populateDimensions();}}
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
 const kinds=!general&&preset?preset.group.replace(/相向$/,'').split(state.scope==='pursuit'?'追':'与'):[];
 if(!general){const box=document.createElement('div');box.className='param-group';const heading=document.createElement('div');heading.className='param-title';heading.textContent='初始位置';box.append(heading);paramRow(box,'B','x','两物体初始间距 d（m）',0,200,.1);root.append(box);}
 for(const [id,name,color,i] of [['A','A 物体','purple',0],['B','B 物体','green',1]]){
  const group=document.createElement('div');group.className='param-group';const heading=document.createElement('div');heading.className='param-title';const role=state.scope==='pursuit'?(id==='A'?' · 追赶者':' · 被追赶者'):'';heading.innerHTML=`<i class="dot ${color}"></i>${name}${role}`;group.append(heading);
  if(general){paramRow(group,id,'x','初始位置 x₀（m）',-100,100,1,true);paramRow(group,id,'v','初速度 v₀（m/s）',-30,30,.5,true);paramRow(group,id,'a','加速度 a（m/s²）',-5,5,.1,true);}
  else{
   const direction=state.scope==='meeting'&&id==='B'?-1:1;const kind=kinds[i];
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
  const labelA=state.scope==='pursuit'?'A 追':'A', labelB=state.scope==='pursuit'?'B 被追':'B';
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
function refresh(){if(state.scope!=='general')$('preset-description').textContent=Math.abs(state.B.x-state.A.x)<1e-8?(state.scope==='pursuit'?'A、B 从同一位置出发；初始都向右运动。':'A、B 从同一位置出发；A 向右、B 向左运动。'):(state.scope==='pursuit'?'A 在后，B 在前；两者初始都向右运动。':'A 向右、B 向左；两者开始时相向运动。');const t=state.time; $('time-readout').innerHTML=`${fmt(t)} <em>s</em>`;const relative=P.position(state.B,t)-P.position(state.A,t);$('distance-readout').innerHTML=`${fmt(Math.abs(relative))} <em>m</em>`;$('relative-readout').textContent=`位置差 xB − xA = ${relative>0?'+':''}${fmt(relative)} m` ;for(const key of ['A','B']){const obj=state[key],prefix=key.toLowerCase(),position=P.position(obj,t);const signed=value=>Math.abs(value)<.00001?fmt(0):(value>0?'+':'')+fmt(value);$(prefix+'-position').textContent=signed(position);$(prefix+'-displacement').textContent=signed(position-obj.x);$(prefix+'-velocity').textContent=signed(P.velocity(obj,t));} $('play').innerHTML=state.playing?'Ⅱ &nbsp;暂停':'▶ &nbsp;播放';$('timeline').max=state.duration;$('timeline').value=t;$('duration-label').textContent=`${fmt(t)} / ${nice(state.duration)} s`;drawTrack();plot($('position-chart'),'x');plot($('velocity-chart'),'v');renderResults();}
$('dimension').addEventListener('change',e=>{state.dimension=e.target.value;state.category='';state.presetId='';populateCategories();});$('category').addEventListener('change',e=>{state.category=e.target.value;state.presetId='';populatePresets();});$('preset').addEventListener('change',e=>{state.presetId=e.target.value;loadPreset();});document.querySelectorAll('[data-scope]').forEach(b=>b.addEventListener('click',()=>selectScope(b.dataset.scope)));$('play').addEventListener('click',()=>{if(state.time>=state.duration)state.time=0;state.playing=!state.playing;state.last=null;refresh();});$('reset').addEventListener('click',()=>{state.time=0;state.playing=false;state.last=null;refresh();});$('timeline').addEventListener('input',e=>{state.time=Number(e.target.value);state.playing=false;state.last=null;refresh();});$('show-uniform').checked=showUniform;$('show-uniform').addEventListener('change',e=>{showUniform=e.target.checked;try{localStorage.setItem('motion-show-uniform',String(showUniform));}catch(_){}if(state.scope!=='general'){const oldId=state.presetId, oldA={...state.A},oldB={...state.B},oldTime=state.time,oldDuration=state.duration,oldPlaying=state.playing;populateDimensions();if(state.presetId===oldId){state.A=oldA;state.B=oldB;state.time=oldTime;state.duration=oldDuration;state.playing=oldPlaying;state.last=null;renderParams();refresh();}}});$('settings-open').addEventListener('click',()=>$('settings-dialog').showModal());$('settings-dialog').addEventListener('click',e=>{if(e.target===$('settings-dialog'))$('settings-dialog').close();});let timer;window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(refresh,80);});function tick(now){if(state.playing){if(state.last!==null)state.time=Math.min(state.duration,state.time+(now-state.last)/1000);state.last=now;if(state.time>=state.duration){state.playing=false;state.last=null;}refresh();}requestAnimationFrame(tick);}selectScope('pursuit');requestAnimationFrame(tick);
})();
