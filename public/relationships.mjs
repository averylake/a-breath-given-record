import {orderedNodes,orderedGifts} from './canonical.mjs';
// Local visual model. A production adapter must supply canonical, verified events.
export function gathering(records, gifts, finalCollector = null) {
  gifts = orderedGifts(gifts);
  const nodes = orderedNodes(records).map(r => ({...r, gave:false, received:false, collector:r.wallet===finalCollector}));
  const byWallet = new Map(nodes.map(n=>[n.wallet,n]));
  if (byWallet.size !== nodes.length) throw Error('Duplicate wallet');
  const seen = new Set();
  for (const gift of gifts) {
    if (!byWallet.has(gift.giver) || !byWallet.has(gift.recipient) || gift.giver===gift.recipient || seen.has(gift.id)) throw Error('Invalid gift relationship');
    seen.add(gift.id); byWallet.get(gift.giver).gave=true; byWallet.get(gift.recipient).received=true;
  }
  for (const node of nodes) {
    node.state=node.gave?'given':node.received?'received':node.collector?'collector':'present';
    // Every verified place qualifies once. Giving is voluntary, not an entitlement gate.
    node.nftEligible=true;
  }
  return {nodes, gifts:gifts.map(g=>({...g}))};
}

// Fixture only: one artist root, branching gifts, and an independent self-collector.
export function fixture(count) {
  const records=Array.from({length:count},(_,i)=>({wallet:'0x'+(i+1).toString(16).padStart(40,'0'),joinedAt:1791046800+i*317,label:i===0?'Artist':`Breath ${String(i+1).padStart(2,'0')}`}));
  const gifts=[];
  for(let i=1;i<count;i++) {
    if(i%9===0) continue;
    const parent=i<5?0:Math.max(0,i-4);
    gifts.push({id:`gift-${i}`,giver:records[parent].wallet,recipient:records[i].wallet,joinedAt:records[i].joinedAt});
  }
  return gathering(records,gifts,count>2?records[2].wallet:null);
}

