import {Contract,JsonRpcProvider,FetchRequest} from './ethers-runtime.mjs';
import {validateRecord,sealedHash} from './record.mjs';
export const anchorABI=['function resolve() view returns(bool,address,address,address,uint256,uint256,uint256,bytes32,string)','function artifactSHA256() view returns(bytes32)'];
export async function readAnchor(provider,address,blockTag){const c=new Contract(address,anchorABI,provider);return Array.from(await c.resolve({blockTag}),x=>typeof x==='bigint'?x.toString():x);}
// Compare independent providers at the same finalized block. Conflicts cannot downgrade to host trust.
export async function resolveAnchor(config,{makeProvider=url=>{const request=new FetchRequest(url);request.timeout=8000;return new JsonRpcProvider(request,1,{batchMaxCount:1,cacheTimeout:0});},read=readAnchor,allowSingleSealed=false}={}){
 if(!config.anchor)throw Error('Release anchor not configured');
 const providers=[...new Set(config.rpcURLs||[])].map(url=>({url,p:makeProvider(url)}));
 try{
  const heads=(await Promise.all(providers.map(async item=>{try{if((await item.p.getNetwork()).chainId!==1n)throw Error('Wrong chain');const head=await item.p.getBlock('finalized');if(!head?.hash)throw Error('No finalized block');return {...item,head};}catch{return null}}))).filter(Boolean);
  if(!heads.length||heads.length<2&&!allowSingleSealed)throw Error('Anchor unreachable: two independent endpoints required');
  const number=Math.min(...heads.map(x=>x.head.number));
  const answers=(await Promise.all(heads.map(async item=>{try{const block=await item.p.getBlock(number);if(!block?.hash)throw Error('Block unavailable');return {...item,hash:block.hash.toLowerCase(),value:await read(item.p,config.anchor,number)};}catch{return null}}))).filter(Boolean);
  if(!answers.length)throw Error('Anchor unreachable: two confirmed reads required');
  const key=x=>JSON.stringify([x.hash,x.value.map(v=>typeof v==='string'&&v.startsWith('0x')?v.toLowerCase():v)]);
  if(answers.some(x=>key(x)!==key(answers[0]))){const e=Error('Conflicting anchor responses. Verification required.');e.code='ANCHOR_CONFLICT';throw e;}
  const v=answers[0].value,singleSource=answers.length===1;
  if(singleSource&&(!allowSingleSealed||!v[0]||!/^0x[0-9a-f]{64}$/i.test(v[7])||/^0x0{64}$/i.test(v[7])||!v[8]?.startsWith('ipfs://')))throw Error('Anchor unreachable: a live or unbound anchor requires two sources');
  const identity={collection:v[1].toLowerCase(),edition:v[2].toLowerCase()};
  if(config.sourceIdentity&&['collection','edition'].some(k=>config.sourceIdentity[k].toLowerCase()!==identity[k])){const e=Error('Anchor source identity mismatch');e.code='ANCHOR_CONFLICT';throw e;}
  if(!v[0])return {binding:null,identity,verified:true};
  const binding={...identity,house:v[3].toLowerCase(),tokenId:String(v[4]),auctionId:String(v[5]),openingBlock:Number(v[6])};
  return {binding,identity,digest:v[7],uri:v[8],endpoint:answers[0].url,verified:!singleSource,singleSource,finalizedBlock:number};
 }finally{for(const {p} of providers)p.destroy()}
}
export async function anchoredSnapshot(resolved,{gateways,fetcher=fetch}){
 if(!resolved.digest||/^0x0{64}$/.test(resolved.digest)||!resolved.uri?.startsWith('ipfs://'))throw Error('Sealed snapshot not available');
 const path=resolved.uri.slice(7);if(!/^[a-zA-Z0-9]+(?:\/[a-zA-Z0-9._/-]+)?$/.test(path)||path.includes('..'))throw Error('Invalid snapshot URI');
 for(const gateway of gateways){try{const response=await fetcher(gateway.replace(/\/$/,'')+'/'+path,{signal:AbortSignal.timeout(10000)});if(!response.ok)continue;const r=validateRecord(await response.json(),resolved.binding);if(r.phase!=='sealed'||'0x'+await sealedHash(r)!==resolved.digest.toLowerCase())continue;return r;}catch{}}
 throw Error('Verified sealed snapshot unreachable. Please return later.');
}
