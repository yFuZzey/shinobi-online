// Deixa o app sempre deitado e em tela cheia. Rode depois de "npx cap add android".
const fs=require('fs');
const man='android/app/src/main/AndroidManifest.xml';
let m=fs.readFileSync(man,'utf8');
if(!m.includes('screenOrientation')){
  m=m.replace('<activity','<activity\n            android:screenOrientation="sensorLandscape"');
  fs.writeFileSync(man,m);console.log('OK: app travado deitado');
}else console.log('Orientação já configurada');
const st='android/app/src/main/res/values/styles.xml';
let s=fs.readFileSync(st,'utf8');
if(!s.includes('windowFullscreen')){
  s=s.replace(/(<style name="AppTheme.NoActionBar"[^>]*>)/,'$1\n        <item name="android:windowFullscreen">true</item>');
  s=s.replace(/(<style name="AppTheme.NoActionBarLaunch"[^>]*>)/,'$1\n        <item name="android:windowFullscreen">true</item>');
  fs.writeFileSync(st,s);console.log('OK: tela cheia');
}
// Ícone do app (arte/ui/android/res, gerado por arte/ferramentas/recortar_ui.py): só troca arquivos que o modelo já tem
{const path=require('path'),src='arte/ui/android/res',dst='android/app/src/main/res';let n=0;
 if(fs.existsSync(src)&&fs.existsSync(dst))for(const d of fs.readdirSync(src)){const o=path.join(dst,d);if(!fs.existsSync(o))continue;
  for(const f of fs.readdirSync(path.join(src,d)))if(fs.existsSync(path.join(o,f))){fs.copyFileSync(path.join(src,d,f),path.join(o,f));n++}}
 const bg=path.join(dst,'values','ic_launcher_background.xml');
 if(fs.existsSync(bg)){fs.writeFileSync(bg,fs.readFileSync(bg,'utf8').replace(/(<color name="ic_launcher_background">)[^<]*(<\/color>)/,'$1#3A201A$2'))}
 console.log('OK: ícone do app ('+n+' arquivos)')}
