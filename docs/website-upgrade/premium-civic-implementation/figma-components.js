await Promise.all(['Regular','Medium','Semibold'].map(style=>figma.loadFontAsync({family:'SF Pro',style})));
await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('0:1'));
const vars=await figma.variables.getLocalVariablesAsync();
const V=Object.fromEntries(vars.filter(v=>v.variableCollectionId==='VariableCollectionId:2:5').map(v=>[v.name,v]));
const P=k=>figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0}},'color',V['color/'+k]);
const ids=[],components={},properties={};
function gap(n,v){n.setBoundVariable('itemSpacing',V['space/'+v]);}
function pad(n,v){for(const k of ['paddingLeft','paddingRight','paddingTop','paddingBottom'])n.setBoundVariable(k,V['space/'+v]);}
function radius(n,k='card'){for(const p of ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius'])n.setBoundVariable(p,V['radius/'+k]);}
function txt(parent,s,size=16,color='body',weight='Regular',width=320) {
 const t=figma.createText();t.fontName={family:'SF Pro',style:weight};t.characters=s;t.fontSize=size;t.lineHeight={unit:'PIXELS',value:size<18?26:Math.round(size*1.2)};t.fills=[P(color)];t.resize(width,26);t.textAutoResize='HEIGHT';parent.appendChild(t);ids.push(t.id);return t;
}
function comp(name,width,bg='surface',mode='VERTICAL') {
 const c=figma.createComponent();c.name=name;c.description='GridNinja premium civic release. Server-rendered unless behavior requires an existing client island.';c.layoutMode=mode;c.resize(width,80);c.layoutSizingHorizontal='FIXED';c.layoutSizingVertical='HUG';c.fills=[P(bg)];pad(c,24);gap(c,16);radius(c);ids.push(c.id);return c;
}
function prop(c,node,name){const key=c.addComponentProperty(name,'TEXT',node.characters);node.componentPropertyReferences={characters:key};return key;}
const buttonVariants=[];
for(const kind of ['Primary','Secondary'])for(const state of ['Default','Hover','Pressed','Focus','Disabled']) {
 const bg=kind==='Primary'?(state==='Hover'?'orange-hover':state==='Pressed'?'orange-pressed':'orange'):(state==='Hover'?'raised':'surface');
 const c=comp('Kind='+kind+', State='+state,290,bg,'HORIZONTAL');pad(c,12);c.paddingLeft=20;c.paddingRight=20;c.primaryAxisAlignItems='CENTER';c.counterAxisAlignItems='CENTER';radius(c,'button');c.minHeight=48;
 if(kind==='Secondary'||state==='Focus'){c.strokes=[P(state==='Focus'?'heading':'control-edge')];c.strokeWeight=state==='Focus'?3:1;c.strokeAlign='OUTSIDE';}
 const t=txt(c,kind==='Primary'?'Scope an assessment':'See a sample decision brief',14,kind==='Primary'?'canvas':'heading','Semibold',250);t.textAlignHorizontal='CENTER';
 const key=prop(c,t,'Label');if(state==='Disabled')c.opacity=.55;
 buttonVariants.push(c);components['button-'+kind.toLowerCase()+'-'+state.toLowerCase()]=c.id;properties[c.id]={label:key};
}
const buttons=figma.combineAsVariants(buttonVariants,figma.currentPage);buttons.name='GridNinja / Action';buttons.x=1600;buttons.y=200;
buttonVariants.forEach((c,i)=>{c.x=24+(i%5)*330;c.y=24+Math.floor(i/5)*130;});buttons.resizeWithoutConstraints(1690,280);ids.push(buttons.id);
let x=1600,y=600;
function place(c,key){c.x=x;c.y=y;y+=c.height+80;components[key]=c.id;return c;}
for(const width of [1280,350]){
 const c=comp('GridNinja / Navigation / '+(width>500?'Desktop':'Mobile'),width,'canvas','HORIZONTAL');pad(c,0);c.paddingTop=20;c.paddingBottom=20;c.primaryAxisAlignItems='SPACE_BETWEEN';c.counterAxisAlignItems='CENTER';radius(c);
 txt(c,'GRIDNINJA',20,'heading','Semibold',160);
 txt(c,width>500?'Assessment     Demo     Evidence     Platform     About':'Menu  +',14,'body','Medium',width>500?600:80);
 place(c,'nav-'+(width>500?'desktop':'mobile'));
}
const crumb=comp('GridNinja / Breadcrumb',680,'canvas','HORIZONTAL');pad(crumb,0);const crumbtext=txt(crumb,'Home  /  Colocation & REITs',14,'support','Regular',640);properties[crumb.id]={label:prop(crumb,crumbtext,'Path')};place(crumb,'breadcrumb');
const card=comp('GridNinja / Editorial card',400);const media=figma.createFrame();media.name='Artwork slot / replace with assigned subject';media.resize(352,220);media.fills=[P('media-matte')];card.appendChild(media);ids.push(media.id);
const eyebrow=txt(card,'Platform direction · In development',12,'orange','Semibold',352);
const title=txt(card,'Physical constraints',26,'heading','Medium',352);
const body=txt(card,'The intended relationship between workloads, facility limits and inside-the-fence orchestration.',16,'body','Regular',352);
const link=txt(card,'Explore the platform direction →',14,'heading','Medium',352);
properties[card.id]={eyebrow:prop(card,eyebrow,'Eyebrow'),title:prop(card,title,'Title'),body:prop(card,body,'Body'),link:prop(card,link,'Link')};place(card,'editorial-card');
const paper=comp('GridNinja / Decision excerpt',400,'paper');
txt(paper,'GRIDNINJA / DECISION BRIEF',12,'paper-secondary','Semibold',352);
txt(paper,'DEMO-01-B · v1.0.0',12,'paper-orange','Medium',352);
txt(paper,'A smaller commitment needs review',30,'paper-ink','Medium',352);
txt(paper,'Synthetic example. No operational authority.',14,'paper-secondary','Regular',352);
place(paper,'decision-excerpt');
const research=comp('GridNinja / Research note',400,'canvas');research.strokes=[P('divider')];research.strokeTopWeight=1;research.strokeBottomWeight=0;research.strokeLeftWeight=0;research.strokeRightWeight=0;
const rt=txt(research,'Flexibility depends on the workload.',22,'heading','Medium',352);
const rb=txt(research,'External field evidence shows that selected AI workloads can support bounded grid response.',16,'body','Regular',352);
const rl=txt(research,'Nature Energy · 2026\nExternal demonstration; not GridNinja validation.',14,'support','Regular',352);
properties[research.id]={title:prop(research,rt,'Finding'),body:prop(research,rb,'Study'),limitation:prop(research,rl,'Limit')};place(research,'research-note');
const disclosureVariants=[];
for(const state of ['Closed','Open']){
 const c=comp('State='+state,680);c.strokes=[P('control-edge')];c.strokeWeight=1;
 txt(c,'Boundaries and change control     '+(state==='Open'?'−':'+'),18,'heading','Medium',632);
 if(state==='Open')txt(c,'The assessment does not grant equipment control or replace engineering and operator approval. New facilities, windows, profiles or review rounds are scope changes to agree before additional work.',16,'body','Regular',632);
 disclosureVariants.push(c);components['disclosure-'+state.toLowerCase()]=c.id;
}
const disclosure=figma.combineAsVariants(disclosureVariants,figma.currentPage);disclosure.name='GridNinja / Disclosure';disclosure.x=3500;disclosure.y=600;disclosureVariants.forEach((c,i)=>{c.x=24;c.y=24+i*300;});disclosure.resizeWithoutConstraints(730,600);ids.push(disclosure.id);
const fieldVariants=[];
for(const state of ['Default','Focus','Error','Disabled']){
 const c=comp('State='+state,400,'canvas');pad(c,0);gap(c,8);txt(c,'Work email · required',14,'heading','Medium',400);
 const box=figma.createAutoLayout('HORIZONTAL');box.name='Input';box.resize(400,48);box.layoutSizingHorizontal='FIXED';box.fills=[P('surface')];pad(box,12);radius(box,'button');box.strokes=[P(state==='Error'?'reject':state==='Focus'?'orange':'control-edge')];box.strokeWeight=state==='Focus'?2:1;c.appendChild(box);ids.push(box.id);
 const t=txt(box,state==='Error'?'name@':'name@organization.com',16,'support','Regular',376);properties[c.id]={value:prop(c,t,'Value')};
 if(state==='Error')txt(c,'Enter a valid email address.',14,'reject','Regular',400);
 if(state==='Disabled')c.opacity=.55;fieldVariants.push(c);components['field-'+state.toLowerCase()]=c.id;
}
const fields=figma.combineAsVariants(fieldVariants,figma.currentPage);fields.name='GridNinja / Field';fields.x=3500;fields.y=1300;fieldVariants.forEach((c,i)=>{c.x=24+(i%2)*450;c.y=24+Math.floor(i/2)*220;});fields.resizeWithoutConstraints(920,470);ids.push(fields.id);
const statuses=[];
for(const [label,icon,color] of [['ALLOW','✓','allow'],['REPAIR','△','repair'],['REJECT','×','reject'],['NO-PROOF','?','no-proof']]){
 const c=comp('Outcome='+label,250,'surface','HORIZONTAL');pad(c,12);txt(c,icon+'  '+label,14,color,'Semibold',220);statuses.push(c);components['status-'+label.toLowerCase()]=c.id;
}
const states=figma.combineAsVariants(statuses,figma.currentPage);states.name='GridNinja / Model screening status';states.x=3500;states.y=1900;statuses.forEach((c,i)=>{c.x=24+(i%2)*300;c.y=24+Math.floor(i/2)*100;});states.resizeWithoutConstraints(600,240);ids.push(states.id);
return {components,properties,createdNodeIds:ids,sets:[buttons,disclosure,fields,states].map(n=>({id:n.id,name:n.name,width:n.width,height:n.height}))};
