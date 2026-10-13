require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST','PUT','DELETE'] } });

const JWT_SECRET = process.env.JWT_SECRET || 'golosinas_secreto';
const PORT = Number(process.env.PORT) || 3200;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

/* ============ ALMACÉN (en memoria) ============ */
const db = {
  usuarios: [
    { id:1, nombre:'Directora de Golosinas', email:'directora@golosinas.com',
      password_hash:'$2a$10$3y1FVQWvPlXXcSgj5r.YoOLzVAEGpjmvENW9WvZHSWWCV2TGzzXDO', rol:'admin' }, // admin123
    { id:2, nombre:'Dulcero Invitado', email:'dulcero@golosinas.com',
      password_hash:'$2a$10$xeF/O6D2Ho.fkiGKhLb.LeyfaN5mhO.CqbTWWhaZGDFNhdLnoHU7C', rol:'espectador' } // espectador123
  ],
  // Estado compartido del mundo de golosinas (paleta + avión + cielo)
  mundo: {
    hora: 13.0,
    velocidad: 0,
    brillo: 1,
    girar: true,
    avion: { activo: true, velocidad: 1.6, confites: true },
    paleta: {
      techo_frutilla:'#e0213d', // techo de frutilla de la casita
      glaseado:'#fff6e8',         // glaseado / blanca iglacée
      pared:'#ffdfc9',            // pared de jengibre
      chicle:'#ff8fb7',           // copas de gomita y algodón
      menta:'#6ee7c2',
      limon:'#ffdd55',
      lila:'#c8a8ff',
      naranja:'#ffb04d',
      chocolate:'#6b4a2e'
    }
  },
  golosinas: [ // backoffice CRUD: golosinas / paletas editables
    { id:1, nombre:'Techo de Frutilla', clave:'techo_frutilla', valor:'#e0213d' },
    { id:2, nombre:'Glaseado Blanca', clave:'glaseado', valor:'#fff6e8' },
    { id:3, nombre:'Pared de Jengibre', clave:'pared', valor:'#ffdfc9' },
    { id:4, nombre:'Gomita / Algodón', clave:'chicle', valor:'#ff8fb7' },
    { id:5, nombre:'Menta Dulce', clave:'menta', valor:'#6ee7c2' },
    { id:6, nombre:'Limón', clave:'limon', valor:'#ffdd55' },
    { id:7, nombre:'Lila Violeta', clave:'lila', valor:'#c8a8ff' },
    { id:8, nombre:'Naranja', clave:'naranja', valor:'#ffb04d' }
  ],
  nextGol: 10
};

/* ============ AUTH ============ */
function firmar(u){ return jwt.sign({ id:u.id, email:u.email, rol:u.rol, nombre:u.nombre }, JWT_SECRET, { expiresIn:'7d' }); }
function auth(req,res,next){ const h=req.headers.authorization||''; const t=h.startsWith('Bearer ')?h.slice(7):null; if(!t)return res.status(401).json({error:'Token requerido'}); try{ req.usuario=jwt.verify(t,JWT_SECRET); next(); }catch{ return res.status(401).json({error:'Token inválido'}); } }
function adminOnly(req,res,next){ if(!req.usuario||req.usuario.rol!=='admin') return res.status(403).json({error:'Solo administradoras'}); next(); }

app.post('/api/auth/login', async (req,res)=>{
  const { email, password } = req.body||{};
  const u = db.usuarios.find(x=>x.email===String(email||'').toLowerCase());
  if(!u || !(await bcrypt.compare(String(password||''), u.password_hash))) return res.status(401).json({error:'Credenciales inválidas'});
  res.json({ token:firmar(u), usuario:{ id:u.id, nombre:u.nombre, email:u.email, rol:u.rol } });
});
app.get('/api/auth/me', auth, (req,res)=>res.json({usuario:req.usuario}));

/* ============ ESTADO PÚBLICO DEL MUNDO ============ */
app.get('/api/mundo', (req,res)=>res.json(db.mundo));

