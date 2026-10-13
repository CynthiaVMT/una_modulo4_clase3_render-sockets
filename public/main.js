// Isla de golosinas colaborativa — mundo Blender + avioneta por persona + golosinas colocables.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

window.addEventListener("error", (e)=>{ window.__golErr = (e.error && (e.error.stack||e.error.message)) || (e.message||String(e)); });
window.addEventListener("unhandledrejection", (e)=>{ window.__golErr = "rej:" + String((e.reason&&(e.reason.stack||e.reason.message))||e.reason); });

const CLAVES = [
  { h: 0.0,  cenit:"#0a1234", horizonte:"#1d2755", sol:"#9fb6ff", solI:0.12, amb:0.42, niebla:"#1b2450", estrellas:1.0 },
  { h: 4.8,  cenit:"#16204a", horizonte:"#3d3a72", sol:"#a8bcff", solI:0.16, amb:0.46, niebla:"#2c3160", estrellas:0.9 },
  { h: 5.9,  cenit:"#4b5a9e", horizonte:"#f0a58e", sol:"#ffb27a", solI:0.95, amb:0.92, niebla:"#d8aaa4", estrellas:0.22 },
  { h: 7.4,  cenit:"#5aa6e2", horizonte:"#ffd7b4", sol:"#ffdcab", solI:1.75, amb:1.00, niebla:"#d5e8f6", estrellas:0.0 },
  { h: 12.5, cenit:"#3d8ee2", horizonte:"#d2ecff", sol:"#fff6e8", solI:2.35, amb:1.12, niebla:"#e1f1ff", estrellas:0.0 },
  { h: 16.4, cenit:"#3f8de0", horizonte:"#dbedf9", sol:"#fff0d6", solI:2.00, amb:1.02, niebla:"#e1f1ff", estrellas:0.0 },
  { h: 17.6, cenit:"#5c86d8", horizonte:"#ffc48c", sol:"#ffc078", solI:1.45, amb:0.92, niebla:"#f0d0a8", estrellas:0.0 },
  { h: 18.5, cenit:"#4d4a92", horizonte:"#ff9a63", sol:"#ff9a5c", solI:0.85, amb:0.84, niebla:"#dc9a80", estrellas:0.05 },
  { h: 19.6, cenit:"#22265c", horizonte:"#7a4f7c", sol:"#b0a0ff", solI:0.20, amb:0.52, niebla:"#3c3564", estrellas:0.45 },
  { h: 21.0, cenit:"#141d49", horizonte:"#3d3269", sol:"#a4b9ff", solI:0.14, amb:0.46, niebla:"#31325e", estrellas:0.75 },
  { h: 24.0, cenit:"#0a1234", horizonte:"#1d2755", sol:"#9fb6ff", solI:0.12, amb:0.42, niebla:"#1b2450", estrellas:1.0 },
];
const _c1=new THREE.Color(), _c2=new THREE.Color();
function mezclarColor(d,a,b,t){ _c1.set(a); _c2.set(b); d.copy(_c1).lerp(_c2,t); return d; }
function cieloEnHora(hora){ let i=0; while(i<CLAVES.length-2 && hora>CLAVES[i+1].h) i++;
  const a=CLAVES[i], b=CLAVES[i+1], t=THREE.MathUtils.clamp((hora-a.h)/(b.h-a.h),0,1), s=THREE.MathUtils.smoothstep(t,0,1);
  return { cenit:mezclarColor(new THREE.Color(),a.cenit,b.cenit,s), horizonte:mezclarColor(new THREE.Color(),a.horizonte,b.horizonte,s),
    sol:mezclarColor(new THREE.Color(),a.sol,b.sol,s), niebla:mezclarColor(new THREE.Color(),a.niebla,b.niebla,s),
    solI:THREE.MathUtils.lerp(a.solI,b.solI,s), amb:THREE.MathUtils.lerp(a.amb,b.amb,s), estrellas:THREE.MathUtils.lerp(a.estrellas,b.estrellas,s) }; }

const contenedor=document.getElementById("escena");
const renderer=new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(window.innerWidth, window.innerHeight); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12; renderer.outputColorSpace=THREE.SRGBColorSpace;
contenedor.appendChild(renderer.domElement);
const escena=new THREE.Scene(); escena.fog=new THREE.FogExp2(new THREE.Color("#dcefff"), 0.006);
const camara=new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 3000); camara.position.set(11.5,7.6,13.8);
const controles=new OrbitControls(camara, renderer.domElement);
controles.target.set(0,0.9,0); controles.enableDamping=true; controles.dampingFactor=0.06; controles.minDistance=6; controles.maxDistance=46;
controles.maxPolarAngle=Math.PI*0.56; controles.autoRotate=true; controles.autoRotateSpeed=0.55;

const sol=new THREE.DirectionalLight("#fff3dd",2); sol.castShadow=true; sol.shadow.mapSize.set(2048,2048); escena.add(sol); escena.add(sol.target);
const luna=new THREE.DirectionalLight("#c4d4ff",0.3); escena.add(luna);
const ambiente=new THREE.HemisphereLight("#cfe6ff","#86c98c",0.9); escena.add(ambiente);

