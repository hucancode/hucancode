import{s as T,o as P,L as I,p as D}from"./scheduler.41f8b318.js";import{S as $,i as O,b as z,d as F,m as N,a as R,t as k,e as C}from"./Component.fac7962a.js";import{M as E,b as A,I as j,n as W,R as V,F as G,o as b,N as U,W as B,e as H,P as X,A as Y,p as Z,S as q,a as J,k as K,i as Q,V as ee,m as te}from"./three.module.5208f804.js";import{l as ne}from"./utils.296a4f32.js";const w=4,v=1024,p=4;function oe(t=1){const e=new Float32Array(v*p*t*w),n=new W(e,v,p*t,V,G);return n.wrapS=b,n.wrapY=b,n.magFilter=U,n.needsUpdate=!0,n}function ae(t,e,n=0){const o=Math.floor(v*(p/4));e.arcLengthDivisions=o/2,e.updateArcLengths();const a=e.getSpacedPoints(o),c=e.computeFrenetFrames(o,!0);for(let r=0;r<o;r++){const i=Math.floor(r/v),f=r%v;let s=a[r];y(t,f,s.x,s.y,s.z,0+i+p*n),s=c.tangents[r],y(t,f,s.x,s.y,s.z,1+i+p*n),s=c.normals[r],y(t,f,s.x,s.y,s.z,2+i+p*n),s=c.binormals[r],y(t,f,s.x,s.y,s.z,3+i+p*n)}t.needsUpdate=!0}function y(t,e,n,o,a,c){const r=t.image,{data:i}=r,f=w*v*c;i[e*w+f+0]=n,i[e*w+f+1]=o,i[e*w+f+2]=a}function re(t,e=!0){return{spineTexture:{value:t},pathOffset:{type:"f",value:0},pathSegment:{type:"f",value:1},spineOffset:{type:"f",value:161},spineLength:{type:"f",value:400},flow:{type:"i",value:e?1:0}}}function se(t,e,n=1){t.__ok||(t.__ok=!0,t.onBeforeCompile=o=>{if(o.__modified)return;o.__modified=!0,Object.assign(o.uniforms,e);const a=`
		uniform sampler2D spineTexture;
		uniform float pathOffset;
		uniform float pathSegment;
		uniform float spineOffset;
		uniform float spineLength;
		uniform int flow;
		float textureLayers = ${p*n}.;
		float textureStacks = ${p/4}.;
		${o.vertexShader}
		`.replace("#include <beginnormal_vertex>","").replace("#include <defaultnormal_vertex>","").replace("#include <begin_vertex>","").replace(/void\s*main\s*\(\)\s*\{/,`
void main() {
#include <beginnormal_vertex>
vec4 worldPos = modelMatrix * vec4(position, 1.);
bool bend = flow > 0;
float xWeight = bend ? 0. : 1.;
#ifdef USE_INSTANCING
float pathOffsetFromInstanceMatrix = instanceMatrix[3][2];
float spineLengthFromInstanceMatrix = instanceMatrix[3][0];
float spinePortion = bend ? (worldPos.x + spineOffset) / spineLengthFromInstanceMatrix : 0.;
float mt = (spinePortion * pathSegment + pathOffset + pathOffsetFromInstanceMatrix)*textureStacks;
#else
float spinePortion = bend ? (worldPos.x + spineOffset) / spineLength : 0.;
float mt = (spinePortion * pathSegment + pathOffset)*textureStacks;
#endif
mt = mod(mt, textureStacks);
float rowOffset = floor(mt);
#ifdef USE_INSTANCING
rowOffset += instanceMatrix[3][1] * ${p}.;
#endif
vec3 spinePos = texture2D(spineTexture, vec2(mt, (0. + rowOffset + 0.5) / textureLayers)).xyz;
vec3 a =        texture2D(spineTexture, vec2(mt, (1. + rowOffset + 0.5) / textureLayers)).xyz;
vec3 b =        texture2D(spineTexture, vec2(mt, (2. + rowOffset + 0.5) / textureLayers)).xyz;
vec3 c =        texture2D(spineTexture, vec2(mt, (3. + rowOffset + 0.5) / textureLayers)).xyz;
mat3 basis = mat3(a, b, c);
vec3 transformed = basis
	* vec3(worldPos.x * xWeight, worldPos.y * 1., worldPos.z * 1.)
	+ spinePos;
vec3 transformedNormal = normalMatrix * (basis * objectNormal);
			`).replace("#include <project_vertex>",`vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
				gl_Position = projectionMatrix * mvPosition;`);o.vertexShader=a})}class ie{constructor(e,n=!0,o=1){const a=e.clone(),c=oe(o),r=re(c,n);a.traverse(function(i){(i instanceof A||i instanceof j)&&(i.material=i.material.clone(),se(i.material,r,o))}),this.curveArray=new Array(o),this.curveLengthArray=new Array(o),this.object3D=a,this.splineTexure=c,this.uniforms=r}updateCurve(e,n){if(e>=this.curveArray.length)throw Error("Index out of range for Flow");const o=n.getLength();this.uniforms.spineLength.value=o,this.curveLengthArray[e]=o,this.curveArray[e]=n,ae(this.splineTexure,n,e)}moveAlongCurve(e){this.uniforms.pathOffset.value+=e}}new E;let d,m,h,M,g=[],_=[],ce=new K;var l=0;let u,x;const S="dragon";function fe(){return g.length}async function le(){d=new H,M=await ne("dragon.glb")}function ue(t,e){m=new X(45,t/e,1,2e3),m.position.set(0,20,200),m.lookAt(d.position)}function pe(){x=new Y(14707),d.add(x),u=new Z(16777215),u.add(new A(new q(2,16,8),new J({color:16777215}))),d.add(u)}function me(){g.forEach(t=>d.remove(t.object3D)),g=[],_=[]}function L(){if(!M)return;const t=-40,e=80,n=-40,o=80,a=-80,c=160,r=Array.from({length:20},s=>({x:Math.random()*e+t,y:Math.random()*o+n,z:Math.random()*c+a}));let i=new Q(r.map(s=>new ee(s.x,s.y,s.z)));i.curveType="centripetal",i.closed=!0;let f=new ie(M);f.updateCurve(0,i),d.add(f.object3D),g.push(f),_.push(i)}async function de(){let t=document.getElementById(S),e=t.clientWidth,n=t.clientHeight;if(h=new B({canvas:t,antialias:!0,alpha:!0}),h.setPixelRatio(window.devicePixelRatio),h.setSize(e,n),addEventListener("resize",ge),d!=null){m.aspect=e/n,m.updateProjectionMatrix();return}await le(),ue(e,n),pe(),L()}function he(){h.dispose()}function ge(){let t=document.getElementById(S);if(!t)return;t.style="";let e=t.clientWidth,n=t.clientHeight;m.aspect=e/n,m.updateProjectionMatrix(),h.setSize(e,n)}function xe(){l+=ce.getDelta();for(let t=0;t<g.length;t++)g[t].updateCurve(0,_[t]),g[t].moveAlongCurve(.002);u&&(u.position.x=Math.sin(l*.7)*30+20,u.position.y=Math.cos(l*.5)*40,u.position.z=Math.cos(l*.3)*30+20,u.color.r=(Math.sin(l*.3)+1)*.5,u.color.g=(Math.sin(l*.7)+1)*.5,u.color.b=(Math.sin(l*.2)+1)*.5),x&&(x.color.r=(Math.sin(l*.1)+1)*.5,x.color.g=(Math.sin(l*.07)+1)*.5,x.color.b=(Math.sin(l*.03)+1)*.5),h&&d&&m&&h.render(d,m)}function ve(t){let e,n,o={id:S,render:xe};return e=new te({props:o}),t[2](e),{c(){z(e.$$.fragment)},l(a){F(e.$$.fragment,a)},m(a,c){N(e,a,c),n=!0},p(a,[c]){const r={};e.$set(r)},i(a){n||(R(e.$$.fragment,a),n=!0)},o(a){k(e.$$.fragment,a),n=!1},d(a){t[2](null),C(e,a)}}}let we=5;function ye(t,e,n){let o;P(async()=>{await de(),o.hideLoadingCircle()}),I(()=>{he()});function a(){fe()>we&&me(),L()}function c(r){D[r?"unshift":"push"](()=>{o=r,n(0,o)})}return[o,a,c]}class Ae extends ${constructor(e){super(),O(this,e,ye,ve,T,{performMagic:1})}get performMagic(){return this.$$.ctx[1]}}export{Ae as default};
