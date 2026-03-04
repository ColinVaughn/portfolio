use std::collections::{BTreeMap, HashSet};
use std::time::{Duration, Instant};

pub struct ReorderBuffer {
    next_expected_seq: u32,
    buffer: BTreeMap<u32, (Vec<u8>, Instant)>,
    seen_sequences: std::collections::VecDeque<u32>,
    seen_set: HashSet<u32>,
    max_wait_ms: u64,
}

impl ReorderBuffer {
    pub fn new(max_wait_ms: u64) -> Self {
        Self {
            next_expected_seq: 0,
            buffer: BTreeMap::new(),
            seen_sequences: std::collections::VecDeque::with_capacity(1024),
            seen_set: HashSet::with_capacity(1024),
            max_wait_ms,
        }
    }

    pub fn set_timeout(&mut self, wait_ms: u64) {
        self.max_wait_ms = wait_ms;
    }

    /// Insert a packet into the buffer. Returns a vector of packets that are now ready to be delivered.
    pub fn insert(&mut self, seq: u32, payload: Vec<u8>) -> Vec<Vec<u8>> {
        // Deduplication
        if seq < self.next_expected_seq || self.seen_set.contains(&seq) {
            return vec![];
        }

        self.track_seen(seq);

        if seq == self.next_expected_seq {
            let mut ready = vec![payload];
            self.next_expected_seq += 1;

            // Drain any subsequent contiguous packets
            while let Some((next_payload, _)) = self.buffer.remove(&self.next_expected_seq) {
                ready.push(next_payload);
                self.next_expected_seq += 1;
            }
            ready
        } else {
            // Out of order, buffer it
            self.buffer.insert(seq, (payload, Instant::now()));
            vec![]
        }
    }

    /// Flush packets that have waited longer than max_wait_ms, advancing next_expected_seq.
    pub fn flush_expired(&mut self) -> Vec<Vec<u8>> {
        let mut ready = vec![];
        let now = Instant::now();
        let timeout = Duration::from_millis(self.max_wait_ms);

        while let Some((&seq, &(_, ref timestamp))) = self.buffer.iter().next() {
            if now.duration_since(*timestamp) >= timeout {
                // Packet expired, we give up waiting for next_expected_seq
                let (payload, _) = self.buffer.remove(&seq).unwrap();
                ready.push(payload);
                self.next_expected_seq = seq + 1; // skip missing packets

                // Also get any contiguous packets
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
        if self.seen_sequences.len() == 1024 {
            let oldest = self.seen_sequences.pop_front().unwrap();
            self.seen_set.remove(&oldest);
        }
        self.seen_sequences.push_back(seq);
        self.seen_set.insert(seq);
    }
}
