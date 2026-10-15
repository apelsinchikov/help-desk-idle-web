import { render } from 'preact'
import { bundledContent } from './core/bundled.ts'

render(<p>Help Desk Idle · {bundledContent.jobs.length}</p>, document.getElementById('app')!)
