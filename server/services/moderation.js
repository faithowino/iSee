const rules=[
 {reason:'Potential personal information',patterns:[/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s])\d{3}[-.\s]\d{4}\b/,/\b(?:snapchat|instagram|ig|snap|twitter|tiktok)\s*[:@]\s*\S+/i]},
 {reason:'Potential threat or violence',patterns:[/\b(?:kill|murder|shoot|stab|bomb|attack|hurt you|threaten)\b/i]},
 {reason:'Potential harassment',patterns:[/\b(?:stalk|harass|dox|doxx)\b/i]},
 {reason:'Potential sexual solicitation',patterns:[/\b(?:send nudes|send pics|hookup|escort|sex for money)\b/i]},
 {reason:'Potential spam or solicitation',patterns:[/\b(?:buy now|crypto investment|make money fast|free money)\b/i]}
];
export function moderate(text){for(const r of rules)if(r.patterns.some(p=>p.test(String(text))))return{status:'pending',reason:r.reason};return{status:'approved',reason:null}}
