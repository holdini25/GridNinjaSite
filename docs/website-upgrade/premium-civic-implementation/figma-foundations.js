// Execute in the connected Figma file. IDs are returned to the external ledger.
await figma.loadFontAsync({ family: 'SF Pro', style: 'Regular' });
await figma.loadFontAsync({ family: 'SF Pro', style: 'Medium' });
await figma.loadFontAsync({ family: 'SF Pro', style: 'Semibold' });
const page = figma.root.children[0];
await figma.setCurrentPageAsync(page);
page.name = 'Foundations & Components';
const art = figma.createPage(); art.name = 'Art';
const journeys = figma.createPage(); journeys.name = 'Journeys & Review';
const primitives = figma.variables.createVariableCollection('GridNinja / Primitives');
const semantics = figma.variables.createVariableCollection('GridNinja / Semantic');
primitives.renameMode(primitives.modes[0].modeId, 'Value');
semantics.renameMode(semantics.modes[0].modeId, 'Value');
const tokens = {};
const hex = s => ({ r:parseInt(s.slice(1,3),16)/255,g:parseInt(s.slice(3,5),16)/255,b:parseInt(s.slice(5,7),16)/255,a:1 });
const colors = {
  'canvas':'#080808','surface':'#111315','raised':'#191C20',
  'heading':'#F4F7FA','body':'#CDD3D8','support':'#B8B8B8',
  'orange':'#FF9F1A','orange-hover':'#FFB44D','orange-pressed':'#E98B0C',
  'control-edge':'#7B858E','divider':'#2A3035','allow':'#83D8AD',
  'repair':'#E2C168','reject':'#FF8F91','no-proof':'#AFC2D6','proof-cyan':'#61E4FF',
  'paper':'#E8EDF1','paper-ink':'#1A2026','paper-secondary':'#485662','paper-orange':'#86420B','media-matte':'#010101'
};
for(const [name,value] of Object.entries(colors)) {
  const raw=figma.variables.createVariable('palette/'+name,primitives,'COLOR');
  raw.setValueForMode(primitives.modes[0].modeId,hex(value)); raw.scopes=[];
  const role=figma.variables.createVariable('color/'+name,semantics,'COLOR');
  role.setValueForMode(semantics.modes[0].modeId,{type:'VARIABLE_ALIAS',id:raw.id});
  role.scopes=['ALL_FILLS','STROKE_COLOR']; role.setVariableCodeSyntax('WEB','var(--gn-'+name+')');
  role.description=value+' · approved sRGB delivery color'; tokens[name]=role;
}
for(const value of [0,4,6,8,12,16,20,24,32,40,48,56,64,80,96,128]) {
  const v=figma.variables.createVariable('space/'+value,semantics,'FLOAT');
  v.setValueForMode(semantics.modes[0].modeId,value); v.scopes=['GAP','WIDTH_HEIGHT'];
  v.setVariableCodeSyntax('WEB','var(--gn-space-'+value+')'); tokens['space-'+value]=v;
}
for(const [name,value] of [['button',6],['card',8]]) {
  const v=figma.variables.createVariable('radius/'+name,semantics,'FLOAT');
  v.setValueForMode(semantics.modes[0].modeId,value); v.scopes=['CORNER_RADIUS'];
  v.setVariableCodeSyntax('WEB','var(--gn-radius-'+name+')'); tokens['radius-'+name]=v;
}
const paint = name => figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0}},'color',tokens[name]);
const created=[];
function text(s,size=17,color='body',style='Regular',width=1000) {
  const n=figma.createText(); n.fontName={family:'SF Pro',style}; n.characters=s;n.fontSize=size;
  n.lineHeight={unit:'PIXELS',value:Math.round(size*1.5)};n.fills=[paint(color)];n.resize(width,30);n.textAutoResize='HEIGHT';created.push(n.id);return n;
}
const board=figma.createAutoLayout('VERTICAL');board.name='Foundations / approved implementation contract';
board.x=200;board.y=200;board.resize(1200,100);board.layoutSizingHorizontal='FIXED';board.fills=[paint('canvas')];
for(const k of ['paddingTop','paddingBottom','paddingLeft','paddingRight'])board.setBoundVariable(k,tokens['space-48']);
board.setBoundVariable('itemSpacing',tokens['space-24']);created.push(board.id);
board.appendChild(text('GRIDNINJA / PREMIUM CIVIC',12,'orange','Semibold'));
board.appendChild(text('Architectural. Accountable. Inspectable.',44,'heading','Medium'));
board.appendChild(text('Mostly dark editorial surfaces. Warm orange in a cool graphite field. Bright white for reading anchors. Paper belongs to decision documents. No gradients, decorative glows or invented performance claims.'));
board.appendChild(text('System typography: SF Pro on Apple devices; browser system-ui elsewhere. These frames are macOS references, not a web-font dependency. Fluid widths and natural wraps are authoritative. No forced desktop line breaks.',15,'support'));
for(const [name,value] of Object.entries(colors)) {
  const row=figma.createAutoLayout('HORIZONTAL');row.name='Token / '+name;row.fills=[];row.resize(1104,52);row.layoutSizingHorizontal='FIXED';row.counterAxisAlignItems='CENTER';row.setBoundVariable('itemSpacing',tokens['space-24']);
  const swatch=figma.createRectangle();swatch.name=value;swatch.resize(80,48);swatch.fills=[paint(name)];
  row.appendChild(swatch);row.appendChild(text('--gn-'+name+'   '+value,16,'body','Regular',900));board.appendChild(row);created.push(row.id,swatch.id);
}
const styles={};
for(const [name,size,line,weight] of [['Display / desktop',60,64,'Medium'],['Display / tablet',48,52,'Medium'],['Display / mobile',36,39,'Medium'],['Display / narrow',34,38,'Medium'],['Section / desktop',44,51,'Medium'],['Section / mobile',30,36,'Medium'],['Body / desktop',17,28,'Regular'],['Body / mobile',16,26,'Regular'],['Qualification',14,22,'Regular'],['Eyebrow',12,18,'Semibold']]) {
  const s=figma.createTextStyle();s.name='GridNinja / '+name;s.fontName={family:'SF Pro',style:weight};s.fontSize=size;s.lineHeight={unit:'PIXELS',value:line};styles[name]=s.id;
}
board.appendChild(text('Color and interaction rules',30,'heading','Medium'));
board.appendChild(text('Orange action labels use #080808 (9.75:1). White labels on orange are prohibited. REPAIR uses a labeled warning treatment in #E2C168, distinct from brand orange. Focus uses a visible outline and space around the control. Essential borders use #7B858E; #2A3035 is decorative only.',16));
board.appendChild(text('Geometry: 1280px max content; outer insets 16 / 20 / 24 / 32 / 48px. Sections 56 / 64 / 80 / 96px. Cards 8px radius; controls 6px radius and at least 48px high. At widths below 640px, primary and secondary CTA widths match the container. Body measure 60–68ch.',16));
return {pages:{foundations:page.id,art:art.id,journeys:journeys.id},collections:{primitives:primitives.id,semantics:semantics.id},variables:Object.fromEntries(Object.entries(tokens).map(([k,v])=>[k,v.id])),styles,createdNodeIds:created,bounds:{id:board.id,width:board.width,height:board.height}};
