const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const project = process.env.CALLPILOT_FRONTEND_TEST_ROOT || path.resolve(__dirname, '..');
const requireProject = createRequire(path.join(project, 'package.json'));
const React = requireProject('react');
const ts = requireProject('typescript');
const source = fs.readFileSync(path.join(__dirname, '../components/jigsaw/delete-contact-button.tsx'), 'utf8');
const widgets = Object.fromEntries(['AlertDialog','AlertDialogAction','AlertDialogCancel','AlertDialogContent','AlertDialogDescription','AlertDialogFooter','AlertDialogHeader','AlertDialogTitle','AlertDialogTrigger'].map(name => [name, Object.assign(function Widget(){}, {displayName:name})]));
function harness(request) {
  const values = [], refs = [];
  let cursor=0, refCursor=0;
  const hooks = {
    useState(initial) { const id=cursor++; if(!(id in values))values[id]=initial;return [values[id],next=>{values[id]=typeof next==='function'?next(values[id]):next;}]; },
    useRef(initial) { const id=refCursor++;if(!refs[id])refs[id]={current:initial};return refs[id]; }
  };
  const module={exports:{}};
  const requests=[];
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    module,exports:module.exports,Error,require:name=> name==='react'?hooks:name==='lucide-react'?{Loader2:()=>null,Trash2:()=>null}:name==='@/components/ui/alert-dialog'?widgets:name==='@/services/jigsaw-service'?{jigsaw:(...args)=>{requests.push(args);return request(...args);}}:requireProject(name)
  });
  let deleted=0;
  const render=()=>{cursor=0;refCursor=0;return module.exports.DeleteContactButton({contact:{uid:'contact-123',name:'Alex Example'},onDeleted:()=>{deleted++;}});};
  return {render,requests,values,deleted:()=>deleted};
}
function find(element, name) {
  if(!element || typeof element!=='object')return null;
  if(element.type?.displayName===name)return element;
  for(const child of React.Children.toArray(element.props?.children)){const match=find(child,name);if(match)return match;}
  return null;
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const event=()=>({prevented:false,preventDefault(){this.prevented=true;}});

test('opening and cancelling a named delete confirmation does not send a deletion',()=>{
  const h=harness(async()=>{});
  let tree=h.render();
  tree.props.onOpenChange(true);
  tree=h.render();
  assert.equal(tree.props.open,true);
  assert.ok(React.Children.toArray(find(tree,'AlertDialogTitle').props.children).includes('Alex Example'));
  const description=find(tree,'AlertDialogDescription').props.children;
  assert.match(description,/connected ATS record stays unchanged/);
  assert.match(description,/future syncs will not restore/);
  tree.props.onOpenChange(false);
  assert.equal(h.render().props.open,false);
  assert.equal(h.requests.length,0);
});

test('confirmed delete stays open while pending and suppresses duplicate submission',async()=>{
  const pending=deferred();const h=harness(()=>pending.promise);
  h.render().props.onOpenChange(true);
  const action=find(h.render(),'AlertDialogAction');
  const click=event();const request=action.props.onClick(click);
  assert.equal(click.prevented,true);
  assert.equal(h.requests.length,1);
  assert.deepEqual(Array.from(h.requests[0]),['contacts/contact-123/','DELETE']);
  let tree=h.render();
  assert.equal(find(tree,'AlertDialogAction').props.disabled,true);
  assert.equal(find(tree,'AlertDialogCancel').props.disabled,true);
  tree.props.onOpenChange(false);
  assert.equal(h.render().props.open,true,'Cannot dismiss while deletion outcome is pending');
  await action.props.onClick(event());
  assert.equal(h.requests.length,1);
  assert.equal(h.deleted(),0);
  pending.resolve();await request;
  assert.equal(h.render().props.open,false);
  assert.equal(h.deleted(),1);
});

test('failed delete keeps the contact and confirmation visible, then permits an explicit retry',async()=>{
  let attempts=0;const h=harness(async()=>{if(++attempts===1)throw new Error('Access denied');});
  h.render().props.onOpenChange(true);
  await find(h.render(),'AlertDialogAction').props.onClick(event());
  const tree=h.render();
  assert.equal(tree.props.open,true);
  assert.equal(h.deleted(),0);
  assert.ok(h.values.includes('Access denied'));
  assert.equal(find(tree,'AlertDialogAction').props.disabled,false);
  await find(tree,'AlertDialogAction').props.onClick(event());
  assert.equal(h.deleted(),1);
  assert.equal(h.render().props.open,false);
});

test('deleting the last contact on a later page moves back and reloads the list',()=>{
  const dashboard=fs.readFileSync(path.join(__dirname,'../components/jigsaw/jigsaw-dashboard.tsx'),'utf8');
  const file=ts.createSourceFile('dashboard.tsx',dashboard,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let declaration;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(file)==='deleted')declaration=node.getText(file);ts.forEachChild(node,visit);}
  visit(file);assert.ok(declaration,'Production deleted callback is present');
  for(const [count,expectedOffset] of [[1,0],[2,null]]){
    let offset=null,reloads=0,feedback;
    const module={exports:{}};
    vm.runInNewContext(ts.transpileModule(`const ${declaration};module.exports=deleted;`,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
      module,exports:module.exports,contacts:Array.from({length:count}),previous:0,
      setFailure(){},setFeedback:value=>{feedback=value;},setOffset:value=>{offset=value;},resource:{reload(){reloads++;}}
    });
    module.exports({name:'Alex Example'});
    assert.equal(offset,expectedOffset);
    assert.equal(reloads,1);
    assert.equal(feedback,'Alex Example deleted from CallPilot contacts.');
  }
});
