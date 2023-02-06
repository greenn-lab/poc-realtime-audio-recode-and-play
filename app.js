const context = new AudioContext()
let chunks = []
const audio = document.querySelector('audio')

navigator.mediaDevices.getUserMedia({audio: true}).then(
  async stream => {
    await context.resume()

    const source = context.createMediaStreamSource(stream)
    const processor = context.createScriptProcessor(8192, 1, 1)

    source.connect(processor)
    processor.connect(context.destination)
    processor.onaudioprocess = e => {
      const data = e.inputBuffer.getChannelData(0)
      chunks.push(e.inputBuffer)

      // will be stt by HAIV
      // const converted = convertFloat32ToInt16(data)
    }

    visualize(source)
  },
  err => {
    console.error(err)
  }
)

function concatAudio(buffers) {
  const output = context.createBuffer(
    maxNumberOfChannels(buffers),
    totalLength(buffers),
    context.sampleRate
  );

  let offset = 0;
  buffers.forEach((buffer) => {
    for (let channelNumber = 0; channelNumber < buffer.numberOfChannels; channelNumber++) {
      output.getChannelData(channelNumber).set(buffer.getChannelData(channelNumber), offset);
    }

    offset += buffer.length;
  });

  return output;
}

function maxNumberOfChannels(buffers) {
  return Math.max(...buffers.map((buffer) => buffer.numberOfChannels));
}

function totalLength(buffers) {
  return buffers.map((buffer) => buffer.length).reduce((a, b) => a + b, 0);
}

function convertFloat32ToInt16(buffer) {
  let len = buffer.length
  const buf = new Int16Array(len)

  while (len--) {
    buf[len] = Math.min(1, buffer[len]) * 0x7fff
  }

  return buf
}

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

    canvasCtx.lineWidth = 2
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
