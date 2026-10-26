const $=s=>document.querySelector(s), canvas=$('#canvas'), video=$('#video'),status=$('#status'),badge=$('#badge');
const gl=canvas.getContext('webgl',{alpha:false,antialias:false});
if(!gl){status.textContent='浏览器未启用 WebGL，请换用支持硬件加速的浏览器。';$('#start').disabled=true;throw Error('WebGL unavailable');}
const vert=`attribute vec2 a;varying vec2 uv;void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}`;
const frag=`precision highp float;varying vec2 uv;uniform sampler2D water,cam;uniform vec2 px,view,videoSize;uniform float time,hasCam,refract,particleMix;uniform vec3 fingers[6];uniform vec4 faceBox;uniform float faceFound;uniform vec2 handJoints[21];uniform float handFound;
float h(vec2 p){return texture2D(water,clamp(p,0.,1.)).r;}
float bump(vec2 p){float z=0.;for(int i=0;i<6;i++){vec2 d=(p-fingers[i].xy)*vec2(view.x/view.y,1.);z+=exp(-dot(d,d)/.0028)*fingers[i].z;}return z;}
vec3 scene(vec2 p){if(hasCam>.5){vec2 q=vec2(1.-p.x,1.-p.y);float a=view.x/view.y,b=videoSize.x/videoSize.y;if(a>b)q.y=(q.y-.5)*b/a+.5;else q.x=(q.x-.5)*a/b+.5;return texture2D(cam,clamp(q,.001,.999)).rgb;}float glow=exp(-length((p-vec2(.70,.60))*vec2(1.,1.5))*3.);float streak=sin(p.x*19.+p.y*8.+sin(p.y*9.+time*.12)*2.)*.5+.5;vec3 col=mix(vec3(.035,.13,.12),vec3(.34,.48,.32),glow);col+=vec3(.15,.19,.07)*pow(streak,14.)*.55;col+=vec3(.18,.27,.18)*exp(-pow(p.y-.25-sin(p.x*4.)*.05,2.)/.003);return col;}
float faceMask(vec2 p){
 vec2 center=(faceBox.xy+faceBox.zw)*.5;
 vec2 halfSize=max((faceBox.zw-faceBox.xy)*.5,vec2(.001));
 vec2 d=abs((p-center)/halfSize);
 return 1.-smoothstep(.85,1.,max(d.x,d.y));
}
float capsule(vec2 p,vec2 a,vec2 b,float radius){
 vec2 d=b-a;float t=clamp(dot(p-a,d)/max(dot(d,d),.000001),0.,1.);
 float distance=length(p-a-d*t);
 return 1.-smoothstep(radius,radius+.008,distance);
}
float handMask(vec2 p){
 if(handFound<.5)return 0.;
 vec2 aspect=vec2(view.x/view.y,1.);p*=aspect;
 float palmWidth=length((handJoints[5]-handJoints[17])*aspect);
 float radius=max(.012,palmWidth*.16);
 float mask=0.;
 for(int i=1;i<21;i++){
  vec2 root=handJoints[i-1];
  if(i==1||i==5||i==9||i==13||i==17)root=handJoints[0];
  mask=max(mask,capsule(p,root*aspect,handJoints[i]*aspect,radius));
 }
 // Fill the palm with overlapping bands from the wrist to the knuckle row.
 for(int i=0;i<5;i++){
  float t=float(i)/4.;
  vec2 knuckle=mix(handJoints[5],handJoints[17],t)*aspect;
  mask=max(mask,capsule(p,handJoints[0]*aspect,knuckle,radius*1.55));
 }
 return mask;
}
void main(){
 float e=.003;
 vec2 grad=vec2(h(uv+vec2(px.x,0.))-h(uv-vec2(px.x,0.)),h(uv+vec2(0.,px.y))-h(uv-vec2(0.,px.y)))*2.;
 vec2 bg=vec2(bump(uv+vec2(e,0.))-bump(uv-vec2(e,0.)),bump(uv+vec2(0.,e))-bump(uv-vec2(0.,e)));
 grad+=bg*1.7;
 vec2 offset=clamp(grad*.23*refract,vec2(-.12),vec2(.12));
 // Protect both destination and source face pixels. Fall back to undistorted video when tracking is lost.
 float protect=hasCam>.5?(faceFound>.5&&handFound>.5?max(max(faceMask(uv),faceMask(uv+offset)),max(handMask(uv),handMask(uv+offset))):1.):0.;
 float waterAmount=(1.-particleMix)*(1.-protect);
 vec2 q=uv+offset*waterAmount;
 vec3 col=scene(q);
 vec3 n=normalize(vec3(-grad*14.,1.));
 float spec=pow(max(dot(reflect(normalize(vec3(-.6,.8,-1.)),n),vec3(0.,0.,1.)),0.),28.);
 float edge=pow(clamp(length(grad)*3.3,0.,1.),2.);
 col+=vec3(.8,.9,.72)*spec*.6*waterAmount;
 col+=edge*.20*waterAmount;col*=1.-edge*.16*waterAmount;
 float vig=1.-.17*dot(uv-.5,uv-.5);
 gl_FragColor=vec4(mix(col*vig,scene(uv),protect),1.);
}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,vert));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);
const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
const loc={};for(const s of ['water','cam','px','view','videoSize','time','hasCam','refract','fingers','particleMix','faceBox','faceFound','handJoints','handFound'])loc[s]=gl.getUniformLocation(prog,s);
function texture(unit){gl.activeTexture(gl.TEXTURE0+unit);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
const W=192,H=128,water=texture(0),cam=texture(1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));gl.uniform1i(loc.water,0);gl.uniform1i(loc.cam,1);gl.uniform2f(loc.px,1/W,1/H);
let cur=new Float32Array(W*H),prev=new Float32Array(W*H),next=new Float32Array(W*H);const pixels=new Uint8Array(W*H*4),fingers=new Float32Array(18);let faceDetector,lastFaceDetect=-1000,faceSeenAt=-10000;const faceBox=new Float32Array(4),handJoints=new Float32Array(42);let handSeenAt=-10000;let oldPoints=[],stream,landmarker,running=false,starting=false,lastVideo=-1,lastDetect=0,simTime=0,frameTime=performance.now(),pointer=null;
// Particles are an independent transparent layer; camera geometry stays untouched.
const particleCanvas=document.createElement('canvas');
particleCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
particleCanvas.setAttribute('aria-hidden','true');canvas.after(particleCanvas);
const ctx=particleCanvas.getContext('2d');
let fist=false,gestureMix=0,gestureVotes=0,lastHandSeen=0,releaseAt=-10000;
let fistCenter=[.5,.5];
const motes=Array.from({length:480},(_,i)=>({
 x:Math.random(),y:Math.random(),seed:Math.random()*Math.PI*2,
 radius:.65+Math.random()*1.5,orbit:.065+Math.random()*.17,
 inner:i<300,homeX:Math.random(),homeY:Math.random()
}));
function updateGesture(points,now){
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
 const palm=Math.max(.025,dist(points[0],points[9]));
 // Curled fingertips approach the wrist relative to palm size.
 const ratios=[8,12,16,20].map(i=>dist(points[i],points[0])/palm);
 const curled=ratios.filter(r=>r<(fist?1.65:1.40)).length>=3;
 gestureVotes=curled?Math.min(4,gestureVotes+1):Math.max(-4,gestureVotes-1);
 const next=gestureVotes>=3?true:gestureVotes<=-3?false:fist;
 const mapped=[0,5,9,13,17].map(i=>mapPoint(points[i]));
 const center=[mapped.reduce((a,p)=>a+p[0],0)/5,mapped.reduce((a,p)=>a+p[1],0)/5];
 if(!lastHandSeen)fistCenter=center;
 else fistCenter=fistCenter.map((v,i)=>v+(center[i]-v)*.48);
 lastHandSeen=now;
 if(next!==fist){
  fist=next;
  if(fist){
   motes.forEach((p,i)=>{const f=i%6;p.x=fingers[f*3]+(Math.random()-.5)*.22;p.y=fingers[f*3+1]+(Math.random()-.5)*.22;p.homeX=p.x;p.homeY=p.y;});
  }else{
   releaseAt=now;
   for(let i=0;i<10;i++){const a=i*Math.PI/5;disturb(fistCenter[0]+Math.cos(a)*.045,fistCenter[1]+Math.sin(a)*.045,.35);}
  }
 }
}
function paintParticles(now,dt){
 if(now-lastHandSeen>550){fist=false;gestureVotes=0;}
 gestureMix+=(Number(fist)-gestureMix)*(1.-Math.exp(-dt/240));
 if(particleCanvas.width!==canvas.width||particleCanvas.height!==canvas.height){particleCanvas.width=canvas.width;particleCanvas.height=canvas.height;}
 const w=particleCanvas.width,h=particleCanvas.height,aspect=w/h;
 ctx.clearRect(0,0,w,h);
 if(gestureMix<.005)return;
 const blend=1.-Math.exp(-dt/140),t=now/1000;
 ctx.fillStyle='#fff';ctx.shadowColor='rgba(255,255,255,.65)';ctx.shadowBlur=5;
 motes.forEach((p,i)=>{
  let tx,ty;
  const a=p.seed+t*(p.inner?.22:.45);
  if(fist){
   if(p.inner){
    // Compact cloud reads as particles gathered in the closed hand.
    const r=.047*Math.sqrt((i%300+.5)/300);
    tx=fistCenter[0]+Math.cos(p.seed*17.)*r/aspect;
    ty=fistCenter[1]+Math.sin(p.seed*17.)*r*.85;
   }else{
    tx=fistCenter[0]+Math.cos(a)*p.orbit/aspect;
    ty=fistCenter[1]+Math.sin(a)*p.orbit*.78;
   }
  }else{
   const spread=Math.min(1,(now-releaseAt)/700);
   tx=fistCenter[0]+Math.cos(p.seed)*(p.orbit+spread*.25)/aspect;
   ty=fistCenter[1]+Math.sin(p.seed)*(p.orbit+spread*.25);
  }
  p.x+=(tx-p.x)*blend;p.y+=(ty-p.y)*blend;
  const twinkle=.65+.35*Math.sin(t*2.1+p.seed);
  ctx.globalAlpha=gestureMix*(p.inner?.9:.7)*twinkle;
  ctx.beginPath();ctx.arc(p.x*w,(1.-p.y)*h,p.radius*Math.min(devicePixelRatio,1.5),0,Math.PI*2);ctx.fill();
 });
 ctx.globalAlpha=1;ctx.shadowBlur=0;
}
function disturb(x,y,force){const cx=x*(W-1),cy=y*(H-1),r=4;for(let j=Math.max(1,Math.floor(cy-r));j<Math.min(H-1,cy+r);j++)for(let i=Math.max(1,Math.floor(cx-r));i<Math.min(W-1,cx+r);i++){const d=((i-cx)**2+(j-cy)**2)/r**2;if(d<1)cur[j*W+i]+=Math.exp(-d*5)*force;}}
function drive(points){const strength=+$('#strength').value;points.forEach((p,i)=>{const old=oldPoints[i]||p;const speed=Math.min(.07,Math.hypot(p[0]-old[0],p[1]-old[1]));const steps=Math.min(12,Math.max(1,Math.ceil(speed*200)));for(let step=1;step<=steps;step++)disturb(old[0]+(p[0]-old[0])*step/steps,old[1]+(p[1]-old[1])*step/steps,(.012+speed*3)*strength/steps);fingers[i*3]=p[0];fingers[i*3+1]=p[1];fingers[i*3+2]=Math.min(1,fingers[i*3+2]+.18);});for(let i=points.length;i<6;i++)fingers[i*3+2]*=.8;oldPoints=points;}
function mapPoint(p){let x=1-p.x,y=1-p.y;const a=canvas.width/canvas.height,b=video.videoWidth/video.videoHeight;if(a>b)y=(y-.5)*a/b+.5;else x=(x-.5)*b/a+.5;return [x,y];}
function updateFace(now){
 if(!faceDetector||now-lastFaceDetect<85||video.readyState<2)return;
 lastFaceDetect=now;
 const result=faceDetector.detectForVideo(video,now);
 if(!result.detections.length)return;
 const box=result.detections[0].boundingBox;
 if(!box)return;
 const p1=mapPoint({x:box.originX/video.videoWidth,y:box.originY/video.videoHeight});
 const p2=mapPoint({x:(box.originX+box.width)/video.videoWidth,y:(box.originY+box.height)/video.videoHeight});
 const left=Math.min(p1[0],p2[0]),right=Math.max(p1[0],p2[0]);
 const bottom=Math.min(p1[1],p2[1]),top=Math.max(p1[1],p2[1]);
 // Padding protects forehead, jaw and small detection delays without a visible frame.
 const padX=(right-left)*.35,padY=(top-bottom)*.45;
 faceBox.set([left-padX,bottom-padY,right+padX,top+padY]);faceSeenAt=now;
}
function tick(now){const dt=Math.min(50,Math.max(1,now-frameTime));requestAnimationFrame(tick);const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,1.5),cw=Math.round(rect.width*dpr),ch=Math.round(rect.height*dpr);if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;gl.viewport(0,0,cw,ch);}
if(running&&landmarker&&video.readyState>=2&&now-lastDetect>45&&lastVideo!==video.currentTime){lastDetect=now;lastVideo=video.currentTime;try{updateFace(now);const result=landmarker.detectForVideo(video,now);if(result.landmarks.length){const p=result.landmarks[0];p.forEach((point,i)=>{const mapped=mapPoint(point);handJoints[i*2]=mapped[0];handJoints[i*2+1]=mapped[1];});handSeenAt=now;updateGesture(p,now);drive([4,8,12,16,20,9].map(i=>mapPoint(p[i])));badge.textContent='● 已识别手掌';status.textContent=(fist?'握拳聚粒 · 张手释放水波':'张手拨水 · 握拳收拢粒子')+(now-faceSeenAt<500?' · 手脸保护中':' · 请面向镜头以开启折射');}else{oldPoints=[];badge.textContent='○ 寻找手掌';status.textContent='请把张开的手掌放在镜头前';for(let i=0;i<6;i++)fingers[i*3+2]*=.8;}}catch(e){status.textContent='手势追踪中断，请关闭摄像头后重试';console.error(e);stopCamera();}}
if(!running){if(pointer)drive([pointer]);else{oldPoints=[];for(let i=0;i<6;i++)fingers[i*3+2]*=.92;}}
simTime+=Math.min(now-frameTime,50);frameTime=now;let steps=0;while(simTime>16.67&&steps++<3){for(let j=1;j<H-1;j++)for(let i=1;i<W-1;i++){const k=j*W+i;next[k]=((cur[k-1]+cur[k+1]+cur[k-W]+cur[k+W])*.5-prev[k])*.985;}[prev,cur,next]=[cur,next,prev];simTime-=16.67;}
for(let i=0;i<cur.length;i++){pixels[i*4]=Math.round(Math.max(0,Math.min(255,128+cur[i]*110)));pixels[i*4+3]=255;}
gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,water);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
if(running&&video.readyState>=2){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,cam);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);}
paintParticles(now,dt);gl.uniform1f(loc.particleMix,gestureMix);gl.uniform4fv(loc.faceBox,faceBox);gl.uniform2fv(loc.handJoints,handJoints);gl.uniform1f(loc.handFound,now-handSeenAt<250?1:0);gl.uniform1f(loc.faceFound,now-faceSeenAt<500?1:0);gl.uniform1f(loc.time,now/1000);gl.uniform1f(loc.hasCam,running?1:0);gl.uniform1f(loc.refract,+$('#refraction').value);gl.uniform2f(loc.view,cw,ch);gl.uniform2f(loc.videoSize,video.videoWidth||1280,video.videoHeight||720);gl.uniform3fv(loc.fingers,fingers);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
requestAnimationFrame(tick);
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();pointer=[(e.clientX-r.left)/r.width,1-(e.clientY-r.top)/r.height];});canvas.addEventListener('pointerleave',()=>pointer=null);
$('#demo').onclick=()=>{$('#welcome').hidden=true;$('#start').classList.add('retry');$('#stage').append($('#start'));$('#start').textContent='开启摄像头 ↗';};
function stopCamera(){handSeenAt=-10000;faceSeenAt=-10000;fist=false;gestureVotes=0;lastHandSeen=0;running=false;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;oldPoints=[];fingers.fill(0);$('#stop').hidden=true;$('#start').hidden=false;badge.textContent='● 鼠标体验';}
$('#stop').onclick=()=>{stopCamera();status.textContent='摄像头已关闭，可继续用鼠标拨动水面';};
$('#start').onclick=async()=>{if(starting)return;starting=true;$('#start').disabled=true;$('#start').textContent='正在开启…';try{if(!navigator.mediaDevices?.getUserMedia)throw Error('请在 HTTPS 或 localhost 地址打开此页面');status.textContent='请允许浏览器使用摄像头';stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false});video.srcObject=stream;await video.play();status.textContent='正在加载手部识别模型，首次可能需要一些时间…';if(!landmarker){const {HandLandmarker,FaceDetector,FilesetResolver}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');const base={baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.5,minTrackingConfidence:.5};try{landmarker=await HandLandmarker.createFromOptions(vision,{...base,baseOptions:{...base.baseOptions,delegate:'GPU'}});}catch{landmarker=await HandLandmarker.createFromOptions(vision,base);}}if(!faceDetector){status.textContent='正在加载面部保护模型…';const {FaceDetector,FilesetResolver}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');faceDetector=await FaceDetector.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'},runningMode:'VIDEO',minDetectionConfidence:.5});}faceSeenAt=-10000;lastFaceDetect=-1000;running=true;pointer=null;lastVideo=-1;$('#welcome').hidden=true;$('#stage').append($('#start'));$('#start').classList.add('retry');$('#start').hidden=true;$('#stop').hidden=false;status.textContent='张开手掌，在镜头前慢慢移动';stream.getVideoTracks()[0].addEventListener('ended',()=>{stopCamera();status.textContent='摄像头连接已结束，点击按钮重新开启';});}catch(e){stopCamera();const msg=e.name==='NotAllowedError'?'摄像头权限未开启，请在浏览器地址栏允许摄像头后重试。':e.name==='NotFoundError'?'没有找到摄像头，请连接摄像头后重试。':e.name==='NotReadableError'?'摄像头可能被其他程序占用，请关闭占用程序后重试。':'启动失败：'+e.message+'。请检查网络后重试。';status.textContent=msg;}finally{starting=false;$('#start').disabled=false;$('#start').textContent='开启摄像头 ↗';}};
$('#reset').onclick=()=>{cur.fill(0);prev.fill(0);next.fill(0);oldPoints=[];fingers.fill(0);};$('#fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else $('#stage').requestFullscreen().catch(()=>{status.textContent='当前浏览器不支持全屏';});};window.addEventListener('pagehide',()=>stream?.getTracks().forEach(t=>t.stop()));
