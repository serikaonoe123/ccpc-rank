import {normalize} from './engine.js';
export function demoContest(){
 let seed=20261021;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const schools=['北京大学','清华大学','浙江大学','上海交通大学','复旦大学','南京大学','哈尔滨工业大学','电子科技大学','武汉大学','中山大学','西安交通大学','华中科技大学','山东大学','东北大学','吉林大学','北京航空航天大学'];
 const names=['向量没有终点','今天也要 AC','无限不循环','Hello, World!','最后一次提交','代码与远方','时间复杂度自由','星河迭代','别急，再想一下','未定义的浪漫','递归的尽头','一遍就过','三个人的最优解','栈在风里','编译通过了吗','不止于此','橘子海','光锥之内','零与无穷','我们还没寄','不妨设答案存在','先写个暴力','异或的夏天','下一站金牌'];
 const teams=Array.from({length:48},(_,i)=>({id:String(i+1),name:names[i%names.length]+(i>=24?' II':''),school:schools[i%schools.length],unofficial:i===12||i===31}));
 const problems='ABCDEFGHIJKL'.split('');const difficulty=[.94,.85,.52,.14,.77,.37,.06,.9,.25,.6,.46,.18];let submissions=[];
 teams.forEach((t,i)=>{const strength=1-i/80;problems.forEach((p,j)=>{if(rand()>difficulty[j]*strength+.13)return;const time=Math.min(298,Math.max(4,Math.round(8+rand()*185+(1-difficulty[j])*130+i*.9)));const wrong=Math.floor(rand()*3);for(let w=0;w<wrong;w++)submissions.push({teamId:t.id,problemId:p,time:Math.max(1,time-(wrong-w)*(4+Math.floor(rand()*9))),verdict:'WA'});submissions.push({teamId:t.id,problemId:p,time,verdict:rand()>.1?'AC':'WA'});});});
 return normalize({id:'demo-2026',title:'2026 CCPC 赛制演示赛',duration:300,source:'内置模拟数据 · 非真实比赛成绩',problems,teams,submissions});
}
