'use client'

import { useAccount } from 'wagmi'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useMounted } from '@/hooks/useMounted'
import { useApi } from '@/hooks/useApi'
import { MessageSquare, ArrowRight, PlusCircle, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'

interface Community {
  id: number;
  name: string;
  description: string;
  rules: string;
}

export default function CommunitiesPage() {
  const { isConnected } = useAccount()
  const mounted = useMounted()
  const { fetchApi } = useApi()
  
  const [communities, setCommunities] = useState<Community[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const limit = 20

  const fetchCommunities = async (currentOffset: number) => {
    try {
      const res = await fetchApi(`/api/communities/?limit=${limit}&offset=${currentOffset}`)
      const data = await res.json()
      if (data.length < limit) {
        setHasMore(false)
      }
      return data
    } catch (err) {
      console.error(err)
      return []
    }
  }

  useEffect(() => {
    setIsLoading(true)
    fetchCommunities(0).then(data => {
      setCommunities(data)
      setIsLoading(false)
    })
  }, [])

  const observerRef = useRef<IntersectionObserver | null>(null)
  const lastCommunityElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoading || isFetchingMore) return
    if (observerRef.current) observerRef.current.disconnect()
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setIsFetchingMore(true)
        const nextOffset = offset + limit
        fetchCommunities(nextOffset).then(newData => {
          setCommunities(prev => [...prev, ...newData])
          setOffset(nextOffset)
          setIsFetchingMore(false)
        })
      }
    })
    
    if (node) observerRef.current.observe(node)
  }, [isLoading, isFetchingMore, hasMore, offset])

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 px-4 sm:px-6 lg:px-12 max-w-screen-2xl mx-auto w-full">
      <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-12">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-black font-heading tracking-tight text-white">
            All Hubs
          </h1>
          <p className="text-muted-foreground text-lg">Discover and join intelligent hubs.</p>
        </div>
        {mounted && isConnected ? (
          <Button 
            className="rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/40 font-semibold h-11 px-6 bg-primary text-white"
            render={<Link href="/communities/create" />}
            nativeButton={false}
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Deploy Hub
          </Button>
        ) : (
          <Button 
            disabled 
            className="rounded-full font-semibold h-11 px-6 bg-muted text-muted-foreground"
          >
            Connect Wallet to Create
          </Button>
        )}
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="bg-[#130E26] border-[#291F4A]">
              <CardHeader><Skeleton className="h-6 w-3/4 mb-4 bg-[#1C1635]" /><Skeleton className="h-16 w-full bg-[#1C1635]" /></CardHeader>
              <CardFooter><Skeleton className="h-10 w-full bg-[#1C1635]" /></CardFooter>
            </Card>
          ))}
        </div>
      ) : communities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {communities.map((comm, index) => {
            const isLast = communities.length === index + 1;
            const content = (
              <Card className="group h-full bg-[#130E26] border-[#291F4A] hover:border-primary/50 transition-all duration-300 flex flex-col justify-between overflow-hidden">
                <CardHeader>
                  <div className="flex justify-between items-start mb-4">
                    <CardTitle className="text-2xl font-bold font-heading text-white">
                      {comm.name}
                    </CardTitle>
                    <Badge variant="secondary" className="font-mono bg-[#0D091B] border border-[#291F4A] text-[#9375E0] text-xs">
                      #{comm.id}
                    </Badge>
                  </div>
                  <CardDescription className="text-muted-foreground line-clamp-3 leading-relaxed">
                    {comm.description}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="pt-6">
                  <Button 
                    className="w-full text-sm font-semibold h-12 rounded-md bg-primary hover:bg-primary/90 text-white shadow-lg transition-all" 
                    render={<Link href={`/community/${comm.id}`} />}
                    nativeButton={false}
                  >
                    Enter Hub
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardFooter>
              </Card>
            )

            if (isLast) {
              return <div ref={lastCommunityElementRef} key={comm.id}>{content}</div>
            } else {
              return <div key={comm.id}>{content}</div>
            }
          })}
        </div>
      ) : (
        <div className="text-center py-24 bg-[#130E26] rounded-2xl border border-[#291F4A]">
          <MessageSquare className="w-12 h-12 text-[#291F4A] mx-auto mb-6" />
          <h3 className="text-2xl font-bold font-heading text-white mb-2">No active hubs yet</h3>
          <p className="text-muted-foreground mb-6">Be the first to create an intelligent hub.</p>
          {mounted && isConnected && (
            <Button 
              className="rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/40 font-semibold h-11 px-6 bg-primary text-white"
              render={<Link href="/communities/create" />}
              nativeButton={false}
            >
              <PlusCircle className="w-5 h-5 mr-2" />
              Deploy Hub
            </Button>
          )}
        </div>
      )}

      {isFetchingMore && (
        <div className="flex justify-center mt-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  )
}
