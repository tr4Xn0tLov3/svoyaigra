import * as THREE from './vendor/three.module.min.js?v=animal-detail-rotation-20261128';

// Hand-built, species-specific silhouettes and markings inspired by the game's expressive animal portraits.
const SPECIES = {
  cat:      { fur:'#667587', light:'#f2e9d7', inner:'#e58d9b', dark:'#282b34', ears:'point', tail:'curl', muzzle:'cat', belly:'cat', body:[.59,.77,.46], eye:'#c99d55' },
  fox:      { fur:'#d5793e', light:'#fff0d3', inner:'#eaa2a5', dark:'#433038', ears:'point', tail:'fox', muzzle:'fox', belly:'fox', body:[.62,.79,.47], eye:'#ae7a3a' },
  hyena:    { fur:'#aa8759', light:'#dbc69b', inner:'#70534a', dark:'#41322e', ears:'round', tail:'brush', muzzle:'dog', belly:'hyena', body:[.67,.78,.49], eye:'#ba8d49' },
  gorilla:  { fur:'#383842', light:'#9b8b86', inner:'#54414a', dark:'#201d25', ears:'round', tail:'none', muzzle:'gorilla', belly:'gorilla', body:[.78,.72,.55], eye:'#b97a47' },
  eagle:    { fur:'#75503c', light:'#dfc28e', inner:'#d7a643', dark:'#30252a', ears:'tuft', tail:'wings', muzzle:'beak', belly:'eagle', body:[.63,.78,.47], eye:'#d7a745' },
  monkey:   { fur:'#8c5d41', light:'#e6c69c', inner:'#b57a62', dark:'#38272c', ears:'round', tail:'curl', muzzle:'monkey', belly:'monkey', body:[.62,.80,.47], eye:'#b57b42' },
  goat:     { fur:'#ddd0ba', light:'#fff2d8', inner:'#c9878b', dark:'#494047', ears:'horns', tail:'brush', muzzle:'goat', belly:'goat', body:[.62,.78,.46], eye:'#a57b3b' },
  pig:      { fur:'#dd969c', light:'#ffe0d9', inner:'#c97682', dark:'#59333c', ears:'floppy', tail:'curl', muzzle:'pig', belly:'pig', body:[.66,.76,.50], eye:'#936247' },
  elephant: { fur:'#82949f', light:'#d3d9d4', inner:'#bd777d', dark:'#30353e', ears:'elephant', tail:'none', muzzle:'trunk', belly:'elephant', body:[.72,.80,.53], eye:'#bd8740' },
  rabbit:   { fur:'#ddd4c7', light:'#fff5e6', inner:'#e9a0ad', dark:'#494047', ears:'long', tail:'puff', muzzle:'rabbit', belly:'rabbit', body:[.57,.78,.45], eye:'#a8794f' },
  penguin:  { fur:'#24394f', light:'#f5f1e8', inner:'#f3a541', dark:'#17212f', ears:'none', tail:'none', muzzle:'beak', belly:'penguin', body:[.70,.91,.54], eye:'#d89b43' },
  shark:    { fur:'#57849f', light:'#d8e7e9', inner:'#a9cbd2', dark:'#263a4c', ears:'none', tail:'shark', muzzle:'shark', belly:'shark', body:[.68,.82,.48], eye:'#d6ad62' }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function material(color, roughness = 0.48, metalness = 0.01, extra = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness, metalness, clearcoat:0.12, clearcoatRoughness:0.4, ...extra });
}
function sphere(parent, mat, position, scale, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1,segments,Math.max(16,Math.floor(segments*.72))),mat);
  mesh.position.set(...position); mesh.scale.set(...scale); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function outlinedSphere(parent,mat,position,scale,ink,segments=32,expand=1.055) {
  sphere(parent,ink,position,scale.map((v)=>v*expand),segments);
  return sphere(parent,mat,position,scale,segments);
}
function capsule(parent,mat,position,radius,length,rotationZ=0) {
  const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,8,20),mat);
  mesh.position.set(...position); mesh.rotation.z=rotationZ; mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function cone(parent,mat,position,radius,height,rotation=[0,0,0],segments=28) {
  const mesh=new THREE.Mesh(new THREE.ConeGeometry(radius,height,segments,2),mat);
  mesh.position.set(...position); mesh.rotation.set(...rotation); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function tube(parent,points,mat,radius=.035,segments=24) {
  const path=new THREE.CatmullRomCurve3(points.map((p)=>new THREE.Vector3(...p)));
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,segments,radius,8,false),mat); mesh.castShadow=true; parent.add(mesh); return mesh;
}

