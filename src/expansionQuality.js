import {augmentationPool} from './augmentationSelection.js';

// Join labels to sample-level judgments; never infer label quality from aggregate rule rates.
export function labelQuality(report, label, pool=augmentationPool(report)) {
  const counts={passed:0,failed:0,unknown:0};
  const start=Number(label.sampleOffset||0), end=start+Number(label.count||0);
  const ids=label.sampleIds&&new Set(label.sampleIds);
  for(const row of pool.rows){
    let weight=0;
    if(ids) weight=ids.has(row.sampleId)?1:0;
    else if(report.mock && Number.isInteger(label.sampleOffset)){
      weight=report.sampleResults ? Number(row.index>=start&&row.index<end)
        : pool.period?Math.max(0,Math.floor((end-1-row.index)/pool.period)-Math.floor((start-1-row.index)/pool.period)):0;
    }
    counts[row.failed.length?'failed':row.valid?'passed':'unknown']+=weight;
  }
  counts.unknown+=Math.max(0,Number(label.count||0)-counts.passed-counts.failed-counts.unknown);
  return {...counts,failureRate:counts.passed+counts.failed?counts.failed/(counts.passed+counts.failed):null};
}
export function expansionCount(row, config={}){
  if(config.percent!=null) return Math.ceil(row.baseCount*Number(config.percent)/100);
  return config.count??row.recommended??0;
}
