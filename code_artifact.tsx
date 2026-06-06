import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, query, where } from 'firebase/firestore';

// 1. Firebase 설정: Canvas 전역 변수 사용
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'duty-scheduler-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    // 2. 인증 관리: 익명 로그인
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("인증 오류:", error);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 3. Firestore 데이터 연동 (사용자 로그인 후 실행)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'requests'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
    }, (error) => {
      console.error("데이터 로드 오류:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // 4. 근무 변경 요청 생성
  const requestSwap = async (targetUserId, date) => {
    if (!user) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'requests'), {
      from: user.uid,
      to: targetUserId,
      date: date,
      status: 'pending'
    });
  };

  // 5. 근무 변경 수락/거절
  const handleResponse = async (requestId, status) => {
    const reqRef = doc(db, 'artifacts', appId, 'public', 'data', 'requests', requestId);
    await updateDoc(reqRef, { status });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">근무 변경 관리 시스템</h1>
      {!user ? <p>로그인 중...</p> : (
        <div>
          <p className="mb-4 text-sm text-gray-600">사용자 ID: {user.uid}</p>
          <div className="bg-white shadow rounded p-4">
            <h2 className="font-bold mb-2">도착한 요청</h2>
            {requests.length === 0 ? <p className="text-gray-400">요청이 없습니다.</p> : requests.map(req => (
              <div key={req.id} className="border-b py-2 flex justify-between items-center">
                <span>{req.date} 근무 교환 요청 (상태: {req.status})</span>
                {req.status === 'pending' && (
                  <div className="space-x-2">
                    <button onClick={() => handleResponse(req.id, 'accepted')} className="text-green-600 font-bold">수락</button>
                    <button onClick={() => handleResponse(req.id, 'rejected')} className="text-red-600 font-bold">거절</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}