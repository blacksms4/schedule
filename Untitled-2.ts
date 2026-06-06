import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [userName, setUserName] = useState('');
  const [players, setPlayers] = useState([]);
  const [ladderLines, setLadderLines] = useState([]);
  const [results, setResults] = useState([]);
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(5);
  const [targetYear, setTargetYear] = useState(2026);
  const [targetMonth, setTargetMonth] = useState(5);
  const [assignments, setAssignments] = useState({});
  const [activeTab, setActiveTab] = useState('calendar');
  const [playerInput, setPlayerInput] = useState('');
  const [workerCount, setWorkerCount] = useState(2);
  const canvasRef = useRef(null);

  useEffect(() => {
    onAuthStateChanged(auth, (user) => { if(!user) signInAnonymously(auth); });
    const docRef = doc(db, 'data', 'appState');
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        setAssignments(doc.data().assignments || {});
      }
    });
  }, []);

  const saveAppState = async (newData) => {
    await setDoc(doc(db, 'data', 'appState'), { assignments, ...newData }, { merge: true });
  };

  const drawLadder = () => {
    if (players.length < 2) return alert("최소 2명이 필요합니다.");
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const colWidth = canvas.width / (players.length + 1);
    
    players.forEach((p, i) => {
      let x = (i + 1) * colWidth;
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, 260); ctx.stroke();
      ctx.fillStyle = '#1e293b'; ctx.textAlign = 'center'; ctx.fillText(p, x, 30);
    });

    const lines = [];
    for (let row = 1; row < 10; row++) {
      let y = 60 + row * 20;
      for (let col = 1; col < players.length; col++) {
        if (Math.random() > 0.5) {
          lines.push({ col, y });
          ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(col * colWidth, y); ctx.lineTo((col + 1) * colWidth, y); ctx.stroke();
        }
      }
    }
    setLadderLines(lines);
    setResults([]);
  };

  const runLadder = (playerIdx) => {
    const colWidth = canvasRef.current.width / (players.length + 1);
    let curCol = playerIdx + 1;
    let curY = 40;
    const sortedLines = [...ladderLines].sort((a,b) => a.y - b.y);
    
    sortedLines.forEach(line => {
      if (line.y > curY) {
        if (line.col === curCol) { curCol++; curY = line.y; }
        else if (line.col === curCol - 1) { curCol--; curY = line.y; }
      }
    });
    setResults(prev => [...prev.filter(r => r.name !== players[playerIdx]), { name: players[playerIdx], result: curCol - 1 }]);
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4 text-center">근무 스케줄러</h1>
      <input className="border p-1 w-full mb-4" placeholder="본인 이름" value={userName} onChange={e => setUserName(e.target.value)} />
      
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('calendar')} className={`flex-1 py-2 ${activeTab === 'calendar' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>달력</button>
        <button onClick={() => setActiveTab('ladder')} className={`flex-1 py-2 ${activeTab === 'ladder' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>사다리</button>
      </div>
      
      {activeTab === 'calendar' && (
        <div>
           <div className="flex justify-between mb-2"><button onClick={() => setCurrentMonth(m => m === 0 ? 11 : m - 1)}>◀</button><span>{currentYear}년 {currentMonth + 1}월</span><button onClick={() => setCurrentMonth(m => m === 11 ? 0 : m + 1)}>▶</button></div>
           <div className="grid grid-cols-7 border text-center text-xs">
             {['일','월','화','수','목','금','토'].map(d=><div key={d} className="font-bold p-1">{d}</div>)}
             {[...Array(new Date(currentYear, currentMonth + 1, 0).getDate())].map((_, i) => { 
               const d = i + 1; 
               const dateObj = new Date(currentYear, currentMonth, d);
               const key = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`; 
               return (
                 <div key={i} className={`p-1 border h-20 ${dateObj.getDay() === 0 || dateObj.getDay() === 6 ? 'bg-red-50' : ''}`}>
                   <div>{d}</div>
                   <div className="truncate font-bold text-[8px]">{assignments[key] || ""}</div>
                 </div>
               );
             })}
           </div>
        </div>
      )}
      
      {activeTab === 'ladder' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input className="border flex-1 p-1" value={playerInput} onChange={e => setPlayerInput(e.target.value)} />
            <button className="bg-blue-500 text-white px-3" onClick={() => { if(playerInput) { setPlayers([...players, playerInput]); setPlayerInput(''); } }}>추가</button>
          </div>
          <div className="flex flex-wrap gap-1">
            {players.map((p, i) => (
              <span key={i} className="bg-gray-200 px-2 rounded text-xs cursor-pointer" onClick={() => setPlayers(players.filter((_, idx) => idx !== i))}>{p} ✕</span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            근무자 수: <input type="number" className="border w-16" value={workerCount} onChange={e => setWorkerCount(parseInt(e.target.value))} />
            <button className="flex-1 bg-green-500 text-white py-1" onClick={drawLadder}>사다리 생성</button>
          </div>
          <canvas ref={canvasRef} width={400} height={200} className="border w-full bg-white" onClick={(e) => {
            const rect = canvasRef.current.getBoundingClientRect();
            const colWidth = canvasRef.current.width / (players.length + 1);
            const col = Math.round((e.clientX - rect.left) / colWidth) - 1;
            if(col >= 0 && col < players.length) runLadder(col);
          }} />
          <div className="text-xs bg-gray-50 p-2">결과: {results.map(r => `${r.name}:${r.result+1}번`).join(', ')}</div>
          <button className="w-full bg-indigo-600 text-white py-1" onClick={() => {
            const newA = { ...assignments };
            const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
            for(let i=1; i<=daysInMonth; i++){
                let k = `${targetYear}-${(targetMonth+1).toString().padStart(2,'0')}-${i.toString().padStart(2,'0')}`;
                let dateObj = new Date(targetYear, targetMonth, i);
                newA[k] = results.map(r => r.name).slice(0, workerCount).join(', ');
            }
            saveAppState({ assignments: newA });
            alert("근무표 반영 완료");
          }}>근무표 반영</button>
        </div>
      )}
    </div>
  );
}
