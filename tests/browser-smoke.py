"""Offline DOM integration checks. Firebase, XLSX and jsPDF use explicit doubles.
No production requests, no navigation and no Security Rules emulation.
Install: python3 -m pip install playwright; python3 -m playwright install chromium
"""
from pathlib import Path
import json, os, re, shutil, time
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
results = []
def check(name, ok, detail=None):
    results.append({'name': name, 'passed': bool(ok), 'detail': detail})
    print(('PASS ' if ok else 'FAIL ') + name, flush=True)

seed={'config/admin':{'uids':['admin-test'],'phones':['+51999999999']},'config/staff':{'phones':[],'uids':[],'members':[]},'config/theme':{'storeName':'Mi Kiosco'},'config/settings':{},'config/billing':{},'config/media':{},'categories/c1':{'name':'Bebidas','parentId':None,'order':1}}
for i in range(36):
    seed[f'products/p{i}']={'name':f'Producto {i:02d}','description':'Producto de prueba del catalogo','price':2.5+i,'stock':20,'active':True,'categoryId':'c1','unit':'Unidad','images':[],'variants':[]}
seed['products/p0']['variants']=[{'name':'Tamano','options':['Pequeno','Grande'],'extraPrice':1.5}]
seed['orders/test-order']={'customer':'Cliente','ownerId':'client-test','items':[],'total':10,'status':'pending','createdAt':{'seconds':int(time.time())}}

def mount(browser, role='guest', width=1280):
    context=browser.new_context(viewport={'width':width,'height':800},service_workers='block')
    context.route('**/*', lambda route: route.fulfill(body='',content_type='text/css' if '.css' in route.request.url else 'text/javascript'))
    page=context.new_page(); errors=[]; warnings=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: warnings.append(message.text) if message.type in ['error','warning'] else None)
    html=(ROOT/'web/index.html').read_text()
    def stylesheet(match):
        href=match.group(1)
        if 'bootstrap' in href and 'icons' not in href: css=(ROOT/'tests/vendor/bootstrap.min.css').read_text()
        elif href.endswith('.css') and not href.startswith('http') and (ROOT/'web'/href).exists(): css=(ROOT/'web'/href).read_text()
        else: css=''
        return '<style>'+re.sub(r'@import [^;]+;','',css)+'</style>'
    html=re.sub(r'<link[^>]*href="([^"]+)"[^>]*>',stylesheet,html)
    sources=re.findall(r'<script[^>]*src="([^"]+)"[^>]*>\s*</script>',html)
    html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S)
    prelude="""const storageMap=new Map();const fakeStorage={getItem:k=>storageMap.get(k)??null,setItem:(k,v)=>storageMap.set(k,String(v)),removeItem:k=>storageMap.delete(k),clear:()=>storageMap.clear()};Object.defineProperty(window,'localStorage',{value:fakeStorage});Object.defineProperty(window,'sessionStorage',{value:fakeStorage});window.alert=()=>{};window.confirm=()=>true;window.__docState='loading';Object.defineProperty(document,'readyState',{get:()=>window.__docState});"""
    prelude+='window.__seed='+json.dumps(seed)+';window.__testRole='+json.dumps('guest' if role=='spoof' else role)+';'
    prelude+=(ROOT/'tests/firebase-double.js').read_text()
    if role in ['spoof','admin']: prelude+="localStorage.setItem('kk_role','admin');"
    page.set_content(html,wait_until='domcontentloaded')
    page.add_script_tag(content=prelude)
    for src in sources:
        if src.startswith('js/'): content=(ROOT/'web'/src).read_text()
        elif 'bootstrap' in src: content=(ROOT/'tests/vendor/bootstrap.bundle.min.js').read_text()
        else: continue
        page.add_script_tag(content=content)
    page.evaluate("window.__docState='interactive';document.dispatchEvent(new Event('DOMContentLoaded'));window.__docState='complete';")
    page.wait_for_timeout(700)
    return context,page,errors,warnings

