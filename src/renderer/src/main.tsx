import ReactDOM from 'react-dom/client'
import App from './App'
import WebRoot from './WebRoot'
import { installWebDesk } from './lib/web-desk'
import './styles.css'

const isWeb = !window.desk
if (isWeb) installWebDesk()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  isWeb ? <WebRoot /> : <App />
)