/* ============ BACKOFFICE (solo admin) ============ */
app.get('/api/admin/mundo', auth, adminOnly, (req,res)=>res.json(db.mundo));
app.put('/api/admin/mundo', auth, adminOnly, (req,res)=>{
  const b = req.body||{};
  if(b.paleta) Object.assign(db.mundo.paleta, b.paleta);
  if(b.avion) Object.assign(db.mundo.avion, b.avion);
  if(typeof b.hora==='number') db.mundo.hora=b.hora;
  if(typeof b.brillo==='number') db.mundo.brillo=b.brillo;
  if(typeof b.girar==='boolean') db.mundo.girar=b.girar;
  io.emit('mundo',{ mundo:db.mundo }); // avisa a todos CON el estado (el cliente lee d.mundo)
  res.json(db.mundo);
});
app.get('/api/admin/golosinas', auth, adminOnly, (req,res)=>res.json(db.golosinas));
app.post('/api/admin/golosinas', auth, adminOnly, (req,res)=>{
  const g = { id: db.nextGol++, ...(req.body||{}) }; db.golosinas.push(g); res.status(201).json(g);
});
app.put('/api/admin/golosinas/:id', auth, adminOnly, (req,res)=>{
  const i=db.golosinas.findIndex(x=>Number(x.id)===Number(req.params.id)); if(i<0)return res.status(404).json({error:'No'});
  Object.assign(db.golosinas[i], req.body||{}); res.json(db.golosinas[i]);
});
app.delete('/api/admin/golosinas/:id', auth, adminOnly, (req,res)=>{
  const i=db.golosinas.findIndex(x=>Number(x.id)===Number(req.params.id)); if(i<0)return res.status(404).json({error:'No'});
  db.golosinas.splice(i,1); res.json({ok:true});
});

/* ============ MINIATURAS DEL PANEL DE GOLOSINAS (PNG editables desde el backoffice) ============ */
// Los PNG viven en public/thumbs/<tipo>.png (persisten aunque se reinicie el servidor).
// La primera vez se guarda una copia en public/thumbs/originales/ para poder restaurarlas.
const DIR_THUMBS = path.join(__dirname, 'public', 'thumbs');
const DIR_ORIG = path.join(DIR_THUMBS, 'originales');
const TIPOS_GOLOSINA = { piruleta:'Piruleta', gomita:'Gomita', algodon:'Algodón', caramelo:'Pastilla', donut:'Dona', flor:'Flor', hongo:'Hongo', tangulu:'Tangulu' };
const PNG_SIG = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
const MAX_THUMB = 500*1024; // bytes
fs.mkdirSync(DIR_ORIG, { recursive:true });
for(const t of Object.keys(TIPOS_GOLOSINA)){
  const f=path.join(DIR_THUMBS,t+'.png'), o=path.join(DIR_ORIG,t+'.png');
  if(fs.existsSync(f) && !fs.existsSync(o)) fs.copyFileSync(f,o);
  if(!fs.existsSync(f)) console.warn('⚠️  Falta la miniatura public/thumbs/'+t+'.png');
}
function versionThumb(t){ try{ return Math.round(fs.statSync(path.join(DIR_THUMBS,t+'.png')).mtimeMs); }catch{ return 0; } }
app.get('/api/miniaturas', (req,res)=>res.json(Object.keys(TIPOS_GOLOSINA).map(t=>({
  tipo:t, nombre:TIPOS_GOLOSINA[t], v:versionThumb(t), original:fs.existsSync(path.join(DIR_ORIG,t+'.png')) }))));
app.put('/api/admin/miniaturas/:tipo', auth, adminOnly, (req,res)=>{
  const t=req.params.tipo; if(!Object.prototype.hasOwnProperty.call(TIPOS_GOLOSINA,t)) return res.status(404).json({error:'Golosina desconocida'});
  const m=/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String((req.body||{}).imagen||''));
  if(!m) return res.status(400).json({error:'Se espera un PNG (data URL en base64)'});
  const buf=Buffer.from(m[1],'base64');
  if(buf.length>MAX_THUMB) return res.status(413).json({error:'El PNG pesa más de 500 KB'});
  if(buf.length<33 || !buf.subarray(0,8).equals(PNG_SIG) || buf.toString('ascii',12,16)!=='IHDR') return res.status(400).json({error:'El archivo no es un PNG válido'});
  const w=buf.readUInt32BE(16), h=buf.readUInt32BE(20);
  if(w<32||h<32||w>1024||h>1024) return res.status(400).json({error:'Tamaño fuera de rango (entre 32 y 1024 px)'});
  fs.writeFileSync(path.join(DIR_THUMBS,t+'.png'),buf);
  const v=Date.now(); io.emit('miniaturas',{ tipo:t, v }); // todos los clientes refrescan esa imagen
  res.json({ tipo:t, v, w, h });
});
app.delete('/api/admin/miniaturas/:tipo', auth, adminOnly, (req,res)=>{
  const t=req.params.tipo; if(!Object.prototype.hasOwnProperty.call(TIPOS_GOLOSINA,t)) return res.status(404).json({error:'Golosina desconocida'});
  const o=path.join(DIR_ORIG,t+'.png'); if(!fs.existsSync(o)) return res.status(404).json({error:'No hay miniatura original guardada'});
  fs.copyFileSync(o,path.join(DIR_THUMBS,t+'.png'));
  const v=Date.now(); io.emit('miniaturas',{ tipo:t, v }); res.json({ tipo:t, v });
});

