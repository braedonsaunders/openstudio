// Ultra-Low-Latency Bridge Audio Worklet Processor with SharedArrayBuffer
// Uses SharedArrayBuffer for zero-copy audio transfer from main thread
// Combined with clock synchronization for predictive scheduling
// Target latency: 5-10ms (vs 30-40ms with postMessage)

class BridgeAudioProcessorSAB extends AudioWorkletProcessor {
  constructor(options) {
    super();

    // SharedArrayBuffer state
    this.sharedBuffer = null;
    this.sharedView = null;
    this.useSharedBuffer = false;

    // Ring buffer layout in SharedArrayBuffer:
    // [0]: writePos (Uint32)
    // [1]: readPos (Uint32)
    // [2]: flags (Uint32) - bit 0: reset requested
    // [3]: clockOffset (Float64 as two Uint32s)
    // [5]: nativeTimestamp (Float64 as two Uint32s) - last packet timestamp
    // [7]: reserved
    // [8...]: audio samples (Float32)
    this.HEADER_SIZE = 8; // Uint32 slots for metadata
    this.HEADER_BYTES = this.HEADER_SIZE * 4;

    // Buffer sizing - aggressive for low latency
    // With clock sync, we can use much smaller buffers
    const asioBufferSize = options?.processorOptions?.asioBufferSize || 128;
    // Target: 5ms buffer at 48kHz = 240 stereo samples = 480 floats
    // But scale with ASIO buffer for safety
    const minBufferMs = 5; // Down from 30ms!
    const minBufferSamples = Math.ceil(48000 * minBufferMs / 1000) * 2;
    const asioBasedSize = asioBufferSize * 16; // 8 callbacks worth (down from 20)
    const calculatedSize = Math.max(asioBasedSize, minBufferSamples);
    // Round up to power of 2
    this.bufferSize = Math.pow(2, Math.ceil(Math.log2(calculatedSize)));

    // Fallback ring buffer (when SAB not available)
    this.fallbackBuffer = new Float32Array(this.bufferSize);
    this.fallbackWritePos = 0;
    this.fallbackReadPos = 0;

    // Clock synchronization
    this.clockOffset = 0; // Difference between native time and AudioContext time
    this.clockSamples = [];
    this.maxClockSamples = 10;

    // Stats
    this.underruns = 0;
    this.overruns = 0;
    this.samplesReceived = 0;
    this.samplesOutput = 0;
    this.logCounter = 0;
    this.messageCount = 0;

    // For smooth underrun handling
    this.lastSampleL = 0;
    this.lastSampleR = 0;

    console.log('[BridgeProcessorSAB] Initialized with buffer size:', this.bufferSize,
      '(target latency:', minBufferMs, 'ms)');

    // Handle messages from main thread
    this.port.onmessage = (event) => {
      const { type } = event.data;

      if (type === 'init-sab') {
        // Initialize SharedArrayBuffer mode
        this.sharedBuffer = event.data.buffer;
        this.sharedView = new DataView(this.sharedBuffer);
        this.sharedFloatView = new Float32Array(this.sharedBuffer, this.HEADER_BYTES);
        this.sharedUint32View = new Uint32Array(this.sharedBuffer, 0, this.HEADER_SIZE);
        this.useSharedBuffer = true;
        console.log('[BridgeProcessorSAB] SharedArrayBuffer initialized, size:',
          this.sharedFloatView.length, 'samples');
      } else if (type === 'audio') {
        // Fallback: receive audio via postMessage
        this.messageCount++;
        if (event.data.samples && event.data.samples.length > 0) {
          this.pushSamplesFallback(event.data.samples);

          // Clock sync from timestamp
          if (event.data.timestamp) {
            this.updateClockSync(event.data.timestamp);
          }
        }
      } else if (type === 'clock-sync') {
        // Explicit clock synchronization message
        this.updateClockSync(event.data.nativeTime);
      } else if (type === 'reset') {
        this.reset();
      } else if (type === 'getStats') {
        this.sendStats();
      }
    };
  }

  // Update clock synchronization
  updateClockSync(nativeTimestamp) {
    // Calculate offset between native time and AudioContext time
    const audioTime = currentTime * 1000; // Convert to ms
    const offset = nativeTimestamp - audioTime;

    this.clockSamples.push(offset);
    if (this.clockSamples.length > this.maxClockSamples) {
      this.clockSamples.shift();
    }

    // Use median for stability (resistant to outliers)
    const sorted = [...this.clockSamples].sort((a, b) => a - b);
    this.clockOffset = sorted[Math.floor(sorted.length / 2)];
  }

  // Get available samples (SharedArrayBuffer mode)
  getAvailableSamplesSAB() {
    const writePos = Atomics.load(this.sharedUint32View, 0);
    const readPos = Atomics.load(this.sharedUint32View, 1);

    if (writePos >= readPos) {
      return writePos - readPos;
    }
    return this.sharedFloatView.length - readPos + writePos;
  }

