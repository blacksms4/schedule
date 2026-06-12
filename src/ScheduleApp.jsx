import React, { useState, useRef, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, query, where, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';

const holidays = {
    "2026-06-06": "현충일",
    "2026-07-17": "제헌절",
    "2026-08-15": "광복절",
    "2026-08-17": "광복절 대체휴일",
    "2026-09-07": "창립기념일",
    "2026-09-24": "추석연휴",
    "2026-09-25": "추석",
    "2026-10-05": "개천절 대체휴일",
    "2026-10-09": "한글날",
    "2026-12-25": "성탄절"
   
};

export default function ScheduleApp() {
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminEmails, setAdminEmails] = useState([]);
    const [players, setPlayers] = useState([]);
    const [ladderLines, setLadderLines] = useState([]);
    const [finalResults, setFinalResults] = useState({});
    const [currentYear, setCurrentYear] = useState(2026);
    const [currentMonth, setCurrentMonth] = useState(5); // 6월은 5 (0-indexed)
    const [assignments, setAssignments] = useState({});
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
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
    const [tempPath, setTempPath] = useState(null);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [adminEmailInput, setAdminEmailInput] = useState('');
    const [scheduleRange, setScheduleRange] = useState('');

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
            if (!currentUser) {
                setIsAdmin(false);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const loadAdminEmails = async () => {
            try {
                console.log('Loading admin emails...');
                const adminDoc = await getDoc(doc(db, 'config', 'admins'));
                console.log('Admin doc exists:', adminDoc.exists());
                if (adminDoc.exists()) {
                    const data = adminDoc.data();
                    console.log('Admin data:', data);
                    setAdminEmails(data.emails || []);
                } else {
                    console.log('Creating initial admin config');
                    // 초기 관리자 설정
                    await setDoc(doc(db, 'config', 'admins'), {
                        emails: ['blacksms4@gmail.com']
                    });
                    setAdminEmails(['blacksms4@gmail.com']);
                }
            } catch (error) {
                console.error('Error loading admin emails:', error);
            }
        };
        loadAdminEmails();
    }, []);

    useEffect(() => {
        if (user && adminEmails.length > 0) {
            const isAdminStatus = adminEmails.includes(user.email);
            console.log('Admin check:', { userEmail: user.email, adminEmails, isAdminStatus });
            setIsAdmin(isAdminStatus);
        }
    }, [user, adminEmails]);

    useEffect(() => {
        const loadScheduleData = async () => {
            try {
                console.log('Loading schedule data...');
                const scheduleDoc = await getDoc(doc(db, 'schedule', 'main'));
                console.log('Schedule doc exists:', scheduleDoc.exists());
                if (scheduleDoc.exists()) {
                    const data = scheduleDoc.data();
                    console.log('Loaded data:', data);
                    setPlayers(data.players || []);
                    setAssignments(data.assignments || {});
                    setFinalResults(data.finalResults || {});
                    setScheduleRange(data.scheduleRange || '');
                    setLadderLines(data.ladderLines || []);
                    console.log('State updated:', { players: data.players, assignments: data.assignments, ladderLines: data.ladderLines });
                } else {
                    console.log('Schedule document does not exist yet');
                }
            } catch (error) {
                console.error('Error loading schedule data:', error);
            }
        };
        loadScheduleData();
    }, []);

    // 상태가 변경될 때 사다리 다시 그리기
    useEffect(() => {
        if (ladderLines.length > 0 && players.length > 0) {
            console.log('Auto-redrawing ladder due to state change');
            setTimeout(() => redrawLadder(), 100);
        }
    }, [ladderLines, players]);

    const saveUserData = async (customAssignments = null) => {
        if (!isAdmin) {
            console.log('saveUserData called but user is not admin');
            return;
        }
        try {
            const assignmentsToSave = customAssignments || assignments;
            console.log('Saving schedule data:', { players, assignments: assignmentsToSave, finalResults, scheduleRange, ladderLines });
            await setDoc(doc(db, 'schedule', 'main'), {
                players,
                assignments: assignmentsToSave,
                finalResults,
                scheduleRange,
                ladderLines,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            console.log('Schedule data saved successfully');
        } catch (error) {
            console.error('Error saving schedule data:', error);
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
        
        // 로그인한 사용자의 이름이 포함된 근무만 신청 가능
        if (!fromWorker.includes(user.displayName) && !toWorker.includes(user.displayName)) {
            return alert('자신의 근무만 변경 신청할 수 있습니다.');
        }
        
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
        
        // 해당 사용자가 신청을 받은 사람인지 체크
        if (!toWorker.includes(user.displayName)) {
            return alert('자신에게 온 신청만 수락할 수 있습니다.');
        }
        
        try {
            // 근무표 변경
            const newAssignments = { ...assignments };
            const fromWorkers = newAssignments[fromDate].split(', ');
            const toWorkers = newAssignments[toDate].split(', ');
            
            // fromWorker를 toWorkers에서 찾아서 fromWorkers로 이동
            const fromWorkerIndex = toWorkers.indexOf(toWorker);
            const toWorkerIndex = fromWorkers.indexOf(fromWorker);
            
            if (fromWorkerIndex !== -1 && toWorkerIndex !== -1) {
                toWorkers[fromWorkerIndex] = fromWorker;
                fromWorkers[toWorkerIndex] = toWorker;
                
                newAssignments[fromDate] = fromWorkers.join(', ');
                newAssignments[toDate] = toWorkers.join(', ');
                
                setAssignments(newAssignments);
                saveUserData(newAssignments);
                
                // 신청 상태 업데이트
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

    const deleteSwapRequest = async (requestId) => {
        if (!user) return alert('로그인이 필요합니다.');
        if (!confirm('이 신청을 삭제하시겠습니까?')) return;
        
        try {
            await deleteDoc(doc(db, 'swapRequests', requestId));
            alert('근무 변경 신청이 삭제되었습니다.');
        } catch (error) {
            console.error('Error deleting swap request:', error);
            alert('삭제 실패: ' + error.message);
        }
    };

    const addAdmin = async () => {
        if (!isAdmin) return alert('관리자만 관리자를 추가할 수 있습니다.');
        if (!adminEmailInput.trim()) return alert('이메일을 입력해주세요.');
        
        try {
            const newAdminEmails = [...adminEmails, adminEmailInput.trim()];
            await updateDoc(doc(db, 'config', 'admins'), {
                emails: newAdminEmails
            });
            setAdminEmails(newAdminEmails);
            setAdminEmailInput('');
            alert('관리자가 추가되었습니다.');
        } catch (error) {
            console.error('Error adding admin:', error);
            alert('추가 실패: ' + error.message);
        }
    };

    const removeAdmin = async (email) => {
        if (!isAdmin) return alert('관리자만 관리자를 삭제할 수 있습니다.');
        if (!confirm(`${email} 관리자 권한을 삭제하시겠습니까?`)) return;
        
        if (adminEmails.length <= 1) return alert('최소 1명의 관리자가 필요합니다.');
        
        try {
            const newAdminEmails = adminEmails.filter(e => e !== email);
            await updateDoc(doc(db, 'config', 'admins'), {
                emails: newAdminEmails
            });
            setAdminEmails(newAdminEmails);
            alert('관리자가 삭제되었습니다.');
        } catch (error) {
            console.error('Error removing admin:', error);
            alert('삭제 실패: ' + error.message);
        }
    };

    useEffect(() => {
        if (!user) return;
        
        // 모든 근무 변경 신청 가져오기
        const loadSwapRequests = async () => {
            try {
                const q = query(collection(db, 'swapRequests'));
                const snapshot = await getDocs(q);
                const requests = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setSwapRequests(requests);
            } catch (error) {
                console.error('Error loading swap requests:', error);
            }
        };
        loadSwapRequests();
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


    const redrawLadder = () => {
        console.log('redrawLadder called');
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        console.log('Canvas:', canvas, 'Context:', ctx);
        if (!canvas || !ctx) {
            console.log('Canvas or context not available');
            return;
        }

        console.log('Players:', players, 'LadderLines:', ladderLines);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const colWidth = canvas.width / (players.length + 1);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 4;

        players.forEach((p, i) => {
            let x = (i + 1) * colWidth;
            ctx.beginPath();
            ctx.moveTo(x, 40);
            ctx.lineTo(x, 260);
            ctx.stroke();
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(p, x, 30);
        });

        ladderLines.forEach(line => {
            ctx.beginPath();
            ctx.moveTo(line.col * colWidth, line.y);
            ctx.lineTo((line.col + 1) * colWidth, line.y);
            ctx.stroke();
        });

        // 빨간색 경로 다시 그리기
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        const monthKey = `${currentYear}-${(assignMonth + 1).toString().padStart(2, '0')}`;
        const monthResults = finalResults[monthKey] || [];
        console.log('Month results:', monthResults);
        monthResults.forEach(result => {
            let curCol = result.start, curY = 40;
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
        });

        // 일시적 경로 그리기 (다른 사용자용)
        if (tempPath && tempPath.path) {
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 3;
            tempPath.path.forEach(segment => {
                ctx.beginPath();
                ctx.moveTo(segment.from.col * colWidth, segment.from.y);
                ctx.lineTo(segment.to.col * colWidth, segment.to.y);
                ctx.stroke();
            });
        }

        console.log('Ladder redraw completed');
    };

    useEffect(() => {
        renderCalendar();
    }, [currentYear, currentMonth, assignments]);

    const showTab = (tab) => {
        setActiveTab(tab);
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
        if (!isAdmin) return alert('관리자만 근무자를 추가할 수 있습니다.');
        if (playerInput.trim()) {
            setPlayers([...players, playerInput.trim()]);
            setPlayerInput('');
            saveUserData();
        }
    };

    const removePlayer = (index) => {
        if (!isAdmin) return alert('관리자만 근무자를 삭제할 수 있습니다.');
        setPlayers(players.filter((_, i) => i !== index));
        saveUserData();
    };

    const drawLadder = () => {
        if (!isAdmin) return alert('관리자만 사다리를 생성할 수 있습니다.');
        if (players.length < 2) return alert("최소 2명이 필요합니다.");
        const canvas = canvasRef.current;
        if (!canvas) {
            console.error('Canvas not available');
            return;
        }

        // Context가 없으면 다시 가져오기
        let ctx = ctxRef.current;
        if (!ctx) {
            ctx = canvas.getContext('2d');
            ctxRef.current = ctx;
        }

        console.log('Drawing ladder with', players.length, 'players');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setLadderLines([]);
        setFinalResults([]);
        setCurrentPlayerIndex(0);

        const colWidth = canvas.width / (players.length + 1);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 4;

        players.forEach((p, i) => {
            let x = (i + 1) * colWidth;
            ctx.beginPath();
            ctx.moveTo(x, 40);
            ctx.lineTo(x, 260);
            ctx.stroke();
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 14px sans-serif';
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
        saveUserData();
    };

    const handleCanvasClick = (e) => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        
        // 터치 이벤트와 마우스 이벤트 모두 지원
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const colWidth = canvas.width / (players.length + 1);
        let col = Math.round((clientX - rect.left) / colWidth);
        
        console.log('Click debug:', { clientX, clientY, colWidth, col, players: players.length, rectWidth: rect.width, canvasWidth: canvas.width });
        
        const monthKey = `${currentYear}-${(assignMonth + 1).toString().padStart(2, '0')}`;
        const monthResults = finalResults[monthKey] || [];
        
        // 관리자는 이미 선택된 열을 다시 선택할 수 없음
        // 다른 사용자는 이미 선택된 열도 클릭하여 일시적 경로를 볼 수 있음
        if (col < 1 || col > players.length) return;
        if (isAdmin && monthResults.some(r => r.start === col)) return;

        let curCol = col, curY = 40;
        const path = [];
        
        while (curY < 260) {
            let hit = ladderLines.filter(l => l.y > curY && (l.col === curCol || l.col === curCol - 1)).sort((a, b) => a.y - b.y)[0];
            if (hit) {
                path.push({ from: { col: curCol, y: curY }, to: { col: curCol, y: hit.y } });
                path.push({ from: { col: curCol, y: hit.y }, to: { col: (hit.col === curCol) ? curCol + 1 : curCol - 1, y: hit.y } });
                curY = hit.y;
                let nextCol = (hit.col === curCol) ? curCol + 1 : curCol - 1;
                curCol = nextCol;
            } else {
                path.push({ from: { col: curCol, y: curY }, to: { col: curCol, y: 260 } });
                break;
            }
        }
        
        console.log('Path calculated:', { start: col, end: curCol });
        
        // 관리자: 실시간 경로 그리기 + 결과 저장
        if (isAdmin) {
            setFinalResults({
                ...finalResults,
                [monthKey]: [...(finalResults[monthKey] || []), { start: col, end: curCol }]
            });
            saveUserData();
            redrawLadder();
        } else {
            // 다른 사용자: 일시적 경로 표시
            setTempPath({ start: col, end: curCol, path });
            redrawLadder();
        }
    };

    const editAssignment = (dateKey) => {
        if (!isAdmin) return alert('관리자만 근무자를 수정할 수 있습니다.');
        const currentValue = assignments[dateKey] || '';
        const newValue = prompt(`${dateKey} 근무자 수정 (여러명은 쉼표로 구분):`, currentValue);
        if (newValue !== null) {
            setAssignments({ ...assignments, [dateKey]: newValue.trim() });
            saveUserData();
        }
    };

    const renderCalendar = () => {
        // This is handled by the render function, no need to manually render
    };

    const assignToCalendar = () => {
        if (!isAdmin) return alert('관리자만 근무표를 반영할 수 있습니다.');
        if (players.length === 0) return alert("명단을 먼저 추가하세요.");

        let targetYear = currentYear;
        let targetMonth = assignMonth;

        let orderedPlayers;
        const monthKey = `${targetYear}-${(targetMonth + 1).toString().padStart(2, '0')}`;
        const monthResults = finalResults[monthKey] || [];
        if (monthResults.length > 0) {
            const sortedResults = [...monthResults].sort((a, b) => a.end - b.end);
            orderedPlayers = sortedResults.map(r => players[r.start - 1]);
        } else {
            orderedPlayers = [...players];
        }

        const workCount = {};
        orderedPlayers.forEach(p => workCount[p] = 0);

        let assignedDates = [];
        const newAssignments = { ...assignments };
        
        // 기존에 배정된 근무표에서 workCount 계산
        Object.entries(assignments).forEach(([dateKey, workers]) => {
            if (workers) {
                workers.split(', ').forEach(worker => {
                    if (workCount[worker] !== undefined) {
                        workCount[worker]++;
                    }
                });
            }
        });

        // 마지막으로 배정된 날짜 찾기
        const existingDates = Object.keys(assignments).sort();
        let lastAssignedDate = existingDates.length > 0 ? existingDates[existingDates.length - 1] : null;
        
        // 로컬 변수로 인덱스 관리 - 기존 배정된 근무수만큼 시작
        let totalAssigned = Object.values(workCount).reduce((sum, count) => sum + count, 0);
        let localPlayerIndex = totalAssigned;

        const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            let d = new Date(targetYear, targetMonth, i);
            let dateKey = `${targetYear}-${(targetMonth + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
            
            // 기존에 배정된 날짜는 건너뜀
            if (assignments[dateKey]) continue;
            
            if (d.getDay() === 0 || d.getDay() === 6 || holidays[dateKey]) {
                const dayWorkers = [];
                for (let w = 0; w < workerCount; w++) {
                    const player = orderedPlayers[localPlayerIndex % orderedPlayers.length];
                    dayWorkers.push(player);
                    workCount[player]++;
                    localPlayerIndex++;
                }
                newAssignments[dateKey] = dayWorkers.join(', ');
                assignedDates.push(dateKey);
            }
        }

        const counts = Object.values(workCount);
        const maxCount = Math.max(...counts);
        const minCount = Math.min(...counts);

        if (maxCount !== minCount) {
            targetMonth++;
            if (targetMonth > 11) {
                targetMonth = 0;
                targetYear++;
            }

            while (true) {
                const nextDaysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

                for (let i = 1; i <= nextDaysInMonth; i++) {
                    let d = new Date(targetYear, targetMonth, i);
                    let dateKey = `${targetYear}-${(targetMonth + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
                    
                    // 기존에 배정된 날짜는 건너뜀
                    if (assignments[dateKey]) continue;
                    
                    if (d.getDay() === 0 || d.getDay() === 6 || holidays[dateKey]) {
                        const currentCounts = Object.values(workCount);
                        const currentMin = Math.min(...currentCounts);
                        const currentMax = Math.max(...currentCounts);

                        if (currentMin !== currentMax) {
                            const dayWorkers = [];
                            const minPlayers = orderedPlayers.filter(p => workCount[p] === currentMin);
                            for (let w = 0; w < workerCount && w < minPlayers.length; w++) {
                                const player = minPlayers[w];
                                dayWorkers.push(player);
                                workCount[player]++;
                                localPlayerIndex++;
                            }
                            if (dayWorkers.length > 0) {
                                newAssignments[dateKey] = dayWorkers.join(', ');
                                assignedDates.push(dateKey);
                            }
                        } else {
                            break;
                        }
                    }
                }

                const newCounts = Object.values(workCount);
                const allEqual = newCounts.every(c => c === newCounts[0]);
                if (allEqual) break;

                targetMonth++;
                if (targetMonth > 11) {
                    targetMonth = 0;
                    targetYear++;
                }
                if (targetYear > currentYear + 1) break;
            }
        }

        setAssignments(newAssignments);
        setCurrentMonth(assignMonth);
        setCurrentPlayerIndex(localPlayerIndex);
        console.log('Assigning to calendar, new assignments:', newAssignments);
        saveUserData(newAssignments);

        const countSummary = orderedPlayers.map(p => `${p}: ${workCount[p]}회`).join(', ');
        const lastDate = assignedDates.length > 0 ? assignedDates[assignedDates.length - 1] : lastAssignedDate;
        const rangeText = `${currentYear}년 ${assignMonth + 1}월부터 ${lastDate}까지`;
        setScheduleRange(rangeText);
        alert(`${rangeText} 근무표가 반영되었습니다.\n${countSummary}`);
    };

    const getCalendarDays = () => {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="bg-white min-h-[100px] p-1.5 bg-gray-50"></div>);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            let d = new Date(currentYear, currentMonth, i);
            let dateKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
            let isHoliday = (d.getDay() === 0 || d.getDay() === 6 || holidays[dateKey]);
            days.push(
                <div
                    key={i}
                    onClick={() => editAssignment(dateKey)}
                    className={`bg-white min-h-[100px] p-1.5 cursor-pointer hover:bg-gray-50 ${isHoliday ? 'bg-red-50 text-red-600 bg-orange-50 text-orange-600 font-bold' : ''}`}
                >
                    <div className="font-bold">{i}</div>
                    <div className="text-[10px] text-orange-600">{holidays[dateKey] || ''}</div>
                    <div className="text-xs text-blue-800 font-bold">{assignments[dateKey] || ''}</div>
                    {assignments[dateKey] && user && (
                        <div className="mt-1">
                            {assignments[dateKey].split(', ').map((worker, idx) => (
                                worker.includes(user.displayName) && (
                                    <button
                                        key={idx}
                                        onClick={(e) => { e.stopPropagation(); openSwapModal(dateKey, worker); }}
                                        className="text-[10px] bg-green-100 text-green-700 px-1 rounded hover:bg-green-200"
                                    >
                                        변경
                                    </button>
                                )
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        return days;
    };

    return (
        <div className="bg-gray-100 p-6">
            <div className="max-w-6xl mx-auto bg-white p-6 rounded shadow">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">휴일 근무 관리 시스템</h1>
                    {user ? (
                        <div className="flex items-center gap-4">
                            <span className="text-sm">{user.displayName}</span>
                            <button onClick={signOut} className="bg-red-600 text-white px-4 py-2 rounded font-bold text-sm">로그아웃</button>
                        </div>
                    ) : (
                        <button onClick={signInWithGoogle} className="bg-blue-600 text-white px-4 py-2 rounded font-bold text-sm">Google 로그인</button>
                    )}
                </div>

                <div className="flex border-b mb-6">
                    <button
                        onClick={() => showTab('calendar')}
                        className={`px-6 py-2 font-bold ${activeTab === 'calendar' ? 'border-b-4 border-blue-600 text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        근무표 관리
                    </button>
                    <button
                        onClick={() => showTab('ladder')}
                        className={`px-6 py-2 font-bold ${activeTab === 'ladder' ? 'border-b-4 border-blue-600 text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        사다리 게임 및 명단 관리
                    </button>
                </div>

                <div className={activeTab === 'calendar' ? '' : 'hidden'}>
                    {(() => {
                        const monthKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}`;
                        const monthResults = finalResults[monthKey] || [];
                        return monthResults.length > 0 && (
                            <div className="mb-4 p-4 bg-yellow-50 border rounded-lg">
                                <h3 className="font-bold border-b pb-2 mb-2">최종 결과 공지 ({currentYear}년 {currentMonth + 1}월)</h3>
                                <div className="text-sm space-y-1">
                                    {monthResults.map((r, i) => (
                                        <div key={i}>{r.start}번 {players[r.start - 1]} → {r.end}번 도착</div>
                                    ))}
                                </div>
                                {scheduleRange && (
                                    <div className="mt-2 pt-2 border-t text-sm text-gray-600">
                                        근무표 적용 범위: {scheduleRange}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => changeMonth(-1)} className="bg-gray-200 px-4 py-1 rounded font-bold">이전달</button>
                        <div className="text-xl font-bold">{currentYear}년 {currentMonth + 1}월</div>
                        <button onClick={() => changeMonth(1)} className="bg-gray-200 px-4 py-1 rounded font-bold">다음달</button>
                    </div>
                    <div className="grid grid-cols-7 gap-px border border-gray-300 bg-gray-300">
                        {`일 월 화 수 목 금 토`.split(' ').map((d, i) => (
                            <div key={d} className={`text-center font-bold py-2 bg-gray-100 ${i === 0 ? 'text-red-600' : ''} ${i === 6 ? 'text-blue-600' : ''}`}>{d}</div>
                        ))}
                        {getCalendarDays()}
                    </div>
                </div>

                <div className={activeTab === 'ladder' ? '' : 'hidden'}>
                    {isAdmin && (
                        <div className="mb-6 p-4 border rounded bg-purple-50">
                            <h2 className="font-bold mb-2">관리자 관리</h2>
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="email"
                                    placeholder="이메일 입력"
                                    className="flex-1 border p-2 rounded"
                                    value={adminEmailInput}
                                    onChange={(e) => setAdminEmailInput(e.target.value)}
                                />
                                <button onClick={addAdmin} className="bg-purple-600 text-white px-4 py-2 rounded font-bold">추가</button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {adminEmails.map((email, i) => (
                                    <span key={i} className="bg-purple-100 px-3 py-1 rounded text-sm flex items-center gap-2">
                                        {email}
                                        <button onClick={() => removeAdmin(email)} className="text-red-500 hover:text-red-700 font-bold text-lg leading-none">×</button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mb-6 p-4 border rounded bg-gray-50">
                        <h2 className="font-bold mb-2">근무자 명단</h2>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                placeholder="이름 입력"
                                className="flex-1 border p-2 rounded"
                                value={playerInput}
                                onChange={(e) => setPlayerInput(e.target.value)}
                            />
                            <button onClick={addPlayer} className="bg-blue-600 text-white px-4 py-2 rounded font-bold">추가</button>
                        </div>
                        <div className="flex items-center gap-2 mb-4">
                            <label className="text-sm font-bold">근무자 수:</label>
                            <select
                                className="border p-2 rounded"
                                value={workerCount}
                                onChange={(e) => setWorkerCount(parseInt(e.target.value))}
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                                    <option key={n} value={n}>{n}명</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {players.map((p, i) => (
                                <span key={i} className="bg-blue-100 px-3 py-1 rounded text-sm flex items-center gap-2">
                                    {i + 1}. {p}
                                    <button onClick={() => removePlayer(i)} className="text-red-500 hover:text-red-700 font-bold text-lg leading-none">×</button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <div className="flex flex-col md:flex-row gap-2 mb-4">
                                <button onClick={drawLadder} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold flex-1">사다리 생성</button>
                                <select
                                    className="border p-2 rounded"
                                    value={assignMonth}
                                    onChange={(e) => setAssignMonth(parseInt(e.target.value))}
                                >
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(m => (
                                        <option key={m} value={m}>{m + 1}월</option>
                                    ))}
                                </select>
                                <button onClick={assignToCalendar} className="bg-green-600 text-white px-4 py-2 rounded font-bold flex-1">선택 월 근무표 반영</button>
                            </div>
                            <div className="w-full overflow-x-auto">
                                <canvas
                                    ref={canvasRef}
                                    width={800}
                                    height={300}
                                    onClick={handleCanvasClick}
                                    onTouchStart={handleCanvasClick}
                                    className="touch-none bg-gray-50 border border-gray-200 rounded-lg cursor-pointer"
                                />
                            </div>
                        </div>
                        <div className="w-full md:w-64 p-4 bg-yellow-50 border rounded-lg">
                            <h3 className="font-bold border-b pb-2 mb-2">최종 결과 공지 ({currentYear}년 {assignMonth + 1}월)</h3>
                            <div className="text-sm space-y-1">
                                {(() => {
                                    const monthKey = `${currentYear}-${(assignMonth + 1).toString().padStart(2, '0')}`;
                                    const monthResults = finalResults[monthKey] || [];
                                    return monthResults.map((r, i) => (
                                        <div key={i}>{r.start}번 {players[r.start - 1]} → {r.end}번 도착</div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                {showSwapModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
                            <h2 className="text-xl font-bold mb-4">근무 변경 신청</h2>
                            <div className="mb-4">
                                <p className="text-sm text-gray-600">현재 날짜: {selectedDate}</p>
                                <p className="text-sm text-gray-600">현재 근무자: {selectedWorker}</p>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-bold mb-2">대상 날짜 (YYYY-MM-DD)</label>
                                <input
                                    type="text"
                                    value={targetDate}
                                    onChange={(e) => setTargetDate(e.target.value)}
                                    className="w-full border p-2 rounded"
                                    placeholder="2026-06-07"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-bold mb-2">대상 근무자</label>
                                <input
                                    type="text"
                                    value={targetWorker}
                                    onChange={(e) => setTargetWorker(e.target.value)}
                                    className="w-full border p-2 rounded"
                                    placeholder="이름 입력"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={submitSwapRequest} className="bg-blue-600 text-white px-4 py-2 rounded font-bold flex-1">신청</button>
                                <button onClick={closeSwapModal} className="bg-gray-300 text-gray-700 px-4 py-2 rounded font-bold flex-1">취소</button>
                            </div>
                        </div>
                    </div>
                )}

                {swapRequests.length > 0 && (
                    <div className="mt-6 p-4 border rounded bg-yellow-50">
                        <h3 className="font-bold mb-2">근무 변경 신청 목록</h3>
                        {swapRequests.map((request) => (
                            <div key={request.id} className="border-b pb-2 mb-2 last:border-0">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm">{request.fromDate} ({request.fromWorker}) → {request.toDate} ({request.toWorker})</p>
                                        <p className="text-xs text-gray-600">상태: {request.status}</p>
                                    </div>
                                    <button onClick={() => deleteSwapRequest(request.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs">삭제</button>
                                </div>
                                {request.status === 'pending' && (
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={() => acceptSwap(request.id, request.fromDate, request.fromWorker, request.toDate, request.toWorker)} className="bg-green-600 text-white px-2 py-1 rounded text-xs">수락</button>
                                        <button onClick={() => rejectSwap(request.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs">거절</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
