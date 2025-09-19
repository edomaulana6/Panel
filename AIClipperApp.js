/*
AI Clipper - Single-file React + Tailwind UI (updated)
Changes in this version:
- Removed any watermark suggestions (user requested no watermark).
- Default: unlimited free usage (UI toggle shows unlimited and no watermark). Server must still enforce policies for abuse and copyright.
- Each video and each suggested moment includes a "hook score" (score) and tags (e.g., funny, sad, emotional).
- Added a simple client-side filter/search to find moments by tag or keyword (e.g., "funny", "sad", "reaction").
- Keep clear note: unlimited free use has operational costs—implement rate limiting, abuse detection, or paid tiers server-side if you need sustainable scale.

Backend (suggested) endpoints (implement separately, Node/Express recommended):
1) POST /api/clip  { url, start, end, options }
   - Download YouTube video (yt-dlp), trim with ffmpeg, run ML models to pick hooks/viral moments, return job id.
2) GET /api/job/:id  -> { status, result: {clips: [...], score, hooks, viralMoments} }
3) POST /api/analyze  { url } -> instant analysis: thumbnails, suggested hooks, timestamps, score, tags
4) GET /api/stream/:clipId  -> stream clipped media
5) POST /api/monetize/register -> register publisher, ad settings, payout

IMPORTANT: You must obey YouTube Terms of Service and copyright law. Provide a rights-check and takedown flow before monetization.

This component contains UI for: paste YouTube link, auto-analyze, show suggested hooks & viral moments with tags, let user search/filter moments (e.g., "funny"), pick a clip, preview, request clip generation, show score per video/moment, and simple monetization toggle.
*/

import React, { useState, useEffect } from "react";

