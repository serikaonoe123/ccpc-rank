import {compute,compareScores} from './engine.js';
import {validateMedals} from './medals.js';
import {mapSRKVerdict} from './srk.js';
const allowed=['AC','WA','TLE','RE','MLE','OLE','PE','CE'];
export function createVP(contest,name,school,now=Date.now()){
 if(!Array.isArray(contest.submissions))throw Error('此赛事只有最终快照，缺少提交时间，不能进行 VP');
 if(!String(name).trim())throw Error('请填写 VP 队名');
 return {id:globalThis.crypto?.randomUUID?.()||`vp-${now}`,contestId:contest.id,name:String(name).trim().slice(0,80),school:String(school||'我的学校').trim().slice(0,80),status:'running',elapsedMs:0,resumedAt:now,createdAt:now,submissions:[]};
}
export function elapsedMinutes(session,duration,now=Date.now()){
 const elapsed=session.elapsedMs+(session.status==='running'?Math.max(0,now-session.resumedAt):0);
 return Math.max(0,Math.min(duration,elapsed/60000));
}
export function transitionVP(session,action,duration,now=Date.now()){
 if(action==='resume'){if(session.status!=='paused')throw Error('只有暂停的 VP 可以继续');return {...session,status:'running',resumedAt:now};}
 if(!['pause','finish'].includes(action))throw Error('未知 VP 操作');
 if(session.status==='finished')throw Error('VP 已结束');
 return {...session,status:action==='pause'?'paused':'finished',elapsedMs:elapsedMinutes(session,duration,now)*60000,resumedAt:null,...(action==='finish'?{finishedAt:now}:{})};
}
export function recordVP(session,contest,problemId,verdict,now=Date.now()){
 if(session.status!=='running')throw Error('请先继续 VP，再记录评测结果');
 const time=elapsedMinutes(session,contest.duration,now);
 if(time>=contest.duration)throw Error('比赛时间已结束，不能再记录成绩');
 if(!contest.problems.some(p=>p.id===problemId)||!allowed.includes(verdict))throw Error('题目或判定无效');
 if(session.submissions.some(s=>s.problemId===problemId&&s.verdict==='AC'))throw Error('此题已经通过，无需重复记录');
 return {...session,submissions:[...session.submissions,{problemId,time,verdict}]};
}
export function virtualRow(session,contest,rules,now=Date.now()){
 const id=`vp:${session.id}`;
 const c={...contest,teams:[{id,name:session.name,school:session.school}],submissions:session.submissions.map(s=>({...s,teamId:id,...(rules.srkNoPenaltyResults?{verdict:mapSRKVerdict(s.verdict==='RE'&&rules.srkNoPenaltyResults.includes('RTE')?'RTE':s.verdict,rules.srkNoPenaltyResults)}:{})}))};
 const row=compute(c,elapsedMinutes(session,contest.duration,now),rules,{final:true}).rows[0];
 return {...row,virtual:true,unofficial:true};
}
export function mergeVirtual(state,session,contest,rules,now=Date.now()){
 const row=virtualRow(session,contest,rules,now);
 row.virtualRank=1+state.rows.filter(r=>!r.unofficial&&compareScores(r,row)<0).length;
 row.virtualPosition=1+state.rows.filter(r=>!r.unofficial&&compareScores(r,row)<=0).length;
 row.rank=row.virtualRank;
 return {...state,rows:[...state.rows,row].sort((a,b)=>compareScores(a,b)||(a.virtual?1:0)-(b.virtual?1:0)||(Number.isInteger(a.sourceIndex)&&Number.isInteger(b.sourceIndex)?a.sourceIndex-b.sourceIndex:a.name.localeCompare(b.name,'zh-CN')))};
}
export function restoreVP(raw,contest){
 if(!raw||!contest||!Array.isArray(contest.submissions)||typeof raw.id!=='string'||!['running','paused','finished'].includes(raw.status))return null;
 if(!Number.isFinite(raw.elapsedMs)||raw.elapsedMs<0||raw.elapsedMs>contest.duration*60000)return null;
 if(raw.status==='running'&&!Number.isFinite(raw.resumedAt))return null;
 if(!Array.isArray(raw.submissions)||raw.submissions.some(s=>!contest.problems.some(p=>p.id===s.problemId)||!allowed.includes(s.verdict)||!Number.isFinite(s.time)||s.time<0||s.time>=contest.duration))return null;
 if(raw.rules&&(!['penalty','threshold','percent','freeze'].every(k=>Number.isFinite(raw.rules[k])&&raw.rules[k]>=0)||raw.rules.threshold<1||raw.rules.percent<=0||raw.rules.percent>100))return null;
 if(raw.medals){try{validateMedals(raw.medals);}catch{return null;}}
 if(raw.medalPolicy&&(!Array.isArray(raw.medalPolicy.count)||raw.medalPolicy.count.length!==3||raw.medalPolicy.count.some(n=>!Number.isInteger(n)||n<0)))return null;
 return {...raw,name:String(raw.name||'我的 VP 队伍').slice(0,80),school:String(raw.school||'我的学校').slice(0,80)};
}