export function layout(model, direction) {
  const nodes=model.nodes, n=nodes.length;
  if(!n) return [];
  // A canonical arrival owns a permanent world slot. Later gifts never reorder it.
  // Relationships remain in the travelling dots, rather than the spiral order.
  if(direction==='common')return nodes.map((_,i)=>{const angle=i*2.399963229728653,radius=118*Math.sqrt(i);return{x:Math.cos(angle)*radius*1.28,y:Math.sin(angle)*radius*.85,index:i}});
  const indices=new Map(nodes.map((x,i)=>[x.wallet,i]));
  const parents=nodes.map(()=>-1);
  // Keep every edge, but use the first earlier giver to place a node. Cycles/back-gifts
  // remain visible connections rather than recursive placement instructions.
  for(const gift of model.gifts){const a=indices.get(gift.giver),b=indices.get(gift.recipient);if(a<b&&parents[b]<0)parents[b]=a;}
  const children=nodes.map(()=>[]),roots=[];
  parents.forEach((p,i)=>p<0?roots.push(i):children[p].push(i));
  const widths=nodes.map(()=>1),depths=nodes.map(()=>0);
  for(let i=n-1;i>=0;i--)if(children[i].length)widths[i]=children[i].reduce((s,j)=>s+widths[j],0);
  let offset=0;const positions=nodes.map(()=>null);
  const visit=(root,start,depth)=>{const stack=[[root,start,depth]];while(stack.length){const[i,s,d]=stack.pop();depths[i]=d;positions[i]={x:(s+widths[i]/2)*220,y:d*205,index:i};let next=s;const tasks=[];for(const child of children[i]){tasks.push([child,next,d+1]);next+=widths[child]}for(let k=tasks.length-1;k>=0;k--)stack.push(tasks[k]);}};
  for(const root of roots){visit(root,offset,0);offset+=widths[root]+.9;}
  if(direction==='passage')return positions.map(p=>({...p,x:p.y*1.65,y:p.x*.64}));
  if(direction==='beside') {
    const grow=(root,x,y,angle)=>{const stack=[[root,x,y,angle]];while(stack.length){const[i,x,y,angle]=stack.pop();positions[i]={x,y,index:i};const kids=children[i],tasks=[];kids.forEach((child,k)=>{const theta=parents[i]<0?(-Math.PI*.9+k*Math.PI*2/Math.max(1,kids.length)):angle+(kids.length===1?0:(k/(kids.length-1)-.5)*2.25);const direction=kids.length>5?angle+(((k*.618033988749895)%1)-.5)*2.1:theta;const distance=kids.length>5?230+85*Math.sqrt(k+1):192;tasks.push([child,x+Math.cos(direction)*distance,y+Math.sin(direction)*distance,direction])});for(let k=tasks.length-1;k>=0;k--)stack.push(tasks[k]);}};
    roots.forEach((r,k)=>grow(r,k*560,0,-Math.PI/2));
    // Large forests need two-dimensional room instead of a long row of roots.
    // Translate whole families together; keep their internal gift relationships.
    // Existing reviewed compositions of 100 places or fewer remain exact.
    if(n>100&&roots.length>1){
     const family=nodes.map(()=>-1),groups=new Map(roots.map(r=>[r,{indices:[],left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity}]));
     for(let i=0;i<n;i++){family[i]=parents[i]<0?i:family[parents[i]];const q=groups.get(family[i]),p=positions[i];q.indices.push(i);q.left=Math.min(q.left,p.x);q.right=Math.max(q.right,p.x);q.top=Math.min(q.top,p.y);q.bottom=Math.max(q.bottom,p.y)}
     let area=0;for(const q of groups.values())area+=(q.right-q.left+250)*(q.bottom-q.top+250);const rowLimit=Math.sqrt(area*1.5);let x=0,y=0,rowHeight=0;
     for(const q of groups.values()){const width=q.right-q.left+250,height=q.bottom-q.top+250;if(x>0&&x+width>rowLimit){x=0;y+=rowHeight;rowHeight=0}for(const i of q.indices){positions[i].x+=x-q.left;positions[i].y+=y-q.top}x+=width;rowHeight=Math.max(rowHeight,height)}
    }
    // Deterministic spacing relaxation keeps complete forms legible.
    for(let iteration=0;iteration<60;iteration++){
     const cells=new Map(),key=p=>Math.floor(p.x/168)+','+Math.floor(p.y/168);
     if(n>100)positions.forEach((p,i)=>{const k=key(p);if(!cells.has(k))cells.set(k,new Set());cells.get(k).add(i)});
     for(let i=0;i<n;i++){
      const candidates=[];if(n<=100){for(let j=i+1;j<n;j++)candidates.push(j)}else{const x=Math.floor(positions[i].x/168),y=Math.floor(positions[i].y/168);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const j of cells.get((x+a)+','+(y+b))||[])if(j>i)candidates.push(j);candidates.sort((a,b)=>a-b)}
      for(const j of candidates){const ki=n>100?key(positions[i]):null,kj=n>100?key(positions[j]):null;
      let dx=positions[j].x-positions[i].x,dy=positions[j].y-positions[i].y,d=Math.hypot(dx,dy);if(d<168){if(d<.001){dx=1;dy=.3;d=Math.hypot(dx,dy)}const push=(168-d)*.25;positions[i].x-=dx/d*push;positions[i].y-=dy/d*push;positions[j].x+=dx/d*push;positions[j].y+=dy/d*push;}
      if(n>100)for(const [index,old] of [[i,ki],[j,kj]]){const k=key(positions[index]);if(k!==old){cells.get(old).delete(index);if(!cells.has(k))cells.set(k,new Set());cells.get(k).add(index)}}
     }}
    }
  }
  return positions;
}

// Hypothetical invited chain. Counts describe gifts, not people verified by a wallet.
export function giftSimulation(counts=[0,1,2,10,0],later=false,independent=false) {
  if(counts.length!==5||counts.some(n=>!Number.isSafeInteger(n)||n<0||n>20))throw Error('Use five gift counts from 0 to 20.');
  const records=[],gifts=[];
  const add=(code,label,parent=null)=>{const wallet='0x'+code.toString(16).padStart(40,'0');records.push({wallet,label,joinedAt:1791046800+records.length*317});if(parent!==null)gifts.push({id:'gift-'+code,giver:parent,recipient:wallet,joinedAt:records.at(-1).joinedAt});return wallet};
  const bidder=add(99,'First bidder'),artist=add(1,'Artist · first gift'),invited=[];
  for(let i=0;i<5;i++)invited.push(add(i+2,'Invited '+String.fromCharCode(65+i),artist));
  const descendants=[];
  for(let i=0;i<5;i++){descendants[i]=[];for(let k=0;k<counts[i];k++)descendants[i].push(add((i+2)*100+k+1,String.fromCharCode(65+i)+' · gift '+(k+1),invited[i]));}
  if(later){let index=0;for(const branch of [1,3])if(descendants[branch]?.length){const n=branch===1?1:3;for(let k=0;k<n;k++)add(10000+index++,'Further gift '+index,descendants[branch][0]);}}
  if(independent){add(90001,'Independent collector');records.at(-1).kind='self';add(90002,'Independent bidder');records.at(-1).kind='bid';}
  return gathering(records,gifts,null);
}