function addEar(head,type,side,fur,inner,ink) {
  const x=side*.49;
  if(type==='none') return;
  if(type==='elephant') {
    const outer=sphere(head,ink,[side*.68,-.08,-.03],[.48,.52,.15],32); outer.rotation.z=side*-.25;
    const ear=sphere(head,fur,[side*.68,-.08,.02],[.44,.48,.14],32); ear.rotation.z=side*-.25;
    const inset=sphere(head,inner,[side*.70,-.08,.15],[.31,.36,.045],28); inset.rotation.z=side*-.25; return;
  }
  if(type==='floppy') {
    const outer=sphere(head,ink,[side*.59,.27,.01],[.27,.45,.15],32); outer.rotation.z=side*-.72;
    const ear=sphere(head,fur,[side*.59,.27,.06],[.235,.41,.13],32); ear.rotation.z=side*-.72;
    const inset=sphere(head,inner,[side*.62,.27,.17],[.13,.30,.045],24); inset.rotation.z=side*-.72; return;
  }
  if(type==='point'||type==='long'||type==='tuft'||type==='horns'||type==='fin') {
    const height=type==='long'?.98:type==='horns'?.58:type==='tuft'?.43:type==='fin'?.56:.69;
    const y=type==='long'?.79:.62;
    const r=type==='long'?.19:type==='fin'?.19:.22;
    const rot=[0,0,side*(type==='long'?.10:.17)];
    cone(head,ink,[x,y+height*.27,-.005],r*1.13,height*1.07,rot);
    cone(head,fur,[x,y+height*.27,.025],r,height,rot);
    if(type!=='horns'&&type!=='tuft'&&type!=='fin') {
      const h=height*.57;
      const inset=sphere(head,inner,[x,y+height*.28,.16],[.10,h*.34,.035],24); inset.rotation.z=side*(type==='long'?.10:.17);
    }
    return;
  }
  const outer=sphere(head,ink,[x,.38,-.01],[.26,.24,.17],28);
  const ear=sphere(head,fur,[x,.38,.02],[.23,.21,.15],28);
  sphere(head,inner,[x,.38,.15],[.12,.12,.04],24);
  outer.rotation.z=side*.08; ear.rotation.z=side*.08;
}

function addMuzzle(head,kind,light,dark,ink,species) {
  if(kind==='beak') {
    const bmat=material(species==='penguin'?'#e89535':'#e0ad45',.36);
    cone(head,ink,[0,-.19,.79],.23,.46,[Math.PI/2,0,0]);
    cone(head,bmat,[0,-.17,.84],.195,.39,[Math.PI/2,0,0]);
    sphere(head,material('#f2bd5a',.35),[0,-.30,.82],[.17,.075,.12],24); return;
  }
  if(kind==='trunk') {
    outlinedSphere(head,light,[0,-.24,.72],[.27,.23,.18],ink,28,1.08);
    tube(head,[[0,-.20,.85],[.02,-.42,.99],[.12,-.64,.98],[.10,-.83,.91],[.02,-.89,.89]],ink,.19,28);
    tube(head,[[0,-.20,.86],[.02,-.42,.99],[.12,-.64,.98],[.10,-.83,.91],[.02,-.89,.91]],light,.15,28);
    const wrinkle=material('#667782',.72);
    for(let i=0;i<4;i++){
      const y=-.37-i*.115; tube(head,[[-.11,y,.94],[0,y-.018,1.01],[.11,y,.94]],wrinkle,.012,10);
    }
    return;
  }
  if(kind==='pig') {
    outlinedSphere(head,light,[0,-.20,.79],[.36,.25,.16],ink,32,1.08);
    const nostril=material('#864852',.7);
    sphere(head,nostril,[-.12,-.20,.94],[.055,.077,.025],18); sphere(head,nostril,[.12,-.20,.94],[.055,.077,.025],18);
    return;
  }
  if(kind==='shark') {
    outlinedSphere(head,light,[0,-.18,.70],[.44,.19,.18],ink,28,1.06);
    return;
  }
  const width=kind==='gorilla'?.42:kind==='fox'?.32:kind==='goat'?.28:.30;
  outlinedSphere(head,light,[0,-.27,.72],[width,.20,.17],ink,28,1.055);
  if(['cat','rabbit','fox','dog','monkey','goat'].includes(kind)) {
    sphere(head,light,[-.13,-.30,.83],[.16,.13,.12],24); sphere(head,light,[.13,-.30,.83],[.16,.13,.12],24);
  }
  sphere(head,dark,[0,-.19,.90],[kind==='fox'?.085:.07,.055,.045],20);
  tube(head,[[0,-.29,.90],[0,-.37,.91],[-.07,-.40,.88]],dark,.022,12);
  tube(head,[[0,-.37,.91],[.07,-.40,.88]],dark,.022,12);
  if(kind==='cat') {
    const whisker=material('#282b35',.72);
    for(const side of [-1,1]) for(let i=0;i<3;i++) {
      const y=-.28+i*.08; tube(head,[[side*.20,y,.78],[side*.43,y+.05,.80],[side*.69,y+(i-1)*.08,.73]],whisker,.012,12);
    }
    const dots=material('#44323a',.75); for(const side of [-1,1]) for(let i=0;i<3;i++) sphere(head,dots,[side*(.20+i*.055),-.31+(i%2)*.045,.88],[.018,.018,.012],12);
  }
  if(kind==='goat') {
    const beard=sphere(head,light,[0,-.59,.53],[.15,.24,.12],24); beard.rotation.z=.08;
  }
}

