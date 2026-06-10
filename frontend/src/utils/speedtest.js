/**
 * Dynamic Network Speed Test Engine
 */

export async function runSpeedTest(apiBaseUrl, options = {}) {
  const {
    onProgress = () => {},
    signal
  } = options;

  const apiBase = apiBaseUrl.replace(/\/$/, '');
  const TEST_DURATION_MS = 6000; // 6 seconds per speed phase

  // Helper check for cancellation
  const checkCancellation = () => {
    if (signal && signal.aborted) {
      throw new DOMException('Speed test aborted by user', 'AbortError');
    }
  };

  // 1. PING & JITTER PHASE
  onProgress({ phase: 'ping', percent: 0, ping: 0, jitter: 0 });
  
  const pingHistory = [];
  const pingRounds = 10;
  
  for (let i = 0; i < pingRounds; i++) {
    checkCancellation();
    
    const startTime = performance.now();
    try {
      const response = await fetch(`${apiBase}/api/speedtest/ping?r=${i}`, {
        signal,
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Ping failed');
      await response.json();
      
      const endTime = performance.now();
      const rtt = endTime - startTime;
      pingHistory.push(rtt);
      
      // Calculate running average and jitter
      const currentPing = pingHistory.reduce((a, b) => a + b, 0) / pingHistory.length;
      let currentJitter = 0;
      if (pingHistory.length > 1) {
        let absoluteDiffs = 0;
        for (let j = 1; j < pingHistory.length; j++) {
          absoluteDiffs += Math.abs(pingHistory[j] - pingHistory[j - 1]);
        }
        currentJitter = absoluteDiffs / (pingHistory.length - 1);
      }

      onProgress({
        phase: 'ping',
        percent: Math.round(((i + 1) / pingRounds) * 100),
        ping: Math.round(currentPing * 10) / 10,
        jitter: Math.round(currentJitter * 10) / 10
      });
      
      // Minimal sleep between pings
      await new Promise(r => setTimeout(r, 50));
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('Ping sample failed:', err);
    }
  }

  const finalPing = pingHistory.length > 0 
    ? pingHistory.reduce((a, b) => a + b, 0) / pingHistory.length 
    : 0;
  let finalJitter = 0;
  if (pingHistory.length > 1) {
    let absoluteDiffs = 0;
    for (let j = 1; j < pingHistory.length; j++) {
      absoluteDiffs += Math.abs(pingHistory[j] - pingHistory[j - 1]);
    }
    finalJitter = absoluteDiffs / (pingHistory.length - 1);
  }

  const pingResults = {
    ping: Math.round(finalPing * 10) / 10,
    jitter: Math.round(finalJitter * 10) / 10
  };

  // 2. DOWNLOAD PHASE
  onProgress({ phase: 'download', percent: 0, avgSpeedMbps: 0, instantSpeedMbps: 0 });
  
  let downloadBytes = 0;
  let downloadStart = performance.now();
  let downloadElapsed = 0;
  let downloadChunkSize = 512 * 1024; // Start with 512KB

  while (downloadElapsed < TEST_DURATION_MS) {
    checkCancellation();
    
    const chunkStart = performance.now();
    try {
      const response = await fetch(`${apiBase}/api/speedtest/download?size=${downloadChunkSize}&t=${chunkStart}`, {
        signal,
        cache: 'no-store'
      });
      
      if (!response.ok) throw new Error('Download request failed');
      
      const reader = response.body.getReader();
      let chunkBytes = 0;
      
      while (true) {
        checkCancellation();
        const { done, value } = await reader.read();
        if (done) break;
        chunkBytes += value.length;
        downloadBytes += value.length;
        
        // Update live progress on partial chunks
        downloadElapsed = performance.now() - downloadStart;
        const tempSpeedMbps = (downloadBytes * 8) / (downloadElapsed / 1000) / 1000000;
        
        onProgress({
          phase: 'download',
          percent: Math.min(100, Math.round((downloadElapsed / TEST_DURATION_MS) * 100)),
          avgSpeedMbps: Math.round(tempSpeedMbps * 100) / 100,
          instantSpeedMbps: Math.round(tempSpeedMbps * 100) / 100 // Estimate
        });
      }

      const chunkEnd = performance.now();
      const chunkDuration = chunkEnd - chunkStart;
      const chunkSpeedMbps = (chunkBytes * 8) / (chunkDuration / 1000) / 1000000;

      downloadElapsed = performance.now() - downloadStart;
      const runningAvgMbps = (downloadBytes * 8) / (downloadElapsed / 1000) / 1000000;

      onProgress({
        phase: 'download',
        percent: Math.min(100, Math.round((downloadElapsed / TEST_DURATION_MS) * 100)),
        avgSpeedMbps: Math.round(runningAvgMbps * 100) / 100,
        instantSpeedMbps: Math.round(chunkSpeedMbps * 100) / 100
      });

      // Adaptive chunk sizing based on speed
      if (chunkDuration < 250 && downloadChunkSize < 6 * 1024 * 1024) {
        downloadChunkSize = Math.min(downloadChunkSize * 2, 6 * 1024 * 1024);
      } else if (chunkDuration > 1200 && downloadChunkSize > 128 * 1024) {
        downloadChunkSize = Math.max(downloadChunkSize / 2, 128 * 1024);
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('Download chunk failed, retrying smaller size:', err);
      downloadChunkSize = Math.max(downloadChunkSize / 2, 64 * 1024);
      await new Promise(r => setTimeout(r, 100)); // Cool-off
    }
    downloadElapsed = performance.now() - downloadStart;
  }

  const finalDownloadSpeed = (downloadBytes * 8) / (downloadElapsed / 1000) / 1000000;
  const downloadResults = Math.round(finalDownloadSpeed * 100) / 100;

  // 3. UPLOAD PHASE
  onProgress({ phase: 'upload', percent: 0, avgSpeedMbps: 0, instantSpeedMbps: 0 });

  let uploadBytes = 0;
  let uploadStart = performance.now();
  let uploadElapsed = 0;
  let uploadChunkSize = 256 * 1024; // Start with 256KB

  // Pre-generate a 2MB buffer of dummy data once to upload repeatedly
  const dummyBuffer = new Uint8Array(2 * 1024 * 1024);
  for (let i = 0; i < dummyBuffer.length; i++) {
    dummyBuffer[i] = Math.floor(Math.random() * 256);
  }

  while (uploadElapsed < TEST_DURATION_MS) {
    checkCancellation();

    const chunkStart = performance.now();
    const payload = dummyBuffer.subarray(0, uploadChunkSize);

    try {
      const response = await fetch(`${apiBase}/api/speedtest/upload?t=${chunkStart}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: payload,
        signal
      });

      if (!response.ok) throw new Error('Upload request failed');
      await response.json();

      const chunkEnd = performance.now();
      const chunkDuration = chunkEnd - chunkStart;
      const chunkSpeedMbps = (payload.length * 8) / (chunkDuration / 1000) / 1000000;

      uploadBytes += payload.length;
      uploadElapsed = performance.now() - uploadStart;
      const runningAvgMbps = (uploadBytes * 8) / (uploadElapsed / 1000) / 1000000;

      onProgress({
        phase: 'upload',
        percent: Math.min(100, Math.round((uploadElapsed / TEST_DURATION_MS) * 100)),
        avgSpeedMbps: Math.round(runningAvgMbps * 100) / 100,
        instantSpeedMbps: Math.round(chunkSpeedMbps * 100) / 100
      });

      // Adaptive upload sizing
      if (chunkDuration < 250 && uploadChunkSize < dummyBuffer.length) {
        uploadChunkSize = Math.min(uploadChunkSize * 2, dummyBuffer.length);
      } else if (chunkDuration > 1200 && uploadChunkSize > 64 * 1024) {
        uploadChunkSize = Math.max(uploadChunkSize / 2, 64 * 1024);
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('Upload chunk failed, retrying smaller size:', err);
      uploadChunkSize = Math.max(uploadChunkSize / 2, 32 * 1024);
      await new Promise(r => setTimeout(r, 100));
    }
    uploadElapsed = performance.now() - uploadStart;
  }

  const finalUploadSpeed = (uploadBytes * 8) / (uploadElapsed / 1000) / 1000000;
  const uploadResults = Math.round(finalUploadSpeed * 100) / 100;

  // Complete
  return {
    ping: pingResults.ping,
    jitter: pingResults.jitter,
    download: downloadResults,
    upload: uploadResults
  };
}
