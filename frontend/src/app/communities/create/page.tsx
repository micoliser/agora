'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTransaction } from '@/hooks/useTransaction'
import { useApi } from '@/hooks/useApi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, ArrowLeft, Shield, Info } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const getSeconds = (value: string, unit: string) => {
  const v = Number(value) || 0
  switch (unit) {
    case 'minutes': return v * 60
    case 'hours': return v * 3600
    case 'days': return v * 86400
    case 'seconds':
    default: return v
  }
}

const LabelWithTooltip = ({ label, tooltip }: { label: string, tooltip: string }) => (
  <div className="flex items-center gap-2">
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {label}
    </label>
    <Tooltip>
      <TooltipTrigger type="button" className="cursor-help text-muted-foreground hover:text-primary transition-colors">
        <Info className="w-4 h-4" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[250px] bg-[#291F4A] text-white border-none shadow-xl">
        <p className="text-sm">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  </div>
)

const FORUM_ADDRESS = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}`

export default function CreateCommunityPage() {
  const router = useRouter()
  
  // Basic Settings
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Advanced Settings (with sensible defaults)
  const [appealWindow, setAppealWindow] = useState('24')
  const [appealWindowUnit, setAppealWindowUnit] = useState('hours')

  const [minRepToPost, setMinRepToPost] = useState('0')
  const [startingRep, setStartingRep] = useState('10')
  const [repPenaltyViolation, setRepPenaltyViolation] = useState('5')
  const [repPenaltyBadFlag, setRepPenaltyBadFlag] = useState('2')
  const [repRewardGoodFlag, setRepRewardGoodFlag] = useState('2')

  const [flagCooldown, setFlagCooldown] = useState('1')
  const [flagCooldownUnit, setFlagCooldownUnit] = useState('hours')

  const { execute, isLocked } = useTransaction()
  const { fetchApi } = useApi()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    
    if (!name) newErrors.name = "Name is required"
    if (!description) newErrors.description = "Description is required"
    if (!rules) newErrors.rules = "Constitution is required"
    
    if (name.length > 100) newErrors.name = "Name cannot exceed 100 characters"
    if (description.length > 2000) newErrors.description = "Description cannot exceed 2000 characters"
    if (rules.length > 5000) newErrors.rules = "Constitution cannot exceed 5000 characters"

    const appealSecs = getSeconds(appealWindow, appealWindowUnit)
    if (appealSecs < 3600 || appealSecs > 2592000) {
      newErrors.appealWindow = "Appeal window must be between 1 hour and 30 days"
    }
    
    const cooldownSecs = getSeconds(flagCooldown, flagCooldownUnit)
    if (cooldownSecs < 60 || cooldownSecs > 86400) {
      newErrors.flagCooldown = "Flag cooldown must be between 1 minute and 24 hours"
    }
    
    if (Number(repPenaltyViolation) <= 0) {
      newErrors.repPenaltyViolation = "Violation penalty must be greater than 0"
    }
    
    if (Number(repRewardGoodFlag) > Number(repPenaltyBadFlag)) {
      newErrors.repRewardGoodFlag = "Good flag reward cannot exceed bad flag penalty"
    }

    setErrors(newErrors)
    
    if (Object.keys(newErrors).length > 0) return

    await execute(
      FORUM_ADDRESS,
      'create_community',
      [
        name, 
        description, 
        rules,
        BigInt(getSeconds(appealWindow, appealWindowUnit)),
        BigInt(minRepToPost),
        BigInt(startingRep),
        BigInt(repPenaltyViolation),
        BigInt(repPenaltyBadFlag),
        BigInt(repRewardGoodFlag),
        BigInt(getSeconds(flagCooldown, flagCooldownUnit))
      ],
      {
        confirmingMessage: "Please confirm community creation in your wallet...",
        submittedMessage: "Community created, waiting for confirmation...",
        confirmedMessage: "Community deployed successfully!",
        onConfirmed: async () => {
          try {
            await fetchApi("/api/indexer/latest-community/", { method: "POST" })
          } catch (e) {
            console.error("Failed to sync latest community", e)
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
          router.push('/communities')
        }
      }
    )
  }

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 px-4 sm:px-6 lg:px-12 max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <button 
          onClick={() => router.back()} 
          className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        <h1 className="text-4xl md:text-5xl font-black font-heading tracking-tight text-white flex items-center gap-4">
          <Shield className="w-10 h-10 text-primary" />
          Deploy New Hub
        </h1>
        <p className="text-muted-foreground text-lg mt-2">
          Create an AI-moderated space. The GenVM validators will enforce your rules.
        </p>
      </div>

      <div className="bg-[#130E26] border border-[#291F4A] rounded-2xl p-8 shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Basic Fields */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-semibold text-foreground uppercase tracking-wider text-[#9375E0]">
                Hub Name
              </label>
              <Input
                id="name"
                maxLength={100}
                placeholder="e.g. Protocol Research"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLocked}
                className={`bg-[#0D091B] ${errors.description ? 'border-red-500' : 'border-[#291F4A]'} focus-visible:ring-primary h-12 text-white`}
              />
              {errors.description && <p className="text-red-500 text-xs font-semibold mt-1">{errors.description}</p>}
            </div>
            
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-semibold text-foreground uppercase tracking-wider text-[#9375E0]">
                Description
              </label>
              <Input
                id="description"
                maxLength={2000}
                placeholder="What is this hub about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLocked}
                className={`bg-[#0D091B] ${errors.name ? 'border-red-500' : 'border-[#291F4A]'} focus-visible:ring-primary h-12 text-white`}
              />
              {errors.name && <p className="text-red-500 text-xs font-semibold mt-1">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="rules" className="text-sm font-semibold text-foreground uppercase tracking-wider text-[#9375E0]">
                Constitution (Moderation Rules)
              </label>
              <Textarea
                id="rules"
                maxLength={5000}
                placeholder="State the rules clearly. E.g. 'No spam. Be respectful. Keep it related to GenLayer.'"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                disabled={isLocked}
                className={`min-h-[160px] bg-[#0D091B] ${errors.rules ? 'border-red-500' : 'border-[#291F4A]'} focus-visible:ring-primary resize-none text-white leading-relaxed p-4`}
              />
              {errors.rules && <p className="text-red-500 text-xs font-semibold mt-1">{errors.rules}</p>}
            </div>
          </div>

          {/* Advanced Settings Accordion */}
          <Accordion className="w-full border border-[#291F4A] rounded-xl overflow-hidden bg-[#0D091B]/50">
            <AccordionItem value="advanced" className="border-none">
              <AccordionTrigger className="px-6 py-4 hover:bg-[#1C1635] hover:no-underline font-semibold text-white transition-colors">
                Advanced Configurations
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-4 space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <LabelWithTooltip 
                      label="Starting Reputation" 
                      tooltip="The initial reputation score given to a new member when they join the hub." 
                    />
                    <Input
                      type="number"
                      value={startingRep}
                      onChange={(e) => setStartingRep(e.target.value)}
                      disabled={isLocked}
                      className={`bg-[#130E26] ${errors.startingRep ? 'border-red-500' : 'border-[#291F4A]'} text-white`}
                    />
                    {errors.startingRep && <p className="text-red-500 text-xs font-semibold mt-1">{errors.startingRep}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <LabelWithTooltip 
                      label="Min. Rep to Post" 
                      tooltip="The minimum reputation score required for a member to publish a new post." 
                    />
                    <Input
                      type="number"
                      value={minRepToPost}
                      onChange={(e) => setMinRepToPost(e.target.value)}
                      disabled={isLocked}
                      className={`bg-[#130E26] ${errors.minRepToPost ? 'border-red-500' : 'border-[#291F4A]'} text-white`}
                    />
                    {errors.minRepToPost && <p className="text-red-500 text-xs font-semibold mt-1">{errors.minRepToPost}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <LabelWithTooltip 
                      label="Penalty for Violation" 
                      tooltip="The amount of reputation deducted if a member's post is found to violate the constitution." 
                    />
                    <Input
                      type="number"
                      value={repPenaltyViolation}
                      onChange={(e) => setRepPenaltyViolation(e.target.value)}
                      disabled={isLocked}
                      className={`bg-[#130E26] ${errors.repPenaltyViolation ? 'border-red-500' : 'border-[#291F4A]'} text-white`}
                    />
                    {errors.repPenaltyViolation && <p className="text-red-500 text-xs font-semibold mt-1">{errors.repPenaltyViolation}</p>}
                  </div>

                  <div className="space-y-2">
                    <LabelWithTooltip 
                      label="Penalty for Bad Flag" 
                      tooltip="The amount of reputation deducted if a member falsely flags a post that doesn't violate the constitution." 
                    />
                    <Input
                      type="number"
                      value={repPenaltyBadFlag}
                      onChange={(e) => setRepPenaltyBadFlag(e.target.value)}
                      disabled={isLocked}
                      className={`bg-[#130E26] ${errors.repPenaltyBadFlag ? 'border-red-500' : 'border-[#291F4A]'} text-white`}
                    />
                    {errors.repPenaltyBadFlag && <p className="text-red-500 text-xs font-semibold mt-1">{errors.repPenaltyBadFlag}</p>}
                  </div>

                  <div className="space-y-2">
                    <LabelWithTooltip 
                      label="Reputation Reward (Good Flag)" 
                      tooltip="Points rewarded to a user who successfully flags violating content." 
                    />
                    <Input
                      type="number"
                      value={repRewardGoodFlag}
                      onChange={(e) => setRepRewardGoodFlag(e.target.value)}
                      disabled={isLocked}
                      className={`bg-[#130E26] ${errors.repRewardGoodFlag ? 'border-red-500' : 'border-[#291F4A]'} text-white`}
                    />
                    {errors.repRewardGoodFlag && <p className="text-red-500 text-xs font-semibold mt-1">{errors.repRewardGoodFlag}</p>}
                  </div>

                  <div className="space-y-2">
                    <LabelWithTooltip 
                      label="Appeal Window" 
                      tooltip="The duration during which a penalized user can appeal the AI's moderation decision." 
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={appealWindow}
                        onChange={(e) => setAppealWindow(e.target.value)}
                        disabled={isLocked}
                        className={`bg-[#130E26] ${errors.appealWindow ? 'border-red-500' : 'border-[#291F4A]'} text-white flex-1`}
                      />
                      <Select value={appealWindowUnit} onValueChange={(val) => setAppealWindowUnit(val || 'hours')} disabled={isLocked}>
                        <SelectTrigger className={`w-[120px] bg-[#130E26] ${errors.appealWindow ? 'border-red-500' : 'border-[#291F4A]'} text-white`}>
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1C1635] border-[#291F4A] text-white">
                          <SelectItem value="seconds">Seconds</SelectItem>
                          <SelectItem value="minutes">Minutes</SelectItem>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="days">Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {errors.appealWindow && <p className="text-red-500 text-xs font-semibold mt-1">{errors.appealWindow}</p>}
                  </div>

                  <div className="space-y-2">
                    <LabelWithTooltip 
                      label="Flag Cooldown" 
                      tooltip="The mandatory waiting period before a user can flag another post." 
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={flagCooldown}
                        onChange={(e) => setFlagCooldown(e.target.value)}
                        disabled={isLocked}
                        className={`bg-[#130E26] ${errors.flagCooldown ? 'border-red-500' : 'border-[#291F4A]'} text-white flex-1`}
                      />
                      <Select value={flagCooldownUnit} onValueChange={(val) => setFlagCooldownUnit(val || 'hours')} disabled={isLocked}>
                        <SelectTrigger className={`w-[120px] bg-[#130E26] ${errors.flagCooldown ? 'border-red-500' : 'border-[#291F4A]'} text-white`}>
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1C1635] border-[#291F4A] text-white">
                          <SelectItem value="seconds">Seconds</SelectItem>
                          <SelectItem value="minutes">Minutes</SelectItem>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="days">Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {errors.flagCooldown && <p className="text-red-500 text-xs font-semibold mt-1">{errors.flagCooldown}</p>}
                  </div>
                </div>

              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Submit */}
          <Button 
            type="submit" 
            className="w-full h-14 font-bold text-lg rounded-xl bg-primary hover:bg-primary/90 text-white shadow-[0_0_30px_rgba(130,80,223,0.3)] transition-all" 
            disabled={isLocked || !name || !description || !rules}
          >
            {isLocked ? (
              <>
                <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                Deploying to GenVM...
              </>
            ) : (
              'Deploy Hub'
            )}
          </Button>
          
        </form>
      </div>
    </div>
  )
}
