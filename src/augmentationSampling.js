export function buildAugmentationSelection(pool,includeUnchecked=false){
 return {period:pool.period,slots:pool.slots,checkedCount:pool.count,count:pool.count+(includeUnchecked?pool.uncheckedCount:0),sampleIds:pool.sampleIds,uncheckedStart:pool.uncheckedStart,uncheckedCount:includeUnchecked?pool.uncheckedCount:0,uncheckedIds:includeUnchecked?pool.uncheckedIds:[]};
}
export function selectionIndex(selection,rank){
 if(rank>=selection.checkedCount&&selection.uncheckedCount){const offset=rank-selection.checkedCount;return selection.uncheckedIds?.length?{sampleId:selection.uncheckedIds[offset]}:{index:selection.uncheckedStart+offset};}
 if(selection.sampleIds?.length)return {sampleId:selection.sampleIds[rank]};
 return {index:Math.floor(rank/selection.slots.length)*selection.period+selection.slots[rank%selection.slots.length]};
}
// Seeded permutation: no duplicate references within a round; extra rounds reuse the pool.
export function sampledRank(index,size,seed=1){
 if(size<=1)return 0;
 const gcd=(a,b)=>b?gcd(b,a%b):a;
 let step=1+((seed>>>0)%(size-1));while(gcd(step,size)!==1)step=step%(size-1)+1;
 return ((index%size)*step+(seed>>>0)%size)%size;
}
