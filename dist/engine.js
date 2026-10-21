import {isSRK,convertSRK} from './srk.js';
export const DEFAULT_RULES={penalty:20,threshold:50,percent:20,freeze:240,duration:300};
export function roundTime(value,precision='min',rounding='floor'){if(precision==null)return value;const factor=({ms:1/60000,s:1/60,min:1,h:60,d:1440})[precision];if(!factor)throw Error('时间精度不支持');return Math[rounding](Number((value/factor).toFixed(7)))*factor;}
export const scorePenalty=r=>r.rankingPenalty??r.penalty;
export const compareScores=(a,b)=>b.solved-a.solved||scorePenalty(a)-scorePenalty(b);
const number=(v,label)=>{const n=Number(v);if(!Number.isFinite(n)||n<0)throw Error(`${label}必须是非负数`);return n;};
export function normalize(raw){
 if(!raw||typeof raw!=='object')throw Error('文件内容必须是榜单对象');
 if(isSRK(raw))raw=convertSRK(raw);
 let teams=raw.teams,problems=raw.problems,submissions=raw.submissions;
 if(!Array.isArray(teams)||!teams.length)throw Error('缺少非空 teams 队伍数组');
 if(teams.length>20000)throw Error('单场最多支持 20,000 支队伍');
 const ids=new Set();teams=teams.map((t,i)=>{const id=String(t.id??i+1);if(ids.has(id))throw Error(`队伍 ID 重复：${id}`);ids.add(id);return {...t,id,name:String(t.name||`队伍 ${i+1}`),school:String(t.school||'未填写学校'),unofficial:t.unofficial===true||t.unofficial==='true'||t.unofficial===1};});
 if(!Array.isArray(problems)||!problems.length)throw Error('缺少非空 problems 题目数组');
 problems=problems.map(p=>typeof p==='string'?{id:p}:({...p,id:String(p.id??p.label)}));
 if(new Set(problems.map(p=>p.id)).size!==problems.length)throw Error('题目 ID 不能重复');
 if(problems.length>100)throw Error('单场最多支持 100 道题目');
 const ps=new Set(problems.map(p=>p.id));const duration=number(raw.duration??300,'比赛时长');if(!duration||duration>10080)throw Error('比赛时长应在 1～10080 分钟内');
 if(raw.sourceRules){const original=raw.sourceRules;raw={...raw,sourceRules:{}};for(const key of ['penalty','freeze'])if(original[key]!==undefined)raw.sourceRules[key]=number(original[key],`原榜 ${key}`);if(raw.sourceRules.freeze>duration)throw Error('原榜封榜起点不能超过比赛时长');for(const key of ['timePrecision','rankingTimePrecision'])if(original[key]!==undefined){if(original[key]!==null&&!['ms','s','min','h','d'].includes(original[key]))throw Error('原榜时间精度不支持');raw.sourceRules[key]=original[key];}for(const key of ['timeRounding','rankingTimeRounding'])if(original[key]!==undefined){if(!['floor','ceil','round'].includes(original[key]))throw Error('原榜取整方式不支持');raw.sourceRules[key]=original[key];}}
 if(raw.sourceRules&&raw.srkMetadata?.sorter?.config?.noPenaltyResults!==undefined){const list=raw.srkMetadata.sorter.config.noPenaltyResults;if(!Array.isArray(list)||list.some(v=>v!==null&&typeof v!=='string'))throw Error('原榜免罚判定配置无效');raw.sourceRules.srkNoPenaltyResults=[...list];}
 else if(raw.sourceRules&&raw.format==='srk')raw.sourceRules.srkNoPenaltyResults=['FB','AC','?','NOUT','CE','UKE',null];
 if(raw.sourceMedals&&(!Array.isArray(raw.sourceMedals.count)||raw.sourceMedals.count.length!==3||raw.sourceMedals.count.some(n=>!Number.isSafeInteger(n)||n<0)))throw Error('原榜奖牌名额无效');
 if(submissions!==undefined){if(!Array.isArray(submissions))throw Error('submissions 必须是数组');if(submissions.length>500000)throw Error('最多支持 500,000 条提交');submissions=submissions.map((s,i)=>{const teamId=String(s.teamId??s.team_id),problemId=String(s.problemId??s.problem_id);if(!ids.has(teamId)||!ps.has(problemId))throw Error(`第 ${i+1} 条提交引用未知队伍或题目`);const time=number(s.time,'提交时间');const aliases={CORRECT:'AC',ACCEPTED:'AC',WRONG_ANSWER:'WA',COMPILATION_ERROR:'CE',COMPILER_ERROR:'CE',PENDING:'PD',TIME_LIMIT_EXCEEDED:'TLE',RUNTIME_ERROR:'RE',MEMORY_LIMIT_EXCEEDED:'MLE'};const v=String(s.verdict??s.result??'').toUpperCase().replaceAll('-','_').replaceAll(' ','_');const verdict=aliases[v]||v;if(!['AC','WA','CE','PD','TLE','RE','MLE','OLE','PE','IGNORED'].includes(verdict))throw Error(`第 ${i+1} 条提交的判定 ${v} 不支持`);return {teamId,problemId,time,verdict,_i:i};}).sort((a,b)=>a.time-b.time||a._i-b._i);}
 else teams=teams.map(t=>({...t,results:Object.fromEntries(problems.map(p=>{const c=t.results?.[p.id];if(!c)return[p.id,null];if(c.solved===true){if(c.time==null)throw Error('通过记录必须包含 time');return[p.id,{solved:true,time:number(c.time,'通过时间'),wrong:Math.trunc(number(c.wrong??0,'错误次数'))}];}return[p.id,{solved:false,wrong:Math.trunc(number(c.wrong??0,'错误次数')),pending:Math.trunc(number(c.pending??0,'待揭榜次数'))}];}))}));
 return {id:String(raw.id||globalThis.crypto?.randomUUID?.()||Date.now()),title:String(raw.title||'导入的历史榜单'),duration,problems,teams,...(submissions!==undefined?{submissions}:{}),source:String(raw.source||'本地导入'),importedAt:raw.importedAt||new Date().toISOString(),...Object.fromEntries(['format','sourceRules','sourceMedals','useSourceRules','useSourceMedals','srkMetadata','importWarnings'].filter(k=>raw[k]!==undefined).map(k=>[k,raw[k]]))};
}
export function compute(contest,time,rules=DEFAULT_RULES,{traditional=false,final=false}={}){
 const replay=Array.isArray(contest.submissions);const minute=replay?Math.min(time,contest.duration):contest.duration;
 const frozen=!final&&replay&&minute>=rules.freeze;const cutoff=frozen?rules.freeze:minute;
 const rows=contest.teams.map(t=>({...t,cells:Object.fromEntries(contest.problems.map(p=>[p.id,{solved:false,wrong:0,pending:0,time:null}]))}));const byId=new Map(rows.map(r=>[r.id,r]));
 if(replay){for(const s of contest.submissions){if(s.time>minute||s.time>=contest.duration)continue;const c=byId.get(s.teamId).cells[s.problemId];if(c.solved)continue;if(s.time>=cutoff&&frozen){c.pending++;continue;}if(s.verdict==='AC'){c.solved=true;c.time=s.time;}else if(['WA','TLE','RE','MLE','OLE','PE'].includes(s.verdict))c.wrong++;else if(s.verdict==='PD')c.pending++;}}
 else for(const r of rows)for(const p of contest.problems){const c=r.results?.[p.id];if(c)Object.assign(r.cells[p.id],c);}
 const count=rows.length;const revealCount=Math.min(rules.threshold,Math.ceil(count*rules.percent/100));
 const stats=contest.problems.map(p=>{const ac=rows.filter(r=>r.cells[p.id].solved);const open=traditional||final||minute>=rules.freeze||ac.length>=revealCount;const first=ac.length?Math.min(...ac.map(r=>r.cells[p.id].time)):null;return {...p,solved:ac.length,open,first,attempted:rows.reduce((n,r)=>n+r.cells[p.id].wrong+(r.cells[p.id].solved?1:0),0)};});
 for(const r of rows){r.solved=Object.values(r.cells).filter(c=>c.solved).length;r.penalty=Number(Object.values(r.cells).reduce((s,c)=>s+(c.solved?roundTime(c.time,rules.timePrecision===undefined?'min':rules.timePrecision,rules.timeRounding||'floor')+c.wrong*rules.penalty:0),0).toFixed(9));r.rankingPenalty=roundTime(r.penalty,rules.rankingTimePrecision??null,rules.rankingTimeRounding||'floor');}
 rows.sort((a,b)=>compareScores(a,b)||(Number.isInteger(a.sourceIndex)&&Number.isInteger(b.sourceIndex)?a.sourceIndex-b.sourceIndex:a.name.localeCompare(b.name,'zh-CN')));let official=0,last=null,rank=0;for(const r of rows){if(r.unofficial){r.rank='*';continue;}official++;if(!last||compareScores(r,last)!==0)rank=official;r.rank=rank;last=r;}
 return {rows,stats,minute,frozen,replay,revealCount,open:stats.filter(p=>p.open).length,total:count};
}
export function parseCSV(text){
 const rows=[];let row=[],value='',quote=false;text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){value+='"';i++;}else quote=!quote;}else if(!quote&&(c===','||c==='\t')){row.push(value);value='';}else if(!quote&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))rows.push(row);row=[];value='';}else value+=c;}
 if(quote)throw Error('CSV 引号未闭合');row.push(value);if(row.some(x=>x.trim()))rows.push(row);if(rows.length<2)throw Error('CSV 至少需要表头和一条数据');
 const headers=rows.shift().map(h=>h.trim());return rows.map((r,i)=>{if(r.length!==headers.length)throw Error(`CSV 第 ${i+2} 行列数不一致`);return Object.fromEntries(headers.map((h,j)=>[h,r[j].trim()]));});
}
export function fromCSV(text,title){
 const records=parseCSV(text),h=Object.keys(records[0]);
 if(h.includes('teamId')&&h.includes('problemId')&&h.includes('time')&&h.includes('verdict')){const teams=[...new Map(records.map(r=>[r.teamId,{id:r.teamId,name:r.name||r.teamId,school:r.school,unofficial:r.unofficial}])).values()];return normalize({title,teams,problems:[...new Set(records.map(r=>r.problemId))],submissions:records});}
 const nameKey=['name','队名','队伍','team'].find(x=>h.includes(x));if(!nameKey)throw Error('未找到队名列，请使用 name 或 队名');const problemIds=h.filter(x=>/^[A-Z]$/.test(x));if(!problemIds.length)throw Error('未找到题目列，请使用 A、B、C…作为表头');
 return normalize({title,problems:problemIds,teams:records.map((r,i)=>({id:r.id||i+1,name:r[nameKey],school:r.school||r['学校'],unofficial:r.unofficial,results:Object.fromEntries(problemIds.map(p=>[p,parseCell(r[p])]))}))});
}
export function parseCell(value){const v=String(value??'').trim();if(!v||v==='-'||v==='—')return null;let m=v.match(/^\+(\d*)\s+(\d+)(?::(\d{2}))?$/);if(m){if(m[3]&&Number(m[3])>=60)throw Error(`非法时间：${v}`);return {solved:true,wrong:Number(m[1]||0),time:m[3]?Number(m[2])*60+Number(m[3]):Number(m[2])};}m=v.match(/^-(\d+)$/);if(m)return {solved:false,wrong:Number(m[1])};throw Error(`无法识别题目单元格「${v}」，请用 +1 01:30、+ 45、-2 或留空`);}
export function csvEscape(v){let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
