const SAMPLE_RATE = Math.pow(2, 14)

let recordContext

const segments = document.getElementById('segments')
const template = document.createElement('li')
template.innerHTML = '<time></time><time></time><button>▶️</button><p contentEditable="true"></p>'

let playTimer

async function play(seconds) {
  console.log('play', seconds)

  let length = 0
  let started = 0
  const index = chunks.findIndex(audio => {
    if ((length += audio.duration) > seconds) return true
    started += audio.duration
    return false
  })

  clearTimeout(playTimer)
  if (length === Infinity || index < 0) {
    playTimer = setTimeout(() => {
      play(seconds)
    }, 100)

    return
  }

  chunks[index].currentTime = seconds - started
  chunks[index].play()
}

const url = `wss://ailab.sorizava.co.kr:40002/client/ws/speech`
const params = {
  'model': 'KOREAN_ONLINE_16K',
  'content-type': 'audio%2Fx-raw%2C+layout%3D%28string%29interleaved%2C+rate%3D%28int%2916000%2C+format%3D%28string%29S16LE%2C+channels%3D%28int%291',
  'project': '2e77c961-f709-400a-8c3e-0eeb73604698',
  'access-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJjcmV0RHQiOjE2NzI4MTM4MjYxNTQsImNyZXRyIjoiYWRtaW4iLCJjaGdEdCI6MTY3NzQ2NDk2NTg2NCwiY2hnciI6ImFkbWluIiwibWVtTm8iOjgsIm1lbUlkIjoidGVzdDEiLCJwYXNzd2QiOiIyMzEyNTJhZjIxN2I2NTZhNGQ4OGYwYzJkMmE5ZTc3MzE2M2QxN2MxYmJjMDIxMWI1NTJiYzc4OTg4M2RmMWU1ZjFlMTg5NTRmYTMwZTZkNGM2OWQyNmU0Nzc1MTUzNjE5YzdkOGIyN2U4ZjZiNjJhYTAyNmFkYzYwZDczNjZhYiIsIm1lbU5tIjoi7YWM7Iqk7Yq4IiwidXNlWW4iOiJZIiwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIiwiYXV0aE5vIjoxMSwiZGVwdE5vIjoxLCJqaWt3aUNkIjoiQ0QwNSIsImR1dHlDZCI6IkNEMDEiLCJqb2IiOiIiLCJ0ZWwiOiIiLCJsb2dpbkZhaWwiOjAsIm5vd0R0IjoxNjc3OTQyNzA5OTE1LCJleHBEdCI6MTY3ODAyOTEwOTkxNSwiZXhwU2VjIjo4NjQwMCwiZXhwIjoxNjc4MDI5MTA5fQ.8HBt9oKvMAQdMkS6WpCdxN5txXoWmDcAOWVAj3W11jw',
}
const query = Object.keys(params).reduce((a, b) => a + '&' + b + '=' + params[b], '')

let ws
let chunks = []
let recorder

const btnRecord = document.getElementById('#record')
btnRecord.addEventListener('click', () => {
  navigator.mediaDevices.getUserMedia({audio: true})
    .then(async (stream) => {
      if (recordContext?.state === 'running') {
        await recordContext.close()
      }

      recordContext = new AudioContext({sampleRate: SAMPLE_RATE, latencyHint: 'balanced'})
      await recordContext.resume()

      const source = recordContext.createMediaStreamSource(stream)
      visualize(source)

      const processor = recordContext.createScriptProcessor(4096, 1, 1)
      source.connect(processor)
      processor.connect(recordContext.destination)
      processor.addEventListener('audioprocess', ({inputBuffer}) => {
        if (ws?.readyState === 1) {
          const data = inputBuffer.getChannelData(0)
          ws.send(float32ToInt16(data));
        }
      })

      recorder = new MediaRecorder(stream)
      recorder.addEventListener('dataavailable', async ({data}) => {
        chunks.push(data)
      })
      recorder.start()

      if (ws?.readyState === 1) {
        ws.send('EOS')
        ws.close()
      }

      ws = new WebSocket(`${url}?single=false${query}`)
      ws.addEventListener('message', function ({data}) {
        const {
          segment: index,
          result: {
            hypotheses,
            final
          },
          'segment-start': start,
          'total-length': end,
        } = JSON.parse(data)
        console.log(JSON.parse(data))

        if (index !== undefined) {
          let segment = segments.querySelector(`#segment-${index}`)
          if (!segment) {
            segment = template.cloneNode(true)
            segment.id = `segment-${index}`
            segments.append(segment)
          }

          if (final) {
            recorder.stop()
            recorder.start()
          }

          if (hypotheses) {
            const [{ transcript }] = hypotheses
            const time = segment.querySelectorAll('time')
            time[0].textContent = timeFormatter(start)
            time[1].textContent = timeFormatter(end)
            segment.querySelector('p').textContent = transcript
          }
        }
      })
    })
    .catch(() => {
      explode(document.getElementById('#record'))
    })
})


function float32ToInt16(buffer) {
  let len = buffer.length
  const buf = new Int16Array(len)

  while (len--) {
    buf[len] = Math.min(1, buffer[len]) * 0x7fff
  }

  return buf
}

function visualize(source) {
  const analyser = recordContext.createAnalyser()
  analyser.fftSize = 2048
  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)

  source.connect(analyser)

  const canvas = document.querySelector('canvas')
  const canvasCtx = canvas.getContext('2d')
  draw()

  function draw() {
    const width = canvas.width
    const height = canvas.height

    requestAnimationFrame(draw)

    analyser.getByteTimeDomainData(dataArray)

    // canvasCtx.fillStyle = 'rgb(255, 255, 255)'
    // canvasCtx.fillRect(0, 0, WIDTH, HEIGHT)
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 3
    canvasCtx.strokeStyle = 'rgb(255, 255, 255)'

    canvasCtx.beginPath()

    let sliceWidth = width / bufferLength
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      let v = dataArray[i] / 128.0
      let y = (v * height) / 2

      if (i === 0) {
        canvasCtx.moveTo(x, y)
      }
      else {
        canvasCtx.lineTo(x, y)
      }

      x += sliceWidth
    }

    canvasCtx.lineTo(width, height / 2)
    canvasCtx.stroke()
  }
}

function timeFormatter(time) {
  if (!time) return ''

  const seconds = Math.floor(time % 60)
  const minutes = Math.floor(time / 60) % 60
  const formatted = [
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0')
  ]

  const hours = Math.floor(time / 3600)
  if (hours) formatted.unshift(String(hours))

  return formatted.join(':');
}

function concatArrayBuffer(buffer1, buffer2) {
  const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);

  return tmp.buffer;
}