function addOpenMouth(head,species,dark,ink) {
  let x=0, y=-.47, width=.245, height=.31;
  if(species==='gorilla'){width=.32;height=.26;y=-.48;}
  if(species==='elephant'){x=.23;width=.22;height=.27;y=-.43;}
  if(species==='shark'){width=.40;height=.32;y=-.43;}
  if(species==='pig'){width=.20;height=.22;y=-.47;}
  const cavity=material('#130f17',.78);
  outlinedSphere(head,cavity,[x,y,.64],[width,height,.10],ink,32,1.12);
  const tongue=material(species==='penguin'?'#d96f68':'#cf6c77',.5);
  sphere(head,tongue,[x,y-height*.48,.735],[width*.58,.075,.025],20);
  const tooth=material('#fff2d7',.3);
  sphere(head,tooth,[x-width*.50,y+height*.54,.724],[.075,.07,.035],18);
  sphere(head,tooth,[x+width*.50,y+height*.54,.724],[.075,.07,.035],18);
  if(species==='rabbit') {
    outlinedSphere(head,tooth,[x-.055,y+height*.39,.765],[.055,.12,.04],ink,16,1.05);
    outlinedSphere(head,tooth,[x+.055,y+height*.39,.765],[.055,.12,.04],ink,16,1.05);
  }
  if(species==='shark') {
    const toothMat=material('#fff5de',.3);
    for(let i=0;i<6;i++) {
      const tx=-.29+i*.116;
      cone(head,toothMat,[tx,-.28,.78],.045,.11,[Math.PI,0,0],12);
      cone(head,toothMat,[tx,-.57,.78],.045,.11,[0,0,0],12);
    }
  }
  return {x,y,width,height};
}

function addEyes(head,species,fur,ink) {
  const white=material('#fff4d9',.24);
  const irisMat=material(SPECIES[species]?.eye||'#a17a43',.22);
  const pupil=material('#16151c',.16);
  const highlight=new THREE.MeshBasicMaterial({color:'#ffffff'});
  const eyes=[];
  for(const side of [-1,1]) {
    const cx=side*.255, cy=.115, cz=.558;
    sphere(head,ink,[cx,cy,cz-.015],[.255,.29,.15],28);
    const globe=sphere(head,white,[cx,cy,cz],[.225,.258,.135],32);
    const iris=new THREE.Group(); iris.position.set(cx,cy,cz+.118); head.add(iris);
    sphere(iris,irisMat,[0,0,.012],[.122,.15,.055],28);
    sphere(iris,pupil,[0,0,.053],[.071,.105,.032],24);
    sphere(iris,highlight,[-.025,.042,.081],[.033,.04,.015],16);
    sphere(iris,highlight,[.035,-.04,.079],[.014,.018,.009],12);
    const brow=sphere(head,ink,[cx-side*.018,.405,.555],[.255,.073,.09],24); brow.rotation.z=side*.10;
    const browFur=sphere(head,fur,[cx-side*.018,.422,.573],[.215,.048,.055],24); browFur.rotation.z=side*.10;
    eyes.push({iris,side,globe});
  }
  return eyes;
}

