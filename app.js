const context = new AudioContext()
const audio = document.querySelector('audio')
document.body.append(audio)

const chunkSize = 16384
let chunks = []
let recorder

navigator.mediaDevices.getUserMedia({audio: true}).then(
  async (stream) => {
    await context.resume()

    const source = context.createMediaStreamSource(stream)
    const processor = context.createScriptProcessor(8192, 1, 1)

    source.connect(processor)
    processor.connect(context.destination)

    visualize(source)


    const ws = new WebSocket('wss://ailab.sorizava.co.kr:40002/client/ws/speech?single=false&model=KOREAN_ONLINE_16K')

    let sessionId
    let groupId
    let workerId

    ws.onmessage = (e) => {
      console.log('ws.onmessage', e)

      try {
        const result = JSON.parse(e.data)
        sessionId = result.sessionId
        groupId = result.groupId
        workerId = result.workerId
      } catch (ex) {
        console.error(ex)
      }
    }

    ws.binaryType = 'blob'

    processor.addEventListener('audioprocess', (e) => {
      const data = e.inputBuffer.getChannelData(0)

      let converted = convertFloat32ToInt16(data);

      ws.send(converted);
    })

    recorder = new MediaRecorder(stream)
    recorder.addEventListener('dataavailable', (e) => {
      chunks.push(e.data)

      // process
      const total = chunks.reduce((a, b) => a += b.size, 0)
      if (total > chunkSize) {
        const blob = new Blob(chunks, {type: 'audio/wav'})
        audio.src = window.URL.createObjectURL(blob)
      }
    })
  })

function visualize(source) {
  const analyser = context.createAnalyser()
  analyser.fftSize = 2048
  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)

  source.connect(analyser)

  const canvas = document.querySelector('canvas')
  const canvasCtx = canvas.getContext('2d')
  draw()

  function draw() {
    const WIDTH = canvas.width
    const HEIGHT = canvas.height

    requestAnimationFrame(draw)

    analyser.getByteTimeDomainData(dataArray)

    canvasCtx.fillStyle = 'rgb(255, 255, 255)'
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT)

    canvasCtx.lineWidth = 1
    canvasCtx.strokeStyle = 'rgb(0, 0, 0)'

    canvasCtx.beginPath()

    let sliceWidth = WIDTH / bufferLength
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      let v = dataArray[i] / 128.0
      let y = (v * HEIGHT) / 2

      if (i === 0) {
        canvasCtx.moveTo(x, y)
      }
      else {
        canvasCtx.lineTo(x, y)
      }

      x += sliceWidth
    }

    canvasCtx.lineTo(WIDTH, HEIGHT / 2)
    canvasCtx.stroke()
  }
}

function convertFloat32ToInt16(buffer) {
  let len = buffer.length
  const buf = new Int16Array(len)

  while (len--) {
    buf[len] = Math.min(1, buffer[len]) * 0x7fff
  }

  return buf
}

const btn = document.createElement('button')
btn.textContent = 'record'
btn.addEventListener('click', () => {
  recorder.start();
})
document.body.append(btn)

document.body.addEventListener('keyup', ({key}) => {
  if (key === 'ArrowLeft') {
    recorder.stop()
    recorder.start()
  }
})
