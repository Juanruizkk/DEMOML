import{c,j as e,e as y}from"./index-C3-JjcMw.js";/**
 * @license lucide-react v1.45.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m={name:"chevron-left",size:24,node:[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]};m.node;const z=c(m);/**
 * @license lucide-react v1.45.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p={name:"chevrons-left",size:24,node:[["path",{d:"m11 17-5-5 5-5",key:"13zhaf"}],["path",{d:"m18 17-5-5 5-5",key:"h8a8et"}]]};p.node;const _=c(p);/**
 * @license lucide-react v1.45.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g={name:"chevrons-right",size:24,node:[["path",{d:"m6 17 5-5-5-5",key:"xnjwq"}],["path",{d:"m13 17 5-5-5-5",key:"17xmmf"}]]};g.node;const C=c(g);/**
 * @license lucide-react v1.45.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x={name:"circle-check",size:24,node:[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m16 9-5.5 5.5L8 12",key:"xofnsj"}]],aliases:["check-circle-2"]};x.node;const M=c(x);/**
 * @license lucide-react v1.45.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j={name:"external-link",size:24,node:[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]]};j.node;const P=c(j);function $({pagination:u,onPageChange:i,onLimitChange:r,itemName:b="elementos",pageSizeOptions:k=[10,20,50]}){const{page:n,limit:l,total:o,totalPages:a,hasNext:d,hasPrev:h}=u;if(o===0)return null;const v=(n-1)*l+1,f=Math.min(n*l,o),N=()=>{const s=[];if(a<=7)for(let t=1;t<=a;t++)s.push(t);else n<=4?s.push(1,2,3,4,5,"...",a):n>=a-3?s.push(1,"...",a-4,a-3,a-2,a-1,a):s.push(1,"...",n-1,n,n+1,"...",a);return s};return e.jsxs("div",{className:"pagination-bar glass-panel",children:[e.jsxs("div",{className:"pagination-info",children:[e.jsxs("span",{className:"pagination-range",children:["Mostrando ",e.jsx("strong",{children:v})," - ",e.jsx("strong",{children:f})," de"," ",e.jsx("strong",{children:o})," ",b]}),r&&e.jsxs("div",{className:"pagination-limit-picker",children:[e.jsx("span",{className:"limit-label",children:"Por pág:"}),e.jsx("select",{className:"limit-select",value:l,onChange:s=>r(Number(s.target.value)),children:k.map(s=>e.jsx("option",{value:s,children:s},s))})]})]}),e.jsxs("div",{className:"pagination-actions",children:[e.jsx("button",{className:"page-btn page-btn-icon",onClick:()=>i(1),disabled:!h||n===1,title:"Primera página",children:e.jsx(_,{size:16})}),e.jsx("button",{className:"page-btn page-btn-icon",onClick:()=>i(n-1),disabled:!h,title:"Página anterior",children:e.jsx(z,{size:16})}),e.jsx("div",{className:"page-numbers",children:N().map((s,t)=>typeof s=="number"?e.jsx("button",{className:`page-btn page-num${n===s?" active":""}`,onClick:()=>i(s),children:s},t):e.jsx("span",{className:"page-ellipsis",children:s},t))}),e.jsx("button",{className:"page-btn page-btn-icon",onClick:()=>i(n+1),disabled:!d,title:"Página siguiente",children:e.jsx(y,{size:16})}),e.jsx("button",{className:"page-btn page-btn-icon",onClick:()=>i(a),disabled:!d||n===a,title:"Última página",children:e.jsx(C,{size:16})})]})]})}export{M as C,P as E,$ as P};
