import React, {useEffect,useRef,useState} from 'react';
export function SwipeToRemove({label,disabled,onRemove,children}:{key?:string;label:string;disabled:boolean;onRemove:()=>Promise<void>;children:React.ReactNode}) {
 const [open,setOpen]=useState(false);const [offset,setOffset]=useState<number|null>(null);
 const gesture=useRef<{id:number;x:number;y:number;horizontal:boolean}|null>(null);const suppress=useRef(false);
 useEffect(()=>{if(disabled){setOpen(false);setOffset(null);gesture.current=null;}},[disabled]);
 const close=()=>{gesture.current=null;setOffset(null);};
 return <div className="reading-swipe" role="listitem" tabIndex={0} aria-label={disabled?label:`${label}，左滑显示删除`} onKeyDown={event=>{if(disabled||event.target!==event.currentTarget)return;if(event.key==='ArrowLeft'){event.preventDefault();setOpen(true);}if(event.key==='Escape'||event.key==='ArrowRight'){event.preventDefault();setOpen(false);}}}>
   <button type="button" className="reading-swipe__delete" style={{visibility:!disabled&&(open||(offset??0)<0)?'visible':'hidden',pointerEvents:!disabled&&open?'auto':'none'}} aria-label={`删除 ${label}`} disabled={disabled} tabIndex={open&&!disabled?0:-1} aria-hidden={disabled||!open} onClick={()=>void onRemove()}>删除</button>
   <div className="reading-swipe__content" style={{transform:`translateX(${disabled?0:(offset??(open?-72:0))}px)`,transition:offset===null?undefined:'none'}} onPointerDown={event=>{if(event.button!==0||(event.target as Element).closest('input,textarea,select,[role="combobox"],[data-swipe-ignore]'))return;suppress.current=false;gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,horizontal:false};}} onPointerMove={event=>{const start=gesture.current;if(!start||start.id!==event.pointerId)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(!start.horizontal&&Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>10){close();return;}if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){start.horizontal=true;suppress.current=true;event.currentTarget.setPointerCapture(event.pointerId);if(!disabled)setOffset(Math.max(-72,Math.min(0,(open?-72:0)+dx)));}}} onPointerUp={event=>{const start=gesture.current;if(start?.id===event.pointerId&&start.horizontal){if(!disabled)setOpen((offset??0)<-30);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}close();}} onPointerCancel={close} onClickCapture={event=>{if(suppress.current){event.preventDefault();event.stopPropagation();suppress.current=false;}}}>
    {children}
   </div>
 </div>;
}
