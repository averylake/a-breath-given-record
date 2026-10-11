// Copy verified public records. Never reads event logs or uses an Alchemy secret.
import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {resolveAnchor} from '../public/anchor.mjs';
import {loadRecord,validateRecord,acceptNext,sealedHash,splitRecord} from '../public/record.mjs';
export async function mirrorRecord(config,out,{resolve=resolveAnchor,load=loadRecord}={}){
 if(!config.anchor||!config.sourceIdentity||!config.sources?.length)throw Error('Mirror release configuration incomplete');
 const resolved=await resolve(config);if(!resolved.verified||!resolved.binding)throw Error('Verified bound anchor required');
 let previous=null;try{previous=validateRecord(JSON.parse(await fs.readFile(path.join(out,'record.json'),'utf8')),resolved.binding);}catch(e){if(e.code!=='ENOENT')throw e;}
 const expected=resolved.digest&&!/^0x0{64}$/.test(resolved.digest)?resolved.digest:null;
 const result=await load({...config,sources:[config.sources[0]],binding:resolved.binding,previous:null,expectedDigest:expected,recover:null});
 if(result.stale)throw Error('Refusing a stale mirror input');
 const record=validateRecord(result.record,resolved.binding);acceptNext(previous,record);
 if(expected&&(record.phase!=='sealed'||'0x'+await sealedHash(record)!==expected.toLowerCase()))throw Error('Mirror seal mismatch');
 const transport=await splitRecord(record); // Finish all validation before writing output.
 await fs.mkdir(path.join(out,'pages'),{recursive:true});
 for(const page of transport.pages)await fs.writeFile(path.join(out,'pages',page.index+'.json'),JSON.stringify(page));
 await fs.writeFile(path.join(out,'head.json'),JSON.stringify(transport.head));
 await fs.writeFile(path.join(out,'record.json'),JSON.stringify(record));
 await fs.writeFile(path.join(out,'.nojekyll'),'');
 return {phase:record.phase,places:record.nodes.length,pages:transport.pages.length,sealedSHA256:record.phase==='sealed'?await sealedHash(record):null};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {RELEASE}=await import('../public/release-config.mjs');
 try{console.log(JSON.stringify(await mirrorRecord(RELEASE,process.argv[2]||'backup')));}catch(e){console.error('Mirror halted: '+e.message);process.exitCode=1;}
}
