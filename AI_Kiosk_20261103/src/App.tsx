import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-6">
        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          Vite + React + TypeScript + Tailwind CSS
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          AI Kiosk Project
        </h1>
        <p className="text-slate-400 text-sm">
          프로젝트 환경 세팅이 완료되었습니다. <code className="text-indigo-300 bg-slate-800 px-1.5 py-0.5 rounded">src/App.tsx</code>를 수정하여 개발을 시작하세요.
        </p>
        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-xl transition-colors cursor-pointer"
        >
          Count is {count}
        </button>
      </div>
    </div>
  )
}

export default App