function addBelly(body,species,fur,light,ink,dark) {
  const seam=material('#34313a',.74);
  if(species==='cat') {
    outlinedSphere(body,light,[0,1.36,.432],[.255,.42,.055],ink,28,1.08);
    for(let i=0;i<4;i++) tube(body,[[-.26,1.10+i*.12,.40],[-.17,1.08+i*.12,.49],[-.08,1.10+i*.12,.50]],seam,.016,10);
  } else if(species==='fox') {
    outlinedSphere(body,light,[0,1.36,.439],[.39,.58,.06],ink,32,1.07);
    sphere(body,light,[0,1.78,.40],[.24,.16,.08],28);
  } else if(species==='hyena') {
    outlinedSphere(body,light,[-.04,1.35,.46],[.32,.46,.06],ink,28,1.07);
    const spots=material('#554339',.82);
    for(const [x,y] of [[-.43,1.66],[.40,1.64],[-.48,1.39],[.46,1.37],[-.40,1.12],[.39,1.10]]) sphere(body,spots,[x,y,.34],[.055,.075,.025],16);
  } else if(species==='gorilla') {
    const chest=material('#827571',.72);
    outlinedSphere(body,chest,[0,1.38,.49],[.49,.48,.065],ink,32,1.06);
    for(let i=0;i<3;i++) tube(body,[[-.30,1.12+i*.13,.53],[0,1.08+i*.13,.56],[.30,1.12+i*.13,.53]],seam,.014,14);
  } else if(species==='eagle') {
    outlinedSphere(body,light,[0,1.34,.43],[.37,.52,.05],ink,28,1.05);
    const featherColors=['#c6a36c','#e4cc9b','#b28b59'];
    for(let row=0;row<3;row++) for(let col=-1;col<=1;col++) {
      const mat=material(featherColors[(row+col+4)%featherColors.length],.56);
      const f=sphere(body,mat,[col*.16,1.61-row*.18,.493-Math.abs(col)*.025],[.092,.16,.035],18); f.rotation.z=col*.25;
    }
  } else if(species==='monkey') {
    outlinedSphere(body,light,[0,1.37,.46],[.31,.47,.06],ink,28,1.06);
    sphere(body,material('#bb8b59',.7),[0,1.17,.52],[.07,.08,.024],16);
    for(const side of [-1,1]) sphere(body,material('#e3c59e',.6),[side*.38,1.55,.33],[.10,.13,.03],20);
  } else if(species==='goat') {
    outlinedSphere(body,light,[0,1.38,.43],[.30,.49,.05],ink,28,1.06);
    for(let row=0;row<3;row++) for(let col=-1;col<=1;col++) {
      sphere(body,light,[col*.22,1.72-row*.17,.47-Math.abs(col)*.02],[.16,.15,.09],20);
    }
  } else if(species==='pig') {
    const belly=material('#f1b3ad',.55);
    outlinedSphere(body,belly,[0,1.33,.49],[.39,.46,.075],ink,30,1.055);
    sphere(body,material('#c9787d',.7),[0,1.28,.57],[.042,.055,.018],14);
    for(const side of [-1,1]) sphere(body,material('#f6c1b8',.58),[side*.42,1.56,.35],[.11,.15,.03],18);
  } else if(species==='elephant') {
    const patch=material('#a8b4b8',.62);
    outlinedSphere(body,patch,[0,1.36,.49],[.40,.49,.065],ink,30,1.05);
    for(let i=0;i<4;i++) tube(body,[[-.28,1.15+i*.13,.52],[0,1.12+i*.13,.56],[.28,1.15+i*.13,.52]],seam,.014,14);
  } else if(species==='rabbit') {
    outlinedSphere(body,light,[0,1.34,.43],[.34,.51,.065],ink,30,1.055);
    for(const x of [-.20,0,.20]) sphere(body,light,[x,1.04,.48],[.15,.13,.07],20);
  } else if(species==='penguin') {
    outlinedSphere(body,light,[0,1.36,.49],[.43,.65,.07],ink,32,1.05);
    sphere(body,light,[0,1.82,.44],[.28,.20,.06],28);
  } else if(species==='shark') {
    const belly=material('#d5e1df',.58);
    outlinedSphere(body,belly,[0,1.34,.44],[.31,.62,.055],ink,30,1.04);
    for(const side of [-1,1]) for(let i=0;i<4;i++) tube(body,[[side*.38,1.60-i*.12,.33],[side*.43,1.57-i*.12,.36],[side*.47,1.53-i*.12,.31]],dark,.018,10);
  }
}

function addTail(body,species,fur,light,ink) {
  if(species==='none') return null;
  const pivot=new THREE.Group(); pivot.position.set(.42,1.02,-.36); body.add(pivot);
  if(species==='fox') {
    const tail=sphere(pivot,ink,[.27,.28,-.02],[.30,.69,.26],32); tail.rotation.z=-.52;
    const main=sphere(pivot,fur,[.27,.28,.01],[.26,.65,.23],32); main.rotation.z=-.52;
    const tip=sphere(pivot,light,[.60,.68,.02],[.18,.24,.18],24); tip.rotation.z=-.52;
  } else if(species==='brush'||species==='puff') {
    outlinedSphere(pivot,species==='puff'?light:fur,[.18,.25,-.05],[.28,species==='puff'?.30:.46,.22],ink,28,1.07);
    if(species==='brush') sphere(pivot,light,[.25,.59,-.05],[.17,.15,.15],22);
  } else if(species==='curl') {
    tube(pivot,[[0,0,0],[.36,-.12,-.25],[.52,.06,-.38],[.44,.30,-.34],[.32,.23,-.28]],ink,.115,26);
    tube(pivot,[[0,0,.02],[.36,-.12,-.23],[.52,.06,-.36],[.44,.30,-.32],[.32,.23,-.26]],fur,.085,26);
  } else if(species==='shark') {
    cone(pivot,ink,[.23,.12,-.1],.35,.9,[0,0,-.55],28);
    cone(pivot,fur,[.23,.12,-.06],.30,.84,[0,0,-.55],28);
  } else if(species==='wings') {
    for(let i=0;i<5;i++) { const f=sphere(pivot,fur,[.11+i*.04,-.05-i*.12,-.02],[.16,.32,.12],20); f.rotation.z=-.45; }
  }
  return pivot;
}

