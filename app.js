const JUMP_SECONDS = 2

const recordContext = new AudioContext()
let streamContext
let started
let recording

let sum = new ArrayBuffer(0)

const controls = document.getElementById('controls')
const time = controls.querySelector('time')
const peak = controls.querySelector('#controls-rail > div')
setInterval(() => {
  peak.style.width = '100%'
  time.textContent = timeFormatter(recordContext.currentTime)
}, 1000)


const segments = document.getElementById('segments')
const template = document.createElement('li')
template.innerHTML = '<time></time><time></time><p contentEditable="true"></p>'

const movement = (seconds, target) => {
  if (recorder?.state !== 'recording') return explode(target)
}

document.getElementById('move-5')
  .addEventListener('click', ({target}) => movement(-5, target))
document.getElementById('move+5')
  .addEventListener('click', ({target}) => movement(+5, target))

window.addEventListener('keyup', async ({key}) => {
  await recorder.stop()
  await recorder.start()

  await play(recordContext.currentTime - JUMP_SECONDS)
  return;

  if (key === 'ArrowLeft') {
    if (!started) {
      started = recordContext.currentTime
    }
    else {
      started += streamContext.currentTime
    }

    if (started - JUMP_SECONDS < 0) {
      started = 0
    }
    else {
      started -= JUMP_SECONDS
    }

    await play(started)
  }
  else if (key === 'ArrowRight') {
    if (started) {
      started += streamContext.currentTime

      if (started + JUMP_SECONDS >= recordContext.currentTime) {
        await streamContext.close()
      }
      else {
        await play(started += JUMP_SECONDS)
      }
    }
  }
})

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

window.addEventListener('DOMContentLoaded', async () => {
  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({audio: true})
    await recordContext.resume()
  }
  catch (e) {
    explode(document.querySelector('#controls > time'))
    throw new Error(e)
  }

  const source = recordContext.createMediaStreamSource(stream)
  visualize(source)

  const processor = recordContext.createScriptProcessor(4096, 1, 1)

  source.connect(processor)
  processor.connect(recordContext.destination)
  processor.addEventListener('audioprocess', ({inputBuffer}) => {
    if (ws?.readyState < 2) {
      const data = inputBuffer.getChannelData(0)
      ws.readyState < 2 && ws.send(float32ToInt16(data));
    }
  })

  recorder = new MediaRecorder(stream)
  recorder.addEventListener('dataavailable', async ({data}) => {
    const a = document.createElement('audio')
    a.controls = true
    const b = new Blob([data], {type: 'audio/wav'})
    a.src = URL.createObjectURL(b)
    a.onended = function ({target}) {
      console.log('target', target)
      URL.revokeObjectURL(target.src)
      a?.nextElementSibling?.play?.()
    }
    a.ontimeupdate = async function({target}) {
      if (target.nextElementSibling.tagName !== 'AUDIO' && target.duration - 1 < target.currentTime) {
        await recorder.stop()
        await recorder.start()
      }
    }
    segments.before(a)
    chunks.push(a)

    // sum = concatArrayBuffer(sum, buffer)
    // await recordContext.decodeAudioData(buffer, audioBuffer => {
    //   chunks.push(audioBuffer)
    //   recording = false
    // })
  })

  recorder.start()
  segments.before(new Date().toString())

  /*
    ws = new WebSocket(`${url}?single=false${query}`, [],)
    ws.addEventListener('message', function ({data}) {
      console.info(JSON.parse(data))
      const {segment: index, result} = JSON.parse(data)

      if (index) {
        let segment = segments.querySelector(`#segment-${index}`)
        if (!segment) {
          segment = template.cloneNode(true)
          segment.id = `segment-${index}`
          segments.append(segment)
        }

        const time = segment.querySelectorAll('time')
        segment.querySelector('p').textContent = result.hypotheses?.[0]?.transcript
      }
    })
    ws.addEventListener('close', () => ws.CLOSED)
  */
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
  const seconds = Math.round(time % 60)
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
