import { PAL, TIDS, WE_ONLY } from './constants.js';

export const dim=(y,m)=>new Date(y,m+1,0).getDate();
export const dowD=(y,m,d)=>(new Date(y,m,d).getDay()+6)%7;
export const rgb=h=>`${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)}`;
export const tsNow=()=>new Date().toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
export const vCode=c=>/^\d{8}[A-Za-z]$/.test(c);

export const getBlocks=(y,m)=>{
  const n=dim(y,m);const B=[];let d=1;
  while(d<=n){const dw=dowD(y,m,d);const t=dw<=3?"wd":"we";let e=d;
    while(e<n){const nd=dowD(y,m,e+1);if((t==="wd"&&nd>=4)||(t==="we"&&nd<=3))break;e++;}
    B.push({type:t,start:d,end:e,idx:B.length});d=e+1;}
  return B;
};

export const buildSched=(y,m,swi,bOv,names,stat,inh=null)=>{
  const blks=getBlocks(y,m);
  const team=TIDS.map((id,i)=>({id,...PAL[i],...names[id]}));
  const wdT=team.filter(t=>t.id!==WE_ONLY);
  const weT=team;
  const abs=id=>stat?.[id]==="absent";
  const avWd=wdT.filter(t=>!abs(t.id));
  const fw=dowD(y,m,1)>=5;

  const weM={};let wri=swi;
  for(const b of blks.filter(x=>x.type==="we")){
    if(bOv[b.idx]!=null){weM[b.idx]=bOv[b.idx];const p=weT.findIndex(t=>t.id===bOv[b.idx]);if(p>=0)wri=(p+1)%weT.length;continue;}
    if(b.idx===0&&fw&&inh){weM[b.idx]=inh;const p=weT.findIndex(t=>t.id===inh);wri=((p>=0?p:wri)+1)%weT.length;continue;}
    let w=null;for(let i=0;i<weT.length;i++){const c=weT[(wri+i)%weT.length];if(!abs(c.id)){w=c;wri=(weT.indexOf(c)+1)%weT.length;break;}}
    if(!w){w=weT[wri%weT.length];wri=(wri+1)%weT.length;}
    weM[b.idx]=w.id;
  }

  const wdM={};let wdi=0,skipId=null,prevId=null,dup=0;
  for(const b of blks.filter(x=>x.type==="wd")){
    if(bOv[b.idx]!=null){
      const wid=bOv[b.idx];wdM[b.idx]=wid;
      const nb=blks[b.idx+1];skipId=(nb&&nb.type==="we"&&weM[nb.idx]!==WE_ONLY)?weM[nb.idx]:null;
      dup=wid===prevId?dup+1:0;prevId=wid;
      const p=avWd.findIndex(t=>t.id===wid);if(p>=0)wdi=(p+1)%avWd.length;continue;
    }
    const nb=blks[b.idx+1];
    const sw=(nb&&nb.type==="we")?weM[nb.idx]:null;
    const hard=new Set([skipId,sw].filter(id=>id&&id!==WE_ONLY));
    const cur=avWd.length?avWd[wdi%avWd.length]:null;
    let w=null;
    if(cur&&!hard.has(cur.id)){w=cur;wdi=(wdi+1)%avWd.length;dup=0;}
    else{
      let f=false;
      for(let i=1;i<avWd.length;i++){const c=avWd[(wdi+i)%avWd.length];if(!hard.has(c.id)){w=c;wdi=(avWd.indexOf(c)+1)%avWd.length;dup=0;f=true;break;}}
      if(!f){
        if(dup<1){w=avWd.length?avWd[wdi%avWd.length]:null;if(w){wdi=(wdi+1)%avWd.length;dup++;}}
        else{for(let i=0;i<avWd.length;i++){const c=avWd[(wdi+i)%avWd.length];if(c.id!==prevId){w=c;wdi=(avWd.indexOf(c)+1)%avWd.length;dup=0;break;}}
          if(!w){w=avWd.length?avWd[wdi%avWd.length]:wdT[0];wdi=(wdi+1)%Math.max(avWd.length,1);}}
      }
    }
    if(!w)w=avWd.length?avWd[0]:wdT[0];
    wdM[b.idx]=w.id;prevId=w.id;
    skipId=(sw&&sw!==WE_ONLY)?sw:null;
  }

  const asgn=blks.map(b=>({...b,workerId:b.type==="we"?weM[b.idx]:wdM[b.idx],cross:b.idx===0&&fw&&!!inh&&bOv[b.idx]==null}));
  const sc={};
  for(const a of asgn)for(let d=a.start;d<=a.end;d++)sc[d]={worker:a.workerId,bi:a.idx,bt:a.type,bs:a.start,be:a.end,cross:a.cross};
  return{sched:sc,blks:asgn};
};
