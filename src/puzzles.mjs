export const puzzleAnswers={power:[2,0,3,1],lab:[2,4,1,3],storage:[1,0,1,0,1,0],comms:[35,70,50]};
export function validPuzzle(room,answer){const expected=puzzleAnswers[room];return Array.isArray(answer)&&!!expected&&answer.length===expected.length&&expected.every((v,i)=>v===answer[i]);}
