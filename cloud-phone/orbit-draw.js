(() => {
  'use strict';
  const TAU=Math.PI*2, NS={high:'#f3894b',low:'#758fff',current:'#dce4d3',previous:'#b5a2d5',activity:'#a1ceb2',stress:'#b5a2d5',other:'#edf0e5',food:'#cedd9c'};
  const angle=m=>m/1440*TAU-Math.PI/2;
  const pos=(m,r)=>[400+Math.cos(angle(m))*r,400+Math.sin(angle(m))*r];
  const radius=v=>Math.min(330,Math.max(143,200+(v-3.9)*15));
  const at=(points,minute,key='mean')=>{
    if(!points?.length)return null;
    const sorted=points.filter(p=>p[key]!==null && Number.isFinite(p[key]));
    if(!sorted.length)return null;
    const nearest=sorted.reduce((best,p)=>Math.abs(p.minute-minute)<Math.abs(best.minute-minute)?p:best,sorted[0]);
    return Math.abs(nearest.minute-minute)<=20?nearest[key]:null;
  };
  class OrbitCanvas {
    constructor(canvas,{mini=false}={}){this.canvas=canvas;this.mini=mini;this.ctx=canvas.getContext('2d');this.selected=null;this.mode='rhythm';this.hoverMinute=null;}
    draw(state,mode=this.mode){
      this.state=state;this.mode=mode;const c=this.ctx,dpr=Math.min(window.devicePixelRatio||1,2);
      const display=Math.max(1,this.canvas.getBoundingClientRect().width);
      if(this.canvas.width!==Math.round(display*dpr)){this.canvas.width=Math.round(display*dpr);this.canvas.height=this.canvas.width;}
      c.setTransform(this.canvas.width/800,0,0,this.canvas.height/800,0,0);c.clearRect(0,0,800,800);c.lineCap='round';
      if(!state)return;
      if(mode==='days'){this.days(state);return;}
      const minute=state.clockMinute;
      // Clock context, not a real-time reading or alert.
      if(!state.hideClock)this.sector(minute-60,minute+60,'rgba(181,162,213,.065)',340);
      if(mode==='focus'&&state.focus)this.sector(state.focus.start,state.focus.end,'rgba(206,221,156,.045)',345);
      this.circle(200,'rgba(181,162,213,.30)',.85);this.circle(radius(10),'rgba(181,162,213,.30)',.85);
      if(!this.mini){this.label('3.9',445,584,'#8f809f',11);this.label('10.0',468,675,'#8f809f',11);}
      this.curve(state.previousProfile, p=>radius(p.mean),NS.previous,1.8,.43);
      this.curve(state.profile,p=>radius(p.mean),NS.current,2.2,.9);
      // Clip a coloured copy at the actual threshold circles, never by a smoothed event score.
      c.save();c.beginPath();c.rect(0,0,800,800);c.arc(400,400,radius(10),0,TAU,true);c.clip('evenodd');this.curve(state.profile,p=>radius(p.mean),NS.high,3,1);c.restore();
      c.save();c.beginPath();c.arc(400,400,200,0,TAU);c.clip();this.curve(state.profile,p=>radius(p.mean),NS.low,3,1);c.restore();
      for(const b of state.profile){if(b.mean===null)continue;for(const kind of ['high','low']){const fraction=b[kind+'Fraction'];if(fraction>.02){const r=kind==='high'?radius(10)+15:181;this.arc(b.minute-9,b.minute+9,r,NS[kind],1.5+fraction*9,.28+fraction*.65);}}}
      if(state.focus){this.arc(state.focus.start,state.focus.end,344,'#cedd9c',1.1,.55);const fraction=Math.min(1,(state.focus.elapsedDays+1)/7);this.arc(state.focus.start,state.focus.start+(state.focus.end-state.focus.start)*fraction,344,'#cedd9c',2.3,.85);}
      if(this.hoverMinute!==null)this.sector(this.hoverMinute-45,this.hoverMinute+45,'rgba(181,162,213,.09)',337);
      this.events(state.events);if(!this.mini)this.clocks();
    }
    curve(points,r,col,width,alpha,maxGap=35){
      const c=this.ctx;c.strokeStyle=col;c.lineWidth=width;c.globalAlpha=alpha;let running=false,previous=null;
      c.beginPath();
      for(const p of points){if(p.mean===null){running=false;previous=null;continue;}const [x,y]=pos(p.minute,r(p));if(!running){c.moveTo(x,y);running=true;}else if(p.minute>=previous.minute&&p.minute-previous.minute<=maxGap){const mid=(p.minute+previous.minute)/2,pr=pos(mid,(r(p)+r(previous))/2);c.quadraticCurveTo(...pr,x,y);}else c.moveTo(x,y);previous=p;}
      if(maxGap===35&&points.length===48&&points[0].mean!==null&&points[47].mean!==null){const end=pos(points[0].minute+1440,r(points[0]));c.lineTo(...end);}
      c.stroke();c.globalAlpha=1;
    }
    days(state){
      const c=this.ctx;
      for(let i=0;i<state.days.length;i++){
        const day=state.days[i],chosen=this.selected===i,fade=state.mutedDays?.28:(this.selected===null||chosen?1:.16);
        const pts=day.points.map(p=>({minute:p.minute,mean:p.value}));const r=p=>Math.max(115,Math.min(338,168+i*22+(p.mean-6.8)*7));
        this.curve(pts,r,NS.current,chosen?2.5:1.3,.46*fade,12);
        if(state.mutedDays)continue;
        for(let n=1;n<pts.length;n++){
          const a=pts[n-1],b=pts[n];if(b.minute<a.minute||b.minute-a.minute>12)continue;
          // Interpolate threshold crossings so orange/blue stops at the boundary.
          const cuts=[0,1];for(const level of [3.9,10])if((a.mean-level)*(b.mean-level)<0)cuts.push((level-a.mean)/(b.mean-a.mean));cuts.sort((x,y)=>x-y);
          for(let j=1;j<cuts.length;j++){const t0=cuts[j-1],t1=cuts[j],value=a.mean+(b.mean-a.mean)*(t0+t1)/2,col=value>10?NS.high:value<3.9?NS.low:null;if(!col)continue;c.strokeStyle=col;c.lineWidth=chosen?3.6:2.1;c.globalAlpha=fade*.9;c.beginPath();for(let k=0;k<=3;k++){const t=t0+(t1-t0)*k/3,p={minute:a.minute+(b.minute-a.minute)*t,mean:a.mean+(b.mean-a.mean)*t};const xy=pos(p.minute,r(p));k?c.lineTo(...xy):c.moveTo(...xy);}c.stroke();}
        }
        if(chosen){this.circle(168+i*22,'rgba(181,162,213,.4)',.9);this.events(state.events.filter(e=>this.dayOf(e.at,state.timezone)===day.date),168+i*22);}
      }c.globalAlpha=1;if(!this.mini)this.clocks();
    }
    dayOf(stamp,tz){return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(stamp));}
    events(events,r=354){
      const state=this.state;
      for(const [i,e] of [...events].reverse().entries()){
        const parts=new Intl.DateTimeFormat('en-GB',{timeZone:state.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(e.at)).split(':');const m=+parts[0]*60 + +parts[1],xy=pos(m,r+(i%3)*5),c=this.ctx;
        c.globalAlpha=this.dayOf(e.at,state.timezone)===state.today?.substring(0,10)?1:.35;c.strokeStyle=NS[e.kind]||NS.other;c.fillStyle=NS[e.kind]||NS.other;c.lineWidth=1.3;c.beginPath();c.arc(...xy,3.4,0,TAU);e.kind==='other'?c.stroke():c.fill();
      }this.ctx.globalAlpha=1;
    }
    pointer(event){const b=this.canvas.getBoundingClientRect(),x=(event.clientX-b.left)/b.width*800-400,y=(event.clientY-b.top)/b.height*800-400,m=((Math.atan2(y,x)+Math.PI/2+TAU)%TAU)/TAU*1440,r=Math.hypot(x,y);return {minute:m,r};}
    pick(event){if(!this.state)return null;const {minute,r}=this.pointer(event);if(r<115||r>355)return null;let best=null,dist=Infinity;this.state.days.forEach((day,i)=>{if(!day.points.length)return;const value=at(day.points,minute,'value');const rr=168+i*22+((value??6.8)-6.8)*7;const d=Math.abs(r-rr);if(d<dist){best=i;dist=d;}});this.selected=best;this.hoverMinute=minute;return best;}
    circle(r,col,width){const c=this.ctx;c.globalAlpha=1;c.strokeStyle=col;c.lineWidth=width;c.beginPath();c.arc(400,400,r,0,TAU);c.stroke();}
    arc(a,b,r,col,width,alpha=1){const c=this.ctx;c.strokeStyle=col;c.lineWidth=width;c.globalAlpha=alpha;c.beginPath();c.arc(400,400,r,angle(a),angle(b));c.stroke();c.globalAlpha=1;}
    sector(a,b,col,r){const c=this.ctx;c.fillStyle=col;c.globalAlpha=1;c.beginPath();c.moveTo(400,400);c.arc(400,400,r,angle(a),angle(b));c.closePath();c.fill();}
    label(text,x,y,col,size){const c=this.ctx;c.fillStyle=col;c.globalAlpha=1;c.font=`${size}px -apple-system, sans-serif`;c.textAlign='center';c.fillText(text,x,y);}
    clocks(){for(const [m,t] of [[0,'night'],[360,'morning'],[720,'noon'],[1080,'evening']]){const p=pos(m,370);this.label(t,...p,'#7e8b77',10);}}
  }
  window.OrbitCanvas=OrbitCanvas;
  window.OrbitMath={radius,at,angle,pos};
})();
