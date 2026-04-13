"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [serverUrl, setServerUrl] = useState("주소를 불러오는 중...");
  
  // 🌟 [보안 적용] 하드코딩된 비밀번호 대신 환경 변수에서 값을 가져옵니다.
  const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_VIBE_API_KEY || "");
  
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [target, setTarget] = useState("bird");
  const [maxCrops, setMaxCrops] = useState(5);
  
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState("");
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    const fetchBackendUrl = async () => {
      try {
        // 🌟 [보안 적용] 하드코딩된 Firebase 주소 대신 환경 변수에서 값을 가져옵니다.
        const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_URL;
        
        if (!firebaseUrl) {
          setServerUrl("");
          setLog("⚠️ 환경 변수 누락: Firebase URL이 설정되지 않았습니다.");
          return;
        }

        const response = await fetch(firebaseUrl);
        const data = await response.json();
        
        if (data && data.backend_url) {
          setServerUrl(data.backend_url);
          setLog("✅ 클라우드에서 AI 엔진 주소를 안전하게 불러왔습니다.");
        } else {
          setServerUrl("");
          setLog("⚠️ 엔진 주소가 비어있습니다. 서버가 켜져 있는지 확인하세요.");
        }
      } catch (err) {
        console.error("Firebase 데이터 로드 실패:", err);
        setServerUrl("");
        setLog("⚠️ 엔진 주소 자동 로드에 실패했습니다. 수동으로 입력해주세요.");
      }
    };

    fetchBackendUrl();
  }, []);

  const handleMine = async () => {
    setLoading(true);
    setLog("⏳ 엔진 가동 중... 유튜브 스트림을 분석하고 있습니다.");
    setImages([]);

    try {
      const response = await fetch(`${serverUrl}/api/mine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey, // 환경 변수에서 가져온 자물쇠 전달!
          "ngrok-skip-browser-warning": "true" 
        },
        body: JSON.stringify({
          youtube_url: youtubeUrl,
          target_label: target,
          max_crops: Number(maxCrops)
        })
      });

      if (!response.ok) {
        throw new Error(`에러 발생: ${response.status}`);
      }

      const data = await response.json();
      setLog(`✅ 수확 완료! (상태: ${data.status})`);
      
      const imageUrls = await Promise.all(data.files.map(async (file: string) => {
        const imgUrl = `${serverUrl}/${file}`;
        const imgRes = await fetch(imgUrl, {
          headers: {
            "ngrok-skip-browser-warning": "true"
          }
        });
        
        const blob = await imgRes.blob();
        return URL.createObjectURL(blob);
      }));

      setImages(imageUrls);

    } catch (err: any) {
      setLog(`❌ 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <header className="border-b border-gray-700 pb-4">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
            Vibe-Clipper Dashboard 🦉
          </h1>
          <p className="text-gray-400 mt-2">AI 기반 유튜브 실시간 객체 수확 파이프라인</p>
        </header>

        <div className="bg-gray-800 p-6 rounded-xl shadow-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Ngrok 서버 URL</label>
              <input type="text" value={serverUrl} onChange={e => setServerUrl(e.target.value)} className="w-full bg-gray-700 p-2 rounded outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">API Key (보안)</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-gray-700 p-2 rounded outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">유튜브 URL</label>
            <input type="text" placeholder="https://youtube.com/..." value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} className="w-full bg-gray-700 p-3 rounded outline-none text-lg focus:ring-2 focus:ring-green-400" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">수확할 타겟 (영문)</label>
              <input type="text" value={target} onChange={e => setTarget(e.target.value)} className="w-full bg-gray-700 p-2 rounded outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">최대 수확량</label>
              <input type="number" value={maxCrops} onChange={e => setMaxCrops(Number(e.target.value))} className="w-full bg-gray-700 p-2 rounded outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>

          <button 
            onClick={handleMine} 
            disabled={loading || !youtubeUrl || !serverUrl}
            className={`w-full py-4 text-xl font-bold rounded-lg transition-all ${loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-[1.02] shadow-lg shadow-green-500/30'}`}
          >
            {loading ? "데이터 추출 중... 🔄" : "🚀 AI 수확 시작"}
          </button>
        </div>

        {log && (
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center text-green-300">
            {log}
          </div>
        )}

        {images.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">🎯 수확된 갤러리</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {images.map((imgSrc, idx) => (
                <div key={idx} className="aspect-square bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-md">
                  <img src={imgSrc} alt={`Crop ${idx}`} className="w-full h-full object-cover hover:scale-110 transition-transform" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}