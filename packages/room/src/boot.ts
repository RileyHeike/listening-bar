import type { Phase } from '@bar/core';
import { DEFAULT_PHASE, PHASE_SCHEDULE } from '@bar/core';
import { STORAGE_KEYS } from './stores.ts';

/** JSON safe to embed in an inline <script>. */
const inlineJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/**
 * Inline <head> script that sets <html> data attributes before first paint,
 * so a returning visitor with the lights up never sees a dim flash, and the
 * room renders in the right phase immediately. Mirrors the runtime's logic
 * (tested against it); the runtime takes over once loaded.
 */
export function bootScript(options: { timeZone: string; defaultPhase?: Phase }): string {
  const schedule = PHASE_SCHEDULE.map(({ phase, from, to }) => [phase, from, to]);
  return `(function(){
var d=document.documentElement,s=${inlineJson(schedule)},p=${inlineJson(options.defaultPhase ?? DEFAULT_PHASE)};
function g(k){try{return localStorage.getItem(k)}catch(e){return null}}
var l=g(${inlineJson(STORAGE_KEYS.lights)})==='up'?'up':'dim',sd=g(${inlineJson(STORAGE_KEYS.side)})==='B'?'B':'A',r=false;
try{var h=Number(new Intl.DateTimeFormat('en-US',{timeZone:${inlineJson(options.timeZone)},hour:'numeric',hourCycle:'h23'}).formatToParts(new Date()).filter(function(x){return x.type==='hour'})[0].value);
for(var i=0;i<s.length;i++){var w=s[i];if(w[1]<=w[2]?(h>=w[1]&&h<w[2]):(h>=w[1]||h<w[2])){p=w[0];break}}}catch(e){}
try{r=matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
d.setAttribute('data-lights',l);d.setAttribute('data-side',sd);d.setAttribute('data-phase',p);
d.setAttribute('data-motion',r||l==='up'?'off':'on');d.setAttribute('data-js','');
})();`;
}