app.get('/api/health', (req,res)=>res.json({status:'online', servicio:'Mundo de Golosinas Colaborativo'}));

/* ============ SOCKETS (colaboración) ============ */
const salas = {}; // codigo -> { usuarios:{sid:{id,nombre,pvuelo}}, candies:[], nextCandy:1 }
io.on('connection', (socket)=>{
  let sala=null, usuarioId=null;
  socket.on('entrar',({codigo,usuario})=>{
    sala=codigo||'MUNDO-01'; socket.join(sala);
    const S=salas[sala]||(salas[sala]={usuarios:{},candies:[],nextCandy:1});
    usuarioId=socket.id;
    S.usuarios[usuarioId]={ id:usuarioId, nombre:usuario||'Dulcero', pvuelo:{ ang:Math.random()*Math.PI*2, activo:true } };
    socket.emit('estado',{ mundo:db.mundo, candies:S.candies, usuarios:S.usuarios });
    socket.to(sala).emit('usuario_entro',{ id:usuarioId, nombre:S.usuarios[usuarioId].nombre });
  });
  // quien entra recibe la lista; luego los cambios de cielo/colores/avión
  socket.on('mundo', (b)=>{
    if(!sala) return; const md=db.mundo;
    if(typeof b.hora==='number') md.hora=((b.hora%24)+24)%24;
    if(typeof b.velocidad==='number') md.velocidad=b.velocidad;
    if(typeof b.brillo==='number') md.brillo=b.brillo;
    if(typeof b.girar==='boolean') md.girar=b.girar;
    if(b.avion) Object.assign(md.avion, b.avion);
    if(b.paleta) Object.assign(md.paleta, b.paleta);
    io.to(sala).emit('mundo',{ mundo:md, deUsuario:b.usuario });
  });
  // posición de la avioneta de cada usuario (ángulo orbital)
  socket.on('pvuelo', (b)=>{
    if(!sala) return; const S=salas[sala]; const w=S.usuarios[usuarioId]; if(!w) return;
    if(typeof b.ang==='number') w.pvuelo.ang=b.ang;
    if(b.activo!=null) w.pvuelo.activo=!!b.activo;
    socket.to(sala).emit('pvuelo',{ id:usuarioId, ang:w.pvuelo.ang, activo:w.pvuelo.activo });
  });
  socket.on('confites', ()=>{
    if(!sala) return; io.to(sala).emit('confites',{ id:usuarioId });
  });
  // colocar / quitar golosinas decorativas en la isla
  socket.on('candy',(b)=>{
    if(!sala) return; const S=salas[sala];
    if(b && b.tipo==='quitar'){ const i=S.candies.findIndex(c=>c.id===b.id); if(i>=0){ S.candies.splice(i,1); } io.to(sala).emit('candy',{tipo:'quitar',id:b.id}); }
    else if(b && b.obj){ const o={ id:'c'+(S.nextCandy++), ...b.obj }; S.candies.push(o); io.to(sala).emit('candy',{tipo:'nuevo',obj:o}); }
  });
  socket.on('disconnect', ()=>{
    if(!sala) return; const S=salas[sala]; if(!S) return;
    delete S.usuarios[usuarioId];
    io.to(sala).emit('usuario_sale',{ id:usuarioId });
  });
});

app.use(express.static(path.join(__dirname, 'public'), { setHeaders:r=>r.set('Cache-Control','no-cache, no-store, must-revalidate') }));
app.get('*', (req,res)=>{
  if(req.path.startsWith('/backoffice')) return res.sendFile(path.join(__dirname,'public','backoffice.html'));
  res.sendFile(path.join(__dirname,'public','index.html'));
});

server.listen(PORT, ()=>{
  console.log('====================================================');
  console.log('🍭 MUNDO DE GOLOSINAS COLABORATIVO ACTIVO');
  console.log(`🌐 Mundo:      http://localhost:${PORT}`);
  console.log(`🔐 Backoffice: http://localhost:${PORT}/backoffice`);
  console.log('👤 directora@golosinas.com / admin123   (Directora)');
  console.log('👤 dulcero@golosinas.com / espectador123   (Dulcero)');
  console.log('====================================================');
});