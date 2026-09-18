import { mockResult, readStore } from './mockStore';

// Large task snapshots and reports exceed localStorage's small synchronous quota.
// Keep the legacy state intact until the IndexedDB transaction has committed.
let database;
function openDatabase(){
  if(!database)database=new Promise((resolve,reject)=>{
    const request=indexedDB.open('data-factory-v5-state',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('state');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>{database=null;reject(request.error);};
  });
  return database;
}
async function stateTransaction(patch){
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('state',patch?'readwrite':'readonly'),store=tx.objectStore('state');
    const request=store.get('application');let state;
    request.onsuccess=()=>{state=request.result||readStore('application-state',{});if(patch){state={...state,...patch};store.put(state,'application');}};
    tx.oncomplete=()=>{
      if(patch){
        const {tasks,datasets,...metadata}=state;
        try{window.localStorage.setItem('data-factory-frontend-v3:application-state',JSON.stringify(metadata));window.localStorage.setItem('data-factory-v5-state-updated',String(Date.now()));}catch(error){console.warn('状态通知缓存不可用',error);}
      }
      resolve(state);
    };
    tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('状态保存已中止'));
  });
}
export const localStoreApi={
  getState:async()=>{const state=await stateTransaction();return {exists:Object.keys(state).length>0,...state};},
  saveState:patch=>stateTransaction(patch),
  saveTasks:tasks=>stateTransaction({tasks}),
  getValidations:()=>mockResult({items:readStore('validations',[])},40),
  getActivity:()=>mockResult({items:readStore('activity',[])},40),
};
