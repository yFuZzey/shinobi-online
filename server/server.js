// Servidor do Shinobi Online (versão inicial: só responde que está vivo).
const http=require('http');
const PORT=process.env.PORT||8080;
http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify({ok:true,v:0,commit:process.env.RENDER_GIT_COMMIT||null}))}).listen(PORT,()=>console.log('servidor na porta',PORT));
