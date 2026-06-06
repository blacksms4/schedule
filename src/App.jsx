import React, { useState, useRef, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, addDoc, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const holidays = {
    "2026-06-06": "현충일",
    "2026-07-17": "제헌절",
    "2026-08-15": "광복절"
};

export default function ScheduleApp() {
    const [user, setUser] = useState(null);
    const [players, setPlayers] = useState([]);
    const [ladderLines, setLadderLines] = useState([]);
    const [finalResults, setFinalResults] = useState([]);
    const [currentYear, setCurrentYear] = useState(2026);
    const [currentMonth, setCurrentMonth] = useState(5); 
    const [assignments, setAssignments] = useState({});
    const [activeTab, setActiveTab] = useState('calendar');
    const [workerCount, setWorkerCount] = useState(2);
    const [assignMonth, setAssignMonth] = useState(5);
    const [playerInput, setPlayerInput] = useState('');
    const [swapRequests, setSwapRequests] = useState([]);
    const [showSwapModal, setShowSwapModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedWorker, setSelectedWorker] = useState(null);
    const [targetDate, setTargetDate] = useState('');
    const [targetWorker, setTargetWorker] = useState('');

    const canvasRef = useRef(null);
    const ctxRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current) {
            ctxRef.current = canvasRef.current.getContext('2d');
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                loadUserData(currentUser);
            }
        });
        return () => unsubscribe();
    }, []);

    const loadUserData = async (currentUser) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setPlayers(userData.players || []);
                setAssignments(userData.assignments || {});
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    };

    const saveUserData = async () => {
        if (!user) return;
        try {
            await setDoc(doc(db, 'users', user.uid), {
                players,
                assignments,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error('Error saving user data:', error);
        }
    };

    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('Error signing in with Google:', error);
            alert('로그인 실패: ' + error.message);
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const requestSwap = async (fromDate, fromWorker, toDate, toWorker) => {
        if (!user) return alert('로그인이 필요합니다.');
        try {
            await addDoc(collection(db, 'swapRequests'), {
                requesterId: user.uid,
                requesterName: user.displayName,
                fromDate,
                fromWorker,
                toDate,
                toWorker,
                status: 'pending',
                createdAt: new Date().toISOString()
            });
            alert('근무 변경 신청이 전송되었습니다.');
        } catch (error) {
            console.error('Error requesting swap:', error);
            alert('신청 실패: ' + error.message);
        }
    };

    const acceptSwap = async (requestId, fromDate, fromWorker, toDate, toWorker) => {
        if (!user) return alert('로그인이 필요합니다.');
        try {
            const newAssignments = { ...assignments };
            const fromWorkers = newAssignments[fromDate].split(', ');
            const toWorkers = newAssignments[toDate].split(', ');
            
            const fromWorkerIndex = toWorkers.indexOf(toWorker);
            const toWorkerIndex = fromWorkers.indexOf(fromWorker);
            
            if (fromWorkerIndex !== -1 && toWorkerIndex !== -1) {
                toWorkers[fromWorkerIndex] = fromWorker;
                fromWorkers[toWorkerIndex] = toWorker;
                
                newAssignments[fromDate] = fromWorkers.join(', ');
                newAssignments[toDate] = toWorkers.join(', ');
                
                setAssignments(newAssignments);
                saveUserData();
                
                await updateDoc(doc(db, 'swapRequests', requestId), {
                    status: 'accepted',
                    respondedAt: new Date().toISOString()
                });
                
                alert('근무 변경이 완료되었습니다.');
            }
        } catch (error) {
            console.error('Error accepting swap:', error);
            alert('수락 실패: ' + error.message);
        }
    };

    const rejectSwap = async (requestId) => {
        if (!user) return alert('로그인이 필요합니다.');
        try {
            await updateDoc(doc(db, 'swapRequests', requestId), {
                status: 'rejected',
                respondedAt: new Date().toISOString()
            });
            alert('근무 변경 신청이 거절되었습니다.');
        } catch (error) {
            console.error('Error rejecting swap:', error);
            alert('거절 실패: ' + error.message);
        }
    };

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'swapRequests'), where('requesterId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSwapRequests(requests);
        });
        return () => unsubscribe();
    }, [user]);

    const openSwapModal = (dateKey, worker) => {
        if (!user) return alert('로그인이 필요합니다.');
        setSelectedDate(dateKey);
        setSelectedWorker(worker);
        setShowSwapModal(true);
    };

    const closeSwapModal = () => {
        setShowSwapModal(false);
        setSelectedDate(null);
        setSelectedWorker(null);
        setTargetDate('');
        setTargetWorker('');
    };

    const submitSwapRequest = () => {
        if (!targetDate || !targetWorker) return alert('대상 날짜와 근무자를 선택해주세요.');
        requestSwap(selectedDate, selectedWorker, targetDate, targetWorker);
        closeSwapModal();
    };

    const drawLadder = () => {
        if (players.length < 2) return alert("최소 2명이 필요합니다.");
        const canvas = canvasRef.current;
        let ctx = ctxRef.current;
        if (!ctx) { ctx = canvas.getContext('2d'); ctxRef.current = ctx; }

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

        const newLadderLines = [];
        for (let i = 0; i < players.length * 8; i++) {
            let col = Math.floor(Math.random() * (players.length - 1)) + 1;
            let y = 60 + Math.floor(Math.random() * 10) * 20;
            if (!newLadderLines.find(l => l.y === y && (l.col === col || l.col === col - 1 || l.col === col + 1))) {
                newLadderLines.push({ col, y });
                ctx.beginPath();
                ctx.moveTo(col * colWidth, y);
                ctx.lineTo((col + 1) * colWidth, y);
                ctx.stroke();
            }
        }
        setLadderLines(newLadderLines);
    };

    const handleCanvasClick = (e) => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;
        const rect = canvas.getBoundingClientRect();
        const colWidth = canvas.width / (players.length + 1);
        let col = Math.round((e.clientX - rect.left) / colWidth);
        if (col < 1 || col > players.length || finalResults.some(r => r.start === col)) return;

        let curCol = col, curY = 40;
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;

        while (curY < 260) {
            let hit = ladderLines.filter(l => l.y > curY && (l.col === curCol || l.col === curCol - 1)).sort((a, b) => a.y - b.y)[0];
            if (hit) {
                ctx.beginPath();
                ctx.moveTo(curCol * colWidth, curY);
                ctx.lineTo(curCol * colWidth, hit.y);
                ctx.stroke();
                curY = hit.y;
                let nextCol = (hit.col === curCol) ? curCol + 1 : curCol - 1;
                ctx.beginPath();
                ctx.moveTo(curCol * colWidth, curY);
                ctx.lineTo(nextCol * colWidth, curY);
                ctx.stroke();
                curCol = nextCol;
            } else {
                ctx.beginPath();
                ctx.moveTo(curCol * colWidth, curY);
                ctx.lineTo(curCol * colWidth, 260);
                ctx.stroke();
                break;
            }
        }
        setFinalResults([...finalResults, { start: col, end: curCol }]);
    };

    const changeMonth = (offset) => {
        setCurrentMonth(prev => {
            let newMonth = prev + offset;
            let newYear = currentYear;
            if (newMonth > 11) { newMonth = 0; newYear++; }
            if (newMonth < 0) { newMonth = 11; newYear--; }
            setCurrentYear(newYear);
            return newMonth;
        });
    };

    const addPlayer = () => {
        if (playerInput.trim()) {
            setPlayers([...players, playerInput.trim()]);
            setPlayerInput('');
            saveUserData();
        }
    };

    const removePlayer = (index) => {
        setPlayers(players.filter((_, i) => i !== index));
        saveUserData();
    };

    const assignToCalendar = () => {
        if (players.length === 0) return alert("명단을 먼저 추가하세요.");
        let targetYear = currentYear, targetMonth = assignMonth;
        let orderedPlayers = finalResults.length > 0 ? [...finalResults].sort((a, b) => a.end - b.end).map(r => players[r.start - 1]) : [...players];
        const workCount = {}; orderedPlayers.forEach(p => workCount[p] = 0);
        let assignedDates = [], newAssignments = { ...assignments }, localPlayerIndex = 0;

        const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            let d = new Date(targetYear, targetMonth, i);
            let dateKey = `${targetYear}-${(targetMonth + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
            if (d.getDay() === 0 || d.getDay() === 6 || holidays[dateKey]) {
                const dayWorkers = [];
                for (let w = 0; w < workerCount; w++) {
                    const player = orderedPlayers[localPlayerIndex % orderedPlayers.length];
                    dayWorkers.push(player); workCount[player]++; localPlayerIndex++;
                }
                newAssignments[dateKey] = dayWorkers.join(', ');
                assignedDates.push(dateKey);
            }
        }
        setAssignments(newAssignments);
        saveUserData();
        alert(`근무표가 반영되었습니다.`);
    };

    const getCalendarDays = () => {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="bg-gray-50 min-h-[100px]"></div>);
        for (let i = 1; i <= daysInMonth; i++) {
            let dateKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
            let isHoliday = (new Date(currentYear, currentMonth, i).getDay() === 0 || new Date(currentYear, currentMonth, i).getDay() === 6 || holidays[dateKey]);
            days.push(
                <div key={i} className={`bg-white min-h-[100px] p-1.5 border ${isHoliday ? 'bg-orange-50' : ''}`}>
                    <div className="font-bold">{i}</div>
                    <div className="text-xs text-blue-800">{assignments[dateKey] || ''}</div>
                    {assignments[dateKey] && user && (
                        <div>{assignments[dateKey].split(', ').map((worker, idx) => (
                            <button key={idx} onClick={() => openSwapModal(dateKey, worker)} className="text-[10px] bg-green-100 px-1 rounded">변경</button>
                        ))}</div>
                    )}
                </div>
            );
        }
        return days;
    };

    return (
        <div className="bg-gray-100 p-6 min-h-screen">
            <div className="max-w-6xl mx-auto bg-white p-6 rounded shadow">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">휴일 근무 관리 시스템</h1>
                    {user ? <button onClick={signOut} className="bg-red-600 text-white px-4 py-2 rounded">로그아웃</button> : <button onClick={signInWithGoogle} className="bg-blue-600 text-white px-4 py-2 rounded">Google 로그인</button>}
                </div>
                <div className="flex border-b mb-6">
                    <button onClick={() => setActiveTab('calendar')} className={`px-6 py-2 ${activeTab === 'calendar' ? 'border-b-4 border-blue-600' : ''}`}>근무표</button>
                    <button onClick={() => setActiveTab('ladder')} className={`px-6 py-2 ${activeTab === 'ladder' ? 'border-b-4 border-blue-600' : ''}`}>명단 관리</button>
                </div>
                {activeTab === 'calendar' && (
                    <div>
                        <div className="flex justify-between mb-4">
                            <button onClick={() => changeMonth(-1)}>이전</button>
                            <span className="font-bold">{currentYear}년 {currentMonth + 1}월</span>
                            <button onClick={() => changeMonth(1)}>다음</button>
                        </div>
                        <div className="grid grid-cols-7 gap-px border">{getCalendarDays()}</div>
                    </div>
                )}
                {activeTab === 'ladder' && (
                    <div>
                        <input value={playerInput} onChange={(e) => setPlayerInput(e.target.value)} className="border p-2" />
                        <button onClick={addPlayer} className="bg-blue-600 text-white px-4 py-2 ml-2">추가</button>
                        <div className="mt-4"><button onClick={drawLadder} className="bg-indigo-600 text-white px-4 py-2">사다리 생성</button>
                        <button onClick={assignToCalendar} className="bg-green-600 text-white px-4 py-2 ml-2">근무표 반영</button></div>
                        <canvas ref={canvasRef} width={600} height={300} onClick={handleCanvasClick} className="border mt-4" />
                    </div>
                )}
            </div>
        </div>
    );
}
