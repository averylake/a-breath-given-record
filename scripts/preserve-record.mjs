// Production backup entry point. An unbound anchor is a prelaunch state, never a zero-person record.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolveAnchor} from '../public/anchor.mjs';
import {mirrorRecord} from './mirror-record.mjs';
export async function preserveRecord(config,out,{resolve=resolveAnchor,mirror=mirrorRecord}={}){
 if(!config.anchor||!config.sourceIdentity||!config.sources?.length)throw Error('Mirror release configuration incomplete');
 const resolved=await resolve(config);
 if(!resolved.verified||resolved.singleSource)throw Error('Verified anchor quorum required');
 let report;
 if(!resolved.binding){
  for(const filename of ['record.json','head.json']){
   try{await fs.access(path.join(out,filename));throw Error('Unbound anchor cannot replace an existing record');}
   catch(error){if(error.code!=='ENOENT')throw error;}
  }
  report={phase:'awaiting-binding',places:null,anchor:config.anchor};
 }else{
  report={...await mirror(config,out,{resolve:async()=>resolved}),anchor:config.anchor};
 }
 await fs.mkdir(out,{recursive:true});
 // Stable content avoids creating a commit on every prelaunch check.
 await fs.writeFile(path.join(out,'status.json'),JSON.stringify(report,null,2)+'\n');
 const message=report.phase==='awaiting-binding'?'The artwork is being prepared. No auction record has been bound yet.':`Verified ${report.phase} gathering record: ${report.places} places.`;
 await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A Breath Given | Record backup</title><style>body{background:#10100f;color:#eee9dc;font:18px/1.6 Georgia,serif;max-width:650px;margin:12vh auto;padding:24px}a{color:inherit}</style><h1>A Breath Given</h1><p>${message}</p><p>This is the public preservation copy of the gathering record.</p><p><a href="https://being.averylake.art/">Avery Lake</a></p></html>\n`);
 await fs.writeFile(path.join(out,'.nojekyll'),'');
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {RELEASE}=await import('../public/release-config.mjs');
 try{console.log(JSON.stringify(await preserveRecord(RELEASE,process.argv[2]||'backup')));}
 catch(error){console.error('Backup halted: '+error.message);process.exitCode=1;}
}
