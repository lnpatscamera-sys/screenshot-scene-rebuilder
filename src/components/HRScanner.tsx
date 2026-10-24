import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
export function HRScanner({onResult,onClose}:{onResult:(value:string)=>Promise<void>;onClose:()=>void}){
 const video=useRef<HTMLVideoElement>(null);const callback=useRef(onResult);callback.current=onResult;const [error,setError]=useState('');
 useEffect(()=>{let active=true;let controls:{stop:()=>void}|undefined;let busy=false;
  void import('@zxing/browser').then(async({BrowserQRCodeReader})=>{if(!active||!video.current)return;const reader=new BrowserQRCodeReader();const started=await reader.decodeFromVideoDevice(undefined,video.current,(result)=>{if(!result||busy||!active)return;busy=true;void callback.current(result.getText()).catch(e=>{setError(e instanceof Error?e.message:'Check-in failed');busy=false;});});controls=started;if(!active)started.stop();}).catch(()=>setError('Camera unavailable. Allow camera access and try again.'));
  return()=>{active=false;controls?.stop();};
 },[]);
 return <Dialog open onOpenChange={o=>!o&&onClose()}><DialogContent><DialogHeader><DialogTitle>QR attendance</DialogTitle></DialogHeader><video ref={video} className="w-full aspect-video bg-muted rounded-md" muted playsInline/>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</DialogContent></Dialog>;
}