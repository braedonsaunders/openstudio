// Bridge Audio Worklet Processor
// Receives audio from native bridge via postMessage and outputs to Web Audio graph
// Runs on dedicated audio thread for consistent timing

class BridgeAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    // Ring buffer for stereo audio (interleaved L/R samples)
    // Size: ~100ms at 48kHz = 4800 stereo frames = 9600 samples
    this.bufferSize = 9600;
    this.buffer = new Float32Array(this.bufferSize);
    this.writePos = 0;
    this.readPos = 0;

    // Stats
    this.underruns = 0;
    this.overruns = 0;
    this.samplesReceived = 0;
    this.samplesOutput = 0;
    this.lastStatsTime = 0; // Will be set on first process() call

    // For smooth underrun handling
    this.lastSampleL = 0;
    this.lastSampleR = 0;

    // Log counter
    this.logCounter = 0;

    // Message counter for logging
    this.messageCount = 0;

    // Handle incoming audio from main thread
    this.port.onmessage = (event) => {
      const { type, samples } = event.data;

      if (type === 'audio') {
        this.messageCount++;
        // Log first few messages and then periodically
        if (this.messageCount <= 3 || this.messageCount % 500 === 0) {
          console.log('[BridgeProcessor] Received audio:', {
            messageCount: this.messageCount,
            samplesLength: samples ? samples.length : 'null',
            samplesType: samples ? samples.constructor.name : 'null',
          });
        }
        if (samples && samples.length > 0) {
          this.pushSamples(samples);
        }
      } else if (type === 'reset') {
        this.reset();
      } else if (type === 'getStats') {
        this.sendStats();
      }
    };
  }

  // Calculate available samples in ring buffer
  getAvailableSamples() {
    if (this.writePos >= this.readPos) {
      return this.writePos - this.readPos;
    }
    return this.bufferSize - this.readPos + this.writePos;
  }

  // Push interleaved stereo samples from native bridge
  pushSamples(samples) {
    const len = samples.length;
    this.samplesReceived += len;

    for (let i = 0; i < len; i++) {
      const nextWritePos = (this.writePos + 1) % this.bufferSize;

      if (nextWritePos === this.readPos) {
        // Buffer full - drop oldest samples
        this.readPos = (this.readPos + 1) % this.bufferSize;
        this.overruns++;
      }

      this.buffer[this.writePos] = samples[i];
      this.writePos = nextWritePos;
    }
  }

  reset() {
    this.buffer.fill(0);
    this.writePos = 0;
    this.readPos = 0;
    this.underruns = 0;
    this.overruns = 0;
    this.samplesReceived = 0;
    this.samplesOutput = 0;
    this.lastSampleL = 0;
    this.lastSampleR = 0;
  }

  sendStats() {
    this.port.postMessage({
      type: 'stats',
      underruns: this.underruns,
      overruns: this.overruns,
      bufferFill: this.getAvailableSamples() / this.bufferSize,
      samplesReceived: this.samplesReceived,
      samplesOutput: this.samplesOutput,
      messageCount: this.messageCount
    });
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length < 2) return true;

    const outputL = output[0];
    const outputR = output[1];
    const frameCount = outputL.length; // Usually 128 frames

    // We need frameCount * 2 samples (interleaved stereo)
    const samplesNeeded = frameCount * 2;
    const available = this.getAvailableSamples();

    // Log stats periodically
    this.logCounter++;
    if (this.logCounter % 375 === 0) { // ~1 second at 128 sample frames @ 48kHz
      this.sendStats();
    }

    if (available >= samplesNeeded) {
      // We have enough data - de-interleave and output
      for (let i = 0; i < frameCount; i++) {
        const sampleL = this.buffer[this.readPos];
        this.readPos = (this.readPos + 1) % this.bufferSize;

        const sampleR = this.buffer[this.readPos];
        this.readPos = (this.readPos + 1) % this.bufferSize;

        outputL[i] = sampleL;
        outputR[i] = sampleR;

        this.lastSampleL = sampleL;
        this.lastSampleR = sampleR;
      }
      this.samplesOutput += samplesNeeded;
    } else {
      // Underrun - output last samples with decay to avoid clicks
      this.underruns++;
      const decay = 0.95;

      for (let i = 0; i < frameCount; i++) {
        outputL[i] = this.lastSampleL;
        outputR[i] = this.lastSampleR;
        this.lastSampleL *= decay;
        this.lastSampleR *= decay;
      }
    }

    return true; // Keep processor alive
  }
}

registerProcessor('bridge-audio-processor', BridgeAudioProcessor);
