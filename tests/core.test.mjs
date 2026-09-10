import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/js/core.js';
const C = globalThis.KioscoCore;
for (const [input, expected] of [['2,50',2.5],['2.50',2.5],['1,200.50',1200.5],['1.200,50',1200.5],[0,0],['-1',-1]]) {
  test(`decimal ${input}`, () => assert.equal(C.decimal(input), expected));
}
for (const input of ['', 'abc', '1..2', '1,2,3', '2e4', 'NaN', '1.20,30']) test(`rechaza decimal ${JSON.stringify(input)}`,()=>assert.ok(Number.isNaN(C.decimal(input))));
test('centavos: 0.1 + 0.2',()=>assert.equal(C.money(0.1+0.2),0.3));
test('normalizacion de tildes',()=>assert.equal(C.normalize('  Caf\u00e9  '), 'cafe'));
const now = new Date('2026-09-10T02:30:00Z');
test('dia peruano empieza 05:00 UTC',()=>assert.equal(C.periodRange('day',now).start.toISOString(),'2026-09-09T05:00:00.000Z'));
test('semana empieza lunes Peru',()=>assert.equal(C.periodRange('week',now).start.toISOString(),'2026-09-07T05:00:00.000Z'));
test('mes empieza en Lima',()=>assert.equal(C.periodRange('month',now).start.toISOString(),'2026-09-01T05:00:00.000Z'));
test('rango excluye siguiente dia',()=>assert.deepEqual(C.filterPeriod([{id:1,createdAt:'2026-09-09T05:00:00Z'},{id:2,createdAt:'2026-09-10T05:00:00Z'}],'day',now).map(x=>x.id),[1]));
test('timestamp seconds Firestore',()=>assert.equal(C.timestamp({seconds:100}),100000));
test('timestamp toDate Firestore',()=>assert.equal(C.timestamp({toDate:()=>new Date(100000)}),100000));
test('variantes suman al precio base',()=>assert.equal(C.priceFor({price:10,variants:[{name:'Talla',options:['M','L'],extraPrice:2.5}]},['L']),12.5));
test('variante inexistente se rechaza',()=>assert.throws(()=>C.priceFor({price:10,variants:[{name:'Talla',options:['M'],extraPrice:2}]},['L'])));
test('variante obligatoria',()=>assert.throws(()=>C.priceFor({price:10,variants:[{name:'Talla',options:['M']}]},[])));
test('variantes generan claves independientes',()=>assert.notEqual(C.cartKey('p',['M']),C.cartKey('p',['L'])));
for(const url of ['javascript:alert(1)','data:text/html,hi','https://user:pass@example.org/a.png','uploads/../secret','data:image/svg+xml;base64,AAAA']) test(`URL insegura ${url}`,()=>assert.equal(C.safeImageUrl(url),''));
test('URL externa segura',()=>assert.equal(C.safeImageUrl('https://example.org/a.png'),'https://example.org/a.png'));
test('imagen inline del producto antes que URL vieja',()=>assert.equal(C.productImage({images:['data:image/png;base64,AAAA'],imageUrl:'https://example.org/old.png'}),'data:image/png;base64,AAAA'));
const categories=[{id:'c',name:'Bebidas',parentId:null},{id:'s',name:'Agua',parentId:'c'}];
const valid={nombre:'Agua',precio:'2,50',stock:'',categoria:'Bebidas',subcategoria:'Agua',activo:'NO'};
test('importa precio, categoria, subcategoria, stock ilimitado y NO',()=>{const r=C.validateImport(valid,categories);assert.equal(r.valid,true);assert.equal(r.payload.price,2.5);assert.equal(r.payload.stock,null);assert.equal(r.payload.active,false);assert.equal(r.payload.subcategoryId,'s');});
for(const [field,value] of [['nombre',''],['precio','abc'],['stock','1.5'],['stock',-1],['activo','quizas'],['categoria','Inexistente'],['subcategoria','Otra'],['imageUrl','javascript:alert(1)']]) test(`import rechaza ${field}=${value}`,()=>assert.equal(C.validateImport({...valid,[field]:value},categories).valid,false));
test('boolean false y cero se conservan',()=>assert.equal(C.validateImport({...valid,activo:false,stock:0},categories).payload.active,false));

test('descuento base conserva suplementos',()=>assert.equal(C.priceFor({price:10,discountPercent:20,variants:[{name:'Talla',options:['L'],extraPrice:2.5}]},['L']),10.5));
test('oferta vigente aplica sin superar precio normal',()=>assert.equal(C.basePrice({id:'p',price:10},{productId:'p',active:true,offerPrice:6,endTime:'2030-01-01'},new Date('2026-09-10')),6));
test('oferta vencida no aplica',()=>assert.equal(C.basePrice({id:'p',price:10},{productId:'p',active:true,offerPrice:6,endTime:'2020-01-01'}),10));
test('oferta de otro producto no aplica',()=>assert.equal(C.basePrice({id:'q',price:10},{productId:'p',active:true,offerPrice:6,endTime:'2030-01-01'}),10));
test('descuento nunca produce precio negativo',()=>assert.equal(C.basePrice({price:10,discountPercent:200}),0));
