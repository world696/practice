'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'dist'),port=Number(process.env.PORT)||5178;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end('Bad request');}
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end('Method not allowed');}
 const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden');}
 fs.stat(target,(error,stat)=>{
  if(error||!stat.isFile()){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
  if(req.method==='HEAD')return res.end();fs.createReadStream(target).pipe(res);
 });
});
server.listen(port,'127.0.0.1',()=>console.log('SpecFlow ready: http://localhost:'+port));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));