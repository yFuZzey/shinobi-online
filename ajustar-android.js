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