function addCharacter(speciesKey,accentColor) {
  const key=SPECIES[speciesKey]?speciesKey:'fox', cfg=SPECIES[key];
  const fur=material(cfg.fur,.58), light=material(cfg.light,.58), inner=material(cfg.inner,.60), dark=material(cfg.dark,.72);
  const ink=new THREE.MeshBasicMaterial({color:'#171923'});
  const accent=material(accentColor,.3,.18,{clearcoat:.38,clearcoatRoughness:.24});
  const gold=material('#f1c76b',.26,.36,{clearcoat:.35});
  const root=new THREE.Group(), body=new THREE.Group(); root.add(body);

  const tail=addTail(body,cfg.tail,fur,light,ink);
  // Species-specific silhouette: no shared torso template beyond the rig.
  capsule(body,dark,[-.23,.53,0],.16,.43,.02); capsule(body,dark,[.23,.53,0],.16,.43,-.02);
  const shoe=material(key==='penguin'?'#d68c36':cfg.dark,.45);
  outlinedSphere(body,shoe,[-.24,.27,.16],[.25,.13,.35],ink,24,1.06); outlinedSphere(body,shoe,[.24,.27,.16],[.25,.13,.35],ink,24,1.06);
  const scale=cfg.body;
  sphere(body,ink,[0,1.40,-.01],scale.map(v=>v*1.05),36);
  sphere(body,fur,[0,1.40,0],scale,40);
  addBelly(body,key,fur,light,ink,dark);

  // Markings echo each portrait instead of giving every animal the same shirt and belly.
  if(key==='cat'||key==='fox') {
    const stripe=material(key==='cat'?'#343a46':'#a84f31',.72);
    for(const side of [-1,1]) for(let i=0;i<3;i++) tube(body,[[side*.39,1.74-i*.16,.30],[side*.49,1.70-i*.16,.34],[side*.53,1.64-i*.16,.28]],stripe,.022,10);
  }
  if(key==='hyena') {
    const spot=material('#4b3933',.8); for(const [x,y] of [[-.45,1.87],[.44,1.83],[-.52,1.62],[.50,1.58],[-.41,1.30],[.45,1.34]]) sphere(body,spot,[x,y,.30],[.045,.062,.022],14);
  }
  if(key==='eagle') {
    const wingMat=material('#5b3d32',.68);
    for(const side of [-1,1]) for(let i=0;i<4;i++) { const f=sphere(body,wingMat,[side*(.52+i*.025),1.63-i*.12,.05],[.13,.23,.10],18); f.rotation.z=side*.35; }
  }
  if(key==='elephant') {
    const fold=material('#657983',.74); for(let i=0;i<3;i++) tube(body,[[-.44,1.62-i*.12,.27],[-.52,1.57-i*.12,.31],[-.54,1.52-i*.12,.24]],fold,.016,10);
  }
  if(key==='shark') {
    const fin=cone(body,ink,[0,2.12,-.12],.28,.72,[0,0,0],24); fin.scale.set(.62,1,.45);
    const finFill=cone(body,fur,[0,2.14,-.08],.24,.62,[0,0,0],24); finFill.scale.set(.62,1,.45);
    for(const side of [-1,1]) { const pectoral=cone(body,ink,[side*.62,1.32,-.05],.20,.82,[0,0,side*.92],20); pectoral.scale.set(.62,1,.38); }
  }

  // Neck ring in the user's selected accent; the animal's natural chest remains visible.
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.27,.055,10,36),accent); collar.rotation.x=Math.PI/2; collar.position.set(0,2.02,.03); body.add(collar);
  const medal=sphere(body,gold,[-.28,1.77,.40],[.075,.075,.025],18);

  const leftArm=new THREE.Group(); leftArm.position.set(-.55,1.84,.02); body.add(leftArm);
  const rightArm=new THREE.Group(); rightArm.position.set(.55,1.84,.02); body.add(rightArm);
  const armWidth=key==='gorilla'?.22:.17;
  capsule(leftArm,ink,[-.04,-.26,0],armWidth*1.12,.48,-.33); capsule(leftArm,fur,[-.04,-.26,.02],armWidth,.45,-.33);
  capsule(rightArm,ink,[.04,-.26,0],armWidth*1.12,.48,.33); capsule(rightArm,fur,[.04,-.26,.02],armWidth,.45,.33);
  outlinedSphere(leftArm,light,[-.12,-.54,.06],[.18,.16,.16],ink,22,1.06); outlinedSphere(rightArm,light,[.12,-.54,.06],[.18,.16,.16],ink,22,1.06);
  if(key==='eagle') for(const side of [-1,1]) for(let i=0;i<3;i++) { const f=sphere(side<0?leftArm:rightArm,light,[side*.03,-.10-i*.11,.12],[.13,.12,.05],18); f.rotation.z=side*.3; }
  if(key==='penguin') { leftArm.scale.set(1.0,1.12,.75); rightArm.scale.set(1.0,1.12,.75); }

  // Head is its own pivot so gaze, nods and mouse-follow are truly articulated.
  capsule(body,ink,[0,2.07,-.02],.25,.22);
  capsule(body,light,[0,2.07,.015],.21,.18);
  const head=new THREE.Group(); head.position.set(0,2.66,0); head.scale.set(1.06,1.06,1.05); body.add(head);
  sphere(head,ink,[0,0,-.015],[.82,.77,.70],40);
  sphere(head,fur,[0,0,0],[.77,.72,.66],44);
  addEar(head,cfg.ears,-1,fur,inner,ink); addEar(head,cfg.ears,1,fur,inner,ink);

  // Hair tufts, fur marks and brows give each silhouette a distinct expression.
  if(key==='fox') { cone(head,light,[0,.49,.48],.14,.30,[.1,0,0],20); }
  if(key==='hyena') { for(let i=0;i<4;i++) cone(head,dark,[-.35+i*.23,.67,-.02],.09,.25,[0,0,(i-1.5)*.12],16); }
  if(key==='gorilla') { sphere(head,dark,[0,.48,.40],[.55,.15,.20],28); }
  if(key==='eagle') { for(let i=-1;i<=1;i++) cone(head,fur,[i*.16,.62,.10],.11,.34,[0,0,i*.18],16); }
  if(key==='goat') { for(const side of [-1,1]) { const horn=tube(head,[[side*.37,.48,-.03],[side*.48,.65,-.02],[side*.43,.80,.01],[side*.34,.86,.04]],gold,.065,18); horn.userData.horn=true; } }
  if(key==='elephant') { /* broad ears are built into addEar */ }
  if(key==='shark') { for(let i=0;i<3;i++) tube(head,[[.52+i*.045,.03-i*.13,.31],[.60+i*.04,-.03-i*.13,.28],[.57+i*.04,-.10-i*.13,.24]],dark,.018,10); }

  const mouth=addOpenMouth(head,key,dark,ink);
  addMuzzle(head,cfg.muzzle,light,dark,ink,key);
  const eyes=addEyes(head,key,fur,ink);
  if(key==='elephant') {
    cone(head,light,[-.26,-.36,.68],.08,.28,[Math.PI*.86,0,.16],18);
    cone(head,light,[.26,-.36,.68],.08,.28,[Math.PI*.86,0,-.16],18);
  }
  if(key==='rabbit') {
    const tooth=material('#fff5e6',.3); outlinedSphere(head,tooth,[-.055,-.42,.76],[.055,.13,.04],ink,16,1.05); outlinedSphere(head,tooth,[.055,-.42,.76],[.055,.13,.04],ink,16,1.05);
  }
  if(key==='gorilla') {
    const muzzle=material('#baa29a',.62); outlinedSphere(head,muzzle,[0,-.27,.70],[.39,.22,.16],ink,28,1.05);
  }

  const platform=new THREE.Mesh(new THREE.CylinderGeometry(.76,.82,.13,64,1),material('#111a2a',.26,.38)); platform.position.y=.10; platform.castShadow=true; body.add(platform);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.73,.035,10,64),material(accentColor,.23,.35,{emissive:accentColor,emissiveIntensity:.12})); rim.rotation.x=Math.PI/2; rim.position.y=.17; body.add(rim);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.75,48),new THREE.MeshBasicMaterial({color:'#050914',transparent:true,opacity:.42,depthWrite:false})); shadow.rotation.x=-Math.PI/2; shadow.position.y=.172; shadow.scale.set(1,.56,1); body.add(shadow);
  return {root,body,head,leftArm,rightArm,tail,eyes,mouth,speciesKey:key};
}

