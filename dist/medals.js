export const DEFAULT_MEDALS={gold:10,silver:20,bronze:30};
export const MEDAL_NAMES={gold:'金牌',silver:'银牌',bronze:'铜牌'};
export function validateMedals(config){
 for(const key of ['gold','silver','bronze'])if(!Number.isFinite(config[key])||config[key]<0||config[key]>100)throw Error('奖牌比例应在 0～100% 之间');
 if(config.gold+config.silver+config.bronze>100+1e-8)throw Error('金、银、铜牌比例之和不能超过 100%');
 return {gold:config.gold,silver:config.silver,bronze:config.bronze};
}
export function medalLimits(count,config=DEFAULT_MEDALS){
 validateMedals(config);const cutoff=p=>Math.min(count,Math.ceil(Number((count*p/100).toFixed(10))));
 return {gold:cutoff(config.gold),silver:cutoff(config.gold+config.silver),bronze:cutoff(config.gold+config.silver+config.bronze)};
}
export function medalFor(rank,solved,limits){if(solved<=0||typeof rank!=='number')return null;return rank<=limits.gold?'gold':rank<=limits.silver?'silver':rank<=limits.bronze?'bronze':null;}
export function awardMedals(rows,config=DEFAULT_MEDALS){
 const official=rows.filter(r=>!r.unofficial&&!r.virtual);const limits=medalLimits(official.length,config);
 const awarded=rows.map(r=>({...r,medal:r.virtual?medalFor(r.virtualRank,r.solved,limits):r.unofficial?null:medalFor(r.rank,r.solved,limits)}));
 const counts={gold:0,silver:0,bronze:0};for(const r of awarded)if(!r.virtual&&r.medal)counts[r.medal]++;
 return {rows:awarded,counts,limits,eligible:official.length};
}
export function schoolStandings(rows){
 const seen=new Set(),result=[];let last=null,rank=0;
 for(const r of rows){if(r.unofficial||r.virtual||seen.has(r.school))continue;seen.add(r.school);if(!last||r.solved!==last.solved||r.penalty!==last.penalty)rank=result.length+1;result.push({...r,rank});last=r;}
 return result;
}
