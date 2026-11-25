import { writeFileSync } from 'node:fs'
import { bars, stories } from '../src/data/pilot/spyDataset'
import { runPilotEval } from '../src/lib/pilotEval'

const result = runPilotEval(bars, stories)
console.log(JSON.stringify(result, null, 2))
writeFileSync('public/data/pilot_eval_result.json', JSON.stringify(result, null, 2))
writeFileSync('src/data/pilot/pilot_eval_result.json', JSON.stringify(result, null, 2))
