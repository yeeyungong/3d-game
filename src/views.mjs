export function playerView(state,viewerId){
  const self=state.players.find(p=>p.id===viewerId);
  if(!self)throw new Error('Unknown player');
  const m=state.meeting;
  return {
    now:state.now,phase:state.phase,winner:state.winner,energy:state.energy,powerLightsOn:state.powerLightsOn!==false,
    taskProgress:structuredClone(state.taskProgress[viewerId]||{completed:0,level:1}),
    aliveCount:state.players.filter(p=>p.alive).length,self:{...self},
    players:state.players.map(p=>({id:p.id,name:p.name,alive:p.alive,room:p.room,ally:self.role!=='good'&&p.role!=='good'})),
    corruption:self.role==='original'?structuredClone(state.corruption):null,
    channel:structuredClone(state.channels[viewerId]|| (state.corruption.channel?.actorId===viewerId?{...state.corruption.channel,kind:'corrupt'}:null) || (state.meetingChannel?.actorId===viewerId?{...state.meetingChannel,kind:'meeting'}:null)),
    protectionUntil:state.protectionUntil,attackReadyAt:state.attackReadyAt[viewerId]||0,taskReadyAt:{...state.taskReadyAt},
    meeting:m?{stage:m.stage,endsAt:m.endsAt,aliveIds:[...m.aliveIds],ownVote:m.votes[viewerId],hasVoted:Object.hasOwn(m.votes,viewerId)}:null,
    log:state.log.filter(e=>e.audience==='public'||e.audience===viewerId).map(e=>({...e})),
    reveal:state.winner?state.players.map(p=>({...p})):null,
    timeline:state.winner?state.log.map(e=>({...e})):null
  };
}