with sync_playwright() as p:
    executable=os.environ.get('CHROME_BIN') or shutil.which('chromium') or shutil.which('chromium-browser')
    browser=p.chromium.launch(headless=True,**({'executable_path':executable} if executable else {}))
    for role in ['guest','spoof','admin']:
        context,page,errors,warnings=mount(browser,role)
        try:
            if role=='spoof':
                page.evaluate("App.showPage('admin')")
                check('localStorage no concede acceso admin',page.evaluate("!Auth.hasAdministrativeAccess() && App.currentPage !== 'admin'"))
            if role=='admin':
                page.evaluate("App.showPage('admin')")
                page.wait_for_timeout(300)
                for section in ['dashboard','orders','products','categories','caja','horario','personal','auditoria','apariencia','expenses']:
                    value=page.evaluate("section=>{const link=document.querySelector('[data-admin-section=\"'+section+'\"]');if(!link)return null;link.click();return true;}",section)
                    page.wait_for_timeout(70)
                    check('modulo admin '+section, value is True)
                check('modulo admin recibos',page.locator('#kReceiptsBody').count()==1)
                page.evaluate("document.querySelector('[data-admin-section=products]').click()")
                page.wait_for_timeout(150)
            if role in ['guest','admin']:
                for width in [320,375,768,991,992,1280,1440]:
                    page.set_viewport_size({'width':width,'height':800});page.wait_for_timeout(90)
                    dims=page.evaluate("({viewport:innerWidth,width:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth),side:document.querySelector('.admin-sidebar')?getComputedStyle(document.querySelector('.admin-sidebar')).display:null})")
                    check(f'{role} sin desborde {width}px',dims['width']<=width+1,dims)
                    if role=='guest':
                        card_width=page.locator('#productsGrid .prod-card').first.evaluate('el=>el.getBoundingClientRect().width')
                        check(f'tarjeta legible {width}px',card_width>=150,card_width)
                    if role=='admin' and width<992: check(f'sidebar oculto {width}px',dims['side']=='none')
                selector='#kkProductToolbar' if role=='admin' else '.products-header'
                sticky=page.locator(selector).evaluate("el=>getComputedStyle(el).position")
                check(f'buscador sticky {role}',sticky=='sticky',sticky)
                if role=='guest':
                    check('login propietario usa celular y contrasena', page.locator('#adminPhonePasswordForm').count()==1 and page.locator('#adminEmail').count()==0 and page.locator('#adminCode').count()==0)
                    alias=page.evaluate("Auth.phoneCredentialEmail('914491874')")
                    check('celular genera alias tecnico estable', alias=='phone.51914491874@mi-kiosco-c7313.firebaseapp.com', alias)
                    page.fill('#searchInput','catalogo');page.dispatch_event('#searchInput','input');page.wait_for_timeout(350)
                    check('busqueda cliente ignora descripcion', page.locator('#productsGrid .prod-card').count()==0)
                    page.fill('#searchInput','Producto 03');page.dispatch_event('#searchInput','input');page.wait_for_timeout(350)
                    check('busqueda cliente encuentra titulo', page.locator('#productsGrid .prod-card').count()==1)
                    page.fill('#searchInput','');page.dispatch_event('#searchInput','input');page.wait_for_timeout(350)
                if role=='admin':
                    page.fill('#kkAdminProductSearch','Bebidas');page.dispatch_event('#kkAdminProductSearch','input');page.wait_for_timeout(80)
                    visible=page.locator('#adminProductsGrid [data-admin-product-id]:not([hidden])').count()
                    check('busqueda admin ignora categoria', visible==0, visible)
                    page.fill('#kkAdminProductSearch','Producto 03');page.dispatch_event('#kkAdminProductSearch','input');page.wait_for_timeout(80)
                    visible=page.locator('#adminProductsGrid [data-admin-product-id]:not([hidden])').count()
                    check('busqueda admin encuentra titulo', visible==1, visible)
                    page.fill('#kkAdminProductSearch','');page.dispatch_event('#kkAdminProductSearch','input');page.wait_for_timeout(80)
                    page.evaluate("document.querySelector('[data-admin-section=support]')?.click()")
                    page.wait_for_timeout(50)
                    support_text=page.evaluate("()=>document.getElementById('sec-support')?.textContent || ''")
                    check('soporte muestra version 1.30.3', '1.30.3' in support_text, support_text)
                    page.evaluate("document.querySelector('[data-admin-section=products]')?.click()")
                page.screenshot(path=str(OUT/f'{role}-desktop.png'))
                page.set_viewport_size({'width':375,'height':812})
                page.screenshot(path=str(OUT/f'{role}-mobile.png'))
            if role=='guest':
                value=page.evaluate("""()=>{Cart.clear();const p=Store.getProducts().find(p=>p.id==='p0');Cart.add({...p,variantSelections:['Pequeno']},2);Cart.add({...p,variantSelections:['Grande']},3);return {lines:Cart.getItems().length,total:Cart.total(),qty:Cart.qty('p0'),desktop:document.querySelector('#cartItemsList')?.textContent,mobile:document.querySelector('#cartItemsListMobile')?.textContent};}""")
                check('carrito variantes independientes',value['lines']==2 and value['qty']==5,value)
                check('total incluye variantes en centavos',value['total']==20,value)
                check('carrito desktop y movil sincronizados',value['desktop']==value['mobile'],value)
                value=page.evaluate("""()=>{Cart.setQty(Cart.getItems()[1].id,999);return Cart.qty('p0');}""")
                check('stock compartido limita variantes',value==20,value)
                page.evaluate("Cart.remove(Cart.getItems()[0].id);Cart.removeAll(Cart.getItems()[1].id)")
                check('disminuir y eliminar carrito',page.evaluate('Cart.count()')==1)
                value=page.evaluate("()=>{Cart.clear();KioscoCore.setOffer({productId:'p1',offerPrice:1.25,active:true,endTime:'2030-01-01'});Cart.add(Store.getProducts().find(p=>p.id==='p1'),2);const total=Cart.total();KioscoCore.setOffer(null);return total;}")
                check('oferta coincide con total del carrito',value==2.5,value)
                page.evaluate("Cart.clear();Cart.add(Store.getProducts().find(p=>p.id==='p1'),2)")
                check('carrito persistido',page.evaluate("JSON.parse(localStorage.getItem('kk_cart')).length") == 1)
                page.evaluate("bootstrap.Offcanvas.getOrCreateInstance(document.getElementById('cartOffcanvas')).show()")
                page.wait_for_timeout(450)
                check('offcanvas movil visible',page.locator('#cartOffcanvas').evaluate("el=>el.classList.contains('show')"))
                page.evaluate("bootstrap.Offcanvas.getInstance(document.getElementById('cartOffcanvas')).hide()")
                page.evaluate("Auth.loginClient('Cliente Prueba','999999999')")
                page.wait_for_timeout(100)
                order_id=page.evaluate("Cart.checkout('Cliente Prueba','999999999','','pickup','',null,null,null)")
                check('checkout crea pedido',bool(order_id),order_id)
                saved=page.evaluate("id=>__records.get('orders/'+id)",order_id)
                check('pedido ligado al UID con precio actual',saved and saved['ownerId']=='client-test' and saved['total']==7,saved)
                check('checkout descuenta stock',page.evaluate("__records.get('products/p1').stock")==18)
                check('checkout vacia carrito',page.evaluate('Cart.count()')==0)
                check('imagen a base64 usa canvas real',page.evaluate("async()=>{const c=document.createElement('canvas');c.width=3;c.height=3;c.getContext('2d').fillRect(0,0,3,3);return (await KioscoImages.toDataUrl(c.toDataURL())).startsWith('data:image/jpeg;base64,');}"))
            if role=='admin':
                # Real form handlers and transaction paths with deterministic database doubles.
                page.evaluate("document.querySelector('[data-admin-section=products]').click();document.getElementById('btnAddProduct').click()")
                page.wait_for_timeout(450)
                page.evaluate("document.getElementById('productName').value='Producto formulario';document.getElementById('productPrice').value='4.25';document.getElementById('productStock').value='5';document.getElementById('productForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))")
                page.wait_for_timeout(500)
                check('formulario crea producto',page.evaluate("[...__records].some(([k,v])=>k.startsWith('products/')&&v.name==='Producto formulario'&&v.price===4.25&&v.stock===5)"))
                page.evaluate("document.querySelectorAll('.modal.show').forEach(el=>bootstrap.Modal.getInstance(el)?.hide());document.querySelector('[data-admin-section=categories]').click();document.getElementById('btnAddCat').click()")
                page.wait_for_timeout(450)
                page.evaluate("document.getElementById('catName').value='Categoria formulario';document.getElementById('catForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))")
                page.wait_for_timeout(500)
                check('formulario crea categoria',page.evaluate("[...__records].some(([k,v])=>k.startsWith('categories/')&&v.name==='Categoria formulario')"))
                page.evaluate("Admin.deleteCat('c1')")
                check('no elimina categoria con productos',page.evaluate("__records.has('categories/c1')"))
                page.evaluate("document.querySelector('[data-admin-section=personal]').click();document.getElementById('btnAddStaff').click()")
                page.wait_for_timeout(450)
                page.evaluate("document.getElementById('staffName').value='Personal Prueba';document.getElementById('staffPhone').value='';document.getElementById('kkStaffUid').value='staff-example';document.getElementById('staffForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))")
                page.wait_for_timeout(500)
                check('personal guarda UID y permisos',page.evaluate("__records.get('config/staff').uids.includes('staff-example')&&!!__records.get('config/staff').permissionsByUid['staff-example']"))
                page.evaluate('Admin.removeStaff(0)');page.wait_for_timeout(150)
                check('eliminar personal revoca UID',page.evaluate("!__records.get('config/staff').uids.includes('staff-example')"))
                page.evaluate("document.querySelector('[data-admin-section=expenses]').click();document.getElementById('addExpenseBtn').click()")
                page.wait_for_timeout(450)
                page.evaluate("document.getElementById('expenseDescription').value='Compra prueba';document.getElementById('expenseAmount').value='12.35';document.getElementById('expenseForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))")
                page.wait_for_timeout(500)
                check('formulario registra gasto',page.evaluate("[...__records].some(([k,v])=>k.startsWith('expenses/')&&v.description==='Compra prueba'&&v.amount===12.35)"))
                page.evaluate("document.querySelector('[data-admin-section=horario]').click()")
                page.wait_for_timeout(150)
                page.evaluate("document.getElementById('dayFrom0').value='09:00';document.getElementById('dayTo0').value='18:00';document.getElementById('btnSaveSchedule').click()")
                page.wait_for_timeout(150)
                check('horario guarda configuracion usada',page.evaluate("__records.get('config/settings').schedule[0].from==='09:00'"))
                page.evaluate("document.querySelector('[data-admin-section=caja]').click()")
                page.wait_for_timeout(150)
                page.evaluate("document.getElementById('cajaInicial').value='-1';document.getElementById('btnAbrirCaja').click()")
                check('caja rechaza monto negativo',page.locator('#btnAbrirCaja').count()==1)
                page.evaluate("document.getElementById('cajaInicial').value='10.25';document.getElementById('btnAbrirCaja').click()")
                check('caja abre con centavos',page.locator('#btnCerrarCaja').count()==1)
                page.evaluate("document.getElementById('cajaFinal').value='15.50';document.getElementById('btnCerrarCaja').click()")
                check('caja guarda cierre',page.evaluate("JSON.parse(localStorage.getItem('kk_caja_'+KioscoCore.limaDate().toISOString().slice(0,10))).final===15.5"))
                page.evaluate("__records.set('products/inventory-test',{name:'Reserva',price:3,stock:8,active:true,stockReservations:{'reservation-test':2}});__records.set('orders/reservation-test',{customer:'Reserva',status:'pending',productQuantities:{'inventory-test':2},items:[],total:6,createdAt:{seconds:Math.floor(Date.now()/1000)}})")
                page.evaluate("Orders.setStatus('reservation-test','done')")
                check('completar mantiene stock y confirma reserva',page.evaluate("__records.get('products/inventory-test').stock===8&&__records.get('orders/reservation-test').inventoryCommitted['inventory-test']===2"))
                page.evaluate("Orders.setStatus('reservation-test','rejected')")
                check('rechazar devuelve stock una vez',page.evaluate("__records.get('products/inventory-test').stock===10"))
                page.evaluate("Orders.setStatus('reservation-test','rejected')")
                check('rechazo repetido no duplica stock',page.evaluate("__records.get('products/inventory-test').stock===10"))
                page.evaluate("Orders.setStatus('reservation-test','pending')")
                check('reabrir vuelve a reservar stock',page.evaluate("__records.get('products/inventory-test').stock===8"))
                page.evaluate("Orders.del('reservation-test')")
                check('eliminar pendiente libera stock',page.evaluate("__records.get('products/inventory-test').stock===10&&!__records.has('orders/reservation-test')"))
                value=page.evaluate("async()=>{const previous=KIOSCO_UPGRADE_CONFIG;window.KIOSCO_UPGRADE_CONFIG={...previous,imageStorage:'firebase-storage'};const percentages=[];try {const asset=await KioscoImages.upload(new File(['binary'],'test.png',{type:'image/png'}),'test',n=>percentages.push(n));await KioscoImages.remove(asset.imagePath);return {percentages,deleted:__deletedImages.includes(asset.imagePath)};}finally{window.KIOSCO_UPGRADE_CONFIG=previous;}}")
                check('Storage usa progreso real del SDK',value['percentages']==[0,50,100],value)
                check('Storage elimina archivo propio no referenciado',value['deleted'],value)
                check('no elimina URL externa',page.evaluate("KioscoImages.remove('', 'https://example.com/image.png')") is False)
                check('fallback visual sin bucle',page.evaluate("()=>{const img=new Image();document.body.append(img);img.src='https://example.com/fail.png';img.dispatchEvent(new Event('error'));const ok=img.dataset.fallbackApplied==='true'&&img.src.startsWith('data:image/svg+xml');img.remove();return ok;}"))
                page.evaluate("document.querySelector('[data-admin-section=products]').click()")
                # Server failures and row validation remain isolated; XLSX parsing itself is a double.
                page.evaluate("window.__importRows=[{nombre:'Importado A',precio:'3,50',stock:2,activo:'SI'},{nombre:'Invalido',precio:'abc'},{nombre:'Falla servidor',precio:2},{nombre:'Importado B',precio:4,activo:'NO'}];window.__failProductName='Falla servidor';document.getElementById('importProductsExcelBtn').click()")
                page.locator('#productsExcelFile').set_input_files({'name':'productos.xlsx','mimeType':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','buffer':b'fixture'})
                page.wait_for_timeout(150)
                page.evaluate("document.getElementById('runProductsImportBtn').click()")
                page.wait_for_timeout(350)
                summary=page.locator('#productsImportResult').inner_text()
                check('import sigue tras errores de fila y red', '2 productos importados' in summary and '2 errores' in summary,summary)
                page.evaluate("document.querySelectorAll('.modal.show').forEach(el=>bootstrap.Modal.getInstance(el)?.hide())")
                page.evaluate("document.querySelector('[data-admin-section=dashboard]').click();document.querySelector('[data-dash-period=month]').click()")
                page.evaluate("document.getElementById('dlDay').click()")
                page.wait_for_timeout(200)
                download=page.evaluate("__downloads.filter(x=>x.type==='xlsx').at(-1)")
                check('Excel respeta periodo activo',download and '-month-' in download['name'],download)
                page.evaluate("()=>{const c=document.createElement('canvas');c.width=3;c.height=3;c.getContext('2d').fillRect(0,0,3,3);const p=__records.get('products/p2');__records.set('products/p2',{...p,price:123.45,images:[c.toDataURL()]});document.querySelector('[data-admin-section=products]').click();}")
                page.evaluate("document.getElementById('exportCatalogPdfBtn').click()")
                page.wait_for_timeout(450)
                download=page.evaluate("__downloads.filter(x=>x.type==='pdf').at(-1)")
                check('PDF incluye imagen real de canvas',download and len(download['images'])>=1,{'images':len(download['images']) if download else 0})
                check('PDF relee precio actual',download and '123.45' in json.dumps(download['texts']),None)
                reads=page.evaluate("__reads.filter(r=>r.source==='server').map(r=>r.path)")
                check('exportaciones solicitan datos al servidor','orders' in reads and 'products' in reads and 'categories' in reads,reads)
                page.evaluate('Auth.logout()');page.wait_for_timeout(100)
                check('logout retira acceso admin',page.evaluate('!Auth.hasAdministrativeAccess()'))
            check('sin errores JS '+role,not errors,errors)
            check('sin warnings inesperados '+role,not warnings,warnings)
        except Exception as e:
            check('ejecucion '+role,False,str(e))
        context.close()
    browser.close()
summary={'environment':'Offline Chromium + real DOM/canvas + Bootstrap 5.3.6 test assets. Firebase, XLSX and jsPDF are doubles. No production or security-rule execution.','passed':sum(x['passed'] for x in results),'failed':sum(not x['passed'] for x in results),'tests':results}
(OUT/'browser.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:summary[k] for k in ['passed','failed']}))
raise SystemExit(1 if summary['failed'] else 0)
