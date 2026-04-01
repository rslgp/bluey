// // public/js/screencast.js — screen recording (self-contained)
// const btnScreencast = document.getElementById('btn-screencast');
// const btnStopCast   = document.getElementById('btn-stop-cast');
// const castStatus    = document.getElementById('cast-status');
// const castPreviewW  = document.getElementById('cast-preview-wrap');
// const castPreview   = document.getElementById('cast-preview');
// const castDownload  = document.getElementById('cast-download');

// let _mediaRecorder  = null;
// let _recordedChunks = [];

// export function initScreencast() {
//   btnScreencast.addEventListener('click', _startRecording);
//   btnStopCast.addEventListener('click',   _stopRecording);
// }

// async function _startRecording() {
//   try {
//     const stream = await navigator.mediaDevices.getDisplayMedia({
//       video: { frameRate: 30, displaySurface: 'monitor' },
//       audio: true,
//     });
//     _recordedChunks = [];
//     const mimeType  = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
//       ? 'video/webm;codecs=vp9' : 'video/webm';

//     _mediaRecorder = new MediaRecorder(stream, { mimeType });
//     _mediaRecorder.ondataavailable = e => { if (e.data.size > 0) _recordedChunks.push(e.data); };
//     _mediaRecorder.onstop = _finishRecording;
//     stream.getVideoTracks()[0].addEventListener('ended', _stopRecording);
//     _mediaRecorder.start(1000);

//     btnScreencast.setAttribute('hidden', '');
//     btnStopCast.removeAttribute('hidden');
//     castStatus.textContent = '● Gravando tela…';
//     castPreviewW.setAttribute('hidden', '');
//   } catch (err) {
//     if (err.name !== 'NotAllowedError') castStatus.textContent = 'Erro: ' + err.message;
//   }
// }

// function _stopRecording() {
//   if (_mediaRecorder?.state !== 'inactive') {
//     _mediaRecorder.stop();
//     _mediaRecorder.stream.getTracks().forEach(t => t.stop());
//   }
//   btnStopCast.setAttribute('hidden', '');
//   btnScreencast.removeAttribute('hidden');
//   castStatus.textContent = '';
// }

// function _finishRecording() {
//   const url         = URL.createObjectURL(new Blob(_recordedChunks, { type: 'video/webm' }));
//   castPreview.src   = url;
//   castDownload.href = url;
//   castPreviewW.removeAttribute('hidden');
//   castStatus.textContent = '';
// }
