const { chromium } = require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const zlib=require('node:zlib');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({acceptDownloads:true});
 try{
  const page=await context.newPage();
  const play={name:'Offline Viewer Regression',view:'half',size:24,label:'number',mode:'play',steps:[
   {objects:[{id:'p1',type:'off',num:1,x:200,y:300},{id:'p2',type:'off',num:2,x:400,y:300}],ball:'p1',actions:[{type:'pass',from:'p1',to:'p2',points:[{x:200,y:300},{x:400,y:300}]}]},
   {objects:[{id:'p1',type:'off',num:1,x:200,y:300},{id:'p2',type:'off',num:2,x:400,y:300}],ball:'p1',actions:[]}
  ]};
  const encoded=zlib.gzipSync(JSON.stringify(play)).toString('base64url');
  const original=path.resolve('verona_shared_viewer.html');
  await page.goto('file://'+original+'#'+encoded);
  await page.locator('#title').waitFor();
  if(await page.locator('#title').textContent()!==play.name)throw Error('Shared link did not load');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#downloadviewer').click();
  const download=await downloadPromise;
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'coachclique-offline-'));
  const saved=path.join(dir,'offline-viewer.html');
  await download.saveAs(saved);
  const html=fs.readFileSync(saved,'utf8');
  if(!html.includes('id="embedded-play-data"')||!html.includes(encoded))throw Error('Downloaded HTML omitted embedded play data');
  const offline=await context.newPage();
  await offline.goto('file://'+saved);
  await offline.locator('#title').waitFor();
  if(await offline.locator('#title').textContent()!==play.name)throw Error('Offline viewer lost play name');
  if(await offline.locator('.stepitem').count()!==2)throw Error('Offline viewer lost steps');
  if(await offline.locator('.actionitem').count()!==1)throw Error('Offline viewer lost the authored pass');
  if(!(await offline.locator('.actionitem').first().textContent()).includes('Pass'))throw Error('Offline viewer changed action type');
  await offline.locator('#next').click();
  if(!(await offline.locator('#stepstatus').textContent()).includes('2'))throw Error('Next step did not work offline');
  await offline.locator('#flip').click();
  if(!(await offline.locator('#stepstatus').textContent()).includes('1'))throw Error('Flip did not return to first step');
  await offline.locator('#play').click();
  await offline.waitForTimeout(1500);
  if(!(await offline.locator('#stepstatus').textContent()).includes('Finished'))throw Error('Offline playback did not finish');
  console.log('Verified shared play download reopens offline with steps, navigation, flip, and playback');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
