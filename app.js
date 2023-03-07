const TRANSCRIPT_URL = 'wss://ailab.sorizava.co.kr:40002/client/ws/speech'
const TRANSCRIPT_PARAMS = {
  'model': 'KOREAN_ONLINE_16K',
  'content-type': 'audio%2Fx-raw%2C+layout%3D%28string%29interleaved%2C+rate%3D%28int%2916000%2C+format%3D%28string%29S16LE%2C+channels%3D%28int%291',
  'project': '2e77c961-f709-400a-8c3e-0eeb73604698',
  'access-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJjcmV0RHQiOjE2NzI4MTM4MjYxNTQsImNyZXRyIjoiYWRtaW4iLCJjaGdEdCI6MTY3NzQ2NDk2NTg2NCwiY2hnciI6ImFkbWluIiwibWVtTm8iOjgsIm1lbUlkIjoidGVzdDEiLCJwYXNzd2QiOiIyMzEyNTJhZjIxN2I2NTZhNGQ4OGYwYzJkMmE5ZTc3MzE2M2QxN2MxYmJjMDIxMWI1NTJiYzc4OTg4M2RmMWU1ZjFlMTg5NTRmYTMwZTZkNGM2OWQyNmU0Nzc1MTUzNjE5YzdkOGIyN2U4ZjZiNjJhYTAyNmFkYzYwZDczNjZhYiIsIm1lbU5tIjoi7YWM7Iqk7Yq4IiwidXNlWW4iOiJZIiwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIiwiYXV0aE5vIjoxMSwiZGVwdE5vIjoxLCJqaWt3aUNkIjoiQ0QwNSIsImR1dHlDZCI6IkNEMDEiLCJqb2IiOiIiLCJ0ZWwiOiIiLCJsb2dpbkZhaWwiOjAsIm5vd0R0IjoxNjc3OTQyNzA5OTE1LCJleHBEdCI6MTY3ODAyOTEwOTkxNSwiZXhwU2VjIjo4NjQwMCwiZXhwIjoxNjc4MDI5MTA5fQ.8HBt9oKvMAQdMkS6WpCdxN5txXoWmDcAOWVAj3W11jw',
}
const SAMPLE_RATE = Math.pow(2, 14)
const btnRecord = document.getElementById('record')
const segments = document.getElementById('segments')
const template = document.createElement('li')
template.innerHTML = '<a><time></time><time></time></a><p contenteditable="true"/>'

let recordContext
let webSocket
let recorder
let chunks = []
let closed = 0
let closedTime
let viaMouse
let edited
let player
let playerSource

btnRecord.addEventListener('click', () => {
  if (recordContext?.state === 'running') {
    const lastTime = document.getElementById(`segment-${chunks.length}`)?.querySelector('time')
    if (lastTime && !lastTime.textContent) {
      lastTime.setAttribute('data-start', closed)
      lastTime.textContent = timeFormatter(closed)

      closed += (Date.now() - closedTime) / 1000
      lastTime.nextElementSibling.setAttribute('data-close', closed)
      lastTime.nextElementSibling.textContent = timeFormatter(closed)
    }

    recorder.stop()
    recordContext.close()
    webSocket.send('EOS')
    webSocket.close()
    return
  }

  navigator.mediaDevices.getUserMedia({audio: true})
    .then(async (stream) => {
      await streaming(stream)
      recording(stream)
      establish()
    })
    .catch(() => {
      explode(btnRecord)
    })
})

const streaming = async (stream) => {
  recordContext = new AudioContext({sampleRate: SAMPLE_RATE, latencyHint: 'balanced'})
  await recordContext.resume()

  const source = recordContext.createMediaStreamSource(stream)
  visualize(source)

  const processor = recordContext.createScriptProcessor(4096, 1, 1)
  source.connect(processor)
  processor.connect(recordContext.destination)
  processor.addEventListener('audioprocess', ({inputBuffer}) => {
    if (webSocket?.readyState === 1) {
      const data = inputBuffer.getChannelData(0)
      webSocket.send(float32ToInt16(data));
    }
  })
}

