// Exact artist-selected mixes from the September 23 nine-image Breath study.
export const TRACE_DIRECTIONS = Object.freeze([
  {
    "hand": 20,
    "print": 8,
    "image": 85,
    "code": 10,
    "tokens": 80,
    "imageTreatment": "study"
  },
  {
    "hand": 55,
    "print": 20,
    "image": 55,
    "code": 12,
    "tokens": 0,
    "imageTreatment": "study"
  },
  {
    "hand": 0,
    "print": 0,
    "image": 0,
    "code": 0,
    "tokens": 85,
    "imageTreatment": "study"
  },
  {
    "hand": 65,
    "print": 8,
    "image": 38,
    "code": 5,
    "tokens": 65,
    "imageTreatment": "study"
  },
  {
    "hand": 0,
    "print": 15,
    "image": 95,
    "code": 20,
    "tokens": 35,
    "imageTreatment": "study"
  },
  {
    "hand": 20,
    "print": 60,
    "image": 10,
    "code": 30,
    "tokens": 70,
    "imageTreatment": "study"
  },
  {
    "hand": 0,
    "print": 0,
    "image": 90,
    "code": 0,
    "tokens": 0,
    "imageTreatment": "study"
  },
  {
    "hand": 30,
    "print": 15,
    "image": 70,
    "code": 15,
    "tokens": 75,
    "imageTreatment": "study"
  },
  {
    "hand": 45,
    "print": 25,
    "image": 30,
    "code": 65,
    "tokens": 45,
    "imageTreatment": "study"
  }
].map(Object.freeze));
export const MEDIA_STAGES=Object.freeze(['time','inscription','print','image','binary','tokens','artwork']);
// Full Adjust the traces domain: five independent strengths (0..100),
// traces may be absent, and the original study/crop image treatment.
export function traceMix(seed,joinedAt){
 if(!/^0x[\da-f]{64}$/i.test(seed)||!Number.isSafeInteger(joinedAt)||joinedAt<=0)throw Error('Invalid trace identity.');
 const mask=(1n<<64n)-1n;
 let state=0xcbf29ce484222325n;
 for(const character of seed.toLowerCase()+':'+joinedAt)state=((state^BigInt(character.charCodeAt(0)))*0x100000001b3n)&mask;
 function next(){state=(state+0x9e3779b97f4a7c15n)&mask;let z=state;z=((z^(z>>30n))*0xbf58476d1ce4e5b9n)&mask;z=((z^(z>>27n))*0x94d049bb133111ebn)&mask;return (z^(z>>31n))&mask}
 const mix={};for(const key of ['hand','print','image','code','tokens']){const n=next();mix[key]=n%4n===0n?0:Number((n>>2n)%101n)}
 // A valid account must have visible material, even if all sampled traces were absent.
 if(Object.values(mix).every(n=>n===0))mix.tokens=30+Number(next()%71n);
 mix.imageTreatment=next()%2n===0n?'study':'crop';
 return mix;
}
