const units={ms:1/60000,s:1/60,min:1,h:60,d:1440};
export function srkTime(value,label='时间'){
 if(!Array.isArray(value)||value.length!==2||!Object.hasOwn(units,value[1])||!Number.isFinite(value[0])||value[0]<0)throw Error(`SRK ${label}格式无效，应为 [数值, "ms" / "s" / "min" / "h" / "d"]`);
 return value[0]*units[value[1]];
}
export function srkText(value,fallback=''){
 if(typeof value==='string')return value;
 if(value&&typeof value==='object')for(const key of ['zh-CN','en','fallback',...Object.keys(value)])if(typeof value[key]==='string'&&value[key])return value[key];
 return fallback;
}
export const isSRK=value=>!!value&&Array.isArray(value.rows)&&Array.isArray(value.problems)&&!!value.contest;
export const SRK_TEMPLATE={type:'general',version:'0.3.13',contest:{title:{'zh-CN':'示例 ICPC 赛事',fallback:'Example ICPC Contest'},duration:[5,'h'],frozenDuration:[60,'min']},problems:[{alias:'A'},{alias:'B'}],rows:[{user:{id:'team-1',name:{'zh-CN':'示例队伍',fallback:'Example Team'},organization:'示例大学',official:true},score:{value:1,time:[35,'min']},statuses:[{result:'AC',tries:2,time:[15,'min'],solutions:[{result:'WA',time:[10,'min']},{result:'AC',time:[15,'min']}]},{result:null,tries:0,time:[0,'s']}]}],sorter:{algorithm:'ICPC',config:{noPenaltyResults:['FB','AC','?','CE','UKE',null],penalty:[20,'min'],timePrecision:'min',timeRounding:'floor'}},series:[{title:'#',segments:[{title:'金奖',style:'gold'},{title:'银奖',style:'silver'},{title:'铜奖',style:'bronze'}],rule:{preset:'ICPC',options:{count:{value:[1,0,0],noTied:true}}}}]};
export function mapSRKVerdict(value,noPenalty){
 if(value==='AC'||value==='FB')return 'AC';
 if(value==='?')return 'PD';
 if(noPenalty.includes(value))return value==='CE'?'CE':'IGNORED';
 const map={RJ:'WA',WA:'WA',TLE:'TLE',MLE:'MLE',RTE:'RE',RE:'RE',OLE:'OLE',PE:'PE',NOUT:'WA',CE:'WA',UKE:'WA'};
 if(!Object.hasOwn(map,value))throw Error(`SRK 提交判定「${String(value)}」暂不支持`);
 return map[value];
}
function medalPolicy(raw){
 const series=raw.series?.find(s=>s.rule?.preset==='ICPC'&&!s.rule?.options?.filter&&s.segments?.slice(0,3).map(s=>s.style).join(',')==='gold,silver,bronze');
 const count=series?.rule?.options?.count;
 if(!count||!Array.isArray(count.value)||count.value.length<3)return null;
 const values=count.value.slice(0,3);if(values.some(v=>!Number.isInteger(v)||v<0))throw Error('SRK 奖牌名额必须是非负整数');
 if(series.rule.options.ratio)return null;
 return {count:values,noTied:count.noTied===true};
}
export function convertSRK(raw){
 if(!isSRK(raw))throw Error('不是可识别的 SRK 榜单');
 if(raw.sorter?.algorithm&&raw.sorter.algorithm!=='ICPC')throw Error(`目前仅支持 ICPC 赛制 SRK，不能按 ICPC 规则导入 ${raw.sorter.algorithm} 榜单`);
 if(!raw.rows.length||raw.rows.length>20000||!raw.problems.length||raw.problems.length>100)throw Error('SRK 队伍或题目数量超出支持范围');
 const duration=srkTime(raw.contest.duration,'比赛时长'),config=raw.sorter?.config||{};
 const penalty=srkTime(config.penalty??[20,'min'],'错误罚时');
 const frozen=raw.contest.frozenDuration==null?Math.min(60,duration):srkTime(raw.contest.frozenDuration,'封榜时长');
 if(frozen>duration)throw Error('SRK 封榜时长不能超过比赛时长');
 for(const k of ['timePrecision','rankingTimePrecision'])if(config[k]!=null&&!Object.hasOwn(units,config[k]))throw Error(`SRK ${k} 时间单位不支持`);
 for(const k of ['timeRounding','rankingTimeRounding'])if(config[k]!=null&&!['floor','ceil','round'].includes(config[k]))throw Error(`SRK ${k} 取整方式不支持`);
 const sourceRules={penalty,freeze:duration-frozen,timePrecision:config.timePrecision??null,timeRounding:config.timeRounding??'floor',rankingTimePrecision:config.rankingTimePrecision??null,rankingTimeRounding:config.rankingTimeRounding??'floor'};
 const noPenalty=config.noPenaltyResults??['FB','AC','?','NOUT','CE','UKE',null];
 if(!Array.isArray(noPenalty))throw Error('SRK noPenaltyResults 必须是数组');
 if(noPenalty.some(v=>v!==null&&typeof v!=='string'))throw Error('SRK noPenaltyResults 只能包含判定字符串或 null');
 sourceRules.srkNoPenaltyResults=[...noPenalty];
 const problems=raw.problems.map((p,i)=>{const id=String(p.alias??p.id??String.fromCharCode(65+i));const color=p.style?.backgroundColor;return {id,...(/^#[\da-f]{3,8}$/i.test(color||'')?{color}:{})};});
 let complete=true,hasHistory=false,frozenSnapshot=false;const submissions=[];
 const teams=raw.rows.map((row,index)=>{
  const user=row.user;if(!user||!Array.isArray(row.statuses)||row.statuses.length!==problems.length)throw Error(`SRK 第 ${index+1} 行队伍或题目状态数量不正确`);
  const id=String(user.id??index+1),results={};
  row.statuses.forEach((status,pindex)=>{
   if(!status||!['AC','FB','RJ','?',null].includes(status.result))throw Error(`SRK 第 ${index+1} 行 ${problems[pindex].id} 的汇总判定无效`);
   const tries=status.tries??(status.result==='AC'||status.result==='FB'?1:0);
   if(!Number.isInteger(tries)||tries<0)throw Error('SRK tries 必须是非负整数');
   const solved=status.result==='AC'||status.result==='FB';
   const history=status.solutions;
   if(history!=null&&!Array.isArray(history))throw Error('SRK solutions 必须是数组');
   const active=status.result!=null||tries>0;
   if(active&&!history?.length)complete=false;
   let accepted=null,wrong=0;
   if(history){hasHistory=true;for(const entry of history){
    const time=srkTime(entry.time,'提交时间'),v=mapSRKVerdict(entry.result,noPenalty);
    submissions.push({teamId:id,problemId:problems[pindex].id,time,verdict:v});
    if(submissions.length>500000)throw Error('SRK 最多支持 500,000 条提交');
    if(accepted===null){if(v==='AC')accepted=time;else if(['WA','TLE','RE','MLE','OLE','PE'].includes(v))wrong++;}
   }}
   if(status.result==='?'){complete=false;frozenSnapshot=true;}
   if(active&&history?.length&&(solved!==(accepted!==null)||(solved&&status.tries!=null&&wrong!==Math.max(0,tries-1))||(!solved&&wrong!==tries)))complete=false;
   if(solved){const time=status.time!=null?srkTime(status.time,'通过时间'):accepted;if(time==null)throw Error('SRK 已通过题目缺少通过时间');results[problems[pindex].id]={solved:true,time,wrong:Math.max(0,tries-1)};}
   else results[problems[pindex].id]={solved:false,wrong:status.result==='?'?0:tries,pending:status.result==='?'?Math.max(1,tries):0};
  });
  return {id,name:srkText(user.name,`队伍 ${index+1}`),school:srkText(user.organization,'未填写学校'),unofficial:user.official===false,sourceIndex:index,results,originalScore:row.score,teamMembers:user.teamMembers,markers:user.markers,location:user.location};
 });
 const replay=hasHistory&&complete,sourceMedals=medalPolicy(raw),warnings=[];
 if(!replay)warnings.push('原文件缺少完整、可核对的提交历史，将以快照导入，不提供回放或 VP。');
 if(raw.series?.some(s=>s.segments?.some(g=>g.style==='gold'))&&!sourceMedals)warnings.push('原榜奖牌规则不是支持的三档固定名额，当前采用自定义比例模拟；原规则保留在元数据中。');
 return {title:srkText(raw.contest.title,'SRK 历史赛事'),duration,problems,teams,...(replay?{submissions}:{}),format:'srk',sourceRules,sourceMedals,useSourceRules:true,useSourceMedals:true,source:`SRK ${String(raw.version||'')} · ${replay?'完整提交记录':'快照 / 提交历史不完整'}`,srkMetadata:{version:raw.version,startAt:raw.contest.startAt,refLinks:raw.contest.refLinks,sorter:raw.sorter,series:raw.series,historyComplete:replay,frozenSnapshot},importWarnings:warnings};
}
