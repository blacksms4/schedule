import React, { useState, useRef, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, addDoc, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : null;

const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

const holidays = {
    "2026-06-06": "현충일",
    "2026-07-17": "제헌절",
    "2026-08-15": "광복절"
};

export default function ScheduleApp() {
    const [user, setUser] = useState(null);
    const [players, setPlayers] = useState([]);
    const [assignments, setAssignments] = useState({});
    const [activeTab, setActiveTab] = useState('calendar');
    const [currentYear, setCurrentYear] = useState(2026);
    const [currentMonth, setCurrentMonth] = useState(5); 
    const [ladderLines, setLadderLines] = useState([]);
    const [finalResults, setFinalResults] = useState([]);
    const [workerCount, setWorkerCount] = useState(2);
    const [playerInput, setPlayerInput] = useState('');
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);

    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) loadUserData(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const loadUserData = async (currentUser) => {
        if (!db) return;
        try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setPlayers(userData.players || []);
                setAssignments(userData.assignments || {});
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const saveUserData = async () => {
        if (!user || !db) return;
        try {
            await setDoc(doc(db, 'users', user.uid), {
                players,
                assignments,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error('Error saving data:', error);
        }
    };

    const signInWithGoogle = async () => {
        if (!auth) return;
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error) {
            alert('로그인 실패: ' + error.message);
        }
    };

    const signOut = async () => {
        if (!auth) return;
        await firebaseSignOut(auth);
    };

    if (!app) {
        return (
            <div className="p-10 text-center text-red-600">
                <h1 className="text-xl font-bold">Firebase 설정 오류</h1>
                <p>Firebase 설정값이 제공되지 않았습니다. 환경 설정을 확인해주세요.</p>
            </div>
        );
    }

    const drawLadder = () => {
        if (players.length < 2) return alert("최소 2명이 필요합니다.");
        const canvas = canvasRef.current;
        if (!canvas) return;
        let ctx = canvas.getContext('2d');
        ctxRef.current = ctx;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setLadderLines([]);
        setFinalResults([]);

        const colWidth = canvas.width / (players.length + 1);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 4;

        players.forEach((p, i) => {
            let x = (i + 1) * colWidth;
            ctx.beginPath();
            ctx.moveTo(x, 40);
            ctx.lineTo(x, 260);
            ctx.stroke();
            ctx.fillStyle = '#1e293b';
            ctx.textAlign = 'center';
            ctx.fillText(p, x, 30);
        });
    };

    const getCalendarDays = () => {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const days = [];
        
        for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="bg-gray-50 min-h-[100px]"></div>);
        
        for (let i = 1; i <= daysInMonth; i++) {
            let dateKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
            days.push(
                <div key={i} className="bg-white min-h-[100px] p-2 border border-gray-200">
                    <div className="font-bold text-sm">{i}</div>
                    <div className="text-xs text-blue-600">{assignments[dateKey] || ''}</div>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="bg-gray-50 p-6 min-h-screen">
            <div className="max-w-6xl mx-auto bg-white p-6 rounded-lg shadow-sm">
                <header className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">휴일 근무 관리 시스템</h1>
                    {user ? (
                        <button onClick={signOut} className="text-sm bg-red-100 text-red-700 px-4 py-2 rounded">로그아웃</button>
                    ) : (
                        <button onClick={signInWithGoogle} className="text-sm bg-blue-600 text-white px-4 py-2 rounded">로그인</button>
                    )}
                </header>

                <nav className="flex gap-4 mb-6 border-b pb-2">
                    <button onClick={() => setActiveTab('calendar')} className={activeTab === 'calendar' ? 'font-bold text-blue-600' : ''}>근무표</button>
                    <button onClick={() => setActiveTab('ladder')} className={activeTab === 'ladder' ? 'font-bold text-blue-600' : ''}>명단 관리</button>
                </nav>

                {activeTab === 'calendar' ? (
                    <div className="grid grid-cols-7 gap-2">{getCalendarDays()}</div>
                ) : (
                    <div>
                        <div className="flex gap-2 mb-4">
                            <input value={playerInput} onChange={(e) => setPlayerInput(e.target.value)} className="border p-2 rounded flex-grow" placeholder="이름 입력" />
                            <button onClick={() => { setPlayers([...players, playerInput]); setPlayerInput(''); }} className="bg-blue-600 text-white px-4 py-2 rounded">추가</button>
                        </div>
                        <canvas ref={canvasRef} width={600} height={300} className="border bg-white rounded" />
                        <button onClick={drawLadder} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded">사다리 시작</button>
                    </div>
                )}
            </div>
        </div>
    );
}
