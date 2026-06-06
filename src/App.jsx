import React, { useState, useRef, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, addDoc, onSnapshot, query, where, updateDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

// Firebase 설정 (환경에 따라 자동 구성)
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const holidays = {
    "2026-06-06": "현충일",
    "2026-07-17": "제헌절",
    "2026-08-15": "광복절"
};

export default function App() {
    const [user, setUser] = useState(null);
    const [players, setPlayers] = useState([]);
    const [activeTab, setActiveTab] = useState('calendar');
    const [currentYear, setCurrentYear] = useState(2026);
    const [currentMonth, setCurrentMonth] = useState(5);
    const [assignments, setAssignments] = useState({});
    const [playerInput, setPlayerInput] = useState('');
    const canvasRef = useRef(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const getCalendarDays = () => {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="bg-gray-50 h-24 border"></div>);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
            days.push(
                <div key={i} className="bg-white h-24 border p-2 flex flex-col items-start overflow-hidden hover:bg-blue-50 transition-colors">
                    <span className="font-bold text-sm text-gray-700">{i}</span>
                    <span className="text-[10px] text-red-500 font-semibold">{holidays[dateKey] || ''}</span>
                    <div className="text-[11px] text-blue-700 truncate w-full">{assignments[dateKey] || ''}</div>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-6 text-gray-900">
            <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
                <header className="bg-indigo-700 p-6 text-white flex justify-between items-center">
                    <h1 className="text-xl font-bold">근무 관리 시스템</h1>
                    {user ? (
                        <button onClick={() => firebaseSignOut(auth)} className="bg-indigo-800 px-4 py-2 rounded-lg text-sm hover:bg-indigo-900">로그아웃</button>
                    ) : (
                        <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="bg-white text-indigo-700 px-4 py-2 rounded-lg text-sm font-bold">Google 로그인</button>
                    )}
                </header>

                <div className="flex border-b bg-gray-50">
                    {['calendar', 'ladder'].map((tab) => (
                        <button key={tab} onClick={() => setActiveTab(tab)} 
                            className={`flex-1 py-4 font-bold text-sm transition-all ${activeTab === tab ? 'bg-white border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}>
                            {tab === 'calendar' ? '근무 달력' : '사다리 게임'}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {activeTab === 'calendar' ? (
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <button onClick={() => setCurrentMonth(m => m - 1)} className="px-3 py-1 bg-gray-200 rounded">이전</button>
                                <span className="font-bold">{currentYear}년 {currentMonth + 1}월</span>
                                <button onClick={() => setCurrentMonth(m => m + 1)} className="px-3 py-1 bg-gray-200 rounded">다음</button>
                            </div>
                            <div className="grid grid-cols-7 border-t border-l">
                                {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                                    <div key={d} className="bg-gray-100 py-2 text-center font-bold text-xs border-r border-b">{d}</div>
                                ))}
                                {getCalendarDays()}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center">
                            <p className="text-gray-500 mb-4">사다리 게임을 통해 근무자를 추첨하세요.</p>
                            <canvas ref={canvasRef} width={500} height={200} className="border bg-white rounded-lg w-full max-w-lg"></canvas>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
