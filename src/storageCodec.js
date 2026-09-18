const PREFIX='lz16:';
export function encodeStore(text){
 if(text.length<32768)return text;
 const input=new TextEncoder().encode(text);let dict=new Map(),next=256,word='',codes=[];
 for(const byte of input){const char=String.fromCharCode(byte),combined=word+char;if(dict.has(combined)||combined.length===1){word=combined;continue;}codes.push(word.length===1?word.charCodeAt(0):dict.get(word));if(next<65535)dict.set(combined,next++);word=char;}
 if(word)codes.push(word.length===1?word.charCodeAt(0):dict.get(word));
 let binary='';for(const code of codes)binary+=String.fromCharCode(code>>8,code&255);
 const encoded=PREFIX+btoa(binary);return encoded.length<text.length?encoded:text;
}
export function decodeStore(text){
 if(!text.startsWith(PREFIX))return text;
 const binary=atob(text.slice(PREFIX.length));let dict=[],next=256,word='',chunks=[];
 for(let i=0;i<binary.length;i+=2){const code=(binary.charCodeAt(i)<<8)|binary.charCodeAt(i+1);const entry=code<256?String.fromCharCode(code):dict[code]??(code===next?word+word[0]:null);if(entry==null)throw new Error('Invalid stored data');chunks.push(entry);if(word&&next<65535)dict[next++]=word+entry[0];word=entry;}
 const joined=chunks.join('');return new TextDecoder().decode(Uint8Array.from(joined,c=>c.charCodeAt(0)));
}
