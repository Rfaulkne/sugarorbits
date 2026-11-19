/* Actual post-event samples only. No smoothing or gap filling. */
((root)=>{
  'use strict';
  function trace(rows,start,hours,now=Date.now()){
    const end=start+hours*3600000,until=Math.min(end,now),unique=new Map();
    for(const row of rows){const t=Date.parse(row.recorded_at),v=Number(row.value_mg_dl);
      if(Number.isFinite(t)&&t>=start&&t<=until&&Number.isFinite(v)&&v>=20&&v<=600)unique.set(t,{t,v:v/18});}
    const points=[...unique.values()].sort((a,b)=>a.t-b.t),segments=[];
    for(const p of points){const last=segments.at(-1);if(!last||p.t-last.at(-1).t>600000)segments.push([p]);else last.push(p);}
    return {start,end,until,points,segments,pending:end>now,min:Math.min(2,...points.map(p=>p.v))-0.5,max:Math.max(12,...points.map(p=>p.v))+0.5};
  }
  function draw(canvas,data){
    if(!canvas?.getContext||!canvas.getBoundingClientRect)return;
    const width=canvas.getBoundingClientRect().width;if(!width)return;
    const height=250,dpr=Math.min(root.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=height*dpr;
    const c=canvas.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,width,height);if(!data)return;
    const left=10,right=width-42,top=18,bottom=211;
    const x=t=>left+(t-data.start)/(data.end-data.start)*(right-left),y=v=>bottom-(v-data.min)/(data.max-data.min)*(bottom-top);
    c.fillStyle='rgba(180,164,208,.13)';c.fillRect(left,y(10),right-left,y(3.9)-y(10));
    c.font='12px system-ui';c.fillStyle='#c4b5de';c.fillText('10',right+7,y(10)+4);c.fillText('3.9',right+7,y(3.9)+4);
    if(data.pending){c.fillStyle='rgba(180,164,208,.06)';c.fillRect(x(data.until),top,right-x(data.until),bottom-top);}
    c.strokeStyle='#747d77';c.lineWidth=1;c.beginPath();c.moveTo(left,bottom+4);c.lineTo(right,bottom+4);c.stroke();
    c.fillStyle='#aab3aa';c.textAlign='center';
    for(let h=0;h<=(data.end-data.start)/3600000;h++){c.fillText(h===0?'Tap':'+'+h+'h',x(data.start+h*3600000),237);}c.textAlign='left';
    function stroke(color){c.strokeStyle=color;c.fillStyle=color;c.lineWidth=2;c.lineJoin='round';c.lineCap='round';
      for(const segment of data.segments){c.beginPath();segment.forEach((p,i)=>i?c.lineTo(x(p.t),y(p.v)):c.moveTo(x(p.t),y(p.v)));c.stroke();
        for(const p of segment){c.beginPath();c.arc(x(p.t),y(p.v),1.5,0,Math.PI*2);c.fill();}}}
    stroke('#dce3d9');
    for(const [value,color,above] of [[10,'#ef873d',true],[3.9,'#6288ff',false]]){c.save();c.beginPath();c.rect(left,above?top:y(value),right-left,above?y(value)-top:bottom-y(value));c.clip();stroke(color);c.restore();}
  }
  const api={trace,draw};if(typeof module!=='undefined')module.exports=api;root.OrbitAfterMoment=api;
})(typeof window!=='undefined'?window:globalThis);
