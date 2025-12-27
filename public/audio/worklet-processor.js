// OpenStudio AudioWorklet Processor
// Runs in a separate audio thread for ultra-low latency processing

class OpenStudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    this.bufferSize = options.processorOptions?.bufferSize || 256;
    this.inputBuffer = new Float32Array(this.bufferSize);
    this.outputBuffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.bufferFilled = false;

    // Jitter buffer ring buffer
    this.jitterBuffer = new Float32Array(this.bufferSize * 4);
    this.jitterWritePos = 0;
    this.jitterReadPos = 0;

    // Stats
    this.underruns = 0;
    this.overruns = 0;
    this.lastReportTime = currentTime;

    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  handleMessage(data) {
    switch (data.type) {
      case 'setBufferSize':
        this.resizeBuffer(data.bufferSize);
        break;
      case 'getStats':
        this.port.postMessage({
          type: 'stats',
          underruns: this.underruns,
          overruns: this.overruns,
          bufferFill: this.getBufferFillLevel(),
        });
        break;
      case 'reset':
        this.reset();
        break;
    }
  }

  resizeBuffer(newSize) {
    // Create new buffers
    const newInputBuffer = new Float32Array(newSize);
    const newOutputBuffer = new Float32Array(newSize);
    const newJitterBuffer = new Float32Array(newSize * 4);

    // Copy existing data if possible
    const copyLength = Math.min(this.bufferSize, newSize);
    for (let i = 0; i < copyLength; i++) {
      newInputBuffer[i] = this.inputBuffer[i] || 0;
      newOutputBuffer[i] = this.outputBuffer[i] || 0;
    }

    this.inputBuffer = newInputBuffer;
    this.outputBuffer = newOutputBuffer;
    this.jitterBuffer = newJitterBuffer;
    this.bufferSize = newSize;

    // Reset indices
    this.writeIndex = this.writeIndex % newSize;
    this.readIndex = this.readIndex % newSize;
    this.jitterWritePos = 0;
    this.jitterReadPos = 0;

    this.port.postMessage({
      type: 'bufferResized',
      newSize: newSize,
    });
  }

  reset() {
    this.inputBuffer.fill(0);
    this.outputBuffer.fill(0);
    this.jitterBuffer.fill(0);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.jitterWritePos = 0;
    this.jitterReadPos = 0;
    this.bufferFilled = false;
    this.underruns = 0;
    this.overruns = 0;
  }

  getBufferFillLevel() {
    const fillLevel = (this.jitterWritePos - this.jitterReadPos + this.jitterBuffer.length)
                      % this.jitterBuffer.length;
    return fillLevel / this.jitterBuffer.length;
  }

  writeToJitterBuffer(samples) {
    for (let i = 0; i < samples.length; i++) {
      const nextWritePos = (this.jitterWritePos + 1) % this.jitterBuffer.length;

      if (nextWritePos === this.jitterReadPos) {
        // Buffer overflow - skip oldest samples
        this.jitterReadPos = (this.jitterReadPos + 1) % this.jitterBuffer.length;
        this.overruns++;
      }

      this.jitterBuffer[this.jitterWritePos] = samples[i];
      this.jitterWritePos = nextWritePos;
    }
  }

  readFromJitterBuffer(numSamples) {
    const output = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      if (this.jitterReadPos === this.jitterWritePos) {
        // Buffer underrun - output silence
        output[i] = 0;
        this.underruns++;
      } else {
        output[i] = this.jitterBuffer[this.jitterReadPos];
        this.jitterReadPos = (this.jitterReadPos + 1) % this.jitterBuffer.length;
      }
    }

    return output;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    // Report stats periodically (every second)
    if (currentTime - this.lastReportTime >= 1) {
      this.port.postMessage({
        type: 'stats',
        underruns: this.underruns,
        overruns: this.overruns,
        bufferFill: this.getBufferFillLevel(),
      });
      this.lastReportTime = currentTime;
    }

    // Process input channels
    if (input && input.length > 0) {
      for (let channel = 0; channel < input.length; channel++) {
        const inputChannel = input[channel];
        const outputChannel = output[channel];

        if (inputChannel && outputChannel) {
          // Write input to jitter buffer
          this.writeToJitterBuffer(inputChannel);

          // Read from jitter buffer to output
          const bufferedSamples = this.readFromJitterBuffer(outputChannel.length);
          outputChannel.set(bufferedSamples);
        }
      }
    } else if (output && output.length > 0) {
      // No input, just read from buffer
      for (let channel = 0; channel < output.length; channel++) {
        const outputChannel = output[channel];
        if (outputChannel) {
          const bufferedSamples = this.readFromJitterBuffer(outputChannel.length);
          outputChannel.set(bufferedSamples);
        }
      }
    }

    return true; // Keep processor alive
  }
}

// Noise gate processor for reducing background noise
class NoiseGateProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.threshold = -40; // dB
    this.attack = 0.001; // seconds
    this.release = 0.1; // seconds
    this.currentGain = 0;
    this.sampleRate = 48000;

    this.port.onmessage = (event) => {
      const { type, value } = event.data;
      if (type === 'threshold') this.threshold = value;
      if (type === 'attack') this.attack = value;
      if (type === 'release') this.release = value;
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length) return true;

    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      if (!inputChannel || !outputChannel) continue;

      for (let i = 0; i < inputChannel.length; i++) {
        const sample = inputChannel[i];
        const level = Math.abs(sample);
        const levelDb = 20 * Math.log10(level + 1e-10);

        // Calculate target gain
        const targetGain = levelDb > this.threshold ? 1 : 0;

        // Apply attack/release envelope
        const coeff = targetGain > this.currentGain
          ? 1 - Math.exp(-1 / (this.attack * this.sampleRate))
          : 1 - Math.exp(-1 / (this.release * this.sampleRate));

        this.currentGain += coeff * (targetGain - this.currentGain);

        outputChannel[i] = sample * this.currentGain;
      }
    }

    return true;
  }
}

// Compressor processor for consistent levels
class CompressorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.threshold = -24; // dB
    this.ratio = 4;
    this.attack = 0.003; // seconds
    this.release = 0.25; // seconds
    this.makeupGain = 1;
    this.envelope = 0;
    this.sampleRate = 48000;

    this.port.onmessage = (event) => {
      const { type, value } = event.data;
      if (type === 'threshold') this.threshold = value;
      if (type === 'ratio') this.ratio = value;
      if (type === 'attack') this.attack = value;
      if (type === 'release') this.release = value;
      if (type === 'makeupGain') this.makeupGain = value;
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length) return true;

    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      if (!inputChannel || !outputChannel) continue;

      for (let i = 0; i < inputChannel.length; i++) {
        const sample = inputChannel[i];
        const level = Math.abs(sample);

        // Calculate envelope
        const coeff = level > this.envelope
          ? 1 - Math.exp(-1 / (this.attack * this.sampleRate))
          : 1 - Math.exp(-1 / (this.release * this.sampleRate));

        this.envelope += coeff * (level - this.envelope);

        // Calculate compression
        const levelDb = 20 * Math.log10(this.envelope + 1e-10);
        let gainDb = 0;

        if (levelDb > this.threshold) {
          const overDb = levelDb - this.threshold;
          gainDb = overDb * (1 - 1 / this.ratio);
        }

        const gain = Math.pow(10, -gainDb / 20) * this.makeupGain;

        outputChannel[i] = sample * gain;
      }
    }

    return true;
  }
}

// Register all processors
registerProcessor('openstudio-processor', OpenStudioProcessor);
registerProcessor('noise-gate', NoiseGateProcessor);
registerProcessor('compressor', CompressorProcessor);
