export const SK={team:"avq-t",cfg:"avq-c",journal:"avq-j",month:(y,m)=>`avq-m-${y}-${m}`};

const hasWindowStorage=()=>typeof window!=="undefined"&&window.storage&&window.storage.get&&window.storage.set;

const fallback={
  async get(k){const value=localStorage.getItem(k);return value?{value}:null;},
  async set(k,v){localStorage.setItem(k,v);},
};

const backend=()=>hasWindowStorage()?window.storage:fallback;

export const sS=async(k,v)=>{try{await backend().set(k,JSON.stringify(v));}catch(e){console.warn('storage.set failed',e);}};
export const sL=async k=>{try{const r=await backend().get(k);return r?JSON.parse(r.value):null;}catch(e){console.warn('storage.get failed',e);return null;}};

export async function hashCode(code){
  if(!code) return "";
  const data=new TextEncoder().encode(code);
  const digest=await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
