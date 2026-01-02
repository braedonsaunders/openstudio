# AI Agent Guidelines for OpenStudio

This document defines the code quality standards and expectations for AI agents working on this codebase.

## Core Principle: Production-Quality Code Only

**YOU ARE BUILDING A REAL PRODUCTION APPLICATION.**

This is not a demo. This is not a prototype. This is not an educational example. This is production software that real musicians will use for live performances.

---

## Absolute Rules

### NEVER Create Fake or Incomplete Code

- **NO stubs** - Every function must have a complete implementation
- **NO placeholder comments** like `// TODO: implement this`
- **NO empty function bodies** - If a function exists, it must work
- **NO "in a real production app..."** comments - This IS a real production app

### NEVER Leave TODOs

If you identify something that needs to be done:

1. **Do it now** if it's within scope
2. **Document it in `/docs/`** if it's out of scope
3. **NEVER** leave a TODO comment in code

### NEVER Write "Example" or "Demo" Code

- All code must handle real-world edge cases
- All code must have proper error handling
- All code must be thread-safe where required
- All code must handle resource cleanup

---

## Code Quality Standards

### Error Handling

```rust
// WRONG - panic in production code
fn process_audio(data: &[f32]) {
    let device = get_device().unwrap(); // Will panic!
}

// RIGHT - proper error handling
fn process_audio(data: &[f32]) -> Result<(), AudioError> {
    let device = get_device()
        .map_err(|e| AudioError::DeviceNotFound(e.to_string()))?;
    // ...
    Ok(())
}
```

### Thread Safety

```rust
// WRONG - race condition waiting to happen
static mut GLOBAL_STATE: Option<State> = None;

// RIGHT - proper synchronization
static GLOBAL_STATE: Lazy<Arc<RwLock<State>>> =
    Lazy::new(|| Arc::new(RwLock::new(State::default())));
```

### Resource Cleanup

```rust
// WRONG - resource leak
fn start_stream() {
    let stream = open_audio_stream();
    // stream never closed
}

// RIGHT - RAII or explicit cleanup
impl Drop for AudioStream {
    fn drop(&mut self) {
        self.close();
    }
}
```

---

## Documentation Requirements

### Reference Documentation

Before implementing features, reference these docs:

| Component | Documentation |
|-----------|--------------|
| **Database Schema** | `/docs/DATABASE.md` |
| Native Bridge | `/docs/native-bridge-roadmap.md` |
| Opus Codec | https://opus-codec.org/docs/ |
| QUIC/Quinn | https://docs.rs/quinn/latest/quinn/ |
| cpal Audio | https://docs.rs/cpal/latest/cpal/ |
| WebRTC | https://webrtc.rs/docs/ |

### When Adding New Features

1. Read existing code patterns in the module
2. Check `/docs/` for architectural decisions
3. Follow established error handling patterns
4. Add tests for new functionality

### Database Schema Changes

**When modifying the database schema, you MUST update `/docs/DATABASE.md`:**

- Adding tables → Document table structure, columns, types, and defaults
- Adding columns → Update the relevant table documentation
- Adding RLS policies → Document in the RLS Policies section
- Adding functions/triggers → Document in Functions/Triggers sections
- Adding indexes → Document in Indexes section
- Adding foreign keys → Update the Foreign Key Relationships tree

Use the SQL queries in the "Schema Update SQL" section to regenerate schema information if needed.

---

## Prohibited Patterns

### Do Not Use

| Pattern | Why | Alternative |
|---------|-----|-------------|
| `unwrap()` | Panics in production | `?` operator or `match` |
| `expect()` | Panics in production | Proper error types |
| `unimplemented!()` | Panics at runtime | Complete implementation |
| `todo!()` | Panics at runtime | Complete implementation |
| `panic!()` | Crashes the app | Return `Result<T, E>` |
| Empty `match` arms | Silent failures | Handle all cases |
| `unsafe` without comment | Unclear invariants | Document why it's safe |

### Exception: Test Code

`unwrap()` and `expect()` are acceptable in test code where panics are the desired failure mode.

---

## Performance Requirements

### Audio Processing

- Buffer callbacks must complete within buffer duration
- No allocations in audio callback path
- No locks that could block in audio thread
- Use lock-free queues for audio/UI communication

### Network

- Target <15ms round-trip latency on LAN
- Handle packet loss gracefully (Opus FEC)
- Adaptive quality based on network conditions

---

## Before Submitting Code

### Checklist

- [ ] No `TODO`, `FIXME`, or `XXX` comments
- [ ] No `unimplemented!()`, `todo!()`, or `panic!()`
- [ ] All error paths handled
- [ ] Tests pass: `cargo test`
- [ ] No warnings: `cargo clippy`
- [ ] Formatted: `cargo fmt`

### If You Can't Complete Something

1. Stop and explain what's blocking you
2. Ask for clarification or resources
3. Do NOT leave incomplete code with a promise to "finish later"

---

## Summary

Write code as if:
- A professional musician's live performance depends on it (it does)
- There is no "later" to fix things (there isn't)
- Every line will be audited for production readiness (it will)

**Ship complete, working code or ship nothing.**
