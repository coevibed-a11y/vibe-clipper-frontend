'use client';

import { useState, useRef, useEffect } from 'react';
import { TARGET_DICTIONARY } from '@/constants/targetDictionary'; // 🌟 스마트 타겟 검색을 위한 COCO 데이터셋 사전 (자주 쓰는 것들 위주로 세팅)

export default function Home() {
  // === 상태 관리 ===
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:05:00');
  
  // 스마트 타겟 상태
  const [displayTarget, setDisplayTarget] = useState('');
  const [actualTarget, setActualTarget] = useState(''); // 백엔드로 보낼 진짜 영어 값
  const [suggestions, setSuggestions] = useState<typeof TARGET_DICTIONARY>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [backendUrl, setBackendUrl] = useState(''); // Firebase에서 가져온 URL 저장

  const autocompleteRef = useRef<HTMLDivElement>(null);

  // 화면 밖 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 타겟 검색 로직
  const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDisplayTarget(value);
    setActualTarget(value); // 영어를 직접 쳤을 때를 대비
    
    if (value.length > 0) {
      const filtered = TARGET_DICTIONARY.filter(item => 
        item.keywords.some(keyword => keyword.toLowerCase().includes(value.toLowerCase()))
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectTarget = (label: string, text: string) => {
    setDisplayTarget(text);
    setActualTarget(label); // 시스템에는 'bird' 입력
    setShowSuggestions(false);
  };

  // 시간 문자열(MM:SS)을 초(Seconds)로 변환하는 검증 함수
  const parseTimeToSeconds = (timeStr: string) => {
    const parts = timeStr.split(':').reverse();
    let seconds = 0;
    for (let i = 0; i < parts.length; i++) {
      seconds += parseInt(parts[i] || '0') * Math.pow(60, i);
    }
    return seconds;
  };

  // 수확 시작! (Submit)
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setResult(null);

    // 1. 시간 검증 로직 (엣지 케이스 차단)
    const startSec = parseTimeToSeconds(startTime);
    const endSec = parseTimeToSeconds(endTime);
    
    if (isNaN(startSec) || isNaN(endSec)) {
      setError('시간 형식이 잘못되었습니다. (예: 01:20 또는 00:01:20)');
      return;
    }
    if (startSec >= endSec) {
      setError('🚨 시작 시간이 종료 시간보다 같거나 늦을 수 없습니다!');
      return;
    }

    // 2. 타겟 검증 및 강제 변환
    if (!actualTarget) {
      setError('수확할 타겟을 입력해 주세요.');
      return;
    }
    
    let finalTarget = actualTarget;
    
    // 🌟 버그 수정 완료: 사용자가 드롭다운에서 선택한 '이모지 포함 전체 텍스트(item.text)'와 일치하는지도 검사합니다!
    const matchedItem = TARGET_DICTIONARY.find(item => 
      item.text === displayTarget || // <- 이 한 줄이 추가되었습니다!
      item.keywords.some(k => k.toLowerCase() === displayTarget.toLowerCase()) || 
      item.label === displayTarget.toLowerCase()
    );

    if (matchedItem) {
      finalTarget = matchedItem.label; // 'bird' 등 올바른 영어로 강제 교체
    } else {
      setError('❌ 인식할 수 없는 타겟입니다. 자동완성 목록에서 선택해 주세요.');
      return;
    }

    setIsLoading(true);

    try {
      // 3. Firebase에서 현재 백엔드(Ngrok) 주소 가져오기
      let currentBackendUrl = backendUrl;
      if (!currentBackendUrl) {
        const firebaseRes = await fetch(process.env.NEXT_PUBLIC_FIREBASE_URL as string);
        const firebaseData = await firebaseRes.json();
        currentBackendUrl = firebaseData?.backend_url;
        setBackendUrl(currentBackendUrl);
        
        if (!currentBackendUrl) {
          throw new Error("AI 엔진(백엔드)이 오프라인 상태입니다. 엔진을 켜주세요.");
        }
      }

      // 4. 백엔드로 수확 요청 보내기 (max_crops는 보안상 50으로 고정해서 숨겨 보냄)
      const response = await fetch(`${currentBackendUrl}/api/mine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_VIBE_API_KEY as string,
          'ngrok-skip-browser-warning': '69420',
        },
        body: JSON.stringify({
          youtube_url: youtubeUrl,
          target_label: finalTarget,
          max_crops: 50, // 프론트에서 컨트롤 불가능하게 고정!
          start_time: startTime,
          end_time: endTime,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
      } else {
        throw new Error(data.detail || data.message || '수확 중 오류가 발생했습니다.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* 헤더 부분 */}
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Vibe-Clipper V2
          </h1>
          <p className="text-gray-400">AI 기반 고순도 에셋 자동화 파이프라인</p>
        </header>

        {/* 입력 폼 */}
        <form onSubmit={handleSubmit} className="bg-gray-900 p-6 rounded-2xl shadow-xl border border-gray-800 space-y-6">
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-300">📺 유튜브 URL</label>
            <input
              type="text"
              required
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative" ref={autocompleteRef}>
            {/* 스마트 타겟 검색기 */}
            <div className="space-y-2 relative">
              <label className="text-sm font-semibold text-gray-300">🎯 수확할 타겟 (검색)</label>
              <input
                type="text"
                required
                value={displayTarget}
                onChange={handleTargetChange}
                onFocus={() => displayTarget && setShowSuggestions(true)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="예: 독수리, 자동차, 사람..."
              />
              {/* 자동완성 드롭다운 */}
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
                  {suggestions.map((item) => (
                    <li 
                      key={item.label}
                      onClick={() => selectTarget(item.label, item.text)}
                      className="p-3 hover:bg-gray-700 cursor-pointer text-sm transition-colors"
                    >
                      {item.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 시간 지정 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300">⏱️ 시작 시간</label>
                <input
                  type="text"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="00:00:00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300">⏳ 종료 시간</label>
                <input
                  type="text"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="00:05:00"
                />
              </div>
            </div>
          </div>

          {error && <div className="p-4 bg-red-900/50 border border-red-500/50 text-red-200 rounded-lg text-sm">{error}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="animate-pulse">⏳ AI 엔진 수확 중... (최대 수십 초 소요)</span>
            ) : (
              <span>🚀 AI 수확 시작</span>
            )}
          </button>
        </form>

        {/* 결과 화면 */}
        {result && (
          <div className="bg-gray-900 p-6 rounded-2xl shadow-xl border border-gray-800 space-y-6 animate-fade-in-up">
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-green-400">✨ {result.message}</h2>
              
              {/* 🌟 ZIP 다운로드 버튼 (파일이 있을 때만 렌더링) */}
              {result.zip_url && result.files.length > 0 && (
                <a 
                  href={`${backendUrl}/${result.zip_url}`}
                  download
                  className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-full shadow-lg transition-all flex items-center gap-2"
                >
                  📦 전체 다운로드 (ZIP)
                </a>
              )}
            </div>

            {/* 조건부 렌더링: 파일이 있으면 갤러리 표시, 없으면 안내 문구 표시 */}
            {result.files && result.files.length > 0 ? (
              <>
                {/* 개선된 5장 갤러리 뷰 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 메인 썸네일 */}
                  <div className="md:col-span-2 h-64 md:h-96 relative rounded-xl overflow-hidden bg-gray-800 group">
                    <img 
                      src={`${backendUrl}/${result.files[0]}`} 
                      alt="Main Crop" 
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  
                  {/* 서브 썸네일 */}
                  <div className="grid grid-cols-2 gap-4 md:col-span-1">
                    {result.files.slice(1, 5).map((file: string, index: number) => (
                      <div key={index} className="h-32 md:h-44 relative rounded-xl overflow-hidden bg-gray-800 group">
                        <img 
                          src={`${backendUrl}/${file}`} 
                          alt={`Crop ${index + 1}`} 
                          className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                {result.files.length > 5 && (
                  <div className="text-center space-y-1 mt-4">
                    <p className="text-gray-400 text-sm font-medium">
                      * 서버 안정성을 위해 회당 최대 수확량은 50장으로 제한됩니다.
                    </p>
                    <p className="text-gray-500 text-xs">
                      위 이미지는 미리보기이며, 전체 50장의 데이터는 ZIP 파일로 확인하세요.
                    </p>
                  </div>
                )}
              </>
            ) : (
              // 🌟 수확량이 0개일 때 보여줄 친절한 빈 상태(Empty State) 디자인
              <div className="py-12 flex flex-col items-center justify-center bg-gray-800/50 rounded-xl border border-gray-700 border-dashed">
                <span className="text-5xl mb-4">🪹</span>
                <p className="text-gray-300 font-semibold">해당 구간에서 타겟을 발견하지 못했습니다.</p>
                <p className="text-gray-500 text-sm mt-2">다른 유튜브 영상이나, 타겟이 더 명확히 등장하는 시간대를 설정해 보세요.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}