const recording = stream => {
  recorder = new MediaRecorder(stream)
  recorder.addEventListener('dataavailable', async ({data}) => {
    chunks.push(data)
  })
  recorder.start()
}

const establish = () => {
  const query = Object.keys(TRANSCRIPT_PARAMS)
    .reduce((a, b) => a + '&' + b + '=' + TRANSCRIPT_PARAMS[b], '')

  webSocket = new WebSocket(`${TRANSCRIPT_URL}?single=false${query}`)
  webSocket.addEventListener('message', function ({data}) {
    const parsed = JSON.parse(data)
    if (parsed.hasOwnProperty('sessionId')) {
      return console.info('ready transcript!')
    }

    transcript(parsed)
  })
}

const transcript = ({
                      result: {
                        hypotheses,
                        final
                      },
                      'segment-start': start,
                      'total-length': close,
                    }) => {
  const index = chunks.length
  let segment = segments.querySelector(`#segment-${index}`)
  if (!segment) {
    segment = template.cloneNode(true)
    segment.id = `segment-${index}`
    segment.querySelector('a').addEventListener('click', async () => {
      await play(index)
    })
    segment.addEventListener('focusout', () => {
      edited = undefined
    })
    segment.addEventListener('focusin', ({target}) => {
      console.log('focusin')
      grab()
      edited = target
    })

    segments.append(segment)
    !edited && (segments.scrollTop = segments.scrollHeight)
  }

  if (hypotheses) {
    const [{transcript}] = hypotheses
    const time = segment.querySelectorAll('time')
    time[0].setAttribute('data-start', start)
    time[0].textContent = timeFormatter(start)
    time[1].setAttribute('data-close', close)
    time[1].textContent = timeFormatter(close)
    segment.querySelector('p').textContent = transcript

    if (close) {
      closed = close
      closedTime = Date.now()
    }
  }

  if (final) {
    recorder.stop()
    recorder.start()
  }
}


const float32ToInt16 = buffer => {
  let len = buffer.length
  const buf = new Int16Array(len)

  while (len--) {
    buf[len] = Math.min(1, buffer[len]) * 0x7fff
  }

  return buf
}

const visualize = source => {
  const analyser = recordContext.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)

  const length = analyser.frequencyBinCount
  const dataArray = new Uint8Array(length)
  const canvas = document.querySelector('canvas')
  const context = canvas.getContext('2d')
  draw()

  function draw() {
    const width = canvas.width
    const height = canvas.height

    requestAnimationFrame(draw)

    analyser.getByteTimeDomainData(dataArray)

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 3
    context.strokeStyle = 'rgb(255, 255, 255)'
    context.beginPath()

    const sliceWidth = width / length
    let x = 0
    for (let i = 0; i < length; i++) {
      let v = dataArray[i] / 128.0
      let y = (v * height) / 2

      if (i === 0) {
        context.moveTo(x, y)
      }
      else {
        context.lineTo(x, y)
      }

      x += sliceWidth
    }

    context.lineTo(width, height / 2)
    context.stroke()
  }
}

const timeFormatter = time => {
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

const play = async index => {
  await player?.pause()

  URL.revokeObjectURL(playerSource)

  playerSource = URL.createObjectURL(chunks[index])
  player = new Audio(playerSource)
  await player.play()
}

const grab = () => {
  const selection = window.getSelection()
  let {anchorNode: node, anchorOffset: start, focusOffset: close} = selection
  if (node?.nodeType !== Node.TEXT_NODE || start !== close) return

  while (/[^\wㄱ-힣,.?!~]/.test(node.textContent.charAt(start))) start--

  console.log('start', start, close)
  const [matched] = /[\wㄱ-힣]+[,.?!~]*/.exec(node.textContent.substring(start))
  if (matched) {
    console.log('matched', matched)
    selection.setBaseAndExtent(node, start, node, start + matched.length)
  }
}
