import {canonicalRecord,orderedNodes,orderedGifts} from './canonical.mjs';
import {wallet,validateEntry} from './policy.mjs';
import {gathering} from './relationships.mjs';
export async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(x=>x.toString(16).padStart(2,'0')).join('')}
const hex=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/i.test(x)&&!/^0x0{64}$/i.test(x);
export function validateRecord(record,binding){
 if(record?.version!=='breath/record-1'||!['open','closed','sealed'].includes(record.phase)||typeof record.settled!=='boolean'||(record.phase==='sealed')!==record.settled)throw Error('Invalid record state');
 if(!binding||['collection','edition','house'].some(k=>wallet(record.binding?.[k])!==wallet(binding[k]))||['tokenId','auctionId','openingBlock'].some(k=>String(record.binding?.[k])!==String(binding[k]))||record.sourceCollection!==wallet(binding.collection)||record.sourceTokenId!==String(binding.tokenId))throw Error('Wrong artwork binding');
 if(!Number.isSafeInteger(record.endsAt)||record.endsAt<=0||!hex(record.opening?.hash)||!hex(record.checkpoint?.hash)||record.opening.number!==binding.openingBlock||!Number.isSafeInteger(record.checkpoint.number)||record.checkpoint.number<record.opening.number||!Number.isSafeInteger(record.opening.timestamp)||!Number.isSafeInteger(record.checkpoint.timestamp))throw Error('Invalid checkpoint');
 if(!hex(record.closing?.hash)||!Number.isSafeInteger(record.closing.number)||record.closing.number>record.checkpoint.number||record.phase!=='open'&&record.closing.timestamp<record.endsAt)throw Error('Invalid closing checkpoint');
 if(record.phase==='open'&&record.checkpoint.timestamp>=record.endsAt||record.phase!=='open'&&record.checkpoint.timestamp<record.endsAt)throw Error('Invalid window phase');
 if(!Array.isArray(record.nodes)||!Array.isArray(record.gifts)||record.nodes.length>100000||record.gifts.length>100000)throw Error('Record size invalid');
 for(const n of record.nodes){validateEntry(n);if(!hex(n.transactionHash)||!hex(n.blockHash)||!Number.isSafeInteger(n.block)||n.block<record.opening.number||n.block>record.checkpoint.number||n.joinedAt<record.opening.timestamp||n.joinedAt>Math.min(record.endsAt,record.checkpoint.timestamp))throw Error('Invalid entry provenance');}
 for(const e of record.gifts)if(!hex(e.transactionHash)||!hex(e.blockHash)||!Number.isSafeInteger(e.joinedAt)||e.joinedAt<record.opening.timestamp||e.joinedAt>record.endsAt)throw Error('Invalid gift provenance');
 if(record.finalCollector!==null)wallet(record.finalCollector);
 gathering(record.nodes,record.gifts,record.finalCollector);
 return structuredClone({...record,nodes:orderedNodes(record.nodes),gifts:orderedGifts(record.gifts)});
}
export function acceptNext(previous,next){
 if(!previous)return next;
 if(previous.phase==='sealed'){if(JSON.stringify(canonicalRecord(previous))!==JSON.stringify(canonicalRecord(next)))throw Error('Sealed record changed');return previous;}
 if(next.checkpoint.number<previous.checkpoint.number||next.endsAt<previous.endsAt)throw Error('Record regressed');
 for(const n of previous.nodes){const later=next.nodes.find(x=>x.wallet===n.wallet);if(!later||['seed','joinedAt','transactionHash','blockHash'].some(k=>later[k]!==n[k]))throw Error('Entry changed');}
 for(const e of previous.gifts)if(!next.gifts.some(x=>JSON.stringify(x)===JSON.stringify(e)))throw Error('Gift changed');
 return next;
}
export const sealedHash=record=>hash(canonicalRecord(record));
export async function splitRecord(record,size=1000){
 const {nodes,gifts,...header}=record,pages=[];
 for(const [kind,items] of [['nodes',nodes],['gifts',gifts]])for(let start=0;start<items.length;start+=size){const page={kind,index:pages.length,items:items.slice(start,start+size)};pages.push({...page,sha256:await hash(page)});}
 const head={version:'breath/transport-1',header,recordSHA256:await hash(record),pages:pages.map(p=>({index:p.index,kind:p.kind,count:p.items.length,sha256:p.sha256}))};return {head,pages};
}
export async function joinRecord(head,fetchPage,binding){
 if(head?.version!=='breath/transport-1'||!Array.isArray(head.pages)||head.pages.length>200)throw Error('Invalid record head');
 const record={...head.header,nodes:[],gifts:[]};
 for(let i=0;i<head.pages.length;i++){const descriptor=head.pages[i];if(descriptor.index!==i||!['nodes','gifts'].includes(descriptor.kind)||descriptor.count>1000)throw Error('Invalid page descriptor');const page=await fetchPage(i),{sha256,...content}=page;
 if(page.index!==i||page.kind!==descriptor.kind||page.items.length!==descriptor.count||sha256!==descriptor.sha256||await hash(content)!==sha256)throw Error('Record page mismatch');record[page.kind].push(...page.items);}
 if(await hash(record)!==head.recordSHA256)throw Error('Whole record mismatch');return validateRecord(record,binding);
}
export async function loadRecord({sources,binding,recover,previous=null,fetcher=fetch,identity=null,expectedDigest=null}){
 const candidates=[],errors=[];
 for(const base of sources){try{const get=async path=>{const response=await fetcher(base.replace(/\/$/,'')+path,{signal:AbortSignal.timeout(10000),cache:'no-store'});if(!response.ok)throw Error('Record host unavailable');return response.json()};const head=await get('/head.json'),candidateBinding=binding||head.header?.binding;
 if(!binding&&(!identity||['collection','edition'].some(k=>wallet(candidateBinding?.[k])!==wallet(identity[k]))))throw Error('Source identity unavailable or mismatched');
 const record=await joinRecord(head,i=>get('/pages/'+i+'.json'),candidateBinding);
 if(expectedDigest&&(record.phase!=='sealed'||'0x'+await sealedHash(record)!==expectedDigest.toLowerCase()))throw Error('Anchored record fingerprint mismatch');
 acceptNext(previous,record);candidates.push({record,source:base});}catch(e){errors.push(e.message)}}
 if(!candidates.length&&recover){try{const record=validateRecord(await recover(),binding);acceptNext(previous,record);candidates.push({record,source:'Ethereum recovery'})}catch(e){errors.push(e.message)}}
 const sealed=candidates.filter(c=>c.record.phase==='sealed');
 if(sealed.length>1&&sealed.some(c=>JSON.stringify(canonicalRecord(c.record))!==JSON.stringify(canonicalRecord(sealed[0].record)))){if(previous)return {record:previous,source:'last confirmed record',stale:true,errors:[...errors,'Conflicting sealed records. Verification required.']};throw Error('Conflicting sealed records. Verification required.');}
 candidates.sort((a,b)=>Number(b.record.phase==='sealed')-Number(a.record.phase==='sealed')||b.record.checkpoint.number-a.record.checkpoint.number);
 if(candidates.length){const chosen=candidates[0];return {...chosen,stale:chosen.source!==sources[0],errors};}
 if(previous&&(!expectedDigest||previous.phase==='sealed'&&'0x'+await sealedHash(previous)===expectedDigest.toLowerCase()))return {record:previous,source:'last confirmed record',stale:true,errors};
 throw Error('Participation record unreachable. Please return later.');
}
