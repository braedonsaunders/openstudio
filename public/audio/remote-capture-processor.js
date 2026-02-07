// Remote Audio Capture Processor
// Captures incoming WebRTC audio and sends raw Float32Array samples to main thread
// for forwarding to the native bridge's ASIO/CoreAudio engine.
// This enables remote performers' audio to be mixed and output through the native device.

class RemoteCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleCount = 0;
    this.batchSize = 480; // 10ms at 48kHz = 480 stereo pairs = 960 floats
    this.accumulator = new Float32Array(this.batchSize * 2); // stereo interleaved
    this.accumulatorPos = 0;
    this.active = true;

    this.port.onmessage = (event) => {
      if (event.data.type === 'stop') {
        this.active = false;
      } else if (event.data.type === 'setBatchSize') {
        // Allow configuring batch size for latency tuning
        this.batchSize = event.data.size;
        this.accumulator = new Float32Array(this.batchSize * 2);
        this.accumulatorPos = 0;
      }
    };
  }

  process(inputs, outputs, parameters) {
    if (!this.active) return false;

    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const inputL = input[0];
    const inputR = input.length > 1 ? input[1] : input[0]; // mono -> duplicate
    const frameCount = inputL.length;

    // Interleave stereo samples into accumulator
    for (let i = 0; i < frameCount; i++) {
      this.accumulator[this.accumulatorPos++] = inputL[i];
      this.accumulator[this.accumulatorPos++] = inputR[i];

      // When we have a full batch, send it
      if (this.accumulatorPos >= this.accumulator.length) {
        // Transfer a copy of the accumulated samples
        const batch = this.accumulator.slice(0, this.accumulatorPos);
        this.port.postMessage({ type: 'audio', samples: batch }, [batch.buffer]);

        // Reset accumulator with a fresh buffer (old one was transferred)
        this.accumulator = new Float32Array(this.batchSize * 2);
        this.accumulatorPos = 0;
      }
    }

    // Pass audio through unchanged (remote audio still plays through Web Audio)
    const output = outputs[0];
    if (output) {
      for (let ch = 0; ch < output.length; ch++) {
        const inputCh = input[Math.min(ch, input.length - 1)];
        output[ch].set(inputCh);
      }
    }

    return true;
  }
}

registerProcessor('remote-capture-processor', RemoteCaptureProcessor);