  // Get available samples (fallback mode)
  getAvailableSamplesFallback() {
    if (this.fallbackWritePos >= this.fallbackReadPos) {
      return this.fallbackWritePos - this.fallbackReadPos;
    }
    return this.bufferSize - this.fallbackReadPos + this.fallbackWritePos;
  }

  // Push samples in fallback mode
  pushSamplesFallback(samples) {
    const len = samples.length;
    this.samplesReceived += len;

    for (let i = 0; i < len; i += 2) {
      const spaceAvailable = this.bufferSize - this.getAvailableSamplesFallback() - 1;

      if (spaceAvailable < 2) {
        this.fallbackReadPos = (this.fallbackReadPos + 2) % this.bufferSize;
        this.overruns += 2;
      }

      this.fallbackBuffer[this.fallbackWritePos] = samples[i];
      this.fallbackWritePos = (this.fallbackWritePos + 1) % this.bufferSize;

      if (i + 1 < len) {
        this.fallbackBuffer[this.fallbackWritePos] = samples[i + 1];
      } else {
        this.fallbackBuffer[this.fallbackWritePos] = samples[i];
      }
      this.fallbackWritePos = (this.fallbackWritePos + 1) % this.bufferSize;
    }
  }

  reset() {
    if (this.useSharedBuffer) {
      Atomics.store(this.sharedUint32View, 0, 0); // writePos
      Atomics.store(this.sharedUint32View, 1, 0); // readPos
    }
    this.fallbackBuffer.fill(0);
    this.fallbackWritePos = 0;
    this.fallbackReadPos = 0;
    this.underruns = 0;
    this.overruns = 0;
    this.samplesReceived = 0;
    this.samplesOutput = 0;
    this.lastSampleL = 0;
    this.lastSampleR = 0;
    this.clockSamples = [];
    this.clockOffset = 0;
  }

  sendStats() {
    const available = this.useSharedBuffer
      ? this.getAvailableSamplesSAB()
      : this.getAvailableSamplesFallback();
    const bufferCapacity = this.useSharedBuffer
      ? this.sharedFloatView.length
      : this.bufferSize;

    this.port.postMessage({
      type: 'stats',
      underruns: this.underruns,
      overruns: this.overruns,
      bufferFill: available / bufferCapacity,
      samplesReceived: this.samplesReceived,
      samplesOutput: this.samplesOutput,
      messageCount: this.messageCount,
      useSharedBuffer: this.useSharedBuffer,
      clockOffset: this.clockOffset,
      latencyMs: (available / 2 / 48000 * 1000).toFixed(1),
    });
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length < 2) return true;

    const outputL = output[0];
    const outputR = output[1];
    const frameCount = outputL.length;
    const samplesNeeded = frameCount * 2;

    // Log stats periodically (less frequently for performance)
    this.logCounter++;
    if (this.logCounter % 750 === 0) {
      this.sendStats();
    }

    let available;
    let hasEnoughData;

    if (this.useSharedBuffer) {
      // SharedArrayBuffer mode - zero-copy read
      available = this.getAvailableSamplesSAB();
      hasEnoughData = available >= samplesNeeded;

      if (hasEnoughData) {
        let readPos = Atomics.load(this.sharedUint32View, 1);
        const bufLen = this.sharedFloatView.length;

        for (let i = 0; i < frameCount; i++) {
          const sampleL = this.sharedFloatView[readPos];
          readPos = (readPos + 1) % bufLen;

          const sampleR = this.sharedFloatView[readPos];
          readPos = (readPos + 1) % bufLen;

          outputL[i] = sampleL;
          outputR[i] = sampleR;

          this.lastSampleL = sampleL;
          this.lastSampleR = sampleR;
        }

        // Update read position atomically
        Atomics.store(this.sharedUint32View, 1, readPos);
        this.samplesOutput += samplesNeeded;
      }
    } else {
      // Fallback mode
      available = this.getAvailableSamplesFallback();
      hasEnoughData = available >= samplesNeeded;

      if (hasEnoughData) {
        for (let i = 0; i < frameCount; i++) {
          const sampleL = this.fallbackBuffer[this.fallbackReadPos];
          this.fallbackReadPos = (this.fallbackReadPos + 1) % this.bufferSize;

          const sampleR = this.fallbackBuffer[this.fallbackReadPos];
          this.fallbackReadPos = (this.fallbackReadPos + 1) % this.bufferSize;

          outputL[i] = sampleL;
          outputR[i] = sampleR;

          this.lastSampleL = sampleL;
          this.lastSampleR = sampleR;
        }
        this.samplesOutput += samplesNeeded;
      }
    }

    if (!hasEnoughData) {
      // Underrun - smooth decay
      this.underruns++;
      const decay = 0.9; // Faster decay for cleaner recovery

      for (let i = 0; i < frameCount; i++) {
        outputL[i] = this.lastSampleL;
        outputR[i] = this.lastSampleR;
        this.lastSampleL *= decay;
        this.lastSampleR *= decay;
      }
    }

    return true;
  }
}

registerProcessor('bridge-audio-processor-sab', BridgeAudioProcessorSAB);
