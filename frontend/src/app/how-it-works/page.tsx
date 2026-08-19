import { Shield, MessageSquare, Flag, Scale, Trophy, Zap, Bot } from 'lucide-react'

export default function HowItWorks() {
  const steps = [
    {
      icon: Shield,
      title: "Community Creation & Constitutions",
      description: "Anyone can create a new Hub (community) by writing a Constitution. The Constitution is a set of natural language rules that dictate what is and isn't allowed. Unlike traditional platforms where rules are vague guidelines for human moderators, your Constitution is literally the law, executed and enforced by GenLayer's Large Language Models (LLMs).",
      color: "from-emerald-500 to-teal-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20"
    },
    {
      icon: MessageSquare,
      title: "Posting and Comments",
      description: "Once a community is active, users can submit posts and reply with comments. However, each community can configure a Minimum Reputation Threshold. If a user has a history of violating the rules, their reputation will drop below this threshold, and the smart contract will automatically block them from posting until they rebuild their standing.",
      color: "from-blue-500 to-cyan-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20"
    },
    {
      icon: Bot,
      title: "AI Moderation & Flagging",
      description: "Agora does not have human moderators. Instead, the community self-polices. When a user spots a rule violation, they flag the post. The smart contract immediately runs an AI consensus check, feeding the content and the Constitution into the LLM validators. If the AI determines a violation, it is instantly removed.",
      color: "from-purple-500 to-fuchsia-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20"
    },
    {
      icon: Scale,
      title: "The Appeal System",
      description: "Mistakes happen. If a user feels their content was unfairly removed, they can submit an appeal. The appeal is judged by a completely new, independent AI instance. The AI evaluates both the content and the user's defense argument against the Constitution. If granted, the content is fully restored and penalties are reversed.",
      color: "from-orange-500 to-rose-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20"
    },
    {
      icon: Trophy,
      title: "The Reputation System",
      description: "Reputation is everything. It is tracked entirely on-chain per community. Users lose points when their content is removed for violations, or when they submit bad-faith flags. Conversely, users are rewarded with reputation points when they successfully flag violating content, incentivizing a clean and active community.",
      color: "from-amber-400 to-yellow-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20"
    }
  ]

  return (
    <div className="min-h-screen bg-[#0C061F] text-white relative overflow-hidden">
      {/* Background ambient orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -translate-y-1/2 mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] translate-y-1/4 mix-blend-screen pointer-events-none" />
      
      <div className="max-w-5xl mx-auto px-6 pt-32 pb-24 relative z-10">
        
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            <span>The Future of Moderation</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tight font-heading leading-tight">
            How <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-purple-400">Agora</span> Works
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
            A fully decentralized, AI-moderated platform replacing human bias with 
            deterministic Intelligent Contracts on <span className="text-white font-medium">GenLayer</span>.
          </p>
        </div>

        {/* Steps Section */}
        <div className="space-y-32">
          {steps.map((step, index) => {
            const isEven = index % 2 === 0
            const Icon = step.icon
            
            return (
              <div key={index} className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-12 md:gap-24 group`}>
                
                {/* Visual Side */}
                <div className="w-full md:w-1/2 flex justify-center items-center">
                  <div className="relative flex items-center justify-center w-full aspect-square max-w-[300px] md:max-w-[400px] group-hover:scale-105 transition-transform duration-500">
                    <div className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-20 blur-3xl rounded-full transition-opacity duration-500 group-hover:opacity-40`} />
                    
                    <div className={`text-[12rem] md:text-[20rem] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10 opacity-80 select-none drop-shadow-2xl`}>
                      {index + 1}
                    </div>
                    
                    <div className={`absolute -bottom-4 -right-4 md:bottom-8 md:right-8 w-20 h-20 md:w-24 md:h-24 rounded-3xl ${step.bg} border ${step.border} flex items-center justify-center shadow-2xl backdrop-blur-xl transition-transform duration-500 group-hover:-translate-y-4`}>
                      <Icon className="w-10 h-10 md:w-12 md:h-12 text-white" />
                    </div>
                  </div>
                </div>

                {/* Content Side */}
                <div className="w-full md:w-1/2 space-y-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-white/10 text-xl font-bold font-heading">
                    {index + 1}
                  </div>
                  <h2 className={`text-3xl md:text-4xl font-bold font-heading leading-tight`}>
                    {step.title}
                  </h2>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
                
              </div>
            )
          })}
        </div>

        {/* Call to action */}
        <div className="mt-32 text-center">
          <div className="inline-block p-[1px] rounded-full bg-gradient-to-r from-primary to-purple-500">
            <a href="/communities/create" className="block px-8 py-4 rounded-full bg-[#0C061F] hover:bg-[#130E26] transition-colors font-bold text-lg">
              Create a Community
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
