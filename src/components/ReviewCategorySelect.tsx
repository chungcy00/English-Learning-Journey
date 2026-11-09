import React,{useEffect,useId,useRef,useState} from 'react';
import {Check,ChevronDown} from 'lucide-react';
import type {ReviewCategory} from '../utils/reviewCategories';
import {categoryLabels} from '../utils/vocabularyDetails';
export function AnchoredSelect({value,options,disabled,onChange,ariaLabel,placeholder,className=''}:{value:string;options:{value:string;label:string}[];disabled:boolean;onChange:(value:string)=>void;ariaLabel:string;placeholder?:string;className?:string}) {
 const [open,setOpen]=useState(false);const [active,setActive]=useState(0);const root=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);const id=useId();
 const label=(category:string)=>options.find(option=>option.value===category)?.label||placeholder||'';
 const choose=(category:string)=>{setOpen(false);trigger.current?.focus({preventScroll:true});onChange(category);};
 useEffect(()=>{const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 useEffect(()=>{if(!open)return;const menu=root.current?.querySelector<HTMLElement>('[role="listbox"]');const item=document.getElementById(`${id}-${active}`);if(!menu||!item)return;const top=item.offsetTop,bottom=top+item.offsetHeight;if(top<menu.scrollTop)menu.scrollTop=top;else if(bottom>menu.scrollTop+menu.clientHeight)menu.scrollTop=bottom-menu.clientHeight;},[open,active,id]);
 return <div ref={root} className={`anchored-select ${className}`} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}}>
   <button ref={trigger} type="button" role="combobox" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined} aria-activedescendant={open?`${id}-${active}`:undefined} disabled={disabled} onClick={()=>{setActive(Math.max(0,options.findIndex(option=>option.value===value)));setOpen(!open);}} onKeyDown={event=>{
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();setOpen(true);setActive(index=>event.key==='Home'?0:event.key==='End'?options.length-1:!open?Math.max(0,options.findIndex(option=>option.value===value)):Math.max(0,Math.min(options.length-1,index+(event.key==='ArrowDown'?1:-1))));}
    else if(event.key==='Escape'){event.preventDefault();setOpen(false);}
    else if(open&&['Enter',' '].includes(event.key)){event.preventDefault();choose(options[active].value);}
   }}>{label(value)}<ChevronDown size={14} aria-hidden="true"/></button>
   {open&&<div id={id} role="listbox" aria-label={`${ariaLabel}选项`} className="review-category-options">{options.map(({value:category},index)=><button id={`${id}-${index}`} type="button" key={category} role="option" aria-selected={value===category} tabIndex={-1} data-active={active===index||undefined} onPointerMove={()=>setActive(index)} onClick={()=>choose(category)}>{label(category)}{value===category&&<Check size={14} aria-hidden="true"/>}</button>)}</div>}
 </div>;
}

export function ReviewCategorySelect({value,categories,disabled,onChange}:{value:ReviewCategory;categories:Exclude<ReviewCategory,'all'>[];disabled:boolean;onChange:(value:ReviewCategory)=>void}) {
 return <AnchoredSelect ariaLabel="复习类别" className="random-review__category" value={value} disabled={disabled} options={[{value:'all',label:'全部类别'},...categories.map(category=>({value:category,label:categoryLabels[category]}))]} onChange={category=>onChange(category as ReviewCategory)}/>;
}
