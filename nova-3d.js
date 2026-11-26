import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export function initNOVACharacter3D() {
  const mount = document.getElementById("character3dMount");
  if (!mount) return null;
  try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 1.9, 8.7);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(mount.clientWidth || 600, mount.clientHeight || 440);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute("aria-label", "شخصية NOVA ثلاثية الأبعاد");
    mount.prepend(renderer.domElement);
    mount.classList.add("has-3d");

    scene.add(new THREE.HemisphereLight(0xe4efff, 0x263047, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffedc5, 3.2);
    keyLight.position.set(-4, 7, 6); scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x5f9dff, 24, 12);
    rimLight.position.set(3, 3, -3); scene.add(rimLight);

    const root = new THREE.Group(); scene.add(root);
    const robot = new THREE.Group(); root.add(robot);
    const mat = (color, metalness=0.35, roughness=0.28) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const shell = mat("#e6edf7",0.48,0.25);
    const dark = mat("#101a2c",0.55,0.22);
    const gold = mat("#d4af37",0.7,0.2);
    const joint = mat("#91a8c8",0.5,0.3);
    let accent = mat("#69a0ff",0.5,0.22);
    const makeMesh=(geometry,material,parent,x,y,z)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;};
    const box=(parent,w,h,d,material,x,y,z,r=0.16)=>{
      const shape=new THREE.Shape(); const a=-w/2,b=-h/2;
      shape.moveTo(a+r,b);shape.lineTo(a+w-r,b);shape.quadraticCurveTo(a+w,b,a+w,b+r);
      shape.lineTo(a+w,b+h-r);shape.quadraticCurveTo(a+w,b+h,a+w-r,b+h);
      shape.lineTo(a+r,b+h);shape.quadraticCurveTo(a,b+h,a,b+h-r);
      shape.lineTo(a,b+r);shape.quadraticCurveTo(a,b,a+r,b);
      const geo=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:0.045,bevelThickness:0.045});
      geo.translate(0,0,-d/2);
      return makeMesh(geo,material,parent,x,y,z);
    };
    // Full-body original robot, built from editable 3D primitives.
    const torso=box(robot,1.55,1.45,0.72,shell,0,0.05,0,0.3);
    const chest=makeMesh(new THREE.SphereGeometry(0.23,32,24),accent,robot,0,0.23,0.39);
    const chestRing=makeMesh(new THREE.TorusGeometry(0.34,0.025,12,48),gold,robot,0,0.23,0.4);
    const neck=makeMesh(new THREE.CylinderGeometry(0.19,0.22,0.3,24),joint,robot,0,0.91,0);
    const headPivot=new THREE.Group(); headPivot.position.set(0,1.12,0); robot.add(headPivot);
    const head=makeMesh(new THREE.SphereGeometry(0.92,48,40),shell,headPivot,0,0.67,0);
    head.scale.set(1.05,0.87,0.78);
    const face=makeMesh(new THREE.SphereGeometry(0.76,40,32),dark,headPivot,0,0.66,0.48);
    face.scale.set(1.03,0.75,0.42);
    const eyeWhite=mat("#f5f8ff",0.1,0.16), pupil=mat("#172d53",0.35,0.18);
    for(const x of [-0.34,0.34]){
      makeMesh(new THREE.SphereGeometry(0.15,24,20),eyeWhite,headPivot,x,0.72,0.81);
      makeMesh(new THREE.SphereGeometry(0.075,20,16),pupil,headPivot,x,0.72,0.93);
      makeMesh(new THREE.SphereGeometry(0.025,12,12),gold,headPivot,x-0.025,0.76,0.98);
    }
    const mouth=makeMesh(new THREE.TorusGeometry(0.13,0.025,10,24,Math.PI),accent,headPivot,0,0.34,0.84);
    mouth.rotation.z=Math.PI;
    const antenna=makeMesh(new THREE.CylinderGeometry(0.025,0.035,0.3,12),gold,headPivot,0,1.48,0);
    makeMesh(new THREE.SphereGeometry(0.09,20,16),gold,headPivot,0,1.66,0);
    for(const x of [-0.97,0.97]){
      const ear=makeMesh(new THREE.SphereGeometry(0.25,24,20),accent,robot,x,1.72,0);
      ear.scale.set(0.55,1.05,0.7);
    }
    const arms=[];
    for(const x of [-0.98,0.98]){
      const pivot=new THREE.Group();pivot.position.set(x,0.52,0);robot.add(pivot);
      makeMesh(new THREE.SphereGeometry(0.2,20,16),gold,pivot,0,0,0);
      const upper=makeMesh(new THREE.CapsuleGeometry(0.12,0.56,5,12),joint,pivot,0,-0.38,0);
      const elbow=makeMesh(new THREE.SphereGeometry(0.15,18,14),accent,pivot,0,-0.72,0);
      makeMesh(new THREE.CapsuleGeometry(0.12,0.48,5,12),shell,pivot,0,-1.02,0);
      const hand=makeMesh(new THREE.SphereGeometry(0.18,20,16),shell,pivot,0,-1.34,0);
      arms.push(pivot);
    }
    for(const x of [-0.43,0.43]){
      const leg=makeMesh(new THREE.CapsuleGeometry(0.19,0.62,6,16),joint,robot,x,-1.03,0);
      makeMesh(new THREE.SphereGeometry(0.25,24,16),accent,robot,x,-1.53,0.13).scale.set(1.2,0.55,1.6);
    }
    const shadow=makeMesh(new THREE.CircleGeometry(1.45,48),new THREE.MeshBasicMaterial({color:0x020713,transparent:true,opacity:0.28}),root,0,-1.92,-0.15);
    shadow.rotation.x=-Math.PI/2;
    root.position.y=-0.15;
    const resize=()=>{const w=mount.clientWidth||600,h=mount.clientHeight||440;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);};
    const observer=new ResizeObserver(resize);observer.observe(mount);resize();
    let activePersona="soly";
    function setPersona(persona){
      activePersona=persona;
      const color=persona==="soleen"?"#f58bc4":"#69a0ff";
      accent.color.set(color);rimLight.color.set(color);chestRing.material.color.set(persona==="soleen"?"#f3b8dc":"#d4af37");
    }
    let frame=0;
    const animate=()=>{
      frame++;
      root.position.y=-0.15+Math.sin(frame*0.018)*0.055;
      root.rotation.y=Math.sin(frame*0.006)*0.07;
      headPivot.rotation.y=Math.sin(frame*0.013)*0.08;
      headPivot.rotation.x=Math.sin(frame*0.009)*0.025;
      arms[0].rotation.z=0.08+Math.sin(frame*0.018)*0.035;
      arms[1].rotation.z=-0.08-Math.sin(frame*0.018)*0.035;
      renderer.render(scene,camera);
      requestAnimationFrame(animate);
    };
    animate();
    const api={setPersona,renderer,scene,robot};
    window.nova3D=api;
    return api;
  } catch (error) {
    console.warn("NOVA 3D renderer unavailable; keeping accessible fallback.",error);
    return null;
  }
}
