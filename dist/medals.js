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
export function awardMedals(rows,config=DEFAULT_MEDALS,policy=null){
 const official=rows.filter(r=>!r.unofficial&&!r.virtual);let limits=medalLimits(official.length,config);
 if(policy){if(!Array.isArray(policy.count)||policy.count.length!==3||policy.count.some(n=>!Number.isInteger(n)||n<0))throw Error('原始奖牌名额无效');const [g,s,b]=policy.count;limits={gold:Math.min(official.length,g),silver:Math.min(official.length,g+s),bronze:Math.min(official.length,g+s+b)};}
 let position=0;
 const awarded=rows.map(r=>{if(!r.unofficial&&!r.virtual)position++;const rank=r.virtual?(policy?.noTied?r.virtualPosition:r.virtualRank):policy?.noTied?position:r.rank;return {...r,medal:r.unofficial&&!r.virtual?null:medalFor(rank,r.solved,limits)};});
 const counts={gold:0,silver:0,bronze:0};for(const r of awarded)if(!r.virtual&&r.medal)counts[r.medal]++;
 return {rows:awarded,counts,limits,eligible:official.length,medalPolicy:policy};
}
export function schoolStandings(rows){
 const seen=new Set(),result=[];let last=null,rank=0;
 for(const r of rows){if(r.unofficial||r.virtual||seen.has(r.school))continue;seen.add(r.school);if(!last||r.solved!==last.solved||(r.rankingPenalty??r.penalty)!==(last.rankingPenalty??last.penalty))rank=result.length+1;result.push({...r,rank});last=r;}
 return result;
}