export function createScene(speciesKey,accentColor) {
  const scene=new THREE.Scene(); scene.background=null;
  scene.add(new THREE.HemisphereLight('#eaf2ff','#251e32',2.15));
  const key=new THREE.DirectionalLight('#fff4df',3.1); key.position.set(-3.8,6.5,6.5); scene.add(key);
  const fill=new THREE.DirectionalLight('#9ac4ff',1.65); fill.position.set(4,3,2); scene.add(fill);
  const rim=new THREE.PointLight(accentColor,2.5,9,1.9); rim.position.set(.8,2.6,-2.5); scene.add(rim);
  const warm=new THREE.PointLight('#ffc982',.85,7,1.7); warm.position.set(-2,1.8,3); scene.add(warm);
  const avatar=addCharacter(speciesKey,accentColor); scene.add(avatar.root);
  const camera=new THREE.PerspectiveCamera(32,1,.1,60); camera.position.set(0,2.02,8.6); camera.lookAt(0,1.92,0);
  return {scene,camera,avatar,accentColor,speciesKey:avatar.speciesKey,previousScore:null,cheerUntil:0,phase:Math.random()*Math.PI*2,lastSize:'',dragYaw:0,dragging:false,dragStartX:0,dragStartYaw:0,targetLookX:0,targetLookY:0,lookX:0,lookY:0};
}