const uniformesCielo={ uCenit:{value:new THREE.Color("#3d8ee2")}, uHorizonte:{value:new THREE.Color("#d2ecff")}, uSuelo:{value:new THREE.Color("#87b0d8")},
  uColorSol:{value:new THREE.Color("#fff6e8")}, uDirSol:{value:new THREE.Vector3(0,1,0)}, uDirLuna:{value:new THREE.Vector3(0,-1,0)},
  uSolI:{value:1}, uLunaI:{value:0}, uEstrellas:{value:0}, uTiempo:{value:0} };
const vertCielo=`varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const fragCielo=`
  uniform vec3 uCenit; uniform vec3 uHorizonte; uniform vec3 uSuelo; uniform vec3 uColorSol;
  uniform vec3 uDirSol; uniform vec3 uDirLuna; uniform float uSolI; uniform float uLunaI;
  uniform float uEstrellas; uniform float uTiempo; varying vec3 vDir;
  float hash(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
  void main(){
    vec3 d=normalize(vDir); float arriba=clamp(d.y,0.0,1.0);
    vec3 col=mix(uHorizonte,uCenit,pow(arriba,0.55)); col=mix(col,uSuelo,smoothstep(0.0,-0.28,d.y));
    float dsol=max(dot(d,uDirSol),0.0);
    col+=uColorSol*pow(dsol,6.0)*0.16*uSolI; col+=uColorSol*pow(dsol,220.0)*0.55*uSolI; col+=uColorSol*smoothstep(0.99965,0.99985,dsol)*2.6;
    float dluna=max(dot(d,uDirLuna),0.0);
    col+=vec3(0.80,0.86,1.0)*pow(dluna,500.0)*0.35*uLunaI; col+=vec3(0.97,0.98,1.0)*smoothstep(0.99955,0.99985,dluna)*1.5*uLunaI;
    if(uEstrellas>0.002){ vec3 celda=floor(d*240.0); float r=hash(celda); if(r>0.981){ vec3 centro=(celda+0.5)/240.0; float dist=length(d-normalize(centro));
      float tit=0.6+0.4*sin(uTiempo*2.6+r*120.0); float br=1.0-smoothstep(0.0,0.0035,dist); col+=vec3(1.0)*br*tit*uEstrellas*1.7*smoothstep(-0.02,0.3,d.y); } }
    gl_FragColor=vec4(col,1.0); #include <colorspace_fragment>
  }`;
const domoCielo=new THREE.Mesh(new THREE.SphereGeometry(800,48,32), new THREE.ShaderMaterial({ uniforms:uniformesCielo, vertexShader:vertCielo, fragmentShader:fragCielo,
  side:THREE.BackSide, depthWrite:false, depthTest:false, fog:false }));
domoCielo.renderOrder=-1; domoCielo.frustumCulled=false; escena.add(domoCielo);

const mundo=new THREE.Group(); escena.add(mundo); mundo.visible=false;
const vidrios=[]; let modeloMundo=null;

/* ================= IDs / colaboración ================= */
let socket=null;
const miTok = 'c'+Math.random().toString(36).slice(2,7);

/* ================= paleta recoloreada ================= */
const CLAVE_MAT={ techo_frutilla:1, glaseado:1, pared:1, chicle:1, menta:1, limon:1, lila:1, naranja:1, chocolate:1 };
let matsPorClave={};
let paleta={ techo_frutilla:'#e0213d', glaseado:'#fff6e8', pared:'#ffdfc9', chicle:'#ff8fb7', menta:'#6ee7c2', limon:'#ffdd55', lila:'#c8a8ff', naranja:'#ffb04d', chocolate:'#6b4a2e' };
function pinColor(m, hex){ const c=new THREE.Color(hex);
  try{ if(m.color) m.color.copy(c); else if(m.baseColor) m.baseColor.copy(c); }catch(e){}
  try{ if(m.emissive && !/ventana/.test(m.name||'')) m.emissiveIntensity=0; }catch(e){} }
function aplicarPaleta(p){ Object.assign(paleta, p||{});
  for(const cl in matsPorClave){ const hex=paleta[cl]; if(!hex) continue; matsPorClave[cl].forEach(m=>pinColor(m,hex)); } }

/* ================= avioneta (una por usuario) ================= */
function matCandy(hex){ return new THREE.MeshLambertMaterial({ color:new THREE.Color(hex) }); }
function crearNave(){ // avioneta redondeada: fuselaje torneado, alas y cola elipsoidales, cúpula, ruedas e hélice que gira
  const g=new THREE.Group();
  const elip=(sx,sy,sz,col,x,y,z)=>{ const m=new THREE.Mesh(new THREE.SphereGeometry(1,20,14), matCandy(col)); m.scale.set(sx,sy,sz); m.position.set(x,y,z); g.add(m); return m; };
  const perfil=new THREE.SplineCurve([[0,-1.3],[0.1,-1.25],[0.22,-0.95],[0.38,-0.5],[0.45,0],[0.44,0.45],[0.34,0.9],[0.17,1.17],[0,1.26]]
    .map(p=>new THREE.Vector2(Math.max(0.001,p[0]),p[1]))).getPoints(40);
  const fus=new THREE.Mesh(new THREE.LatheGeometry(perfil,28), matCandy("#ff8fb7")); fus.rotation.z=-Math.PI/2; g.add(fus); // eje del fuselaje = +x (nariz)
  elip(0.5,0.07,1.8,"#ffdd55", 0.15,0.02,0);            // alas
  elip(0.3,0.05,0.62,"#6ee7c2", -1.05,0.1,0);           // estabilizador horizontal
  const aleta=elip(0.34,0.3,0.06,"#6ee7c2", -1.05,0.36,0); aleta.rotation.z=0.3; // aleta vertical
  elip(0.3,0.24,0.27,"#c8dfff", 0.28,0.38,0);           // cúpula de la cabina
  elip(0.11,0.11,0.11,"#fff6e8", 0.42,-0.38,0.3); elip(0.11,0.11,0.11,"#fff6e8", 0.42,-0.38,-0.3); // ruedas
  const helice=new THREE.Group(); helice.position.set(1.3,0,0);
  helice.add(new THREE.Mesh(new THREE.SphereGeometry(0.1,12,10), matCandy("#ffffff")));
  for(const a of [0,Math.PI/2]){ const asp=new THREE.Mesh(new THREE.SphereGeometry(1,12,8), matCandy("#ffffff")); asp.scale.set(0.025,0.46,0.09); asp.rotation.x=a; helice.add(asp); }
  g.add(helice); g.userData.helice=helice;
  escena.add(g); g.visible=true; return g;
}
function setNave(g, ang, alto){ g.position.set(Math.cos(ang)*13.5, alto, Math.sin(ang)*13.5); g.rotation.set(0, -ang+Math.PI/2, 0.12*Math.sin(ang*3)); }
const ALT_VUELO=6.2; // altura base del avioncito (más abajo para que se note)
const naves={}; let angPropio=0, velAvion=1.6, miPlanoActivo=true;

/* confites */
const CONFITES_MAX=240; const confites=[];
for(let k=0;k<CONFITES_MAX;k++){ confites.push({ mesh:null, life:0, state:'', t:0, T:1, g:5.5, ph:0, x0:0, y0:0, z0:0, vx:0, vy:0, vz:0, tx:0, tz:0 }); }
const RADIO_CONFITES=4.8; // radio de la isla donde pueden caer
function encConfites(){ if(confites[0].mesh) return; const cs=["#ff8fb7","#ffdd55","#6ee7c2","#c8a8ff","#ff5f8f"];
  for(const c of confites){ const r=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,6), matCandy(cs[Math.floor(Math.random()*5)])); r.visible=false; escena.add(r); c.mesh=r; } }
function tirarConfites(n, centro){
  encConfites(); const p=centro||(naves[miTok]&&naves[miTok].position);
  if(!p) return; const piso=mundo.position.y+0.55; let l=0;
  for(const c of confites){ if(c.life>0||!c.mesh) continue;
    // cada confite sale del avión con un "pop" hacia arriba y cae en un punto distinto, repartido parejo por TODA la isla
    const ang=Math.random()*Math.PI*2, rr=RADIO_CONFITES*Math.sqrt(Math.random());
    c.tx=Math.cos(ang)*rr; c.tz=Math.sin(ang)*rr;
    c.x0=p.x+(Math.random()-0.5)*1.2; c.y0=p.y-0.3; c.z0=p.z+(Math.random()-0.5)*1.2;
    c.T=1.8+Math.random()*1.6; c.t=0; c.g=5.5; c.ph=Math.random()*6.28;
    c.vx=(c.tx-c.x0)/c.T; c.vz=(c.tz-c.z0)/c.T; c.vy=(piso-c.y0+0.5*c.g*c.T*c.T)/c.T; // trayectoria que toca el piso justo en T
    c.mesh.visible=true; c.mesh.position.set(c.x0,c.y0,c.z0);
    c.state='air'; c.life=c.T+3.5; if(++l>=n) break; } }
function actualizarConfites(dt, piso){
  for(const c of confites){ if(!c.mesh||c.life<=0) continue; c.life-=dt;
    if(c.state==='air'){ c.t+=dt; const k=Math.min(c.t,c.T), f=1-k/c.T; // f: el aleteo se apaga al llegar
      c.mesh.position.set(c.x0+c.vx*k+Math.sin(c.t*5+c.ph)*0.25*f, c.y0+c.vy*k-0.5*c.g*k*k, c.z0+c.vz*k+Math.cos(c.t*4+c.ph)*0.25*f);
      c.mesh.rotation.x+=dt*6; c.mesh.rotation.z+=dt*4.8;
      if(c.t>=c.T) c.state='land'; }
    if(c.state==='land') c.mesh.position.set(c.tx,piso,c.tz); // apoyado en la isla, acompaña su vaivén
    if(c.life<=0) c.mesh.visible=false; } }

/* ================= golosinas colocables ================= */
const candies=[]; const grupoCandy=new THREE.Group(); mundo.add(grupoCandy); // hijas de la isla: flotan con ella
function construirGolosina(tipo){
  const g=new THREE.Group(); const c=paleta;
  const con=(geom,matr)=>{ const m=new THREE.Mesh(geom, matr); g.add(m); return m; };
  const BLANCO='#ffffff', CREMA='#fff6e8', CELESTE='#8fd3ff', BEIGE='#e8c9a0', VERDE='#4cc46a';
  if(tipo==='piruleta'){ // blanca con varias líneas rojas (meridianos)
    const palito=con(new THREE.CylinderGeometry(0.06,0.06,1.0,12), matCandy(CREMA)); palito.position.y=0.5;
    const bola=con(new THREE.SphereGeometry(0.4,24,16), matCandy(BLANCO)); bola.position.y=1.2;
    for(const h of [-0.26,-0.13,0,0.13,0.26]){ const lin=con(new THREE.TorusGeometry(Math.sqrt(0.16-h*h)+0.005,0.03,8,40), matCandy(c.techo_frutilla)); lin.rotation.x=Math.PI/2; lin.position.y=1.2+h; } }
  else if(tipo==='gomita'){ // conito lila
    const cono=con(new THREE.ConeGeometry(0.38,0.8,24), matCandy(c.lila)); cono.position.y=0.4;
    const punta=con(new THREE.SphereGeometry(0.07,12,8), matCandy(c.lila)); punta.position.y=0.78; }
  else if(tipo==='algodon'){ // nube blanca
    const col=matCandy(BLANCO); const esf=[[0.5,0,0.25,0],[0.4,0.4,0.4,0],[0.42,-0.35,0.35,0.15],[0.36,0.05,0.7,0.05],[0.3,0.2,0.2,0.4],[0.3,-0.15,0.22,-0.4]];
    for(const [r,x,y,z] of esf){ const s=con(new THREE.SphereGeometry(r,18,12), col); s.position.set(x,y,z); } }
  else if(tipo==='caramelo'){ // pastilla celeste con rosa
    const disco=con(new THREE.CylinderGeometry(0.4,0.4,0.18,32), matCandy(CELESTE)); disco.rotation.x=Math.PI/2; disco.position.y=0.4;
    const banda=con(new THREE.CylinderGeometry(0.41,0.41,0.07,32), matCandy(c.chicle)); banda.rotation.x=Math.PI/2; banda.position.y=0.4;
    const centro=con(new THREE.CylinderGeometry(0.17,0.17,0.2,24), matCandy(c.chicle)); centro.rotation.x=Math.PI/2; centro.position.y=0.4; }
  else if(tipo==='donut'){ // beige con baño de chocolate y chispas
    const base=con(new THREE.TorusGeometry(0.35,0.16,18,32), matCandy(BEIGE)); base.rotation.x=Math.PI/2; base.position.y=0.16;
    const bano=con(new THREE.TorusGeometry(0.35,0.17,18,32), matCandy(c.chocolate)); bano.rotation.x=Math.PI/2; bano.scale.set(1,1,0.55); bano.position.y=0.26;
    const chs=[BLANCO,c.chicle,c.limon,c.menta,CELESTE];
    for(let k=0;k<18;k++){ const a=k*2.399, rr=0.35+((k%3)-1)*0.09, d=rr-0.35;
      const ch=con(new THREE.BoxGeometry(0.1,0.025,0.025), matCandy(chs[k%5]));
      ch.position.set(Math.cos(a)*rr, 0.26+0.094*Math.sqrt(1-(d/0.17)**2)+0.008, Math.sin(a)*rr); ch.rotation.y=k*1.7; } }
  else if(tipo==='hongo'){ // sombrero rojo con puntos blancos
    const tallo=con(new THREE.CylinderGeometry(0.13,0.16,0.5,16), matCandy(CREMA)); tallo.position.y=0.25;
    const som=con(new THREE.SphereGeometry(0.4,24,14,0,Math.PI*2,0,Math.PI/2), matCandy(c.techo_frutilla)); som.position.y=0.45; som.scale.set(1,0.85,1);
    const tapa=con(new THREE.CylinderGeometry(0.4,0.4,0.03,24), matCandy(CREMA)); tapa.position.y=0.45;
    const punto=(phi,th,r)=>{ const p=con(new THREE.SphereGeometry(r,12,8), matCandy(BLANCO)); const s=Math.sin(phi), co=Math.cos(phi);
      p.position.set(0.39*s*Math.cos(th), 0.45+0.4*0.85*co*0.99, 0.39*s*Math.sin(th)); };
    punto(0,0,0.09);
    for(let k=0;k<5;k++){ punto(0.87,(k*72+10)*Math.PI/180,0.07); punto(1.36,(k*72+46)*Math.PI/180,0.06); } }
  else if(tipo==='flor'){ for(let k=0;k<5;k++){ const a=k*Math.PI*2/5; const pet=con(new THREE.SphereGeometry(0.2,14,10), matCandy(c.chicle)); pet.position.set(Math.cos(a)*0.28,0.25,Math.sin(a)*0.28); }
    const cen=con(new THREE.SphereGeometry(0.16,12,8), matCandy(c.limon)); cen.position.y=0.33; }
  else { // tangulu: un solo palito con 4 bolitas (blanco, rosa, verde, amarillo). También es el diseño por defecto: los ids viejos ('pastilla', 'caja') caen acá
    const cols=[BLANCO,c.chicle,VERDE,c.limon], R=0.16, paso=0.34, y0=0.45;
    const pal=con(new THREE.CylinderGeometry(0.04,0.04,y0+paso*3,10), matCandy(CREMA)); pal.position.y=(y0+paso*3)/2;
    cols.forEach((col,i)=>{ const b=con(new THREE.SphereGeometry(R,20,14), matCandy(col)); b.position.y=y0+i*paso; }); }
  return g;
}
const raycaster=new THREE.Raycaster(), _ndc=new THREE.Vector2();
function apuntar(e){ const r=renderer.domElement.getBoundingClientRect();
  _ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1); mundo.updateMatrixWorld(true); raycaster.setFromCamera(_ndc,camara); }
// punto REAL de la isla bajo el mouse, en coordenadas locales del mundo (las golosinas son hijas de "mundo"); null si no apunta a una superficie que mira hacia arriba
function puntoEnIsla(e){ if(!modeloMundo) return null; apuntar(e);
  const hit=raycaster.intersectObject(modeloMundo,true)[0]; if(!hit) return null;
  if(hit.face){ const n=hit.face.normal.clone().transformDirection(hit.object.matrixWorld); if(n.y<0.35) return null; }
  return mundo.worldToLocal(hit.point.clone()); }
function gol2mundo(e){ const p=puntoEnIsla(e); if(!p) return null;
  return { x:p.x, y:p.y+0.01, z:p.z, rot:Math.random()*6.28, scale:0.9+Math.random()*0.35 }; }
// golosina bajo el mouse: primero por impacto directo; si no, la más cercana al punto de la isla (hasta ~0.95)
function candyBajoMouse(e){ apuntar(e);
  const hits=raycaster.intersectObjects(grupoCandy.children,true);
  if(hits.length){ let o=hits[0].object; while(o.parent&&o.parent!==grupoCandy) o=o.parent; const c=candies.find(c=>c.obj===o); if(c) return c.id; }
  const p=puntoEnIsla(e); if(!p) return null;
  const ord=candies.map(c=>({id:c.id,d:(c.obj.position.x-p.x)**2+(c.obj.position.z-p.z)**2})).sort((a,b)=>a.d-b.d);
  return (ord.length&&ord[0].d<0.9)?ord[0].id:null; }
function aplicarCandyObjeto(o){ if(candies.some(c=>c.id===o.id)) return; const g=construirGolosina(o.tipo); g.position.set(o.x,o.y,o.z); g.rotation.y=o.rot||0; const s=o.scale||1; g.scale.set(s,s,s); grupoCandy.add(g); candies.push({id:o.id,obj:g,o}); }
function quitarCandy(id){ const i=candies.findIndex(c=>c.id===id); if(i>=0){ grupoCandy.remove(candies[i].obj); candies.splice(i,1); } }

/* ================= encuadrar ================= */
function encuadrar(){ const a=window.innerWidth/window.innerHeight, distancia=Math.max(17.5,15.0/a);
  const dir=new THREE.Vector3(0.56,0.36,0.74).normalize(); controles.target.set(0,a<1?0.2:0.9,0); camara.position.copy(controles.target).addScaledVector(dir,distancia); controles.update(); }

/* ================= carga GLB ================= */
const carga=document.getElementById("carga"), cargaTexto=document.getElementById("cargaTexto");
new GLTFLoader().load("./assets/mundo.glb", (gltf)=>{
  try{
    const modelo=gltf.scene; modelo.traverse((o)=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; if(o.material) o.material.envMapIntensity=0.35; } });
    const caja=new THREE.Box3().setFromObject(modelo); const centro=caja.getCenter(new THREE.Vector3());
    modelo.position.sub(centro); modelo.position.y+=0.6; mundo.add(modelo); modeloMundo=modelo; mundo.visible=true;
    modelo.traverse((o)=>{ if(!o.isMesh||!o.material) return; const ms=Array.isArray(o.material)?o.material:[o.material];
      ms.forEach((m)=>{ if(/ventana/i.test(m.name)){ m.emissive=new THREE.Color("#ffc46b"); m.emissiveIntensity=0; vidrios.push(m); } }); });
    modelo.traverse((o)=>{ if(!o.isMesh||!o.material) return; const ms=Array.isArray(o.material)?o.material:[o.material];
      ms.forEach((m)=>{ const nm=(m.name||"").toLowerCase(); for(const cl in CLAVE_MAT){ if(nm.indexOf(cl)>=0){ (matsPorClave[cl]=matsPorClave[cl]||[]).push(m); } } }); });
    aplicarPaleta(paleta);
    // avioneta y confites: si falla, NO debe impedir que el mundo aparezca
    try{ naves[miTok]=crearNave(); angPropio=Math.random()*Math.PI*2; setNave(naves[miTok], angPropio, ALT_VUELO); }catch(e){ window.__golErr="aviacion:"+String(e); }
    try{ encConfites(); }catch(e){ window.__golErr="confites:"+String(e); }
  }catch(e){ window.__golErr="glb-cb:"+String(e); }
  carga.classList.add("oculto");
  encuadrar();
}, undefined, (err)=>{
  window.__golErr="glb-error:"+String(err);
  console.error(err);
  carga.classList.add("oculto"); // no dejar la pantalla clavada en "cargando"
  document.querySelector(".spinner").style.display="none";
  const aviso=document.getElementById("cargaTexto");
  aviso.innerHTML="No se cargó el modelo 3D: <b style='color:#ff8fb7'>"+(String(err).slice(0,90))+"</b><br>Recargá (Cmd+Shift+R). Si persiste, revisá la consola (F12).";
});

/* ================= UI panel ================= */
const sliderHora=document.getElementById("hora"), sliderVel=document.getElementById("velocidad"), sliderBrillo=document.getElementById("brillo");
const reloj=document.getElementById("reloj"), iconoTiempo=document.getElementById("iconoTiempo"), girar=document.getElementById("girar");
const planAct=document.getElementById("planAct"), planVel=document.getElementById("planVel"), btnConf=document.getElementById("btnConf");
let hora=parseFloat(sliderHora.value), velocidad=0, brillo=1;
sliderHora.addEventListener("input",()=>{ hora=parseFloat(sliderHora.value); emit({hora}); });
sliderVel.addEventListener("input",()=>{ velocidad=parseFloat(sliderVel.value); emit({velocidad}); });
sliderBrillo.addEventListener("input",()=>{ brillo=parseFloat(sliderBrillo.value); emit({brillo}); });
document.querySelectorAll("#panel .presets button").forEach((b)=>b.addEventListener("click",()=>{ hora=parseFloat(b.dataset.hora); sliderHora.value=hora.toFixed(2); velocidad=0; sliderVel.value="0"; brillo=1; sliderBrillo.value="1"; emit({hora,velocidad:0,brillo:1}); }));
girar.addEventListener("change",()=>{ controles.autoRotate=girar.checked; emit({girar:girar.checked}); });
planAct.addEventListener("change",()=>{ miPlanoActivo=planAct.checked; emit({avion:{activo:miPlanoActivo}}); sendPvuelo(); });
planVel.addEventListener("input",()=>{ velAvion=parseFloat(planVel.value); emit({avion:{velocidad:velAvion}}); });
btnConf.addEventListener("click",()=>{ tirarConfites(60); if(socket) socket.emit("confites"); });
document.querySelectorAll("#panel .mini input[type=color]").forEach((inp)=>{ inp.addEventListener("input",()=>{ const k=inp.dataset.pk, h=inp.value; paleta[k]=h; aplicarPaleta({[k]:h}); emit({paleta:{[k]:h}}); }); });
function iconoDe(h){ if(h<5.2||h>=20.5)return "🌙"; if(h<7.5)return "🌅"; if(h<18)return "☀️"; if(h<20)return "🌇"; return "🌆"; }

/* ================= cajón lateral ================= */
let golHer="mover", golSel=null;
function setGolHer(h){ golHer=h; document.querySelectorAll(".cajon-grid button").forEach(b=>b.classList.remove("act")); document.querySelectorAll(".cajon-her button").forEach(b=>b.classList.remove("on"));
  if(h!=="mover" && h!=="quitar"){ const b=document.querySelector('[data-gol="'+h+'"]'); if(b)b.classList.add("act"); }
  if(h==="mover")document.getElementById("golMover").classList.add("on");
  if(h==="quitar")document.getElementById("golQuitar").classList.add("on"); }
document.querySelectorAll(".cajon-grid button").forEach(b=>b.addEventListener("click",()=>setGolHer(b.dataset.gol)));
document.getElementById("golMover").addEventListener("click",()=>setGolHer("mover"));
document.getElementById("golQuitar").addEventListener("click",()=>setGolHer("quitar"));
// se coloca/quita con un CLIC (no con un arrastre: arrastrar es orbitar la cámara)
let _dn=null; const escenaEl=document.getElementById("escena");
escenaEl.addEventListener("pointerdown",(e)=>{ _dn={x:e.clientX,y:e.clientY,t:performance.now(),b:e.button}; });
escenaEl.addEventListener("pointerup",(e)=>{ const d0=_dn; _dn=null; if(!d0||golHer==="mover"||d0.b!==0) return;
  if(Math.hypot(e.clientX-d0.x,e.clientY-d0.y)>6||performance.now()-d0.t>600) return;
  if(golHer==="quitar"){ const id=candyBajoMouse(e); if(id!=null){ if(socket)socket.emit("candy",{tipo:"quitar",id}); else quitarCandy(id); } return; }
  const p=gol2mundo(e); if(!p) return;
  const o={tipo:golHer,x:p.x,y:p.y,z:p.z,rot:p.rot,scale:p.scale};
  if(socket) socket.emit("candy",{obj:o}); else { o.id="loc"+(candies.length+1); aplicarCandyObjeto(o); } });

/* ================= sockets ================= */
let usersEnLinea=0;
const colabEl=document.getElementById("colab");
try{ socket=io();
  socket.on("connect",()=>{ socket.emit("entrar",{codigo:document.getElementById("room").textContent,usuario:"Dulcera"}); colabEl.textContent="● conectado"; });
  socket.on("estado",(d)=>{
    if(d.mundo) aplicarMundo(d.mundo);
    (d.candies||[]).forEach(o=>aplicarCandyObjeto(o));
    if(d.usuarios){ usersEnLinea=Object.keys(d.usuarios).length; document.getElementById("usersCount").textContent=String(usersEnLinea);
      for(const id in d.usuarios){ if(id===miTok) continue; if(!naves[id]){ naves[id]=crearNave(); setNave(naves[id], d.usuarios[id].pvuelo.ang, ALT_VUELO); } } }
    document.getElementById("usuario_entro"); });
  socket.on("mundo",(d)=>{ if(d.mundo) aplicarMundo(d.mundo); });
  socket.on("usuario_entro",(u)=>{ usersEnLinea++; document.getElementById("usersCount").textContent=String(usersEnLinea); if(u&&u.id&&!naves[u.id]){ naves[u.id]=crearNave(); setNave(naves[u.id], 0, ALT_VUELO); } });
  socket.on("usuario_sale",(u)=>{ if(u&&naves[u.id]){ escena.remove(naves[u.id]); delete naves[u.id]; } usersEnLinea=Math.max(0,usersEnLinea-1); document.getElementById("usersCount").textContent=String(usersEnLinea); });
  socket.on("pvuelo",(p)=>{ if(p&&p.id&&naves[p.id]){ setNave(naves[p.id], p.ang||0, ALT_VUELO); naves[p.id].visible=p.activo!==false; } });
  socket.on("confites",(p)=>{ if(p&&p.id&&naves[p.id]){ tirarConfites(40, naves[p.id].position); } });
  socket.on("candy",(d)=>{ if(d.tipo==="nuevo"&&d.obj) aplicarCandyObjeto(d.obj); else if(d.tipo==="quitar") quitarCandy(d.id); });
}catch(e){ colabEl.textContent="solo vista local"; }
function emit(b){ if(socket) socket.emit("mundo", b); }
let ultPv=0;
function sendPvuelo(){ const now=Date.now(); if(now-ultPv<170) return; ultPv=now; if(socket) socket.emit("pvuelo",{ang:angPropio,activo:miPlanoActivo}); }
function aplicarMundo(m){
  if(typeof m.hora==="number"){ hora=m.hora; sliderHora.value=hora.toFixed(2); }
  if(typeof m.velocidad==="number"){ velocidad=m.velocidad; sliderVel.value=String(velocidad); }
  if(typeof m.brillo==="number"){ brillo=m.brillo; sliderBrillo.value=String(brillo); }
  if(typeof m.girar==="boolean"){ girar.checked=m.girar; controles.autoRotate=m.girar; }
  if(m.avion){ if(m.avion.activo!=null){ miPlanoActivo=m.avion.activo; planAct.checked=miPlanoActivo; if(naves[miTok]) naves[miTok].visible=miPlanoActivo; }
    if(m.avion.velocidad!=null){ velAvion=m.avion.velocidad; planVel.value=String(velAvion); } }
  if(m.paleta){ aplicarPaleta(m.paleta); document.querySelectorAll("#panel .mini input[type=color]").forEach(inp=>{ const v=paleta[inp.dataset.pk]; if(v) inp.value=v; }); }
}
fetch("/api/mundo").then(r=>r.json()).then(m=>aplicarMundo(m)).catch(()=>{});

/* ================= bucle ================= */
const _dirSol=new THREE.Vector3(), reloj3D=new THREE.Clock();
function actualizarCielo(){
  const s=cieloEnHora(hora);
  const elevacion=Math.sin(((hora-6)/12)*Math.PI)*THREE.MathUtils.degToRad(70), azimut=((hora-6)/12)*Math.PI;
  _dirSol.set(Math.cos(elevacion)*Math.cos(azimut),Math.sin(elevacion),Math.cos(elevacion)*Math.sin(azimut)).normalize();
  const dia=THREE.MathUtils.smoothstep(_dirSol.y,-0.13,0.17);
  sol.position.copy(_dirSol).multiplyScalar(70); sol.target.position.set(0,0,0); sol.color.copy(s.sol); sol.intensity=s.solI*brillo*dia;
  luna.position.copy(_dirSol).multiplyScalar(-70); luna.intensity=0.65*(1-dia)*brillo;
  ambiente.intensity=s.amb*brillo*(0.8+0.35*(1-dia)); ambiente.color.copy(s.horizonte).multiplyScalar(1.05); ambiente.groundColor.copy(s.niebla).multiplyScalar(0.55);
  const enc=THREE.MathUtils.smoothstep(1-dia,0.25,0.85)*1.6; for(const mm of vidrios) mm.emissiveIntensity=enc;
  escena.fog.color.copy(s.niebla); escena.fog.density=THREE.MathUtils.lerp(0.0035,0.009,s.estrellas*0.6+(1-dia)*0.4);
  const u=uniformesCielo; u.uCenit.value.copy(s.cenit); u.uHorizonte.value.copy(s.horizonte); u.uSuelo.value.copy(s.niebla).multiplyScalar(0.72);
  u.uColorSol.value.copy(s.sol); u.uDirSol.value.copy(_dirSol); u.uDirLuna.value.copy(_dirSol).multiplyScalar(-1);
  u.uSolI.value=s.solI*brillo*dia+0.05; u.uLunaI.value=1-dia; u.uEstrellas.value=s.estrellas;
  const totalMin=Math.round((((hora%24)+24)%24)*60)%1440;
  reloj.textContent=String(Math.floor(totalMin/60)).padStart(2,"0")+":"+String(totalMin%60).padStart(2,"0");
  iconoTiempo.textContent=iconoDe(((hora%24)+24)%24);
}
function animar(){
  const dt=Math.min(reloj3D.getDelta(),0.05), t=reloj3D.elapsedTime;
  if(velocidad>0){ hora=(hora+dt*velocidad)%24; sliderHora.value=hora.toFixed(2); }
  mundo.position.y=Math.sin(t*0.7)*0.22; mundo.rotation.z=Math.sin(t*0.45)*0.006; mundo.rotation.x=Math.cos(t*0.38)*0.006;
  // mi avioneta avanza; las de los demás se posicionan con lo que manden
  const mine=naves[miTok];
  if(mine){ if(miPlanoActivo){ angPropio+=dt*velAvion*0.4; setNave(mine, angPropio, ALT_VUELO+Math.sin(t*0.9)*1.2); mine.visible=true; sendPvuelo(); } else mine.visible=false; }
  const pisoIsla = mundo.position.y + 0.55;
  actualizarConfites(dt,pisoIsla);
  for(const id in naves){ const h=naves[id].userData.helice; if(h) h.rotation.x+=dt*28; } // hélices girando
  // las golosinas colocadas giran un poco (ya flotan con la isla: son hijas de "mundo")
  for(const cd of candies){ cd.obj.rotation.y+=dt*0.4; }
  actualizarCielo(); uniformesCielo.uTiempo.value=t; domoCielo.position.copy(camara.position);
  controles.update(); renderer.render(escena,camara); requestAnimationFrame(animar);
}
window.addEventListener("resize",()=>{ camara.aspect=window.innerWidth/window.innerHeight; camara.updateProjectionMatrix(); renderer.setSize(window.innerWidth,window.innerHeight); if(mundo.visible) encuadrar(); });
encuadrar(); actualizarCielo(); animar();

/* expuesto */
window.golSetPaleta=aplicarPaleta; window.golTirarConfites=(n)=>tirarConfites(n);
/* ================= sesión + captura de diseño (PostgreSQL) ================= */
(()=>{
  const form=document.getElementById("loginForm"), activa=document.getElementById("sesActiva");
  const msgL=document.getElementById("loginMsg"), msgC=document.getElementById("capMsg");
  let token=null;
  form.addEventListener("submit", async (ev)=>{
    ev.preventDefault(); msgL.textContent="entrando…";
    try{
      const r=await fetch("/api/auth/login",{ method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ email:document.getElementById("loginEmail").value, password:document.getElementById("loginPass").value }) });
      const d=await r.json();
      if(!r.ok){ msgL.textContent=d.error||"no se pudo entrar"; return; }
      token=d.token;
      document.getElementById("sesNombre").textContent=d.usuario.nombre;
      form.hidden=true; activa.hidden=false;
    }catch{ msgL.textContent="error de conexión"; }
  });
  document.getElementById("btnCaptura").addEventListener("click", async ()=>{
    if(!token) return;
    msgC.textContent="guardando…";
    try{
      renderer.render(escena,camara); // asegura el frame actual en el buffer
      const imagen=renderer.domElement.toDataURL("image/png");
      const r=await fetch("/api/capturas",{ method:"POST", headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+token },
        body:JSON.stringify({ imagen }) });
      const d=await r.json();
      msgC.textContent = r.ok ? ("✔ captura #"+d.id+" guardada en PostgreSQL") : (d.error||"no se pudo guardar");
    }catch{ msgC.textContent="error de conexión"; }
  });
})();
