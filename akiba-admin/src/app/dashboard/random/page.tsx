'use client'

import { useState } from 'react'
import { parseEther } from 'viem'
import { useWriteContract } from 'wagmi'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import managerAbiArtifact from '@/lib/abi/RaffleManager.json'

const RAFFLE_MANAGER = '0xD75dfa972C6136f1c594Fec1945302f885E1ab29'

export default function RequestRandom() {
  const { writeContractAsync, status } = useWriteContract()
  const isPending = status === 'pending'

  const [roundId, setRoundId] = useState('')
  const [fee, setFee]         = useState('0.011')

  const request = async () => {
    try {
      await writeContractAsync({
        address: RAFFLE_MANAGER,
        abi: managerAbiArtifact.abi,
        functionName: 'requestRoundRandomness',
        args: [BigInt(roundId)],
        value: parseEther(fee),
      })
      alert('Randomness requested 🎲')
      setRoundId('')
    } catch (e) {
      console.error(e)
      alert('Transaction failed')
    }
  }

  return (
    <div className="max-w-sm">
      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div>
          <p className="font-semibold text-gray-900">Request VRF Randomness</p>
          <p className="mt-0.5 text-xs text-gray-400">Manually trigger a VRF randomness request for a round</p>
        </div>
        <div className="space-y-3">
          <div>
            <Label htmlFor="rid" className="text-xs text-gray-600 mb-1 block">Round ID</Label>
            <Input
              id="rid"
              placeholder="e.g. 42"
              value={roundId}
              onChange={e => setRoundId(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="fee" className="text-xs text-gray-600 mb-1 block">Fee (CELO)</Label>
            <Input
              id="fee"
              placeholder="0.011"
              value={fee}
              onChange={e => setFee(e.target.value)}
            />
          </div>
          <Button
            onClick={request}
            disabled={isPending || !roundId}
            className="w-full bg-[#238D9D] hover:bg-[#1a6d7a]"
          >
            {isPending ? 'Requesting…' : 'Request VRF'}
          </Button>
        </div>
      </div>
    </div>
  )
}
