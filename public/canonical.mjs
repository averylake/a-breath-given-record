// Versioned consensus bytes. Checkpoints, labels and derived UI state are transport only.
export const characterOrder=(a,b)=>a<b?-1:a>b?1:0;
export const nodeOrder=(a,b)=>(a.block??a.joinedAt??0)-(b.block??b.joinedAt??0)||(a.logIndex??0)-(b.logIndex??0)||(a.kind==='giver'?-1:0)-(b.kind==='giver'?-1:0)||(a.batchIndex??0)-(b.batchIndex??0)||characterOrder(a.wallet,b.wallet);
export const giftOrder=(a,b)=>(a.joinedAt??0)-(b.joinedAt??0)||characterOrder(a.id,b.id);
export const orderedNodes=nodes=>[...nodes].sort(nodeOrder);
export const orderedGifts=gifts=>[...gifts].sort(giftOrder);
const fields=(value,keys)=>Object.fromEntries(keys.map(k=>[k,value?.[k]??null]));
export function canonicalRecord(r){return {schema:'breath/seal-1',binding:fields(r.binding,['collection','edition','house','tokenId','auctionId','openingBlock']),sourceCollection:r.sourceCollection,sourceTokenId:r.sourceTokenId,opening:fields(r.opening,['number','hash','timestamp']),closing:fields(r.closing,['number','hash','timestamp']),endsAt:r.endsAt,settled:r.settled,finalCollector:r.finalCollector??null,nodes:orderedNodes(r.nodes).map(n=>fields(n,['wallet','seed','joinedAt','transactionHash','blockHash','block','logIndex','batchIndex','kind','inviter','sourceRole'])),gifts:orderedGifts(r.gifts).map(e=>fields(e,['id','giver','recipient','transactionHash','blockHash','joinedAt']))};}
