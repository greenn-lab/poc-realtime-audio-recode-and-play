const audio = document.querySelector('audio')
document.body.append(audio)

const chunkSize = 16384
let chunks = []
let recorder

navigator.mediaDevices.getUserMedia({audio: true}).then((stream) => {
  recorder = new MediaRecorder(stream)
  recorder.addEventListener('dataavailable', (e) => {
    chunks.push(e.data)

    // process
    const total = chunks.reduce((a, b) => a += b.size, 0)
    if (total > chunkSize) {
      const blob = new Blob(chunks, {type: 'audio/wav'})
      const url = window.URL.createObjectURL(blob)

      // Handle audio
      audio.src = url
    }
  })
})


const btn = document.createElement('button')
btn.addEventListener('click', () => {
  recorder.start();
})
document.body.append('record!')

document.body.addEventListener('keyup', ({key}) => {
  if (key === 'ArrowLeft') {
    recorder.stop()
    recorder.start()
  }
})
