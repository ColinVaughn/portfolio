use std::collections::{BTreeMap, HashSet};
use std::time::{Duration, Instant};

pub struct ReorderBuffer {
    next_expected_seq: u32,
    buffer: BTreeMap<u32, (Vec<u8>, Instant)>,
    seen_sequences: std::collections::VecDeque<u32>,
    seen_set: HashSet<u32>,
    max_wait_ms: u64,
    force_drain_limit: usize,
}

impl ReorderBuffer {
    pub fn new(max_wait_ms: u64) -> Self {
        Self {
            next_expected_seq: 0,
            buffer: BTreeMap::new(),
            seen_sequences: std::collections::VecDeque::with_capacity(4096),
            seen_set: HashSet::with_capacity(4096),
            max_wait_ms,
            force_drain_limit: 512,
        }
    }

    pub fn set_timeout(&mut self, wait_ms: u64) {
        self.max_wait_ms = wait_ms;
    }

    pub fn insert(&mut self, seq: u32, payload: Vec<u8>) -> Vec<Vec<u8>> {
        if seq < self.next_expected_seq || self.seen_set.contains(&seq) {
            return vec![];
        }

        self.track_seen(seq);

        if seq == self.next_expected_seq {
            let mut ready = vec![payload];
            self.next_expected_seq += 1;

            while let Some((next_payload, _)) = self.buffer.remove(&self.next_expected_seq) {
                ready.push(next_payload);
                self.next_expected_seq += 1;
            }
            ready
        } else {
            self.buffer.insert(seq, (payload, Instant::now()));
            // Force-drain if buffer exceeds limit
            if self.buffer.len() >= self.force_drain_limit {
                return self.force_drain();
            }
            vec![]
        }
    }

    pub fn flush_expired(&mut self) -> Vec<Vec<u8>> {
        let mut ready = vec![];
        let now = Instant::now();
        let timeout = Duration::from_millis(self.max_wait_ms);

        while let Some((&seq, &(_, ref timestamp))) = self.buffer.iter().next() {
            if now.duration_since(*timestamp) >= timeout {
                let (payload, _) = self.buffer.remove(&seq).unwrap();
                ready.push(payload);
                self.next_expected_seq = seq + 1;

                while let Some((next_payload, _)) = self.buffer.remove(&self.next_expected_seq) {
                    ready.push(next_payload);
                    self.next_expected_seq += 1;
                }
            } else {
                break;
            }
        }
        ready
    }

    fn track_seen(&mut self, seq: u32) {
        if self.seen_sequences.len() == 4096 {
            let oldest = self.seen_sequences.pop_front().unwrap();
            self.seen_set.remove(&oldest);
        }
        self.seen_sequences.push_back(seq);
        self.seen_set.insert(seq);
    }

    /// Force-drain: release all buffered packets in order
    fn force_drain(&mut self) -> Vec<Vec<u8>> {
        let mut ready = vec![];
        let keys: Vec<u32> = self.buffer.keys().copied().collect();
        for seq in keys {
            if let Some((payload, _)) = self.buffer.remove(&seq) {
                ready.push(payload);
            }
        }
        if let Some(&last) = ready.last().and(self.buffer.keys().next_back()) {
            self.next_expected_seq = last + 1;
        } else if !ready.is_empty() {
            // All drained, set to max seq we've seen + 1
            self.next_expected_seq = self.seen_sequences.back().copied().unwrap_or(0) + 1;
        }
        ready
    }
}
