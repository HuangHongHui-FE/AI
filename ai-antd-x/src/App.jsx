import { useState } from 'react'

import BubbleCom from './components/BubbleCom'
import ConversationsApp from './components/ConversationsApp.jsx'
import NotificationCom from './components/NotificationCom'
import ThinkCom from './components/ThinkCom'
import ThoughtChainCom from './components/ThoughtChainCom'
import SenderCom from './components/SenderCom'



function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      {/* <ConversationsApp /> */}
      {/* <BubbleCom /> */}
      {/* <NotificationCom /> */}
      {/* <ThinkCom /> */}
      {/* <ThoughtChainCom /> */}
      <SenderCom />
    </>
  )
}

export default App