function disposeObject(object) {
  object.traverse((node)=>{ if(node.geometry)node.geometry.dispose(); if(node.material)for(const mat of Array.isArray(node.material)?node.material:[node.material])mat.dispose(); });
}

export class AvatarStageManager {
  constructor() {
    this.renderer=null; this.canvas=null; this.row=null; this.models=new Map(); this.disabled=false; this.lastFrame=0; this.lastWidth=0; this.lastHeight=0;
    this.pointer={x:window.innerWidth*.5,y:window.innerHeight*.45};
    this._animate=this._animate.bind(this); this._pointerMove=this._pointerMove.bind(this);
    window.addEventListener('pointermove',this._pointerMove,{passive:true});
    this.frameHandle=requestAnimationFrame(this._animate);
    this.onContextLost=(event)=>{event.preventDefault();this.disabled=true;this.canvas?.classList.add('avatar-3d-unavailable');this.row?.querySelectorAll('.avatar-3d-ready').forEach((stage)=>stage.classList.remove('avatar-3d-ready'));};
  }
  _pointerMove(event) { this.pointer.x=event.clientX; this.pointer.y=event.clientY; }
  _ensureRenderer(row) {
    if(this.disabled||this.renderer)return Boolean(this.renderer);
    try {
      this.canvas=document.createElement('canvas'); this.canvas.className='player-avatars-canvas'; this.canvas.setAttribute('aria-hidden','true'); this.canvas.addEventListener('webglcontextlost',this.onContextLost,false);
      this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true,powerPreference:'low-power',premultipliedAlpha:true});
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5)); this.renderer.setClearColor(0x000000,0); this.renderer.outputColorSpace=THREE.SRGBColorSpace;
      this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.12; this.renderer.shadowMap.enabled=false; this.renderer.autoClear=false;
      row.appendChild(this.canvas); return true;
    } catch(error) { console.warn('3D-аватары недоступны; показаны портреты:',error); this.disabled=true; this.canvas?.classList.add('avatar-3d-unavailable'); return false; }
  }
  _bindRotation(stage,id) {
    if(stage.dataset.rotatable!=='true'||stage.dataset.rotationBound==='true')return;
    stage.dataset.rotationBound='true';
    stage.addEventListener('pointerdown',(event)=>{
      if(event.pointerType==='mouse'&&event.button!==0)return;
      const model=this.models.get(id); if(!model)return; if(event.pointerType==='mouse')event.preventDefault(); model.dragging=true; model.dragStartX=event.clientX; model.dragStartYaw=model.dragYaw; stage.classList.add('is-dragging');
      try{stage.setPointerCapture(event.pointerId);}catch(_){}
    });
    stage.addEventListener('pointermove',(event)=>{
      const model=this.models.get(id); if(!model?.dragging)return;
      model.dragYaw=model.dragStartYaw+(event.clientX-model.dragStartX)*.012;
    });
    const end=(event)=>{const model=this.models.get(id);if(model)model.dragging=false;stage.classList.remove('is-dragging');try{stage.releasePointerCapture(event.pointerId);}catch(_){}};
    stage.addEventListener('pointerup',end); stage.addEventListener('pointercancel',end); stage.addEventListener('lostpointercapture',end);
  }
  sync(row) {
    if(!row||!row.isConnected){this.row=null;this.canvas?.remove();for(const model of this.models.values()){this.sceneRemove(model);disposeObject(model.avatar.root);}this.models.clear();return;}
    this.row=row; const stages=[...row.querySelectorAll('[data-avatar-stage]')]; if(!stages.length||!this._ensureRenderer(row))return;
    if(this.canvas.parentElement!==row)row.appendChild(this.canvas); const liveIds=new Set();
    for(const stage of stages){
      const id=stage.dataset.playerId; liveIds.add(id); const speciesKey=(stage.dataset.avatar||'').match(/animal-([a-z]+)\./i)?.[1]||'fox';
      const color=/^#[0-9a-f]{6}$/i.test(stage.dataset.color||'')?stage.dataset.color:'#f5c451'; let model=this.models.get(id);
      if(!model||model.speciesKey!==speciesKey||model.accentColor.toLowerCase()!==color.toLowerCase()){
        if(model){this.sceneRemove(model);disposeObject(model.avatar.root);} model=createScene(speciesKey,color); this.models.set(id,model);
      }
      const score=Number(stage.dataset.score)||0; if(model.previousScore!==null&&score>model.previousScore)model.cheerUntil=performance.now()+1100;
      model.previousScore=score; model.answering=stage.dataset.answering==='true'; this._bindRotation(stage,id); stage.classList.add('avatar-3d-ready');
    }
    for(const [id,model] of this.models)if(!liveIds.has(id)){this.sceneRemove(model);disposeObject(model.avatar.root);this.models.delete(id);}
  }
  sceneRemove(model){model.scene.remove(model.avatar.root);}
  _animate(now) {
    this.frameHandle=requestAnimationFrame(this._animate);
    if(!this.renderer||this.disabled||document.hidden||now-this.lastFrame<30||!this.row?.isConnected)return;
    this.lastFrame=now; const rowRect=this.row.getBoundingClientRect(),width=Math.max(1,Math.round(rowRect.width)),height=Math.max(1,Math.round(rowRect.height));
    if(this.lastWidth!==width||this.lastHeight!==height){this.renderer.setSize(width,height,false);this.lastWidth=width;this.lastHeight=height;}
    this.canvas.style.width=`${width}px`;this.canvas.style.height=`${height}px`;this.renderer.setScissorTest(false);this.renderer.clear(true,true,true);this.renderer.setScissorTest(true);
    const time=now*.001;
    for(const stage of this.row.querySelectorAll('[data-avatar-stage]')){
      const model=this.models.get(stage.dataset.playerId);if(!model)continue;const rect=stage.getBoundingClientRect();
      const x=Math.round(rect.left-rowRect.left),top=Math.round(rect.top-rowRect.top),w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
      if(rect.bottom<0||rect.top>window.innerHeight||rect.width<8||rect.height<8)continue;const y=height-top-h;
      this.renderer.setViewport(x,y,w,h);this.renderer.setScissor(x,y,w,h);model.camera.aspect=w/h;model.camera.updateProjectionMatrix();
      const dx=(this.pointer.x-(rect.left+rect.width*.5))/(window.innerWidth*.48),dy=(this.pointer.y-(rect.top+rect.height*.5))/(window.innerHeight*.48);
      model.targetLookX=clamp(dx,-1,1);model.targetLookY=clamp(-dy,-1,1);model.lookX+=(model.targetLookX-model.lookX)*.12;model.lookY+=(model.targetLookY-model.lookY)*.12;
      const bob=Math.sin(time*2.1+model.phase)*.035;model.avatar.body.position.y=bob;
      model.avatar.root.rotation.y=model.dragYaw+Math.sin(time*.55+model.phase)*.035+model.lookX*.07;
      model.avatar.head.rotation.y=model.lookX*.34;model.avatar.head.rotation.x=-model.lookY*.19+Math.sin(time*.85+model.phase)*.018;
      for(const eye of model.avatar.eyes){eye.iris.position.x=eye.side*.255+model.lookX*.064;eye.iris.position.y=.115+model.lookY*.074;}
      model.avatar.leftArm.rotation.z=-.12+Math.sin(time*1.7+model.phase)*.055;model.avatar.rightArm.rotation.z=.12+Math.sin(time*1.7+model.phase+1.4)*.055;
      if(model.answering){model.avatar.rightArm.rotation.z=-.72+Math.sin(time*4)*.1;model.avatar.root.rotation.z=Math.sin(time*2.8)*.018;}
      else if(now<model.cheerUntil){const progress=clamp((model.cheerUntil-now)/1100,0,1);model.avatar.rightArm.rotation.z=-1.15+progress*.36;model.avatar.leftArm.rotation.z=.55-progress*.35;model.avatar.root.rotation.z=Math.sin(time*7)*.045*progress;}
      else model.avatar.root.rotation.z=0;
      if(model.avatar.tail)model.avatar.tail.rotation.y=Math.sin(time*2.4+model.phase)*.20;
      this.renderer.render(model.scene,model.camera);
    }
    this.renderer.setScissorTest(false);
  }
}