export default function AIClipperApp() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [selected, setSelected] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [unlimitedFree, setUnlimitedFree] = useState(true); // UI toggle (user requested unlimited)
  const [filter, setFilter] = useState(""); // filter for moment tags/keywords
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("1080p");

  // helper: extract YouTube ID from several link formats
  function extractYouTubeID(link) {
    try {
      const u = new URL(link);
      if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
      if (u.hostname === "youtu.be") return u.pathname.slice(1);
      return null;
    } catch (e) {
      return null;
    }
  }

  async function handleAnalyze() {
    setError("");
    const id = extractYouTubeID(url);
    if (!id) {
      setError("Masukkan link YouTube yang valid.");
      return;
    }
    setLoading(true);
    setAnalysis(null);
    setSelected(null);
    try {
      // Frontend stub: call backend /api/analyze
      // Here we simulate a response shape you should implement server-side.
      // In production, replace with fetch('/api/analyze', {method:'POST', body:JSON.stringify({url})})

      await new Promise((r) => setTimeout(r, 900));
      const simulated = generateFakeAnalysis(id);
      setAnalysis(simulated);
    } catch (e) {
      setError("Gagal melakukan analisis. Coba lagi nanti.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClip(s) {
    if (!analysis) return;
    setLoading(true);
    setJob(null);
    try {
      // Call backend /api/clip with chosen start/end
      // Simulate POST -> job id
      // In a real app, you'd send these options to the backend:
      // const body = JSON.stringify({ clip: s, aspectRatio, resolution });
      // await fetch('/api/clip', { method: 'POST', body });
      await new Promise((r) => setTimeout(r, 700));
      const jobId = 'job_' + Date.now();
      setJob({ id: jobId, status: 'processing', clip: s, options: { aspectRatio, resolution } });

      // Simulate job completion
      setTimeout(() => {
        setJob((j) => ({ ...j, status: 'done', url: `/api/stream/${jobId}.mp4` }));
      }, 1800);
    } catch (e) {
      setError('Gagal membuat klip.');
    } finally {
      setLoading(false);
    }
  }

  // small UI-only heuristic scoring explanation
  function explainScore(score) {
    if (score >= 85) return 'Sangat tinggi — cocok untuk hook dan viral.';
    if (score >= 70) return 'Tinggi — berpotensi viral dengan distribusi yang baik.';
    if (score >= 50) return 'Sedang — butuh editing/hook kuat.';
    return 'Rendah — butuh bahan tambahan atau narasi.';
  }

  // filter moments by tag/keyword
  function filteredMoments() {
    if (!analysis) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return analysis.viralMoments;
    return analysis.viralMoments.filter((m) => {
      if ((m.label || "").toLowerCase().includes(q)) return true;
      if ((m.tags || []).some(t => t.toLowerCase().includes(q))) return true;
      return false;
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow">
        <h1 className="text-2xl font-semibold mb-2">AI Clipper — Potong & Analisa Video YouTube</h1>
        <p className="text-sm text-slate-600 mb-4">Tempelkan link YouTube, biarkan AI menganalisa hook & momen viral, pilih klip, dan unduh/monetisasi. Tidak ada watermark pada hasil (sesuai permintaan).</p>

        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 border rounded-lg p-2"
          />
          <button onClick={handleAnalyze} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Analisa</button>
        </div>
        {error && <div className="mt-3 text-red-600">{error}</div>}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1 md:col-span-2">
            <div className="p-4 border rounded-lg">
              <h2 className="font-medium">Analisis</h2>
              {loading && <div className="text-sm text-slate-500 mt-2">Memproses...</div>}

              {!loading && analysis && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{analysis.title}</div>
                      <div className="text-xs text-slate-500">Durasi: {analysis.duration} — Channel: {analysis.channel}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{analysis.score}</div>
                      <div className="text-xs text-slate-500">{explainScore(analysis.score)}</div>
                    </div>
                  </div>

                  <div>
                    <div className="font-medium text-sm">Hook yang disarankan</div>
                    <ul className="list-disc ml-5 mt-1 text-sm text-slate-700">
                      {analysis.hooks.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="font-medium text-sm">Cari momen (mis. "funny", "sad", "reaction")</div>
                    <div className="mt-2 flex gap-2">
                      <input value={filter} onChange={(e)=>setFilter(e.target.value)} placeholder="Cari momen atau tag" className="flex-1 border rounded-lg p-2 text-sm" />
                      <button onClick={()=>setFilter('funny')} className="px-3 py-2 border rounded-lg text-sm">Funny</button>
                      <button onClick={()=>setFilter('sad')} className="px-3 py-2 border rounded-lg text-sm">Sad</button>
                      <button onClick={()=>setFilter('reaction')} className="px-3 py-2 border rounded-lg text-sm">Reaction</button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredMoments().map((m, i) => (
                        <button
                          key={i}
                          onClick={() => { setSelected(m); handleCreateClip(m); }}
                          className="text-left p-2 border rounded-lg hover:shadow cursor-pointer"
                        >
                          <div className="font-semibold">{m.label}</div>
                          <div className="text-xs text-slate-500">{formatTime(m.start)} - {formatTime(m.end)} • Hook {m.score} • Tags: {(m.tags||[]).join(', ')}</div>
                        </button>
                      ))}

                      {filteredMoments().length === 0 && <div className="text-slate-500 p-2">Tidak ada momen yang cocok dengan pencarian.</div>}
                    </div>
                  </div>
                </div>
              )}

              {!loading && !analysis && (
                <div className="mt-3 text-slate-500">Tempelkan link dan klik "Analisa" untuk melihat hook & momen viral.</div>
              )}
            </div>

            {/* Opsi Klip */}
            <div className="mt-4 p-4 border rounded-lg">
              <h3 className="font-medium">Opsi Klip</h3>
              <div className="mt-3 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Aspek Rasio</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button onClick={() => setAspectRatio('16:9')} className={`px-3 py-2 border rounded-lg text-sm ${aspectRatio === '16:9' ? 'bg-indigo-600 text-white ring-2 ring-indigo-500' : 'bg-white'}`}>16:9 YouTube</button>
                    <button onClick={() => setAspectRatio('9:16')} className={`px-3 py-2 border rounded-lg text-sm ${aspectRatio === '9:16' ? 'bg-indigo-600 text-white ring-2 ring-indigo-500' : 'bg-white'}`}>9:16 TikTok</button>
                    <button onClick={() => setAspectRatio('1:1')} className={`px-3 py-2 border rounded-lg text-sm ${aspectRatio === '1:1' ? 'bg-indigo-600 text-white ring-2 ring-indigo-500' : 'bg-white'}`}>1:1 Instagram</button>
                    <button onClick={() => setAspectRatio('4:5')} className={`px-3 py-2 border rounded-lg text-sm ${aspectRatio === '4:5' ? 'bg-indigo-600 text-white ring-2 ring-indigo-500' : 'bg-white'}`}>4:5 Instagram</button>
                  </div>
                </div>
                <div>
                  <label htmlFor="resolution" className="block text-sm font-medium text-slate-700">Resolusi</label>
                  <select
                    id="resolution"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option>1080p</option>
                    <option>720p</option>
                    <option>480p</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Preview / Job result */}
            <div className="mt-4 p-4 border rounded-lg">
              <h3 className="font-medium">Hasil Klip</h3>
              {job ? (
                <div className="mt-3">
                  <div>ID Job: {job.id}</div>
                  <div>Status: <span className={job.status === 'done' ? 'text-green-600' : 'text-orange-600'}>{job.status}</span></div>
                  {job.status === 'done' && (
                    <div className="mt-2">
                      <video controls className="w-full rounded-md">
                        <source src={job.url} type="video/mp4" />
                        Browser Anda tidak mendukung pemutar video.
                      </video>

                      <div className="mt-2 flex gap-2">
                        <a href={job.url} download className="px-3 py-2 bg-slate-800 text-white rounded-lg">Unduh</a>
                        <button className="px-3 py-2 border rounded-lg">Bagikan</button>
                        <button className="px-3 py-2 border rounded-lg">Upload Auto (YouTube/TikTok)</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-500 mt-2">Belum ada job — pilih momen viral untuk membuat klip otomatis.</div>
              )}
            </div>

          </div>

          <aside className="p-4 border rounded-lg">
            <h4 className="font-medium">Pengaturan Monetisasi</h4>
            <div className="mt-2 text-sm text-slate-600">Catatan: pastikan Anda memiliki hak yang diperlukan sebelum monetisasi.</div>

            <div className="mt-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={unlimitedFree} onChange={(e)=>setUnlimitedFree(e.target.checked)} />
                <span className="text-sm">Gratis unlimited (tanpa watermark)</span>
              </label>
            </div>

            <div className="mt-3 space-y-2">
              <button className="w-full px-3 py-2 bg-amber-500 rounded-lg">Daftarkan Kanal untuk Monetisasi</button>
              <button className="w-full px-3 py-2 border rounded-lg">Setel Iklan / Sponsor</button>
              <button className="w-full px-3 py-2 border rounded-lg">Atur Payout</button>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Skor video dan rekomendasi adalah prediksi berbasis analisis automated — lakukan pengecekan manual sebelum publikasi. Meskipun UI menunjukkan "unlimited", server harus menempatkan kontrol operasional untuk mencegah penyalahgunaan (rate-limiting, abuse detection, hak cipta).
            </div>
          </aside>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          Tip: Untuk produksi, tambahkan sistem rights-check, logging, rate-limits, dan monitoring penggunaan. Unlimited gratis tanpa kontrol server dapat menimbulkan biaya besar dan risiko legal.
        </div>
      </div>
    </div>
  );
}

// ---------- Helper utils (UI-only) ----------
function formatTime(s) {
  const sec = Math.floor(s);
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const sp = (sec % 60).toString().padStart(2, '0');
  return `${m}:${sp}`;
}

function generateFakeAnalysis(id) {
  // Simulate a response from the backend analyze endpoint
  const hooks = [
    'Buka dengan pertanyaan kejutan',
    'Potong ke reaksi emosional',
    'Tampilkan fakta singkat & visual kuat',
  ];
  const viralMoments = [
    { label: 'Reaksi lucu', start: 15, end: 23, score: 88, tags: ['funny','reaction'] },
    { label: 'Twist mengejutkan', start: 75, end: 85, score: 82, tags: ['twist','surprise'] },
    { label: 'Quote kuat', start: 34, end: 40, score: 76, tags: ['quote','emotional'] },
    { label: 'Adegan sedih', start: 190, end: 200, score: 74, tags: ['sad','emotional'] },
  ];
  const score = Math.round(60 + Math.random() * 35);
  return {
    id,
    title: 'Judul contoh video (simulasi)',
    channel: 'Channel Contoh',
    duration: '12:34',
    hooks,
    viralMoments,
    score,
  };
}
