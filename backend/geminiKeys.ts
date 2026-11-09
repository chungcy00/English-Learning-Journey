import {GoogleGenAI} from '@google/genai';
import type {Response} from 'express';
type Env=Record<string,string|undefined>;
export function configuredGeminiKeys(env:Env=process.env){
 return [...new Set(['GEMINI_API_KEY','GEMINI_API_KEY_2','GEMINI_API_KEY_3'].map(name=>env[name]?.trim()||'').filter(value=>value&&!/^(MY_|YOUR_|PASTE_|REPLACE_)/i.test(value)))];
}
export class GeminiProviderError extends Error {
 constructor(public status:number,message:string,public retryAfter=60){super(message);this.name='GeminiProviderError';}
}
export function providerStatus(error:any):number {
 const status=Number(error?.status||error?.code);if(Number.isFinite(status)&&status>=100&&status<600)return status;
 const message=String(error?.message||'');
 if(/RESOURCE_EXHAUSTED|Quota exceeded|exceeded your current quota/i.test(message))return 429;
 if(/UNAVAILABLE|high demand/i.test(message))return 503;
 if(/UNAUTHENTICATED|API_KEY_INVALID/i.test(message))return 401;
 if(/PERMISSION_DENIED/i.test(message))return 403;
 if(/NOT_FOUND|is no longer available/i.test(message))return 404;
 return 0;
}
function providerRetrySeconds(error:any){
 const direct=Number(error?.retryAfter);if(Number.isFinite(direct)&&direct>0)return Math.min(direct,86400);
 const match=String(error?.message||'').match(/retryDelay["\s:]+([\d.]+)s|retry in ([\d.]+)s/i);
 return match?Math.max(1,Math.min(86400,Math.ceil(Number(match[1]||match[2])))):60;
}
export class GeminiKeyPool {
 private cursor=0;
 private blockedUntil=new Map<string,number>();
 private clients=new Map<string,GoogleGenAI>();
 private blockedStatus=new Map<string,number>();
 constructor(private readKeys=()=>configuredGeminiKeys()){}
 get size(){return this.readKeys().length;}
 select(now=Date.now()){
  const keys=this.readKeys();
  if(!keys.length)throw new GeminiProviderError(503,'GEMINI_API_KEY 尚未配置');
  for(let offset=0;offset<keys.length;offset++){
   const index=(this.cursor+offset)%keys.length;const key=keys[index];
   if((this.blockedUntil.get(key)||0)>now)continue;
   this.cursor=(index+1)%keys.length;
   let client=this.clients.get(key);
   if(!client){client=new GoogleGenAI({apiKey:key,httpOptions:{retryOptions:{attempts:1},headers:{'User-Agent':'aistudio-build'}}});this.clients.set(key,client);}
   return {key,slot:index+1,client};
  }
  const seconds=Math.max(1,Math.ceil(Math.min(...keys.map(key=>(this.blockedUntil.get(key)||now)-now))/1000));
  const status=keys.some(key=>this.blockedStatus.get(key)===429)?429:401;
  throw new GeminiProviderError(status,status===429?'Gemini 服务暂时限制请求，请稍后重试。':'Gemini Key 暂不可用。',seconds);
 }
 failed(key:string,error:unknown,now=Date.now()){
  const status=providerStatus(error);
  if([429,401,403].includes(status))this.blockedStatus.set(key,status);
  if(status===429)this.blockedUntil.set(key,now+providerRetrySeconds(error)*1000);
  else if(status===401||status===403)this.blockedUntil.set(key,now+300_000);
 }
}
export const geminiKeys=new GeminiKeyPool();
export function sendGeminiError(res:Response,error:any){
 const status=providerStatus(error);
 if(status===429){const retryAfter=Math.ceil(error?.retryAfter||60);res.setHeader('Retry-After',String(retryAfter));res.status(429).json({code:'GENERATION_PROVIDER_LIMIT',error:'Gemini 服务暂时限制请求，请稍后重试。',retryAfter});return true;}
 if(status===401||status===403||String(error?.message||'').includes('GEMINI_API_KEY')){res.status(503).json({code:'GENERATION_NOT_CONFIGURED',error:'Gemini Key 暂不可用，请检查服务端配置。'});return true;}
 return false;
}
